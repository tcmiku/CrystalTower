import { GAME_CONFIG, TARGET_PROTOCOL_ORDER, UPGRADE_ORDER } from "./config.js";
import { SeededRng } from "./rng.js";

const ASCEND_NAMES = ["晶芽", "晶柱", "晶冠", "万象晶塔"];
const TECH_NAMES = { damage: "淬亮晶矢", rate: "加速咏唱", ascend: "塔阶", cannonSiege: "破城炮膛", cannonCharge: "蓄能晶矢", cannonPierce: "贯星穿透", cannonWeakpoint: "弱点校准", cannonStarPiercer: "贯星炮", cannonSplit: "裂晶炮膛", cannonGrowth: "碎片增殖", cannonEcho: "晶爆回响", cannonCascade: "裂界连爆", saw: "环绕晶刃", sawOverdrive: "疾旋锻刃", sawGun: "晶刃炮膛", sawLaunch: "弹射飞刃", sawRicochet: "折跃棱面", sawRecovery: "快速重铸", drone: "拾荒无人机", autoCollect: "磁吸核心", droneScavenge: "拾荒协议", droneIntercept: "拦截协议", droneHunt: "猎杀协议", droneBattery: "协议电池扩容", droneDetonate: "自爆协议", droneDetonateRecovery: "快速重组", droneGuard: "棱镜护盾协议", droneGuardRecovery: "冷却优化", frost: "霜棱炮口", fire: "烬火炉心", lightning: "雷鸣天球" };
const SKILL_DAMAGE_SOURCES = new Set(["starfall", "overload", "shieldBurst"]);

export function getThreatSealModifiers(equipped = []) {
  const ids = [...new Set((Array.isArray(equipped) ? equipped : []).filter((key) => Object.hasOwn(GAME_CONFIG.threatSeals, key)))];
  const modifiers = {
    resourceMultiplier: 1, scoreMultiplier: 1, relicChanceBonus: 0, achievementMultiplier: 1,
    nightWaves: GAME_CONFIG.threat.nightWaves, elementMultiplier: 1, coinMultiplier: 1,
    waveCountMultiplier: 1, relicChoiceBonus: 0, colossusSpawnThreat: GAME_CONFIG.colossus.spawnThreat,
    emberCoreBonus: 0, healCooldownMultiplier: 1, skillDamageMultiplier: 1,
    severedSupply: false
  };
  for (const id of ids) {
    const seal = GAME_CONFIG.threatSeals[id];
    modifiers.resourceMultiplier += seal.resourceBonus ?? 0;
    modifiers.scoreMultiplier += seal.scoreBonus ?? 0;
    modifiers.relicChanceBonus += seal.relicChanceBonus ?? 0;
    modifiers.achievementMultiplier += seal.achievementBonus ?? 0;
  }
  if (ids.includes("longNight")) {
    modifiers.nightWaves = GAME_CONFIG.threatSeals.longNight.nightWaves;
    modifiers.elementMultiplier = GAME_CONFIG.threatSeals.longNight.elementMultiplier;
  }
  if (ids.includes("severedSupply")) {
    modifiers.severedSupply = true;
    modifiers.coinMultiplier = GAME_CONFIG.threatSeals.severedSupply.coinMultiplier;
  }
  if (ids.includes("frenzy")) {
    modifiers.waveCountMultiplier = GAME_CONFIG.threatSeals.frenzy.waveCountMultiplier;
    modifiers.relicChoiceBonus = GAME_CONFIG.threatSeals.frenzy.relicChoiceBonus;
  }
  if (ids.includes("colossus")) {
    modifiers.colossusSpawnThreat = GAME_CONFIG.threatSeals.colossus.spawnThreat;
    modifiers.emberCoreBonus = GAME_CONFIG.threatSeals.colossus.emberCoreBonus;
  }
  if (ids.includes("flawless")) {
    modifiers.healCooldownMultiplier = GAME_CONFIG.threatSeals.flawless.healCooldownMultiplier;
    modifiers.skillDamageMultiplier = GAME_CONFIG.threatSeals.flawless.skillDamageMultiplier;
  }
  // Keep persisted/UI-facing modifiers deterministic instead of leaking binary
  // floating-point tails after several additive seal bonuses are combined.
  for (const key of ["resourceMultiplier", "scoreMultiplier", "relicChanceBonus", "achievementMultiplier"]) {
    modifiers[key] = Number(modifiers[key].toFixed(2));
  }
  return { ids, ...modifiers };
}

function normalizeSkillResearchEntry(key, entry) {
  const config = GAME_CONFIG.activeSkillResearch[key];
  const branches = config?.branches ?? {};
  if (!config) return { branch: null, nodes: [] };
  if (Number.isFinite(Number(entry))) {
    const legacyLevel = Math.max(0, Math.floor(Number(entry)));
    const fallback = Object.keys(branches)[0];
    return { branch: legacyLevel > 0 ? fallback ?? null : null, nodes: fallback ? branches[fallback].nodes.slice(0, Math.min(legacyLevel, branches[fallback].nodes.length)).map((node) => node.id) : [] };
  }
  const rawBranch = entry?.branch;
  const branch = Object.hasOwn(branches, rawBranch) ? rawBranch : null;
  if (rawBranch != null && branch == null) return { branch: null, nodes: [] };
  const requested = Array.isArray(entry?.nodes) ? entry.nodes : [];
  const requestedSet = new Set(requested);
  const nodes = [];
  for (const route of Object.values(branches)) {
    for (const node of route.nodes) {
      if (!requestedSet.has(node.id)) break;
      nodes.push(node.id);
    }
  }
  return { branch, nodes };
}

function activeSkillResearchEntry(state, key) {
  return normalizeSkillResearchEntry(key, state.skillResearch?.[key]);
}

function hasSkillResearchNode(state, key, nodeId) {
  const entry = activeSkillResearchEntry(state, key);
  const route = GAME_CONFIG.activeSkillResearch[key]?.branches?.[entry.branch];
  return Boolean(route?.nodes.some((node) => node.id === nodeId) && entry.nodes.includes(nodeId));
}

export function getStarfallConeHalfAngle(state) {
  return GAME_CONFIG.skills.starfall.coneHalfAngle * (hasSkillResearchNode(state, "starfall", "wideReticle") ? GAME_CONFIG.activeSkillResearch.starfall.coneMultiplier : 1);
}

export function createGameState(seed = 1, research = { damage: 0, health: 0, income: 0 }, relicUnlocks = { ward: true }, relicSlots = GAME_CONFIG.relics.initialSlots, relicArchive = {}, equippedSeals = [], skillResearch = {}) {
  const rng = new SeededRng(seed);
  const relicIds = [...Object.keys(GAME_CONFIG.relicResearch), ...Object.keys(GAME_CONFIG.relicCombos)];
  const hiddenRelicIds = Object.keys(GAME_CONFIG.relicCombos);
  const discoveredRelics = Object.fromEntries(relicIds.map((id) => [id, relicArchive.discovered?.[id] === true]));
  const legacyDisabled = typeof relicArchive.disabledRelic === "string" ? [relicArchive.disabledRelic] : [];
  const disabledRelics = [...new Set(Array.isArray(relicArchive.disabledRelics) ? relicArchive.disabledRelics : legacyDisabled)].filter((id) => relicIds.includes(id));
  const relicAvailable = relicIds.filter((id) => !disabledRelics.includes(id));
  const threatSealModifiers = getThreatSealModifiers(equippedSeals);
  const state = {
    seed: seed >>> 0 || 1,
    rng,
    nextId: 1,
    time: 0,
    threat: 1,
    phase: "day",
    coins: 0,
    over: false,
    paused: false,
    spawnTimer: 0.65,
    wave: { index: 0, nextAt: GAME_CONFIG.waves.firstAt, warningStarted: false, active: false, remaining: 0, spawnTimer: 0, direction: null, elitePending: false, eliteRemaining: 0, pendingClear: [] },
    colossusEncounter: { spawned: false, defeated: false },
    sovereignEncounter: { spawned: false, defeated: false },
    endlessMode: false,
    threatSeals: { equipped: threatSealModifiers.ids, modifiers: threatSealModifiers, resourceCarry: { echo: 0, core: 0 } },
    skillResearch: Object.fromEntries(Object.keys(GAME_CONFIG.skills).map((key) => [key, normalizeSkillResearchEntry(key, skillResearch?.[key])])),
    tower: {
      hp: 0,
      shield: 0,
      healthBarTimer: 0,
      fireCooldown: 0,
      fireRateSuppression: 0,
      sawFireCooldown: 0,
      sawLaunchCooldown: 0,
      sawRecoveries: [],
      droneCooldown: 0,
      autoCollectCooldown: GAME_CONFIG.coins.towerInterval,
      droneMode: "collect",
      droneEnergy: GAME_CONFIG.drones.energyMax,
      droneDetonateActive: false,
      droneGuardShield: 0,
      droneGuardCooldown: 0,
      interceptCharge: 0,
      interceptRecharge: 0,
      targetProtocol: "guard",
      anchorLockId: null,
      anchorLockTimer: 0,
      priorityTargetIds: [],
      siegeTargetId: null,
      siegeStreak: 0,
      cannonEchoChain: 0,
      cannonEchoChainTimer: 0,
      cannonCascadeCooldown: 0,
      sawAngle: 0,
      upgrades: { damage: 0, rate: 0, ascend: 0, cannonSiege: 0, cannonCharge: 0, cannonPierce: 0, cannonWeakpoint: 0, cannonStarPiercer: 0, cannonSplit: 0, cannonGrowth: 0, cannonEcho: 0, cannonCascade: 0, saw: 0, sawOverdrive: 0, sawGun: 0, sawLaunch: 0, sawRicochet: 0, sawRecovery: 0, drone: 0, autoCollect: 0, droneScavenge: 0, droneBattery: 0, droneDetonate: 0, droneDetonateRecovery: 0, droneGuard: 0, droneGuardRecovery: 0, droneIntercept: 0, droneHunt: 0, frost: 0, fire: 0, lightning: 0 }
    },
    skills: {
      heal: { cooldown: 0, active: 0, burst: 0, shieldBurstArmed: false, damageReduction: 0 },
      overload: { cooldown: 0, active: 0, heat: 0, slow: 0, pulse: 0, overheated: false },
      starfall: { cooldown: 0, active: 0, angle: 0, aimAngle: 0, aiming: false, protocol: "manual" },
      coinVacuum: { cooldown: 0, active: 0, trails: [], collected: 0, value: 0, cooldownCredit: 0, fireRateBuff: 0, damageBuff: 0 }
    },
    research: {
      damage: Number(research.damage) || 0,
      health: Number(research.health) || 0,
      income: Number(research.income) || 0
    },
    enemies: [],
    drones: [],
    launchedSaws: [],
    projectiles: [],
    hostileProjectiles: [],
    summonRifts: [],
    coinOrbs: [],
    resourceDrops: [],
    decoys: [],
    emberZones: [],
    relicChoice: null,
    relics: {
      owned: Object.fromEntries(relicIds.map((id) => [id, false])),
      available: relicAvailable,
      disabledRelics,
      discovered: discoveredRelics,
      upgrades: Object.fromEntries(relicIds.map((id) => [id, Math.min(GAME_CONFIG.relicUpgradeResearch.maxLevel, Math.max(0, Math.floor(Number(relicArchive.upgrades?.[id]) || 0)))])),
      registeredSets: Object.fromEntries(hiddenRelicIds.map((id) => [id, relicArchive.registeredSets?.[id] === true && discoveredRelics[id]])),
      lockedChoice: null,
      slots: Math.min(GAME_CONFIG.relics.maxSlots, Math.max(GAME_CONFIG.relics.initialSlots, Math.floor(Number(relicSlots) || GAME_CONFIG.relics.initialSlots))),
      picks: 0,
      damageBonus: 0,
      rateBonus: 0,
      endlessStacks: 0,
      mirrorShots: 0,
      wardKills: 0,
      phaseBuff: 0,
      rewardQueue: []
    },
    particles: [],
    elementFx: [],
    floaters: [],
    events: [],
    stats: { kills: 0, bossKills: 0, highestThreat: 1, score: 0, echoShards: 0, coreFragments: 0 }
  };
  state.tower.droneEnergy = getDroneEnergyMax(state);
  state.tower.hp = getTowerStats(state).maxHp;
  return state;
}

export function getDayPhase(threat, nightWaves = GAME_CONFIG.threat.nightWaves, mapSource) {
  const { dayWaves } = GAME_CONFIG.threat;
  // Array#map passes (value, index, array); ignore those callback arguments so
  // the public helper remains backwards-compatible when used directly as a
  // mapper while still accepting an explicit custom night-wave count.
  const requestedNightWaves = Array.isArray(mapSource) ? GAME_CONFIG.threat.nightWaves : nightWaves;
  const resolvedNightWaves = Math.max(1, Math.floor(Number(requestedNightWaves) || GAME_CONFIG.threat.nightWaves));
  return ((Math.max(1, threat) - 1) % (dayWaves + resolvedNightWaves)) < dayWaves ? "day" : "night";
}

function getStateDayPhase(state, threat) {
  const nightWaves = state.threatSeals?.modifiers?.nightWaves ?? GAME_CONFIG.threat.nightWaves;
  return getDayPhase(threat, nightWaves);
}

export function getTowerPosition(state) {
  const sovereignActive = state?.enemies?.some((enemy) => enemy.type === "sovereign" && enemy.hp > 0);
  return sovereignActive
    ? { x: GAME_CONFIG.sovereign.towerX, y: GAME_CONFIG.sovereign.towerY }
    : { x: GAME_CONFIG.arena.centerX, y: GAME_CONFIG.arena.centerY };
}

export function getTowerRadius(state) {
  const base = GAME_CONFIG.tower.radius + (state?.tower?.upgrades?.ascend ?? 0) * 5;
  return base * (state?.enemies?.some((enemy) => enemy.type === "sovereign" && enemy.hp > 0) ? GAME_CONFIG.sovereign.towerScale : 1);
}

export function getTowerScale(state) {
  return state?.enemies?.some((enemy) => enemy.type === "sovereign" && enemy.hp > 0) ? GAME_CONFIG.sovereign.towerScale : 1;
}

export function getTowerStats(state) {
  const { tower, research } = state;
  const level = tower.upgrades.ascend;
  const cfg = GAME_CONFIG;
  const permanentDamage = 1 + research.damage * cfg.research.bonusPerLevel;
  const permanentHealth = 1 + research.health * cfg.research.bonusPerLevel;
  const relicDamage = 1 + (state.relics?.damageBonus ?? 0);
  const pierceLevel = tower.upgrades.cannonPierce ?? 0;
  const phaseDamage = (state.relics?.phaseBuff ?? 0) > 0 ? cfg.relics.lunar.transitionDamageMultiplier : 1;
  const economyDamage = (state.skills?.coinVacuum?.damageBuff ?? 0) > 0 ? cfg.activeSkillResearch.coinVacuum.damageMultiplier : 1;
  const damage = cfg.tower.damage * (cfg.upgrades.damage.multiplier ** tower.upgrades.damage) * cfg.upgrades.ascend.damage[level] * permanentDamage * relicDamage * phaseDamage * economyDamage;
  const rawRate = cfg.tower.fireRate * (cfg.upgrades.rate.multiplier ** tower.upgrades.rate) * cfg.upgrades.ascend.rate[level];
  const relicRate = (1 + (state.relics?.rateBonus ?? 0)) * ((state.relics?.phaseBuff ?? 0) > 0 ? cfg.relics.lunar.transitionRateMultiplier : 1);
  const suppression = (tower.fireRateSuppression ?? 0) > 0 ? cfg.sovereign.rangedSlowMultiplier : 1;
  const relicRateCap = state.endlessMode ? Infinity : cfg.upgrades.rate.cap * 1.5;
  return {
    damage,
    fireRate: Math.min(relicRateCap, Math.min(cfg.upgrades.rate.cap, rawRate) * relicRate) * suppression,
    range: cfg.tower.range + cfg.upgrades.ascend.rangePerLevel * level,
    maxHp: (cfg.tower.maxHp + cfg.upgrades.ascend.hpPerLevel * level) * permanentHealth,
    projectileCount: level >= 3 ? 3 : level >= 2 ? 2 : 1,
    pierce: pierceLevel * cfg.cannon.siege.piercePerLevel,
    bossDamageMultiplier: 1 + pierceLevel * cfg.cannon.siege.bossDamagePerLevel,
    name: ASCEND_NAMES[level]
  };
}

export function getUpgradeCost(state, key) {
  const level = state.tower.upgrades[key];
  const cfg = GAME_CONFIG.techTree[key];
  if (!cfg) return Infinity;
  if (level >= cfg.maxLevel) return Infinity;
  if (cfg.costs) return cfg.costs[level] ?? Infinity;
  return Math.floor(cfg.baseCost * (cfg.growth ** level));
}

export function getTechStatus(state, key) {
  const cfg = GAME_CONFIG.techTree[key];
  const level = state.tower.upgrades[key];
  if (!cfg || level == null) return { unlocked: false, maxed: true, cost: Infinity, reason: "未知科技" };
  if (level >= cfg.maxLevel) return { unlocked: false, maxed: true, cost: Infinity, reason: "研究完成" };
  const excluded = cfg.excludes?.find((excludedKey) => (state.tower.upgrades[excludedKey] ?? 0) > 0);
  if (excluded) return { unlocked: false, maxed: false, cost: getUpgradeCost(state, key), reason: `已选择${TECH_NAMES[excluded]}分支` };
  const requiredThreat = cfg.threat[level] ?? cfg.threat.at(-1);
  if (state.threat < requiredThreat) return { unlocked: false, maxed: false, cost: getUpgradeCost(state, key), requiredThreat, reason: `威胁 ${requiredThreat} 解锁` };
  if (cfg.towerLevel && state.tower.upgrades.ascend + 1 < cfg.towerLevel) {
    return { unlocked: false, maxed: false, cost: getUpgradeCost(state, key), requiredThreat, requiredTowerLevel: cfg.towerLevel, reason: `需要晶塔等级 ${cfg.towerLevel}` };
  }
  const requirements = cfg.requiresByLevel?.[level] ?? cfg.requires ?? {};
  for (const [requiredKey, requiredLevel] of Object.entries(requirements)) {
    if ((state.tower.upgrades[requiredKey] ?? 0) < requiredLevel) {
      return { unlocked: false, maxed: false, cost: getUpgradeCost(state, key), requiredThreat, reason: `需要${TECH_NAMES[requiredKey]} ${requiredLevel} 级` };
    }
  }
  return { unlocked: true, maxed: false, cost: getUpgradeCost(state, key), requiredThreat, reason: "可以研究" };
}

export function purchaseUpgrade(state, key) {
  if (!UPGRADE_ORDER.includes(key) || state.over) return false;
  const status = getTechStatus(state, key);
  const cost = status.cost;
  if (!status.unlocked || !Number.isFinite(cost) || state.coins < cost) return false;
  const oldStats = getTowerStats(state);
  state.coins -= cost;
  state.tower.upgrades[key] += 1;
  if (key === "autoCollect") state.tower.autoCollectCooldown = GAME_CONFIG.coins.towerInterval;
  if (key === "droneBattery") state.tower.droneEnergy = getDroneEnergyMax(state);
  if (key === "droneIntercept") state.tower.interceptCharge = 1;
  if (key === "ascend") {
    const nextStats = getTowerStats(state);
    state.tower.hp = Math.min(nextStats.maxHp, state.tower.hp + (nextStats.maxHp - oldStats.maxHp) + nextStats.maxHp * 0.2);
    state.events.push({ type: "ascend", level: state.tower.upgrades.ascend });
  } else {
    state.events.push({ type: "purchase", key });
  }
  return true;
}

export function toggleDroneMode(state) {
  if (state.over || state.tower.droneDetonateActive || state.tower.upgrades.autoCollect < 1 || state.tower.upgrades.drone < 1) return false;
  if (state.tower.droneMode === "collect" && state.tower.droneEnergy < GAME_CONFIG.drones.minAttackEnergy) return false;
  state.tower.droneMode = state.tower.droneMode === "attack" ? "collect" : "attack";
  state.events.push({ type: "droneMode", mode: state.tower.droneMode });
  return true;
}

export function toggleDroneDetonate(state) {
  if (state.over || state.tower.upgrades.droneDetonate < 1) return false;
  if (state.tower.droneDetonateActive) {
    state.tower.droneDetonateActive = false;
    state.tower.droneMode = "collect";
    state.events.push({ type: "droneDetonateMode", active: false });
    return true;
  }
  const cfg = GAME_CONFIG.drones.detonate;
  if (state.tower.droneEnergy < cfg.energyCost) return false;
  state.tower.droneDetonateActive = true;
  state.tower.droneMode = "attack";
  state.events.push({ type: "droneDetonateMode", active: true });
  return true;
}

export function setTargetProtocol(state, protocol) {
  if (state.over || !TARGET_PROTOCOL_ORDER.includes(protocol)) return false;
  state.tower.targetProtocol = protocol;
  if (protocol === "hunter") {
    for (const boss of state.enemies.filter((enemy) => enemy.type === "colossus" && enemy.hp > 0 && enemy.intentSkill === "summon" && !enemy.summonCountered)) {
      boss.summonCountered = true;
      state.events.push({ type: "colossusCounter", counter: "summon", enemyId: boss.id });
    }
  }
  state.events.push({ type: "targetProtocol", protocol });
  return true;
}

