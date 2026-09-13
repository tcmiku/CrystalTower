// A 3-column board that grows with tower ascend. Cells define footprint and adjacency; facing is independent.
export const BAY_COLUMNS = 3;
export const BAY_ROWS = 2;
export const SLOT_COUNT = 6;
export function bayRowsForTier(tier = 0) {
  const t = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
  return [2, 3, 3, 4][t];
}
export function slotCountForTier(tier = 0) {
  return BAY_COLUMNS * bayRowsForTier(tier);
}
export function getBayLayout(state) {
  const rows = bayRowsForTier(state?.tower?.upgrades?.ascend ?? 0);
  return { columns: BAY_COLUMNS, rows, slotCount: BAY_COLUMNS * rows };
}
// First-chapter equipment tuning; legacy upgrades and chapter-two ships keep their own rules.
export const MODULE_BALANCE = Object.freeze({
  cannon: Object.freeze({ damage: 3.4, damagePerLevel: .2, lanceStacks: 2 }),
  blade: Object.freeze({ orbitRadius: 118, towerDamageMultiplier: .65, stormDamageMultiplier: 1.5,
    launchDamageMultiplier: 2.2, launchDamagePerLevel: .2, launchInterval: .85, bounceDamagePerHop: .15,
    returnDamageMultiplier: 1.1, burstDamageMultiplier: .6 }),
  hangar: Object.freeze({ damageMultiplier: 2.8, attackDrain: 2, hitEnergy: 2, regen: 14, regenPerLevel: 4, speedPerLevel: .12 }),
  mortar: Object.freeze({ minRange: 180, range: 600, interval: 3, flight: [.9, .7, .7], radius: [90, 90, 110], damage: 3, damagePerLevel: .2, clusterSpread: 60, clusterDamage: .42, staggerDamage: .75, staggerDuration: 1 }),
  gravity: Object.freeze({ distance: 230, radius: [100, 120, 120], duration: [2, 2, 2.5], interval: 8, pullSpeed: 95, elitePull: .35, bossSlow: .85 }),
  interceptor: Object.freeze({ capacity: [2, 3, 3], recharge: [2, 2, 1.6], rangeBeyondTower: 90, projectileSpeed: 300 }),
  service: Object.freeze({ regenMultiplier: 1.4, returnMultiplier: 1.2, launchDuration: 3, flightDrainMultiplier: .5, dockRadius: 24 }),
  laser: Object.freeze({ range: 300, duration: 3, cooling: [2, 2, 1.5], rampTime: [3, 1.8, 1.8], minDamage: .8, maxDamage: 2, elementInterval: .5, focusDuration: 5, focusDamage: 3, focusCooling: 3 }),
  mine: Object.freeze({ interval: [4, 4, 3.2], capacity: [3, 4, 4], lifetime: 15, distance: 230, trigger: 28, radius: 70, damage: 2.5, chainRange: 130, chainDelay: .15, chainDamage: .75, slowDamage: .65, slowDuration: 3, slow: .55, bossSlow: .85 }),
  bridge: Object.freeze({ efficiency: [.7, .85, 1] }),
  capacitor: Object.freeze({ interval: [2, 1.5, 1.5], capacity: [3, 3, 4], damagePerStack: .25, cooldownMultiplier: 1.1 })
});
export const SPECIALIZATIONS = Object.freeze({
  pulseSplit: { module: "pulse", name: "裂晶散射", description: "轻炮命中后分裂两枚晶矢，可再追击一次；单发伤害降低 15%。" },
  pulseFocus: { module: "pulse", name: "持续校准", description: "轻炮连续锁定同一目标逐步加速，最多 +60%；换目标重置。" },
  cannonLance: { module: "cannon", name: "贯星蓄能", description: "连续锁敌叠满 2 层即发射贯星炮，可贯穿任何目标；射速降低 20%。" },
  cannonBurst: { module: "cannon", name: "震荡炮弹", description: "重炮射速 +35%，命中产生 95 范围爆炸；单发伤害降低 25%，失去穿透与蓄能。" },
  bladeGuard: { module: "blade", name: "晶刃屏障", description: "每 1.2 秒拦截一枚进入刀环的炮弹，拦截后刀环扩张 2 秒。" },
  bladeReturn: { module: "blade", name: "回旋飞刃", description: "每 0.85 秒发射一刃，伤害为塔攻击的 2.2／2.64／3.08 倍；最多弹射 0／1／2 次，每跳 +15%，返程伤害 110%。飞出期间近身防线变薄。" },
  hangarHeavy: { module: "hangar", name: "重型猎杀", description: "机群缩编为两架，单机伤害 ×2.5，命中耗电 ×2；优先首领与精英。" },
  hangarSwarm: { module: "hangar", name: "蜂群清扫", description: "增加两架轻型无人机，分散追击不同目标；单机伤害降低 25%。" },
  mortarCluster: { module: "mortar", name: "集束轰击", description: "一次发射三枚分散落点的晶弹，每枚伤害为普通炮弹的 42%；覆盖更广，单点伤害降低。" },
  mortarStagger: { module: "mortar", name: "震荡压制", description: "炮弹伤害降低 25%，命中后打断普通远程单位蓄能并压制 1 秒；首领免疫压制。" },
  laserSweep: { module: "laser", name: "切割扇面", description: "同时照射目标方向 60° 内的敌人，每秒造成塔攻击 0.8 倍伤害；取消单体增幅，保留散热。" },
  laserFocus: { module: "laser", name: "熔穿焦点", description: "连续照射上限延长到 5 秒，单体每秒伤害最高为塔攻击 3 倍；散热延长至 3 秒。" },
  mineChain: { module: "mine", name: "连锁雷场", description: "引爆 130 范围内的相邻晶雷，每隔 0.15 秒传递一次；单雷伤害降低 25%，每枚仅爆炸一次。" },
  mineSlow: { module: "mine", name: "阻滞雷场", description: "爆炸伤害降低 35%，留下持续 3 秒的减速区；普通敌人移速降低 45%，首领降低 15%。" }
});
export const MODULES = Object.freeze({
  pulse: { name: "晶矢轻炮", size: 1, cost: 60, color: "#7fe9ff", icon: "damage", weapon: true, description: "全向射击，基础射程 360。每级伤害 +35%，适合给元素反应提供连续命中。" },
  cannon: { name: "贯星重炮", size: 2, cost: 150, color: "#ffb377", icon: "cannonSiege", weapon: true, description: "射程 620，140 内无法锁敌；I／II／III 级伤害 ×3.4／4.08／4.76，射速 ×0.55。强化增加穿透、首领加伤与连续锁敌蓄能。" },
  blade: { name: "环刃发生器", size: 2, cost: 120, color: "#b6f58a", icon: "saw", weapon: true, description: "三／五／七枚晶刃守住 118 半径近圈，接触伤害继承 65% 塔攻击。II 级晶痕，III 级高速旋转与环刃风暴；远程敌人需要其他武器补位。" },
  hangar: { name: "蜂巢无人机库", size: 2, cost: 140, color: "#ffd578", icon: "drone", weapon: true, description: "三至五架无人机；II 级协同齐射，III 级重型载荷。每次升级飞行速度 +12%；出击每秒／每击耗电 2，I／II／III 级整备每秒回电 14／18／22；G 切换。" },
  shield: { name: "扇区护盾", size: 1, cost: 80, directional: true, color: "#78dabb", icon: "droneGuard", description: "只减免朝向覆盖的 60° 扇区的来袭伤害，I／II／III 级减伤 45%／55%／65%。朝向可独立调整，战斗中转向需重整 3 秒。" },
  frost: { name: "霜棱反应器", size: 1, cost: 90, color: "#91ddff", icon: "frost", element: "frost", description: "只强化相邻武器：伤害 +15%／级，35%／45%／55% 概率附加冰冻。与火焰交替命中触发融爆。" },
  fire: { name: "烬火反应器", size: 1, cost: 90, color: "#ff8d70", icon: "fire", element: "fire", description: "只强化相邻武器：伤害 +15%／级，附加灼烧。火＋冰触发融爆；火＋雷建立超导电链，传递部分伤害。" },
  lightning: { name: "雷鸣反应器", size: 1, cost: 100, color: "#c8a3ff", icon: "lightning", element: "lightning", description: "只强化相邻武器：伤害 +15%／级，附加连锁。与冰触发碎晶裂片并暴露弱点；与火建立传伤电链。" },
  mortar: { name: "星陨迫击炮", size: 2, cost: 160, color: "#9ccaff", icon: "moduleMortar", weapon: true, description: "每 3 秒曲射轰炸固定落点，射程 180—600。I／II／III 级伤害 ×3／3.6／4.2；II 级落地缩短至 0.7 秒，III 级爆炸范围扩大至 110。继承相邻元素；高速与近身敌人容易漏过。" },
  gravity: { name: "引力锚", size: 2, cost: 140, color: "#bba1ff", icon: "moduleGravity", directional: true, description: "每 8 秒在指定朝向中圈展开引力场，持续 2 秒；II 级范围 100→120，III 级持续 2.5 秒。聚拢普通敌人，精英牵引减弱；首领不被拖动，仅可移动首领轻微减速。自身不造成伤害。" },
  interceptor: { name: "截光阵列", size: 1, cost: 100, color: "#7df3db", icon: "moduleInterceptor", directional: true, description: "拦截朝向覆盖的 60° 扇区的普通敌弹，初始需充能。I 级存 2 发，每 2 秒恢复 1 发；II 级存 3 发，III 级恢复缩短至 1.6 秒。不能拦截首领炮击、光束和近身攻击。" },
  service: { name: "快速整备舱", size: 1, cost: 110, color: "#a8e8b2", icon: "moduleService", description: "必须邻接机库：实际归航后回电 +40%；II 级回航速度 +20%；III 级在舱内补回至少 10% 电量并充满后，下次出击前 3 秒飞行耗电减半，命中耗电不变。" },
  laser: { name: "熔晶射线塔", size: 2, cost: 150, color: "#ffad77", icon: "moduleLaser", weapon: true, description: "射程 300，持续照射最多 3 秒，再散热 2 秒；同一目标每秒伤害从塔攻击 0.8 倍增至 2 倍，换目标重置。II 级更快蓄热，III 级散热降至 1.5 秒。邻接元素每 0.5 秒最多触发一次。" },
  mine: { name: "晶簇布雷器", size: 2, cost: 130, color: "#f3cd83", icon: "moduleMine", weapon: true, directional: true, description: "每 4 秒向指定朝向中圈布雷，最多 3 枚、每枚存活 15 秒。接敌后造成塔攻击 2.5 倍伤害，爆炸半径 70；II 级存量 4，III 级间隔 3.2 秒。部署时保存元素，转向或拆装会回收旧雷。" },
  bridge: { name: "共鸣导桥", size: 1, cost: 90, color: "#d4b2ff", icon: "moduleBridge", description: "选择横向或纵向，将两端正对的反应器连接到武器；触发效率 70%／85%／100%，不传递基础伤害加成。直接邻接优先，不连接其他导桥或支援模块。" },
  capacitor: { name: "储能晶匣", size: 1, cost: 100, color: "#8ef0e1", icon: "moduleCapacitor", description: "绑定一门相邻轻炮、重炮或迫击炮。武器装填完成且没有射程内目标时，每 2 秒蓄 1 层、最多 3 层；下次开火每层增伤 25%，持续射击间隔增加 10%。II 级蓄能 1.5 秒，III 级最多 4 层。改绑与重整清空能量。" }
});

