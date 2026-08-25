import { GAME_CONFIG, SKILL_ORDER, TECH_ORDER } from "./config.js";
import { calculateStardust, collectCoinAt, createGameState, cycleTargetProtocol, getTechStatus, getTowerStats, getUpgradeCost, lockAnchorAt, purchaseUpgrade, setTargetProtocol, spawnEnemy, toggleDroneMode, updateGame, useSkill } from "./engine.js";
import { seedFromUrl } from "./rng.js";
import { buyResearch, defaultSave, loadSave, researchCost, SAVE_KEY, writeSave } from "./storage.js";
import { AudioSynth } from "./audio.js";
import { Renderer } from "./renderer.js";

const UPGRADE_META = {
  damage: { icon: "✦", name: "淬亮晶矢", description: "每级伤害 +25%", max: 10 },
  rate: { icon: "⌁", name: "加速咏唱", description: "每级攻速 +15%", max: 8 },
  ascend: { icon: "◇", name: "唤醒塔阶", description: "三元素共鸣后融合万象", max: 3 },
  saw: { icon: "✺", name: "环绕晶刃", description: "增加一枚近身晶刃", max: 5 },
  sawGun: { icon: "➶", name: "晶刃炮膛", description: "晶刃自动发射金色弹丸", max: 3 },
  drone: { icon: "⌁", name: "拾荒无人机", description: "逐级增加自动拾币无人机", max: 3 },
  autoCollect: { icon: "◎", name: "晶塔磁吸核心", description: "每5秒回收一枚金币", max: 1 },
  droneScavenge: { icon: "¤", name: "拾荒协议", description: "快速拾币并使无人机金币 +25%", max: 1 },
  droneIntercept: { icon: "⬡", name: "拦截协议", description: "护航时周期抵挡一次重击", max: 1 },
  droneHunt: { icon: "⌖", name: "猎杀协议", description: "标记精英，使炮弹伤害 +35%", max: 1 },
  frost: { icon: "❄", name: "霜棱炮口", description: "18% 概率冰冻敌人", max: 1 },
  fire: { icon: "♨", name: "烬火炉心", description: "16% 概率附加持续灼烧", max: 1 },
  lightning: { icon: "ϟ", name: "雷鸣天球", description: "14% 概率连锁附近三名敌人", max: 1 }
};
const BRANCH_META = {
  power: { name: "晶塔火力", keys: ["damage", "rate", "ascend"] },
  blade: { name: "环刃工事", keys: ["saw", "sawGun"] },
  economy: { name: "无人机协议", keys: ["drone", "droneScavenge", "autoCollect", "droneIntercept", "droneHunt"] },
  element: { name: "元素共鸣", keys: ["frost", "fire", "lightning"] }
};
const SKILL_META = {
  heal: { key: "Q", name: "晶愈", description: "满盾后受击引爆晶片" },
  overload: { key: "W", name: "超载", description: "再按 W 提前释放冲击" },
  starfall: { key: "E", name: "星落", description: "扇区随目标协议改变" },
  coinVacuum: { key: "F", name: "金潮归塔", description: "立即吸收全场金币" }
};
const ELITE_AFFIX_NAMES = { shield: "护盾", sprint: "狂奔", devour: "吞金", split: "分裂" };
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
  "skillList", "seedText", "announcement", "toast", "pauseOverlay", "pauseButton", "muteButton", "objectiveTitle", "objectiveText", "targetProtocolList", "targetProtocolHint",
  "techTreePanel", "openTechTreeButton", "closeTechTreeButton", "techResearchedText", "techAvailableText", "techThreatText", "techCoinsText", "techPanelThreatText",
  "droneModeButton", "droneModeText", "droneModeHint", "droneEnergyFill",
  "gameOverModal", "resultTime", "resultKills", "resultThreat", "resultStardust", "stardustText", "researchList", "restartButton", "clearSaveButton"
].map((id) => [id, document.getElementById(id)]));