export function cycleTargetProtocol(state) {
  const index = TARGET_PROTOCOL_ORDER.indexOf(state.tower.targetProtocol);
  return setTargetProtocol(state, TARGET_PROTOCOL_ORDER[(index + 1) % TARGET_PROTOCOL_ORDER.length]);
}

export function lockAnchorAt(state, x, y, padding = GAME_CONFIG.boss.anchorClickPadding) {
  if (state.over) return false;
  const anchor = state.enemies
    .filter((enemy) => enemy.type === "anchor" && enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) <= enemy.radius + padding)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y) || a.id - b.id)[0];
  if (!anchor) return false;
  state.tower.anchorLockId = anchor.id;
  state.tower.anchorLockTimer = GAME_CONFIG.boss.anchorLockDuration;
  state.events.push({ type: "anchorLocked", anchorId: anchor.id, role: anchor.anchorRole, duration: state.tower.anchorLockTimer, x: anchor.x, y: anchor.y });
  return true;
}

export function chooseEnemyType(state) {
  const roll = state.rng.next();
  if (state.threat < 2) return "wisp";
  if (state.threat < 3) return roll < 0.72 ? "wisp" : "runner";
  if (state.threat < 4) return roll < 0.52 ? "wisp" : roll < 0.8 ? "runner" : "brute";
  if (state.threat < 5) return roll < 0.38 ? "wisp" : roll < 0.62 ? "runner" : roll < 0.82 ? "crawler" : "brute";
  if (state.threat < 6) return roll < 0.3 ? "wisp" : roll < 0.5 ? "runner" : roll < 0.7 ? "crawler" : roll < 0.88 ? "brute" : "hexer";
  if (state.threat < 8) {
    if (roll < 0.15) return "wisp";
    if (roll < 0.27) return "runner";
    if (roll < 0.39) return "crawler";
    if (roll < 0.51) return "brute";
    if (roll < 0.63) return "sentinel";
    if (roll < 0.75) return "hexer";
    if (roll < 0.83) return "inkHound";
    if (roll < 0.9) return "orbitMote";
    if (roll < 0.96) return "rustBeetle";
    return "porcelainWarden";
  }
  if (roll < 0.1) return "wisp";
  if (roll < 0.19) return "runner";
  if (roll < 0.3) return "crawler";
  if (roll < 0.42) return "brute";
  if (roll < 0.53) return "sentinel";
  if (roll < 0.64) return "hexer";
  if (roll < 0.72) return "rammer";
  if (roll < 0.8) return "inkHound";
  if (roll < 0.87) return "orbitMote";
  if (roll < 0.94) return "rustBeetle";
  return "porcelainWarden";
}

function isBossEnemy(enemy) {
  return enemy?.type === "boss" || enemy?.type === "colossus" || enemy?.type === "sovereign";
}

function spawnPosition(rng, forcedSide = null) {
  const { width, height } = GAME_CONFIG.arena;
  const side = forcedSide ?? Math.floor(rng.next() * 4);
  const margin = 34;
  if (side === 0) return { x: rng.next() * width, y: -margin };
  if (side === 1) return { x: width + margin, y: rng.next() * height };
  if (side === 2) return { x: rng.next() * width, y: height + margin };
  return { x: -margin, y: rng.next() * height };
}

function isCrowdUnit(enemy) {
  return enemy && enemy.hp > 0 && !enemy.elite && !isBossEnemy(enemy) && enemy.type !== "anchor";
}

function mergeCrowdEnemy(state, incoming) {
  let target = null;
  let bestTypePenalty = Infinity;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    if (!isCrowdUnit(enemy)) continue;
    if ((enemy.waveIndex ?? null) !== (incoming.waveIndex ?? null)) continue;
    const typePenalty = enemy.type === incoming.type ? 0 : 1;
    const dx = enemy.x - incoming.x;
    const dy = enemy.y - incoming.y;
    const distance = dx * dx + dy * dy;
    if (typePenalty < bestTypePenalty || (typePenalty === bestTypePenalty && distance < bestDistance)) {
      target = enemy;
      bestTypePenalty = typePenalty;
      bestDistance = distance;
    }
  }
  if (!target) return null;
  target.hp += incoming.hp;
  target.maxHp += incoming.maxHp;
  target.damage += incoming.damage;
  target.reward += incoming.reward;
  target.scoreValue = (target.scoreValue ?? 0) + (incoming.scoreValue ?? 0);
  target.unitCount = (target.unitCount ?? 1) + (incoming.unitCount ?? 1);
  const baseRadius = target.baseRadius ?? target.radius;
  const radiusMultiplier = Math.min(GAME_CONFIG.combat.crowdMaxRadiusMultiplier, 1 + Math.log2(target.unitCount) * GAME_CONFIG.combat.crowdRadiusPerDoubling);
  target.radius = baseRadius * radiusMultiplier;
  return target;
}

export function spawnEnemy(state, type = chooseEnemyType(state), position, options = {}) {
  const bossType = type === "boss" || type === "colossus" || type === "sovereign";
  const elite = Boolean(options.elite) && !bossType;
  if (state.enemies.length >= GAME_CONFIG.combat.maxEnemies) {
    if (!bossType && !elite) return null;
    const replaceIndex = state.enemies.findIndex((enemy) => !isBossEnemy(enemy) && !enemy.elite);
    if (replaceIndex < 0) return null;
    state.enemies.splice(replaceIndex, 1);
  }
  const base = GAME_CONFIG.enemies[type];
  if (!base) return null;
  const pos = position ?? spawnPosition(state.rng);
  const hpScale = GAME_CONFIG.threat.hpGrowth ** (state.threat - 1);
  const damageScale = GAME_CONFIG.threat.damageGrowth ** (state.threat - 1);
  const rewardScale = GAME_CONFIG.threat.rewardGrowth ** (state.threat - 1);
  const splitConfig = options.splitChild ? GAME_CONFIG.eliteAffixes.split : null;
  const hpMultiplier = (elite ? GAME_CONFIG.waves.eliteHpMultiplier : 1) * (splitConfig?.hpMultiplier ?? 1);
  const damageMultiplier = (elite ? GAME_CONFIG.waves.eliteDamageMultiplier : 1) * (splitConfig?.damageMultiplier ?? 1);
  const rewardMultiplier = (elite ? GAME_CONFIG.waves.eliteRewardMultiplier : 1) * (splitConfig?.rewardMultiplier ?? 1);
  const radiusMultiplier = splitConfig?.radiusMultiplier ?? 1;
  const speedMultiplier = splitConfig?.speedMultiplier ?? 1;
  const enemy = {
    id: state.nextId++, type, x: pos.x, y: pos.y,
    hp: base.hp * hpScale * hpMultiplier, maxHp: base.hp * hpScale * hpMultiplier,
    speed: base.speed * speedMultiplier, damage: base.damage * damageScale * damageMultiplier,
    reward: Math.max(1, Math.round(base.reward * rewardScale * rewardMultiplier)),
    scoreValue: GAME_CONFIG.score.enemy[type] ?? 100,
    unitCount: 1, baseRadius: base.radius * radiusMultiplier,
    radius: base.radius * radiusMultiplier, attackCooldown: 0, sawCooldown: 0, hitFlash: 0,
    attackRange: base.attackRange ?? 0, rangedFlash: 0,
    freezeTimer: 0, burnTimer: 0, burnTickCooldown: 0, burnDamagePerTick: 0,
    markTimer: 0,
    starMarkTimer: 0,
    weakpointTimer: 0,
    elite,
    waveElite: Boolean(options.waveElite),
    waveIndex: options.waveIndex ?? null,
    splitChild: Boolean(options.splitChild)
  };
  if (elite) {
    const affixes = GAME_CONFIG.eliteAffixes.order;
    enemy.affix = options.affix && affixes.includes(options.affix) ? options.affix : affixes[Math.floor(state.rng.next() * affixes.length)];
    if (enemy.affix === "shield") enemy.affixShield = enemy.affixShieldMax = enemy.maxHp * GAME_CONFIG.eliteAffixes.shield.shieldFraction;
    if (enemy.affix === "sprint") enemy.speed *= GAME_CONFIG.eliteAffixes.sprint.speedMultiplier;
    if (enemy.affix === "devour") enemy.devourCooldown = GAME_CONFIG.eliteAffixes.devour.interval;
  }
  if (type === "boss") {
    enemy.bossPhase = 0;
    enemy.resistance = GAME_CONFIG.boss.resistances[0];
  }
  if (type === "colossus") {
    const { centerX, centerY } = GAME_CONFIG.arena;
    const affixes = GAME_CONFIG.colossus.affixOrder;
    enemy.colossusAffix = options.colossusAffix && affixes.includes(options.colossusAffix)
      ? options.colossusAffix
      : affixes[Math.floor(state.rng.next() * affixes.length)];
    const affixConfig = GAME_CONFIG.colossus.affixes[enemy.colossusAffix];
    if (enemy.colossusAffix === "carapace") {
      enemy.maxHp *= affixConfig.healthMultiplier;
      enemy.hp = enemy.maxHp;
    }
    enemy.orbitAngle = options.orbitAngle ?? -Math.PI / 2;
    enemy.x = centerX + Math.cos(enemy.orbitAngle) * GAME_CONFIG.colossus.orbitRadiusX;
    enemy.y = centerY + Math.sin(enemy.orbitAngle) * GAME_CONFIG.colossus.orbitRadiusY;
    enemy.activeSkill = null;
    enemy.intentSkill = null;
    enemy.intentTimer = 0;
    enemy.skillTimer = 0;
    enemy.skillCooldown = 1.5;
    enemy.skillTick = 0;
    enemy.skillSequence = 0;
    enemy.summonsRemaining = 0;
    enemy.enraged = false;
    enemy.healthBars = GAME_CONFIG.colossus.healthBars;
    enemy.healthBar = enemy.healthBars;
    enemy.spawnShieldMax = enemy.maxHp * GAME_CONFIG.colossus.spawnShieldFraction;
    enemy.spawnShield = enemy.spawnShieldMax;
    enemy.phaseBreakInvulnerability = 0;
    enemy.activeSkills = {};
    enemy.exposedTimer = 0;
    enemy.artilleryCountered = false;
    enemy.artilleryShotsRemaining = null;
    enemy.summonCountered = false;
    enemy.summonRiftsAttackable = false;
    enemy.parallelCooldowns = Object.fromEntries(GAME_CONFIG.colossus.skillOrder.map((skill, index) => [skill, index * GAME_CONFIG.colossus.enrageParallelStagger]));
    state.colossusEncounter.spawned = true;
  }
  if (type === "sovereign") {
    const cfg = GAME_CONFIG.sovereign;
    enemy.x = cfg.fixedX;
    enemy.y = cfg.fixedY;
    enemy.activeSkill = null;
    enemy.intentSkill = null;
    enemy.intentTimer = 0;
    enemy.skillTimer = 0;
    enemy.skillCooldown = 1.8;
    enemy.skillTick = 0;
    enemy.skillSequence = 0;
    enemy.summonWavesRemaining = 0;
    enemy.healthBars = cfg.healthBars;
    enemy.healthBar = cfg.healthBars;
    enemy.spawnShieldMax = enemy.maxHp * cfg.spawnShieldFraction;
    enemy.spawnShield = enemy.spawnShieldMax;
    enemy.shieldBreakSummonTriggered = false;
    enemy.phaseBreakInvulnerability = cfg.entryDuration;
    enemy.entryTimer = cfg.entryDuration;
    enemy.enraged = false;
    enemy.elementImmune = false;
    state.sovereignEncounter.spawned = true;
  }
  if (type === "anchor") {
    enemy.anchorBossId = options.anchorBossId ?? null;
    enemy.anchorRole = GAME_CONFIG.boss.anchorRoles.includes(options.anchorRole) ? options.anchorRole : GAME_CONFIG.boss.anchorRoles[0];
    enemy.effectCooldown = enemy.anchorRole === "summon" ? GAME_CONFIG.boss.summonInterval * 0.5 : 0;
    enemy.effectPulse = 0;
  }
  if (isCrowdUnit(enemy)) {
    const visibleNormals = state.enemies.reduce((count, current) => count + Number(isCrowdUnit(current)), 0);
    if (visibleNormals >= GAME_CONFIG.combat.normalEnemyBudget) {
      const merged = mergeCrowdEnemy(state, enemy);
      if (merged) return merged;
    }
  }
  state.enemies.push(enemy);
  if (type === "boss") {
    spawnBossAnchors(state, enemy);
    state.events.push({ type: "bossSpawn", resistance: enemy.resistance });
  }
  if (type === "colossus") state.events.push({ type: "colossusSpawn", enemyId: enemy.id, affix: enemy.colossusAffix, threat: state.threat, x: enemy.x, y: enemy.y });
  if (type === "sovereign") state.events.push({ type: "sovereignSpawn", enemyId: enemy.id, x: enemy.x, y: enemy.y, duration: GAME_CONFIG.sovereign.entryDuration });
  if (elite) state.events.push({ type: "eliteSpawn", enemyType: type, affix: enemy.affix, x: enemy.x, y: enemy.y });
  return enemy;
}

function bossAnchors(state, boss) {
  return state.enemies.filter((enemy) => enemy.type === "anchor" && enemy.anchorBossId === boss.id && enemy.hp > 0);
}

function spawnBossAnchors(state, boss) {
  state.enemies = state.enemies.filter((enemy) => enemy.type !== "anchor" || enemy.anchorBossId !== boss.id);
  state.tower.anchorLockId = null;
  state.tower.anchorLockTimer = 0;
  const { centerX, centerY } = GAME_CONFIG.arena;
  const count = GAME_CONFIG.boss.anchorCount;
  for (let index = 0; index < count; index += 1) {
    const angle = index * Math.PI * 2 / count;
    spawnEnemy(state, "anchor", {
      x: centerX + Math.cos(angle) * GAME_CONFIG.boss.anchorRadius,
      y: centerY + Math.sin(angle) * GAME_CONFIG.boss.anchorRadius
    }, { anchorBossId: boss.id, anchorRole: GAME_CONFIG.boss.anchorRoles[index] });
  }
  state.events.push({ type: "bossAnchors", bossId: boss.id, count, phase: boss.bossPhase });
}

const MECHANIC_RELIC_IDS = [...Object.keys(GAME_CONFIG.relicResearch), ...Object.keys(GAME_CONFIG.relicCombos)];
const NUMERIC_RELIC_IDS = ["boost:damage", "boost:rate", "boost:hybrid"];
const ENDLESS_RELIC_ID = "boost:endless";

function relicUpgradeLevel(state, id) {
  return Math.min(GAME_CONFIG.relicUpgradeResearch.maxLevel, Math.max(0, Number(state.relics.upgrades?.[id]) || 0));
}

function relicPotency(state, id) {
  return 1 + relicUpgradeLevel(state, id) * GAME_CONFIG.relicUpgradeResearch.effectPerLevel;
}

function amplifyMultiplier(value, potency) {
  return 1 + (value - 1) * potency;
}

function shuffledRelicIds(state, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(state.rng.next() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function buildRelicChoices(state) {
  const choiceLimit = 3 + (state.threatSeals?.modifiers?.relicChoiceBonus ?? 0);
  const unlocked = new Set(state.relics.available);
  const pool = MECHANIC_RELIC_IDS.filter((id) => unlocked.has(id));
  const eligible = pool.filter((id) => !state.relics.owned[id]);
  const choices = [];
  if (eligible.includes(state.relics.lockedChoice)) choices.push(state.relics.lockedChoice);
  for (const [setId, combo] of Object.entries(GAME_CONFIG.relicCombos)) {
    if (!state.relics.registeredSets[setId] || !combo.set.some((id) => state.relics.owned[id])) continue;
    const missing = combo.set.find((id) => eligible.includes(id) && !choices.includes(id));
    if (missing) choices.push(missing);
    if (choices.length >= choiceLimit) break;
  }
  const available = shuffledRelicIds(state, eligible.filter((id) => !choices.includes(id)));
  for (const id of available) {
    if (choices.length >= choiceLimit) break;
    choices.push(id);
  }
  const numericAllowed = state.relics.slots > pool.length;
  if (numericAllowed) {
    for (const boost of shuffledRelicIds(state, NUMERIC_RELIC_IDS)) {
      if (choices.length >= choiceLimit) break;
      choices.push(boost);
    }
  }
  return choices;
}

function discoverRelicCombos(state) {
  for (const [id, combo] of Object.entries(GAME_CONFIG.relicCombos)) {
    if (state.relics.discovered[id] || !combo.requires.every((required) => state.relics.owned[required])) continue;
    state.relics.discovered[id] = true;
    if (!state.relics.disabledRelics.includes(id) && !state.relics.available.includes(id)) state.relics.available.push(id);
    state.events.push({ type: "relicComboDiscovered", id, requires: [...combo.requires] });
  }
}

export function offerRelicChoice(state, source = "eliteWave") {
  if (state.over) return false;
  if (state.relicChoice) {
    state.relics.rewardQueue.push(source);
    return false;
  }
  const choices = source === "endlessWave" ? [ENDLESS_RELIC_ID] : buildRelicChoices(state);
  if (!choices.length || (state.relics.picks >= state.relics.slots && !choices.some((id) => id.startsWith("boost:")))) return false;
  state.relicChoice = { source, choices };
  state.events.push({ type: "relicChoice", source, choices: [...state.relicChoice.choices], picks: state.relics.picks });
  return true;
}

export function lockRelicChoice(state, id) {
  if (!state.relicChoice || !state.relicChoice.choices.includes(id) || id.startsWith("boost:")) return false;
  state.relics.lockedChoice = state.relics.lockedChoice === id ? null : id;
  state.relicChoice.lockedId = state.relics.lockedChoice;
  state.events.push({ type: "relicChoiceLocked", id, locked: state.relics.lockedChoice === id });
  return true;
}
export function chooseRelic(state, id) {
  if (!state.relicChoice || !state.relicChoice.choices.includes(id)) return false;
  if (id.startsWith("boost:")) {
    const cfg = GAME_CONFIG.relics.numeric;
    if (id === ENDLESS_RELIC_ID) {
      const endless = GAME_CONFIG.relics.endless;
      state.relics.damageBonus += endless.damagePerStack;
      state.relics.rateBonus += endless.ratePerStack;
      state.relics.endlessStacks += 1;
    } else if (id === "boost:damage") state.relics.damageBonus += cfg.damage;
    else if (id === "boost:rate") state.relics.rateBonus += cfg.rate;
    else {
      state.relics.damageBonus += cfg.hybridDamage;
      state.relics.rateBonus += cfg.hybridRate;
    }
  } else {
    if (state.relics.owned[id] || state.relics.picks >= state.relics.slots) return false;
    state.relics.owned[id] = true;
    state.relics.picks += 1;
    if (state.relics.lockedChoice === id) state.relics.lockedChoice = null;
    discoverRelicCombos(state);
  }
  const source = state.relicChoice.source;
  state.relicChoice = null;
  state.events.push({ type: "relicChosen", id, source, picks: state.relics.picks });
  const queued = state.relics.rewardQueue.shift();
  if (queued) offerRelicChoice(state, queued);
  return true;
}
export function findTargets(state, count = 1) {
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const range = getTowerStats(state).range;
  const candidates = state.enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - centerX, enemy.y - centerY) <= range);
  return rankTargets(state, candidates).slice(0, count);
}

function rankTargets(state, candidates) {
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const towerRadius = getTowerRadius(state);
  const distance = (enemy) => Math.hypot(enemy.x - centerX, enemy.y - centerY);
  const lockedPriority = (enemy) => Number(state.tower.anchorLockTimer > 0 && enemy.id === state.tower.anchorLockId);
  const hunterPriority = (enemy) => enemy.type === "sovereign" ? 5 : enemy.type === "colossus" ? 4 : enemy.type === "boss" ? 3 : enemy.elite ? 2 : enemy.type === "hexer" ? 1 : 0;
  const contactTime = (enemy) => Math.max(0, distance(enemy) - towerRadius - enemy.radius - (enemy.attackRange ?? 0)) / Math.max(1, enemy.speed);
  const radarPriority = (enemy) => Number((enemy.attackRange ?? 0) > 0);
  return [...candidates].sort((a, b) => {
    const locked = lockedPriority(b) - lockedPriority(a);
    if (locked) return locked;
    if (state.tower.targetProtocol === "hunter") {
      const threat = hunterPriority(b) - hunterPriority(a);
      if (threat) return threat;
    } else if (state.tower.targetProtocol === "breach") {
      const breach = contactTime(a) - contactTime(b);
      if (Math.abs(breach) > 0.0001) return breach;
    } else if (state.tower.targetProtocol === "radar") {
      const ranged = radarPriority(b) - radarPriority(a);
      if (ranged) return ranged;
    }
    return distance(a) - distance(b) || a.id - b.id;
  });
}

