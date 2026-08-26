import { GAME_CONFIG, SKILL_ORDER, TECH_ORDER } from "./config.js";
import { calculateRunScore, calculateStardust, chooseRelic, collectCoinAt, collectPermanentResourceAt, createGameState, cycleTargetProtocol, getDroneDetonateRecovery, getDroneEnergyMax, getTechStatus, getTowerStats, getUpgradeCost, lockAnchorAt, offerRelicChoice, purchaseUpgrade, setTargetProtocol, spawnEnemy, spawnPermanentResourceDrop, toggleDroneDetonate, toggleDroneMode, updateGame, useSkill } from "./engine.js";
import { seedFromUrl } from "./rng.js";
import { buyRelicSlot, buyRelicUnlock, buyResearch, defaultSave, grantPermanentResource, loadSave, markBaseRecoverySeen, registerFailure, researchCost, SAVE_KEY, sanitizePlayerName, unlockDoubleSpeed, writeSave } from "./storage.js";
import { fetchLeaderboard, postLeaderboardEntry } from "./leaderboard-api.js";
import { AudioSynth } from "./audio.js";
import { Renderer } from "./renderer.js";

const UPGRADE_META = {
  damage: { icon: "✦", name: "淬亮晶矢", description: "每级伤害 +25%", max: 10 },
  rate: { icon: "⌁", name: "加速咏唱", description: "每级攻速 +15%", max: 8 },
  ascend: { icon: "◇", name: "唤醒塔阶", description: "三元素共鸣后融合万象", max: 3 },
  saw: { icon: "✺", name: "环绕晶刃", description: "增加一枚近身晶刃", max: 5 },
  sawOverdrive: { icon: "◌", name: "疾旋锻刃", description: "专精：提高环速与接触伤害", max: 3 },
  sawGun: { icon: "➶", name: "晶刃炮膛", description: "疾旋分支：保留并强化金色弹幕", max: 3 },
  sawLaunch: { icon: "➤", name: "弹射飞刃", description: "专精：发射晶刃并禁用晶刃弹幕", max: 1 },
  sawRicochet: { icon: "⌁", name: "折跃棱面", description: "飞刃命中后增加一次弹射", max: 3 },
  sawRecovery: { icon: "↻", name: "快速重铸", description: "缩短飞刃返回前的恢复时间", max: 3 },
  drone: { icon: "⌁", name: "拾荒无人机", description: "逐级增加自动拾币无人机", max: 3 },
  autoCollect: { icon: "◎", name: "晶塔磁吸核心", description: "每5秒吸收场上全部遗响碎片与核心残片", max: 1 },
  droneScavenge: { icon: "¤", name: "拾荒协议", description: "快速拾币并使无人机金币 +25%", max: 1 },
  droneIntercept: { icon: "⬡", name: "拦截协议", description: "护航时周期抵挡一次重击", max: 1 },
  droneHunt: { icon: "⌖", name: "猎杀协议", description: "标记精英，使炮弹伤害 +35%", max: 1 },
  droneBattery: { icon: "▣", name: "协议电池扩容", description: "每级无人机电量上限 +25", max: 3 },
  droneDetonate: { icon: "✹", name: "自爆协议", description: "主动开启，优先锁定 Boss 与精英并接近自爆", max: 1 },
  droneDetonateRecovery: { icon: "↻", name: "快速重组", description: "自爆无人机恢复时间 -22%", max: 3 },
  droneGuard: { icon: "⬡", name: "棱镜护盾协议", description: "护航时消耗电力生成护盾，抵挡敌人入侵", max: 1 },
  droneGuardRecovery: { icon: "◌", name: "冷却优化", description: "防御电力耗尽后的冷却时间 -22%", max: 3 },
  frost: { icon: "❄", name: "霜棱炮口", description: "18% 概率冰冻敌人", max: 1 },
  fire: { icon: "♨", name: "烬火炉心", description: "16% 概率附加持续灼烧", max: 1 },
  lightning: { icon: "ϟ", name: "雷鸣天球", description: "14% 概率连锁附近三名敌人", max: 1 }
};
const BRANCH_META = {
  power: { name: "晶塔火力", keys: ["damage", "rate", "ascend"] },
  blade: { name: "环刃工事 · 二选一专精", keys: ["saw", "sawOverdrive", "sawGun", "sawLaunch", "sawRicochet", "sawRecovery"] },
  economy: { name: "无人机协议", keys: ["drone", "droneScavenge", "autoCollect", "droneBattery", "droneIntercept", "droneHunt", "droneDetonate", "droneDetonateRecovery", "droneGuard", "droneGuardRecovery"] },
  element: { name: "元素共鸣", keys: ["frost", "fire", "lightning"] }
};
const SKILL_META = {
  heal: { key: "Q", name: "晶愈", description: "满盾后受击引爆晶片" },
  overload: { key: "W", name: "超载", description: "再按 W 提前释放冲击" },
  starfall: { key: "E", name: "星落", description: "手动选择轰击方向" },
  coinVacuum: { key: "F", name: "金潮归塔", description: "立即吸收全场金币" }
};
const RELIC_META = {
  decoy: { icon: "◈", art: "./assets/generated/relic-decoy-ai.png", name: "诡光诱饵", type: "战术造物", description: "每波开始时在来袭方向生成诱饵。敌人会优先追逐它。", effect: "摧毁：爆炸 · 存活：转化为金币" },
  lunar: { icon: "◐", art: "./assets/generated/relic-lunar-ai.png", name: "月相调律", type: "昼夜回路", description: "白昼提高金币价值，长夜增强冰霜、灼烧与雷链效果。", effect: "昼夜切换时获得 6 秒火力强化" },
  mirror: { icon: "◇", art: "./assets/generated/relic-mirror-ai.png", name: "镜面裂片", type: "晶矢回路", description: "每 5 次普通攻击，下一枚晶矢折射至第二个目标。", effect: "首领作为当前目标时不会折射" },
  ember: { icon: "♨", art: "./assets/generated/relic-ember-ai.png", name: "余烬回收", type: "燃烧回路", description: "灼烧或爆炸击杀会留下伤害区域，持续烧灼经过的敌人。", effect: "代价：余烬区内金币更快消失" },
  ward: { icon: "⬡", art: "./assets/generated/relic-decoy-ai.png", name: "棱镜护佑", type: "防御回路", description: "每击杀 20 名敌人，晶塔获得一层可累积的棱镜护盾。", effect: "护盾最多达到生命上限的 50%" },
  frostbloom: { icon: "❉", art: "./assets/generated/relic-mirror-ai.png", name: "霜葬花冠", type: "冰霜回路", description: "冻结敌人死亡时绽放霜爆，伤害并冻结附近敌人。", effect: "连锁冻结 · 范围 105" },
  stormglass: { icon: "ϟ", art: "./assets/generated/relic-lunar-ai.png", name: "雷脉导体", type: "雷链回路", description: "雷电晶矢的连锁范围扩大，并额外寻找两个目标。", effect: "雷链距离 +20% · 额外 2 跳" },
  gilded: { icon: "¤", art: "./assets/generated/relic-boost-ai.png", name: "拾金脉冲", type: "经济回路", description: "金币回到晶塔时有概率触发共振，额外复制部分价值。", effect: "24% 概率额外获得 75% 金币" },
  execution: { icon: "✥", art: "./assets/generated/relic-ember-ai.png", name: "断罪刻印", type: "猎杀回路", description: "对生命低于 35% 的敌人造成更高伤害，包括首领。", effect: "残血目标伤害 +40%" },
  hourglass: { icon: "⌛", art: "./assets/generated/relic-lunar-ai.png", name: "逆时沙漏", type: "时序回路", description: "战术技能的冷却时间以更快速度恢复。", effect: "Q / W / E / F 冷却恢复 +22%" },
  "boost:damage": { icon: "✦", art: "./assets/generated/relic-boost-ai.png", name: "晶矢增幅", type: "缺口强化", description: "栏位多于已解锁遗物，将富余能量灌注主炮。", effect: "本局攻击力 +8% · 可重复" },
  "boost:rate": { icon: "⌁", art: "./assets/generated/relic-boost-ai.png", name: "咏唱增幅", type: "缺口强化", description: "栏位多于已解锁遗物，以富余能量缩短咏唱。", effect: "本局攻击速度 +6% · 可重复" },
  "boost:hybrid": { icon: "✧", art: "./assets/generated/relic-boost-ai.png", name: "双相增幅", type: "缺口强化", description: "栏位多于已解锁遗物，将富余能量均衡分配。", effect: "本局攻击力 +4% · 攻速 +3%" }
};
const RELIC_SOURCE_TEXT = {
  eliteWave: "怪潮精英已被肃清，选择一项回路继续守望。",
  boss: "腐化首领已经倒下，回收一项战场模块。",
  colossusPhase: "巨兽命核破碎，从暴露的回路中夺取一项模块。",
  colossusDefeat: "虚环吞星兽崩解，选择最后一项战利品。"
};
const ELITE_AFFIX_NAMES = { shield: "护盾", sprint: "狂奔", devour: "吞金", split: "分裂" };
const COLOSSUS_AFFIX_NAMES = { siege: "灾厄炮膛", brood: "裂殖母巢", prism: "噬光棱镜", carapace: "不灭甲壳" };
const COLOSSUS_SKILL_NAMES = { artillery: "陨晶炮击", summon: "裂隙召唤", beam: "噬光射线", bulwark: "环界堡垒" };
const COLOSSUS_COUNTER_HINTS = { artillery: "摧毁炮击锚点，减少炮弹", summon: "切换猎杀协议，让裂隙可攻击", beam: "用星落覆盖巨兽方向，切断射线", bulwark: "堡垒展开后使用超载，可强行破盾" };
const COLOSSUS_COUNTER_RESULTS = { artillery: "炮击锚点崩毁 · 弹幕削减", summon: "猎杀协议接管 · 裂隙实体化", rift: "召唤裂隙已摧毁", beam: "星落截断射线 · 首领弱点暴露", bulwark: "超载击穿堡垒 · 热量激增" };
const ELEMENT_NAMES = { frost: "冰霜", fire: "火焰", lightning: "雷电" };
const ANCHOR_ROLE_NAMES = { shield: "护盾锚点", repair: "修复锚点", summon: "召唤锚点", overload: "过载锚点" };
const TARGET_PROTOCOL_META = {
  guard: { name: "近卫", hint: "优先锁定距离晶塔最近的敌人。" },
  hunter: { name: "猎杀号", hint: "优先首领、精英怪和咒晶怪。" },
  breach: { name: "破阵", hint: "优先预计最快接触晶塔的敌人。" },
  radar: { name: "雷达", hint: "优先锁定拥有远程攻击的单位。" }
};
const RESEARCH_META = {
  damage: { name: "炽亮晶核", description: "永久伤害" },
  health: { name: "不灭晶壳", description: "永久生命" },
  income: { name: "鎏金共鸣", description: "永久金币" }
};

const statusStrip = document.querySelector(".status-strip");
for (const [id, label, value] of [["phaseText", "天象", "白昼"], ["waveText", "怪潮", "01:30"]]) {
  const item = document.createElement("div");
  item.className = "status cycle-status";
  item.innerHTML = `<span>${label}</span><strong id="${id}">${value}</strong>`;
  statusStrip.append(item);
}

