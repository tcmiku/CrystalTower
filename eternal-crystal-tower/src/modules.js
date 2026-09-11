// Clockwise from north; large modules occupy their start slot and the next slot.
export const SLOT_COUNT = 6;
export const MODULES = Object.freeze({
  pulse: { name: "晶矢轻炮", size: 1, cost: 60, color: "#7fe9ff", icon: "damage", weapon: true, description: "全向射击，基础射程 360。每级伤害 +35%，适合给元素反应提供连续命中。" },
  cannon: { name: "贯星重炮", size: 2, cost: 150, color: "#ffb377", icon: "cannonSiege", weapon: true, description: "射程 620，140 内无法锁敌；伤害 ×3.4，射速 ×0.55，穿透与首领加伤。强化后连续锁敌蓄能。" },
  blade: { name: "环刃发生器", size: 2, cost: 120, color: "#b6f58a", icon: "saw", weapon: true, description: "三枚环刃守住近身，强化后增加刃数、晶痕与环刃风暴。无法追击防线外的远程敌人。" },
  hangar: { name: "蜂巢无人机库", size: 2, cost: 140, color: "#ffd578", icon: "drone", weapon: true, description: "三至五架无人机；II 级协同齐射，III 级重型载荷。出击每秒／每击耗电 2，整备每秒回电 14；G 切换。" },
  shield: { name: "扇区护盾", size: 1, cost: 80, color: "#78dabb", icon: "droneGuard", description: "只减免所在 60° 扇区的来袭伤害，I／II／III 级减伤 45%／55%／65%。朝向与战场编号一致。" },
  frost: { name: "霜棱反应器", size: 1, cost: 90, color: "#91ddff", icon: "frost", element: "frost", description: "只强化相邻武器：伤害 +15%／级，35%／45%／55% 概率附加冰冻。与火焰交替命中触发融爆。" },
  fire: { name: "烬火反应器", size: 1, cost: 90, color: "#ff8d70", icon: "fire", element: "fire", description: "只强化相邻武器：伤害 +15%／级，附加灼烧。火＋冰触发融爆；火＋雷触发超导爆炸。" },
  lightning: { name: "雷鸣反应器", size: 1, cost: 100, color: "#c8a3ff", icon: "lightning", element: "lightning", description: "只强化相邻武器：伤害 +15%／级，附加连锁。与冰交替命中触发碎晶，与火触发超导。" }
});

export function createModuleBay() {
  return { installed: [{ id: "pulse", slot: 0, level: 1, invested: 60 }], revision: 0, refitCooldown: 0 };
}
export const moduleCells = (module) => Array.from({ length: MODULES[module.id].size }, (_, i) => (module.slot + i) % SLOT_COUNT);
export const moduleAt = (state, slot) => state.tower.moduleBay?.installed.find((module) => moduleCells(module).includes(slot));
export const installedModule = (state, id) => state.tower.moduleBay?.installed.find((module) => module.id === id);
export const occupiedSlots = (state) => state.tower.moduleBay?.installed.reduce((sum, module) => sum + MODULES[module.id].size, 0) ?? 0;
export const moduleUpgradeCost = (module) => Math.round(MODULES[module.id].cost * (1.5 ** module.level));
export function adjacentReactors(state, id) {
  const weapon = installedModule(state, id);
  if (!weapon) return [];
  const cells = moduleCells(weapon);
  return state.tower.moduleBay.installed.filter((module) => MODULES[module.id].element && cells.some((slot) => (slot + 1) % 6 === module.slot || (slot + 5) % 6 === module.slot));
}
export const moduleDamageMultiplier = (state, id) => 1 + adjacentReactors(state, id).reduce((sum, reactor) => sum + reactor.level * 0.15, 0);
export function modulePlacementStatus(state, id, slot, moving = false) {
  const bay = state.tower.moduleBay;
  if (!bay || !Object.hasOwn(MODULES, id) || !Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT || state.over) return { ok: false, reason: "无法装配" };
  if (bay.refitCooldown > 0) return { ok: false, reason: `重整中 · ${Math.ceil(bay.refitCooldown)} 秒` };
  if (!moving && installedModule(state, id)) return { ok: false, reason: "已安装，选择槽位可移动或强化" };
  const occupied = new Set(bay.installed.filter((module) => !moving || module.id !== id).flatMap(moduleCells));
  if (moduleCells({ id, slot }).some((cell) => occupied.has(cell))) return { ok: false, reason: MODULES[id].size === 2 ? "需要顺时针连续两格空槽" : "这个槽位已被占用" };
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
    if (module.id === "blade") Object.assign(upgrades, { saw: 1 + level * 2, sawOverdrive: level >= 2 ? level : 0, sawAccelerator: level >= 2 ? 1 : 0, sawStorm: level === 3 ? 1 : 0 });
    if (module.id === "hangar") Object.assign(upgrades, { drone: level + 2, autoCollect: 1, droneBattery: level - 1, droneHunt: level >= 2 ? 1 : 0, droneScavenge: level >= 2 ? 1 : 0, droneSalvo: level >= 2 ? 1 : 0, dronePayload: level === 3 ? 2 : 0, droneAfterburner: level - 1 });
    if (MODULES[module.id].element) upgrades[module.id] = 1;
  }
  state.drones.length = Math.min(state.drones.length, upgrades.drone);
  state.launchedSaws.length = 0;
  if (!upgrades.drone) state.tower.droneMode = "collect";
  state.tower.siegeStreak = 0;
  state.tower.siegeTargetId = null;
  state.tower.moduleBay.revision += 1;
}

function changed(state) {
  syncModuleUpgrades(state);
  // Time must advance between refits: pausing cannot rotate a shield for every incoming hit.
  if (state.paused) state.tower.moduleBay.pendingRefit = true;
  else state.tower.moduleBay.refitCooldown = state.time > 0 ? 8 : 0;
  state.events.push({ type: "purchase", key: "module" });
}
export function installModule(state, id, slot) {
  if (!modulePlacementStatus(state, id, slot).ok) return false;
  state.coins -= MODULES[id].cost;
  state.tower.moduleBay.installed.push({ id, slot, level: 1, invested: MODULES[id].cost });
  changed(state);
  return true;
}
export function moveModule(state, from, to) {
  const module = moduleAt(state, from);
  if (!module || module.slot === to || !modulePlacementStatus(state, module.id, to, true).ok) return false;
  module.slot = to;
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
