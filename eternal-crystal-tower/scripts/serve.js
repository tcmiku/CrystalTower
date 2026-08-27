import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeSave } from "../src/storage.js";
import { AccountError, AccountStore } from "./account-store.js";
import { LeaderboardStore } from "./leaderboard-store.js";

const defaultRoot = normalize(fileURLToPath(new URL("..", import.meta.url)));
const SESSION_COOKIE = "ect_session";
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png" };

function json(response, status, value, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request, limit = 16_384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new AccountError("请求数据过大", 413, "PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new AccountError("请求内容不是有效 JSON", 400, "INVALID_JSON"); }
}

function cookieValue(request, name) {
  for (const part of String(request.headers.cookie ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function sessionCookie(request, token, maxAge = 30 * 24 * 60 * 60) {
  const secure = process.env.SESSION_SECURE === "1" || request.socket.encrypted || request.headers["x-forwarded-proto"] === "https";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

async function authenticatedUser(request, accounts) {
  const user = await accounts.authenticate(cookieValue(request, SESSION_COOKIE));
  if (!user) throw new AccountError("请先登录", 401, "UNAUTHORIZED");
  return user;
}

function methodNotAllowed(response, allowed) {
  return json(response, 405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, { Allow: allowed.join(", ") });
}

export function createGameServer({
  root = defaultRoot,
  leaderboardFile = resolve(process.env.LEADERBOARD_FILE || join(root, "data", "leaderboard.json")),
  accountFile = resolve(process.env.ACCOUNT_FILE || join(root, "data", "accounts.json")),
  leaderboard = new LeaderboardStore(leaderboardFile),
  accounts = new AccountStore(accountFile)
} = {}) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      if (url.pathname === "/api/health") {
        if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
        return json(response, 200, { status: "ok" });
      }
      if (url.pathname === "/api/auth/register" || url.pathname === "/api/auth/login") {
        if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
        const result = url.pathname.endsWith("register")
          ? await accounts.register(await readJsonBody(request))
          : await accounts.login(await readJsonBody(request));
        return json(response, url.pathname.endsWith("register") ? 201 : 200, { user: result.user }, { "Set-Cookie": sessionCookie(request, result.token) });
      }
      if (url.pathname === "/api/auth/session") {
        if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
        const user = await accounts.authenticate(cookieValue(request, SESSION_COOKIE));
        return json(response, 200, { authenticated: Boolean(user), user });
      }
      if (url.pathname === "/api/auth/logout") {
        if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
        await accounts.logout(cookieValue(request, SESSION_COOKIE));
        return json(response, 200, { ok: true }, { "Set-Cookie": sessionCookie(request, "", 0) });
      }
      if (url.pathname === "/api/account") {
        if (request.method !== "DELETE") return methodNotAllowed(response, ["DELETE"]);
        const user = await authenticatedUser(request, accounts);
        await accounts.deleteAccount(user.id);
        return json(response, 200, { ok: true }, { "Set-Cookie": sessionCookie(request, "", 0) });
      }
      if (url.pathname === "/api/save") {
        const user = await authenticatedUser(request, accounts);
        if (request.method === "GET") return json(response, 200, await accounts.readSave(user.id));
        if (request.method === "PUT") {
          const body = await readJsonBody(request, 1_000_000);
          if (!body.save || typeof body.save !== "object") throw new AccountError("缺少有效存档", 422, "INVALID_SAVE");
          return json(response, 200, await accounts.writeSave(user.id, sanitizeSave(body.save)));
        }
        return methodNotAllowed(response, ["GET", "PUT"]);
      }
      if (url.pathname === "/api/leaderboard") {
        if (request.method === "GET") return json(response, 200, { entries: await leaderboard.read() });
        if (request.method === "POST") return json(response, 201, await leaderboard.submit(await readJsonBody(request)));
        return methodNotAllowed(response, ["GET", "POST"]);
      }
      const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const target = normalize(join(root, relative));
      if (!target.startsWith(root)) throw new AccountError("Forbidden", 403, "FORBIDDEN");
      const info = await stat(target);
      const file = info.isDirectory() ? join(target, "index.html") : target;
      response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      response.end(await readFile(file));
    } catch (error) {
      if (request.url?.startsWith("/api/")) {
        const status = error instanceof AccountError ? error.status : 500;
        if (status >= 500) console.error(JSON.stringify({ level: "error", message: error?.message, path: request.url }));
        return json(response, status, {
          error: error instanceof AccountError ? error.message : "服务器内部错误",
          code: error instanceof AccountError ? error.code : "INTERNAL_ERROR"
        });
      }
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      response.end("Not found");
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 4173;
  const host = process.env.HOST || "0.0.0.0";
  createGameServer().listen(port, host, () => {
    console.log(JSON.stringify({ level: "info", message: "永耀晶塔已启动", url: `http://${host}:${port}` }));
  });
}