const dom = Object.fromEntries([
  "gameCanvas", "healthText", "healthFill", "coinsText", "threatText", "timeText", "phaseText", "waveText", "upgradeList", "damageStat", "rateStat", "rangeStat", "droneEnergyStat",
  "skillList", "seedText", "announcement", "toast", "pauseOverlay", "pauseButton", "muteButton", "speedButton", "objectiveTitle", "objectiveText", "targetProtocolList", "targetProtocolHint",
  "techTreePanel", "openTechTreeButton", "closeTechTreeButton", "techResearchedText", "techAvailableText", "techThreatText", "techCoinsText", "techPanelThreatText",
  "droneModeButton", "droneModeText", "droneModeHint", "droneEnergyFill", "droneProtocolButton", "droneProtocolText", "droneProtocolHint",
  "scoreText", "openLeaderboardButton", "leaderboardModal", "closeLeaderboardButton", "globalLeaderboardList", "globalLeaderboardCount", "globalLeaderboardPodium", "gameOverModal", "resultTime", "resultKills", "resultThreat", "resultStardust", "resultScore", "resultCombatScore", "resultCoinScore",
  "scoreEntryForm", "playerNameInput", "submitScoreButton", "scoreEntryStatus", "leaderboardList", "leaderboardCount", "stardustText", "researchList", "restartButton", "clearSaveButton",
  "loadingScreen", "loadingProgress", "loadingStatus", "loadingPercent", "tutorialGuide", "tutorialTitle", "tutorialText", "tutorialChoices", "tutorialDismiss",
  "openBaseCampButton", "battleEchoShardText", "battleCoreFragmentText", "baseRecoveryModal", "recoveryEventTitle", "recoveryEventText", "recoveryContinueButton",
  "baseCampModal", "closeBaseCampButton", "baseCampEchoShardText", "baseCampCoreFragmentText", "baseCampStardustText", "coreNexusRoom", "researchBayRoom", "nexusPanel", "relicResearchPanel", "relicResearchList", "relicResearchEchoText", "relicResearchCoreText", "relicSlotResearch", "openBaseCampFromGameOver", "resultEchoShards", "resultCoreFragments",
  "relicRunHud", "relicChoiceModal", "relicChoiceTitle", "relicChoiceSource", "relicChoiceSlots", "relicChoiceList"
].map((id) => [id, document.getElementById(id)]));

let save = loadSave();
let runIndex = 0;
const baseSeed = seedFromUrl(location.search);
let state = createGameState(baseSeed, save.research, save.relicUnlocks, save.relicSlots);
const previewMode = new URLSearchParams(location.search).get("preview");
if (previewMode === "wave-warning") state.time = GAME_CONFIG.waves.firstAt - GAME_CONFIG.waves.warning - 0.35;
if (previewMode === "wave") state.time = GAME_CONFIG.waves.firstAt - 0.35;
if (previewMode === "late-wave") {
  state.wave.index = 2;
  state.wave.nextAt = GAME_CONFIG.waves.firstAt + GAME_CONFIG.waves.interval * 2;
  state.time = state.wave.nextAt - 0.35;
}
if (previewMode === "boss") {
  state.wave.index = 4;
  state.wave.nextAt = 450;
  state.time = 404.65;
}
if (previewMode === "performance") {
  state.threat = 20;
  state.phase = "night";
  state.time = 855;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  const types = ["wisp", "runner", "crawler", "brute", "sentinel", "hexer", "rammer"];
  for (let index = 0; index < 420; index += 1) {
    const angle = index * Math.PI * 2 / 420;
    const radius = 245 + index % 5 * 22;
    spawnEnemy(state, types[index % types.length], {
      x: GAME_CONFIG.arena.centerX + Math.cos(angle) * radius,
      y: GAME_CONFIG.arena.centerY + Math.sin(angle) * radius * 0.72
    });
  }
  for (let index = 0; index < GAME_CONFIG.coins.maxOrbs; index += 1) {
    const angle = index * Math.PI * 2 / GAME_CONFIG.coins.maxOrbs;
    const pileCount = 1 + index % 6;
    state.coinOrbs.push({
      x: GAME_CONFIG.arena.centerX + Math.cos(angle) * (165 + index % 3 * 18),
      y: GAME_CONFIG.arena.centerY + Math.sin(angle) * (125 + index % 3 * 14),
      renderX: GAME_CONFIG.arena.centerX + Math.cos(angle) * (165 + index % 3 * 18),
      renderY: GAME_CONFIG.arena.centerY + Math.sin(angle) * (125 + index % 3 * 14),
      value: pileCount * 9, pileCount, age: index % 4, collectAge: 0, collector: null, droneIndex: 0
    });
  }
  state.paused = true;
}
if (previewMode === "tech") {
  state.threat = 9;
  state.phase = "day";
  state.time = 360.2;
  state.wave.index = 4;
  state.wave.nextAt = 450;
  state.coins = 100_000;
  for (let index = 0; index < 5; index += 1) purchaseUpgrade(state, "damage");
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(state, "rate");
  purchaseUpgrade(state, "ascend"); purchaseUpgrade(state, "ascend");
  purchaseUpgrade(state, "saw"); purchaseUpgrade(state, "saw"); purchaseUpgrade(state, "saw");
  purchaseUpgrade(state, "sawOverdrive");
  purchaseUpgrade(state, "sawGun");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
}
if (previewMode === "drones") {
  state.threat = 6;
  state.phase = "day";
  state.time = 225.2;
  state.wave.nextAt = 999;
  state.spawnTimer = 999;
  state.coins = 100_000;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect");
  toggleDroneMode(state);
  spawnEnemy(state, "brute", { x: 710, y: 250 });
  spawnEnemy(state, "sentinel", { x: 720, y: 470 });
  spawnEnemy(state, "crawler", { x: 260, y: 220 });
}
if (previewMode === "coins") {
  state.spawnTimer = 999;
  state.coinOrbs.push(
    { x: 350, y: 280, renderX: 350, renderY: 280, value: 5, age: 0, collectAge: 0, collector: null, droneIndex: 0 },
    { x: 610, y: 300, renderX: 610, renderY: 300, value: 7, age: 0, collectAge: 0, collector: null, droneIndex: 0 }
  );
}
if (previewMode === "resources") {
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  spawnPermanentResourceDrop(state, "echo", 3, 390, 300, { source: "elite" });
  spawnPermanentResourceDrop(state, "core", 1, 580, 315, { source: "boss" });
  state.paused = true;
}
if (previewMode === "basecamp" || previewMode === "relic-research" || previewMode === "recovery") {
  save.baseCamp.unlocked = true;
  save.baseCamp.coreEcho = true;
  save.baseCamp.recoverySeen = previewMode === "basecamp" || previewMode === "relic-research";
  save.resources.echoShards = Math.max(save.resources.echoShards, 42);
  save.resources.coreFragments = Math.max(save.resources.coreFragments, 7);
  save.resources.echoShards = Math.max(save.resources.echoShards, 28);
  save.resources.coreFragments = Math.max(save.resources.coreFragments, 9);
}
if (previewMode === "elements" || previewMode === "element-tech") {
  state.threat = 9;
  state.phase = "day";
  state.time = 360.2;
  state.wave.nextAt = 999;
  state.spawnTimer = 999;
  state.coins = 100_000;
  for (let index = 0; index < 5; index += 1) purchaseUpgrade(state, "damage");
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(state, "rate");
  purchaseUpgrade(state, "ascend"); purchaseUpgrade(state, "ascend");
  purchaseUpgrade(state, "frost"); purchaseUpgrade(state, "fire"); purchaseUpgrade(state, "lightning");
  spawnEnemy(state, "brute", { x: 650, y: 320 });
  spawnEnemy(state, "sentinel", { x: 690, y: 390 });
  spawnEnemy(state, "crawler", { x: 625, y: 420 });
  for (const enemy of state.enemies) { enemy.hp = enemy.maxHp = 100_000; enemy.speed = 0; }
  state.enemies[0].freezeTimer = 999;
  state.enemies[1].burnTimer = 999;
  state.elementFx.push({ element: "lightning", x1: 650, y1: 320, x2: 625, y2: 420, life: 999, maxLife: 999 });
}
if (previewMode === "projectiles") {
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.upgrades.ascend = 2;
  state.tower.upgrades.frost = 1;
  state.tower.upgrades.fire = 1;
  state.tower.upgrades.lightning = 1;
  state.tower.hp = getTowerStats(state).maxHp;
  state.projectiles.push(
    { id: 9001, x: 250, y: 185, vx: 1, vy: 0, damage: 1, radius: 5, pierce: 0, life: 999, tier: 2 },
    { id: 9002, x: 405, y: 185, vx: 1, vy: 0, damage: 1, radius: 7, pierce: 0, life: 999, tier: 2, element: "frost" },
    { id: 9003, x: 575, y: 185, vx: 1, vy: 0, damage: 1, radius: 7, pierce: 0, life: 999, tier: 2, element: "fire" },
    { id: 9004, x: 750, y: 185, vx: 1, vy: 0, damage: 1, radius: 7, pierce: 0, life: 999, tier: 2, element: "lightning" }
  );
  state.paused = true;
}
if (previewMode === "elite-wave") {
  state.threat = 8;
  state.phase = "night";
  state.time = 315.2;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  spawnEnemy(state, "hexer", { x: 690, y: 285 });
  spawnEnemy(state, "rammer", { x: 700, y: 380 });
  spawnEnemy(state, "sentinel", { x: 650, y: 455 }, { elite: true });
  for (const enemy of state.enemies) { enemy.speed = 0; enemy.hp = enemy.maxHp; }
}
if (previewMode === "affixes") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.paused = true; state.threat = 7;
  spawnEnemy(state, "brute", { x: 270, y: 225 }, { elite: true, affix: "shield" });
  spawnEnemy(state, "runner", { x: 690, y: 225 }, { elite: true, affix: "sprint" });
  spawnEnemy(state, "hexer", { x: 270, y: 500 }, { elite: true, affix: "devour" });
  spawnEnemy(state, "sentinel", { x: 690, y: 500 }, { elite: true, affix: "split" });
}
if (previewMode === "boss-mechanics") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.paused = true; state.threat = 10; state.time = 405;
  const boss = spawnEnemy(state, "boss", { x: 775, y: 165 });
  boss.hp = boss.maxHp * 0.36; boss.bossPhase = 2; boss.resistance = "lightning";
}
if (previewMode === "colossus") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = 15; state.time = 630; state.phase = "night";
  const colossus = spawnEnemy(state, "colossus", undefined, { orbitAngle: -0.72, colossusAffix: "siege" });
  colossus.activeSkill = "artillery"; colossus.skillTimer = 3.2; colossus.skillTick = 0; colossus.skillSequence = 1;
  state.tower.upgrades.ascend = 3; state.tower.upgrades.damage = 8; state.tower.upgrades.rate = 5;
  state.tower.hp = getTowerStats(state).maxHp;
  updateGame(state, 0.05);
  state.paused = true;
}
if (previewMode === "colossus-enrage") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = 15; state.time = 630; state.phase = "night";
  const colossus = spawnEnemy(state, "colossus", undefined, { orbitAngle: -0.72, colossusAffix: "prism" });
  colossus.hp = colossus.maxHp * 0.72; colossus.healthBar = 1; colossus.spawnShield = 0; colossus.enraged = true;
  colossus.activeSkills = {
    artillery: { timer: 2.4, tick: .3, summonsRemaining: 0 },
    summon: { timer: 2.1, tick: .4, summonsRemaining: 3 },
    beam: { timer: 1.8, tick: .25, summonsRemaining: 0 }
  };
  colossus.activeSkill = "artillery";
  const shotAngle = Math.atan2(GAME_CONFIG.arena.centerY - colossus.y, GAME_CONFIG.arena.centerX - colossus.x);
  state.hostileProjectiles.push({ id: state.nextId++, kind: "colossusMortar", x: colossus.x - 86, y: colossus.y + 72, vx: Math.cos(shotAngle) * 285, vy: Math.sin(shotAngle) * 285, targetX: GAME_CONFIG.arena.centerX, targetY: GAME_CONFIG.arena.centerY, radius: 11, life: 2, damage: 30 });
  state.summonRifts.push({ id: state.nextId++, bossId: colossus.id, enemyType: "rammer", x: colossus.x - 95, y: colossus.y + 85, life: .22, maxLife: .62 });
  state.tower.upgrades.ascend = 3; state.tower.upgrades.damage = 8; state.tower.upgrades.rate = 5;
  state.tower.hp = getTowerStats(state).maxHp;
  state.paused = true;
}
if (previewMode === "protocols") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = 8;
  spawnEnemy(state, "brute", { x: 580, y: 360 });
  spawnEnemy(state, "runner", { x: 620, y: 360 });
  spawnEnemy(state, "hexer", { x: 750, y: 360 });
  spawnEnemy(state, "sentinel", { x: 700, y: 270 }, { elite: true, affix: "shield" });
  for (const enemy of state.enemies) { enemy.hp = enemy.maxHp = 100_000; enemy.freezeTimer = 999; }
}
if (previewMode === "drone-protocols") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = 8; state.phase = "night"; state.time = 315; state.coins = 100_000; state.tower.fireCooldown = 999;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect"); purchaseUpgrade(state, "droneBattery"); purchaseUpgrade(state, "droneDetonate");
  const boss = spawnEnemy(state, "boss", { x: 730, y: 360 });
  boss.speed = 0; boss.hp = boss.maxHp = 100_000;
}
if (previewMode === "drone-energy") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = 8; state.coins = 100_000;
  purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "droneScavenge"); purchaseUpgrade(state, "autoCollect"); purchaseUpgrade(state, "droneIntercept"); purchaseUpgrade(state, "droneHunt");
  state.tower.droneEnergy = 42; toggleDroneMode(state);
  const elite = spawnEnemy(state, "sentinel", { x: 650, y: 360 }, { elite: true, affix: "sprint" });
  elite.hp = elite.maxHp = 100_000; elite.speed = 0;
  spawnEnemy(state, "rammer", { x: 730, y: 430 }).speed = 0;
  updateGame(state, 0.05);
  state.tower.droneEnergy = 42;
  state.paused = true;
}
if (previewMode === "ultimate") {
  state.threat = 8;
  state.phase = "day";
  state.time = 360.2;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.coins = 100_000;
  for (let index = 0; index < 5; index += 1) purchaseUpgrade(state, "damage");
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(state, "rate");
  purchaseUpgrade(state, "ascend"); purchaseUpgrade(state, "ascend");
  purchaseUpgrade(state, "frost"); purchaseUpgrade(state, "fire"); purchaseUpgrade(state, "lightning");
  purchaseUpgrade(state, "ascend");
}
if (previewMode === "skills") {
  state.threat = 6;
  state.phase = "night";
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.shield = 150;
  state.skills.overload.heat = 96;
  state.skills.overload.slow = 2.8;
  state.skills.overload.pulse = 0.42;
  state.skills.overload.overheated = true;
  state.skills.starfall.angle = 0;
  state.skills.starfall.active = GAME_CONFIG.skills.starfall.activeDuration;
  spawnEnemy(state, "brute", { x: 690, y: 330 });
  spawnEnemy(state, "sentinel", { x: 730, y: 390 });
  spawnEnemy(state, "hexer", { x: 660, y: 430 });
  for (const enemy of state.enemies) enemy.speed = 0;
  state.paused = true;
}
if (previewMode === "skill-risk") {
  state.threat = 6;
  state.time = 225;
  state.phase = "night";
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  state.tower.hp = getTowerStats(state).maxHp;
  state.tower.shield = getTowerStats(state).maxHp * GAME_CONFIG.skills.heal.shieldCapFraction;
  state.skills.heal.shieldBurstArmed = true;
  state.skills.overload.active = 3.5;
  state.skills.overload.cooldown = 22.5;
  state.skills.overload.heat = 58;
  state.tower.targetProtocol = "radar";
  const striker = spawnEnemy(state, "brute", { x: 520, y: 360 });
  const ranged = spawnEnemy(state, "hexer", { x: 480, y: 150 });
  spawnEnemy(state, "brute", { x: 680, y: 340 });
  spawnEnemy(state, "brute", { x: 690, y: 380 });
  striker.speed = 0;
  ranged.speed = 0;
  for (const enemy of state.enemies) enemy.speed = 0;
  state.paused = true;
}
if (previewMode === "leaderboard") {
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.time = 367;
  state.threat = 9;
  state.stats = { kills: 128, bossKills: 2, highestThreat: 9, score: 38_450 };
  state.coins = 237;
  state.tower.hp = 0;
}
let runSettled = false;
let scoreSubmitted = false;
let scoreSubmitting = false;
let currentRunScore = null;
let currentEntryDate = null;
let leaderboardEntries = [];
let leaderboardLoading = true;
let leaderboardError = "";
let lastFrame = performance.now();
let accumulator = 0;
let toastTimer = 0;
let announcementTimer = 0;
let techTreeOpen = false;
let resumeAfterTechTree = false;
let leaderboardModalOpen = false;
let resumeAfterLeaderboard = false;
let baseCampOpen = false;
let baseCampRoom = "nexus";
let resumeAfterBaseCamp = false;
let relicChoiceOpen = false;
let resumeAfterRelicChoice = false;
let relicHudSignature = "";
let recoveryEventStep = 0;
let firstFailureFlow = false;
let starfallAiming = false;
let doubleSpeedActive = previewMode === "speed";
const firstRunTutorial = save.records.totalKills === 0 && !previewMode;
let tutorialStep = 0;
const loadingStartedAt = performance.now();
const renderer = new Renderer(dom.gameCanvas, updateLoadingProgress);
const audio = new AudioSynth(save.settings.muted);

