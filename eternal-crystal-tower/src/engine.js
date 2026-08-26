import { GAME_CONFIG, TARGET_PROTOCOL_ORDER, UPGRADE_ORDER } from "./config.js";
import { SeededRng } from "./rng.js";

const ASCEND_NAMES = ["晶芽", "晶柱", "晶冠", "万象晶塔"];
const TECH_NAMES = { damage: "淬亮晶矢", rate: "加速咏唱", ascend: "塔阶", saw: "环绕晶刃", sawOverdrive: "疾旋锻刃", sawGun: "晶刃炮膛", sawLaunch: "弹射飞刃", sawRicochet: "折跃棱面", sawRecovery: "快速重铸", drone: "拾荒无人机", autoCollect: "磁吸核心", droneScavenge: "拾荒协议", droneIntercept: "拦截协议", droneHunt: "猎杀协议", frost: "霜棱炮口", fire: "烬火炉心", lightning: "雷鸣天球" };

export function createGameState(seed = 1, research = { damage: 0, health: 0, income: 0 }, relicUnlocks = { ward: true }, relicSlots = GAME_CONFIG.relics.initialSlots) {
  const rng = new SeededRng(seed);
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
    wave: { index: 0, nextAt: GAME_CONFIG.waves.firstAt, warningStarted: false, active: false, remaining: 0, spawnTimer: 0, direction: null, elitePending: false },
    colossusEncounter: { spawned: false, defeated: false },
    tower: {
      hp: 0,
      shield: 0,
      fireCooldown: 0,
      sawFireCooldown: 0,
      sawLaunchCooldown: 0,
      sawRecoveries: [],
      droneCooldown: 0,
      autoCollectCooldown: GAME_CONFIG.coins.towerInterval,
      droneMode: "collect",
      droneEnergy: GAME_CONFIG.drones.energyMax,
      interceptCharge: 0,
      interceptRecharge: 0,
      targetProtocol: "guard",
      anchorLockId: null,
      anchorLockTimer: 0,
      priorityTargetIds: [],
      sawAngle: 0,
      upgrades: { damage: 0, rate: 0, ascend: 0, saw: 0, sawOverdrive: 0, sawGun: 0, sawLaunch: 0, sawRicochet: 0, sawRecovery: 0, drone: 0, autoCollect: 0, droneScavenge: 0, droneIntercept: 0, droneHunt: 0, frost: 0, fire: 0, lightning: 0 }
    },
    skills: {
      heal: { cooldown: 0, active: 0, burst: 0, shieldBurstArmed: false },
      overload: { cooldown: 0, active: 0, heat: 0, slow: 0, pulse: 0, overheated: false },
      starfall: { cooldown: 0, active: 0, angle: 0, aimAngle: 0, aiming: false, protocol: "manual" },
      coinVacuum: { cooldown: 0, active: 0, trails: [], collected: 0, value: 0 }
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
      owned: { decoy: false, lunar: false, mirror: false, ember: false, ward: false, frostbloom: false, stormglass: false, gilded: false, execution: false, hourglass: false },
      available: Object.entries(relicUnlocks).filter(([, unlocked]) => unlocked === true).map(([id]) => id),
      slots: Math.min(GAME_CONFIG.relics.maxSlots, Math.max(GAME_CONFIG.relics.initialSlots, Math.floor(Number(relicSlots) || GAME_CONFIG.relics.initialSlots))),
      picks: 0,
      damageBonus: 0,
      rateBonus: 0,
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
  state.tower.hp = getTowerStats(state).maxHp;
  return state;
}

export function getDayPhase(threat) {
  const { dayWaves, nightWaves } = GAME_CONFIG.threat;
  return ((Math.max(1, threat) - 1) % (dayWaves + nightWaves)) < dayWaves ? "day" : "night";
}

export function getTowerStats(state) {
  const { tower, research } = state;
  const level = tower.upgrades.ascend;
  const cfg = GAME_CONFIG;
  const permanentDamage = 1 + research.damage * cfg.research.bonusPerLevel;
  const permanentHealth = 1 + research.health * cfg.research.bonusPerLevel;
  const relicDamage = 1 + (state.relics?.damageBonus ?? 0);
  const phaseDamage = (state.relics?.phaseBuff ?? 0) > 0 ? cfg.relics.lunar.transitionDamageMultiplier : 1;
  const damage = cfg.tower.damage * (cfg.upgrades.damage.multiplier ** tower.upgrades.damage) * cfg.upgrades.ascend.damage[level] * permanentDamage * relicDamage * phaseDamage;
  const rawRate = cfg.tower.fireRate * (cfg.upgrades.rate.multiplier ** tower.upgrades.rate) * cfg.upgrades.ascend.rate[level];
  const relicRate = (1 + (state.relics?.rateBonus ?? 0)) * ((state.relics?.phaseBuff ?? 0) > 0 ? cfg.relics.lunar.transitionRateMultiplier : 1);
  return {
    damage,
    fireRate: Math.min(cfg.upgrades.rate.cap * 1.5, Math.min(cfg.upgrades.rate.cap, rawRate) * relicRate),
    range: cfg.tower.range + cfg.upgrades.ascend.rangePerLevel * level,
    maxHp: (cfg.tower.maxHp + cfg.upgrades.ascend.hpPerLevel * level) * permanentHealth,
    projectileCount: level >= 3 ? 3 : level >= 2 ? 2 : 1,
    pierce: 0,
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
  if (state.over || state.tower.upgrades.autoCollect < 1 || state.tower.upgrades.drone < 1) return false;
  if (state.tower.droneMode === "collect" && state.tower.droneEnergy < GAME_CONFIG.drones.minAttackEnergy) return false;
  state.tower.droneMode = state.tower.droneMode === "attack" ? "collect" : "attack";
  state.events.push({ type: "droneMode", mode: state.tower.droneMode });
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
  if (state.threat < 8) return roll < 0.2 ? "wisp" : roll < 0.35 ? "runner" : roll < 0.53 ? "crawler" : roll < 0.7 ? "brute" : roll < 0.86 ? "sentinel" : "hexer";
  if (roll < 0.14) return "wisp";
  if (roll < 0.26) return "runner";
  if (roll < 0.4) return "crawler";
  if (roll < 0.55) return "brute";
  if (roll < 0.7) return "sentinel";
  if (roll < 0.84) return "hexer";
  return "rammer";
}

function isBossEnemy(enemy) {
  return enemy?.type === "boss" || enemy?.type === "colossus";
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
  const bossType = type === "boss" || type === "colossus";
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
  if (type === "colossus") state.events.push({ type: "colossusSpawn", enemyId: enemy.id, affix: enemy.colossusAffix, x: enemy.x, y: enemy.y });
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

const MECHANIC_RELIC_IDS = ["ward", "decoy", "lunar", "mirror", "ember", "frostbloom", "stormglass", "gilded", "execution", "hourglass"];
const NUMERIC_RELIC_IDS = ["boost:damage", "boost:rate", "boost:hybrid"];

function shuffledRelicIds(state, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(state.rng.next() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function buildRelicChoices(state) {
  const unlocked = new Set(state.relics.available);
  const pool = MECHANIC_RELIC_IDS.filter((id) => unlocked.has(id));
  const available = shuffledRelicIds(state, pool.filter((id) => !state.relics.owned[id]));
  const choices = available.slice(0, 3);
  const numericAllowed = state.relics.slots > pool.length;
  if (numericAllowed) {
    for (const boost of shuffledRelicIds(state, NUMERIC_RELIC_IDS)) {
      if (choices.length >= 3) break;
      choices.push(boost);
    }
  }
  return choices;
}

export function offerRelicChoice(state, source = "eliteWave") {
  if (state.over) return false;
  if (state.relicChoice) {
    state.relics.rewardQueue.push(source);
    return false;
  }
  const choices = buildRelicChoices(state);
  if (!choices.length || (state.relics.picks >= state.relics.slots && !choices.some((id) => id.startsWith("boost:")))) return false;
  state.relicChoice = { source, choices };
  state.events.push({ type: "relicChoice", source, choices: [...state.relicChoice.choices], picks: state.relics.picks });
  return true;
}

export function chooseRelic(state, id) {
  if (!state.relicChoice || !state.relicChoice.choices.includes(id)) return false;
  if (id.startsWith("boost:")) {
    const cfg = GAME_CONFIG.relics.numeric;
    if (id === "boost:damage") state.relics.damageBonus += cfg.damage;
    else if (id === "boost:rate") state.relics.rateBonus += cfg.rate;
    else {
      state.relics.damageBonus += cfg.hybridDamage;
      state.relics.rateBonus += cfg.hybridRate;
    }
  } else {
    if (state.relics.owned[id] || state.relics.picks >= state.relics.slots) return false;
    state.relics.owned[id] = true;
    state.relics.picks += 1;
  }
  const source = state.relicChoice.source;
  state.relicChoice = null;
  state.events.push({ type: "relicChosen", id, source, picks: state.relics.picks });
  const queued = state.relics.rewardQueue.shift();
  if (queued) offerRelicChoice(state, queued);
  return true;
}
export function findTargets(state, count = 1) {
  const { centerX, centerY } = GAME_CONFIG.arena;
  const range = getTowerStats(state).range;
  const candidates = state.enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - centerX, enemy.y - centerY) <= range);
  return rankTargets(state, candidates).slice(0, count);
}

function rankTargets(state, candidates) {
  const { centerX, centerY } = GAME_CONFIG.arena;
  const towerRadius = GAME_CONFIG.tower.radius + state.tower.upgrades.ascend * 5;
  const distance = (enemy) => Math.hypot(enemy.x - centerX, enemy.y - centerY);
  const lockedPriority = (enemy) => Number(state.tower.anchorLockTimer > 0 && enemy.id === state.tower.anchorLockId);
  const hunterPriority = (enemy) => enemy.type === "colossus" ? 4 : enemy.type === "boss" ? 3 : enemy.elite ? 2 : enemy.type === "hexer" ? 1 : 0;
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

function fireTower(state) {
  const stats = getTowerStats(state);
  const targets = findTargets(state, stats.projectileCount);
  state.tower.priorityTargetIds = targets.map((target) => target.id);
  if (!targets.length) return false;
  const { centerX, centerY } = GAME_CONFIG.arena;
  let mirrorReady = false;
  if (state.relics.owned.mirror) {
    state.relics.mirrorShots += 1;
    if (state.relics.mirrorShots >= GAME_CONFIG.relics.mirror.everyShots) {
      state.relics.mirrorShots = 0;
      mirrorReady = true;
    }
  }
  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const target = targets[targetIndex];
    const angle = Math.atan2(target.y - centerY, target.x - centerX);
    const element = rollProjectileElement(state);
    state.projectiles.push({
      id: state.nextId++, x: centerX, y: centerY,
      vx: Math.cos(angle) * GAME_CONFIG.tower.projectileSpeed,
      vy: Math.sin(angle) * GAME_CONFIG.tower.projectileSpeed,
      damage: stats.damage, radius: 5 + state.tower.upgrades.ascend * 1.5,
      pierce: stats.pierce, life: 1.2, tier: state.tower.upgrades.ascend, element,
      mirrorReady: mirrorReady && targetIndex === 0
    });
  }
  if (state.skills.overload.active > 0) {
    const config = GAME_CONFIG.skills.overload;
    state.skills.overload.heat = Math.min(config.heatCap, state.skills.overload.heat + config.heatPerVolley);
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
  let appliedDamage = damage;
  if (state.relics.owned.execution && enemy.hp / Math.max(1, enemy.maxHp) <= GAME_CONFIG.relics.execution.hpThreshold) {
    appliedDamage *= GAME_CONFIG.relics.execution.damageMultiplier;
  }
  if (enemy.type === "boss") {
    if (bossAnchors(state, enemy).some((anchor) => anchor.anchorRole === "shield")) appliedDamage *= GAME_CONFIG.boss.shieldDamageMultiplier;
    if (source === enemy.resistance) appliedDamage *= GAME_CONFIG.boss.elementDamageMultiplier;
  }
  if (enemy.type === "colossus") {
    if (enemy.colossusAffix === "carapace") appliedDamage *= GAME_CONFIG.colossus.affixes.carapace.passiveDamageMultiplier;
    if ((enemy.exposedTimer ?? 0) > 0) appliedDamage *= GAME_CONFIG.colossus.counters.exposedDamageMultiplier;
    if (enemy.activeSkill === "bulwark" || enemy.activeSkills?.bulwark) appliedDamage *= GAME_CONFIG.colossus.bulwark.damageMultiplier;
  if ((enemy.spawnShield ?? 0) > 0) {
    const absorbed = Math.min(enemy.spawnShield, appliedDamage);
    enemy.spawnShield -= absorbed;
    appliedDamage -= absorbed;
  }
  }
  if ((enemy.affixShield ?? 0) > 0) {
    const absorbed = Math.min(enemy.affixShield, appliedDamage);
    enemy.affixShield -= absorbed;
    appliedDamage -= absorbed;
  }
  enemy.hp -= appliedDamage;
  if (appliedDamage > 0) enemy.lastDamageSource = source;
  enemy.hitFlash = 0.09;
  const color = source === "starfall" ? "#fff1a8" : source === "drone" ? "#ffd36d" : source === "fire" ? "#ff9c5c" : source === "lightning" ? "#d9c5ff" : "#d9faff";
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
  const bossScale = isBossEnemy(enemy) ? cfg.bossEffectMultiplier : 1;
  const lunarScale = state.relics.owned.lunar && state.phase === "night" ? GAME_CONFIG.relics.lunar.nightElementMultiplier : 1;
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
  const chainRange = cfg.chainRange * (stormglass?.rangeMultiplier ?? 1);
  const chainCount = cfg.chainCount + (stormglass?.extraChains ?? 0);
  const chainMultiplier = stormglass?.chainMultiplier ?? cfg.chainMultiplier;
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
  const lunarValue = state.relics.owned.lunar && state.phase === "day" ? GAME_CONFIG.relics.lunar.dayCoinMultiplier : 1;
  const drop = { x: enemy.x, y: enemy.y, renderX: enemy.x, renderY: enemy.y, value: Math.max(1, Math.round(enemy.reward * lunarValue)), pileCount: dropCount, age: 0, collectAge: 0, collector: null, droneIndex: 0 };
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
  const { centerX, centerY } = GAME_CONFIG.arena;
  const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const [vx, vy] = vectors[direction] ?? vectors[0];
  const hpScale = 1 + Math.max(0, state.threat - 1) * 0.15;
  const decoy = {
    id: state.nextId++,
    x: centerX + vx * cfg.distance,
    y: centerY + vy * cfg.distance,
    hp: cfg.hp * hpScale,
    maxHp: cfg.hp * hpScale,
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
  for (const decoy of state.decoys) {
    decoy.age += dt;
    if (decoy.hp <= 0) {
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && Math.hypot(enemy.x - decoy.x, enemy.y - decoy.y) <= cfg.explosionRadius + enemy.radius) {
          damageEnemy(state, enemy, getTowerStats(state).damage * cfg.explosionDamageMultiplier, "explosion");
        }
      }
      decoy.resolved = true;
      state.events.push({ type: "relicDecoyExplode", x: decoy.x, y: decoy.y, radius: cfg.explosionRadius });
      continue;
    }
    const waveEnemiesRemain = state.enemies.some((enemy) => enemy.hp > 0 && enemy.waveIndex === decoy.waveIndex);
    if (!state.wave.active && !waveEnemiesRemain && decoy.age > 0.5) {
      addCoinDrop(state, { x: decoy.x, y: decoy.y, reward: cfg.survivalCoins, unitCount: 1 });
      decoy.resolved = true;
      state.events.push({ type: "relicDecoySurvived", x: decoy.x, y: decoy.y, value: cfg.survivalCoins });
    }
  }
  state.decoys = state.decoys.filter((decoy) => !decoy.resolved);
}

function spawnEmberZone(state, x, y) {
  const cfg = GAME_CONFIG.relics.ember;
  state.emberZones.push({ id: state.nextId++, x, y, radius: cfg.radius, life: cfg.duration, maxLife: cfg.duration, tick: 0 });
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
    const damage = getTowerStats(state).damage * cfg.damageMultiplier;
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && Math.hypot(enemy.x - zone.x, enemy.y - zone.y) <= zone.radius + enemy.radius) damageEnemy(state, enemy, damage, "ember");
    }
  }
  state.emberZones = state.emberZones.filter((zone) => zone.life > 0);
}
export function spawnPermanentResourceDrop(state, resourceType, value = 1, x = GAME_CONFIG.arena.centerX, y = GAME_CONFIG.arena.centerY, metadata = {}) {
  if (resourceType !== "echo" && resourceType !== "core") return null;
  if (value <= 0) return null;
  const dropValue = Math.max(1, Math.floor(value));
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
    if (state.relics.owned.ember && (enemy.lastDamageSource === "fire" || enemy.lastDamageSource === "explosion")) {
      spawnEmberZone(state, enemy.x, enemy.y);
    }
    if (state.relics.owned.frostbloom && (enemy.freezeTimer ?? 0) > 0) {
      const cfg = GAME_CONFIG.relics.frostbloom;
      for (const target of state.enemies) {
        if (target === enemy || target.hp <= 0 || Math.hypot(target.x - enemy.x, target.y - enemy.y) > cfg.radius + target.radius) continue;
        damageEnemy(state, target, getTowerStats(state).damage * cfg.damageMultiplier, "frost");
        if (target.type !== "colossus" || !target.enraged) target.freezeTimer = Math.max(target.freezeTimer ?? 0, cfg.freezeDuration * (isBossEnemy(target) ? GAME_CONFIG.elements.frost.bossEffectMultiplier : 1));
      }
      state.events.push({ type: "relicFrostbloom", x: enemy.x, y: enemy.y, radius: cfg.radius });
    }
    if (state.relics.owned.ward) {
      const cfg = GAME_CONFIG.relics.ward;
      state.relics.wardKills += defeatedUnits;
      while (state.relics.wardKills >= cfg.kills) {
        state.relics.wardKills -= cfg.kills;
        const maxHp = getTowerStats(state).maxHp;
        const before = state.tower.shield;
        state.tower.shield = Math.min(maxHp * cfg.maxShieldFraction, state.tower.shield + maxHp * cfg.shieldFraction);
        if (state.tower.shield > before) state.events.push({ type: "relicWard", value: state.tower.shield - before });
      }
    }
    if (enemy.elite) {
      spawnPermanentResourceDrop(state, "echo", GAME_CONFIG.permanentResources.eliteEcho, enemy.x - 10, enemy.y, { source: "elite" });
      if (enemy.waveElite) offerRelicChoice(state, "eliteWave");
    }
    if (isBossEnemy(enemy)) {
      state.stats.bossKills += 1;
      spawnPermanentResourceDrop(state, "core", enemy.type === "colossus" ? GAME_CONFIG.permanentResources.colossusCore : GAME_CONFIG.permanentResources.bossCore, enemy.x, enemy.y, { source: enemy.type });
      if (enemy.type === "boss") {
        for (const anchor of bossAnchors(state, enemy)) anchor.deadHandled = true;
        offerRelicChoice(state, "boss");
      }
      if (enemy.type === "colossus") {
        state.colossusEncounter.defeated = true;
        state.hostileProjectiles.length = 0;
        state.summonRifts = state.summonRifts.filter((rift) => rift.bossId !== enemy.id);
        state.events.push({ type: "colossusDefeated", x: enemy.x, y: enemy.y });
        offerRelicChoice(state, "colossusDefeat");
      }
    }
    addCoinDrop(state, enemy);
    state.events.push({ type: "kill", enemyType: enemy.type, elite: enemy.elite, units: defeatedUnits, score: killScore, x: enemy.x, y: enemy.y });
    if (enemy.elite && enemy.affix === "split") {
      const cfg = GAME_CONFIG.eliteAffixes.split;
      for (let index = 0; index < cfg.count; index += 1) {
        const angle = index * Math.PI * 2 / cfg.count + state.rng.next() * 0.35;
        spawnEnemy(state, enemy.type, { x: enemy.x + Math.cos(angle) * enemy.radius, y: enemy.y + Math.sin(angle) * enemy.radius }, { splitChild: true });
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
  const nextPhase = getDayPhase(nextThreat);
  if (nextPhase !== state.phase) {
    state.events.push({ type: "phase", phase: nextPhase });
    if (state.relics.owned.lunar) {
      state.relics.phaseBuff = GAME_CONFIG.relics.lunar.transitionDuration;
      state.events.push({ type: "relicPhaseBuff", phase: nextPhase, duration: state.relics.phaseBuff });
    }
  }
  state.phase = nextPhase;
  state.stats.highestThreat = Math.max(state.stats.highestThreat, nextThreat);
  state.events.push({ type: "threat", level: nextThreat });
  if (nextThreat === GAME_CONFIG.colossus.spawnThreat && !state.colossusEncounter.spawned) spawnEnemy(state, "colossus");
  if (nextThreat % GAME_CONFIG.threat.bossEvery === 0) spawnEnemy(state, "boss");
}

function activeColossus(state) {
  return state.enemies.find((enemy) => enemy.type === "colossus" && enemy.hp > 0);
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
    wave.remaining = cfg.baseCount + state.threat * cfg.countPerThreat;
    wave.spawnTimer = 0;
    wave.index += 1;
    wave.nextAt += cfg.interval;
    wave.warningStarted = false;
    wave.elitePending = true;
    state.events.push({ type: "waveStart", index: wave.index, count: wave.remaining, direction: wave.direction });
    spawnRelicDecoy(state, wave.direction, wave.index);
  }
  if (!wave.active) return;
  wave.spawnTimer -= dt;
  while (wave.remaining > 0 && wave.spawnTimer <= 0) {
    const side = state.rng.next() < 0.78 ? wave.direction : null;
    const elite = wave.elitePending;
    const spawned = spawnEnemy(state, chooseEnemyType(state), spawnPosition(state.rng, side), { elite, waveElite: elite, waveIndex: wave.index });
    if (elite && spawned) wave.elitePending = false;
    wave.remaining -= 1;
    wave.spawnTimer += cfg.spawnInterval;
  }
  if (wave.remaining <= 0) {
    wave.active = false;
    wave.direction = null;
    state.events.push({ type: "waveEnd", index: wave.index });
  }
}

function updateSpawning(state, dt) {
  if (activeColossus(state)) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  const pack = Math.min(GAME_CONFIG.threat.maxPack, 1 + Math.floor((state.threat - 1) / GAME_CONFIG.threat.packGrowthEvery));
  for (let index = 0; index < pack; index += 1) spawnEnemy(state);
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
    state.events.push({ type: "droneIntercept", x: GAME_CONFIG.arena.centerX, y: GAME_CONFIG.arena.centerY, enemyType: source });
    return false;
  }
  if (state.skills.heal.shieldBurstArmed) releaseShieldBurst(state);
  const absorbed = Math.min(state.tower.shield, damage);
  state.tower.shield -= absorbed;
  state.tower.hp = Math.max(0, state.tower.hp - (damage - absorbed));
  state.events.push({ type: "towerHit", damage: damage - absorbed, absorbed, heavy, source });
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

function updateHostileProjectiles(state, dt) {
  const { centerX, centerY, width, height } = GAME_CONFIG.arena;
  const towerRadius = GAME_CONFIG.tower.radius + state.tower.upgrades.ascend * 5;
  for (const projectile of state.hostileProjectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    const reachedTarget = Math.hypot(projectile.x - projectile.targetX, projectile.y - projectile.targetY) <= projectile.radius + 9;
    const hitTower = Math.hypot(projectile.x - centerX, projectile.y - centerY) <= towerRadius + projectile.radius;
    if (reachedTarget || hitTower) {
      if (hitTower) damageTower(state, projectile.damage, true, "colossusArtillery");
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
    const boss = state.enemies.find((enemy) => enemy.id === rift.bossId && enemy.type === "colossus" && enemy.hp > 0);
    if (!boss) continue;
    if (rift.targetId && !state.enemies.some((enemy) => enemy.id === rift.targetId && enemy.hp > 0)) continue;
    const summoned = spawnEnemy(state, rift.enemyType, { x: rift.x, y: rift.y }, { summonedByColossus: true });
    if (rift.targetId) state.enemies = state.enemies.filter((enemy) => enemy.id !== rift.targetId);
    if (summoned) state.events.push({ type: "colossusSummon", enemyId: summoned.id, enemyType: rift.enemyType, x: summoned.x, y: summoned.y });
  }
  state.summonRifts = state.summonRifts.filter((rift) => rift.life > 0);
}

function updateEnemies(state, dt) {
  const { centerX, centerY } = GAME_CONFIG.arena;
  const towerRadius = GAME_CONFIG.tower.radius + state.tower.upgrades.ascend * 5;
  for (const enemy of state.enemies) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.rangedFlash = Math.max(0, (enemy.rangedFlash ?? 0) - dt);
    enemy.sawCooldown = Math.max(0, enemy.sawCooldown - dt);
    enemy.phaseBreakInvulnerability = Math.max(0, (enemy.phaseBreakInvulnerability ?? 0) - dt);
    enemy.freezeTimer = Math.max(0, (enemy.freezeTimer ?? 0) - dt);
    enemy.markTimer = Math.max(0, (enemy.markTimer ?? 0) - dt);
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
        const heavy = isBossEnemy(enemy) || enemy.type === "brute" || enemy.type === "rammer";
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
  const { centerX, centerY } = GAME_CONFIG.arena;
  const cfg = GAME_CONFIG.upgrades.saw;
  const damage = cfg.damage * (1 + (count - 1) * cfg.growthDamage) * (1 + overdrive * GAME_CONFIG.upgrades.sawOverdrive.damagePerLevel);
  for (let index = 0; index < count; index += 1) {
    if (launchedIndexes.has(index) || state.tower.sawRecoveries[index] > 0) continue;
    const angle = state.tower.sawAngle + index * Math.PI * 2 / count;
    const x = centerX + Math.cos(angle) * cfg.radius;
    const y = centerY + Math.sin(angle) * cfg.radius;
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
  const x = centerX + Math.cos(angle) * GAME_CONFIG.upgrades.saw.radius;
  const y = centerY + Math.sin(angle) * GAME_CONFIG.upgrades.saw.radius;
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
  state.tower.sawFireCooldown -= dt;
  if (state.tower.sawFireCooldown > 0) return;
  const cfg = GAME_CONFIG.upgrades.sawGun;
  const stats = getTowerStats(state);
  const { centerX, centerY } = GAME_CONFIG.arena;
  let fired = false;
  for (let index = 0; index < count; index += 1) {
    const sawAngle = state.tower.sawAngle + index * Math.PI * 2 / count;
    const x = centerX + Math.cos(sawAngle) * GAME_CONFIG.upgrades.saw.radius;
    const y = centerY + Math.sin(sawAngle) * GAME_CONFIG.upgrades.saw.radius;
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
  if (fired) state.events.push({ type: "sawShoot", level });
  state.tower.sawFireCooldown += 1 / (cfg.fireRate + level * cfg.fireRatePerLevel);
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
        const damage = projectile.damage * markedMultiplier;
        damageEnemy(state, enemy, damage, projectile.element ?? "shot");
        if (projectile.element) applyElementalHit(state, enemy, projectile.element, damage);
        if (projectile.mirrorReady && !isBossEnemy(enemy)) {
          const cfg = GAME_CONFIG.relics.mirror;
          const second = state.enemies
            .filter((candidate) => candidate !== enemy && candidate.hp > 0 && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= cfg.refractRange)
            .sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y) || a.id - b.id)[0];
          if (second) {
            const angle = Math.atan2(second.y - enemy.y, second.x - enemy.x);
            state.projectiles.push({
              id: state.nextId++, x: enemy.x, y: enemy.y,
              vx: Math.cos(angle) * GAME_CONFIG.tower.projectileSpeed,
              vy: Math.sin(angle) * GAME_CONFIG.tower.projectileSpeed,
              damage: damage * cfg.refractDamageMultiplier, radius: Math.max(3, projectile.radius * 0.72),
              pierce: 0, life: 0.7, tier: projectile.tier, mirrorRefraction: true, hitIds: new Set([enemy.id])
            });
            state.events.push({ type: "relicMirror", x1: enemy.x, y1: enemy.y, x2: second.x, y2: second.y });
          }
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
  return {
    x: GAME_CONFIG.arena.centerX + Math.cos(angle) * GAME_CONFIG.coins.droneOrbitRadius,
    y: GAME_CONFIG.arena.centerY + Math.sin(angle) * GAME_CONFIG.coins.droneOrbitRadius
  };
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

function updateDrones(state, dt) {
  const count = state.tower.upgrades.drone;
  while (state.drones.length < count) {
    const index = state.drones.length;
    const position = getDroneOrbitPosition(state, index);
    state.drones.push({ x: position.x, y: position.y, angle: 0, hitCooldown: 0, targetId: null });
  }
  if (state.drones.length > count) state.drones.length = count;
  const cfg = GAME_CONFIG.drones;
  if (state.tower.droneMode === "attack" && state.tower.upgrades.autoCollect > 0) {
    state.tower.droneEnergy = Math.max(0, state.tower.droneEnergy - cfg.attackDrainPerSecond * dt);
    if (state.tower.droneEnergy <= 0) {
      state.tower.droneMode = "collect";
      state.events.push({ type: "droneDepleted" });
    }
  } else {
    state.tower.droneEnergy = Math.min(cfg.energyMax, state.tower.droneEnergy + cfg.guardRegenPerSecond * dt);
    if (state.tower.upgrades.droneIntercept > 0 && state.tower.interceptCharge < 1) {
      state.tower.interceptRecharge = Math.max(0, state.tower.interceptRecharge - dt);
      if (state.tower.interceptRecharge <= 0) {
        state.tower.interceptCharge = 1;
        state.events.push({ type: "interceptReady" });
      }
    }
  }
  const attackMode = state.tower.droneMode === "attack" && state.tower.upgrades.autoCollect > 0;
  const damage = getTowerStats(state).damage * cfg.damageMultiplier;
  for (let index = 0; index < state.drones.length; index += 1) {
    const drone = state.drones[index];
    drone.hitCooldown = Math.max(0, drone.hitCooldown - dt);
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
  const { centerX, centerY } = GAME_CONFIG.arena;
  const incomeMultiplier = 1 + state.research.income * GAME_CONFIG.research.bonusPerLevel;
  const droneCount = state.tower.upgrades.drone;
  const guardMode = state.tower.droneMode === "collect";
  if (guardMode && state.tower.upgrades.autoCollect > 0) {
    state.tower.autoCollectCooldown -= dt;
    if (state.tower.autoCollectCooldown <= 0) {
      const target = state.coinOrbs
        .filter((orb) => !orb.collector && !orb.expired)
        .sort((a, b) => b.age - a.age)[0];
      const collected = target && beginCoinCollection(target, "tower") ? 1 : 0;
      state.tower.autoCollectCooldown += GAME_CONFIG.coins.towerInterval;
      state.events.push({ type: "towerCollectPulse", count: collected });
    }
  }
  if (guardMode && droneCount > 0) {
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
    const target = orb.collector === "drone" ? getDronePosition(state, orb.droneIndex) : { x: centerX, y: centerY };
    orb.renderX = orb.collectStartX + (target.x - orb.collectStartX) * ease;
    orb.renderY = orb.collectStartY + (target.y - orb.collectStartY) * ease - Math.sin(progress * Math.PI) * 28;
    if (progress >= 1 && !orb.collected) {
      orb.collected = true;
      const scavengeValue = orb.collector === "drone" && state.tower.upgrades.droneScavenge > 0 ? GAME_CONFIG.drones.scavengeValueMultiplier : 1;
      let value = Math.max(1, Math.round(orb.value * incomeMultiplier * scavengeValue));
      if (state.relics.owned.gilded && state.rng.next() < GAME_CONFIG.relics.gilded.chance) {
        const bonus = Math.max(1, Math.round(value * GAME_CONFIG.relics.gilded.bonusMultiplier));
        value += bonus;
        state.events.push({ type: "relicGilded", value: bonus });
      }
      state.coins += value;
      if (orb.collector === "drone" && state.tower.droneMode === "collect") state.tower.droneEnergy = Math.min(GAME_CONFIG.drones.energyMax, state.tower.droneEnergy + GAME_CONFIG.drones.coinEnergy);
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

function releaseShieldBurst(state) {
  const skill = state.skills.heal;
  if (!skill.shieldBurstArmed) return false;
  const config = GAME_CONFIG.skills.heal;
  const { centerX, centerY } = GAME_CONFIG.arena;
  const damage = getTowerStats(state).damage * config.burstDamageMultiplier;
  let hits = 0;
  skill.shieldBurstArmed = false;
  skill.burst = config.burstDuration;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || Math.hypot(enemy.x - centerX, enemy.y - centerY) > config.burstRadius + enemy.radius) continue;
    damageEnemy(state, enemy, damage, "shieldBurst");
    hits += 1;
  }
  state.events.push({ type: "shieldBurst", damage, hits });
  return true;
}

function releaseOverloadPulse(state, early = false) {
  const config = GAME_CONFIG.skills.overload;
  const skill = state.skills.overload;
  const { centerX, centerY, width, height } = GAME_CONFIG.arena;
  let hits = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    let dx = enemy.x - centerX;
    let dy = enemy.y - centerY;
    let distance = Math.hypot(dx, dy);
    if (distance > config.knockbackRadius) continue;
    if (distance < 0.001) {
      const angle = (enemy.id * 2.399963) % (Math.PI * 2);
      dx = Math.cos(angle); dy = Math.sin(angle); distance = 1;
    }
    const scale = isBossEnemy(enemy) ? config.bossKnockbackMultiplier : 1;
    const falloff = 0.55 + 0.45 * (1 - distance / config.knockbackRadius);
    const push = config.knockbackDistance * scale * falloff;
    enemy.x = Math.max(-34, Math.min(width + 34, enemy.x + dx / distance * push));
    enemy.y = Math.max(-34, Math.min(height + 34, enemy.y + dy / distance * push));
    hits += 1;
  }
  skill.overheated = skill.heat >= config.overheatThreshold;
  skill.slow = skill.overheated ? config.slowDuration : 0;
  skill.pulse = config.pulseDuration;
  state.events.push({ type: "overloadRelease", overheated: skill.overheated, heat: skill.heat, hits, early });
}

export function useSkill(state, key, options = {}) {
  if (state.over) return false;
  const skill = state.skills[key];
  const config = GAME_CONFIG.skills[key];
  if (!skill || !config) return false;
  if (key === "overload" && skill.active > 0) {
    if (counterColossusBulwark(state)) skill.heat = Math.min(config.heatCap, skill.heat + GAME_CONFIG.colossus.counters.bulwarkHeat);
    skill.active = 0;
    releaseOverloadPulse(state, true);
    return true;
  }
  if (skill.cooldown > 0) return false;
  if (key === "heal") {
    const stats = getTowerStats(state);
    const amount = stats.maxHp * config.fraction;
    const missing = Math.max(0, stats.maxHp - state.tower.hp);
    const healed = Math.min(missing, amount);
    const shieldCap = stats.maxHp * config.shieldCapFraction;
    const shieldGain = Math.min(Math.max(0, shieldCap - state.tower.shield), amount - healed);
    if (healed <= 0 && shieldGain <= 0) return false;
    state.tower.hp = Math.min(stats.maxHp, state.tower.hp + healed);
    state.tower.shield += shieldGain;
    skill.shieldBurstArmed = state.tower.shield >= shieldCap - 0.01;
  } else if (key === "overload") {
    skill.active = config.duration;
    skill.heat = 0;
    skill.slow = 0;
    skill.pulse = 0;
    skill.overheated = false;
    if (counterColossusBulwark(state)) skill.heat = Math.min(config.heatCap, GAME_CONFIG.colossus.counters.bulwarkHeat);
  } else if (key === "starfall") {
    const requestedAngle = Number(options.angle);
    if (!Number.isFinite(requestedAngle) || !state.enemies.some((enemy) => enemy.hp > 0)) return false;
    const angle = Math.atan2(Math.sin(requestedAngle), Math.cos(requestedAngle));
    counterColossusBeam(state, angle, config.coneHalfAngle);
    const damage = getTowerStats(state).damage * config.damageMultiplier;
    const { centerX, centerY } = GAME_CONFIG.arena;
    for (const enemy of state.enemies) {
      const enemyAngle = Math.atan2(enemy.y - centerY, enemy.x - centerX);
      if (angleDistance(enemyAngle, angle) <= config.coneHalfAngle) damageEnemy(state, enemy, damage, "starfall");
    }
    skill.angle = angle;
    skill.aimAngle = angle;
    skill.aiming = false;
    skill.protocol = "manual";
    skill.active = config.activeDuration;
    resolveDeaths(state);
  } else if (key === "coinVacuum") {
    const targets = state.coinOrbs.filter((orb) => !orb.expired && !orb.collected);
    if (!targets.length) return false;
    const incomeMultiplier = 1 + state.research.income * GAME_CONFIG.research.bonusPerLevel;
    const absorbed = new Set(targets);
    const value = targets.reduce((sum, orb) => sum + Math.max(1, Math.round(orb.value * incomeMultiplier)), 0);
    skill.trails = targets.map((orb) => ({ x: orb.renderX ?? orb.x, y: orb.renderY ?? orb.y }));
    skill.collected = targets.reduce((sum, orb) => sum + (orb.pileCount ?? 1), 0);
    skill.value = value;
    skill.active = config.activeDuration;
    state.coins += value;
    state.coinOrbs = state.coinOrbs.filter((orb) => !absorbed.has(orb));
    state.events.push({ type: "coinVacuum", count: skill.collected, value });
  }
  skill.cooldown = config.cooldown;
  state.events.push({ type: "skill", key, angle: skill.angle });
  return true;
}

export function calculateStardust(state) {
  return Math.max(1, Math.floor(state.stats.kills / 25) + state.stats.bossKills * 3);
}

export function calculateRunScore(state) {
  const combat = Math.max(0, Math.floor(state.stats.score));
  const coinBonus = Math.max(0, Math.floor(state.coins)) * GAME_CONFIG.score.coinMultiplier;
  return { combat, coinBonus, total: combat + coinBonus };
}

export function updateGame(state, dt = GAME_CONFIG.fixedStep) {
  if (state.over || state.paused || dt <= 0) return state;
  state.events.length = 0;
  state._eventParticleCursor = 0;
  state.time += dt;
  updateThreat(state);
  updateWave(state, dt);
  updateSpawning(state, dt);

  const skillCooldownDt = dt * (state.relics.owned.hourglass ? GAME_CONFIG.relics.hourglass.cooldownRateMultiplier : 1);
  for (const skill of Object.values(state.skills)) skill.cooldown = Math.max(0, skill.cooldown - skillCooldownDt);
  state.skills.heal.active = Math.max(0, state.skills.heal.active - dt);
  state.skills.heal.burst = Math.max(0, state.skills.heal.burst - dt);
  state.skills.starfall.active = Math.max(0, state.skills.starfall.active - dt);
  state.skills.coinVacuum.active = Math.max(0, state.skills.coinVacuum.active - dt);
  state.relics.phaseBuff = Math.max(0, state.relics.phaseBuff - dt);
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
    overloadSkill.heat = Math.min(GAME_CONFIG.skills.overload.heatCap, overloadSkill.heat + GAME_CONFIG.skills.overload.passiveHeatPerSecond * dt);
    if (overloadSkill.active <= 0) releaseOverloadPulse(state);
  } else {
    overloadSkill.slow = Math.max(0, overloadSkill.slow - dt);
    overloadSkill.heat = Math.max(0, overloadSkill.heat - GAME_CONFIG.skills.overload.coolPerSecond * dt);
    if (overloadSkill.heat < GAME_CONFIG.skills.overload.overheatThreshold * 0.45) overloadSkill.overheated = false;
  }

  const stats = getTowerStats(state);
  state.tower.fireCooldown -= dt;
  if (state.tower.fireCooldown <= 0 && fireTower(state)) {
    const rateMultiplier = overloadSkill.active > 0
      ? GAME_CONFIG.skills.overload.rateMultiplier
      : overloadSkill.slow > 0 ? GAME_CONFIG.skills.overload.slowRateMultiplier : 1;
    state.tower.fireCooldown += 1 / (stats.fireRate * rateMultiplier);
  }

  updateEnemies(state, dt);
  updateDrones(state, dt);
  updateSaws(state, dt);
  updateLaunchedSaws(state, dt);
  updateSawGuns(state, dt);
  updateProjectiles(state, dt);
  updateHostileProjectiles(state, dt);
  updateRelicDecoys(state, dt);
  updateEmberZones(state, dt);
  resolveDeaths(state);
  updateSummonRifts(state, dt);
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
    time: Number(state.time.toFixed(4)), threat: state.threat, phase: state.phase, coins: state.coins,
    towerHp: Number(state.tower.hp.toFixed(4)), towerShield: Number(state.tower.shield.toFixed(4)), upgrades: { ...state.tower.upgrades }, droneMode: state.tower.droneMode, droneEnergy: Number(state.tower.droneEnergy.toFixed(3)), interceptCharge: state.tower.interceptCharge, targetProtocol: state.tower.targetProtocol, anchorLock: [state.tower.anchorLockId, Number(state.tower.anchorLockTimer.toFixed(3))], autoCollectCooldown: Number(state.tower.autoCollectCooldown.toFixed(3)), sawLaunchCooldown: Number(state.tower.sawLaunchCooldown.toFixed(3)), sawRecoveries: state.tower.sawRecoveries.map((value) => Number(value.toFixed(3))),
    drones: state.drones.map((drone) => [Number(drone.x.toFixed(2)), Number(drone.y.toFixed(2)), drone.targetId]),
    launchedSaws: state.launchedSaws.map((saw) => [saw.bladeIndex, Number(saw.x.toFixed(2)), Number(saw.y.toFixed(2)), saw.bouncesRemaining, [...saw.hitIds]]),
    enemies: state.enemies.map((enemy) => [enemy.type, Number(enemy.x.toFixed(2)), Number(enemy.y.toFixed(2)), Number(enemy.hp.toFixed(2)), enemy.elite, enemy.affix ?? null, enemy.bossPhase ?? null, enemy.resistance ?? null, enemy.anchorRole ?? null, enemy.activeSkill ?? null, enemy.unitCount ?? 1]),
    hostileProjectiles: state.hostileProjectiles.map((projectile) => [projectile.kind, Number(projectile.x.toFixed(2)), Number(projectile.y.toFixed(2)), Number(projectile.life.toFixed(2))]),
    summonRifts: state.summonRifts.map((rift) => [rift.enemyType, Number(rift.x.toFixed(2)), Number(rift.y.toFixed(2)), Number(rift.life.toFixed(2)), rift.attackable, rift.targetId]),
    resourceDrops: state.resourceDrops.map((drop) => [drop.resourceType, drop.value, Number(drop.x.toFixed(2)), Number(drop.y.toFixed(2)), drop.source, drop.threatLevel]),
    relics: { owned: { ...state.relics.owned }, available: [...state.relics.available], slots: state.relics.slots, picks: state.relics.picks, damageBonus: Number(state.relics.damageBonus.toFixed(3)), rateBonus: Number(state.relics.rateBonus.toFixed(3)), mirrorShots: state.relics.mirrorShots, wardKills: state.relics.wardKills, phaseBuff: Number(state.relics.phaseBuff.toFixed(3)), choice: state.relicChoice?.choices ?? null },
    decoys: state.decoys.map((decoy) => [Number(decoy.x.toFixed(2)), Number(decoy.y.toFixed(2)), Number(decoy.hp.toFixed(2)), decoy.waveIndex]),
    emberZones: state.emberZones.map((zone) => [Number(zone.x.toFixed(2)), Number(zone.y.toFixed(2)), Number(zone.life.toFixed(2))]),
    kills: state.stats.kills, bosses: state.stats.bossKills, score: state.stats.score, permanentResources: [state.stats.echoShards, state.stats.coreFragments], wave: [state.wave.index, state.wave.remaining, state.wave.direction, state.wave.elitePending], skills: [Number(state.skills.overload.heat.toFixed(3)), Number(state.skills.overload.slow.toFixed(3)), Number(state.skills.starfall.angle.toFixed(3)), state.skills.starfall.protocol, state.skills.heal.shieldBurstArmed, Number(state.skills.heal.burst.toFixed(3)), Number(state.skills.coinVacuum.active.toFixed(3)), state.skills.coinVacuum.value], rng: state.rng.state, over: state.over
  };
}
