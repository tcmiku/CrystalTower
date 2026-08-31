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
    overdriveEnergyCostMultiplier: 1.35,
    sortie: Object.freeze({
      formationDuration: 0.55,
      deckRadius: 42,
      fighter: Object.freeze({ ammo: 4, launchEnergy: 8, orbitRadius: 82, orbitSpeed: 2.5, weaponRange: 170, fireInterval: 0.34, projectileSpeed: 610, damageMultiplier: 0.58, refitDuration: 2.2 }),
      attacker: Object.freeze({ ammo: 3, launchEnergy: 12, orbitRadius: 106, orbitSpeed: 1.75, weaponRange: 185, fireInterval: 0.62, projectileSpeed: 500, damageMultiplier: 1.05, heavyDamageMultiplier: 1.3, refitDuration: 3 }),
      bomber: Object.freeze({ ammo: 2, launchEnergy: 18, orbitRadius: 128, orbitSpeed: 1.05, weaponRange: 205, fireInterval: 0.95, projectileSpeed: 390, damageMultiplier: 1.8, heavyDamageMultiplier: 1.55, splashRadius: 76, splashMultiplier: 0.48, refitDuration: 4 })
    })
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
  drone: { icon: "⌁", name: "主动战斗机库", description: "航母主武器；逐级扩编，最多自动出击七支无人机", max: 7 },
  autoCollect: { icon: "◎", name: "磁吸回收甲板", description: "航母自动回收金币与战场残片，不占用无人机" },
  droneScavenge: { icon: "¤", name: "回收增幅舱", description: "航母回收速度提高，且金币收益 +25%" },
  droneIntercept: { icon: "⌁", name: "截击战斗机", description: "战斗机优先拦截高速与远程敌舰，回防时可阻止一次重击" },
  droneHunt: { icon: "➤", name: "雷击攻击机", description: "编入反舰攻击机，优先猎杀巡洋舰与重甲舰" },
  droneBattery: { name: "甲板储能阵列", description: "每级舰载机能源上限 +25" },
  droneDetonate: { name: "饱和突击", description: "编队优先冲击旗舰与精英舰" },
  droneDetonateRecovery: { name: "自动装配线", description: "缩短损失编队的重建时间" },
  droneGuard: { name: "极光护航", description: "护航编队消耗能源生成舰体护盾" },
  droneGuardRecovery: { name: "应急甲板", description: "缩短护盾过载后的恢复时间" },
  dronePayload: { icon: "✦", name: "重型轰炸机联队", description: "解锁轰炸机；后续等级增加单次出击的重型炸弹", max: 3 },
  droneAfterburner: { icon: "➤", name: "甲板弹射器", description: "每级提高出击航速，并缩短编队与返航整备时间", max: 3 },
  droneRelay: { icon: "◎", name: "能源中继", description: "每级使护航充能 +25%、残骸回充 +20%", max: 3 },
  droneSalvo: { icon: "✹", name: "联合编队齐射", description: "三类舰载机累计四次命中后发动范围齐射", max: 1 },
  droneRepair: { icon: "⬡", name: "甲板维修群", description: "每五次无人机击沉修复航母 3.5% 最大耐久", max: 1 },
  droneOverdrive: { icon: "ϟ", name: "紧急再出动", description: "能源低于 35% 时启用高风险武器增幅，强化最后一轮出击", max: 1 }
});

export const CHAPTER_TWO_TECH_ORDER = Object.freeze([
  "drone", "dronePayload", "droneAfterburner", "droneSalvo", "droneHunt", "droneOverdrive",
  "autoCollect", "droneScavenge", "droneRelay", "droneBattery", "droneIntercept", "droneRepair",
  "droneDetonate", "droneDetonateRecovery", "droneGuard", "droneGuardRecovery"
]);

