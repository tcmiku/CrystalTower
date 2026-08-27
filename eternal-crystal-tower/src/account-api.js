export class AccountApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "AccountApiError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new AccountApiError(data?.error || "账号服务暂时不可用", response.status, data?.code);
  return data;
}

export function restoreSession() {
  return request("/api/auth/session");
}

export function registerAccount(username, password) {
  return request("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function loginAccount(username, password) {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function logoutAccount() {
  return request("/api/auth/logout", { method: "POST" });
}

export function deleteAccount() {
  return request("/api/account", { method: "DELETE" });
}

export function readCloudSave() {
  return request("/api/save");
}

export function writeCloudSave(save) {
  return request("/api/save", { method: "PUT", body: JSON.stringify({ save }) });
}