function fireStarPiercer(state, target, damage) {
  const cfg = GAME_CONFIG.cannon.siege;
  const { x, y } = getTowerPosition(state);
  damageEnemy(state, target, damage * cfg.starPiercerDamageMultiplier, "starPiercer");
  state.elementFx.push({ element: "starPiercer", x1: x, y1: y, x2: target.x, y2: target.y, life: cfg.starPiercerDuration, maxLife: cfg.starPiercerDuration });
  state.events.push({ type: "cannonStarPiercer", targetId: target.id, enemyType: target.type, elite: target.elite, x1: x, y1: y, x2: target.x, y2: target.y, damage: damage * cfg.starPiercerDamageMultiplier });
}

function fireTower(state) {
  const stats = getTowerStats(state);
  const targets = findTargets(state, stats.projectileCount);
  state.tower.priorityTargetIds = targets.map((target) => target.id);
  if (!targets.length) return false;
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const siegeLevel = state.tower.upgrades.cannonSiege;
  const chargeLevel = state.tower.upgrades.cannonCharge;
  let chargeMultiplier = 1;
  let fullCharge = false;
  if (siegeLevel > 0 && chargeLevel > 0) {
    const primaryId = targets[0].id;
    state.tower.siegeStreak = state.tower.siegeTargetId === primaryId ? state.tower.siegeStreak + 1 : 0;
    state.tower.siegeTargetId = primaryId;
    const cfg = GAME_CONFIG.cannon.siege;
    const maxStacks = cfg.maxChargeStacks + chargeLevel - 1;
    const stacks = Math.min(maxStacks, state.tower.siegeStreak);
    fullCharge = stacks >= maxStacks;
    chargeMultiplier += stacks * cfg.chargeBonusPerStack;
  } else {
    state.tower.siegeTargetId = null;
    state.tower.siegeStreak = 0;
  }
  let mirrorReady = false;
  if (state.relics.owned.mirror) {
    const everyShots = Math.max(2, GAME_CONFIG.relics.mirror.everyShots - relicUpgradeLevel(state, "mirror"));
    state.relics.mirrorShots += 1;
    if (state.relics.mirrorShots >= everyShots) {
      state.relics.mirrorShots = 0;
      mirrorReady = true;
    }
  }
  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const target = targets[targetIndex];
    if (targetIndex === 0 && fullCharge && state.tower.upgrades.cannonStarPiercer > 0 && (target.elite || isBossEnemy(target))) {
      fireStarPiercer(state, target, stats.damage * chargeMultiplier);
      state.tower.siegeStreak = 0;
      continue;
    }
    const angle = Math.atan2(target.y - centerY, target.x - centerX);
    const element = rollProjectileElement(state);
    state.projectiles.push({
      id: state.nextId++, x: centerX, y: centerY,
      vx: Math.cos(angle) * GAME_CONFIG.tower.projectileSpeed,
      vy: Math.sin(angle) * GAME_CONFIG.tower.projectileSpeed,
      damage: stats.damage * (targetIndex === 0 ? chargeMultiplier : 1), radius: 5 + state.tower.upgrades.ascend * 1.5,
      pierce: stats.pierce, pierceEnabled: stats.pierce > 0, bossDamageMultiplier: stats.bossDamageMultiplier, life: 1.2, tier: state.tower.upgrades.ascend, element,
      splitLevel: state.tower.upgrades.cannonSplit, growthLevel: state.tower.upgrades.cannonGrowth,
      mirrorReady: mirrorReady && targetIndex === 0
    });
  }
  if (state.skills.overload.active > 0) {
    const config = GAME_CONFIG.skills.overload;
    const heatMultiplier = hasSkillResearchNode(state, "overload", "stabilizer") ? GAME_CONFIG.activeSkillResearch.overload.heatGainMultiplier : 1;
    state.skills.overload.heat = Math.min(config.heatCap, state.skills.overload.heat + config.heatPerVolley * heatMultiplier);
  }
  state.events.push({ type: "shoot", tier: state.tower.upgrades.ascend });
  return true;
}

function rollProjectileElement(state) {
  const enabled = ["frost", "fire", "lightning"].filter((key) => state.tower.upgrades[key] > 0);
  if (!enabled.length) return null;
  const roll = state.rng.next();
  let cursor = 0;
  for (const key of enabled) {
    cursor += GAME_CONFIG.elements[key].chance;
    if (roll < cursor) return key;
  }
  return null;
}

export function damageEnemy(state, enemy, damage, source = "shot") {
  if (enemy.hp <= 0 || (enemy.phaseBreakInvulnerability ?? 0) > 0) return;
  let appliedDamage = damage * (SKILL_DAMAGE_SOURCES.has(source) ? state.threatSeals?.modifiers?.skillDamageMultiplier ?? 1 : 1);
  const shieldPiercing = source === "starPiercer";
  const executionCfg = GAME_CONFIG.relics.execution;
  const executionLevel = relicUpgradeLevel(state, "execution");
  const executionThreshold = Math.min(0.75, executionCfg.hpThreshold + executionLevel * 0.04);
  if (state.relics.owned.execution && enemy.hp / Math.max(1, enemy.maxHp) <= executionThreshold) {
    appliedDamage *= amplifyMultiplier(executionCfg.damageMultiplier, relicPotency(state, "execution"));
  }
  if ((enemy.weakpointTimer ?? 0) > 0) appliedDamage *= GAME_CONFIG.cannon.siege.weakpointDamageMultiplier;
  if (enemy.type === "boss") {
    if (!shieldPiercing && bossAnchors(state, enemy).some((anchor) => anchor.anchorRole === "shield")) appliedDamage *= GAME_CONFIG.boss.shieldDamageMultiplier;
    if (source === enemy.resistance) appliedDamage *= GAME_CONFIG.boss.elementDamageMultiplier;
  }
  if (enemy.type === "colossus") {
    if (enemy.colossusAffix === "carapace") appliedDamage *= GAME_CONFIG.colossus.affixes.carapace.passiveDamageMultiplier;
    if ((enemy.exposedTimer ?? 0) > 0) appliedDamage *= GAME_CONFIG.colossus.counters.exposedDamageMultiplier;
    if (!shieldPiercing && (enemy.activeSkill === "bulwark" || enemy.activeSkills?.bulwark)) appliedDamage *= GAME_CONFIG.colossus.bulwark.damageMultiplier;
    if (!shieldPiercing && (enemy.spawnShield ?? 0) > 0) {
      const absorbed = Math.min(enemy.spawnShield, appliedDamage);
      enemy.spawnShield -= absorbed;
      appliedDamage -= absorbed;
    }
  }
  if (enemy.type === "sovereign") {
    const cfg = GAME_CONFIG.sovereign;
    if (!shieldPiercing && enemy.activeSkill === "bulwark") appliedDamage *= cfg.bulwark.damageMultiplier;
    if (!shieldPiercing && (enemy.spawnShield ?? 0) > 0) {
      const shieldBefore = enemy.spawnShield;
      const absorbed = Math.min(enemy.spawnShield, appliedDamage);
      enemy.spawnShield -= absorbed;
      appliedDamage -= absorbed;
      if (shieldBefore > 0 && enemy.spawnShield <= 0 && !enemy.shieldBreakSummonTriggered) {
        enemy.shieldBreakSummonTriggered = true;
        enemy.activeSkill = null;
        enemy.intentSkill = "summon";
        enemy.intentTimer = cfg.shieldBreakSummonDelay;
        enemy.skillTimer = 0;
        enemy.skillTick = 0;
        enemy.skillCooldown = 0;
        enemy.summonWavesRemaining = 0;
        state.hostileProjectiles.length = 0;
        state.summonRifts = state.summonRifts.filter((rift) => rift.bossId !== enemy.id);
        state.events.push({ type: "sovereignShieldBreak", enemyId: enemy.id, forcedSkill: "summon", duration: enemy.intentTimer, x: enemy.x, y: enemy.y });
      }
    }
  }
  if (!shieldPiercing && (enemy.affixShield ?? 0) > 0) {
    const absorbed = Math.min(enemy.affixShield, appliedDamage);
    enemy.affixShield -= absorbed;
    appliedDamage -= absorbed;
  }
  enemy.hp -= appliedDamage;
  if (appliedDamage > 0) enemy.lastDamageSource = source;
  enemy.hitFlash = 0.09;
  const color = source === "starPiercer" ? "#fff3a8" : source === "starfall" ? "#fff1a8" : source === "drone" ? "#ffd36d" : source === "fire" ? "#ff9c5c" : source === "lightning" ? "#d9c5ff" : "#d9faff";
  state.floaters.push({ x: enemy.x, y: enemy.y - enemy.radius, text: appliedDamage > 0.5 ? `${Math.round(appliedDamage)}` : "格挡", life: 0.55, color });
  state.events.push({ type: "hit", source });
  if (enemy.type === "colossus" && enemy.hp <= 0 && enemy.healthBar > 1) {
    enemy.healthBar -= 1;
    enemy.hp = enemy.maxHp;
    enemy.enraged = true;
    enemy.freezeTimer = 0;
    enemy.phaseBreakInvulnerability = GAME_CONFIG.colossus.phaseBreakInvulnerability;
    enemy.activeSkill = null;
    enemy.intentSkill = null;
    enemy.activeSkills = {};
    enemy.exposedTimer = 0;
    enemy.artilleryCountered = false;
    enemy.artilleryShotsRemaining = null;
    enemy.summonCountered = false;
    enemy.summonRiftsAttackable = false;
    enemy.parallelCooldowns = Object.fromEntries(GAME_CONFIG.colossus.skillOrder.map((skill, index) => [skill, index * GAME_CONFIG.colossus.enrageParallelStagger]));
    state.hostileProjectiles.length = 0;
    state.summonRifts.length = 0;
    state.events.push({ type: "colossusEnrage", enemyId: enemy.id, affix: enemy.colossusAffix, healthBar: enemy.healthBar, x: enemy.x, y: enemy.y });
    offerRelicChoice(state, "colossusPhase");
  }
  if (enemy.type === "sovereign" && enemy.hp <= 0 && enemy.healthBar > 1) {
    enemy.healthBar -= 1;
    enemy.hp = enemy.maxHp;
    enemy.phaseBreakInvulnerability = GAME_CONFIG.sovereign.phaseBreakInvulnerability;
    enemy.activeSkill = null;
    enemy.intentSkill = null;
    enemy.skillCooldown = 1.15;
    enemy.freezeTimer = 0;
    enemy.burnTimer = 0;
    enemy.burnDamagePerTick = 0;
    state.hostileProjectiles.length = 0;
    state.summonRifts = state.summonRifts.filter((rift) => rift.bossId !== enemy.id);
    state.events.push({ type: "sovereignPhase", enemyId: enemy.id, healthBar: enemy.healthBar, x: enemy.x, y: enemy.y });
    if (enemy.healthBar === GAME_CONFIG.sovereign.summon.empoweredHealthBar) {
      state.events.push({ type: "sovereignSummonEmpowered", enemyId: enemy.id, healthBar: enemy.healthBar, x: enemy.x, y: enemy.y });
    }
  }
  if (enemy.type === "sovereign" && enemy.hp > 0 && enemy.healthBar === GAME_CONFIG.sovereign.enrageHealthBar && !enemy.enraged) {
    enemy.enraged = true;
    enemy.elementImmune = true;
    enemy.freezeTimer = 0;
    enemy.burnTimer = 0;
    enemy.burnDamagePerTick = 0;
    enemy.skillCooldown = Math.min(enemy.skillCooldown, 0.45);
    state.events.push({ type: "sovereignEnrage", enemyId: enemy.id, x: enemy.x, y: enemy.y });
  }
  if (enemy.type === "boss" && enemy.hp > 0) {
    const ratio = enemy.hp / enemy.maxHp;
    const nextPhase = ratio <= GAME_CONFIG.boss.phaseThresholds[1] ? 2 : ratio <= GAME_CONFIG.boss.phaseThresholds[0] ? 1 : 0;
    if (nextPhase > enemy.bossPhase) {
      enemy.bossPhase = nextPhase;
      enemy.resistance = GAME_CONFIG.boss.resistances[nextPhase];
      spawnBossAnchors(state, enemy);
      state.events.push({ type: "bossPhase", phase: nextPhase, resistance: enemy.resistance });
    }
  }
}

export function applyElementalHit(state, enemy, element, baseDamage) {
  const cfg = GAME_CONFIG.elements[element];
  if (!cfg || !enemy || enemy.hp <= 0) return false;
  if (enemy.type === "sovereign" && enemy.elementImmune) {
    enemy.freezeTimer = 0;
    enemy.burnTimer = 0;
    enemy.burnDamagePerTick = 0;
    state.floaters.push({ x: enemy.x, y: enemy.y - enemy.radius, text: "元素无效", life: 0.75, color: "#ff6d55" });
    state.events.push({ type: "sovereignElementImmune", element, enemyId: enemy.id, x: enemy.x, y: enemy.y });
    return false;
  }
  const bossScale = isBossEnemy(enemy) ? cfg.bossEffectMultiplier : 1;
  const lunarScale = (state.relics.owned.lunar && state.phase === "night" ? amplifyMultiplier(GAME_CONFIG.relics.lunar.nightElementMultiplier, relicPotency(state, "lunar")) : 1)
    * (state.phase === "night" ? state.threatSeals?.modifiers?.elementMultiplier ?? 1 : 1);
  if (element === "frost") {
    if (enemy.type === "colossus" && enemy.enraged) {
      enemy.freezeTimer = 0;
      state.floaters.push({ x: enemy.x, y: enemy.y - enemy.radius, text: "狂化免疫", life: 0.7, color: "#ffb06b" });
      state.events.push({ type: "colossusFreezeImmune", enemyId: enemy.id, x: enemy.x, y: enemy.y });
      return false;
    }
    enemy.freezeTimer = Math.max(enemy.freezeTimer ?? 0, cfg.freezeDuration * bossScale * lunarScale);
    state.events.push({ type: "elementHit", element, x: enemy.x, y: enemy.y, bossReduced: isBossEnemy(enemy) });
    return true;
  }
  if (element === "fire") {
    const ticks = Math.max(1, Math.round(cfg.burnDuration / cfg.burnTick));
    enemy.burnTimer = Math.max(enemy.burnTimer ?? 0, cfg.burnDuration * (isBossEnemy(enemy) ? 0.7 : 1) * lunarScale);
    enemy.burnTickCooldown = Math.min(enemy.burnTickCooldown || cfg.burnTick, cfg.burnTick);
    enemy.burnDamagePerTick = Math.max(enemy.burnDamagePerTick ?? 0, baseDamage * cfg.burnDamageMultiplier * bossScale * lunarScale / ticks);
    state.events.push({ type: "elementHit", element, x: enemy.x, y: enemy.y, bossReduced: isBossEnemy(enemy) });
    return true;
  }
  const stormglass = state.relics.owned.stormglass ? GAME_CONFIG.relics.stormglass : null;
  const stormPotency = stormglass ? relicPotency(state, "stormglass") : 1;
  const chainRange = cfg.chainRange * (stormglass ? amplifyMultiplier(stormglass.rangeMultiplier, stormPotency) : 1);
  const chainCount = cfg.chainCount + (stormglass ? stormglass.extraChains + relicUpgradeLevel(state, "stormglass") : 0);
  const chainMultiplier = stormglass ? Math.min(0.95, stormglass.chainMultiplier * stormPotency) : cfg.chainMultiplier;
  const nearby = state.enemies
    .filter((candidate) => candidate !== enemy && candidate.hp > 0 && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= chainRange)
    .sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y) || a.id - b.id)
    .slice(0, chainCount);
  let from = enemy;
  const sourceScale = isBossEnemy(enemy) ? cfg.bossEffectMultiplier : 1;
  nearby.forEach((target, index) => {
    const targetScale = isBossEnemy(target) ? cfg.bossEffectMultiplier : 1;
    const damage = baseDamage * (chainMultiplier ** (index + 1)) * sourceScale * targetScale * lunarScale;
    damageEnemy(state, target, damage, "lightning");
    state.elementFx.push({ element: "lightning", x1: from.x, y1: from.y, x2: target.x, y2: target.y, life: 0.16, maxLife: 0.16 });
    from = target;
  });
  state.events.push({ type: "elementHit", element, x: enemy.x, y: enemy.y, chains: nearby.length, bossReduced: isBossEnemy(enemy) });
  return true;
}

function addCoinDrop(state, enemy) {
  const dropCount = enemy.unitCount ?? 1;
  const lunarValue = state.relics.owned.lunar && state.phase === "day" ? amplifyMultiplier(GAME_CONFIG.relics.lunar.dayCoinMultiplier, relicPotency(state, "lunar")) : 1;
  const sealCoinMultiplier = state.threatSeals?.modifiers?.coinMultiplier ?? 1;
  const drop = { x: enemy.x, y: enemy.y, renderX: enemy.x, renderY: enemy.y, value: Math.max(1, Math.round(enemy.reward * lunarValue * sealCoinMultiplier)), pileCount: dropCount, age: 0, collectAge: 0, collector: null, droneIndex: 0 };
  if (state.coinOrbs.length < GAME_CONFIG.coins.maxOrbs) {
    state.coinOrbs.push(drop);
    return;
  }
  let target = null;
  let bestDistance = Infinity;
  for (const orb of state.coinOrbs) {
    if (orb.expired || orb.collected) continue;
    const dx = (orb.renderX ?? orb.x) - enemy.x;
    const dy = (orb.renderY ?? orb.y) - enemy.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) { target = orb; bestDistance = distance; }
  }
  target ??= state.coinOrbs[0];
  if (!target) return;
  target.value += drop.value;
  target.pileCount = (target.pileCount ?? 1) + dropCount;
}

function spawnRelicDecoy(state, direction, waveIndex) {
  if (!state.relics.owned.decoy || direction == null) return null;
  const cfg = GAME_CONFIG.relics.decoy;
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const [vx, vy] = vectors[direction] ?? vectors[0];
  const hpScale = 1 + Math.max(0, state.threat - 1) * 0.15;
  const potency = relicPotency(state, "decoy");
  const decoy = {
    id: state.nextId++,
    x: centerX + vx * cfg.distance,
    y: centerY + vy * cfg.distance,
    hp: cfg.hp * hpScale * potency,
    maxHp: cfg.hp * hpScale * potency,
    radius: cfg.radius,
    direction,
    waveIndex,
    age: 0
  };
  state.decoys.push(decoy);
  state.events.push({ type: "relicDecoySpawn", x: decoy.x, y: decoy.y, direction, waveIndex });
  return decoy;
}

function updateRelicDecoys(state, dt) {
  const cfg = GAME_CONFIG.relics.decoy;
  const potency = relicPotency(state, "decoy");
  for (const decoy of state.decoys) {
    decoy.age += dt;
    if (decoy.hp <= 0) {
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && Math.hypot(enemy.x - decoy.x, enemy.y - decoy.y) <= cfg.explosionRadius + enemy.radius) {
          damageEnemy(state, enemy, getTowerStats(state).damage * cfg.explosionDamageMultiplier * potency, "explosion");
        }
      }
      decoy.resolved = true;
      state.events.push({ type: "relicDecoyExplode", x: decoy.x, y: decoy.y, radius: cfg.explosionRadius });
      if (state.relics.owned.decoyWard) {
        const maxHp = getTowerStats(state).maxHp;
        const before = state.tower.shield;
        state.tower.shield = Math.min(maxHp * GAME_CONFIG.relics.ward.maxShieldFraction, state.tower.shield + maxHp * GAME_CONFIG.relics.decoyWard.shieldFraction * relicPotency(state, "decoyWard"));
        state.events.push({ type: "relicDecoyWard", value: state.tower.shield - before, x: decoy.x, y: decoy.y });
      }
      continue;
    }
    const waveEnemiesRemain = state.enemies.some((enemy) => enemy.hp > 0 && enemy.waveIndex === decoy.waveIndex);
    if (!state.wave.active && !waveEnemiesRemain && decoy.age > 0.5) {
      addCoinDrop(state, { x: decoy.x, y: decoy.y, reward: Math.round(cfg.survivalCoins * potency), unitCount: 1 });
      decoy.resolved = true;
      state.events.push({ type: "relicDecoySurvived", x: decoy.x, y: decoy.y, value: cfg.survivalCoins });
    }
  }
  state.decoys = state.decoys.filter((decoy) => !decoy.resolved);
}

function spawnEmberZone(state, x, y, frostfire = false) {
  const cfg = GAME_CONFIG.relics.ember;
  const potency = relicPotency(state, frostfire ? "frostfire" : "ember");
  state.emberZones.push({ id: state.nextId++, x, y, radius: cfg.radius * potency, life: cfg.duration * potency, maxLife: cfg.duration * potency, tick: 0, frostfire });
  if (state.emberZones.length > cfg.maxZones) state.emberZones.splice(0, state.emberZones.length - cfg.maxZones);
  state.events.push({ type: "relicEmber", x, y, radius: cfg.radius });
}

