// A bounded 3 × 2 board. Slot numbers still identify the six battlefield sectors.
export const BAY_COLUMNS = 3;
export const BAY_ROWS = 2;
export const SLOT_COUNT = 6;
// First-chapter equipment tuning; legacy upgrades and chapter-two ships keep their own rules.
export const MODULE_BALANCE = Object.freeze({
  cannon: Object.freeze({ damage: 3.4, damagePerLevel: .2, lanceStacks: 2 }),
  blade: Object.freeze({ orbitRadius: 118, towerDamageMultiplier: .65, stormDamageMultiplier: 1.5,
    launchDamageMultiplier: 2.2, launchDamagePerLevel: .2, launchInterval: .85, bounceDamagePerHop: .15,
    returnDamageMultiplier: 1.1, burstDamageMultiplier: .6 }),
  hangar: Object.freeze({ damageMultiplier: 2.8, attackDrain: 2, hitEnergy: 2, regen: 14, regenPerLevel: 4, speedPerLevel: .12 })
});
export const SPECIALIZATIONS = Object.freeze({
  pulseSplit: { module: "pulse", name: "裂晶散射", description: "轻炮命中后分裂两枚晶矢，可再追击一次；单发伤害降低 15%。" },
  pulseFocus: { module: "pulse", name: "持续校准", description: "轻炮连续锁定同一目标逐步加速，最多 +60%；换目标重置。" },
  cannonLance: { module: "cannon", name: "贯星蓄能", description: "连续锁敌叠满 2 层即发射贯星炮，可贯穿任何目标；射速降低 20%。" },
  cannonBurst: { module: "cannon", name: "震荡炮弹", description: "重炮射速 +35%，命中产生 95 范围爆炸；单发伤害降低 25%，失去穿透与蓄能。" },
  bladeGuard: { module: "blade", name: "晶刃屏障", description: "每 1.2 秒拦截一枚进入刀环的炮弹，拦截后刀环扩张 2 秒。" },
  bladeReturn: { module: "blade", name: "回旋飞刃", description: "每 0.85 秒发射一刃，伤害为塔攻击的 2.2／2.64／3.08 倍；最多弹射 0／1／2 次，每跳 +15%，返程伤害 110%。飞出期间近身防线变薄。" },
  hangarHeavy: { module: "hangar", name: "重型猎杀", description: "机群缩编为两架，单机伤害 ×2.5，命中耗电 ×2；优先首领与精英。" },
  hangarSwarm: { module: "hangar", name: "蜂群清扫", description: "增加两架轻型无人机，分散追击不同目标；单机伤害降低 25%。" }
});
export const MODULES = Object.freeze({
  pulse: { name: "晶矢轻炮", size: 1, cost: 60, color: "#7fe9ff", icon: "damage", weapon: true, description: "全向射击，基础射程 360。每级伤害 +35%，适合给元素反应提供连续命中。" },
  cannon: { name: "贯星重炮", size: 2, cost: 150, color: "#ffb377", icon: "cannonSiege", weapon: true, description: "射程 620，140 内无法锁敌；I／II／III 级伤害 ×3.4／4.08／4.76，射速 ×0.55。强化增加穿透、首领加伤与连续锁敌蓄能。" },
  blade: { name: "环刃发生器", size: 2, cost: 120, color: "#b6f58a", icon: "saw", weapon: true, description: "三／五／七枚晶刃守住 118 半径近圈，接触伤害继承 65% 塔攻击。II 级晶痕，III 级高速旋转与环刃风暴；远程敌人需要其他武器补位。" },
  hangar: { name: "蜂巢无人机库", size: 2, cost: 140, color: "#ffd578", icon: "drone", weapon: true, description: "三至五架无人机；II 级协同齐射，III 级重型载荷。每次升级飞行速度 +12%；出击每秒／每击耗电 2，I／II／III 级整备每秒回电 14／18／22；G 切换。" },
  shield: { name: "扇区护盾", size: 1, cost: 80, color: "#78dabb", icon: "droneGuard", description: "只减免所在 60° 扇区的来袭伤害，I／II／III 级减伤 45%／55%／65%。朝向与战场编号一致。" },
  frost: { name: "霜棱反应器", size: 1, cost: 90, color: "#91ddff", icon: "frost", element: "frost", description: "只强化相邻武器：伤害 +15%／级，35%／45%／55% 概率附加冰冻。与火焰交替命中触发融爆。" },
  fire: { name: "烬火反应器", size: 1, cost: 90, color: "#ff8d70", icon: "fire", element: "fire", description: "只强化相邻武器：伤害 +15%／级，附加灼烧。火＋冰触发融爆；火＋雷触发超导爆炸。" },
  lightning: { name: "雷鸣反应器", size: 1, cost: 100, color: "#c8a3ff", icon: "lightning", element: "lightning", description: "只强化相邻武器：伤害 +15%／级，附加连锁。与冰交替命中触发碎晶，与火触发超导。" }
});