export function createModuleBay() {
  return { installed: [{ id: "pulse", slot: 0, level: 1, invested: 60 }], specializations: {}, revision: 0, refitCooldown: 0, combat: { shells: [], fields: [], effects: [], mines: [], slowFields: [], beams: [] } };
}
export function moduleCells(module, columns = BAY_COLUMNS) {
  const step = module.rotation === 1 ? columns : 1;
  return Array.from({ length: MODULES[module.id].size }, (_, i) => module.slot + i * step);
}
export function moduleFits(id, slot, rotation = 0, rows = BAY_ROWS, columns = BAY_COLUMNS) {
  const slotCount = columns * rows;
  if (!Object.hasOwn(MODULES, id) || !Number.isInteger(slot) || slot < 0 || slot >= slotCount || ![0, 1].includes(rotation)) return false;
  return rotation === 1 ? Math.floor(slot / columns) + MODULES[id].size <= rows : slot % columns + MODULES[id].size <= columns;
}
const touches = (a, b, columns = BAY_COLUMNS) => Math.abs(a % columns - b % columns) + Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) === 1;
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
  const { columns } = getBayLayout(state);
  const cells = moduleCells(weapon, columns);
  return state.tower.moduleBay.installed.filter((module) => MODULES[module.id].element && cells.some((slot) => moduleCells(module, columns).some((cell) => touches(slot, cell, columns))));
}
export const moduleDamageMultiplier = (state, id) => 1 + adjacentReactors(state, id).reduce((sum, reactor) => sum + reactor.level * 0.15, 0);
export function bridgeConnection(state, bridge = installedModule(state, 'bridge')) {
  if (!bridge) return null;
  const { columns, slotCount } = getBayLayout(state), step = bridge.rotation === 1 ? columns : 1;
  const before = bridge.slot - step, after = bridge.slot + step;
  if (before < 0 || after >= slotCount || bridge.rotation !== 1 && (bridge.slot % columns === 0 || bridge.slot % columns === columns - 1)) return null;
  const a = moduleAt(state, before), b = moduleAt(state, after);
  const reactor = [a,b].find(m => m && MODULES[m.id].element), weapon = [a,b].find(m => m && MODULES[m.id].weapon);
  return reactor && weapon ? { bridge, reactor, weapon, efficiency: MODULE_BALANCE.bridge.efficiency[(bridge.level ?? 1) - 1] } : null;
}
export function weaponReactors(state, id) {
  const sources = adjacentReactors(state, id).map(m => ({ ...m, efficiency: 1 }));
  const link = bridgeConnection(state);
  if (link?.weapon.id === id && !sources.some(m => m.id === link.reactor.id)) sources.push({ ...link.reactor, efficiency: link.efficiency, viaBridge: true });
  return sources;
}
export const capacitorTargets = state => state.tower.moduleBay?.installed.filter(m => ['pulse','cannon','mortar'].includes(m.id) && modulesAdjacent(state, 'capacitor', m.id)) ?? [];
export function capacitorForWeapon(state, id) {
  const m = installedModule(state, 'capacitor');
  return m?.boundId === id && capacitorTargets(state).some(target => target.id === id) ? m : null;
}
export function bindCapacitor(state, id) {
  const m = installedModule(state, 'capacitor');
  if (!m || state.over || state.tower.moduleBay.refitCooldown > 0 || m.boundId === id || !capacitorTargets(state).some(target => target.id === id)) return false;
  m.boundId = id;
  changed(state);
  return true;
}
export function modulePlacementStatus(state, id, slot, moving = false, rotation = 0) {
  const bay = state.tower.moduleBay;
  const { columns, rows, slotCount } = getBayLayout(state);
  if (!bay || !Object.hasOwn(MODULES, id) || !Number.isInteger(slot) || slot < 0 || slot >= slotCount || state.over) return { ok: false, reason: "无法装配" };
  if (bay.refitCooldown > 0) return { ok: false, reason: `重整中 · ${Math.ceil(bay.refitCooldown)} 秒` };
  if (!moving && installedModule(state, id)) return { ok: false, reason: "已安装，选择槽位可移动或强化" };
  if (moving && !installedModule(state, id)) return { ok: false, reason: "模块未安装" };
  if (!moduleFits(id, slot, rotation, rows, columns)) return { ok: false, reason: "超出拼装板边界，请旋转或换个位置" };
  const occupied = new Set(bay.installed.filter((module) => !moving || module.id !== id).flatMap((module) => moduleCells(module, columns)));
  if (moduleCells({ id, slot, rotation }, columns).some((cell) => occupied.has(cell))) return { ok: false, reason: "与已安装模块重叠" };
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
  state.tower.moduleBay.combat = { shells: [], fields: [], effects: [], mines: [], slowFields: [], beams: [] };
  for (const module of state.tower.moduleBay.installed) {
    if (module.id === "mortar") module.cooldown = MODULE_BALANCE.mortar.interval;
    if (module.id === "gravity") module.cooldown = 1;
    if (module.id === "laser") Object.assign(module, { beamTime: 0, lockTime: 0, beamTarget: null, cooling: 0, elementClock: 0 });
    if (module.id === "mine") Object.assign(module, { cooldown: MODULE_BALANCE.mine.interval[module.level - 1], deployIndex: 0 });
    if (module.id === "capacitor") {
      const targets = capacitorTargets(state);
      if (!targets.some(target => target.id === module.boundId)) module.boundId = targets.length === 1 ? targets[0].id : null;
      Object.assign(module, { stacks: 0, chargeTime: 0, charging: false });
    }
    if (module.id === "interceptor") { module.charges = 0; module.recharge = 0; }
    if (module.id === "service") { module.launchBuff = 0; module.recharged = false; module.recoveredEnergy = 0; module.servicing = false; module.pulseCooldown = 0; }
  }
  for (const module of state.tower.moduleBay.installed) { module.focusStacks = 0; module.focusTarget = null; }
  state.tower.moduleBay.revision += 1;
}