function updateLoadingProgress({ completed = 0, total = 1, failed = 0 } = {}) {
  const percent = Math.round(completed / Math.max(1, total) * 100);
  dom.loadingProgress.style.width = `${percent}%`;
  dom.loadingPercent.textContent = `${percent}%`;
  dom.loadingStatus.textContent = failed > 0
    ? `正在启用备用光谱 · ${completed} / ${total}`
    : `正在唤醒晶塔核心 · ${completed} / ${total}`;
}

async function revealGameWhenReady() {
  const results = await renderer.whenAssetsReady();
  const minimumDelay = Math.max(0, 700 - (performance.now() - loadingStartedAt));
  if (minimumDelay > 0) await new Promise((resolve) => setTimeout(resolve, minimumDelay));
  const failures = results.filter((result) => !result.ok).length;
  updateLoadingProgress({ completed: results.length, total: results.length, failed: failures });
  dom.loadingStatus.textContent = failures > 0 ? "备用渲染已就绪" : "晶塔共鸣完成";
  if (previewMode === "loading") return;
  document.body.classList.remove("is-loading");
  dom.loadingScreen.classList.add("leaving");
  setTimeout(() => { dom.loadingScreen.hidden = true; }, 700);
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function formatNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return Math.floor(value).toLocaleString("zh-CN");
}