export function createModuleBay() {
  return { installed: [{ id: "pulse", slot: 0, level: 1, invested: 60 }], specializations: {}, revision: 0, refitCooldown: 0 };
}
export function moduleCells(module) {
  const step = module.rotation === 1 ? BAY_COLUMNS : 1;
  return Array.from({ length: MODULES[module.id].size }, (_, i) => module.slot + i * step);
}
export function moduleFits(id, slot, rotation = 0) {
  if (!Object.hasOwn(MODULES, id) || !Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT || ![0, 1].includes(rotation)) return false;
  return rotation === 1 ? Math.floor(slot / BAY_COLUMNS) + MODULES[id].size <= BAY_ROWS : slot % BAY_COLUMNS + MODULES[id].size <= BAY_COLUMNS;
}
const touches = (a, b) => Math.abs(a % BAY_COLUMNS - b % BAY_COLUMNS) + Math.abs(Math.floor(a / BAY_COLUMNS) - Math.floor(b / BAY_COLUMNS)) === 1;
export const moduleAt = (state, slot) => state.tower.moduleBay?.installed.find((module) => moduleCells(module).includes(slot));
export const installedModule = (state, id) => state.tower.moduleBay?.installed.find((module) => module.id === id);
export const hasSpecialization = (state, id) => Boolean(installedModule(state, SPECIALIZATIONS[id]?.module)?.specialization === id);
export function modulesAdjacent(state, first, second) {
  const a = installedModule(state, first), b = installedModule(state, second);
  return Boolean(a && b && moduleCells(a).some(cell => moduleCells(b).some(other => touches(cell, other))));
}
export function specializeModule(state, id) {
  const meta = SPECIALIZATIONS[id], module = meta && installedModule(state, meta.module);
  if (!module || module.specialization || state.over) return false;
  module.specialization = id;
  state.tower.moduleBay.specializations ??= {};
  state.tower.moduleBay.specializations[meta.module] = id;
  syncModuleUpgrades(state);
  return true;
}
export const occupiedSlots = (state) => state.tower.moduleBay?.installed.reduce((sum, module) => sum + MODULES[module.id].size, 0) ?? 0;
export const moduleUpgradeCost = (module) => Math.round(MODULES[module.id].cost * (1.5 ** module.level));
export function adjacentReactors(state, id) {
  const weapon = installedModule(state, id);
  if (!weapon) return [];
  const cells = moduleCells(weapon);
  return state.tower.moduleBay.installed.filter((module) => MODULES[module.id].element && cells.some((slot) => moduleCells(module).some((cell) => touches(slot, cell))));
}
export const moduleDamageMultiplier = (state, id) => 1 + adjacentReactors(state, id).reduce((sum, reactor) => sum + reactor.level * 0.15, 0);
export function modulePlacementStatus(state, id, slot, moving = false, rotation = 0) {
  const bay = state.tower.moduleBay;
  if (!bay || !Object.hasOwn(MODULES, id) || !Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT || state.over) return { ok: false, reason: "无法装配" };
  if (bay.refitCooldown > 0) return { ok: false, reason: `重整中 · ${Math.ceil(bay.refitCooldown)} 秒` };
  if (!moving && installedModule(state, id)) return { ok: false, reason: "已安装，选择槽位可移动或强化" };
  if (moving && !installedModule(state, id)) return { ok: false, reason: "模块未安装" };
  if (!moduleFits(id, slot, rotation)) return { ok: false, reason: "超出拼装板边界，请旋转或换个位置" };
  const occupied = new Set(bay.installed.filter((module) => !moving || module.id !== id).flatMap(moduleCells));
  if (moduleCells({ id, slot, rotation }).some((cell) => occupied.has(cell))) return { ok: false, reason: "与已安装模块重叠" };
  if (!moving && state.coins < MODULES[id].cost) return { ok: false, reason: `还差 ${MODULES[id].cost - Math.floor(state.coins)} 金币` };
  return { ok: true, reason: moving ? "移动至此" : "可以安装" };
}

