export const ENDLESS_RELICS = Object.freeze({
  perpetualOverload: {
    name: "永续超载核心", icon: "∞", iconCell: [0, 0], basePrice: 96000, type: "临界协议",
    description: "首次超载后永久运转；满热自动泄压，主动泄压不会关闭超载。",
    effect: "120 热量爆发并回落至 30 · 爆发后 1.2 秒不稳定"
  },
  globalStarfall: {
    name: "全目标火力协议", icon: "✦", iconCell: [1, 0], basePrice: 82000, type: "轨道协议",
    description: "星落取消手动瞄准，按 E 立即对全屏敌人造成完整伤害。",
    effect: "保留星痕、追加落星与首领反制"
  },
  omniversalPiercer: {
    name: "万象贯星构型", icon: "━", iconCell: [2, 0], basePrice: 68000, type: "破城构型",
    description: "满蓄能贯星炮可攻击任意目标；普通敌人的过量伤害沿方向贯穿。",
    effect: "需要破城炮膛与贯星炮",
    eligible: (state) => state.tower.upgrades.cannonSiege > 0 && state.tower.upgrades.cannonStarPiercer > 0
  },
  frostRift: {
    name: "极寒裂界模块", icon: "❄", iconCell: [3, 0], basePrice: 62000, type: "裂晶构型",
    description: "裂界连爆附带冰霜；冻结死亡仍可触发霜葬花冠。",
    effect: "普通 1s · 精英 0.6s · Boss 0.25s",
    eligible: (state) => state.tower.upgrades.cannonCascade > 0 && state.tower.upgrades.frost > 0
  },
  droneDuplex: {
    name: "无人机双工主机", icon: "⌁", iconCell: [0, 1], basePrice: 64000, type: "无人机协议",
    description: "攻击模式仍以半效回收金币；护航时轮流向当前标记目标发射支援弹。",
    effect: "攻击拾币 50% · 电量上限 +30%",
    eligible: (state) => state.tower.upgrades.drone >= 3 && state.tower.upgrades.autoCollect > 0
  },
  finalInsurance: {
    name: "终焉保险协议", icon: "⬡", iconCell: [1, 1], basePrice: 72000, type: "生存协议",
    description: "致命伤时保留 1 点生命，恢复生命并获得护盾；每次商店刷新充能。",
    effect: "恢复 20% · 护盾 30% · 免疫 1s"
  }
});

export const ENDLESS_PRODUCTS = Object.freeze({
  autoCoinVacuum: { name: "金币回收协议", icon: "¤", iconCell: [2, 1], basePrice: 24000, group: "fixed", maxLevel: 1, description: "金潮就绪且金币达到阈值时自动释放，可在 HUD 关闭。" },
  attackProtocol: { name: "攻击协议升级", icon: "✦", iconCell: [3, 1], basePrice: 10000, group: "fixed", maxLevel: 10, growth: 1.55, description: "本次无尽挑战晶塔攻击力 +12%。" },
  rateProtocol: { name: "攻速协议升级", icon: "⌁", iconCell: [0, 2], basePrice: 12000, group: "fixed", maxLevel: 8, growth: 1.55, description: "本次无尽挑战晶塔攻击速度 +8%。" },
  emergencyRepair: { name: "晶塔紧急修复", icon: "✚", iconCell: [1, 2], basePrice: 14000, group: "random", maxLevel: Infinity, oncePerRefresh: true, description: "立即恢复 40% 最大生命。" },
  tacticalClock: { name: "战术时钟校准", icon: "⌛", iconCell: [2, 2], basePrice: 18000, group: "random", maxLevel: 5, growth: 1.55, description: "所有主动技能冷却恢复速度 +8%。" },
  elementCalibrator: { name: "元素校准器", icon: "◇", iconCell: [3, 2], basePrice: 16000, group: "random", maxLevel: 5, growth: 1.55, description: "冰、火、雷触发率分别 +3 个百分点。" }
});