function updateEmberZones(state, dt) {
  const cfg = GAME_CONFIG.relics.ember;
  for (const zone of state.emberZones) {
    zone.life -= dt;
    zone.tick -= dt;
    if (zone.life <= 0 || zone.tick > 0) continue;
    zone.tick += cfg.tickInterval;
    const damageMultiplier = (zone.frostfire ? GAME_CONFIG.relics.frostfire.damageMultiplier : cfg.damageMultiplier) * relicPotency(state, zone.frostfire ? "frostfire" : "ember");
    const damage = getTowerStats(state).damage * damageMultiplier;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || Math.hypot(enemy.x - zone.x, enemy.y - zone.y) > zone.radius + enemy.radius) continue;
      damageEnemy(state, enemy, damage, zone.frostfire ? "frostfire" : "ember");
      if (zone.frostfire && (enemy.type !== "colossus" || !enemy.enraged) && (enemy.type !== "sovereign" || !enemy.elementImmune)) {
        const bossScale = isBossEnemy(enemy) ? GAME_CONFIG.elements.frost.bossEffectMultiplier : 1;
        enemy.freezeTimer = Math.max(enemy.freezeTimer ?? 0, GAME_CONFIG.relics.frostfire.freezeDuration * bossScale);
      }
    }
  }
  state.emberZones = state.emberZones.filter((zone) => zone.life > 0);
}
export function spawnPermanentResourceDrop(state, resourceType, value = 1, x = GAME_CONFIG.arena.centerX, y = GAME_CONFIG.arena.centerY, metadata = {}) {
  if (resourceType !== "echo" && resourceType !== "core") return null;
  if (value <= 0) return null;
  const multiplier = state.threatSeals?.modifiers?.resourceMultiplier ?? 1;
  const resourceCarry = state.threatSeals?.resourceCarry ?? (state.threatSeals.resourceCarry = { echo: 0, core: 0 });
  const scaledValue = value * multiplier + (Number(resourceCarry[resourceType]) || 0);
  const dropValue = Math.max(1, Math.floor(scaledValue + 1e-9));
  resourceCarry[resourceType] = Math.max(0, scaledValue - dropValue);
  if (state.resourceDrops.length >= GAME_CONFIG.permanentResources.maxDrops) {
    const target = state.resourceDrops
      .filter((drop) => drop.resourceType === resourceType)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (target) {
      target.value += dropValue;
      return target;
    }
  }
  const drop = {
    id: state.nextId++,
    resourceType,
    value: dropValue,
    x,
    y,
    renderX: x,
    renderY: y,
    age: 0,
    phase: state.rng.next() * Math.PI * 2,
    source: metadata.source ?? "enemy",
    threatLevel: metadata.threatLevel ?? null
  };
  state.resourceDrops.push(drop);
  state.events.push({ type: "permanentResourceDrop", resourceType, value: dropValue, source: drop.source, x, y });
  return drop;
}


export function collectPermanentResourceAt(state, x, y, clickRadius = GAME_CONFIG.permanentResources.clickRadius) {
  let bestIndex = -1;
  let bestDistance = clickRadius;
  for (let index = 0; index < state.resourceDrops.length; index += 1) {
    const drop = state.resourceDrops[index];
    const distance = Math.hypot((drop.renderX ?? drop.x) - x, (drop.renderY ?? drop.y) - y);
    if (distance <= bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  if (bestIndex < 0) return null;
  const [drop] = state.resourceDrops.splice(bestIndex, 1);
  return collectPermanentResource(state, drop);
}

export function getDroneEnergyMax(state) {
  const batteryLevel = state?.tower?.upgrades?.droneBattery ?? 0;
  return GAME_CONFIG.drones.energyMax + batteryLevel * GAME_CONFIG.drones.batteryCapacityPerLevel;
}

export function getDroneGuardShieldMax(state) {
  const batteryLevel = state?.tower?.upgrades?.droneBattery ?? 0;
  return GAME_CONFIG.drones.guard.shieldMax + batteryLevel * GAME_CONFIG.drones.guard.shieldPerBattery;
}

export function getDroneDetonateRecovery(state) {
  const level = state?.tower?.upgrades?.droneDetonateRecovery ?? 0;
  const cfg = GAME_CONFIG.drones.detonate;
  return cfg.recoveryDuration * (cfg.recoveryMultiplier ** level);
}

export function getDroneGuardCooldown(state) {
  const level = state?.tower?.upgrades?.droneGuardRecovery ?? 0;
  const cfg = GAME_CONFIG.drones.guard;
  return cfg.cooldown * (cfg.cooldownMultiplier ** level);
}

function collectPermanentResource(state, drop) {
  if (drop.resourceType === "echo") state.stats.echoShards += drop.value;
  else state.stats.coreFragments += drop.value;
  const resourceName = drop.resourceType === "echo" ? "遗响碎片" : "核心残片";
  state.floaters.push({
    x: drop.x,
    y: drop.y - 18,
    text: `${resourceName} +${drop.value}`,
    life: 1.15,
    color: drop.resourceType === "echo" ? "#8eefff" : "#ffd477"
  });
  state.events.push({ type: "permanentResourceCollected", resourceType: drop.resourceType, value: drop.value, source: drop.source, threatLevel: drop.threatLevel });
  return drop;
}

function updatePermanentResourceDrops(state, dt) {
  for (const drop of state.resourceDrops) {
    drop.age += dt;
    drop.renderX = drop.x + Math.sin(drop.age * 1.7 + drop.phase) * 2.2;
    drop.renderY = drop.y - 7 - Math.sin(drop.age * 3.4 + drop.phase) * 4.5;
  }
  if (state.tower.droneMode !== "collect" || state.tower.upgrades.autoCollect <= 0) return;
  state.tower.autoCollectCooldown -= dt;
  if (state.tower.autoCollectCooldown > 0) return;

  const drops = state.resourceDrops.splice(0);
  for (const drop of drops) collectPermanentResource(state, drop);
  state.tower.autoCollectCooldown = GAME_CONFIG.coins.towerInterval;
  state.events.push({ type: "towerCollectPulse", count: drops.length });
}

function triggerCannonCascade(state, enemy) {
  const cfg = GAME_CONFIG.cannon.split;
  const damage = getTowerStats(state).damage * cfg.cascadeDamageMultiplier;
  const targets = [];
  for (const target of state.enemies) {
    if (target === enemy || target.hp <= 0 || Math.hypot(target.x - enemy.x, target.y - enemy.y) > cfg.cascadeRadius + target.radius) continue;
    targets.push({ x: target.x, y: target.y });
    damageEnemy(state, target, damage, "cannonCascade");
  }
  const effect = {
    element: "cannonCascade", x: enemy.x, y: enemy.y, radius: cfg.cascadeRadius,
    targets: targets.slice(0, 12), life: cfg.cascadeDuration, maxLife: cfg.cascadeDuration
  };
  state.elementFx.push(effect);
  state.events.push({ type: "cannonCascade", x: enemy.x, y: enemy.y, radius: cfg.cascadeRadius, damage, hits: targets.length, targets: effect.targets });
}

function resolveDeaths(state) {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 || enemy.deadHandled) continue;
    enemy.deadHandled = true;
    if (enemy.type === "anchor") {
      if (enemy.riftAnchor) {
        state.summonRifts = state.summonRifts.filter((rift) => rift.targetId !== enemy.id);
        state.events.push({ type: "colossusCounter", counter: "rift", enemyId: enemy.anchorBossId, x: enemy.x, y: enemy.y });
      } else if (enemy.counterSkill === "artillery") {
        const colossus = state.enemies.find((candidate) => candidate.id === enemy.anchorBossId && candidate.type === "colossus" && candidate.hp > 0);
        if (colossus?.intentSkill === "artillery") {
          colossus.artilleryCountered = true;
          state.events.push({ type: "colossusCounter", counter: "artillery", enemyId: colossus.id, x: enemy.x, y: enemy.y });
        }
      }
      if (state.tower.anchorLockId === enemy.id) {
        state.tower.anchorLockId = null;
        state.tower.anchorLockTimer = 0;
      }
      state.events.push({ type: "anchorDestroyed", bossId: enemy.anchorBossId, role: enemy.anchorRole, x: enemy.x, y: enemy.y });
      continue;
    }
    const defeatedUnits = enemy.unitCount ?? 1;
    state.stats.kills += defeatedUnits;
    const baseScore = enemy.scoreValue ?? (GAME_CONFIG.score.enemy[enemy.type] ?? 100);
    const killScore = Math.round(baseScore * (enemy.elite ? GAME_CONFIG.score.eliteMultiplier : 1));
    state.stats.score += killScore;
    state.floaters.push({ x: enemy.x, y: enemy.y - enemy.radius - 12, text: `+${killScore} 分`, life: 0.85, color: enemy.elite || isBossEnemy(enemy) ? "#ffe07a" : "#ffd7a0" });
    if (state.tower.upgrades.cannonCascade > 0 && enemy.lastDamageSource === "cannonEcho") {
      const cfg = GAME_CONFIG.cannon.split;
      state.tower.cannonEchoChain = state.tower.cannonEchoChainTimer > 0 ? state.tower.cannonEchoChain + defeatedUnits : defeatedUnits;
      state.tower.cannonEchoChainTimer = cfg.cascadeWindow;
      if (state.tower.cannonEchoChain >= cfg.cascadeKills && (state.tower.cannonCascadeCooldown ?? 0) <= 0) {
        state.tower.cannonEchoChain = 0;
        state.tower.cannonEchoChainTimer = 0;
        state.tower.cannonCascadeCooldown = cfg.cascadeCooldown ?? 0;
        triggerCannonCascade(state, enemy);
      }
    }
    if (state.relics.owned.ember && (enemy.lastDamageSource === "fire" || enemy.lastDamageSource === "explosion")) {
      spawnEmberZone(state, enemy.x, enemy.y);
    }
    if (state.tower.upgrades.cannonEcho > 0 && enemy.lastDamageSource !== "cannonEcho") {
      const cfg = GAME_CONFIG.cannon.split;
      const radius = cfg.echoRadius;
      const damage = getTowerStats(state).damage * cfg.echoDamageMultiplier * state.tower.upgrades.cannonEcho;
      let hits = 0;
      for (const target of state.enemies) {
        if (target === enemy || target.hp <= 0 || Math.hypot(target.x - enemy.x, target.y - enemy.y) > radius + target.radius) continue;
        damageEnemy(state, target, damage, "cannonEcho");
        hits += 1;
      }
      state.events.push({ type: "cannonEcho", x: enemy.x, y: enemy.y, radius, damage, hits });
    }
    if (state.relics.owned.frostbloom && (enemy.freezeTimer ?? 0) > 0) {
      const cfg = GAME_CONFIG.relics.frostbloom;
      const potency = relicPotency(state, "frostbloom");
      for (const target of state.enemies) {
        if (target === enemy || target.hp <= 0 || Math.hypot(target.x - enemy.x, target.y - enemy.y) > cfg.radius * potency + target.radius) continue;
        damageEnemy(state, target, getTowerStats(state).damage * cfg.damageMultiplier * potency, "frost");
        if ((target.type !== "colossus" || !target.enraged) && (target.type !== "sovereign" || !target.elementImmune)) target.freezeTimer = Math.max(target.freezeTimer ?? 0, cfg.freezeDuration * potency * (isBossEnemy(target) ? GAME_CONFIG.elements.frost.bossEffectMultiplier : 1));
      }
      state.events.push({ type: "relicFrostbloom", x: enemy.x, y: enemy.y, radius: cfg.radius });
      if (state.relics.owned.frostfire) {
        spawnEmberZone(state, enemy.x, enemy.y, true);
        state.events.push({ type: "relicFrostfire", x: enemy.x, y: enemy.y, radius: GAME_CONFIG.relics.ember.radius });
      }
    }
    if (state.relics.owned.ward) {
      const cfg = GAME_CONFIG.relics.ward;
      const potency = relicPotency(state, "ward");
      const killsRequired = Math.max(5, Math.round(cfg.kills / potency));
      state.relics.wardKills += defeatedUnits;
      while (state.relics.wardKills >= killsRequired) {
        state.relics.wardKills -= killsRequired;
        const maxHp = getTowerStats(state).maxHp;
        const before = state.tower.shield;
        state.tower.shield = Math.min(maxHp * cfg.maxShieldFraction * potency, state.tower.shield + maxHp * cfg.shieldFraction * potency);
        if (state.tower.shield > before) state.events.push({ type: "relicWard", value: state.tower.shield - before });
      }
    }
    if (enemy.elite && !state.endlessMode) {
      spawnPermanentResourceDrop(state, "echo", GAME_CONFIG.permanentResources.eliteEcho, enemy.x - 10, enemy.y, { source: "elite" });
      if (enemy.waveElite) offerRelicChoice(state, "eliteWave");
      const relicChanceBonus = state.threatSeals?.modifiers?.relicChanceBonus ?? 0;
      if (relicChanceBonus > 0 && state.rng.next() < relicChanceBonus) {
        const queuedBefore = state.relics.rewardQueue.length;
        const offered = offerRelicChoice(state, "sealElite");
        if (offered || state.relics.rewardQueue.length > queuedBefore) {
          state.events.push({ type: "sealRelicDrop", x: enemy.x, y: enemy.y });
        }
      }
    }
    if (isBossEnemy(enemy)) {
      state.stats.bossKills += 1;
      const coreValue = enemy.type === "sovereign" ? GAME_CONFIG.permanentResources.sovereignCore : enemy.type === "colossus" ? GAME_CONFIG.permanentResources.colossusCore : GAME_CONFIG.permanentResources.bossCore;
      if (!state.endlessMode) spawnPermanentResourceDrop(state, "core", coreValue, enemy.x, enemy.y, { source: enemy.type });
      if (enemy.type === "boss") {
        for (const anchor of bossAnchors(state, enemy)) anchor.deadHandled = true;
        state.events.push({ type: "bossDefeated", threat: state.threat, x: enemy.x, y: enemy.y });
        if (!state.endlessMode) offerRelicChoice(state, "boss");
      }
      if (enemy.type === "colossus") {
        state.colossusEncounter.defeated = true;
        state.hostileProjectiles.length = 0;
        state.summonRifts = state.summonRifts.filter((rift) => rift.bossId !== enemy.id);
        state.events.push({ type: "colossusDefeated", x: enemy.x, y: enemy.y });
        if (!state.endlessMode && (state.threatSeals?.modifiers?.emberCoreBonus ?? 0) > 0) {
          const bonus = state.threatSeals.modifiers.emberCoreBonus;
          const emberCore = spawnPermanentResourceDrop(state, "core", bonus, enemy.x + 22, enemy.y, { source: "emberCore" });
          state.events.push({ type: "sealEmberCore", value: emberCore?.value ?? bonus, x: enemy.x, y: enemy.y });
        }
        if (!state.endlessMode) offerRelicChoice(state, "colossusDefeat");
      }
      if (enemy.type === "sovereign") {
        state.sovereignEncounter.defeated = true;
        state.hostileProjectiles.length = 0;
        state.summonRifts = state.summonRifts.filter((rift) => rift.bossId !== enemy.id);
        state.tower.fireRateSuppression = 0;
        state.events.push({ type: "sovereignDefeated", x: enemy.x, y: enemy.y });
        // The chapter-ending sovereign grants campaign energy through the
        // persistent progression layer, never a transient relic choice.
      }
    }
    addCoinDrop(state, enemy);
    state.events.push({ type: "kill", enemyType: enemy.type, elite: enemy.elite, units: defeatedUnits, score: killScore, x: enemy.x, y: enemy.y });
    if (enemy.elite && enemy.affix === "split") {
      const cfg = GAME_CONFIG.eliteAffixes.split;
      for (let index = 0; index < cfg.count; index += 1) {
        const angle = index * Math.PI * 2 / cfg.count + state.rng.next() * 0.35;
        spawnEnemy(state, enemy.type, { x: enemy.x + Math.cos(angle) * enemy.radius, y: enemy.y + Math.sin(angle) * enemy.radius }, { splitChild: true, waveIndex: enemy.waveIndex });
      }
      state.events.push({ type: "eliteSplit", x: enemy.x, y: enemy.y, count: cfg.count });
    }
  }
  state.enemies = state.enemies.filter((enemy) => !enemy.deadHandled);
}

function updateThreat(state) {
  const nextThreat = Math.floor(state.time / GAME_CONFIG.threat.duration) + 1;
  if (nextThreat === state.threat) return;
  state.threat = nextThreat;
  const nextPhase = getStateDayPhase(state, nextThreat);
  if (nextPhase !== state.phase) {
    state.events.push({ type: "phase", phase: nextPhase });
    if (state.relics.owned.lunar) {
      state.relics.phaseBuff = GAME_CONFIG.relics.lunar.transitionDuration * relicPotency(state, "lunar");
      state.events.push({ type: "relicPhaseBuff", phase: nextPhase, duration: state.relics.phaseBuff });
    }
  }
  state.phase = nextPhase;
  state.stats.highestThreat = Math.max(state.stats.highestThreat, nextThreat);
  state.events.push({ type: "threat", level: nextThreat });
  if (nextThreat === (state.threatSeals?.modifiers?.colossusSpawnThreat ?? GAME_CONFIG.colossus.spawnThreat) && !state.colossusEncounter.spawned) spawnEnemy(state, "colossus");
  if (nextThreat === GAME_CONFIG.sovereign.spawnThreat && !state.sovereignEncounter.spawned) {
    state.enemies.length = 0;
    state.hostileProjectiles.length = 0;
    state.summonRifts.length = 0;
    state.wave.active = false;
    state.wave.remaining = 0;
    state.decoys.length = 0;
    spawnEnemy(state, "sovereign", { x: GAME_CONFIG.sovereign.fixedX, y: GAME_CONFIG.sovereign.fixedY });
  } else if (nextThreat % GAME_CONFIG.threat.bossEvery === 0) spawnEnemy(state, "boss");
}

function activeColossus(state) {
  return state.enemies.find((enemy) => (enemy.type === "colossus" || enemy.type === "sovereign") && enemy.hp > 0);
}

function sovereignEntryActive(state) {
  return state.enemies.some((enemy) => enemy.type === "sovereign" && enemy.hp > 0 && (enemy.entryTimer ?? 0) > 0);
}

function endlessThreatTier(state) {
  return Math.max(0, state.threat - GAME_CONFIG.sovereign.spawnThreat);
}

export function getEndlessEliteChance(state) {
  if (!state.endlessMode) return 0;
  const cfg = GAME_CONFIG.endless;
  return Math.min(cfg.eliteChanceCap, cfg.baseEliteChance + endlessThreatTier(state) * cfg.eliteChancePerThreat);
}

export function getEndlessWaveEliteCount(state) {
  if (!state.endlessMode) return 1;
  const cfg = GAME_CONFIG.endless;
  return Math.min(cfg.waveEliteCap, cfg.waveBaseElites + Math.floor(endlessThreatTier(state) / cfg.waveElitePerThreat));
}

function updateWave(state, dt) {
  const cfg = GAME_CONFIG.waves;
  const wave = state.wave;
  if (activeColossus(state)) {
    if (!wave.active) wave.nextAt += dt;
    return;
  }
  if (!wave.warningStarted && state.time >= wave.nextAt - cfg.warning) {
    wave.warningStarted = true;
    wave.direction = Math.floor(state.rng.next() * 4);
    state.events.push({ type: "waveWarning", index: wave.index + 1, direction: wave.direction });
  }
  if (!wave.active && state.time >= wave.nextAt) {
    wave.active = true;
    wave.remaining = Math.ceil((cfg.baseCount + state.threat * cfg.countPerThreat) * (state.threatSeals?.modifiers?.waveCountMultiplier ?? 1));
    wave.spawnTimer = 0;
    wave.index += 1;
    wave.nextAt += cfg.interval;
    wave.warningStarted = false;
    wave.eliteRemaining = getEndlessWaveEliteCount(state);
    wave.elitePending = wave.eliteRemaining > 0;
    state.events.push({ type: "waveStart", index: wave.index, count: wave.remaining, direction: wave.direction, eliteCount: wave.eliteRemaining, endless: state.endlessMode });
    spawnRelicDecoy(state, wave.direction, wave.index);
  }
  if (!wave.active) return;
  wave.spawnTimer -= dt;
  while (wave.remaining > 0 && wave.spawnTimer <= 0) {
    const side = state.rng.next() < 0.78 ? wave.direction : null;
    const elite = state.endlessMode
      ? wave.eliteRemaining > 0 && state.rng.next() < wave.eliteRemaining / wave.remaining
      : wave.elitePending;
    const spawned = spawnEnemy(state, chooseEnemyType(state), spawnPosition(state.rng, side), { elite, waveElite: elite, waveIndex: wave.index });
    if (elite && spawned) {
      wave.eliteRemaining = Math.max(0, wave.eliteRemaining - 1);
      wave.elitePending = wave.eliteRemaining > 0;
    }
    wave.remaining -= 1;
    wave.spawnTimer += cfg.spawnInterval;
  }
  if (wave.remaining <= 0) {
    wave.active = false;
    wave.direction = null;
    if (!wave.pendingClear.includes(wave.index)) wave.pendingClear.push(wave.index);
    state.events.push({ type: "waveEnd", index: wave.index });
  }
}

