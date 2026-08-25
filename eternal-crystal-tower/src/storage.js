import { GAME_CONFIG } from "./config.js";

export const SAVE_KEY = "eternal-crystal-tower.save.v1";

export function defaultSave() {
  return {
    version: 1,
    stardust: 0,
    research: { damage: 0, health: 0, income: 0 },
    settings: { muted: false, playerName: "PLAYER" },
    records: { highestThreat: 1, longestTime: 0, totalKills: 0 },
    leaderboard: []
  };
}

function boundedInt(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : min;
}

export function sanitizeSave(candidate) {
  const safe = defaultSave();
  if (!candidate || typeof candidate !== "object" || candidate.version !== 1) return safe;
  safe.stardust = boundedInt(candidate.stardust, 0, 1_000_000_000);
  for (const key of Object.keys(safe.research)) {
    safe.research[key] = boundedInt(candidate.research?.[key], 0, GAME_CONFIG.research.maxLevel);
  }
  safe.settings.muted = Boolean(candidate.settings?.muted);
  safe.settings.playerName = sanitizePlayerName(candidate.settings?.playerName ?? "PLAYER");
  safe.records.highestThreat = boundedInt(candidate.records?.highestThreat, 1, 1_000_000);
  safe.records.longestTime = Math.max(0, Number(candidate.records?.longestTime) || 0);
  safe.records.totalKills = boundedInt(candidate.records?.totalKills, 0, 1_000_000_000);
  const entries = Array.isArray(candidate.leaderboard) ? candidate.leaderboard : [];
  safe.leaderboard = entries.map((entry) => ({
    name: sanitizePlayerName(entry?.name),
    score: boundedInt(entry?.score, 0, 2_000_000_000),
    kills: boundedInt(entry?.kills, 0, 1_000_000_000),
    threat: boundedInt(entry?.threat, 1, 1_000_000),
    time: Math.max(0, Number(entry?.time) || 0),
    coins: boundedInt(entry?.coins, 0, 1_000_000_000),
    date: boundedInt(entry?.date, 0, Number.MAX_SAFE_INTEGER)
  })).sort(compareLeaderboardEntries).slice(0, GAME_CONFIG.score.leaderboardSize);
  return safe;
}

export function sanitizePlayerName(value) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}_\- ]/gu, "").slice(0, 12);
  return cleaned || "无名守望者";
}

export function compareLeaderboardEntries(a, b) {
  return b.score - a.score || b.threat - a.threat || b.kills - a.kills || b.time - a.time || a.date - b.date;
}

export function normalizeLeaderboardEntry(entry) {
  return {
    name: sanitizePlayerName(entry?.name),
    score: boundedInt(entry?.score, 0, 2_000_000_000),
    kills: boundedInt(entry?.kills, 0, 1_000_000_000),
    threat: boundedInt(entry?.threat, 1, 1_000_000),
    time: Math.max(0, Number(entry?.time) || 0),
    coins: boundedInt(entry?.coins, 0, 1_000_000_000),
    date: boundedInt(entry?.date ?? Date.now(), 0, Number.MAX_SAFE_INTEGER)
  };
}

export function submitLeaderboardEntry(save, entry) {
  const normalized = normalizeLeaderboardEntry(entry);
  save.leaderboard = [...(Array.isArray(save.leaderboard) ? save.leaderboard : []), normalized]
    .sort(compareLeaderboardEntries)
    .slice(0, GAME_CONFIG.score.leaderboardSize);
  return { entry: normalized, rank: save.leaderboard.indexOf(normalized) + 1 };
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    return sanitizeSave(JSON.parse(storage?.getItem(SAVE_KEY) ?? "null"));
  } catch {
    return defaultSave();
  }
}

export function writeSave(save, storage = globalThis.localStorage) {
  const safe = sanitizeSave(save);
  storage?.setItem(SAVE_KEY, JSON.stringify(safe));
  return safe;
}

export function researchCost(level) {
  return level + 1;
}

export function buyResearch(save, key) {
  if (!(key in save.research)) return false;
  const level = save.research[key];
  const cost = researchCost(level);
  if (level >= GAME_CONFIG.research.maxLevel || save.stardust < cost) return false;
  save.stardust -= cost;
  save.research[key] += 1;
  return true;
}
