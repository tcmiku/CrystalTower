import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../scripts/serve.js";
import { defaultSave } from "../src/storage.js";

async function startTestServer(t) {
  const directory = await mkdtemp(join(tmpdir(), "crystal-api-"));
  const server = createGameServer({
    accountFile: join(directory, "accounts.json"),
    leaderboardFile: join(directory, "leaderboard.json")
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, accountFile: join(directory, "accounts.json") };
}

async function api(baseUrl, path, { cookie, ...options } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers
    }
  });
  return { response, data: await response.json() };
}

test("HTTP 登录、自动会话、云存档、退出和删除形成完整链路", async (t) => {
  const { baseUrl, accountFile } = await startTestServer(t);
  const health = await api(baseUrl, "/api/health");
  assert.equal(health.response.status, 200);

  const registration = await api(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: "守望者", password: "secret88" })
  });
  assert.equal(registration.response.status, 201);
  const setCookie = registration.response.headers.get("set-cookie");
  assert.match(setCookie, /ect_session=.*HttpOnly.*SameSite=Strict/i);
  const cookie = setCookie.split(";", 1)[0];
  assert.doesNotMatch(await readFile(accountFile, "utf8"), /secret88/);

  const session = await api(baseUrl, "/api/auth/session", { cookie });
  assert.equal(session.data.authenticated, true);
  assert.equal(session.data.user.username, "守望者");

  const save = defaultSave();
  save.stardust = 77;
  const saved = await api(baseUrl, "/api/save", { method: "PUT", cookie, body: JSON.stringify({ save }) });
  assert.equal(saved.response.status, 200);
  const loaded = await api(baseUrl, "/api/save", { cookie });
  assert.equal(loaded.data.save.stardust, 77);

  const duplicate = await api(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: "守望者", password: "secret99" })
  });
  assert.equal(duplicate.response.status, 409);

  const logout = await api(baseUrl, "/api/auth/logout", { method: "POST", cookie });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await api(baseUrl, "/api/save", { cookie })).response.status, 401);

  const login = await api(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "守望者", password: "secret88" })
  });
  const loginCookie = login.response.headers.get("set-cookie").split(";", 1)[0];
  assert.equal(login.response.status, 200);
  assert.equal((await api(baseUrl, "/api/account", { method: "DELETE", cookie: loginCookie })).response.status, 200);
  const deletedSession = await api(baseUrl, "/api/auth/session", { cookie: loginCookie });
  assert.equal(deletedSession.data.authenticated, false);
});