function resolveWaveClears(state) {
  const pending = state.wave.pendingClear;
  if (!pending.length) return;
  for (let index = 0; index < pending.length;) {
    const waveIndex = pending[index];
    if (state.enemies.some((enemy) => enemy.hp > 0 && enemy.waveIndex === waveIndex)) {
      index += 1;
      continue;
    }
    pending.splice(index, 1);
    state.events.push({ type: "waveCleared", index: waveIndex, endless: state.endlessMode });
    if (state.endlessMode) offerRelicChoice(state, "endlessWave");
  }
}

function updateSpawning(state, dt) {
  if (activeColossus(state)) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  const pack = Math.min(GAME_CONFIG.threat.maxPack, 1 + Math.floor((state.threat - 1) / GAME_CONFIG.threat.packGrowthEvery));
  const eliteChance = getEndlessEliteChance(state);
  for (let index = 0; index < pack; index += 1) spawnEnemy(state, chooseEnemyType(state), undefined, { elite: state.endlessMode && state.rng.next() < eliteChance });
  const interval = Math.max(GAME_CONFIG.threat.spawnMin, GAME_CONFIG.threat.spawnBase * (GAME_CONFIG.threat.spawnDecay ** (state.threat - 1)));
  state.spawnTimer += interval * (0.82 + state.rng.next() * 0.36);
}

function updateBossAnchor(state, anchor, dt) {
  const boss = state.enemies.find((enemy) => enemy.id === anchor.anchorBossId && enemy.type === "boss" && enemy.hp > 0);
  if (!boss) return;
  anchor.effectPulse = Math.max(0, (anchor.effectPulse ?? 0) - dt);
  if (anchor.anchorRole === "repair") {
    const before = boss.hp;
    boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * GAME_CONFIG.boss.repairPerSecond * dt);
    if (boss.hp > before) anchor.effectPulse = Math.max(anchor.effectPulse, 0.12);
  } else if (anchor.anchorRole === "summon") {
    anchor.effectCooldown -= dt;
    if (anchor.effectCooldown <= 0 && state.enemies.length < GAME_CONFIG.combat.maxEnemies) {
      const types = GAME_CONFIG.boss.summonTypes;
      const type = types[Math.min(boss.bossPhase, types.length - 1)];
      const angle = state.rng.next() * Math.PI * 2;
      const summoned = spawnEnemy(state, type, { x: anchor.x + Math.cos(angle) * 24, y: anchor.y + Math.sin(angle) * 24 });
      if (summoned) state.events.push({ type: "anchorSummon", anchorId: anchor.id, enemyId: summoned.id, enemyType: type, x: anchor.x, y: anchor.y });
      anchor.effectCooldown += GAME_CONFIG.boss.summonInterval;
      anchor.effectPulse = 0.5;
    }
  }
}

function damageTower(state, damage, heavy = false, source = "enemy") {
  if (heavy && state.tower.droneMode === "collect" && state.tower.upgrades.droneIntercept > 0 && state.tower.interceptCharge > 0) {
    state.tower.interceptCharge = 0;
    state.tower.interceptRecharge = GAME_CONFIG.drones.interceptRecharge;
    const towerPosition = getTowerPosition(state);
    state.events.push({ type: "droneIntercept", x: towerPosition.x, y: towerPosition.y, enemyType: source });
    return false;
  }
  if (state.skills.heal.shieldBurstArmed) releaseShieldBurst(state);
  const reductionActive = hasSkillResearchNode(state, "heal", "lastStand") && state.skills.heal.damageReduction > 0;
  const reducedDamage = damage * (reductionActive ? 1 - GAME_CONFIG.activeSkillResearch.heal.damageReduction : 1);
  let remainingDamage = reducedDamage;
  const droneShieldAbsorbed = Math.min(state.tower.droneGuardShield, remainingDamage);
  state.tower.droneGuardShield -= droneShieldAbsorbed;
  remainingDamage -= droneShieldAbsorbed;
  const towerShieldAbsorbed = Math.min(state.tower.shield, remainingDamage);
  state.tower.shield -= towerShieldAbsorbed;
  remainingDamage -= towerShieldAbsorbed;
  state.tower.hp = Math.max(0, state.tower.hp - remainingDamage);
  state.tower.healthBarTimer = GAME_CONFIG.tower.healthBarDuration;
  state.events.push({ type: "towerHit", damage: remainingDamage, absorbed: droneShieldAbsorbed + towerShieldAbsorbed, mitigated: damage - reducedDamage, droneShieldAbsorbed, heavy, source });
  return true;
}

function colossusAffixConfig(boss) {
  return GAME_CONFIG.colossus.affixes[boss.colossusAffix] ?? {};
}

function colossusAttackMultiplier(boss) {
  return boss.enraged ? GAME_CONFIG.colossus.enrageDamageMultiplier : 1;
}

function removeColossusCounterAnchors(state, boss) {
  const removedIds = new Set(state.enemies.filter((enemy) => enemy.type === "anchor" && enemy.anchorBossId === boss.id && enemy.counterSkill).map((enemy) => enemy.id));
  if (!removedIds.size) return;
  state.enemies = state.enemies.filter((enemy) => !removedIds.has(enemy.id));
  if (removedIds.has(state.tower.anchorLockId)) {
    state.tower.anchorLockId = null;
    state.tower.anchorLockTimer = 0;
  }
}

function spawnColossusArtilleryAnchor(state, boss) {
  const { centerX, centerY } = GAME_CONFIG.arena;
  const angle = Math.atan2(boss.y - centerY, boss.x - centerX);
  const anchor = spawnEnemy(state, "anchor", {
    x: centerX + Math.cos(angle) * 255,
    y: centerY + Math.sin(angle) * 190
  }, { anchorBossId: boss.id, anchorRole: "overload" });
  anchor.counterSkill = "artillery";
  anchor.maxHp = GAME_CONFIG.colossus.counters.artilleryAnchorHp;
  anchor.hp = anchor.maxHp;
  anchor.radius = 22;
  state.events.push({ type: "colossusCounterAnchor", skill: "artillery", anchorId: anchor.id, enemyId: boss.id, x: anchor.x, y: anchor.y });
}

function counterColossusBeam(state, angle, coneHalfAngle) {
  const { centerX, centerY } = GAME_CONFIG.arena;
  const boss = state.enemies.find((enemy) => {
    if (enemy.type !== "colossus" || enemy.hp <= 0 || enemy.intentSkill !== "beam") return false;
    const bossAngle = Math.atan2(enemy.y - centerY, enemy.x - centerX);
    return angleDistance(bossAngle, angle) <= coneHalfAngle;
  });
  if (!boss) return false;
  boss.intentSkill = null;
  boss.intentTimer = 0;
  boss.skillCooldown = GAME_CONFIG.colossus.skillCooldown;
  boss.exposedTimer = GAME_CONFIG.colossus.counters.exposedDuration;
  removeColossusCounterAnchors(state, boss);
  state.events.push({ type: "colossusCounter", counter: "beam", enemyId: boss.id, duration: boss.exposedTimer, x: boss.x, y: boss.y });
  return true;
}

function counterColossusBulwark(state) {
  let any = false;
  for (const boss of state.enemies.filter((enemy) => enemy.type === "colossus" && enemy.hp > 0)) {
    let countered = false;
    if (boss.activeSkill === "bulwark" && !boss.enraged) { finishColossusSkill(boss); countered = true; }
    if (boss.activeSkills?.bulwark) {
      delete boss.activeSkills.bulwark;
      boss.parallelCooldowns.bulwark = GAME_CONFIG.colossus.skillCooldown * GAME_CONFIG.colossus.enrageCooldownMultiplier * GAME_CONFIG.colossus.enrageParallelCooldownMultiplier;
      countered = true;
    }
    if (countered) {
      any = true;
      state.events.push({ type: "colossusCounter", counter: "bulwark", enemyId: boss.id, heat: GAME_CONFIG.colossus.counters.bulwarkHeat, x: boss.x, y: boss.y });
    }
  }
  return any;
}
function beginColossusIntent(state, boss) {
  const cfg = GAME_CONFIG.colossus;
  const skill = cfg.skillOrder[boss.skillSequence % cfg.skillOrder.length];
  boss.skillSequence += 1;
  removeColossusCounterAnchors(state, boss);
  boss.artilleryCountered = false;
  boss.summonCountered = false;
  boss.intentSkill = skill;
  boss.intentTimer = cfg.intentDuration * (boss.enraged ? cfg.enrageIntentMultiplier : 1);
  if (skill === "artillery") spawnColossusArtilleryAnchor(state, boss);
  state.events.push({ type: "colossusIntent", skill, enemyId: boss.id, duration: boss.intentTimer, enraged: boss.enraged });
}

function startColossusSkill(state, boss) {
  const cfg = GAME_CONFIG.colossus;
  const affix = colossusAffixConfig(boss);
  const skill = boss.intentSkill ?? cfg.skillOrder[boss.skillSequence++ % cfg.skillOrder.length];
  boss.intentSkill = null;
  boss.intentTimer = 0;
  boss.activeSkill = skill;
  boss.skillTimer = cfg[skill].duration;
  boss.skillTick = 0;
  boss.summonsRemaining = skill === "summon" ? cfg.summon.count + (affix.summonCountBonus ?? 0) : 0;
  const artilleryShots = Math.ceil(cfg.artillery.duration / (cfg.artillery.interval * (affix.artilleryIntervalMultiplier ?? 1)));
  boss.artilleryShotsRemaining = skill === "artillery" ? Math.max(1, Math.floor(artilleryShots * (boss.artilleryCountered ? cfg.counters.artilleryShotMultiplier : 1))) : null;
  boss.summonRiftsAttackable = skill === "summon" && boss.summonCountered;
  removeColossusCounterAnchors(state, boss);
  state.events.push({ type: "colossusSkill", skill, enemyId: boss.id, duration: boss.skillTimer, enraged: boss.enraged });
}

function finishColossusSkill(boss) {
  boss.activeSkill = null;
  boss.skillTimer = 0;
  boss.skillTick = 0;
  boss.artilleryShotsRemaining = null;
  boss.summonRiftsAttackable = false;
  boss.skillCooldown = GAME_CONFIG.colossus.skillCooldown * (boss.enraged ? GAME_CONFIG.colossus.enrageCooldownMultiplier : 1);
}

function fireColossusArtillery(state, boss) {
  const cfg = GAME_CONFIG.colossus.artillery;
  const affix = colossusAffixConfig(boss);
  const { centerX, centerY } = GAME_CONFIG.arena;
  const spread = (state.rng.next() - 0.5) * 90;
  const angleToCenter = Math.atan2(centerY - boss.y, centerX - boss.x);
  const targetX = centerX - Math.sin(angleToCenter) * spread;
  const targetY = centerY + Math.cos(angleToCenter) * spread;
  const angle = Math.atan2(targetY - boss.y, targetX - boss.x);
  state.hostileProjectiles.push({
    id: state.nextId++, kind: "colossusMortar", x: boss.x, y: boss.y,
    vx: Math.cos(angle) * cfg.projectileSpeed, vy: Math.sin(angle) * cfg.projectileSpeed,
    targetX, targetY, radius: cfg.radius, life: cfg.projectileLife,
    damage: boss.damage * cfg.damageMultiplier * colossusAttackMultiplier(boss) * (affix.artilleryDamageMultiplier ?? 1)
  });
  boss.rangedFlash = 0.28;
  state.events.push({ type: "colossusArtillery", x: boss.x, y: boss.y, targetX, targetY });
}

function queueColossusSummon(state, boss, skillState) {
  const cfg = GAME_CONFIG.colossus;
  const affix = colossusAffixConfig(boss);
  if (skillState.summonsRemaining <= 0) return;
  const totalSummons = cfg.summon.count + (affix.summonCountBonus ?? 0);
  const type = cfg.summon.types[(totalSummons - skillState.summonsRemaining) % cfg.summon.types.length];
  const angle = boss.orbitAngle + Math.PI + (state.rng.next() - 0.5) * 0.7;
  const x = boss.x + Math.cos(angle) * 64;
  const y = boss.y + Math.sin(angle) * 64;
  skillState.summonsRemaining -= 1;
  const rift = {
    id: state.nextId++, bossId: boss.id, enemyType: type, x, y,
    life: cfg.summon.telegraphDuration, maxLife: cfg.summon.telegraphDuration, attackable: Boolean(skillState.summonRiftsAttackable), targetId: null
  };
  if (rift.attackable) {
    const target = spawnEnemy(state, "anchor", { x, y }, { anchorBossId: boss.id, anchorRole: "summon" });
    target.riftAnchor = true;
    target.maxHp = cfg.counters.riftHp;
    target.hp = target.maxHp;
    target.radius = 24;
    rift.targetId = target.id;
  }
  state.summonRifts.push(rift);
  state.events.push({ type: "colossusSummonRift", enemyType: type, x, y, duration: cfg.summon.telegraphDuration });
}

function tickColossusSkill(state, boss, skill, skillState, dt) {
  const cfg = GAME_CONFIG.colossus;
  const affix = colossusAffixConfig(boss);
  skillState.timer -= dt;
  skillState.tick -= dt;
  if (skill === "artillery" && skillState.tick <= 0 && skillState.artilleryShotsRemaining !== 0) {
    fireColossusArtillery(state, boss);
    if (Number.isFinite(skillState.artilleryShotsRemaining)) skillState.artilleryShotsRemaining -= 1;
    skillState.tick += cfg.artillery.interval * (affix.artilleryIntervalMultiplier ?? 1);
  } else if (skill === "summon" && skillState.tick <= 0 && skillState.summonsRemaining > 0) {
    queueColossusSummon(state, boss, skillState);
    skillState.tick += cfg.summon.interval * (affix.summonIntervalMultiplier ?? 1);
  } else if (skill === "beam" && skillState.tick <= 0) {
    damageTower(state, boss.damage * cfg.beam.damageMultiplier * colossusAttackMultiplier(boss) * (affix.beamDamageMultiplier ?? 1), true, "colossusBeam");
    boss.rangedFlash = Math.max(boss.rangedFlash, cfg.beam.tickInterval + 0.08);
    skillState.tick += cfg.beam.tickInterval * (affix.beamTickMultiplier ?? 1);
    state.events.push({ type: "colossusBeam", x: boss.x, y: boss.y });
  }
  return skillState.timer <= 0 || (skill === "summon" && skillState.summonsRemaining <= 0);
}

function startParallelColossusSkill(state, boss, skill) {
  const cfg = GAME_CONFIG.colossus;
  const affix = colossusAffixConfig(boss);
  boss.activeSkills[skill] = {
    timer: cfg[skill].duration,
    tick: 0,
    summonsRemaining: skill === "summon" ? cfg.summon.count + (affix.summonCountBonus ?? 0) : 0,
    artilleryShotsRemaining: skill === "artillery" ? Math.ceil(cfg.artillery.duration / (cfg.artillery.interval * (affix.artilleryIntervalMultiplier ?? 1))) : null,
    summonRiftsAttackable: false
  };
  state.events.push({ type: "colossusSkill", skill, enemyId: boss.id, duration: cfg[skill].duration, enraged: true, parallel: true });
}

function updateParallelColossusSkills(state, boss, dt) {
  const cfg = GAME_CONFIG.colossus;
  for (const skill of cfg.skillOrder) {
    const active = boss.activeSkills[skill];
    if (active) {
      if (tickColossusSkill(state, boss, skill, active, dt)) {
        delete boss.activeSkills[skill];
        boss.parallelCooldowns[skill] = cfg.skillCooldown * cfg.enrageCooldownMultiplier * cfg.enrageParallelCooldownMultiplier;
      }
      continue;
    }
    boss.parallelCooldowns[skill] -= dt;
    if (boss.parallelCooldowns[skill] <= 0) startParallelColossusSkill(state, boss, skill);
  }
  boss.activeSkill = Object.keys(boss.activeSkills)[0] ?? null;
}

function updateColossus(state, boss, dt) {
  const cfg = GAME_CONFIG.colossus;
  boss.exposedTimer = Math.max(0, (boss.exposedTimer ?? 0) - dt);
  const bulwarkActive = boss.activeSkill === "bulwark" || Boolean(boss.activeSkills?.bulwark);
  const speedMultiplier = (bulwarkActive ? cfg.bulwark.orbitSpeedMultiplier : 1) * (boss.enraged ? cfg.enrageOrbitSpeedMultiplier : 1);
  const freezeMultiplier = !boss.enraged && boss.freezeTimer > 0 ? 0.35 : 1;
  boss.orbitAngle += cfg.orbitSpeed * speedMultiplier * freezeMultiplier * dt;
  boss.x = GAME_CONFIG.arena.centerX + Math.cos(boss.orbitAngle) * cfg.orbitRadiusX;
  boss.y = GAME_CONFIG.arena.centerY + Math.sin(boss.orbitAngle) * cfg.orbitRadiusY;
  if (boss.enraged) {
    updateParallelColossusSkills(state, boss, dt);
    return;
  }
  if (boss.intentSkill) {
    boss.intentTimer -= dt;
    if (boss.intentTimer <= 0) startColossusSkill(state, boss);
    return;
  }
  if (!boss.activeSkill) {
    boss.skillCooldown -= dt;
    if (boss.skillCooldown <= 0) beginColossusIntent(state, boss);
    return;
  }
  const skillState = { timer: boss.skillTimer, tick: boss.skillTick, summonsRemaining: boss.summonsRemaining, artilleryShotsRemaining: boss.artilleryShotsRemaining, summonRiftsAttackable: boss.summonRiftsAttackable };
  const finished = tickColossusSkill(state, boss, boss.activeSkill, skillState, dt);
  boss.skillTimer = skillState.timer;
  boss.skillTick = skillState.tick;
  boss.summonsRemaining = skillState.summonsRemaining;
  boss.artilleryShotsRemaining = skillState.artilleryShotsRemaining;
  if (finished) finishColossusSkill(boss);
}

function suppressTowerFire(state, boss, skill) {
  const cfg = GAME_CONFIG.sovereign;
  const wasSuppressed = state.tower.fireRateSuppression > 0;
  state.tower.fireRateSuppression = Math.max(state.tower.fireRateSuppression, cfg.rangedSlowDuration);
  if (!wasSuppressed) state.events.push({ type: "sovereignSuppress", enemyId: boss.id, skill, duration: cfg.rangedSlowDuration, multiplier: cfg.rangedSlowMultiplier });
}

function beginSovereignIntent(state, boss) {
  const cfg = GAME_CONFIG.sovereign;
  const skill = cfg.skillOrder[boss.skillSequence % cfg.skillOrder.length];
  boss.skillSequence += 1;
  boss.intentSkill = skill;
  boss.intentTimer = cfg.intentDuration * (boss.enraged ? 0.55 : 1);
  state.events.push({ type: "sovereignIntent", skill, enemyId: boss.id, duration: boss.intentTimer, enraged: boss.enraged });
}

function startSovereignSkill(state, boss) {
  const cfg = GAME_CONFIG.sovereign;
  const skill = boss.intentSkill ?? cfg.skillOrder[boss.skillSequence++ % cfg.skillOrder.length];
  const empoweredSummon = skill === "summon" && boss.healthBar <= cfg.summon.empoweredHealthBar;
  boss.intentSkill = null;
  boss.intentTimer = 0;
  boss.activeSkill = skill;
  boss.skillTimer = empoweredSummon ? cfg.summon.empoweredDuration : cfg[skill].duration;
  boss.skillTick = 0;
  const summonWaves = empoweredSummon ? cfg.summon.empoweredWaves : cfg.summon.waves;
  boss.summonWavesRemaining = skill === "summon" ? summonWaves + Number(boss.enraged) : 0;
  if (skill === "artillery" || skill === "beam") suppressTowerFire(state, boss, skill);
  state.events.push({ type: "sovereignSkill", skill, enemyId: boss.id, duration: boss.skillTimer, enraged: boss.enraged, empowered: empoweredSummon });
}

function finishSovereignSkill(boss) {
  boss.activeSkill = null;
  boss.skillTimer = 0;
  boss.skillTick = 0;
  boss.skillCooldown = GAME_CONFIG.sovereign.skillCooldown * (boss.enraged ? GAME_CONFIG.sovereign.enrageCooldownMultiplier : 1);
}

function fireSovereignArtillery(state, boss) {
  const cfg = GAME_CONFIG.sovereign.artillery;
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const targetX = centerX + (state.rng.next() - 0.5) * 190;
  const targetY = centerY + (state.rng.next() - 0.5) * 90;
  const angle = Math.atan2(targetY - boss.y, targetX - boss.x);
  state.hostileProjectiles.push({
    id: state.nextId++, kind: "sovereignMortar", x: boss.x, y: boss.y + 48,
    vx: Math.cos(angle) * cfg.projectileSpeed, vy: Math.sin(angle) * cfg.projectileSpeed,
    targetX, targetY, radius: cfg.radius, life: cfg.projectileLife,
    damage: boss.damage * cfg.damageMultiplier * (boss.enraged ? GAME_CONFIG.sovereign.enrageDamageMultiplier : 1)
  });
  boss.rangedFlash = 0.32;
  state.events.push({ type: "sovereignArtillery", x: boss.x, y: boss.y, targetX, targetY });
}

