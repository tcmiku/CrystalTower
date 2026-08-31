export const CHAPTER_TWO_ID = 2;

export const CHAPTER_TWO_CONFIG = Object.freeze({
  name: "极夜航道",
  carrierName: "永耀蜂巢舰",
  finalThreat: 12,
  towerDamageMultiplier: 0.58,
  towerHealthMultiplier: 1.18,
  droneDamageMultiplier: 2.75,
  droneEnergyMultiplier: 1.25,
  sovereignHealthMultiplier: 0.68,
  droneTech: Object.freeze({
    payloadDamagePerLevel: 0.18,
    afterburnerSpeedPerLevel: 0.12,
    afterburnerIntervalReductionPerLevel: 0.08,
    relayRegenPerLevel: 0.25,
    relayCoinEnergyPerLevel: 0.2,
    salvoEveryHits: 4,
    salvoDamageMultiplier: 1.6,
    salvoRadius: 92,
    repairEveryKills: 5,
    repairHealthFraction: 0.035,
    overdriveEnergyThreshold: 0.35,
    overdriveDamageMultiplier: 1.6,
    overdriveEnergyCostMultiplier: 1.35
  }),
  starterUpgrades: Object.freeze({
    drone: 3,
    autoCollect: 1,
    droneBattery: 1
  }),
  enemyNames: Object.freeze({
    wisp: "掠潮艇",
    runner: "穿浪快艇",
    crawler: "布雷艇",
    brute: "铁甲舰",
    sentinel: "护航舰",
    hexer: "导弹巡洋舰",
    rammer: "破浪冲角舰",
    inkHound: "猎潜艇",
    orbitMote: "深潜艇",
    rustBeetle: "锈炉战列舰",
    porcelainWarden: "白瓷防空舰",
    boss: "极夜旗舰",
    colossus: "深海巨舰",
    sovereign: "渊潮王舰"
  })
});

export const CHAPTER_TWO_UPGRADE_META = Object.freeze({
  drone: { icon: "⌁", name: "舰载机库", description: "逐级扩编，最多部署七支无人机", max: 7 },
  autoCollect: { name: "航母指挥核心", description: "开放护航与强袭编队切换" },
  droneScavenge: { name: "深海打捞", description: "更快回收残骸且收益 +25%" },
  droneIntercept: { name: "舰队防空", description: "护航时周期拦截一次重击" },
  droneHunt: { name: "鱼雷标记", description: "标记旗舰并使全部炮火增伤" },
  droneBattery: { name: "甲板储能阵列", description: "每级舰载机能源上限 +25" },
  droneDetonate: { name: "饱和突击", description: "编队优先冲击旗舰与精英舰" },
  droneDetonateRecovery: { name: "自动装配线", description: "缩短损失编队的重建时间" },
  droneGuard: { name: "极光护航", description: "护航编队消耗能源生成舰体护盾" },
  droneGuardRecovery: { name: "应急甲板", description: "缩短护盾过载后的恢复时间" },
  dronePayload: { icon: "✦", name: "重型载荷", description: "每级使无人机撞击与饱和突击伤害 +18%", max: 3 },
  droneAfterburner: { icon: "➤", name: "矢量加力", description: "每级提高 12% 航速并缩短 8% 攻击间隔", max: 3 },
  droneRelay: { icon: "◎", name: "能源中继", description: "每级使护航充能 +25%、残骸回充 +20%", max: 3 },
  droneSalvo: { icon: "✹", name: "协同齐射", description: "每四次无人机命中发射一次范围鱼雷", max: 1 },
  droneRepair: { icon: "⬡", name: "甲板维修群", description: "每五次无人机击沉修复航母 3.5% 最大耐久", max: 1 },
  droneOverdrive: { icon: "ϟ", name: "低能超频", description: "能源低于 35% 时伤害 +60%，单次攻击耗能 +35%", max: 1 }
});

export const CHAPTER_TWO_TECH_ORDER = Object.freeze([
  "drone", "droneScavenge", "autoCollect", "droneIntercept", "droneRelay", "droneBattery",
  "dronePayload", "droneHunt", "droneAfterburner", "droneSalvo", "droneRepair",
  "droneDetonate", "droneDetonateRecovery", "droneGuard", "droneGuardRecovery", "droneOverdrive"
]);

