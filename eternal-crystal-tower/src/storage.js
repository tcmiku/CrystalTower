import { GAME_CONFIG } from "./config.js";

export const SAVE_KEY = "eternal-crystal-tower.save.v1";

export function defaultSave() {
  return {
    version: 1,
    stardust: 0,
    resources: { echoShards: 0, coreFragments: 0 },
    research: { damage: 0, health: 0, income: 0 },
    relicUnlocks: Object.fromEntries(Object.keys(GAME_CONFIG.relicResearch).map((key) => [key, key === "ward"])),
    relicSlots: GAME_CONFIG.relics.initialSlots,
    relicArchive: {
      disabledRelic: null,
      discovered: Object.fromEntries(Object.keys(GAME_CONFIG.relicCombos).map((key) => [key, false])),
      registeredSets: Object.fromEntries(Object.keys(GAME_CONFIG.relicCombos).map((key) => [key, false]))
    },
    unlocks: { doubleSpeed: false },
    baseCamp: { unlocked: false, recoverySeen: false, coreEcho: false },
    threatSeals: { unlocked: false, equipped: [] },
    campaign: {
      currentChapter: 1,
      coreEnergy: { 1: false },
      repairedNodes: { 1: false },
      unlockedChapters: { 1: true, 2: false },
      chapterRecords: { 1: { cleared: false, clears: 0, bestTime: 0, bestKills: 0, bestScore: 0 } }
    },
    settings: { muted: false, playerName: "PLAYER", updatesDismissed: false },
    records: { highestThreat: 1, longestTime: 0, totalKills: 0, failures: 0 },
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
  safe.resources.echoShards = boundedInt(candidate.resources?.echoShards, 0, 1_000_000_000);
  safe.resources.coreFragments = boundedInt(candidate.resources?.coreFragments, 0, 1_000_000_000);
  for (const key of Object.keys(safe.research)) {
    safe.research[key] = boundedInt(candidate.research?.[key], 0, GAME_CONFIG.research.maxLevel);
  }
  for (const key of Object.keys(safe.relicUnlocks)) safe.relicUnlocks[key] = candidate.relicUnlocks?.[key] === true;
  safe.relicUnlocks.ward = true;
  safe.relicSlots = boundedInt(candidate.relicSlots, GAME_CONFIG.relics.initialSlots, GAME_CONFIG.relics.maxSlots);
  for (const key of Object.keys(GAME_CONFIG.relicCombos)) {
    safe.relicArchive.discovered[key] = candidate.relicArchive?.discovered?.[key] === true;
    safe.relicArchive.registeredSets[key] = safe.relicArchive.discovered[key] && candidate.relicArchive?.registeredSets?.[key] === true;
  }
  const disabledRelic = typeof candidate.relicArchive?.disabledRelic === "string" ? candidate.relicArchive.disabledRelic : null;
  const disabledKnown = safe.relicUnlocks[disabledRelic] === true || safe.relicArchive.discovered[disabledRelic] === true;
  safe.relicArchive.disabledRelic = disabledKnown ? disabledRelic : null;
  safe.unlocks.doubleSpeed = candidate.unlocks?.doubleSpeed === true;
  safe.baseCamp.unlocked = candidate.baseCamp?.unlocked === true;
  safe.baseCamp.recoverySeen = safe.baseCamp.unlocked && candidate.baseCamp?.recoverySeen === true;
  safe.baseCamp.coreEcho = safe.baseCamp.unlocked && candidate.baseCamp?.coreEcho === true;
  safe.campaign.currentChapter = candidate.campaign?.currentChapter === 2 && candidate.campaign?.unlockedChapters?.[2] === true ? 2 : 1;
  safe.campaign.coreEnergy[1] = candidate.campaign?.coreEnergy?.[1] === true;
  safe.campaign.repairedNodes[1] = safe.campaign.coreEnergy[1] && candidate.campaign?.repairedNodes?.[1] === true;
  safe.campaign.unlockedChapters[2] = safe.campaign.repairedNodes[1] && candidate.campaign?.unlockedChapters?.[2] === true;
  // Threat seals are earned from the first chapter's core energy.  Do not trust
  // a forged standalone `threatSeals.unlocked` flag in an old or edited save.
  safe.threatSeals.unlocked = safe.campaign.coreEnergy[1] === true;
  const equippedSeals = Array.isArray(candidate.threatSeals?.equipped) ? candidate.threatSeals.equipped : [];
  safe.threatSeals.equipped = safe.threatSeals.unlocked
    ? [...new Set(equippedSeals.filter((key) => Object.hasOwn(GAME_CONFIG.threatSeals, key)))]
    : [];
  const chapterOne = candidate.campaign?.chapterRecords?.[1];
  safe.campaign.chapterRecords[1] = {
    cleared: safe.campaign.coreEnergy[1] || chapterOne?.cleared === true,
    clears: boundedInt(chapterOne?.clears, 0, 1_000_000),
    bestTime: Math.max(0, Number(chapterOne?.bestTime) || 0),
    bestKills: boundedInt(chapterOne?.bestKills, 0, 1_000_000_000),
    bestScore: boundedInt(chapterOne?.bestScore, 0, 2_000_000_000)
  };
  safe.settings.muted = Boolean(candidate.settings?.muted);
  safe.settings.playerName = sanitizePlayerName(candidate.settings?.playerName ?? "PLAYER");
  safe.settings.updatesDismissed = candidate.settings?.updatesDismissed === true;
  safe.records.highestThreat = boundedInt(candidate.records?.highestThreat, 1, 1_000_000);
  safe.records.longestTime = Math.max(0, Number(candidate.records?.longestTime) || 0);
  safe.records.totalKills = boundedInt(candidate.records?.totalKills, 0, 1_000_000_000);
  safe.records.failures = boundedInt(candidate.records?.failures, 0, 1_000_000_000);
  // Keep this field optional so pre-seal saves retain their original shape while
  // new runs persist progress once it has actually been earned.
  if (Object.hasOwn(candidate.records ?? {}, "sealAchievementProgress")) {
    safe.records.sealAchievementProgress = boundedInt(candidate.records.sealAchievementProgress, 0, 2_000_000_000);
  }
  const entries = Array.isArray(candidate.leaderboard) ? candidate.leaderboard : [];
  safe.leaderboard = entries.map((entry) => ({
    name: sanitizePlayerName(entry?.name),
    score: boundedInt(entry?.score, 0, 2_000_000_000),
    kills: boundedInt(entry?.kills, 0, 1_000_000_000),
    threat: boundedInt(entry?.threat, 1, 1_000_000),
    time: Math.max(0, Number(entry?.time) || 0),
    coins: boundedInt(entry?.coins, 0, 1_000_000_000),
    message: sanitizeLeaderboardMessage(entry?.message),
    chapter: boundedInt(entry?.chapter, 1, 999),
    mode: entry?.mode === "endless" ? "endless" : "standard",
    date: boundedInt(entry?.date, 0, Number.MAX_SAFE_INTEGER)
  })).sort(compareLeaderboardEntries).slice(0, GAME_CONFIG.score.leaderboardSize);
  return safe;
}

export function unlockDoubleSpeed(save) {
  if (!save.unlocks || typeof save.unlocks !== "object") save.unlocks = { doubleSpeed: false };
  if (save.unlocks.doubleSpeed === true) return false;
  save.unlocks.doubleSpeed = true;
  return true;
}

export function registerFailure(save) {
  save.records.failures = boundedInt((save.records.failures ?? 0) + 1, 0, 1_000_000_000);
  if (save.baseCamp.unlocked) return false;
  save.baseCamp.unlocked = true;
  save.baseCamp.coreEcho = true;
  return true;
}

export function markBaseRecoverySeen(save) {
  if (!save.baseCamp.unlocked) return false;
  save.baseCamp.recoverySeen = true;
  return true;
}

export function grantPermanentResource(save, type, value = 1) {
  const key = type === "echo" ? "echoShards" : type === "core" ? "coreFragments" : null;
  if (!key) return false;
  save.resources[key] = boundedInt((save.resources[key] ?? 0) + value, 0, 1_000_000_000);
  return true;
}

export function grantChapterCoreEnergy(save, chapter = 1, record = {}) {
  if (chapter !== 1) return false;
  save.campaign ??= defaultSave().campaign;
  const firstClear = save.campaign.coreEnergy[1] !== true;
  save.campaign.coreEnergy[1] = true;
  save.threatSeals ??= defaultSave().threatSeals;
  save.threatSeals.unlocked = true;
  const current = save.campaign.chapterRecords[1] ?? defaultSave().campaign.chapterRecords[1];
  save.campaign.chapterRecords[1] = {
    cleared: true,
    clears: boundedInt((current.clears ?? 0) + (record.countClear === false ? 0 : 1), 0, 1_000_000),
    bestTime: Math.max(Number(current.bestTime) || 0, Number(record.time) || 0),
    bestKills: Math.max(boundedInt(current.bestKills, 0, 1_000_000_000), boundedInt(record.kills, 0, 1_000_000_000)),
    bestScore: Math.max(boundedInt(current.bestScore, 0, 2_000_000_000), boundedInt(record.score, 0, 2_000_000_000))
  };
  save.baseCamp.unlocked = true;
  return firstClear;
}

export function repairChapterNode(save, chapter = 1) {
  if (chapter !== 1 || save.campaign?.coreEnergy?.[1] !== true || save.campaign?.repairedNodes?.[1] === true) return false;
  save.campaign.repairedNodes[1] = true;
  save.campaign.unlockedChapters[2] = true;
  return true;
}

export function toggleThreatSeal(save, key) {
  if (save.threatSeals?.unlocked !== true || !Object.hasOwn(GAME_CONFIG.threatSeals, key)) return false;
  const equipped = new Set(Array.isArray(save.threatSeals.equipped) ? save.threatSeals.equipped : []);
  if (equipped.has(key)) equipped.delete(key);
  else equipped.add(key);
  save.threatSeals.equipped = [...equipped];
  return true;
}

export function sanitizePlayerName(value) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}_\- ]/gu, "").slice(0, 12);
  return cleaned || "无名守望者";
}

