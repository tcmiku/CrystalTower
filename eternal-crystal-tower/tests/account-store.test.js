import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountError, AccountStore, normalizeUsername } from "../scripts/account-store.js";
import { defaultSave } from "../src/storage.js";

test("用户名校验支持中文且按大小写阻止重复注册", async () => {
  assert.deepEqual(normalizeUsername("  守望者_01  "), { username: "守望者_01", key: "守望者_01" });
  assert.throws(() => normalizeUsername("ab"), (error) => error instanceof AccountError && error.code === "INVALID_USERNAME");

  const directory = await mkdtemp(join(tmpdir(), "crystal-account-"));
  const file = join(directory, "accounts.json");
  const store = new AccountStore(file);
  await store.register({ username: "Crystal", password: "secret88" });
  await assert.rejects(
    store.register({ username: "crystal", password: "another88" }),
    (error) => error instanceof AccountError && error.status === 409 && error.code === "USERNAME_TAKEN"
  );

  const persisted = await readFile(file, "utf8");
  assert.doesNotMatch(persisted, /secret88|another88/);
  const data = JSON.parse(persisted);
  assert.ok(data.users[0].password.salt);
  assert.ok(data.users[0].password.hash);
});

test("会话、云存档、退出和删除账号跨存储实例生效", async () => {
  const directory = await mkdtemp(join(tmpdir(), "crystal-account-"));
  const file = join(directory, "accounts.json");
  const firstStore = new AccountStore(file);
  const registered = await firstStore.register({ username: "星火塔", password: "pass1234" });
  assert.equal((await firstStore.authenticate(registered.token)).username, "星火塔");

  const save = defaultSave();
  save.stardust = 42;
  await firstStore.writeSave(registered.user.id, save);

  const restartedStore = new AccountStore(file);
  assert.equal((await restartedStore.readSave(registered.user.id)).save.stardust, 42);
  const login = await restartedStore.login({ username: "星火塔", password: "pass1234" });
  await assert.rejects(restartedStore.login({ username: "星火塔", password: "wrong-password" }), /用户名或密码错误/);
  assert.equal((await restartedStore.authenticate(login.token)).id, registered.user.id);

  await restartedStore.logout(login.token);
  assert.equal(await restartedStore.authenticate(login.token), null);
  await restartedStore.deleteAccount(registered.user.id);
  await assert.rejects(restartedStore.readSave(registered.user.id), /账号不存在/);
});