function formatScore(value) {
  return Math.max(0, Math.floor(value)).toString().padStart(6, "0");
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatThreat(level) {
  return ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"][level - 1] ?? String(level);
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  toastTimer = 1.7;
}

function announce(message) {
  dom.announcement.textContent = message;
  dom.announcement.classList.add("show");
  announcementTimer = 2.3;
}

function switchTargetProtocol(protocol, shouldAnnounce = true) {
  if (!setTargetProtocol(state, protocol)) return false;
  if (shouldAnnounce) announce(`目标协议 · ${TARGET_PROTOCOL_META[protocol].name}`);
  updateUi();
  return true;
}

function cycleProtocol() {
  if (!cycleTargetProtocol(state)) return;
  announce(`目标协议 · ${TARGET_PROTOCOL_META[state.tower.targetProtocol].name}`);
  updateUi();
}

function clearTutorialHighlights() {
  for (const node of dom.upgradeList.querySelectorAll(".tutorial-focus")) node.classList.remove("tutorial-focus");
}

function showFirstRunTutorial(step, force = false) {
  if ((!firstRunTutorial && !force) || step <= tutorialStep) return;
  tutorialStep = step;
  clearTutorialHighlights();
  dom.tutorialGuide.classList.remove("hidden", "compare");
  dom.tutorialChoices.replaceChildren();
  if (step === 1) {
    dom.tutorialTitle.textContent = "战利品已经掉落";
    dom.tutorialText.textContent = "鼠标滑过战场上的发光金币，把它送回晶塔。未拾取的金币会在 10 秒后消失。";
    dom.tutorialDismiss.textContent = "我看见了";
  } else if (step === 2) {
    setTechTreeOpen(true);
    dom.tutorialTitle.textContent = "第一笔金币已到手";
    dom.tutorialText.textContent = "继续拾取并攒够 20 金币。“淬亮晶矢”是所有路线的起点：提高基础伤害，并解锁晶刃与无人机科技。";
    dom.tutorialDismiss.textContent = "稍后研究";
    dom.upgradeList.querySelector('[data-upgrade="damage"]')?.classList.add("tutorial-focus");
  } else if (step === 3) {
    setTechTreeOpen(true);
    dom.tutorialGuide.classList.add("compare");
    dom.tutorialTitle.textContent = "威胁 II · 选择第一条防线";
    dom.tutorialText.textContent = "两条路线可以并行研究；先选哪条，取决于你现在更缺近身火力还是金币回收。";
    dom.tutorialChoices.innerHTML = `<div class="tutorial-choice blade"><strong>✺ 晶刃 · 近身防御</strong><span>环绕晶塔切割靠近的敌人，后续可升级晶刃炮膛补充火力。</span></div><div class="tutorial-choice drone"><strong>⌁ 无人机 · 经济自动化</strong><span>护航时自动回收金币，后续可切换攻击模式并发展战术协议。</span></div>`;
    dom.tutorialDismiss.textContent = "开始选择";
    dom.upgradeList.querySelector('[data-upgrade="saw"]')?.classList.add("tutorial-focus");
    dom.upgradeList.querySelector('[data-upgrade="drone"]')?.classList.add("tutorial-focus");
  } else if (step === 4) {
    dom.tutorialTitle.textContent = "威胁 Ⅹ · 时流加速解锁";
    dom.tutorialText.textContent = "你已击败威胁 Ⅹ 首领，永久解锁 2× 时流。点击右上角的 1× / 2× 按钮，或按 X 切换战斗速度。";
    dom.tutorialDismiss.textContent = "我知道了";
  }
}

function createUpgradeUi() {
  dom.upgradeList.replaceChildren();
  for (const [branchKey, branch] of Object.entries(BRANCH_META)) {
    const section = document.createElement("section");
    section.className = `tech-branch ${branchKey}`;
    section.innerHTML = `<h3>${branch.name}</h3>`;
    for (const key of branch.keys) {
      if (branchKey === "blade" && (key === "sawOverdrive" || key === "sawLaunch")) {
        const route = document.createElement("div");
        route.className = `blade-route-label ${key === "sawOverdrive" ? "orbit" : "launch"}`;
        route.dataset.route = key === "sawOverdrive" ? "orbit" : "launch";
        route.innerHTML = key === "sawOverdrive"
          ? `<strong>路线 A · 疾旋炮刃</strong><span>持续环绕 · 加速增伤 · 保留弹幕</span>`
          : `<strong>路线 B · 弹射飞刃</strong><span>离塔弹射 · 恢复重铸 · 禁用弹幕</span>`;
        section.append(route);
      } else if (branchKey === "economy" && (key === "droneDetonate" || key === "droneGuard")) {
        const route = document.createElement("div");
        const detonateRoute = key === "droneDetonate";
        route.className = `blade-route-label ${detonateRoute ? "detonate" : "guard"}`;
        route.dataset.route = detonateRoute ? "detonate" : "guard";
        route.innerHTML = detonateRoute
          ? `<strong>路线 A · 自爆猎杀</strong><span>主动开启 · 优先 Boss / 精英 · 接近自爆</span>`
          : `<strong>路线 B · 防御护盾</strong><span>护航耗电 · 自动护盾 · 耗尽冷却</span>`;
        section.append(route);
      }
      const index = TECH_ORDER.indexOf(key);
      const meta = UPGRADE_META[key];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "upgrade-card tech-node";
      button.dataset.upgrade = key;
      button.innerHTML = `<span class="upgrade-icon">${meta.icon}</span><strong><span>${index + 1}. ${meta.name}</span><em></em></strong><p>${meta.description}</p><small class="tech-gate"></small><span class="level-pips"></span>`;
      button.addEventListener("click", () => buyUpgrade(key));
      section.append(button);
    }
    dom.upgradeList.append(section);
  }
}

function setTechTreeOpen(open, restoreFocus = false) {
  const nextOpen = Boolean(open) && !state.over;
  if (nextOpen && starfallAiming) cancelStarfallAim(false);
  if (nextOpen && !techTreeOpen) {
    resumeAfterTechTree = !state.paused;
    state.paused = true;
  } else if (!nextOpen && techTreeOpen) {
    if (resumeAfterTechTree && !state.over) state.paused = false;
    resumeAfterTechTree = false;
  }
  techTreeOpen = nextOpen;
  dom.techTreePanel.classList.toggle("hidden", !techTreeOpen);
  dom.openTechTreeButton.setAttribute("aria-expanded", String(techTreeOpen));
  dom.pauseOverlay.classList.toggle("hidden", techTreeOpen || !state.paused);
  if (techTreeOpen) dom.closeTechTreeButton.focus({ preventScroll: true });
  else if (restoreFocus) dom.openTechTreeButton.focus({ preventScroll: true });
  updateUi();
}

function setLeaderboardOpen(open, restoreFocus = false) {
  const nextOpen = Boolean(open);
  if (nextOpen && starfallAiming) cancelStarfallAim(false);
  if (nextOpen && !leaderboardModalOpen) {
    resumeAfterLeaderboard = !state.paused && !state.over;
    state.paused = true;
    leaderboardModalOpen = true;
    dom.leaderboardModal.classList.remove("hidden");
    dom.openLeaderboardButton.setAttribute("aria-expanded", "true");
    dom.pauseOverlay.classList.add("hidden");
    refreshLeaderboard();
    dom.closeLeaderboardButton.focus({ preventScroll: true });
  } else if (!nextOpen && leaderboardModalOpen) {
    leaderboardModalOpen = false;
    dom.leaderboardModal.classList.add("hidden");
    dom.openLeaderboardButton.setAttribute("aria-expanded", "false");
    if (resumeAfterLeaderboard && !state.over && !techTreeOpen) state.paused = false;
    resumeAfterLeaderboard = false;
    dom.pauseOverlay.classList.toggle("hidden", !state.paused || techTreeOpen);
    if (restoreFocus) dom.openLeaderboardButton.focus({ preventScroll: true });
    updateUi();
  }
}

function updatePermanentResourceUi() {
  const echo = formatNumber(save.resources.echoShards);
  const core = formatNumber(save.resources.coreFragments);
  dom.battleEchoShardText.textContent = echo;
  dom.battleCoreFragmentText.textContent = core;
  dom.baseCampEchoShardText.textContent = echo;
  dom.baseCampCoreFragmentText.textContent = core;
  dom.baseCampStardustText.textContent = formatNumber(save.stardust);
  dom.relicResearchEchoText.textContent = echo;
  dom.relicResearchCoreText.textContent = core;
  dom.openBaseCampButton.classList.toggle("hidden", !save.baseCamp.unlocked);
}

function renderBaseCamp() {
  updatePermanentResourceUi();
  renderResearch();
  renderRelicResearch();
  setBaseCampRoom(baseCampRoom);
}

function setBaseCampRoom(room) {
  baseCampRoom = room === "relics" ? "relics" : "nexus";
  const relicsOpen = baseCampRoom === "relics";
  dom.nexusPanel.classList.toggle("hidden", relicsOpen);
  dom.relicResearchPanel.classList.toggle("hidden", !relicsOpen);
  dom.coreNexusRoom.classList.toggle("active", !relicsOpen);
  dom.researchBayRoom.classList.toggle("active", relicsOpen);
}

function setBaseCampOpen(open, restoreFocus = false) {
  const nextOpen = Boolean(open) && save.baseCamp.unlocked;
  if (nextOpen && starfallAiming) cancelStarfallAim(false);
  if (nextOpen && !baseCampOpen) {
    resumeAfterBaseCamp = !state.paused && !state.over;
    state.paused = true;
    baseCampOpen = true;
    dom.gameOverModal.classList.add("hidden");
    dom.baseCampModal.classList.remove("hidden");
    renderBaseCamp();
    dom.closeBaseCampButton.textContent = state.over ? "返回结算" : "返回战场";
    dom.closeBaseCampButton.focus({ preventScroll: true });
  } else if (!nextOpen && baseCampOpen) {
    baseCampOpen = false;
    dom.baseCampModal.classList.add("hidden");
    if (resumeAfterBaseCamp && !state.over && !techTreeOpen && !leaderboardModalOpen) state.paused = false;
    resumeAfterBaseCamp = false;
    if (state.over) dom.gameOverModal.classList.remove("hidden");
    if (restoreFocus) (state.over ? dom.openBaseCampFromGameOver : dom.openBaseCampButton).focus({ preventScroll: true });
    updateUi();
  }
}

function showBaseRecoveryEvent() {
  recoveryEventStep = 0;
  firstFailureFlow = true;
  state.paused = true;
  dom.gameOverModal.classList.add("hidden");
  dom.recoveryEventTitle.textContent = "核心残响";
  dom.recoveryEventText.textContent = "熄灭的晶塔仍在黑暗中回应。你从第一次失败里带回了一枚不会消散的核心残响，并获得 1 枚核心残片用于启动大本营。";
  dom.recoveryContinueButton.textContent = "聆听残响";
  dom.baseRecoveryModal.classList.remove("hidden");
  dom.recoveryContinueButton.focus({ preventScroll: true });
}

function advanceBaseRecoveryEvent() {
  if (recoveryEventStep === 0) {
    recoveryEventStep = 1;
    dom.recoveryEventTitle.textContent = "基地恢复";
    dom.recoveryEventText.textContent = "残响接通了地下避难所。晶核中枢重新供能，研究舱也从沉睡中亮起。";
    dom.recoveryContinueButton.textContent = "进入核心室";
    audio.play("ascend");
    return;
  }
  markBaseRecoverySeen(save);
  if (!previewMode) save = writeSave(save);
  dom.baseRecoveryModal.classList.add("hidden");
  firstFailureFlow = false;
  setBaseCampOpen(true);
}

function commitPermanentDrop(drop) {
  if (!drop) return;
  grantPermanentResource(save, drop.resourceType, drop.value);
  save = writeSave(save);
  updatePermanentResourceUi();
}
function createSkillUi() {
  dom.skillList.replaceChildren();
  for (const key of SKILL_ORDER) {
    const meta = SKILL_META[key];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skill-button";
    button.dataset.skill = key;
    button.innerHTML = `<span class="skill-key">${meta.key}</span><strong>${meta.name}</strong><small>${meta.description}</small><i class="cooldown-mask"></i><span class="cooldown-text"></span>`;
    button.addEventListener("click", () => activateSkill(key));
    dom.skillList.append(button);
  }
}

function renderResearch() {
  dom.stardustText.textContent = formatNumber(save.stardust);
  dom.researchList.replaceChildren();
  for (const [key, meta] of Object.entries(RESEARCH_META)) {
    const level = save.research[key];
    const cost = researchCost(level);
    const maxed = level >= GAME_CONFIG.research.maxLevel;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "research-button";
    button.disabled = maxed || save.stardust < cost;
    button.innerHTML = `<strong>${meta.name}</strong><span>等级 ${level}/${GAME_CONFIG.research.maxLevel} · +${level * 5}%</span><small>${maxed ? "研究完成" : `${meta.description} +5% · 花费 ${cost}`}</small>`;
    button.addEventListener("click", () => {
      if (!buyResearch(save, key)) return;
      save = writeSave(save);
      audio.play("purchase");
      renderResearch();
    });
    dom.researchList.append(button);
  }
}

function renderRelicResearch() {
  dom.relicResearchEchoText.textContent = formatNumber(save.resources.echoShards);
  dom.relicResearchCoreText.textContent = formatNumber(save.resources.coreFragments);
  dom.relicSlotResearch.replaceChildren();
  const slotButton = document.createElement("button");
  const maxSlots = save.relicSlots >= GAME_CONFIG.relics.maxSlots;
  const slotCost = maxSlots ? 0 : GAME_CONFIG.relicSlotResearch.costs[save.relicSlots - GAME_CONFIG.relics.initialSlots];
  slotButton.type = "button";
  slotButton.className = "relic-slot-button";
  slotButton.disabled = maxSlots || save.resources.coreFragments < slotCost;
  slotButton.innerHTML = `<span><small>遗物栏位</small><strong>${save.relicSlots} / ${GAME_CONFIG.relics.maxSlots}</strong><p>增加一格本局机制遗物装配空间。</p></span><b>${maxSlots ? "栏位已满" : `扩展下一格 · ${slotCost} 核心残片`}</b>`;
  slotButton.addEventListener("click", () => {
    if (!buyRelicSlot(save)) return;
    save = writeSave(save);
    state.relics.slots = save.relicSlots;
    audio.play("purchase");
    showToast(`临时遗物栏位扩展至 ${save.relicSlots} 格`);
    renderBaseCamp();
  });
  dom.relicSlotResearch.append(slotButton);
  dom.relicResearchList.replaceChildren();
  for (const [key, cost] of Object.entries(GAME_CONFIG.relicResearch)) {
    const meta = RELIC_META[key];
    const unlocked = save.relicUnlocks[key] === true;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "relic-research-card";
    button.dataset.relic = key;
    button.disabled = unlocked || save.resources.echoShards < cost;
    button.innerHTML = `<img src="${meta.art}" alt="" aria-hidden="true"><span><small>${meta.type}</small><strong>${meta.name}</strong><p>${meta.description}</p><b>${unlocked ? "已解锁 · 已加入战局池" : `解锁 · ${cost} 遗响碎片`}</b></span>`;
    button.addEventListener("click", () => {
      if (!buyRelicUnlock(save, key)) return;
      save = writeSave(save);
      state.relics.available = Object.entries(save.relicUnlocks).filter(([, active]) => active).map(([id]) => id);
      audio.play("purchase");
      showToast(`${meta.name} · 已加入临时遗物池`);
      renderBaseCamp();
    });
    dom.relicResearchList.append(button);
  }
}

function buyUpgrade(key) {
  audio.ensureContext()?.resume();
  if (purchaseUpgrade(state, key)) {
    handleEvents(state.events);
    showToast(key === "ascend" ? `晶塔化为${getTowerStats(state).name}` : `${UPGRADE_META[key].name}完成`);
  } else if (!getTechStatus(state, key).unlocked) {
    showToast(getTechStatus(state, key).reason);
  } else if (getUpgradeCost(state, key) > state.coins) {
    showToast("金币还不够");
  }
}

function activateSkill(key) {
  audio.ensureContext()?.resume();
  if (key === "starfall") {
    if (starfallAiming) {
      cancelStarfallAim();
      return;
    }
    if (state.over) return;
    if (state.skills.starfall.cooldown > 0) {
      showToast(`${SKILL_META.starfall.name}还需 ${Math.ceil(state.skills.starfall.cooldown)} 秒`);
      return;
    }
    if (!state.enemies.some((enemy) => enemy.hp > 0)) {
      showToast("没有可轰击目标");
      return;
    }
    starfallAiming = true;
    state.skills.starfall.aiming = true;
    state.skills.starfall.aimAngle = state.skills.starfall.angle;
    dom.gameCanvas.classList.add("starfall-aiming");
    showToast("移动鼠标选择方向 · 点击战场释放 · Esc 取消");
    updateUi();
    return;
  }
  const endingOverloadEarly = key === "overload" && state.skills.overload.active > 0;
  if (useSkill(state, key)) {
    handleEvents(state.events);
    showToast(endingOverloadEarly ? "超载提前结束 · 冲击释放" : `${SKILL_META[key].name}已释放`);
  } else if (key === "heal" && state.tower.hp >= getTowerStats(state).maxHp) {
    showToast("生命与护盾均已充盈");
  } else if (key === "coinVacuum" && !state.coinOrbs.some((orb) => !orb.expired && !orb.collected)) {
    showToast("战场上没有金币");
  } else if (state.skills[key].cooldown > 0) {
    showToast(`${SKILL_META[key].name}还需 ${Math.ceil(state.skills[key].cooldown)} 秒`);
  }
}

function cancelStarfallAim(showMessage = true) {
  if (!starfallAiming) return false;
  starfallAiming = false;
  state.skills.starfall.aiming = false;
  dom.gameCanvas.classList.remove("starfall-aiming");
  if (showMessage) showToast("已取消星落瞄准");
  updateUi();
  return true;
}

function releaseStarfall(angle) {
  if (!starfallAiming) return false;
  state.skills.starfall.aimAngle = angle;
  if (!useSkill(state, "starfall", { angle })) return false;
  starfallAiming = false;
  dom.gameCanvas.classList.remove("starfall-aiming");
  handleEvents(state.events);
  showToast("星落已释放");
  updateUi();
  return true;
}

function canvasPoint(event) {
  const rect = dom.gameCanvas.getBoundingClientRect();
  const scale = Math.min(rect.width / GAME_CONFIG.arena.width, rect.height / GAME_CONFIG.arena.height);
  const offsetX = (rect.width - GAME_CONFIG.arena.width * scale) / 2;
  const offsetY = (rect.height - GAME_CONFIG.arena.height * scale) / 2;
  return {
    x: (event.clientX - rect.left - offsetX) / scale,
    y: (event.clientY - rect.top - offsetY) / scale
  };
}

function starfallAngleAt(x, y) {
  return Math.atan2(y - GAME_CONFIG.arena.centerY, x - GAME_CONFIG.arena.centerX);
}

function switchDroneMode() {
  if (state.tower.droneMode === "collect" && state.tower.droneEnergy < GAME_CONFIG.drones.minAttackEnergy) {
    showToast(`电量至少达到 ${GAME_CONFIG.drones.minAttackEnergy} 才能出击`);
    return;
  }
  audio.ensureContext()?.resume();
  if (!toggleDroneMode(state)) {
    showToast("先研究晶塔磁吸核心");
    return;
  }
  audio.play("purchase");
  handleEvents(state.events);
  showToast(state.tower.droneMode === "attack" ? "无人机切换为攻击模式" : "无人机返回护航模式");
}

function switchDroneProtocol() {
  audio.ensureContext()?.resume();
  if (!toggleDroneDetonate(state)) {
    showToast(`自爆协议需要至少 ${GAME_CONFIG.drones.detonate.energyCost} 电量，且有可用无人机`);
    return;
  }
  audio.play("purchase");
  handleEvents(state.events);
  updateUi();
}

function createRelicHudChip({ icon, name, label = name, description, effect }) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "relic-run-chip";
  chip.title = effect;
  chip.setAttribute("aria-label", `${name}：${effect}`);
  chip.innerHTML = `<i aria-hidden="true">${icon}</i><span class="relic-run-name">${label}</span><span class="relic-run-tooltip" role="tooltip"><strong>${name}</strong><small>${description}</small><b>${effect}</b></span>`;
  return chip;
}