function changed(state) {
  syncModuleUpgrades(state);
  // Time must advance between refits: pausing cannot rotate a shield for every incoming hit.
  if (['rest','warning'].includes(state.assault?.phase)) { state.tower.moduleBay.pendingRefit=false; state.tower.moduleBay.refitCooldown=0; }
  else if (state.paused) state.tower.moduleBay.pendingRefit = true;
  else state.tower.moduleBay.refitCooldown = state.time > 0 ? 8 : 0;
  state.events.push({ type: "purchase", key: "module" });
}
export function installModule(state, id, slot, rotation = 0) {
  if (!modulePlacementStatus(state, id, slot, false, rotation).ok) return false;
  state.coins -= MODULES[id].cost;
  state.tower.moduleBay.installed.push({ id, slot, rotation, ...(MODULES[id].directional ? {facing: defaultModuleFacing(state)}:{}), level: 1, invested: MODULES[id].cost, ...(state.tower.moduleBay.specializations?.[id] ? { specialization: state.tower.moduleBay.specializations[id] } : {}) });
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
  if(!moduleFits(other.id,destination.slot,other.rotation??0,getBayLayout(state).rows,getBayLayout(state).columns))return status;
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
export const defaultModuleFacing = state => state.assault && Number.isInteger(state.wave.direction) ? state.wave.direction*2 : 0;
export const FACING_NAMES = ['北','东北','东','东南','南','西南','西','西北'];
export const moduleFacingAngle = module => Number.isInteger(module.facing) ? -Math.PI/2 + module.facing*Math.PI/4 : -Math.PI/2 + (module.slot%6)*Math.PI/3;
export function moduleCovers(module,origin,tower) {
  if(!module||module.facingCooldown>0)return false;
  const delta=Math.atan2(origin.y-tower.y,origin.x-tower.x)-moduleFacingAngle(module);
  return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<=Math.PI/6+1e-9;
}
export function setModuleFacing(state,id,facing) {
  const m=installedModule(state,id);
  if(!m||!MODULES[id].directional||state.over||!Number.isInteger(facing)||facing<0||facing>7||m.facingCooldown>0||m.facing===facing)return false;
  const free=['rest','warning'].includes(state.assault?.phase);
  m.facing=facing;m.facingCooldown=free?0:3;
  if(id==='mine'){state.tower.moduleBay.combat.mines=[];state.tower.moduleBay.combat.slowFields=[];m.cooldown=MODULE_BALANCE.mine.interval[m.level-1];m.deployIndex=0;}
  state.tower.moduleBay.revision++;
  return true;
}
export function shieldSector(state,origin,tower) {
  if(!origin||!state.tower.moduleBay)return null;
  const shield=installedModule(state,'shield');
  return moduleCovers(shield,origin,tower)?shield:null;
}