// Derive the existing combat/asset switches from the loadout; no invisible research survives removal.
export function syncModuleUpgrades(state) {
  const upgrades = state.tower.upgrades;
  for (const key of Object.keys(upgrades)) if (!["damage", "rate", "ascend"].includes(key)) upgrades[key] = 0;
  for (const module of state.tower.moduleBay.installed) {
    const level = module.level;
    if (module.id === "cannon") Object.assign(upgrades, { cannonSiege: 1, cannonPierce: level, cannonCharge: level >= 2 ? level - 1 : 0, cannonStarPiercer: level === 3 ? 1 : 0 });
    if (module.id === "blade") Object.assign(upgrades, { saw: 1 + level * 2, sawOverdrive: level - 1, sawAccelerator: level === 3 ? 1 : 0, sawStorm: level === 3 ? 1 : 0 });
    if (module.id === "hangar") Object.assign(upgrades, { drone: level + 2, autoCollect: 1, droneBattery: level - 1, droneHunt: level >= 2 ? 1 : 0, droneScavenge: level >= 2 ? 1 : 0, droneSalvo: level >= 2 ? 1 : 0, dronePayload: level === 3 ? 2 : 0, droneAfterburner: level - 1 });
    if (MODULES[module.id].element) upgrades[module.id] = 1;
    if (module.specialization === "cannonLance") Object.assign(upgrades, { cannonCharge: Math.max(1, level - 1), cannonStarPiercer: 1 });
    if (module.specialization === "cannonBurst") Object.assign(upgrades, { cannonCharge: 0, cannonStarPiercer: 0, cannonPierce: 0 });
    if (module.specialization === "bladeReturn") Object.assign(upgrades, { sawLaunch: 1, sawRicochet: level, sawRecovery: level, sawHomecoming: 1, sawStorm: 0 });
    if (module.specialization === "hangarHeavy") upgrades.drone = 2;
    if (module.specialization === "hangarSwarm") upgrades.drone = level + 4;
  }
  state.drones.length = Math.min(state.drones.length, upgrades.drone);
  state.launchedSaws.length = 0;
  if (!upgrades.drone) state.tower.droneMode = "collect";
  state.tower.siegeStreak = 0;
  state.tower.siegeTargetId = null;
  state.tower.moduleShieldCharge = 0;
  state.tower.bladeExpansion = 0;
  state.tower.pulseRelay = 0;
  state.tower.moduleBay.revision += 1;
}

function changed(state) {
  syncModuleUpgrades(state);
  // Time must advance between refits: pausing cannot rotate a shield for every incoming hit.
  if (state.paused) state.tower.moduleBay.pendingRefit = true;
  else state.tower.moduleBay.refitCooldown = state.time > 0 ? 8 : 0;
  state.events.push({ type: "purchase", key: "module" });
}
export function installModule(state, id, slot, rotation = 0) {
  if (!modulePlacementStatus(state, id, slot, false, rotation).ok) return false;
  state.coins -= MODULES[id].cost;
  state.tower.moduleBay.installed.push({ id, slot, rotation, level: 1, invested: MODULES[id].cost, ...(state.tower.moduleBay.specializations?.[id] ? { specialization: state.tower.moduleBay.specializations[id] } : {}) });
  changed(state);
  return true;
}
export function moduleMoveStatus(state, id, to, rotation = 0) {
  const status = modulePlacementStatus(state, id, to, true, rotation);
  if (status.ok || status.reason !== "与已安装模块重叠") return status;
  const source = installedModule(state, id), cells = moduleCells({id,slot:to,rotation});
  const hit = state.tower.moduleBay.installed.filter(m=>m.id!==id&&moduleCells(m).some(c=>cells.includes(c)));
  if (hit.length!==1 || hit[0].slot!==to) return status;
  const other=hit[0], destination={...other,slot:source.slot};
  if(!moduleFits(other.id,destination.slot,other.rotation??0))return status;
  const otherCells=moduleCells(destination), occupied=state.tower.moduleBay.installed.filter(m=>m!==source&&m!==other).flatMap(moduleCells);
  if(otherCells.some(c=>cells.includes(c)||occupied.includes(c))||cells.some(c=>occupied.includes(c)))return status;
  return {ok:true,reason:"交换位置",swap:other.id};
}
export function moveModule(state, from, to, rotation) {
  const module = moduleAt(state, from);
  rotation ??= module?.rotation ?? 0;
  if (!module || (module.slot === to && (module.rotation ?? 0) === rotation)) return false;
  const status=moduleMoveStatus(state,module.id,to,rotation);
  if(!status.ok)return false;
  if(status.swap)installedModule(state,status.swap).slot=module.slot;
  module.slot = to;
  module.rotation = rotation;
  changed(state);
  return true;
}
export function removeModule(state, slot) {
  const module = moduleAt(state, slot);
  if (!module || state.over || state.tower.moduleBay.refitCooldown > 0) return false;
  state.coins += Math.floor(module.invested * 0.8);
  state.tower.moduleBay.installed = state.tower.moduleBay.installed.filter((item) => item !== module);
  changed(state);
  return true;
}
export function upgradeModule(state, slot) {
  const module = moduleAt(state, slot);
  if (!module || state.over || state.tower.moduleBay.refitCooldown > 0 || module.level >= 3 || state.coins < moduleUpgradeCost(module)) return false;
  const cost = moduleUpgradeCost(module);
  state.coins -= cost;
  module.invested += cost;
  module.level += 1;
  changed(state);
  return true;
}
export function shieldSector(state, origin, tower) {
  if (!origin || !state.tower.moduleBay) return null;
  const angle = Math.atan2(origin.y - tower.y, origin.x - tower.x) + Math.PI / 2;
  const slot = ((Math.floor((angle + Math.PI / 6) / (Math.PI / 3)) % 6) + 6) % 6;
  const module = moduleAt(state, slot);
  return module?.id === "shield" ? module : null;
}