function renderRelicHud() {
  const owned = Object.entries(state.relics.owned).filter(([, active]) => active).map(([id]) => id);
  const signature = [owned.join(","), state.relics.damageBonus.toFixed(3), state.relics.rateBonus.toFixed(3)].join("|");
  if (signature === relicHudSignature) return;
  relicHudSignature = signature;
  dom.relicRunHud.replaceChildren();
  for (const id of owned) {
    const meta = RELIC_META[id];
    dom.relicRunHud.append(createRelicHudChip(meta));
  }
  if (state.relics.damageBonus > 0 || state.relics.rateBonus > 0) {
    const damage = Math.round(state.relics.damageBonus * 100);
    const rate = Math.round(state.relics.rateBonus * 100);
    dom.relicRunHud.append(createRelicHudChip({
      icon: "✧",
      name: "数值增幅",
      label: `火力 +${damage}% · 攻速 +${rate}%`,
      description: "栏位缺口转化成的本局临时强化。",
      effect: `本局攻击力 +${damage}% · 攻速 +${rate}%`
    }));
  }
}

function renderRelicChoice() {
  if (!state.relicChoice) return;
  dom.relicChoiceSource.textContent = RELIC_SOURCE_TEXT[state.relicChoice.source] ?? "回收一项战场模块。";
  const numericOnly = state.relicChoice.choices.every((id) => id.startsWith("boost:"));
  dom.relicChoiceSlots.textContent = numericOnly
    ? `栏位缺口 · 数值强化`
    : `模块 ${state.relics.picks} / ${state.relics.slots}`;
  dom.relicChoiceList.replaceChildren();
  state.relicChoice.choices.forEach((id, index) => {
    const meta = RELIC_META[id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "relic-card";
    button.dataset.relic = id;
    button.innerHTML = `<span class="relic-card-art"><img src="${meta.art}" alt="" aria-hidden="true" decoding="async"></span><span class="relic-card-index">0${index + 1}</span><span class="relic-card-icon">${meta.icon}</span><span class="relic-card-body"><span class="relic-card-type">${meta.type}</span><h3>${meta.name}</h3><p>${meta.description}</p><span class="relic-card-effect">${meta.effect}</span></span>`;
    button.addEventListener("click", () => selectRunRelic(id));
    dom.relicChoiceList.append(button);
  });
  dom.relicChoiceList.firstElementChild?.focus({ preventScroll: true });
}

function setRelicChoiceOpen(open) {
  const nextOpen = Boolean(open) && Boolean(state.relicChoice);
  if (nextOpen && !relicChoiceOpen) {
    if (starfallAiming) cancelStarfallAim(false);
    resumeAfterRelicChoice = !state.paused;
    state.paused = true;
  }
  relicChoiceOpen = nextOpen;
  dom.relicChoiceModal.classList.toggle("hidden", !nextOpen);
  dom.pauseOverlay.classList.add("hidden");
  if (nextOpen) renderRelicChoice();
  else {
    if (resumeAfterRelicChoice && !state.over && !techTreeOpen && !leaderboardModalOpen && !baseCampOpen) state.paused = false;
    resumeAfterRelicChoice = false;
  }
}

function selectRunRelic(id) {
  if (!chooseRelic(state, id)) return;
  audio.play("ascend");
  handleEvents(state.events);
  renderRelicHud();
  if (state.relicChoice) {
    relicChoiceOpen = true;
    dom.relicChoiceModal.classList.remove("hidden");
    renderRelicChoice();
  } else setRelicChoiceOpen(false);
}
function handleEvents(events) {
  for (const event of events) {
    if (event.type === "relicChoice") setRelicChoiceOpen(true);
    else if (event.type === "relicChosen") announce(`${RELIC_META[event.id]?.name ?? "战场回路"} · 已接入本局构筑`);
    else if (event.type === "relicDecoyExplode") { audio.play("overload"); renderer.trigger("overloadRelease", 0.7); announce("诡光诱饵崩解 · 爆炸清场"); }
    else if (event.type === "relicDecoySurvived") { audio.play("coin"); showToast(`诡光诱饵存活 · 转化金币 ${event.value}`); }
    else if (event.type === "relicPhaseBuff") { renderer.trigger("ascend", 0.45); showToast("月相调律 · 短暂火力强化"); }
    else if (event.type === "relicMirror") renderer.trigger("targetProtocol");
    else if (event.type === "shoot") audio.play("shoot");
    else if (event.type === "sawShoot") audio.play("sawShoot");
    else if (event.type === "sawLaunch" || event.type === "sawBounce") audio.play("sawShoot");
    else if (event.type === "hit") audio.play("hit");
    else if (event.type === "kill") { audio.play("kill"); showFirstRunTutorial(1); }
    else if (event.type === "coin") { audio.play("coin"); showFirstRunTutorial(2); }
    else if (event.type === "purchase") { audio.play("purchase"); if (event.key === "damage" && tutorialStep === 2) { clearTutorialHighlights(); dom.tutorialGuide.classList.add("hidden"); } }
    else if (event.type === "ascend") { audio.play("ascend"); renderer.trigger("ascend"); announce(`塔阶苏醒 · ${getTowerStats(state).name}`); }
    else if (event.type === "towerHit") { audio.play("towerHit"); renderer.trigger("towerHit", event.heavy ? 1.7 : 1); }
    else if (event.type === "bossSpawn") { audio.play("boss"); renderer.trigger("bossSpawn"); announce("腐化王冠踏入战场"); }
    else if (event.type === "colossusSpawn") { audio.play("boss"); renderer.trigger("bossSpawn", 1.5); announce(`威胁 XV · 虚环吞星兽 · ${COLOSSUS_AFFIX_NAMES[event.affix] ?? "未知异变"}`); }
    else if (event.type === "colossusIntent") {
      audio.play("waveWarning"); renderer.trigger("waveWarning");
      announce(`攻击预兆 · ${COLOSSUS_SKILL_NAMES[event.skill] ?? "未知异变"} · ${COLOSSUS_COUNTER_HINTS[event.skill] ?? "准备反制"}`);
    }
    else if (event.type === "colossusCounterAnchor") { renderer.trigger("waveWarning"); showToast("炮击锚点出现 · 点击锁定或等待晶塔攻击"); }
    else if (event.type === "colossusCounter") { audio.play("ascend"); renderer.trigger("ascend", 0.6); announce(COLOSSUS_COUNTER_RESULTS[event.counter] ?? "首领技能已反制"); }
    else if (event.type === "colossusSkill") {
      audio.play(event.skill === "summon" ? "waveStart" : "boss");
      announce(`巨兽技能 · ${COLOSSUS_SKILL_NAMES[event.skill] ?? "未知异变"}${event.enraged ? " · 狂化强化" : ""}`);
    }
    else if (event.type === "colossusEnrage") { audio.play("boss"); renderer.trigger("bossSpawn", 1.8); announce("第一命核破碎 · 第二血条开启 · 巨兽狂暴并行施法"); }
    else if (event.type === "colossusFreezeImmune") showToast("狂化巨兽免疫冰冻");
    else if (event.type === "bossDefeated") {
      audio.play("ascend");
      renderer.trigger("ascend");
      const unlockedNow = event.threat >= GAME_CONFIG.unlocks.doubleSpeedThreat && unlockDoubleSpeed(save);
      if (unlockedNow) save = writeSave(save);
      announce(unlockedNow ? `威胁 ${formatThreat(event.threat)} 首领击破 · 永久解锁 2× 时流` : "大首领崩解 · 战场回路已回收");
      if (unlockedNow) showFirstRunTutorial(4, true);
    }
    else if (event.type === "colossusDefeated") {
      audio.play("ascend");
      renderer.trigger("ascend");
      announce("虚环崩解 · 常规怪群恢复活动");
    }
    else if (event.type === "eliteSpawn") { audio.play("waveStart"); renderer.trigger("eliteSpawn"); announce(`精英怪 · ${ELITE_AFFIX_NAMES[event.affix] ?? "异变"}`); }
    else if (event.type === "bossPhase") { audio.play("boss"); renderer.trigger("bossSpawn", 0.7); announce(`首领转化为${ELEMENT_NAMES[event.resistance]}抗性 · 锚点重生`); }
    else if (event.type === "towerCollectPulse" && event.count > 0) renderer.trigger("collectPulse");
    else if (event.type === "targetProtocol") renderer.trigger("targetProtocol");
    else if (event.type === "droneDepleted") { renderer.trigger("droneDepleted"); announce("无人机电量耗尽 · 强制返航"); }
    else if (event.type === "droneIntercept") { renderer.trigger("droneIntercept"); announce("拦截协议 · 重击无效"); }
    else if (event.type === "droneDetonateMode") announce(event.active ? "自爆协议已启动 · 优先猎杀 Boss / 精英" : "自爆协议已关闭 · 无人机返回护航");
    else if (event.type === "droneDetonate") { audio.play("overload"); renderer.trigger("droneDetonate"); announce(`自爆协议 · 命中 ${event.hits} 个目标 · 无人机恢复 ${event.recovery.toFixed(1)}s`); }
    else if (event.type === "droneDetonateDepleted") { renderer.trigger("droneDepleted"); announce("自爆协议电量不足 · 无人机返回护航"); }
    else if (event.type === "droneRecovered") showToast("自爆无人机已恢复");
    else if (event.type === "droneGuardDepleted") { renderer.trigger("droneGuardDepleted"); announce(`防御护盾耗尽 · 电力冷却 ${event.cooldown.toFixed(1)}s`); }
    else if (event.type === "droneGuardReady") { renderer.trigger("droneGuardReady"); showToast("防御协议已恢复 · 护盾重新充能"); }
    else if (event.type === "eliteMarked") renderer.trigger("eliteMarked");
    else if (event.type === "permanentResourceCollected") { commitPermanentDrop(event); audio.play("coin"); showToast(`${event.resourceType === "core" ? "核心残片" : "遗响碎片"} +${event.value}`); }
    else if (event.type === "relicWard") showToast(`棱镜护佑 · 护盾 +${Math.round(event.value)}`);
    else if (event.type === "relicFrostbloom") renderer.trigger("targetProtocol");
    else if (event.type === "relicGilded") showToast(`拾金脉冲 · 额外金币 +${event.value}`);
    else if (event.type === "threat") { announce(event.level === GAME_CONFIG.colossus.spawnThreat ? `威胁 ${formatThreat(event.level)} · 巨型首领来袭` : event.level % GAME_CONFIG.threat.bossEvery === 0 ? `威胁 ${formatThreat(event.level)} · 大首领来袭` : `威胁升至 ${formatThreat(event.level)}`); if (event.level === 2) showFirstRunTutorial(3); }
    else if (event.type === "phase") { audio.play("phase"); announce(event.phase === "day" ? "晨光穿透荒原" : "长夜笼罩战场"); }
    else if (event.type === "waveWarning") { audio.play("waveWarning"); renderer.trigger("waveWarning"); announce("侦测到大规模怪潮"); }
    else if (event.type === "waveStart") { audio.play("waveStart"); renderer.trigger("waveStart"); announce(`第 ${event.index} 次怪潮抵达`); }
    else if (event.type === "overloadRelease") { audio.play("overload"); renderer.trigger("overloadRelease", event.overheated ? 1.5 : 1); announce(event.overheated ? "热浪爆发 · 晶塔过热" : event.early ? "超载中断 · 提前释放冲击" : "超载冲击释放"); }
    else if (event.type === "shieldBurst") { audio.play("hit"); renderer.trigger("shieldBurst"); announce(`满盾反击 · 晶片命中 ${event.hits}`); }
    else if (event.type === "anchorLocked") { audio.play("purchase"); renderer.trigger("anchorLocked"); announce(`锁定 ${ANCHOR_ROLE_NAMES[event.role]} · ${event.duration.toFixed(0)} 秒`); }
    else if (event.type === "coinVacuum") { audio.play("coin"); renderer.trigger("coinVacuum"); announce(`金潮归塔 · ${event.count} 枚 · +${event.value}`); }
    else if (event.type === "skill") { audio.play(event.key); renderer.trigger(event.key); }
    else if (event.type === "gameOver") { audio.play("gameOver"); renderer.trigger("gameOver"); settleRun(event.stardust, event.score); }
  }
  events.length = 0;
}

function updateUi() {
  const stats = getTowerStats(state);
  const hpRatio = Math.max(0, state.tower.hp / stats.maxHp);
  const totalShield = state.tower.shield + state.tower.droneGuardShield;
  const droneEnergyMax = getDroneEnergyMax(state);
  dom.healthText.textContent = `${Math.ceil(state.tower.hp)} / ${Math.round(stats.maxHp)}${totalShield > 0.5 ? ` +${Math.ceil(totalShield)}盾` : ""}`;
  dom.healthFill.style.width = `${hpRatio * 100}%`;
  dom.healthFill.style.background = state.tower.shield > 0.5 ? "linear-gradient(90deg,#e9ffff,#68dfff)" : hpRatio < 0.3 ? "linear-gradient(90deg,#ff4f70,#ff9a72)" : "linear-gradient(90deg,#7ee8ff,#b48cff)";
  dom.coinsText.textContent = formatNumber(state.coins);
  updatePermanentResourceUi();
  dom.scoreText.textContent = formatScore(state.stats.score);
  dom.threatText.textContent = formatThreat(state.threat);
  dom.timeText.textContent = formatTime(state.time);
  dom.phaseText.textContent = state.phase === "day" ? "白昼" : "长夜";
  dom.phaseText.parentElement.classList.toggle("night", state.phase === "night");
  dom.waveText.textContent = state.wave.active ? "涌入中" : formatTime(Math.max(0, state.wave.nextAt - state.time));
  renderRelicHud();
  dom.damageStat.textContent = Math.round(stats.damage);
  dom.rateStat.textContent = stats.fireRate.toFixed(1);
  dom.rangeStat.textContent = Math.round(stats.range);
  dom.droneEnergyStat.textContent = state.tower.upgrades.drone > 0 ? `${Math.round(state.tower.droneEnergy)} / ${Math.round(droneEnergyMax)}` : "--";
  dom.seedText.textContent = state.seed;
  const researchedTechs = TECH_ORDER.filter((key) => state.tower.upgrades[key] > 0).length;
  const availableTechs = TECH_ORDER.filter((key) => {
    const status = getTechStatus(state, key);
    return status.unlocked && !status.maxed;
  }).length;
  dom.techResearchedText.textContent = `${researchedTechs} / ${TECH_ORDER.length}`;
  dom.techAvailableText.textContent = availableTechs;
  dom.techThreatText.textContent = formatThreat(state.threat);
  dom.techCoinsText.textContent = formatNumber(state.coins);
  dom.techPanelThreatText.textContent = formatThreat(state.threat);
  const droneModeUnlocked = state.tower.upgrades.autoCollect > 0;
  const droneAttacking = droneModeUnlocked && state.tower.droneMode === "attack";
  const energyTooLow = state.tower.droneMode === "collect" && state.tower.droneEnergy < GAME_CONFIG.drones.minAttackEnergy;
  const detonateUnlocked = state.tower.upgrades.droneDetonate > 0;
  const detonateActive = state.tower.droneDetonateActive;
  const defenseUnlocked = state.tower.upgrades.droneGuard > 0;
  const defenseCooldown = state.tower.droneGuardCooldown;
  const readyDrones = state.drones.length === 0 ? state.tower.upgrades.drone : state.drones.filter((drone) => (drone.recoveryTimer ?? 0) <= 0).length;
  dom.droneModeButton.disabled = state.over || !droneModeUnlocked || energyTooLow || detonateActive;
  dom.droneModeButton.setAttribute("aria-pressed", String(droneAttacking));
  dom.droneModeButton.classList.toggle("attack", droneAttacking);
  dom.droneModeText.textContent = detonateActive ? "战术节点 · 自爆模式" : droneModeUnlocked ? (droneAttacking ? "战术节点 · 攻击模式" : "战术节点 · 护航模式") : "战术节点 · 攻击模式未解锁";
  const interceptText = state.tower.upgrades.droneIntercept > 0 ? ` · 拦截${state.tower.interceptCharge > 0 ? "就绪" : `${state.tower.interceptRecharge.toFixed(1)}s`}` : "";
  dom.droneModeHint.textContent = droneModeUnlocked
    ? (detonateActive
      ? `优先锁定 Boss / 精英 · 每次消耗 ${GAME_CONFIG.drones.detonate.energyCost} 电量`
      : droneAttacking
        ? `暂停自动回收 · 手动拾币可用 · 撞击耗电${state.tower.upgrades.droneHunt > 0 ? " · 猎杀标记" : ""}`
        : defenseUnlocked
          ? (defenseCooldown > 0 ? `防御护盾冷却 ${defenseCooldown.toFixed(1)}s` : `防御护盾 ${Math.round(state.tower.droneGuardShield)} · 电力持续消耗`)
          : `资源磁吸充能 · 金币手动/无人机可用 · ${Math.max(0, state.tower.autoCollectCooldown).toFixed(1)}s${interceptText}`)
    : "研究晶塔磁吸核心后开放";
  dom.droneEnergyFill.style.width = `${Math.max(0, Math.min(100, state.tower.droneEnergy / droneEnergyMax * 100))}%`;
  dom.droneProtocolButton.classList.toggle("hidden", !detonateUnlocked);
  dom.droneProtocolButton.classList.toggle("active", detonateActive);
  dom.droneProtocolButton.setAttribute("aria-pressed", String(detonateActive));
  dom.droneProtocolButton.disabled = state.over || (!detonateActive && (state.tower.droneEnergy < GAME_CONFIG.drones.detonate.energyCost || readyDrones === 0));
  dom.droneProtocolText.textContent = detonateActive ? "自爆协议 · 已启动" : "自爆协议 · 待命";
  dom.droneProtocolHint.textContent = detonateActive
    ? `恢复 ${getDroneDetonateRecovery(state).toFixed(1)}s · 可随时关闭`
    : readyDrones < state.drones.length ? `部分无人机恢复中 · ${getDroneDetonateRecovery(state).toFixed(1)}s` : `优先 Boss / 精英 · 每次消耗 ${GAME_CONFIG.drones.detonate.energyCost} 电量`;
  for (const button of dom.targetProtocolList.children) {
    const selected = button.dataset.protocol === state.tower.targetProtocol;
    button.setAttribute("aria-pressed", String(selected));
  }
  dom.targetProtocolHint.textContent = TARGET_PROTOCOL_META[state.tower.targetProtocol].hint;

  for (const button of dom.upgradeList.querySelectorAll(".tech-node")) {
    const key = button.dataset.upgrade;
    const level = state.tower.upgrades[key];
    const max = UPGRADE_META[key].max;
    const status = getTechStatus(state, key);
    const cost = status.cost;
    button.disabled = state.over || status.maxed || !status.unlocked || state.coins < cost;
    button.classList.toggle("locked", !status.unlocked && !status.maxed);
    button.classList.toggle("researched", level > 0);
    button.querySelector("em").textContent = status.maxed ? "已满" : status.unlocked ? `${formatNumber(cost)} 金` : "锁定";
    const towerGate = GAME_CONFIG.techTree[key].towerLevel ? ` · 晶塔 ${GAME_CONFIG.techTree[key].towerLevel} 级` : "";
    button.querySelector(".tech-gate").textContent = status.maxed ? "科技完成" : status.unlocked ? `威胁 ${status.requiredThreat}${towerGate} · 可研究` : status.reason;
    button.querySelector(".level-pips").innerHTML = Array.from({ length: Math.min(max, 12) }, (_, index) => `<i class="${index < level ? "on" : ""}"></i>`).join("");
  }
  dom.upgradeList.querySelector('[data-route="orbit"]')?.classList.toggle("chosen", state.tower.upgrades.sawOverdrive > 0 || state.tower.upgrades.sawGun > 0);
  dom.upgradeList.querySelector('[data-route="launch"]')?.classList.toggle("chosen", state.tower.upgrades.sawLaunch > 0);
  dom.upgradeList.querySelector('[data-route="detonate"]')?.classList.toggle("chosen", state.tower.upgrades.droneDetonate > 0);
  dom.upgradeList.querySelector('[data-route="guard"]')?.classList.toggle("chosen", state.tower.upgrades.droneGuard > 0);

  for (const button of dom.skillList.children) {
    const key = button.dataset.skill;
    const cooldown = state.skills[key].cooldown;
    const total = GAME_CONFIG.skills[key].cooldown;
    const shieldFull = state.tower.shield >= stats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction - 0.01;
    const overloadCanEnd = key === "overload" && state.skills.overload.active > 0;
    button.disabled = state.over || (cooldown > 0 && !overloadCanEnd) || (key === "heal" && hpRatio >= 0.999 && shieldFull) || (key === "starfall" && !starfallAiming && !state.enemies.some((enemy) => enemy.hp > 0)) || (key === "coinVacuum" && !state.coinOrbs.some((orb) => !orb.expired && !orb.collected));
    if (key === "starfall") {
      button.classList.toggle("aiming", starfallAiming);
      button.setAttribute("aria-pressed", String(starfallAiming));
    }
    button.querySelector(".cooldown-mask").style.height = `${Math.min(100, cooldown / total * 100)}%`;
    button.querySelector(".cooldown-text").textContent = cooldown > 0 ? `${cooldown.toFixed(1)}s` : "";
    const description = button.querySelector("small");
    if (key === "heal") description.textContent = state.skills.heal.shieldBurstArmed ? "晶片爆炸已装填" : state.tower.shield > 0.5 ? `护盾 ${Math.ceil(state.tower.shield)}` : SKILL_META[key].description;
    else if (key === "overload") description.textContent = state.skills.overload.active > 0
      ? `再按 W 释放 · 热量 ${Math.round(state.skills.overload.heat)}`
      : state.skills.overload.slow > 0 ? `过热降速 ${state.skills.overload.slow.toFixed(1)}s` : SKILL_META[key].description;
    else if (key === "starfall") description.textContent = starfallAiming ? "瞄准中 · 点击战场确认" : SKILL_META[key].description;
    else description.textContent = state.skills.coinVacuum.active > 0 ? `${state.skills.coinVacuum.collected} 枚 · +${state.skills.coinVacuum.value}` : SKILL_META[key].description;
  }

  const colossus = state.enemies.find((enemy) => enemy.type === "colossus" && enemy.hp > 0);
  if (colossus) {
    const activeColossusSkills = Object.keys(colossus.activeSkills ?? {}).map((skill) => COLOSSUS_SKILL_NAMES[skill]).filter(Boolean);
    dom.objectiveTitle.textContent = colossus.enraged ? `第二命核 · 狂暴并行 ${activeColossusSkills.length}/4` : colossus.spawnShield > 0 ? "首领护盾 · 优先击破" : `巨兽词条 · ${COLOSSUS_AFFIX_NAMES[colossus.colossusAffix] ?? "未知异变"}`;
    dom.objectiveText.textContent = colossus.intentSkill
      ? `反制窗口 ${Math.max(0, colossus.intentTimer).toFixed(1)}s · ${COLOSSUS_COUNTER_HINTS[colossus.intentSkill]}`
      : (colossus.exposedTimer ?? 0) > 0 ? `弱点暴露 ${colossus.exposedTimer.toFixed(1)} 秒 · 所有攻击伤害提高。`
        : activeColossusSkills.length ? `同时施放：${activeColossusSkills.join("、")} · 注意弹道与召唤法阵。`
        : colossus.activeSkill === "bulwark" ? "堡垒已展开 · 立即使用 W 超载强行击穿。"
        : colossus.activeSkill ? `正在施放${COLOSSUS_SKILL_NAMES[colossus.activeSkill]} · 常规怪群已暂停。` : "技能间隙 · 集中全部火力攻击外圈巨兽。";
  } else if (state.wave.warningStarted || state.wave.active) {
    dom.objectiveTitle.textContent = state.wave.active ? "怪潮压境" : "怪潮预警";
    dom.objectiveText.textContent = state.wave.active ? "敌群正在集中涌入，使用技能清开塔下空间。" : "地图红光标出了主攻方向，准备星落与超载。";
  } else if (state.threat < 2) {
    dom.objectiveTitle.textContent = "怪潮已至";
    dom.objectiveText.textContent = state.coins < 20 ? "鼠标滑过战场金币即可拾取，10 秒未收集就会消失。" : "第一笔金币到手。沿科技树选择路线。";
  } else if (state.threat < 5) {
    dom.objectiveTitle.textContent = "外圈正在收紧";
    dom.objectiveText.textContent = "疾行怪与重甲怪已加入，留一个技能救场。";
  } else {
    dom.objectiveTitle.textContent = "守住晶光";
    dom.objectiveText.textContent = "大首领每十级来袭。没有终点，只有更久。";
  }
  dom.pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
  dom.muteButton.textContent = save.settings.muted ? "静" : "声";
  const doubleSpeedUnlocked = save.unlocks.doubleSpeed || previewMode === "speed";
  dom.speedButton.textContent = doubleSpeedActive ? "2×" : "1×";
  dom.speedButton.classList.toggle("active", doubleSpeedActive);
  dom.speedButton.classList.toggle("locked", !doubleSpeedUnlocked);
  dom.speedButton.setAttribute("aria-pressed", String(doubleSpeedActive));
  dom.speedButton.setAttribute("aria-disabled", String(!doubleSpeedUnlocked));
  dom.speedButton.setAttribute("aria-label", doubleSpeedUnlocked ? `当前 ${doubleSpeedActive ? "2" : "1"} 倍速，点击切换` : "2倍速未解锁");
  dom.speedButton.title = doubleSpeedUnlocked ? "切换 1× / 2× 倍速（X）" : "击败威胁 Ⅹ 首领后永久解锁 2× 倍速";
}

function renderLeaderboardPodium(container, highlightDate) {
  if (!container) return;
  container.replaceChildren();
  if (leaderboardEntries.length === 0) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  const slots = [
    { rank: 2, entry: leaderboardEntries[1] ?? null },
    { rank: 1, entry: leaderboardEntries[0] ?? null },
    { rank: 3, entry: leaderboardEntries[2] ?? null }
  ];
  for (const slot of slots) {
    const card = document.createElement("article");
    card.className = "podium-entry podium-rank-" + slot.rank;
    if (slot.entry && highlightDate !== null && slot.entry.date === highlightDate) card.classList.add("current");
    const rank = document.createElement("span");
    rank.className = "podium-rank";
    rank.textContent = "0" + slot.rank;
    const name = document.createElement("b");
    name.className = "podium-name";
    name.textContent = slot.entry?.name ?? "等待记录";
    const score = document.createElement("strong");
    score.className = "podium-score";
    score.textContent = slot.entry ? formatScore(slot.entry.score) : "—";
    const detail = document.createElement("small");
    detail.className = "podium-detail";
    detail.textContent = slot.entry ? "威胁 " + formatThreat(slot.entry.threat) + " · " + slot.entry.kills + " 击杀" : "空缺";
    card.append(rank, name, score, detail);
    container.append(card);
  }
}

function renderLeaderboardInto(list, count, highlightDate) {
  list.replaceChildren();
  count.textContent = leaderboardEntries.length > 0 ? leaderboardEntries.length + " 条" : "全服";
  if (leaderboardEntries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = leaderboardLoading ? "正在读取全服排行榜…" : leaderboardError || "尚无记录 · 成为第一位守望者";
    list.append(empty);
    return;
  }
  for (const entry of leaderboardEntries) {
    const item = document.createElement("li");
    item.classList.toggle("current", highlightDate !== null && entry.date === highlightDate);
    const name = document.createElement("b");
    const score = document.createElement("strong");
    const threat = document.createElement("span");
    const kills = document.createElement("span");
    name.textContent = entry.name;
    score.textContent = formatScore(entry.score);
    threat.textContent = "威胁 " + formatThreat(entry.threat);
    kills.textContent = entry.kills + " 击杀";
    item.append(name, score, threat, kills);
    list.append(item);
  }
}

function renderLeaderboard(highlightDate = currentEntryDate) {
  renderLeaderboardInto(dom.leaderboardList, dom.leaderboardCount, highlightDate);
  renderLeaderboardInto(dom.globalLeaderboardList, dom.globalLeaderboardCount, highlightDate);
  renderLeaderboardPodium(dom.globalLeaderboardPodium, highlightDate);
}

async function refreshLeaderboard() {
  leaderboardLoading = true;
  leaderboardError = "";
  renderLeaderboard();
  try {
    leaderboardEntries = await fetchLeaderboard();
  } catch {
    leaderboardError = "全服排行榜暂时无法连接";
  } finally {
    leaderboardLoading = false;
    renderLeaderboard();
  }
}

async function submitCurrentScore(event) {
  event.preventDefault();
  if (!currentRunScore || scoreSubmitted || scoreSubmitting) return;
  scoreSubmitting = true;
  const date = Date.now();
  dom.playerNameInput.disabled = true;
  dom.submitScoreButton.disabled = true;
  dom.scoreEntryStatus.textContent = "正在登记全服成绩…";
  try {
    const result = await postLeaderboardEntry({
      name: dom.playerNameInput.value,
      score: currentRunScore.total,
      kills: state.stats.kills,
      threat: state.stats.highestThreat,
      time: state.time,
      coins: Math.floor(state.coins),
      date
    });
    save.settings.playerName = result.entry.name;
    save = writeSave(save);
    leaderboardEntries = result.entries;
    scoreSubmitted = true;
    currentEntryDate = result.entry.date;
    dom.scoreEntryStatus.textContent = `成绩登记完成 · 全服 RANK ${String(result.rank).padStart(2, "0")}`;
    renderLeaderboard();
  } catch {
    dom.playerNameInput.disabled = false;
    dom.submitScoreButton.disabled = false;
    dom.scoreEntryStatus.textContent = "登记失败 · 无法连接排行榜服务器，请稍后重试";
  } finally {
    scoreSubmitting = false;
  }
}

function settleRun(stardust) {
  if (runSettled) return;
  cancelStarfallAim(false);
  runSettled = true;
  currentRunScore = calculateRunScore(state);
  scoreSubmitted = false;
  currentEntryDate = null;
  save.stardust += stardust;
  const firstFailure = previewMode ? false : registerFailure(save);
  const firstFailureCoreGift = firstFailure ? 1 : 0;
  if (firstFailureCoreGift) grantPermanentResource(save, "core", firstFailureCoreGift);
  save.records.highestThreat = Math.max(save.records.highestThreat, state.stats.highestThreat);
  save.records.longestTime = Math.max(save.records.longestTime, state.time);
  save.records.totalKills += state.stats.kills;
  save = writeSave(save);
  dom.resultTime.textContent = formatTime(state.time);
  dom.resultKills.textContent = formatNumber(state.stats.kills);
  dom.resultThreat.textContent = formatThreat(state.stats.highestThreat);
  dom.resultStardust.textContent = `+${stardust}`;
  dom.resultEchoShards.textContent = `+${state.stats.echoShards ?? 0}`;
  dom.resultCoreFragments.textContent = `+${(state.stats.coreFragments ?? 0) + firstFailureCoreGift}`;
  dom.resultScore.textContent = formatScore(currentRunScore.total);
  dom.resultCombatScore.textContent = formatNumber(currentRunScore.combat);
  dom.resultCoinScore.textContent = `${Math.floor(state.coins)} × ${GAME_CONFIG.score.coinMultiplier} = ${formatNumber(currentRunScore.coinBonus)}`;
  dom.playerNameInput.value = save.settings.playerName ?? "PLAYER";
  dom.playerNameInput.disabled = false;
  dom.submitScoreButton.disabled = false;
  dom.scoreEntryStatus.textContent = "";
  setTechTreeOpen(false);
  renderBaseCamp();
  refreshLeaderboard();
  setTimeout(() => {
    if (firstFailure) showBaseRecoveryEvent();
    else {
      dom.gameOverModal.classList.remove("hidden");
      dom.playerNameInput.focus({ preventScroll: true });
    }
  }, 650);
}

function togglePause(force) {
  if (state.over) return;
  if (relicChoiceOpen) {
    state.paused = true;
    return;
  }
  if (baseCampOpen || firstFailureFlow) {
    if (force === true) resumeAfterBaseCamp = false;
    state.paused = true;
    return;
  }
  if (leaderboardModalOpen) {
    if (force === true) resumeAfterLeaderboard = false;
    state.paused = true;
    return;
  }
  if (techTreeOpen) {
    if (force === true) resumeAfterTechTree = false;
    state.paused = true;
    return;
  }
  state.paused = typeof force === "boolean" ? force : !state.paused;
  dom.pauseOverlay.classList.toggle("hidden", !state.paused);
  updateUi();
}

function toggleDoubleSpeed() {
  if (!save.unlocks.doubleSpeed && previewMode !== "speed") {
    showToast("击败威胁 Ⅹ 首领后永久解锁 2× 倍速");
    return;
  }
  doubleSpeedActive = !doubleSpeedActive;
  audio.play("purchase");
  showToast(doubleSpeedActive ? "时流加速 · 2×" : "时流稳定 · 1×");
  updateUi();
}

function restart() {
  cancelStarfallAim(false);
  relicChoiceOpen = false;
  resumeAfterRelicChoice = false;
  relicHudSignature = "";
  dom.relicChoiceModal.classList.add("hidden");
  runIndex += 1;
  state = createGameState((baseSeed + runIndex) >>> 0 || 1, save.research, save.relicUnlocks, save.relicSlots);
  runSettled = false;
  scoreSubmitted = false;
  currentRunScore = null;
  currentEntryDate = null;
  accumulator = 0;
  lastFrame = performance.now();
  dom.gameOverModal.classList.add("hidden");
  dom.pauseOverlay.classList.add("hidden");
  setTechTreeOpen(false);
  announce("晶芽重燃");
  updateUi();
}

function loop(now) {
  const frameDelta = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!state.paused && !state.over) {
    accumulator += frameDelta * (doubleSpeedActive ? 2 : 1);
    let steps = 0;
    while (accumulator >= GAME_CONFIG.fixedStep && steps < 16 && !state.paused) {
      updateGame(state, GAME_CONFIG.fixedStep);
      handleEvents(state.events);
      accumulator -= GAME_CONFIG.fixedStep;
      steps += 1;
    }
  }
  if (toastTimer > 0 && (toastTimer -= frameDelta) <= 0) dom.toast.classList.remove("show");
  if (announcementTimer > 0 && (announcementTimer -= frameDelta) <= 0) dom.announcement.classList.remove("show");
  renderer.render(state, frameDelta);
  updateUi();
  requestAnimationFrame(loop);
}

