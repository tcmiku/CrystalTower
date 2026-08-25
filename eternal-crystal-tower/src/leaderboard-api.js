const ENDPOINT = "/api/leaderboard";

async function readJson(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `排行榜服务异常 (${response.status})`);
  return data;
}

export async function fetchLeaderboard() {
  const response = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
  const data = await readJson(response);
  return Array.isArray(data?.entries) ? data.entries : [];
}

export async function postLeaderboardEntry(entry) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(entry)
  });
  return readJson(response);
}