function queueSovereignRiftWave(state, boss) {
  const cfg = GAME_CONFIG.sovereign.summon;
  if (boss.summonWavesRemaining <= 0) return;
  const empowered = boss.healthBar <= cfg.empoweredHealthBar;
  const totalWaves = (empowered ? cfg.empoweredWaves : cfg.waves) + Number(boss.enraged);
  const waveIndex = totalWaves - boss.summonWavesRemaining;
  const positions = [
    [155, 260], [355, 315], [605, 315], [805, 260], [480, 425]
  ];
  const count = (empowered ? cfg.empoweredPortalsPerWave : cfg.portalsPerWave) + Number(boss.enraged);
  const eliteCount = empowered ? cfg.elitePerWave + (boss.enraged ? cfg.enragedEliteBonus : 0) : 0;
  const eliteOffset = count > 0 ? waveIndex % count : 0;
  for (let index = 0; index < count; index += 1) {
    const [baseX, baseY] = positions[(index + waveIndex) % positions.length];
    const x = baseX + (state.rng.next() - 0.5) * 48;
    const y = baseY + (state.rng.next() - 0.5) * 36;
    const enemyType = cfg.types[(waveIndex * count + index) % cfg.types.length];
    const elite = empowered && ((index - eliteOffset + count) % count < eliteCount);
    state.summonRifts.push({ id: state.nextId++, bossId: boss.id, enemyType, x, y, life: cfg.telegraphDuration, maxLife: cfg.telegraphDuration, attackable: false, targetId: null, elite });
    state.events.push({ type: "sovereignSummonRift", enemyType, x, y, duration: cfg.telegraphDuration, elite });
  }
  boss.summonWavesRemaining -= 1;
  state.events.push({ type: "sovereignRiftWave", enemyId: boss.id, count, eliteCount, empowered });
}

function updateSovereign(state, boss, dt) {
  const cfg = GAME_CONFIG.sovereign;
  boss.x = cfg.fixedX;
  boss.y = cfg.fixedY;
  boss.entryTimer = Math.max(0, (boss.entryTimer ?? 0) - dt);
  if (boss.entryTimer > 0) return;
  if (boss.intentSkill) {
    boss.intentTimer -= dt;
    if (boss.intentTimer <= 0) startSovereignSkill(state, boss);
    return;
  }
  if (!boss.activeSkill) {
    boss.skillCooldown -= dt;
    if (boss.skillCooldown <= 0) beginSovereignIntent(state, boss);
    return;
  }
  boss.skillTimer -= dt;
  boss.skillTick -= dt;
  if (boss.activeSkill === "artillery" && boss.skillTick <= 0) {
    fireSovereignArtillery(state, boss);
    boss.skillTick += cfg.artillery.interval;
  } else if (boss.activeSkill === "summon" && boss.skillTick <= 0 && boss.summonWavesRemaining > 0) {
    queueSovereignRiftWave(state, boss);
    boss.skillTick += cfg.summon.interval;
  } else if (boss.activeSkill === "beam" && boss.skillTick <= 0) {
    damageTower(state, boss.damage * cfg.beam.damageMultiplier * (boss.enraged ? cfg.enrageDamageMultiplier : 1), true, "sovereignBeam");
    boss.rangedFlash = Math.max(boss.rangedFlash, cfg.beam.tickInterval + 0.08);
    boss.skillTick += cfg.beam.tickInterval;
    state.events.push({ type: "sovereignBeam", x: boss.x, y: boss.y });
  }
  if (boss.skillTimer <= 0 || (boss.activeSkill === "summon" && boss.summonWavesRemaining <= 0)) finishSovereignSkill(boss);
}

function updateHostileProjectiles(state, dt) {
  const { width, height } = GAME_CONFIG.arena;
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const towerRadius = getTowerRadius(state);
  for (const projectile of state.hostileProjectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    const reachedTarget = Math.hypot(projectile.x - projectile.targetX, projectile.y - projectile.targetY) <= projectile.radius + 9;
    const hitTower = Math.hypot(projectile.x - centerX, projectile.y - centerY) <= towerRadius + projectile.radius;
    if (reachedTarget || hitTower) {
      if (hitTower) damageTower(state, projectile.damage, true, projectile.kind === "sovereignMortar" ? "sovereignArtillery" : "colossusArtillery");
      state.events.push({ type: "colossusImpact", x: projectile.x, y: projectile.y, hitTower });
      projectile.life = 0;
    }
  }
  state.hostileProjectiles = state.hostileProjectiles.filter((projectile) => projectile.life > 0 && projectile.x > -80 && projectile.x < width + 80 && projectile.y > -80 && projectile.y < height + 80);
}

function updateSummonRifts(state, dt) {
  for (const rift of state.summonRifts) {
    rift.life -= dt;
    if (rift.life > 0) continue;
    const boss = state.enemies.find((enemy) => enemy.id === rift.bossId && (enemy.type === "colossus" || enemy.type === "sovereign") && enemy.hp > 0);
    if (!boss) continue;
    if (rift.targetId && !state.enemies.some((enemy) => enemy.id === rift.targetId && enemy.hp > 0)) continue;
    const summoned = spawnEnemy(state, rift.enemyType, { x: rift.x, y: rift.y }, { summonedByColossus: true, elite: Boolean(rift.elite) });
    if (rift.targetId) state.enemies = state.enemies.filter((enemy) => enemy.id !== rift.targetId);
    if (summoned) state.events.push({ type: boss.type === "sovereign" ? "sovereignSummon" : "colossusSummon", enemyId: summoned.id, enemyType: rift.enemyType, x: summoned.x, y: summoned.y, elite: summoned.elite, affix: summoned.affix ?? null });
  }
  state.summonRifts = state.summonRifts.filter((rift) => rift.life > 0);
}

function updateEnemies(state, dt) {
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const towerRadius = getTowerRadius(state);
  for (const enemy of state.enemies) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.rangedFlash = Math.max(0, (enemy.rangedFlash ?? 0) - dt);
    enemy.sawCooldown = Math.max(0, enemy.sawCooldown - dt);
    enemy.phaseBreakInvulnerability = Math.max(0, (enemy.phaseBreakInvulnerability ?? 0) - dt);
    enemy.freezeTimer = Math.max(0, (enemy.freezeTimer ?? 0) - dt);
    enemy.markTimer = Math.max(0, (enemy.markTimer ?? 0) - dt);
    enemy.starMarkTimer = Math.max(0, (enemy.starMarkTimer ?? 0) - dt);
    enemy.weakpointTimer = Math.max(0, (enemy.weakpointTimer ?? 0) - dt);
    if (enemy.elite && enemy.affix === "devour") {
      enemy.devourCooldown -= dt;
      if (enemy.devourCooldown <= 0) {
        const cfg = GAME_CONFIG.eliteAffixes.devour;
        const orb = state.coinOrbs
          .filter((item) => !item.collector && !item.expired && Math.hypot(item.x - enemy.x, item.y - enemy.y) <= cfg.radius)
          .sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0];
        if (orb) {
          orb.expired = true;
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * cfg.healFraction);
          state.events.push({ type: "eliteDevour", x: enemy.x, y: enemy.y, value: orb.value });
        }
        enemy.devourCooldown += cfg.interval;
      }
    }
    if ((enemy.burnTimer ?? 0) > 0) {
      enemy.burnTimer = Math.max(0, enemy.burnTimer - dt);
      enemy.burnTickCooldown -= dt;
      if (enemy.burnTickCooldown <= 0) {
        damageEnemy(state, enemy, enemy.burnDamagePerTick, "fire");
        enemy.burnTickCooldown += GAME_CONFIG.elements.fire.burnTick;
      }
    }
    if (enemy.hp <= 0) continue;
    if (enemy.type === "anchor") {
      updateBossAnchor(state, enemy, dt);
      continue;
    }
    if (enemy.type === "colossus") {
      updateColossus(state, enemy, dt);
      continue;
    }
    if (enemy.type === "sovereign") {
      updateSovereign(state, enemy, dt);
      continue;
    }
    const decoy = state.decoys.find((candidate) => candidate.hp > 0);
    const targetX = decoy?.x ?? centerX;
    const targetY = decoy?.y ?? centerY;
    const targetRadius = decoy?.radius ?? towerRadius;
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance > targetRadius + enemy.radius + 3 + (enemy.attackRange ?? 0)) {
      const moveSpeed = enemy.freezeTimer > 0 ? 0 : enemy.speed;
      enemy.x += dx / distance * moveSpeed * dt;
      enemy.y += dy / distance * moveSpeed * dt;
      enemy.attackCooldown = 0;
    } else {
      enemy.attackCooldown -= dt;
      if (enemy.attackCooldown <= 0) {
        const overloadedBoss = enemy.type === "boss" && bossAnchors(state, enemy).some((anchor) => anchor.anchorRole === "overload");
        const attackInterval = GAME_CONFIG.combat.enemyAttackInterval * (overloadedBoss ? GAME_CONFIG.boss.overloadAttackIntervalMultiplier : 1);
        const damage = enemy.damage * GAME_CONFIG.combat.enemyAttackInterval;
        const heavy = isBossEnemy(enemy) || enemy.type === "brute" || enemy.type === "rammer" || enemy.type === "rustBeetle" || enemy.type === "porcelainWarden";
        if (decoy) {
          decoy.hp = Math.max(0, decoy.hp - damage);
          state.events.push({ type: "relicDecoyHit", x: decoy.x, y: decoy.y, damage });
        } else damageTower(state, damage, heavy, enemy.type);
        enemy.attackCooldown += attackInterval;
        if (enemy.attackRange > 0) enemy.rangedFlash = 0.16;
      }
    }
  }
}

function updateSaws(state, dt) {
  const count = state.tower.upgrades.saw;
  if (!count) return;
  while (state.tower.sawRecoveries.length < count) state.tower.sawRecoveries.push(0);
  for (let index = 0; index < count; index += 1) state.tower.sawRecoveries[index] = Math.max(0, state.tower.sawRecoveries[index] - dt);
  const launchedIndexes = new Set(state.launchedSaws.map((saw) => saw.bladeIndex));
  const overdrive = state.tower.upgrades.sawOverdrive;
  state.tower.sawAngle += dt * (1.8 + count * 0.06) * (1 + overdrive * GAME_CONFIG.upgrades.sawOverdrive.speedPerLevel);
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const cfg = GAME_CONFIG.upgrades.saw;
  const damage = cfg.damage * (1 + (count - 1) * cfg.growthDamage) * (1 + overdrive * GAME_CONFIG.upgrades.sawOverdrive.damagePerLevel);
  for (let index = 0; index < count; index += 1) {
    if (launchedIndexes.has(index) || state.tower.sawRecoveries[index] > 0) continue;
    const angle = state.tower.sawAngle + index * Math.PI * 2 / count;
    const radius = cfg.radius * getTowerScale(state);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    for (const enemy of state.enemies) {
      if (enemy.sawCooldown > 0 || enemy.hp <= 0) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) <= enemy.radius + 17) {
        damageEnemy(state, enemy, damage, "saw");
        enemy.sawCooldown = cfg.hitInterval;
      }
    }
  }
}

function finishLaunchedSaw(state, saw) {
  const cfg = GAME_CONFIG.upgrades.sawLaunch;
  const recoveryLevel = state.tower.upgrades.sawRecovery;
  state.tower.sawRecoveries[saw.bladeIndex] = cfg.baseRecovery * (cfg.recoveryMultiplier ** recoveryLevel);
  saw.done = true;
  state.events.push({ type: "sawRecover", bladeIndex: saw.bladeIndex, recovery: state.tower.sawRecoveries[saw.bladeIndex] });
}

function updateLaunchedSaws(state, dt) {
  if (!state.tower.upgrades.sawLaunch) return;
  const cfg = GAME_CONFIG.upgrades.sawLaunch;
  const { width, height, centerX, centerY } = GAME_CONFIG.arena;
  for (const saw of state.launchedSaws) {
    saw.x += saw.vx * dt;
    saw.y += saw.vy * dt;
    saw.life -= dt;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || saw.hitIds.includes(enemy.id)) continue;
      if (Math.hypot(saw.x - enemy.x, saw.y - enemy.y) > cfg.radius + enemy.radius) continue;
      saw.hitIds.push(enemy.id);
      damageEnemy(state, enemy, saw.damage, "launchedSaw");
      const nextTarget = saw.bouncesRemaining > 0
        ? rankTargets(state, state.enemies.filter((candidate) => candidate.hp > 0 && !saw.hitIds.includes(candidate.id) && Math.hypot(candidate.x - saw.x, candidate.y - saw.y) <= cfg.bounceRange))[0]
        : null;
      if (nextTarget) {
        const angle = Math.atan2(nextTarget.y - saw.y, nextTarget.x - saw.x);
        saw.vx = Math.cos(angle) * cfg.projectileSpeed;
        saw.vy = Math.sin(angle) * cfg.projectileSpeed;
        saw.bouncesRemaining -= 1;
        state.events.push({ type: "sawBounce", bladeIndex: saw.bladeIndex, targetId: nextTarget.id, remaining: saw.bouncesRemaining });
      } else finishLaunchedSaw(state, saw);
      break;
    }
    if (!saw.done && (saw.life <= 0 || saw.x < -40 || saw.x > width + 40 || saw.y < -40 || saw.y > height + 40)) finishLaunchedSaw(state, saw);
  }
  state.launchedSaws = state.launchedSaws.filter((saw) => !saw.done);

  state.tower.sawLaunchCooldown = Math.max(0, state.tower.sawLaunchCooldown - dt);
  if (state.tower.sawLaunchCooldown > 0) return;
  const count = state.tower.upgrades.saw;
  const launchedIndexes = new Set(state.launchedSaws.map((saw) => saw.bladeIndex));
  const bladeIndex = Array.from({ length: count }, (_, index) => index)
    .find((index) => !launchedIndexes.has(index) && state.tower.sawRecoveries[index] <= 0);
  if (bladeIndex == null) return;
  const angle = state.tower.sawAngle + bladeIndex * Math.PI * 2 / count;
  const radius = GAME_CONFIG.upgrades.saw.radius * getTowerScale(state);
  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius;
  const target = rankTargets(state, state.enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) <= cfg.range))[0];
  if (!target) return;
  const launchAngle = Math.atan2(target.y - y, target.x - x);
  const sawCfg = GAME_CONFIG.upgrades.saw;
  const damage = sawCfg.damage * (1 + (count - 1) * sawCfg.growthDamage) * cfg.damageMultiplier;
  state.launchedSaws.push({
    id: state.nextId++, bladeIndex, x, y,
    vx: Math.cos(launchAngle) * cfg.projectileSpeed,
    vy: Math.sin(launchAngle) * cfg.projectileSpeed,
    damage, life: cfg.flightLife,
    bouncesRemaining: cfg.baseBounces + state.tower.upgrades.sawRicochet,
    hitIds: [], done: false
  });
  state.tower.sawLaunchCooldown = cfg.launchInterval;
  state.events.push({ type: "sawLaunch", bladeIndex, targetId: target.id });
}

function updateSawGuns(state, dt) {
  const level = state.tower.upgrades.sawGun;
  const count = state.tower.upgrades.saw;
  if (!level || !count || state.tower.upgrades.sawLaunch > 0) return;
  state.tower.sawFireCooldown = Math.max(0, state.tower.sawFireCooldown - dt);
  if (state.tower.sawFireCooldown > 0) return;
  const cfg = GAME_CONFIG.upgrades.sawGun;
  const stats = getTowerStats(state);
  const { x: centerX, y: centerY } = getTowerPosition(state);
  let fired = false;
  for (let index = 0; index < count; index += 1) {
    const sawAngle = state.tower.sawAngle + index * Math.PI * 2 / count;
    const radius = GAME_CONFIG.upgrades.saw.radius * getTowerScale(state);
    const x = centerX + Math.cos(sawAngle) * radius;
    const y = centerY + Math.sin(sawAngle) * radius;
    const target = rankTargets(state, state.enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) <= cfg.range))[0];
    if (!target) continue;
    const angle = Math.atan2(target.y - y, target.x - x);
    state.projectiles.push({
      id: state.nextId++, x, y,
      vx: Math.cos(angle) * cfg.projectileSpeed,
      vy: Math.sin(angle) * cfg.projectileSpeed,
      damage: stats.damage * (cfg.damage + level * cfg.damagePerLevel), radius: 7,
      pierce: 0, life: 1, tier: state.tower.upgrades.ascend, source: "sawGun"
    });
    fired = true;
  }
  if (fired) {
    state.events.push({ type: "sawShoot", level });
    state.tower.sawFireCooldown = 1 / (cfg.fireRate + level * cfg.fireRatePerLevel);
  }
}

function updateProjectiles(state, dt) {
  const { width, height } = GAME_CONFIG.arena;
  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || projectile.hitIds?.has(enemy.id)) continue;
      if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) <= projectile.radius + enemy.radius) {
        projectile.hitIds ??= new Set();
        projectile.hitIds.add(enemy.id);
        const markedMultiplier = enemy.markTimer > 0 ? GAME_CONFIG.drones.huntDamageMultiplier : 1;
        const starMarkMultiplier = (enemy.starMarkTimer ?? 0) > 0 && projectile.source !== "sawGun"
          ? GAME_CONFIG.activeSkillResearch.starfall.markDamageMultiplier
          : 1;
        const bossMultiplier = isBossEnemy(enemy) ? (projectile.bossDamageMultiplier ?? 1) : 1;
        const damage = projectile.damage * markedMultiplier * starMarkMultiplier * bossMultiplier;
        damageEnemy(state, enemy, damage, projectile.element ?? "shot");
        if (projectile.element) applyElementalHit(state, enemy, projectile.element, damage);
        const weakpointLevel = state.tower.upgrades.cannonWeakpoint;
        if (weakpointLevel > 0 && (enemy.elite || isBossEnemy(enemy)) && enemy.hp > 0) {
          const chance = Math.min(0.9, GAME_CONFIG.cannon.siege.weakpointChancePerLevel * weakpointLevel);
          if (state.rng.next() < chance) {
            enemy.weakpointTimer = GAME_CONFIG.cannon.siege.weakpointDuration;
            state.events.push({ type: "cannonWeakpoint", enemyId: enemy.id, x: enemy.x, y: enemy.y, duration: enemy.weakpointTimer });
          }
        }
        if (projectile.mirrorReady && !isBossEnemy(enemy)) {
          const cfg = GAME_CONFIG.relics.mirror;
          const mirrorPotency = relicPotency(state, "mirror");
          const second = state.enemies
            .filter((candidate) => candidate !== enemy && candidate.hp > 0 && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= cfg.refractRange * mirrorPotency)
            .sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y) || a.id - b.id)[0];
          if (second) {
            const angle = Math.atan2(second.y - enemy.y, second.x - enemy.x);
            state.projectiles.push({
              id: state.nextId++, x: enemy.x, y: enemy.y,
              vx: Math.cos(angle) * GAME_CONFIG.tower.projectileSpeed,
              vy: Math.sin(angle) * GAME_CONFIG.tower.projectileSpeed,
              damage: damage * cfg.refractDamageMultiplier * mirrorPotency, radius: Math.max(3, projectile.radius * 0.72),
              pierce: 0, life: 0.7, tier: projectile.tier, mirrorRefraction: true, hitIds: new Set([enemy.id])
            });
            state.events.push({ type: "relicMirror", x1: enemy.x, y1: enemy.y, x2: second.x, y2: second.y });
            if (state.relics.owned.prismArc) {
              const arcCfg = GAME_CONFIG.relics.prismArc;
              const arcPotency = relicPotency(state, "prismArc");
              const arcTargets = state.enemies
                .filter((candidate) => candidate !== enemy && candidate !== second && candidate.hp > 0 && Math.hypot(candidate.x - second.x, candidate.y - second.y) <= arcCfg.chainRange * arcPotency)
                .sort((a, b) => Math.hypot(a.x - second.x, a.y - second.y) - Math.hypot(b.x - second.x, b.y - second.y) || a.id - b.id)
                .slice(0, arcCfg.chainCount + relicUpgradeLevel(state, "prismArc"));
              let from = second;
              arcTargets.forEach((target, index) => {
                damageEnemy(state, target, damage * arcPotency * (arcCfg.chainMultiplier ** (index + 1)), "lightning");
                state.elementFx.push({ element: "lightning", x1: from.x, y1: from.y, x2: target.x, y2: target.y, life: 0.2, maxLife: 0.2 });
                from = target;
              });
              state.events.push({ type: "relicPrismArc", x: second.x, y: second.y, chains: arcTargets.length });
            }
          }
        }
        if (projectile.splitLevel > 0 && !projectile.splitChild) {
          const cfg = GAME_CONFIG.cannon.split;
          const baseAngle = Math.atan2(projectile.vy, projectile.vx);
          for (let index = 0; index < cfg.projectileCount; index += 1) {
            const angle = baseAngle + (index - (cfg.projectileCount - 1) / 2) * 0.32;
            state.projectiles.push({
              id: state.nextId++, x: enemy.x, y: enemy.y,
              vx: Math.cos(angle) * GAME_CONFIG.tower.projectileSpeed * 0.82,
              vy: Math.sin(angle) * GAME_CONFIG.tower.projectileSpeed * 0.82,
              damage: projectile.damage * cfg.damageMultiplier, radius: cfg.radius,
              pierce: 0, bossDamageMultiplier: 1, life: cfg.life, tier: projectile.tier,
              element: projectile.element ?? null, splitChild: true, growthLevel: projectile.growthLevel ?? 0,
              seekRemaining: (projectile.growthLevel ?? 0) * cfg.growthHopsPerLevel,
              hitIds: new Set([enemy.id]), source: "cannonSplit"
            });
          }
          state.events.push({ type: "cannonSplit", x: enemy.x, y: enemy.y, count: cfg.projectileCount });
        }
        if ((projectile.seekRemaining ?? 0) > 0) {
          const cfg = GAME_CONFIG.cannon.split;
          const next = state.enemies
            .filter((candidate) => candidate.hp > 0 && !projectile.hitIds.has(candidate.id) && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= cfg.growthRange)
            .sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y) || a.id - b.id)[0];
          if (next) {
            const angle = Math.atan2(next.y - enemy.y, next.x - enemy.x);
            projectile.vx = Math.cos(angle) * GAME_CONFIG.tower.projectileSpeed * 0.82;
            projectile.vy = Math.sin(angle) * GAME_CONFIG.tower.projectileSpeed * 0.82;
            projectile.seekRemaining -= 1;
            projectile.life = Math.max(projectile.life, cfg.life);
            state.events.push({ type: "cannonSeek", fromId: enemy.id, targetId: next.id, x: enemy.x, y: enemy.y });
            continue;
          }
        }
        if (projectile.pierceEnabled && projectile.pierce > 0) {
          projectile.pierce -= 1;
          continue;
        }
        projectile.life = 0;
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0 && projectile.x > -30 && projectile.x < width + 30 && projectile.y > -30 && projectile.y < height + 30);
}