export const CHAPTER_TWO_TECH_TREE = Object.freeze({
  drone: { branch: "economy", baseCost: 70, growth: 1.72, maxLevel: 7, threat: [1, 1, 1, 3, 5, 7, 9] },
  droneScavenge: { branch: "economy", costs: [260], maxLevel: 1, threat: [2], requires: { drone: 3 } },
  autoCollect: { branch: "economy", costs: [1], maxLevel: 1, threat: [1], requires: { drone: 3 } },
  droneIntercept: { branch: "economy", costs: [420], maxLevel: 1, threat: [3], requires: { drone: 3 } },
  droneRelay: { branch: "economy", baseCost: 190, growth: 1.7, maxLevel: 3, threat: [2, 5, 8], requires: { autoCollect: 1 } },
  droneBattery: { branch: "economy", baseCost: 240, growth: 1.72, maxLevel: 3, threat: [3, 6, 9], requires: { droneRelay: 1 } },
  dronePayload: { branch: "economy", baseCost: 230, growth: 1.76, maxLevel: 3, threat: [3, 6, 9], requires: { drone: 4 } },
  droneHunt: { branch: "economy", costs: [620], maxLevel: 1, threat: [5], requires: { dronePayload: 1 } },
  droneAfterburner: { branch: "economy", baseCost: 280, growth: 1.78, maxLevel: 3, threat: [4, 7, 10], requires: { dronePayload: 1 } },
  droneSalvo: { branch: "economy", costs: [820], maxLevel: 1, threat: [7], requires: { dronePayload: 2, droneAfterburner: 1 } },
  droneRepair: { branch: "economy", costs: [760], maxLevel: 1, threat: [7], requires: { droneRelay: 2, droneIntercept: 1 } },
  droneDetonate: { branch: "economy", costs: [680], maxLevel: 1, threat: [7], requires: { droneBattery: 1, dronePayload: 1 }, excludes: ["droneGuard"] },
  droneDetonateRecovery: { branch: "economy", baseCost: 420, growth: 1.72, maxLevel: 3, threat: [8, 10, 11], requires: { droneDetonate: 1 }, excludes: ["droneGuard"] },
  droneGuard: { branch: "economy", costs: [680], maxLevel: 1, threat: [7], requires: { droneBattery: 1, droneIntercept: 1 }, excludes: ["droneDetonate"] },
  droneGuardRecovery: { branch: "economy", baseCost: 420, growth: 1.72, maxLevel: 3, threat: [8, 10, 11], requires: { droneGuard: 1 }, excludes: ["droneDetonate"] },
  droneOverdrive: { branch: "economy", costs: [1800], maxLevel: 1, threat: [11], requires: { dronePayload: 3, droneAfterburner: 3, droneSalvo: 1 } }
});

export const CHAPTER_TWO_BRANCH_META = Object.freeze({
  economy: { icon: "⌁", artKey: "drone", name: "舰载无人机", subtitle: "扩编 · 能源 · 火控 · 舰体保障", routes: ["强袭线 · 载荷与齐射", "护航线 · 中继与维修"], keys: CHAPTER_TWO_TECH_ORDER }
});

export const CHAPTER_TWO_TECH_LAYOUT = Object.freeze({
  economy: {
    rows: 7,
    nodes: {
      drone: [3, 1], droneScavenge: [1, 2], autoCollect: [3, 2], droneIntercept: [5, 2],
      dronePayload: [2, 3], droneRelay: [4, 3], droneHunt: [1, 4], droneAfterburner: [2, 4],
      droneBattery: [4, 4], droneRepair: [5, 4], droneSalvo: [2, 5], droneDetonate: [3, 5],
      droneGuard: [5, 5], droneDetonateRecovery: [3, 6], droneGuardRecovery: [5, 6], droneOverdrive: [2, 7]
    },
    edges: [
      ["drone", "droneScavenge"], ["drone", "autoCollect"], ["drone", "droneIntercept"],
      ["drone", "dronePayload"], ["autoCollect", "droneRelay"], ["dronePayload", "droneHunt"],
      ["dronePayload", "droneAfterburner"], ["droneRelay", "droneBattery"], ["droneRelay", "droneRepair"],
      ["droneIntercept", "droneRepair"], ["droneAfterburner", "droneSalvo"], ["dronePayload", "droneSalvo"],
      ["droneBattery", "droneDetonate"], ["dronePayload", "droneDetonate"], ["droneBattery", "droneGuard"],
      ["droneIntercept", "droneGuard"], ["droneDetonate", "droneDetonateRecovery"],
      ["droneGuard", "droneGuardRecovery"], ["droneSalvo", "droneOverdrive"], ["droneAfterburner", "droneOverdrive"]
    ],
    excludes: [["droneDetonate", "droneGuard"]]
  }
});

export const CHAPTER_TWO_PROTOCOL_META = Object.freeze({
  guard: { name: "近海封锁", hint: "优先攻击最接近航母的敌舰。" },
  hunter: { name: "旗舰猎杀", hint: "优先锁定旗舰、精英舰与导弹舰。" },
  breach: { name: "航路截击", hint: "优先攻击最快进入近海的舰船。" },
  radar: { name: "反潜警戒", hint: "优先锁定深潜艇与远程舰船。" }
});

export function isChapterTwo(state) {
  return state?.chapter === CHAPTER_TWO_ID;
}

export function chooseChapterTwoEnemyType(threat, roll) {
  if (threat < 2) return "wisp";
  if (threat < 3) return roll < 0.62 ? "wisp" : "runner";
  if (threat < 5) return roll < 0.36 ? "runner" : roll < 0.7 ? "wisp" : "brute";
  if (threat < 7) return roll < 0.24 ? "runner" : roll < 0.46 ? "brute" : roll < 0.68 ? "hexer" : "crawler";
  if (threat < 9) return roll < 0.2 ? "hexer" : roll < 0.4 ? "orbitMote" : roll < 0.62 ? "brute" : roll < 0.8 ? "sentinel" : "runner";
  return roll < 0.16 ? "orbitMote" : roll < 0.34 ? "hexer" : roll < 0.51 ? "rammer" : roll < 0.68 ? "rustBeetle" : roll < 0.84 ? "porcelainWarden" : "inkHound";
}