let save = loadSave();
let runIndex = 0;
const baseSeed = seedFromUrl(location.search);
let state = createGameState(baseSeed, save.research);
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
if (previewMode === "protocols") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = 8;
  spawnEnemy(state, "brute", { x: 580, y: 360 });
  spawnEnemy(state, "runner", { x: 620, y: 360 });
  spawnEnemy(state, "hexer", { x: 750, y: 360 });
  spawnEnemy(state, "sentinel", { x: 700, y: 270 }, { elite: true, affix: "shield" });
  for (const enemy of state.enemies) { enemy.hp = enemy.maxHp = 100_000; enemy.freezeTimer = 999; }
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
let runSettled = false;
let lastFrame = performance.now();
let accumulator = 0;
let toastTimer = 0;
let announcementTimer = 0;
let techTreeOpen = false;
let resumeAfterTechTree = false;
const renderer = new Renderer(dom.gameCanvas);
const audio = new AudioSynth(save.settings.muted);

function formatNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return Math.floor(value).toLocaleString("zh-CN");
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

function createUpgradeUi() {
  dom.upgradeList.replaceChildren();
  for (const [branchKey, branch] of Object.entries(BRANCH_META)) {
    const section = document.createElement("section");
    section.className = `tech-branch ${branchKey}`;
    section.innerHTML = `<h3>${branch.name}</h3>`;
    for (const key of branch.keys) {
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
    button.innerHTML = `<strong>${meta.name}</strong><span>等级 ${level}/10 · +${level * 5}%</span><small>${maxed ? "研究完成" : `${meta.description} +5% · 花费 ${cost}`}</small>`;
    button.addEventListener("click", () => {
      if (!buyResearch(save, key)) return;
      save = writeSave(save);
      audio.play("purchase");
      renderResearch();
    });
    dom.researchList.append(button);
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
  const endingOverloadEarly = key === "overload" && state.skills.overload.active > 0;
  if (useSkill(state, key)) {
    handleEvents(state.events);
    showToast(endingOverloadEarly ? "超载提前结束 · 冲击释放" : `${SKILL_META[key].name}已释放`);
  } else if (key === "heal" && state.tower.hp >= getTowerStats(state).maxHp) {
    showToast("生命与护盾均已充盈");
  } else if (key === "starfall" && !state.enemies.some((enemy) => enemy.hp > 0)) {
    showToast("没有可轰击目标");
  } else if (key === "coinVacuum" && !state.coinOrbs.some((orb) => !orb.expired && !orb.collected)) {
    showToast("战场上没有金币");
  } else if (state.skills[key].cooldown > 0) {
    showToast(`${SKILL_META[key].name}还需 ${Math.ceil(state.skills[key].cooldown)} 秒`);
  }
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

function handleEvents(events) {
  for (const event of events) {
    if (event.type === "shoot") audio.play("shoot");
    else if (event.type === "sawShoot") audio.play("sawShoot");
    else if (event.type === "hit") audio.play("hit");
    else if (event.type === "kill") audio.play("kill");
    else if (event.type === "coin") audio.play("coin");
    else if (event.type === "purchase") audio.play("purchase");
    else if (event.type === "ascend") { audio.play("ascend"); renderer.trigger("ascend"); announce(`塔阶苏醒 · ${getTowerStats(state).name}`); }
    else if (event.type === "towerHit") { audio.play("towerHit"); renderer.trigger("towerHit", event.heavy ? 1.7 : 1); }
    else if (event.type === "bossSpawn") { audio.play("boss"); renderer.trigger("bossSpawn"); announce("腐化王冠踏入战场"); }
    else if (event.type === "eliteSpawn") { audio.play("waveStart"); renderer.trigger("eliteSpawn"); announce(`精英怪 · ${ELITE_AFFIX_NAMES[event.affix] ?? "异变"}`); }
    else if (event.type === "bossPhase") { audio.play("boss"); renderer.trigger("bossSpawn", 0.7); announce(`首领转化为${ELEMENT_NAMES[event.resistance]}抗性 · 锚点重生`); }
    else if (event.type === "towerCollectPulse" && event.count > 0) renderer.trigger("collectPulse");
    else if (event.type === "targetProtocol") renderer.trigger("targetProtocol");
    else if (event.type === "droneDepleted") { renderer.trigger("droneDepleted"); announce("无人机电量耗尽 · 强制返航"); }
    else if (event.type === "droneIntercept") { renderer.trigger("droneIntercept"); announce("拦截协议 · 重击无效"); }
    else if (event.type === "eliteMarked") renderer.trigger("eliteMarked");
    else if (event.type === "threat") { announce(event.level % GAME_CONFIG.threat.bossEvery === 0 ? `威胁 ${formatThreat(event.level)} · 大首领来袭` : `威胁升至 ${formatThreat(event.level)}`); }
    else if (event.type === "phase") { audio.play("phase"); announce(event.phase === "day" ? "晨光穿透荒原" : "长夜笼罩战场"); }
    else if (event.type === "waveWarning") { audio.play("waveWarning"); renderer.trigger("waveWarning"); announce("侦测到大规模怪潮"); }
    else if (event.type === "waveStart") { audio.play("waveStart"); renderer.trigger("waveStart"); announce(`第 ${event.index} 次怪潮抵达`); }
    else if (event.type === "overloadRelease") { audio.play("overload"); renderer.trigger("overloadRelease", event.overheated ? 1.5 : 1); announce(event.overheated ? "热浪爆发 · 晶塔过热" : event.early ? "超载中断 · 提前释放冲击" : "超载冲击释放"); }
    else if (event.type === "shieldBurst") { audio.play("hit"); renderer.trigger("shieldBurst"); announce(`满盾反击 · 晶片命中 ${event.hits}`); }
    else if (event.type === "anchorLocked") { audio.play("purchase"); renderer.trigger("anchorLocked"); announce(`锁定 ${ANCHOR_ROLE_NAMES[event.role]} · ${event.duration.toFixed(0)} 秒`); }
    else if (event.type === "coinVacuum") { audio.play("coin"); renderer.trigger("coinVacuum"); announce(`金潮归塔 · ${event.count} 枚 · +${event.value}`); }
    else if (event.type === "skill") { audio.play(event.key); renderer.trigger(event.key); }
    else if (event.type === "gameOver") { audio.play("gameOver"); renderer.trigger("gameOver"); settleRun(event.stardust); }
  }
  events.length = 0;
}

function updateUi() {
  const stats = getTowerStats(state);
  const hpRatio = Math.max(0, state.tower.hp / stats.maxHp);
  dom.healthText.textContent = `${Math.ceil(state.tower.hp)} / ${Math.round(stats.maxHp)}${state.tower.shield > 0.5 ? ` +${Math.ceil(state.tower.shield)}盾` : ""}`;
  dom.healthFill.style.width = `${hpRatio * 100}%`;
  dom.healthFill.style.background = state.tower.shield > 0.5 ? "linear-gradient(90deg,#e9ffff,#68dfff)" : hpRatio < 0.3 ? "linear-gradient(90deg,#ff4f70,#ff9a72)" : "linear-gradient(90deg,#7ee8ff,#b48cff)";
  dom.coinsText.textContent = formatNumber(state.coins);
  dom.threatText.textContent = formatThreat(state.threat);
  dom.timeText.textContent = formatTime(state.time);
  dom.phaseText.textContent = state.phase === "day" ? "白昼" : "长夜";
  dom.phaseText.parentElement.classList.toggle("night", state.phase === "night");
  dom.waveText.textContent = state.wave.active ? "涌入中" : formatTime(Math.max(0, state.wave.nextAt - state.time));
  dom.damageStat.textContent = Math.round(stats.damage);
  dom.rateStat.textContent = stats.fireRate.toFixed(1);
  dom.rangeStat.textContent = Math.round(stats.range);
  dom.droneEnergyStat.textContent = state.tower.upgrades.drone > 0 ? `${Math.round(state.tower.droneEnergy)}%` : "--";
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
  dom.droneModeButton.disabled = state.over || !droneModeUnlocked || energyTooLow;
  dom.droneModeButton.setAttribute("aria-pressed", String(droneAttacking));
  dom.droneModeButton.classList.toggle("attack", droneAttacking);
  dom.droneModeText.textContent = droneModeUnlocked ? (droneAttacking ? "战术节点 · 攻击模式" : "战术节点 · 护航模式") : "战术节点 · 攻击模式未解锁";
  const interceptText = state.tower.upgrades.droneIntercept > 0 ? ` · 拦截${state.tower.interceptCharge > 0 ? "就绪" : `${state.tower.interceptRecharge.toFixed(1)}s`}` : "";
  dom.droneModeHint.textContent = droneModeUnlocked
    ? (droneAttacking ? `停止拾币 · 撞击耗电${state.tower.upgrades.droneHunt > 0 ? " · 猎杀标记" : ""}` : `拾币充能 · 磁吸 ${Math.max(0, state.tower.autoCollectCooldown).toFixed(1)}s${interceptText}`)
    : "研究晶塔磁吸核心后开放";
  dom.droneEnergyFill.style.width = `${Math.max(0, Math.min(100, state.tower.droneEnergy / GAME_CONFIG.drones.energyMax * 100))}%`;
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

  for (const button of dom.skillList.children) {
    const key = button.dataset.skill;
    const cooldown = state.skills[key].cooldown;
    const total = GAME_CONFIG.skills[key].cooldown;
    const shieldFull = state.tower.shield >= stats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction - 0.01;
    const overloadCanEnd = key === "overload" && state.skills.overload.active > 0;
    button.disabled = state.over || (cooldown > 0 && !overloadCanEnd) || (key === "heal" && hpRatio >= 0.999 && shieldFull) || (key === "starfall" && !state.enemies.some((enemy) => enemy.hp > 0)) || (key === "coinVacuum" && !state.coinOrbs.some((orb) => !orb.expired && !orb.collected));
    button.querySelector(".cooldown-mask").style.height = `${Math.min(100, cooldown / total * 100)}%`;
    button.querySelector(".cooldown-text").textContent = cooldown > 0 ? `${cooldown.toFixed(1)}s` : "";
    const description = button.querySelector("small");
    if (key === "heal") description.textContent = state.skills.heal.shieldBurstArmed ? "晶片爆炸已装填" : state.tower.shield > 0.5 ? `护盾 ${Math.ceil(state.tower.shield)}` : SKILL_META[key].description;
    else if (key === "overload") description.textContent = state.skills.overload.active > 0
      ? `再按 W 释放 · 热量 ${Math.round(state.skills.overload.heat)}`
      : state.skills.overload.slow > 0 ? `过热降速 ${state.skills.overload.slow.toFixed(1)}s` : SKILL_META[key].description;
    else if (key === "starfall") description.textContent = state.tower.targetProtocol === "guard" ? "近卫 · 塔前扇区" : state.tower.targetProtocol === "radar" ? "雷达 · 远程扇区" : SKILL_META[key].description;
    else description.textContent = state.skills.coinVacuum.active > 0 ? `${state.skills.coinVacuum.collected} 枚 · +${state.skills.coinVacuum.value}` : SKILL_META[key].description;
  }

  if (state.wave.warningStarted || state.wave.active) {
    dom.objectiveTitle.textContent = state.wave.active ? "怪潮压境" : "怪潮预警";
    dom.objectiveText.textContent = state.wave.active ? "敌群正在集中涌入，使用技能清开塔下空间。" : "地图红光标出了主攻方向，准备星落与超载。";
  } else if (state.threat < 2) {
    dom.objectiveTitle.textContent = "怪潮已至";
    dom.objectiveText.textContent = state.coins < 20 ? "点击战场金币拾取，10 秒未收集就会消失。" : "第一笔金币到手。沿科技树选择路线。";
  } else if (state.threat < 5) {
    dom.objectiveTitle.textContent = "外圈正在收紧";
    dom.objectiveText.textContent = "疾行怪与重甲怪已加入，留一个技能救场。";
  } else {
    dom.objectiveTitle.textContent = "守住晶光";
    dom.objectiveText.textContent = "大首领每十级来袭。没有终点，只有更久。";
  }
  dom.pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
  dom.muteButton.textContent = save.settings.muted ? "静" : "声";
}

function settleRun(stardust) {
  if (runSettled) return;
  runSettled = true;
  save.stardust += stardust;
  save.records.highestThreat = Math.max(save.records.highestThreat, state.stats.highestThreat);
  save.records.longestTime = Math.max(save.records.longestTime, state.time);
  save.records.totalKills += state.stats.kills;
  save = writeSave(save);
  dom.resultTime.textContent = formatTime(state.time);
  dom.resultKills.textContent = formatNumber(state.stats.kills);
  dom.resultThreat.textContent = formatThreat(state.stats.highestThreat);
  dom.resultStardust.textContent = `+${stardust}`;
  setTechTreeOpen(false);
  renderResearch();
  setTimeout(() => dom.gameOverModal.classList.remove("hidden"), 650);
}

function togglePause(force) {
  if (state.over) return;
  if (techTreeOpen) {
    if (force === true) resumeAfterTechTree = false;
    state.paused = true;
    return;
  }
  state.paused = typeof force === "boolean" ? force : !state.paused;
  dom.pauseOverlay.classList.toggle("hidden", !state.paused);
  updateUi();
}

function restart() {
  runIndex += 1;
  state = createGameState((baseSeed + runIndex) >>> 0 || 1, save.research);
  runSettled = false;
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
    accumulator += frameDelta;
    let steps = 0;
    while (accumulator >= GAME_CONFIG.fixedStep && steps < 8) {
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
for (const button of dom.targetProtocolList.children) button.addEventListener("click", () => switchTargetProtocol(button.dataset.protocol));
updateUi();
if (previewMode === "tech" || previewMode === "drones" || previewMode === "element-tech" || previewMode === "drone-energy") setTechTreeOpen(true);
announce("守住中央晶塔");

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  audio.unlock();
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (event.key >= "1" && event.key <= "9") buyUpgrade(TECH_ORDER[Number(event.key) - 1]);
  else if (event.key.toLowerCase() === "q") activateSkill("heal");
  else if (event.key.toLowerCase() === "w") activateSkill("overload");
  else if (event.key.toLowerCase() === "e") activateSkill("starfall");
  else if (event.key.toLowerCase() === "f") activateSkill("coinVacuum");
  else if (event.key.toLowerCase() === "r") cycleProtocol();
  else if (event.key.toLowerCase() === "t") setTechTreeOpen(!techTreeOpen, techTreeOpen);
  else if (event.key === "Escape" && techTreeOpen) setTechTreeOpen(false, true);
  else if (event.key.toLowerCase() === "p" || event.key === "Escape") togglePause();
});
dom.openTechTreeButton.addEventListener("click", () => setTechTreeOpen(true));
dom.closeTechTreeButton.addEventListener("click", () => setTechTreeOpen(false, true));
dom.techTreePanel.addEventListener("pointerdown", (event) => {
  if (event.target === dom.techTreePanel) setTechTreeOpen(false, true);
});
dom.pauseButton.addEventListener("click", () => togglePause());
dom.gameCanvas.addEventListener("pointerdown", (event) => {
  const rect = dom.gameCanvas.getBoundingClientRect();
  const scale = Math.min(rect.width / GAME_CONFIG.arena.width, rect.height / GAME_CONFIG.arena.height);
  const offsetX = (rect.width - GAME_CONFIG.arena.width * scale) / 2;
  const offsetY = (rect.height - GAME_CONFIG.arena.height * scale) / 2;
  const x = (event.clientX - rect.left - offsetX) / scale;
  const y = (event.clientY - rect.top - offsetY) / scale;
  if (lockAnchorAt(state, x, y)) {
    handleEvents(state.events);
    return;
  }
  if (collectCoinAt(state, x, y)) audio.play("coinPick");
});
dom.muteButton.addEventListener("click", () => {
  save.settings.muted = !save.settings.muted;
  audio.setMuted(save.settings.muted);
  save = writeSave(save);
  updateUi();
});
dom.restartButton.addEventListener("click", restart);
dom.clearSaveButton.addEventListener("click", () => {
  if (!confirm("清除全部星尘、永久研究和纪录？此操作无法撤销。")) return;
  localStorage.removeItem(SAVE_KEY);
  save = defaultSave();
  audio.setMuted(false);
  renderResearch();
  showToast("存档已清除");
});
window.addEventListener("blur", () => togglePause(true));
document.addEventListener("pointerdown", () => audio.unlock(), { once: true });
requestAnimationFrame(loop);

globalThis.__ETERNAL_CRYSTAL_TOWER__ = {
  getState: () => state,
  buyUpgrade,
  useSkill: activateSkill,
  setTargetProtocol: switchTargetProtocol,
  restart,
  forceGameOver: () => { state.tower.hp = 0; updateGame(state, GAME_CONFIG.fixedStep); handleEvents(state.events); }
};