export const CHAPTER_TWO_TECH_TREE = Object.freeze({
  drone: { branch: "economy", baseCost: 70, growth: 1.72, maxLevel: 7, threat: [1, 1, 1, 3, 5, 7, 9] },
  droneScavenge: { branch: "economy", costs: [260], maxLevel: 1, threat: [2], requires: { autoCollect: 1 } },
  autoCollect: { branch: "economy", costs: [1], maxLevel: 1, threat: [1], requires: { drone: 3 } },
  droneIntercept: { branch: "economy", costs: [420], maxLevel: 1, threat: [3], requires: { drone: 3 } },
  droneRelay: { branch: "economy", baseCost: 190, growth: 1.7, maxLevel: 3, threat: [2, 5, 8], requires: { droneScavenge: 1 } },
  droneBattery: { branch: "economy", baseCost: 240, growth: 1.72, maxLevel: 3, threat: [3, 6, 9], requires: { droneRelay: 1 } },
  dronePayload: { branch: "economy", baseCost: 230, growth: 1.76, maxLevel: 3, threat: [1, 5, 9], requires: { drone: 3 } },
  droneHunt: { branch: "economy", costs: [620], maxLevel: 1, threat: [4], requires: { dronePayload: 1 } },
  droneAfterburner: { branch: "economy", baseCost: 280, growth: 1.78, maxLevel: 3, threat: [2, 6, 10], requires: { dronePayload: 1 } },
  droneSalvo: { branch: "economy", costs: [820], maxLevel: 1, threat: [7], requires: { dronePayload: 2, droneAfterburner: 1 } },
  droneRepair: { branch: "economy", costs: [760], maxLevel: 1, threat: [7], requires: { droneRelay: 2, droneIntercept: 1 } },
  droneDetonate: { branch: "economy", costs: [680], maxLevel: 1, threat: [7], requires: { droneBattery: 1, dronePayload: 1 }, excludes: ["droneGuard"] },
  droneDetonateRecovery: { branch: "economy", baseCost: 420, growth: 1.72, maxLevel: 3, threat: [8, 10, 11], requires: { droneDetonate: 1 }, excludes: ["droneGuard"] },
  droneGuard: { branch: "economy", costs: [680], maxLevel: 1, threat: [7], requires: { droneBattery: 1, droneIntercept: 1 }, excludes: ["droneDetonate"] },
  droneGuardRecovery: { branch: "economy", baseCost: 420, growth: 1.72, maxLevel: 3, threat: [8, 10, 11], requires: { droneGuard: 1 }, excludes: ["droneDetonate"] },
  droneOverdrive: { branch: "economy", costs: [1800], maxLevel: 1, threat: [11], requires: { dronePayload: 3, droneAfterburner: 3, droneSalvo: 1 } }
});

export const CHAPTER_TWO_BRANCH_META = Object.freeze({
  economy: { icon: "⌁", artKey: "drone", name: "航母舰载航空群", subtitle: "截击 · 反舰 · 重型轰炸 · 返航整备", routes: ["舰载机主轴 · 战斗机 → 攻击机 → 轰炸机", "出击循环 · 离舰 → 编队 → 开火 → 返航补给", "航母支援轴 · 回收甲板 → 中继 → 维修"], keys: CHAPTER_TWO_TECH_ORDER }
});

export const CHAPTER_TWO_TECH_LAYOUT = Object.freeze({
  economy: {
    rows: 7,
    nodes: {
      autoCollect: [1, 1], drone: [3, 1], droneIntercept: [5, 1],
      droneScavenge: [1, 2], dronePayload: [3, 2], droneHunt: [5, 2],
      droneRelay: [1, 3], droneAfterburner: [3, 3], droneRepair: [5, 3],
      droneBattery: [1, 4], droneSalvo: [3, 4],
      droneDetonate: [2, 5], droneGuard: [4, 5],
      droneDetonateRecovery: [2, 6], droneGuardRecovery: [4, 6], droneOverdrive: [3, 7]
    },
    edges: [
      ["autoCollect", "droneScavenge"], ["drone", "dronePayload"], ["drone", "droneIntercept"],
      ["droneScavenge", "droneRelay"], ["dronePayload", "droneHunt"],
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
  guard: { name: "航母护航", short: "近舰防御", hint: "舰载机只拦截进入航母警戒圈的敌舰，并分守不同方向。" },
  hunter: { name: "集中打击", short: "全队集火", hint: "所有机型集中攻击同一艘最高威胁敌舰，适合快速击沉首领。" },
  breach: { name: "分散清扫", short: "多点猎杀", hint: "编队主动拆分目标，优先清除低耐久敌舰，减少火力浪费。" },
  radar: { name: "分层协同", short: "机型分工", hint: "战斗机截击、攻击机反舰、轰炸机攻坚，各自选择擅长目标。" }
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