export function sanitizeLeaderboardMessage(value) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\p{P}\p{S} ]/gu, "")
    .replace(/[<>]/g, "");
  return Array.from(cleaned).slice(0, GAME_CONFIG.score.leaderboardMessageMaxLength).join("");
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
    message: sanitizeLeaderboardMessage(entry?.message),
    chapter: boundedInt(entry?.chapter, 1, 999),
    mode: entry?.mode === "endless" ? "endless" : "standard",
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
  const cfg = GAME_CONFIG.research;
  return Math.max(1, Math.ceil(cfg.costBase * (cfg.costGrowth ** Math.max(0, Number(level) || 0))));
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

export function buyRelicUnlock(save, key) {
  const cost = GAME_CONFIG.relicResearch[key];
  if (!Number.isFinite(cost) || save.relicUnlocks?.[key] === true || save.resources.echoShards < cost) return false;
  save.resources.echoShards -= cost;
  save.relicUnlocks[key] = true;
  return true;
}

export function buyRelicSlot(save) {
  const slots = boundedInt(save.relicSlots, GAME_CONFIG.relics.initialSlots, GAME_CONFIG.relics.maxSlots);
  if (slots >= GAME_CONFIG.relics.maxSlots) return false;
  const cost = GAME_CONFIG.relicSlotResearch.costs[slots - GAME_CONFIG.relics.initialSlots];
  if (!Number.isFinite(cost) || save.resources.coreFragments < cost) return false;
  save.resources.coreFragments -= cost;
  save.relicSlots = slots + 1;
  return true;
}

export function setDisabledRelic(save, id = null) {
  save.relicArchive ??= defaultSave().relicArchive;
  if (id == null || id === save.relicArchive.disabledRelic) {
    save.relicArchive.disabledRelic = null;
    return true;
  }
  const available = save.relicUnlocks?.[id] === true || save.relicArchive.discovered?.[id] === true;
  if (!available) return false;
  save.relicArchive.disabledRelic = id;
  return true;
}

export function discoverHiddenRelic(save, id) {
  if (!GAME_CONFIG.relicCombos[id]) return false;
  save.relicArchive ??= defaultSave().relicArchive;
  if (save.relicArchive.discovered[id]) return false;
  save.relicArchive.discovered[id] = true;
  return true;
}

export function toggleRelicSet(save, id) {
  if (!GAME_CONFIG.relicCombos[id]) return false;
  save.relicArchive ??= defaultSave().relicArchive;
  if (!save.relicArchive.discovered[id]) return false;
  save.relicArchive.registeredSets[id] = !save.relicArchive.registeredSets[id];
  return true;
}
