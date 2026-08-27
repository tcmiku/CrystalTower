import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export class AccountError extends Error {
  constructor(message, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "AccountError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeUsername(value) {
  const username = String(value ?? "").trim().normalize("NFC");
  if (!/^[\p{L}\p{N}_]{3,20}$/u.test(username)) {
    throw new AccountError("用户名须为 3～20 位中文、字母、数字或下划线", 422, "INVALID_USERNAME");
  }
  return { username, key: username.toLocaleLowerCase("en-US") };
}

function validatePassword(value) {
  const password = String(value ?? "");
  if (password.length < 6 || password.length > 128) {
    throw new AccountError("密码长度须为 6～128 位", 422, "INVALID_PASSWORD");
  }
  return password;
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("base64url");
}

async function createPasswordRecord(password) {
  const salt = randomBytes(16);
  const digest = await scrypt(password, salt, 64);
  return { salt: salt.toString("base64"), hash: Buffer.from(digest).toString("base64") };
}

async function passwordMatches(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const expected = Buffer.from(record.hash, "base64");
  const actual = Buffer.from(await scrypt(password, Buffer.from(record.salt, "base64"), expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function emptyData() {
  return { version: 1, users: [] };
}

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

export class AccountStore {
  constructor(file, { now = () => Date.now() } = {}) {
    this.file = file;
    this.now = now;
    this.queue = Promise.resolve();
  }

  run(operation) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  async readData() {
    try {
      const data = JSON.parse(await readFile(this.file, "utf8"));
      if (data?.version !== 1 || !Array.isArray(data.users)) throw new SyntaxError("Invalid account store");
      return data;
    } catch (error) {
      if (error?.code === "ENOENT") return emptyData();
      if (error instanceof SyntaxError) throw new AccountError("账号数据文件损坏", 500, "ACCOUNT_DATA_CORRUPT");
      throw error;
    }
  }

  async writeData(data) {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), "utf8");
    await rename(temporary, this.file);
  }

  createSession(user) {
    const token = randomBytes(32).toString("base64url");
    const createdAt = this.now();
    user.sessions = (Array.isArray(user.sessions) ? user.sessions : [])
      .filter((session) => session.expiresAt > createdAt)
      .concat({ tokenHash: tokenHash(token), createdAt, expiresAt: createdAt + SESSION_LIFETIME_MS });
    return token;
  }

  async register(candidate) {
    const { username, key } = normalizeUsername(candidate?.username);
    const password = validatePassword(candidate?.password);
    const passwordRecord = await createPasswordRecord(password);
    return this.run(async () => {
      const data = await this.readData();
      if (data.users.some((user) => user.usernameKey === key)) {
        throw new AccountError("用户名已被使用", 409, "USERNAME_TAKEN");
      }
      const user = {
        id: randomUUID(), username, usernameKey: key, password: passwordRecord,
        createdAt: this.now(), save: null, saveUpdatedAt: null, sessions: []
      };
      const token = this.createSession(user);
      data.users.push(user);
      await this.writeData(data);
      return { user: publicUser(user), token };
    });
  }

  async login(candidate) {
    const { key } = normalizeUsername(candidate?.username);
    const password = validatePassword(candidate?.password);
    return this.run(async () => {
      const data = await this.readData();
      const user = data.users.find((entry) => entry.usernameKey === key);
      if (!user || !await passwordMatches(password, user.password)) {
        throw new AccountError("用户名或密码错误", 401, "INVALID_CREDENTIALS");
      }
      const token = this.createSession(user);
      await this.writeData(data);
      return { user: publicUser(user), token };
    });
  }

  async authenticate(token) {
    if (!token) return null;
    return this.run(async () => {
      const data = await this.readData();
      const hash = tokenHash(token);
      const now = this.now();
      const user = data.users.find((entry) => entry.sessions?.some((session) => session.tokenHash === hash && session.expiresAt > now));
      return user ? publicUser(user) : null;
    });
  }

  async logout(token) {
    if (!token) return false;
    return this.run(async () => {
      const data = await this.readData();
      const hash = tokenHash(token);
      let changed = false;
      for (const user of data.users) {
        const sessions = Array.isArray(user.sessions) ? user.sessions : [];
        const next = sessions.filter((session) => session.tokenHash !== hash);
        if (next.length !== sessions.length) changed = true;
        user.sessions = next;
      }
      if (changed) await this.writeData(data);
      return changed;
    });
  }

  async readSave(userId) {
    return this.run(async () => {
      const data = await this.readData();
      const user = data.users.find((entry) => entry.id === userId);
      if (!user) throw new AccountError("账号不存在", 401, "UNAUTHORIZED");
      return { save: user.save ?? null, updatedAt: user.saveUpdatedAt ?? null };
    });
  }

  async writeSave(userId, save) {
    return this.run(async () => {
      const data = await this.readData();
      const user = data.users.find((entry) => entry.id === userId);
      if (!user) throw new AccountError("账号不存在", 401, "UNAUTHORIZED");
      user.save = save;
      user.saveUpdatedAt = this.now();
      await this.writeData(data);
      return { save: user.save, updatedAt: user.saveUpdatedAt };
    });
  }

  async deleteAccount(userId) {
    return this.run(async () => {
      const data = await this.readData();
      const index = data.users.findIndex((entry) => entry.id === userId);
      if (index < 0) throw new AccountError("账号不存在", 401, "UNAUTHORIZED");
      const [user] = data.users.splice(index, 1);
      await this.writeData(data);
      return publicUser(user);
    });
  }
}