createUpgradeUi();
createSkillUi();
dom.droneModeButton.addEventListener("click", switchDroneMode);
dom.droneProtocolButton.addEventListener("click", switchDroneProtocol);
for (const button of dom.targetProtocolList.children) button.addEventListener("click", () => switchTargetProtocol(button.dataset.protocol));
updateUi();
if (previewMode === "tutorial-coin") showFirstRunTutorial(1, true);
if (previewMode === "tutorial-upgrade") showFirstRunTutorial(2, true);
if (previewMode === "tutorial-branches") showFirstRunTutorial(3, true);
if (previewMode === "tech" || previewMode === "drones" || previewMode === "element-tech" || previewMode === "drone-energy" || previewMode === "drone-protocols") setTechTreeOpen(true);
announce("守住中央晶塔");
refreshLeaderboard();
if (previewMode === "relics") {
  offerRelicChoice(state, "eliteWave");
  handleEvents(state.events);
}
if (previewMode === "leaderboard") {
  updateGame(state, GAME_CONFIG.fixedStep);
  handleEvents(state.events);
}

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  audio.unlock();
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (relicChoiceOpen) {
    const index = Number(event.key) - 1;
    if (index >= 0 && index < 3) selectRunRelic(state.relicChoice.choices[index]);
    return;
  }
  if (firstFailureFlow) {
    if (event.key === "Enter" || event.key === " ") advanceBaseRecoveryEvent();
    return;
  }
  if (baseCampOpen) {
    if (event.key === "Escape") setBaseCampOpen(false, true);
    return;
  }
  if (leaderboardModalOpen) {
    if (event.key === "Escape") setLeaderboardOpen(false, true);
    return;
  }
  if (starfallAiming) {
    if (event.key === "Escape" || event.key.toLowerCase() === "e") cancelStarfallAim();
    return;
  }
  if (event.key >= "1" && event.key <= "9") buyUpgrade(TECH_ORDER[Number(event.key) - 1]);
  else if (event.key.toLowerCase() === "q") activateSkill("heal");
  else if (event.key.toLowerCase() === "w") activateSkill("overload");
  else if (event.key.toLowerCase() === "e") activateSkill("starfall");
  else if (event.key.toLowerCase() === "f") activateSkill("coinVacuum");
  else if (event.key.toLowerCase() === "r") cycleProtocol();
  else if (event.key.toLowerCase() === "x") toggleDoubleSpeed();
  else if (event.key.toLowerCase() === "t") setTechTreeOpen(!techTreeOpen, techTreeOpen);
  else if (event.key === "Escape" && techTreeOpen) setTechTreeOpen(false, true);
  else if (event.key.toLowerCase() === "p" || event.key === "Escape") togglePause();
});
dom.openBaseCampButton.addEventListener("click", () => setBaseCampOpen(true));
dom.openBaseCampFromGameOver.addEventListener("click", () => setBaseCampOpen(true));
dom.coreNexusRoom.addEventListener("click", () => setBaseCampRoom("nexus"));
dom.researchBayRoom.addEventListener("click", () => setBaseCampRoom("relics"));
dom.closeBaseCampButton.addEventListener("click", () => setBaseCampOpen(false, true));
dom.baseCampModal.addEventListener("pointerdown", (event) => { if (event.target === dom.baseCampModal) setBaseCampOpen(false, true); });
dom.recoveryContinueButton.addEventListener("click", advanceBaseRecoveryEvent);
dom.openLeaderboardButton.addEventListener("click", () => setLeaderboardOpen(true));
dom.closeLeaderboardButton.addEventListener("click", () => setLeaderboardOpen(false, true));
dom.leaderboardModal.addEventListener("pointerdown", (event) => {
  if (event.target === dom.leaderboardModal) setLeaderboardOpen(false, true);
});
dom.openTechTreeButton.addEventListener("click", () => setTechTreeOpen(true));
dom.closeTechTreeButton.addEventListener("click", () => setTechTreeOpen(false, true));
dom.techTreePanel.addEventListener("pointerdown", (event) => {
  if (event.target === dom.techTreePanel) setTechTreeOpen(false, true);
});
dom.pauseButton.addEventListener("click", () => togglePause());
dom.speedButton.addEventListener("click", toggleDoubleSpeed);
dom.gameCanvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") {
    if (!starfallAiming) return;
    event.preventDefault();
  }
  const { x, y } = canvasPoint(event);
  if (starfallAiming) {
    state.skills.starfall.aimAngle = starfallAngleAt(x, y);
    return;
  }
  if (event.pointerType === "mouse" && collectCoinAt(state, x, y, GAME_CONFIG.coins.clickRadius)) {
    audio.play("coinPick");
  }
});
dom.gameCanvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") event.preventDefault();
  const { x, y } = canvasPoint(event);
  if (starfallAiming) {
    if (event.button === 0) releaseStarfall(starfallAngleAt(x, y));
    else if (event.button === 2) event.preventDefault();
    return;
  }
  const touchScale = event.pointerType === "touch" ? 1.8 : 1;
  const permanentDrop = collectPermanentResourceAt(state, x, y, GAME_CONFIG.permanentResources.clickRadius * touchScale);
  if (permanentDrop) {
    handleEvents(state.events);
    return;
  }
  if (lockAnchorAt(state, x, y, GAME_CONFIG.boss.anchorClickPadding * touchScale)) {
    handleEvents(state.events);
    return;
  }
  if (collectCoinAt(state, x, y, GAME_CONFIG.coins.clickRadius * touchScale)) audio.play("coinPick");
});
dom.gameCanvas.addEventListener("contextmenu", (event) => {
  if (!starfallAiming) return;
  event.preventDefault();
  cancelStarfallAim();
});
dom.muteButton.addEventListener("click", () => {
  save.settings.muted = !save.settings.muted;
  audio.setMuted(save.settings.muted);
  save = writeSave(save);
  updateUi();
});
dom.scoreEntryForm.addEventListener("submit", submitCurrentScore);
dom.tutorialDismiss.addEventListener("click", () => {
  dom.tutorialGuide.classList.add("hidden");
  clearTutorialHighlights();
});
dom.restartButton.addEventListener("click", restart);
dom.clearSaveButton.addEventListener("click", () => {
  if (!confirm("清除全部永久资源、基地进度、研究和纪录？此操作无法撤销。")) return;
  localStorage.removeItem(SAVE_KEY);
  save = defaultSave();
  doubleSpeedActive = false;
  audio.setMuted(false);
  setBaseCampOpen(false);
  renderBaseCamp();
  renderLeaderboard(null);
  showToast("存档已清除");
  updateUi();
});

document.addEventListener("pointerdown", () => audio.unlock(), { once: true });
revealGameWhenReady().then(() => {
  if (previewMode === "basecamp" || previewMode === "relic-research") {
    if (previewMode === "relic-research") baseCampRoom = "relics";
    setBaseCampOpen(true);
  }
  else if (previewMode === "recovery" || (save.baseCamp.unlocked && !save.baseCamp.recoverySeen)) showBaseRecoveryEvent();
});

globalThis.__ETERNAL_CRYSTAL_TOWER__ = {
  getState: () => state,
  buyUpgrade,
  useSkill: activateSkill,
  setTargetProtocol: switchTargetProtocol,
  restart,
  forceGameOver: () => { state.tower.hp = 0; updateGame(state, GAME_CONFIG.fixedStep); handleEvents(state.events); }
};