function getDroneOrbitPosition(state, index) {
  const count = Math.max(1, state.tower.upgrades.drone);
  const angle = state.time * (1.25 + count * 0.08) + index * Math.PI * 2 / count;
  const { x: centerX, y: centerY } = getTowerPosition(state);
  return { x: centerX + Math.cos(angle) * GAME_CONFIG.coins.droneOrbitRadius, y: centerY + Math.sin(angle) * GAME_CONFIG.coins.droneOrbitRadius };
}

export function getDronePosition(state, index) {
  const drone = state.drones[index];
  return drone ? { x: drone.x, y: drone.y } : getDroneOrbitPosition(state, index);
}

function moveDroneTowards(drone, target, speed, dt) {
  const dx = target.x - drone.x;
  const dy = target.y - drone.y;
  const distance = Math.hypot(dx, dy) || 1;
  const travel = Math.min(distance, speed * dt);
  drone.x += dx / distance * travel;
  drone.y += dy / distance * travel;
  drone.angle = Math.atan2(dy, dx);
  return distance;
}

function rankDroneDetonationTargets(state, drone) {
  const priority = (enemy) => enemy.type === "sovereign" ? 0 : enemy.type === "colossus" ? 1 : enemy.type === "boss" ? 2 : enemy.elite ? 3 : 4;
  return state.enemies
    .filter((enemy) => enemy.hp > 0)
    .sort((a, b) => priority(a) - priority(b) || Math.hypot(a.x - drone.x, a.y - drone.y) - Math.hypot(b.x - drone.x, b.y - drone.y) || a.id - b.id);
}

function detonateDrone(state, drone, droneIndex, target) {
  const cfg = GAME_CONFIG.drones.detonate;
  if (state.tower.droneEnergy < cfg.energyCost) return false;
  state.tower.droneEnergy -= cfg.energyCost;
  const damage = getTowerStats(state).damage * cfg.damageMultiplier;
  let hits = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || Math.hypot(enemy.x - drone.x, enemy.y - drone.y) > cfg.radius + enemy.radius) continue;
    damageEnemy(state, enemy, damage, "droneDetonate");
    hits += 1;
  }
  drone.targetId = null;
  drone.recoveryTimer = getDroneDetonateRecovery(state);
  state.events.push({ type: "droneDetonate", x: drone.x, y: drone.y, droneIndex, targetId: target.id, hits, recovery: drone.recoveryTimer });
  return true;
}

function updateDroneGuard(state, dt) {
  const cfg = GAME_CONFIG.drones.guard;
  if (state.tower.droneGuardCooldown > 0) {
    state.tower.droneGuardCooldown = Math.max(0, state.tower.droneGuardCooldown - dt);
    state.tower.droneGuardShield = 0;
    if (state.tower.droneGuardCooldown <= 0) {
      state.tower.droneEnergy = getDroneEnergyMax(state);
      state.events.push({ type: "droneGuardReady" });
    }
    return;
  }
  if (state.tower.droneEnergy <= 0.001) {
    state.tower.droneEnergy = 0;
    state.tower.droneGuardShield = 0;
    state.tower.droneGuardCooldown = getDroneGuardCooldown(state);
    state.events.push({ type: "droneGuardDepleted", cooldown: state.tower.droneGuardCooldown });
    return;
  }
  const used = Math.min(state.tower.droneEnergy, cfg.drainPerSecond * dt);
  state.tower.droneEnergy -= used;
  state.tower.droneGuardShield = Math.min(getDroneGuardShieldMax(state), state.tower.droneGuardShield + used * cfg.shieldPerEnergy);
  if (state.tower.droneEnergy <= 0.001) {
    state.tower.droneEnergy = 0;
    state.tower.droneGuardShield = 0;
    state.tower.droneGuardCooldown = getDroneGuardCooldown(state);
    state.events.push({ type: "droneGuardDepleted", cooldown: state.tower.droneGuardCooldown });
  }
}

function updateDrones(state, dt) {
  const count = state.tower.upgrades.drone;
  while (state.drones.length < count) {
    const index = state.drones.length;
    const position = getDroneOrbitPosition(state, index);
    state.drones.push({ x: position.x, y: position.y, angle: 0, hitCooldown: 0, targetId: null, recoveryTimer: 0 });
  }
  if (state.drones.length > count) state.drones.length = count;
  const cfg = GAME_CONFIG.drones;
  for (const drone of state.drones) {
    const wasRecovering = drone.recoveryTimer > 0;
    drone.recoveryTimer = Math.max(0, (drone.recoveryTimer ?? 0) - dt);
    if (wasRecovering && drone.recoveryTimer <= 0) state.events.push({ type: "droneRecovered", x: drone.x, y: drone.y });
  }
  const detonateMode = state.tower.droneDetonateActive && state.tower.upgrades.droneDetonate > 0;
  const attackMode = !detonateMode && state.tower.droneMode === "attack" && state.tower.upgrades.autoCollect > 0;
  const guardMode = !detonateMode && state.tower.droneMode === "collect" && state.tower.upgrades.droneGuard > 0;
  const guardCooldownWasActive = state.tower.upgrades.droneGuard > 0 && state.tower.droneGuardCooldown > 0;
  if (guardCooldownWasActive) updateDroneGuard(state, dt);
  if (detonateMode && state.tower.droneEnergy < cfg.detonate.energyCost) {
    state.tower.droneDetonateActive = false;
    state.tower.droneMode = "collect";
    state.events.push({ type: "droneDetonateDepleted" });
  } else if (detonateMode) {
    // Self-destruct drones spend a fixed battery charge per launch instead of
    // draining continuously while they travel to their priority target.
  } else if (attackMode) {
    state.tower.droneEnergy = Math.max(0, state.tower.droneEnergy - cfg.attackDrainPerSecond * dt);
    if (state.tower.droneEnergy <= 0) {
      state.tower.droneMode = "collect";
      state.events.push({ type: "droneDepleted" });
    }
  } else if (guardMode && !guardCooldownWasActive) {
    updateDroneGuard(state, dt);
  } else if (!guardCooldownWasActive) {
    state.tower.droneEnergy = Math.min(getDroneEnergyMax(state), state.tower.droneEnergy + cfg.guardRegenPerSecond * dt);
    if (state.tower.upgrades.droneIntercept > 0 && state.tower.interceptCharge < 1) {
      state.tower.interceptRecharge = Math.max(0, state.tower.interceptRecharge - dt);
      if (state.tower.interceptRecharge <= 0) {
        state.tower.interceptCharge = 1;
        state.events.push({ type: "interceptReady" });
      }
    }
  }
  if (state.tower.upgrades.droneGuard > 0 && !guardMode && !state.tower.droneDetonateActive) {
    state.tower.droneGuardShield = Math.max(0, state.tower.droneGuardShield - cfg.guard.shieldDecayPerSecond * dt);
  }
  const damage = getTowerStats(state).damage * cfg.damageMultiplier;
  for (let index = 0; index < state.drones.length; index += 1) {
    const drone = state.drones[index];
    drone.hitCooldown = Math.max(0, drone.hitCooldown - dt);
    if (drone.recoveryTimer > 0) continue;
    if (detonateMode && state.tower.droneDetonateActive) {
      const target = rankDroneDetonationTargets(state, drone)[0];
      if (!target) {
        drone.targetId = null;
        moveDroneTowards(drone, getDroneOrbitPosition(state, index), cfg.returnSpeed, dt);
        continue;
      }
      drone.targetId = target.id;
      const distance = moveDroneTowards(drone, target, cfg.attackSpeed, dt);
      if (distance <= target.radius + cfg.detonate.triggerDistance) detonateDrone(state, drone, index, target);
      continue;
    }
    if (!attackMode) {
      drone.targetId = null;
      moveDroneTowards(drone, getDroneOrbitPosition(state, index), cfg.returnSpeed, dt);
      continue;
    }
    const living = state.enemies.filter((enemy) => enemy.hp > 0);
    const huntTargets = state.tower.upgrades.droneHunt > 0 ? living.filter((enemy) => enemy.elite) : [];
    const lockedAnchor = state.tower.anchorLockTimer > 0 ? living.find((enemy) => enemy.id === state.tower.anchorLockId && enemy.type === "anchor") : null;
    const target = lockedAnchor
      ?? (huntTargets.length
        ? [...huntTargets].sort((a, b) => Number(a.markTimer > 0) - Number(b.markTimer > 0) || Math.hypot(a.x - drone.x, a.y - drone.y) - Math.hypot(b.x - drone.x, b.y - drone.y) || a.id - b.id)[0]
        : rankTargets(state, living)[0]);
    if (!target) {
      drone.targetId = null;
      moveDroneTowards(drone, getDroneOrbitPosition(state, index), cfg.returnSpeed, dt);
      continue;
    }
    drone.targetId = target.id;
    const distance = moveDroneTowards(drone, target, cfg.attackSpeed, dt);
    if (distance <= target.radius + cfg.contactRadius && drone.hitCooldown <= 0) {
      damageEnemy(state, target, damage, "drone");
      state.tower.droneEnergy = Math.max(0, state.tower.droneEnergy - cfg.hitEnergyCost);
      if (state.tower.upgrades.droneHunt > 0 && target.elite) {
        target.markTimer = Math.max(target.markTimer, cfg.huntMarkDuration);
        state.events.push({ type: "eliteMarked", x: target.x, y: target.y, enemyId: target.id });
      }
      drone.hitCooldown = cfg.hitInterval;
      const recoilX = Math.cos(drone.angle) * 16;
      const recoilY = Math.sin(drone.angle) * 16;
      drone.x -= recoilX;
      drone.y -= recoilY;
      state.events.push({ type: "droneHit", x: target.x, y: target.y, droneIndex: index });
      if (state.tower.droneEnergy <= 0) {
        state.tower.droneMode = "collect";
        state.events.push({ type: "droneDepleted" });
      }
    }
  }
}

function beginCoinCollection(orb, collector, droneIndex = 0) {
  if (orb.collector) return false;
  orb.collector = collector;
  orb.droneIndex = droneIndex;
  orb.collectAge = 0;
  orb.collectStartX = orb.renderX ?? orb.x;
  orb.collectStartY = orb.renderY ?? orb.y;
  return true;
}

export function collectCoinAt(state, x, y, clickRadius = GAME_CONFIG.coins.clickRadius) {
  if (state.over) return false;
  let best = null;
  let bestDistance = clickRadius;
  for (const orb of state.coinOrbs) {
    if (orb.collector) continue;
    const distance = Math.hypot((orb.renderX ?? orb.x) - x, (orb.renderY ?? orb.y) - y);
    if (distance <= bestDistance) { best = orb; bestDistance = distance; }
  }
  return best ? beginCoinCollection(best, "manual") : false;
}

function updateCoinOrbs(state, dt) {
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const incomeMultiplier = 1 + state.research.income * GAME_CONFIG.research.bonusPerLevel;
  const droneCount = state.tower.upgrades.drone;
  const guardMode = state.tower.droneMode === "collect";
  if (guardMode && droneCount > 0 && !state.threatSeals?.modifiers?.severedSupply) {
    state.tower.droneCooldown -= dt;
    if (state.tower.droneCooldown <= 0) {
      const orb = state.coinOrbs.find((item) => !item.collector);
      if (orb) {
        const droneIndex = state.nextId % droneCount;
        beginCoinCollection(orb, "drone", droneIndex);
        const scavengeMultiplier = state.tower.upgrades.droneScavenge > 0 ? GAME_CONFIG.drones.scavengeIntervalMultiplier : 1;
        state.tower.droneCooldown += GAME_CONFIG.coins.droneInterval * scavengeMultiplier / droneCount;
      } else state.tower.droneCooldown = 0;
    }
  }
  for (const orb of state.coinOrbs) {
    const inEmber = state.relics.owned.ember && state.emberZones.some((zone) => zone.life > 0 && Math.hypot(orb.x - zone.x, orb.y - zone.y) <= zone.radius);
    orb.age += dt * (inEmber ? 1 / GAME_CONFIG.relics.ember.coinLifetimeMultiplier : 1);
    if (!orb.collector) {
      if (orb.age >= GAME_CONFIG.coins.lifetime) {
        orb.expired = true;
        state.events.push({ type: "coinExpire", x: orb.x, y: orb.y, value: orb.value });
        continue;
      }
      orb.renderX = orb.x;
      orb.renderY = orb.y - 4 - Math.sin(orb.age * 4) * 3;
      continue;
    }
    orb.collectAge += dt;
    const progress = Math.min(1, orb.collectAge / GAME_CONFIG.coins.collectDuration);
    const ease = progress * progress * (3 - 2 * progress);
    const target = orb.collector === "drone" ? getDronePosition(state, orb.droneIndex) : getTowerPosition(state);
    orb.renderX = orb.collectStartX + (target.x - orb.collectStartX) * ease;
    orb.renderY = orb.collectStartY + (target.y - orb.collectStartY) * ease - Math.sin(progress * Math.PI) * 28;
    if (progress >= 1 && !orb.collected) {
      orb.collected = true;
      const scavengeValue = orb.collector === "drone" && state.tower.upgrades.droneScavenge > 0 ? GAME_CONFIG.drones.scavengeValueMultiplier : 1;
      let value = Math.max(1, Math.round(orb.value * incomeMultiplier * scavengeValue));
      const gildedPotency = relicPotency(state, "gilded");
      if (state.relics.owned.gilded && state.rng.next() < Math.min(0.9, GAME_CONFIG.relics.gilded.chance * gildedPotency)) {
        const bonus = Math.max(1, Math.round(value * GAME_CONFIG.relics.gilded.bonusMultiplier * gildedPotency));
        value += bonus;
        state.events.push({ type: "relicGilded", value: bonus });
      }
      state.coins += value;
      if (orb.collector === "drone" && state.tower.droneMode === "collect") state.tower.droneEnergy = Math.min(getDroneEnergyMax(state), state.tower.droneEnergy + GAME_CONFIG.drones.coinEnergy);
      state.events.push({ type: "coin", value });
    }
  }
  state.coinOrbs = state.coinOrbs.filter((orb) => !orb.collected && !orb.expired);
}

function updateTransient(state, dt) {
  state.floaters.forEach((item) => { item.life -= dt; item.y -= 24 * dt; });
  state.floaters = state.floaters.filter((item) => item.life > 0);
  state.particles.forEach((item) => { item.life -= dt; item.x += item.vx * dt; item.y += item.vy * dt; item.vx *= 0.97; item.vy *= 0.97; });
  state.particles = state.particles.filter((item) => item.life > 0);
  state.elementFx.forEach((item) => { item.life -= dt; });
  state.elementFx = state.elementFx.filter((item) => item.life > 0);
}

function spawnEventParticles(state) {
  const newEvents = state.events.slice(state._eventParticleCursor ?? 0);
  state._eventParticleCursor = state.events.length;
  for (const event of newEvents) {
    if (event.type === "cannonSplit") {
      for (let i = 0; i < event.count * 4; i += 1) {
        const angle = state.rng.next() * Math.PI * 2;
        const speed = 42 + state.rng.next() * 58;
        state.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.22 + state.rng.next() * 0.18, maxLife: 0.4, color: "#d5b3ff", size: 1.5 + state.rng.next() * 2 });
      }
      continue;
    }
    if (event.type === "cannonEcho") {
      for (let i = 0; i < 16; i += 1) {
        const angle = state.rng.next() * Math.PI * 2;
        const speed = 55 + state.rng.next() * 100;
        state.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.3 + state.rng.next() * 0.25, maxLife: 0.55, color: "#c89cff", size: 2 + state.rng.next() * 3 });
      }
      continue;
    }
    if (event.type === "cannonStarPiercer") {
      for (let i = 0; i < 24; i += 1) {
        const angle = state.rng.next() * Math.PI * 2;
        const speed = 70 + state.rng.next() * 155;
        const origin = i < 8 ? { x: event.x1, y: event.y1 } : { x: event.x2, y: event.y2 };
        state.particles.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .28 + state.rng.next() * .3, maxLife: .58, color: i % 3 ? "#ffe47c" : "#ffffff", size: 2 + state.rng.next() * 3.5 });
      }
      continue;
    }
    if (event.type === "cannonCascade") {
      for (let i = 0; i < 56; i += 1) {
        const angle = state.rng.next() * Math.PI * 2;
        const speed = 85 + state.rng.next() * 220;
        state.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + state.rng.next() * .45, maxLife: .9, color: i % 5 === 0 ? "#fff1ff" : i % 2 ? "#e285ff" : "#9a4dff", size: 2.5 + state.rng.next() * 5 });
      }
      continue;
    }
    if (event.type !== "kill") continue;
    for (let i = 0; i < (event.elite ? 16 : 9); i += 1) {
      const angle = state.rng.next() * Math.PI * 2;
      const speed = 28 + state.rng.next() * 70;
      state.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.35 + state.rng.next() * 0.35, maxLife: 0.7, color: event.enemyType === "boss" || event.enemyType === "colossus" || event.elite ? "#ffd35f" : "#ff756f", size: 2 + state.rng.next() * 3 });
    }
  }
}

function angleDistance(first, second) {
  return Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));
}

function knockbackEnemies(state, radius, distance, bossMultiplier = 1) {
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const { width, height } = GAME_CONFIG.arena;
  let hits = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    let dx = enemy.x - centerX;
    let dy = enemy.y - centerY;
    let currentDistance = Math.hypot(dx, dy);
    if (currentDistance > radius) continue;
    if (currentDistance < 0.001) {
      const angle = (enemy.id * 2.399963) % (Math.PI * 2);
      dx = Math.cos(angle); dy = Math.sin(angle); currentDistance = 1;
    }
    const scale = isBossEnemy(enemy) ? bossMultiplier : 1;
    const falloff = 0.55 + 0.45 * (1 - currentDistance / radius);
    const push = distance * scale * falloff;
    enemy.x = Math.max(-34, Math.min(width + 34, enemy.x + dx / currentDistance * push));
    enemy.y = Math.max(-34, Math.min(height + 34, enemy.y + dy / currentDistance * push));
    hits += 1;
  }
  return hits;
}

function releaseShieldBurst(state) {
  const skill = state.skills.heal;
  if (!skill.shieldBurstArmed) return false;
  const config = GAME_CONFIG.skills.heal;
  const { x: centerX, y: centerY } = getTowerPosition(state);
  const research = GAME_CONFIG.activeSkillResearch.heal;
  const burstRadius = config.burstRadius * (hasSkillResearchNode(state, "heal", "shardBurst") ? research.burstRadiusMultiplier : 1);
  const damage = getTowerStats(state).damage * config.burstDamageMultiplier * (hasSkillResearchNode(state, "heal", "shardBurst") ? research.burstDamageMultiplier : 1);
  let hits = 0;
  skill.shieldBurstArmed = false;
  skill.burst = config.burstDuration;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || Math.hypot(enemy.x - centerX, enemy.y - centerY) > burstRadius + enemy.radius) continue;
    damageEnemy(state, enemy, damage, "shieldBurst");
    hits += 1;
  }
  const knockbackHits = hasSkillResearchNode(state, "heal", "repulse")
    ? knockbackEnemies(state, burstRadius, research.burstKnockbackDistance, research.bossKnockbackMultiplier)
    : 0;
  state.events.push({ type: "shieldBurst", damage, hits, knockbackHits });
  return true;
}