export const ENDLESS_SHOP_RULES = Object.freeze({
  firstThreat: 25,
  refreshThreatStep: 5,
  stageGrowth: 1.35,
  maxRelics: 2,
  rerollPrices: [6000, 12000, 24000],
  overloadUnstableDuration: 1.2,
  overloadUnstableRateMultiplier: 1.25,
  insuranceHealFraction: 0.2,
  insuranceShieldFraction: 0.3,
  insuranceImmunity: 1,
  coinCountThreshold: 8,
  coinValueThreshold: 800,
  droneEnergyMultiplier: 1.3,
  droneAttackCollectEfficiency: 0.5,
  droneSupportInterval: 1,
  frostCascadeChainLimit: 8
});

export const ENDLESS_MERCHANT = Object.freeze({ x: 88, y: 566, width: 116, height: 174, clickRadius: 74 });

const GENERIC_RELICS = ["globalStarfall", "finalInsurance", "perpetualOverload"];

function shuffled(state, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(state.rng.next() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function createEndlessShopState() {
  return {
    unlocked: false,
    refreshIndex: -1,
    refreshThreat: 0,
    refreshSerial: 0,
    pendingNotice: false,
    rerolls: 0,
    relicOffers: [],
    randomOffers: [],
    equippedRelics: [],
    levels: Object.fromEntries(Object.keys(ENDLESS_PRODUCTS).map((id) => [id, 0])),
    cyclePurchases: [],
    spent: 0,
    autoCoinEnabled: true,
    insuranceCharges: 0,
    droneSupportTimer: 0
  };
}

export function hasEndlessRelic(state, id) {
  return state?.endlessShop?.equippedRelics?.includes(id) === true;
}

export function bossPresent(state) {
  return state.enemies.some((enemy) => ["boss", "colossus", "sovereign"].includes(enemy.type) && enemy.hp > 0);
}

function buildRelicOffers(state) {
  const owned = new Set(state.endlessShop.equippedRelics);
  const eligible = Object.entries(ENDLESS_RELICS)
    .filter(([id, item]) => !owned.has(id) && (!item.eligible || item.eligible(state)))
    .map(([id]) => id);
  const preferred = shuffled(state, eligible.filter((id) => !GENERIC_RELICS.includes(id)));
  const generic = shuffled(state, GENERIC_RELICS.filter((id) => eligible.includes(id)));
  return [...preferred, ...generic].slice(0, 3);
}

function buildRandomOffers(state) {
  const purchased = new Set(state.endlessShop.cyclePurchases);
  return shuffled(state, Object.entries(ENDLESS_PRODUCTS)
    .filter(([id, item]) => item.group === "random" && !purchased.has(id) && (state.endlessShop.levels[id] ?? 0) < item.maxLevel)
    .map(([id]) => id)).slice(0, 3);
}

export function refreshEndlessShop(state, threat = state.threat) {
  if (!state.endlessMode || threat < ENDLESS_SHOP_RULES.firstThreat || (threat - ENDLESS_SHOP_RULES.firstThreat) % ENDLESS_SHOP_RULES.refreshThreatStep !== 0) return false;
  const refreshIndex = Math.floor((threat - ENDLESS_SHOP_RULES.firstThreat) / ENDLESS_SHOP_RULES.refreshThreatStep);
  if (refreshIndex <= state.endlessShop.refreshIndex) return false;
  const shop = state.endlessShop;
  shop.unlocked = true;
  shop.refreshIndex = refreshIndex;
  shop.refreshThreat = threat;
  shop.refreshSerial += 1;
  shop.rerolls = 0;
  shop.cyclePurchases = [];
  shop.relicOffers = buildRelicOffers(state);
  shop.randomOffers = buildRandomOffers(state);
  if (hasEndlessRelic(state, "finalInsurance")) shop.insuranceCharges = 1;
  shop.pendingNotice = bossPresent(state);
  state.events.push({ type: shop.pendingNotice ? "endlessShopRefreshPending" : "endlessShopRefreshReady", threat, refreshIndex });
  return true;
}

export function releaseEndlessShopNotice(state) {
  if (!state.endlessShop?.pendingNotice || bossPresent(state)) return false;
  state.endlessShop.pendingNotice = false;
  state.events.push({ type: "endlessShopRefreshReady", threat: state.endlessShop.refreshThreat, refreshIndex: state.endlessShop.refreshIndex });
  return true;
}

export function getEndlessShopPrice(state, id) {
  const item = ENDLESS_RELICS[id] ?? ENDLESS_PRODUCTS[id];
  if (!item || state.endlessShop.refreshIndex < 0) return Infinity;
  const stage = ENDLESS_SHOP_RULES.stageGrowth ** state.endlessShop.refreshIndex;
  const level = state.endlessShop.levels[id] ?? 0;
  const levelGrowth = item.growth ? item.growth ** level : 1;
  return Math.round(item.basePrice * stage * levelGrowth);
}

export function getEndlessShopPurchaseStatus(state, id) {
  const relic = ENDLESS_RELICS[id];
  const product = ENDLESS_PRODUCTS[id];
  if (!state.endlessShop?.unlocked || (!relic && !product)) return { allowed: false, reason: "商品不可用", price: Infinity };
  const price = getEndlessShopPrice(state, id);
  if (bossPresent(state)) return { allowed: false, reason: "首领在场 · 交易锁定", price };
  if (relic) {
    if (!state.endlessShop.relicOffers.includes(id)) return { allowed: false, reason: "本轮未上架", price };
    if (state.endlessShop.equippedRelics.includes(id)) return { allowed: false, reason: "已装备", price };
    if (state.endlessShop.equippedRelics.length >= ENDLESS_SHOP_RULES.maxRelics) return { allowed: false, reason: "专属遗物栏已满", price };
  } else {
    const level = state.endlessShop.levels[id] ?? 0;
    if (level >= product.maxLevel) return { allowed: false, reason: "已达上限", price };
    if (product.group === "random" && !state.endlessShop.randomOffers.includes(id)) return { allowed: false, reason: "本轮未上架", price };
    if (product.oncePerRefresh && state.endlessShop.cyclePurchases.includes(id)) return { allowed: false, reason: "本次刷新已购买", price };
  }
  if (state.coins < price) return { allowed: false, reason: "金币不足", price };
  return { allowed: true, reason: "可以购买", price };
}

export function purchaseEndlessShopItem(state, id, towerStats) {
  const status = getEndlessShopPurchaseStatus(state, id);
  if (!status.allowed) return status;
  const shop = state.endlessShop;
  state.coins -= status.price;
  shop.spent += status.price;
  if (ENDLESS_RELICS[id]) {
    shop.equippedRelics.push(id);
    shop.relicOffers = shop.relicOffers.filter((offer) => offer !== id);
    if (id === "finalInsurance") shop.insuranceCharges = 1;
  } else {
    const product = ENDLESS_PRODUCTS[id];
    if (id === "emergencyRepair") {
      state.tower.hp = Math.min(towerStats.maxHp, state.tower.hp + towerStats.maxHp * 0.4);
    } else {
      shop.levels[id] = (shop.levels[id] ?? 0) + 1;
    }
    if (product.group === "random" && !shop.cyclePurchases.includes(id)) shop.cyclePurchases.push(id);
    if (product.oncePerRefresh && !shop.cyclePurchases.includes(id)) shop.cyclePurchases.push(id);
    shop.randomOffers = buildRandomOffers(state);
  }
  state.events.push({ type: "endlessShopPurchase", id, price: status.price, relic: Boolean(ENDLESS_RELICS[id]), level: shop.levels[id] ?? 1 });
  return { allowed: true, reason: "购买成功", price: status.price };
}

export function rerollEndlessShop(state) {
  const shop = state.endlessShop;
  const price = ENDLESS_SHOP_RULES.rerollPrices[shop?.rerolls ?? 0];
  if (!shop?.unlocked || price == null) return { allowed: false, reason: "本轮重置次数已用尽", price: Infinity };
  if (bossPresent(state)) return { allowed: false, reason: "首领在场 · 交易锁定", price };
  if (state.coins < price) return { allowed: false, reason: "金币不足", price };
  state.coins -= price;
  shop.spent += price;
  shop.rerolls += 1;
  shop.relicOffers = buildRelicOffers(state);
  shop.randomOffers = buildRandomOffers(state);
  state.events.push({ type: "endlessShopReroll", price, count: shop.rerolls });
  return { allowed: true, reason: "商品已重置", price };
}

export function toggleAutoCoinVacuum(state) {
  if ((state.endlessShop?.levels?.autoCoinVacuum ?? 0) < 1) return false;
  state.endlessShop.autoCoinEnabled = !state.endlessShop.autoCoinEnabled;
  return true;
}