function releaseOverloadPulse(state, early = false) {
  const config = GAME_CONFIG.skills.overload;
  const research = GAME_CONFIG.activeSkillResearch.overload;
  const skill = state.skills.overload;
  skill.overheated = skill.heat >= config.overheatThreshold;
  const heatRatio = Math.min(1, skill.heat / config.heatCap);
  const knockbackMultiplier = early && hasSkillResearchNode(state, "overload", "pressureValve") ? 1 + heatRatio * research.earlyPulseBonus : 1;
  let damage = 0;
  if (hasSkillResearchNode(state, "overload", "thermalNova")) {
    damage = getTowerStats(state).damage * research.damageMultiplier * (skill.overheated ? research.overheatDamageMultiplier : 1);
    const { x: centerX, y: centerY } = getTowerPosition(state);
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || Math.hypot(enemy.x - centerX, enemy.y - centerY) > config.knockbackRadius + enemy.radius) continue;
      damageEnemy(state, enemy, damage, "overload");
    }
    resolveDeaths(state);
  }
  const hits = knockbackEnemies(state, config.knockbackRadius, config.knockbackDistance * knockbackMultiplier, config.bossKnockbackMultiplier);
  skill.slow = skill.overheated ? config.slowDuration * (hasSkillResearchNode(state, "overload", "coolingVent") ? 0.5 : 1) : 0;
  skill.pulse = config.pulseDuration;
  state.events.push({ type: "overloadRelease", overheated: skill.overheated, heat: skill.heat, hits, early, damage, knockbackMultiplier });
}

export function useSkill(state, key, options = {}) {
  if (state.over) return false;
  const skill = state.skills[key];
  const config = GAME_CONFIG.skills[key];
  if (!skill || !config) return false;
  if (sovereignEntryActive(state) && (key === "overload" || key === "starfall")) return false;
  if (key === "overload" && skill.active > 0) {
    if (counterColossusBulwark(state)) skill.heat = Math.min(config.heatCap, skill.heat + GAME_CONFIG.colossus.counters.bulwarkHeat);
    skill.active = 0;
    releaseOverloadPulse(state, true);
    return true;
  }
  if (skill.cooldown > 0) return false;
  if (key === "heal") {
    const stats = getTowerStats(state);
    const research = GAME_CONFIG.activeSkillResearch.heal;
    const reinforced = hasSkillResearchNode(state, "heal", "reinforcedCore");
    const lowHealthRelease = state.tower.hp / stats.maxHp < research.lowHpThreshold;
    const amount = stats.maxHp * config.fraction * (reinforced ? research.healMultiplier : 1);
    const missing = Math.max(0, stats.maxHp - state.tower.hp);
    const healed = Math.min(missing, amount);
    const shieldCap = stats.maxHp * config.shieldCapFraction;
    const shieldBudget = (amount - healed) * (reinforced ? research.shieldMultiplier : 1);
    const shieldGain = Math.min(Math.max(0, shieldCap - state.tower.shield), shieldBudget);
    if (healed <= 0 && shieldGain <= 0) return false;
    state.tower.hp = Math.min(stats.maxHp, state.tower.hp + healed);
    state.tower.shield += shieldGain;
    skill.shieldBurstArmed = state.tower.shield >= shieldCap - 0.01;
    if (hasSkillResearchNode(state, "heal", "lastStand") && lowHealthRelease) {
      skill.damageReduction = research.damageReductionDuration;
      state.events.push({ type: "healLastStand", duration: skill.damageReduction, reduction: research.damageReduction });
    }
  } else if (key === "overload") {
    skill.active = config.duration * (hasSkillResearchNode(state, "overload", "stabilizer") ? GAME_CONFIG.activeSkillResearch.overload.durationMultiplier : 1);
    skill.heat = 0;
    skill.slow = 0;
    skill.pulse = 0;
    skill.overheated = false;
    if (counterColossusBulwark(state)) skill.heat = Math.min(config.heatCap, GAME_CONFIG.colossus.counters.bulwarkHeat);
  } else if (key === "starfall") {
    const requestedAngle = Number(options.angle);
    if (!Number.isFinite(requestedAngle) || !state.enemies.some((enemy) => enemy.hp > 0)) return false;
    const research = GAME_CONFIG.activeSkillResearch.starfall;
    const angle = Math.atan2(Math.sin(requestedAngle), Math.cos(requestedAngle));
    const coneHalfAngle = getStarfallConeHalfAngle(state);
    const countered = counterColossusBeam(state, angle, coneHalfAngle);
    const damage = getTowerStats(state).damage * config.damageMultiplier;
    const { x: centerX, y: centerY } = getTowerPosition(state);
    const hitTargets = [];
    for (const enemy of state.enemies) {
      const enemyAngle = Math.atan2(enemy.y - centerY, enemy.x - centerX);
      if (enemy.hp <= 0 || angleDistance(enemyAngle, angle) > coneHalfAngle) continue;
      hitTargets.push(enemy);
      damageEnemy(state, enemy, damage, "starfall");
      if (hasSkillResearchNode(state, "starfall", "starMark") && enemy.hp > 0) enemy.starMarkTimer = Math.max(enemy.starMarkTimer ?? 0, research.markDuration);
    }
    if (hasSkillResearchNode(state, "starfall", "counterBurst") && (hitTargets.length >= research.followupMinHits || countered)) {
      const counterTarget = countered ? hitTargets.find((enemy) => enemy.type === "colossus") : null;
      const origin = counterTarget ?? {
        x: hitTargets.reduce((sum, enemy) => sum + enemy.x, 0) / Math.max(1, hitTargets.length),
        y: hitTargets.reduce((sum, enemy) => sum + enemy.y, 0) / Math.max(1, hitTargets.length)
      };
      const followupRadius = research.followupRadius * (hasSkillResearchNode(state, "starfall", "impactField") ? research.followupRadiusMultiplier : 1);
      const followupDamage = getTowerStats(state).damage * research.followupDamageMultiplier * (hasSkillResearchNode(state, "starfall", "impactField") ? research.followupDamageBoost : 1);
      let followupHits = 0;
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || Math.hypot(enemy.x - origin.x, enemy.y - origin.y) > followupRadius + enemy.radius) continue;
        damageEnemy(state, enemy, followupDamage, "starfall");
        if (hasSkillResearchNode(state, "starfall", "starMark") && enemy.hp > 0) enemy.starMarkTimer = Math.max(enemy.starMarkTimer ?? 0, research.markDuration);
        followupHits += 1;
      }
      state.elementFx.push({ element: "starfallFollowup", x: origin.x, y: origin.y, radius: followupRadius, life: research.followupDuration, maxLife: research.followupDuration });
      state.events.push({ type: "starfallFollowup", x: origin.x, y: origin.y, damage: followupDamage, hits: followupHits, countered });
    }
    skill.angle = angle;
    skill.aimAngle = angle;
    skill.aiming = false;
    skill.protocol = "manual";
    skill.active = config.activeDuration;
    resolveDeaths(state);
  } else if (key === "coinVacuum") {
    const research = GAME_CONFIG.activeSkillResearch.coinVacuum;
    const targets = state.coinOrbs.filter((orb) => !orb.expired && !orb.collected).sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
    if (!targets.length) return false;
    const incomeMultiplier = 1 + state.research.income * GAME_CONFIG.research.bonusPerLevel;
    const absorbed = new Set(targets);
    const valueMultiplier = hasSkillResearchNode(state, "coinVacuum", "magnet") ? research.valueMultiplier : 1;
    const value = targets.reduce((sum, orb) => sum + Math.max(1, Math.round(orb.value * incomeMultiplier * valueMultiplier)), 0);
    skill.trails = targets.map((orb) => ({ x: orb.renderX ?? orb.x, y: orb.renderY ?? orb.y }));
    skill.collected = targets.reduce((sum, orb) => sum + (orb.pileCount ?? 1), 0);
    skill.value = value;
    skill.active = config.activeDuration;
    state.coins += value;
    state.coinOrbs = state.coinOrbs.filter((orb) => !absorbed.has(orb));
    if (hasSkillResearchNode(state, "coinVacuum", "cooldownLoop") && skill.collected >= research.cooldownThreshold) skill.cooldownCredit = Math.max(skill.cooldownCredit, research.cooldownReduction);
    if (hasSkillResearchNode(state, "coinVacuum", "surge") && skill.collected >= research.buffThreshold) skill.fireRateBuff = Math.max(skill.fireRateBuff, research.buffDuration);
    if (hasSkillResearchNode(state, "coinVacuum", "overdrive") && skill.collected >= research.damageBuffThreshold) skill.damageBuff = Math.max(skill.damageBuff, research.buffDuration);
    state.events.push({ type: "coinVacuum", count: skill.collected, value, bonusMultiplier: valueMultiplier, cooldownCredit: skill.cooldownCredit, fireRateBuff: skill.fireRateBuff });
  }
  let cooldown = config.cooldown * (key === "heal" ? state.threatSeals?.modifiers?.healCooldownMultiplier ?? 1 : 1);
  if (key !== "coinVacuum" && state.skills.coinVacuum.cooldownCredit > 0) {
    const reduction = state.skills.coinVacuum.cooldownCredit;
    cooldown *= 1 - reduction;
    state.skills.coinVacuum.cooldownCredit = 0;
    state.events.push({ type: "skillCooldownCredit", key, reduction });
  }
  skill.cooldown = cooldown;
  state.events.push({ type: "skill", key, angle: skill.angle });
  return true;
}

export function calculateStardust(state) {
  const base = Math.max(1, Math.floor(state.stats.kills / 25) + state.stats.bossKills * 3);
  return Math.max(1, Math.round(base * (state.threatSeals?.modifiers?.resourceMultiplier ?? 1)));
}

export function calculateRunScore(state) {
  const combat = Math.max(0, Math.floor(state.stats.score));
  const coinBonus = Math.max(0, Math.floor(state.coins)) * GAME_CONFIG.score.coinMultiplier;
  const total = Math.round((combat + coinBonus) * (state.threatSeals?.modifiers?.scoreMultiplier ?? 1));
  return { combat, coinBonus, total };
}

export function calculateAchievementProgress(state) {
  if (!state.threatSeals?.equipped?.length) return 0;
  const base = Math.max(0, state.stats.kills + state.stats.bossKills * 25);
  return Math.round(base * (state.threatSeals?.modifiers?.achievementMultiplier ?? 1));
}

export function updateGame(state, dt = GAME_CONFIG.fixedStep) {
  if (state.over || state.paused || dt <= 0) return state;
  state.events.length = 0;
  state._eventParticleCursor = 0;
  state.time += dt;
  updateThreat(state);
  updateWave(state, dt);
  updateSpawning(state, dt);

  const skillCooldownDt = dt * (state.relics.owned.hourglass ? amplifyMultiplier(GAME_CONFIG.relics.hourglass.cooldownRateMultiplier, relicPotency(state, "hourglass")) : 1);
  for (const skill of Object.values(state.skills)) skill.cooldown = Math.max(0, skill.cooldown - skillCooldownDt);
  state.skills.heal.active = Math.max(0, state.skills.heal.active - dt);
  state.skills.heal.burst = Math.max(0, state.skills.heal.burst - dt);
  state.skills.heal.damageReduction = Math.max(0, (state.skills.heal.damageReduction ?? 0) - dt);
  state.skills.starfall.active = Math.max(0, state.skills.starfall.active - dt);
  state.skills.coinVacuum.active = Math.max(0, state.skills.coinVacuum.active - dt);
  state.skills.coinVacuum.fireRateBuff = Math.max(0, (state.skills.coinVacuum.fireRateBuff ?? 0) - dt);
  state.skills.coinVacuum.damageBuff = Math.max(0, (state.skills.coinVacuum.damageBuff ?? 0) - dt);
  state.relics.phaseBuff = Math.max(0, state.relics.phaseBuff - dt);
  state.tower.fireRateSuppression = Math.max(0, (state.tower.fireRateSuppression ?? 0) - dt);
  state.tower.healthBarTimer = Math.max(0, (state.tower.healthBarTimer ?? 0) - dt);
  state.tower.cannonEchoChainTimer = Math.max(0, (state.tower.cannonEchoChainTimer ?? 0) - dt);
  state.tower.cannonCascadeCooldown = Math.max(0, (state.tower.cannonCascadeCooldown ?? 0) - dt);
  if (state.tower.cannonEchoChainTimer <= 0) state.tower.cannonEchoChain = 0;
  if (state.skills.coinVacuum.active <= 0) state.skills.coinVacuum.trails = [];
  if (state.tower.anchorLockTimer > 0) {
    state.tower.anchorLockTimer = Math.max(0, state.tower.anchorLockTimer - dt);
    const locked = state.enemies.find((enemy) => enemy.id === state.tower.anchorLockId && enemy.type === "anchor" && enemy.hp > 0);
    if (!locked || state.tower.anchorLockTimer <= 0) {
      state.tower.anchorLockId = null;
      state.tower.anchorLockTimer = 0;
    }
  }
  const overloadSkill = state.skills.overload;
  overloadSkill.pulse = Math.max(0, overloadSkill.pulse - dt);
  if (overloadSkill.active > 0) {
    overloadSkill.active = Math.max(0, overloadSkill.active - dt);
    const heatMultiplier = hasSkillResearchNode(state, "overload", "stabilizer") ? GAME_CONFIG.activeSkillResearch.overload.heatGainMultiplier : 1;
    overloadSkill.heat = Math.min(GAME_CONFIG.skills.overload.heatCap, overloadSkill.heat + GAME_CONFIG.skills.overload.passiveHeatPerSecond * heatMultiplier * dt);
    if (overloadSkill.active <= 0) releaseOverloadPulse(state);
  } else {
    overloadSkill.slow = Math.max(0, overloadSkill.slow - dt);
    overloadSkill.heat = Math.max(0, overloadSkill.heat - GAME_CONFIG.skills.overload.coolPerSecond * dt);
    if (overloadSkill.heat < GAME_CONFIG.skills.overload.overheatThreshold * 0.45) overloadSkill.overheated = false;
  }

  const stats = getTowerStats(state);
  const entryCombatLocked = sovereignEntryActive(state);
  // Do not carry cooldown debt across periods without a target. Otherwise a
  // tower that has been idle for a while fires once per simulation frame when
  // an enemy finally enters range.
  state.tower.fireCooldown = Math.max(0, state.tower.fireCooldown - dt);
  if (!entryCombatLocked && state.tower.fireCooldown <= 0 && fireTower(state)) {
    const overloadRateMultiplier = overloadSkill.active > 0
      ? GAME_CONFIG.skills.overload.rateMultiplier
      : overloadSkill.slow > 0 ? GAME_CONFIG.skills.overload.slowRateMultiplier : 1;
    const economyRateMultiplier = state.skills.coinVacuum.fireRateBuff > 0 ? GAME_CONFIG.activeSkillResearch.coinVacuum.fireRateMultiplier : 1;
    state.tower.fireCooldown = 1 / (stats.fireRate * overloadRateMultiplier * economyRateMultiplier);
  }

  updateEnemies(state, dt);
  if (!entryCombatLocked) {
    updateDrones(state, dt);
    updateSaws(state, dt);
    updateLaunchedSaws(state, dt);
    updateSawGuns(state, dt);
    updateProjectiles(state, dt);
    updateHostileProjectiles(state, dt);
    updateRelicDecoys(state, dt);
    updateEmberZones(state, dt);
  }
  resolveDeaths(state);
  resolveWaveClears(state);
  if (!entryCombatLocked) updateSummonRifts(state, dt);
  updateCoinOrbs(state, dt);
  updatePermanentResourceDrops(state, dt);
  updateTransient(state, dt);
  spawnEventParticles(state);

  if (state.tower.hp <= 0) {
    state.over = true;
    state.events.push({ type: "gameOver", stardust: calculateStardust(state), score: calculateRunScore(state) });
  }
  return state;
}

export function snapshotState(state) {
  return {
    time: Number(state.time.toFixed(4)), threat: state.threat, phase: state.phase, coins: state.coins, threatSeals: [...state.threatSeals.equipped], sealResourceCarry: { ...state.threatSeals.resourceCarry }, skillResearch: { ...state.skillResearch },
    towerHp: Number(state.tower.hp.toFixed(4)), towerShield: Number(state.tower.shield.toFixed(4)), droneGuardShield: Number(state.tower.droneGuardShield.toFixed(4)), upgrades: { ...state.tower.upgrades }, siegeTargetId: state.tower.siegeTargetId, siegeStreak: state.tower.siegeStreak, cannonEchoChain: state.tower.cannonEchoChain, cannonEchoChainTimer: Number(state.tower.cannonEchoChainTimer.toFixed(3)), cannonCascadeCooldown: Number((state.tower.cannonCascadeCooldown ?? 0).toFixed(3)), droneMode: state.tower.droneMode, droneDetonateActive: state.tower.droneDetonateActive, droneEnergy: Number(state.tower.droneEnergy.toFixed(3)), droneEnergyMax: getDroneEnergyMax(state), droneGuardCooldown: Number(state.tower.droneGuardCooldown.toFixed(3)), interceptCharge: state.tower.interceptCharge, targetProtocol: state.tower.targetProtocol, anchorLock: [state.tower.anchorLockId, Number(state.tower.anchorLockTimer.toFixed(3))], autoCollectCooldown: Number(state.tower.autoCollectCooldown.toFixed(3)), sawLaunchCooldown: Number(state.tower.sawLaunchCooldown.toFixed(3)), sawRecoveries: state.tower.sawRecoveries.map((value) => Number(value.toFixed(3))),
    drones: state.drones.map((drone) => [Number(drone.x.toFixed(2)), Number(drone.y.toFixed(2)), drone.targetId, Number((drone.recoveryTimer ?? 0).toFixed(3))]),
    launchedSaws: state.launchedSaws.map((saw) => [saw.bladeIndex, Number(saw.x.toFixed(2)), Number(saw.y.toFixed(2)), saw.bouncesRemaining, [...saw.hitIds]]),
    enemies: state.enemies.map((enemy) => [enemy.type, Number(enemy.x.toFixed(2)), Number(enemy.y.toFixed(2)), Number(enemy.hp.toFixed(2)), enemy.elite, enemy.affix ?? null, enemy.bossPhase ?? null, enemy.resistance ?? null, enemy.anchorRole ?? null, enemy.activeSkill ?? null, enemy.unitCount ?? 1, Number((enemy.starMarkTimer ?? 0).toFixed(3))]),
    hostileProjectiles: state.hostileProjectiles.map((projectile) => [projectile.kind, Number(projectile.x.toFixed(2)), Number(projectile.y.toFixed(2)), Number(projectile.life.toFixed(2))]),
    summonRifts: state.summonRifts.map((rift) => [rift.enemyType, Number(rift.x.toFixed(2)), Number(rift.y.toFixed(2)), Number(rift.life.toFixed(2)), rift.attackable, rift.targetId, Boolean(rift.elite)]),
    resourceDrops: state.resourceDrops.map((drop) => [drop.resourceType, drop.value, Number(drop.x.toFixed(2)), Number(drop.y.toFixed(2)), drop.source, drop.threatLevel]),
    relics: { owned: { ...state.relics.owned }, available: [...state.relics.available], disabledRelics: [...state.relics.disabledRelics], discovered: { ...state.relics.discovered }, upgrades: { ...state.relics.upgrades }, registeredSets: { ...state.relics.registeredSets }, lockedChoice: state.relics.lockedChoice, slots: state.relics.slots, picks: state.relics.picks, damageBonus: Number(state.relics.damageBonus.toFixed(3)), rateBonus: Number(state.relics.rateBonus.toFixed(3)), endlessStacks: state.relics.endlessStacks, mirrorShots: state.relics.mirrorShots, wardKills: state.relics.wardKills, phaseBuff: Number(state.relics.phaseBuff.toFixed(3)), choice: state.relicChoice?.choices ?? null },
    decoys: state.decoys.map((decoy) => [Number(decoy.x.toFixed(2)), Number(decoy.y.toFixed(2)), Number(decoy.hp.toFixed(2)), decoy.waveIndex]),
    emberZones: state.emberZones.map((zone) => [Number(zone.x.toFixed(2)), Number(zone.y.toFixed(2)), Number(zone.life.toFixed(2)), Boolean(zone.frostfire)]),
    kills: state.stats.kills, bosses: state.stats.bossKills, score: state.stats.score, permanentResources: [state.stats.echoShards, state.stats.coreFragments], wave: [state.wave.index, state.wave.remaining, state.wave.direction, state.wave.elitePending, [...state.wave.pendingClear]], skills: [Number(state.skills.overload.heat.toFixed(3)), Number(state.skills.overload.slow.toFixed(3)), Number(state.skills.starfall.angle.toFixed(3)), state.skills.starfall.protocol, state.skills.heal.shieldBurstArmed, Number(state.skills.heal.burst.toFixed(3)), Number(state.skills.heal.damageReduction.toFixed(3)), Number(state.skills.coinVacuum.active.toFixed(3)), state.skills.coinVacuum.value, Number(state.skills.coinVacuum.cooldownCredit.toFixed(3)), Number(state.skills.coinVacuum.fireRateBuff.toFixed(3)), Number(state.skills.coinVacuum.damageBuff.toFixed(3))], rng: state.rng.state, over: state.over
  };
}
