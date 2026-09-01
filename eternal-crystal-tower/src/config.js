export const GAME_CONFIG = Object.freeze({
  arena: {
    width: 960,
    height: 720,
    centerX: 480,
    centerY: 360,
    // The wide desktop camera exposes substantially more world on the left and
    // right than the original 4:3 arena. Rays are intersected with this box so
    // every enemy enters through a visible map edge, including diagonal waves.
    spawnRing: { centerX: 480, centerY: 360, radiusX: 790, radiusY: 390, ingressArc: 1.16, radialJitter: 10 }
  },
  fixedStep: 1 / 60,
  tower: { maxHp: 600, damage: 12, fireRate: 1.2, range: 360, radius: 38, projectileSpeed: 650, healthBarDuration: 3.2 },
  cannon: {
    siege: { chargeBonusPerStack: 0.12, maxChargeStacks: 3, piercePerLevel: 1, bossDamagePerLevel: 0.18, weakpointChancePerLevel: 0.16, weakpointDuration: 3.2, weakpointDamageMultiplier: 1.35, starPiercerDamageMultiplier: 5.5, starPiercerDuration: 0.42 },
    split: { projectileCount: 2, damageMultiplier: 0.46, life: 0.82, radius: 3.8, growthHopsPerLevel: 1, growthRange: 190, echoRadius: 78, echoDamageMultiplier: 0.38, cascadeKills: 3, cascadeWindow: 2.4, cascadeCooldown: 1.15, cascadeRadius: 190, cascadeDamageMultiplier: 3.2, cascadeDuration: 0.72 }
  },
  threat: { duration: 45, hpGrowth: 1.16, damageGrowth: 1.1, rewardGrowth: 1.08, spawnDecay: 0.91, spawnBase: 1.55, spawnMin: 0.34, dayWaves: 2, nightWaves: 2, packGrowthEvery: 4, maxPack: 3, bossEvery: 10 },
  threatSeals: {
    longNight: { resourceBonus: 0.08, scoreBonus: 0.08, relicChanceBonus: 0.03, achievementBonus: 0.15, nightWaves: 3, elementMultiplier: 1.25 },
    severedSupply: { resourceBonus: 0.12, scoreBonus: 0.15, relicChanceBonus: 0.04, achievementBonus: 0.2, coinMultiplier: 2 },
    frenzy: { resourceBonus: 0.15, scoreBonus: 0.18, relicChanceBonus: 0.12, achievementBonus: 0.25, waveCountMultiplier: 1.3, relicChoiceBonus: 1 },
    colossus: { resourceBonus: 0.2, scoreBonus: 0.2, relicChanceBonus: 0.08, achievementBonus: 0.3, spawnThreat: 12, emberCoreBonus: 6 },
    flawless: { resourceBonus: 0.12, scoreBonus: 0.15, relicChanceBonus: 0.06, achievementBonus: 0.2, healCooldownMultiplier: 1.65, skillDamageMultiplier: 1.3 }
  },
  unlocks: { doubleSpeedThreat: 10 },
  waves: { firstAt: 90, interval: 90, warning: 10, spawnInterval: 0.2, baseCount: 14, countPerThreat: 3, eliteHpMultiplier: 3.2, eliteDamageMultiplier: 1.45, eliteRewardMultiplier: 3 },
  endless: { baseEliteChance: 0.06, eliteChancePerThreat: 0.01, eliteChanceCap: 0.24, waveBaseElites: 2, waveElitePerThreat: 4, waveEliteCap: 6 },
  eliteAffixes: {
    order: ["shield", "sprint", "devour", "split"],
    shield: { shieldFraction: 0.55 },
    sprint: { speedMultiplier: 1.55 },
    devour: { radius: 150, interval: 0.55, healFraction: 0.12 },
    split: { count: 2, hpMultiplier: 0.42, damageMultiplier: 0.6, rewardMultiplier: 0.2, radiusMultiplier: 0.72, speedMultiplier: 1.15 }
  },
  boss: {
    phaseThresholds: [0.7, 0.4], resistances: ["frost", "fire", "lightning"], elementDamageMultiplier: 0.35,
    anchorRoles: ["shield", "repair", "summon", "overload"], anchorCount: 4, anchorRadius: 210, anchorLockDuration: 5, anchorClickPadding: 14,
    shieldDamageMultiplier: 0.45, repairPerSecond: 0.012, summonInterval: 3.5, summonTypes: ["wisp", "runner", "crawler"], overloadAttackIntervalMultiplier: 0.55
  },
  colossus: {
    spawnThreat: 15,
    healthBars: 2,
    spawnShieldFraction: 0.42,
    phaseBreakInvulnerability: 0.7,
    orbitRadiusX: 390,
    orbitRadiusY: 278,
    orbitSpeed: 0.12,
    intentDuration: 1.25,
    skillCooldown: 3.2,
    skillOrder: ["artillery", "summon", "beam", "bulwark"],
    enrageThreshold: 0.5,
    enrageDamageMultiplier: 1.35,
    enrageOrbitSpeedMultiplier: 1.55,
    enrageCooldownMultiplier: 0.62,
    enrageIntentMultiplier: 0.58,
    enrageParallelStagger: 0.72,
    enrageParallelCooldownMultiplier: 1.35,
    affixOrder: ["siege", "brood", "prism", "carapace"],
    affixes: {
      siege: { artilleryIntervalMultiplier: 0.7, artilleryDamageMultiplier: 1.22 },
      brood: { summonCountBonus: 3, summonIntervalMultiplier: 0.72 },
      prism: { beamTickMultiplier: 0.68, beamDamageMultiplier: 1.22 },
      carapace: { healthMultiplier: 1.28, passiveDamageMultiplier: 0.88 }
    },
    artillery: { duration: 3.2, interval: 0.52, projectileSpeed: 285, projectileLife: 3, damageMultiplier: 0.34, radius: 11 },
    summon: { duration: 3.4, interval: 0.72, count: 5, telegraphDuration: 0.62, types: ["runner", "crawler", "hexer", "rammer"] },
    beam: { duration: 2.8, tickInterval: 0.42, damageMultiplier: 0.22 },
    bulwark: { duration: 3.6, damageMultiplier: 0.38, orbitSpeedMultiplier: 2.25 },
    counters: { artilleryAnchorHp: 260, artilleryShotMultiplier: 0.45, exposedDuration: 4.5, exposedDamageMultiplier: 1.5, riftHp: 150, bulwarkHeat: 55 }
  },
  sovereign: {
    spawnThreat: 20,
    healthBars: 4,
    fixedX: 480,
    fixedY: 138,
    towerX: 480,
    towerY: 600,
    towerScale: 0.72,
    entryDuration: 3.2,
    phaseBreakInvulnerability: 0.85,
    spawnShieldFraction: 0.65,
    shieldBreakSummonDelay: 0.55,
    intentDuration: 1.05,
    skillCooldown: 2.65,
    skillOrder: ["summon", "artillery", "summon", "beam", "summon", "bulwark"],
    enrageHealthBar: 1,
    enrageDamageMultiplier: 1.45,
    enrageCooldownMultiplier: 0.52,
    rangedSlowDuration: 4.5,
    rangedSlowMultiplier: 0.58,
    artillery: { duration: 3.3, interval: 0.62, projectileSpeed: 300, projectileLife: 3, damageMultiplier: 0.3, radius: 13 },
    summon: { duration: 3.7, interval: 1.05, portalsPerWave: 4, waves: 3, empoweredHealthBar: 2, empoweredDuration: 6.2, empoweredPortalsPerWave: 7, empoweredWaves: 5, elitePerWave: 1, enragedEliteBonus: 1, telegraphDuration: 0.72, types: ["inkHound", "runner", "hexer", "rammer", "porcelainWarden"] },
    beam: { duration: 2.7, tickInterval: 0.46, damageMultiplier: 0.2 },
    bulwark: { duration: 3.4, damageMultiplier: 0.34 }
  },
  upgrades: {
    damage: { baseCost: 20, growth: 1.55, multiplier: 1.25 },
    rate: { baseCost: 25, growth: 1.65, multiplier: 1.15, cap: 5 },
    ascend: { costs: [180, 900, 2400], damage: [1, 1.5, 2.25, 3.35], rate: [1, 1.15, 1.3, 1.55], rangePerLevel: 40, hpPerLevel: 200, maxLevel: 3 },
    saw: { baseCost: 65, growth: 1.68, maxLevel: 8, damage: 18, growthDamage: 0.15, towerDamageMultiplier: 0.4, radius: 118, orbitSpread: 14, bladeRadius: 17, hitInterval: 0.24 },
    sawOverdrive: { speedPerLevel: 0.28, damagePerLevel: 0.3, gunRatePerLevel: 0.1, scarDamagePerStack: 0.05, scarMaxStacks: 6, scarDuration: 2 },
    sawAccelerator: { speedMultiplier: 1.55 },
    sawMagnitude: { radiusMultiplier: 1.45 },
    sawBreathing: { radiusCenter: 1.08, radiusAmplitude: 0.3, angularSpeed: 1.75 },
    sawGun: { damage: 0.35, damagePerLevel: 0.2, fireRate: 0.5, fireRatePerLevel: 0.22, range: 350, projectileSpeed: 450, pierceLevel: 2, elementLevel: 3, elementChanceMultiplier: 0.6 },
    sawLaunch: { projectileSpeed: 440, returnSpeed: 520, range: 430, damageMultiplier: 2.2, towerDamageMultiplier: 1, bounceDamagePerHop: 0.25, bossRehitDelay: 0.2, baseBounces: 1, bounceRange: 290, flightLife: 3.4, radius: 18, launchInterval: 0.35, baseRecovery: 2.8, recoveryMultiplier: 0.7 },
    sawStorm: { radius: 205, damageMultiplier: 1.8, duration: 0.5 },
    sawHomecoming: { returnDamageMultiplier: 2, recoveryReductionPerHit: 0.15, maxRecoveryReduction: 0.75, burstRadius: 145, burstDamageMultiplier: 1.25, duration: 0.55 }
  },
  elements: {
    frost: { chance: 0.18, freezeDuration: 1.2, bossEffectMultiplier: 0.25 },
    fire: { chance: 0.16, burnDuration: 3, burnTick: 0.5, burnDamageMultiplier: 0.65, bossEffectMultiplier: 0.4 },
    lightning: { chance: 0.14, chainCount: 3, chainRange: 138, chainMultiplier: 0.62, bossEffectMultiplier: 0.45 }
  },
  techTree: {
    damage: { branch: "power", baseCost: 20, growth: 1.55, maxLevel: 10, threat: [1, 1, 2, 2, 3, 4, 5, 6, 8, 10] },
    rate: { branch: "power", baseCost: 25, growth: 1.65, maxLevel: 8, threat: [1, 2, 2, 3, 4, 5, 7, 9], requires: { damage: 1 } },
    ascend: { branch: "power", costs: [180, 900, 2400], maxLevel: 3, threat: [3, 7, 8], requiresByLevel: [{ damage: 2, rate: 1 }, { damage: 5, rate: 3 }, { frost: 1, fire: 1, lightning: 1 }] },
    saw: { branch: "blade", baseCost: 65, growth: 1.68, maxLevel: 8, threat: [2, 3, 4, 6, 8, 9, 10, 11], requires: { damage: 1 } },
    sawOverdrive: { branch: "blade", baseCost: 175, growth: 1.8, maxLevel: 3, threat: [5, 7, 9], requires: { saw: 3 }, excludes: ["sawLaunch", "sawHomecoming"] },
    sawAccelerator: { branch: "blade", costs: [180], maxLevel: 1, threat: [5], requires: { sawOverdrive: 1 }, excludes: ["sawLaunch", "sawHomecoming"] },
    sawMagnitude: { branch: "blade", costs: [190], maxLevel: 1, threat: [5], requires: { sawOverdrive: 1 }, excludes: ["sawLaunch", "sawHomecoming"] },
    sawBreathing: { branch: "blade", costs: [220], maxLevel: 1, threat: [6], requires: { sawOverdrive: 1 }, excludes: ["sawLaunch", "sawHomecoming"] },
    sawGun: { branch: "blade", baseCost: 200, growth: 1.9, maxLevel: 3, threat: [6, 8, 10], requires: { sawOverdrive: 1, sawAccelerator: 1, sawMagnitude: 1, sawBreathing: 1 }, excludes: ["sawLaunch", "sawHomecoming"] },
    sawStorm: { branch: "blade", costs: [1200], maxLevel: 1, threat: [12], requires: { sawOverdrive: 3, sawGun: 3 }, excludes: ["sawLaunch", "sawHomecoming"] },
    sawLaunch: { branch: "blade", costs: [190], maxLevel: 1, threat: [5], requires: { saw: 3 }, excludes: ["sawOverdrive", "sawGun", "sawStorm"] },
    sawRicochet: { branch: "blade", baseCost: 210, growth: 1.7, maxLevel: 3, threat: [6, 8, 10], requires: { sawLaunch: 1 } },
    sawRecovery: { branch: "blade", baseCost: 165, growth: 1.65, maxLevel: 3, threat: [6, 7, 9], requires: { sawLaunch: 1 } },
    sawHomecoming: { branch: "blade", costs: [1200], maxLevel: 1, threat: [12], requires: { sawLaunch: 1, sawRicochet: 3, sawRecovery: 3 }, excludes: ["sawOverdrive", "sawGun", "sawStorm"] },
    drone: { branch: "economy", baseCost: 55, growth: 1.8, maxLevel: 5, threat: [2, 3, 4, 5, 6], requires: { damage: 1 } },
    autoCollect: { branch: "economy", costs: [520], maxLevel: 1, threat: [6], requires: { drone: 3 } },
    droneScavenge: { branch: "economy", costs: [300], maxLevel: 1, threat: [5], requires: { drone: 2 } },
    droneIntercept: { branch: "economy", costs: [480], maxLevel: 1, threat: [6], requires: { drone: 3 } },
    droneHunt: { branch: "economy", costs: [720], maxLevel: 1, threat: [7], requires: { autoCollect: 1, damage: 3 } },
    droneBattery: { branch: "economy", baseCost: 260, growth: 1.75, maxLevel: 3, threat: [6, 8, 10], requires: { drone: 3, autoCollect: 1 } },
    droneDetonate: { branch: "economy", costs: [420], maxLevel: 1, threat: [7], requires: { droneBattery: 1 }, excludes: ["droneGuard"] },
    droneDetonateRecovery: { branch: "economy", baseCost: 360, growth: 1.75, maxLevel: 3, threat: [8, 10, 12], requires: { droneDetonate: 1 }, excludes: ["droneGuard"] },
    droneGuard: { branch: "economy", costs: [420], maxLevel: 1, threat: [7], requires: { droneBattery: 1 }, excludes: ["droneDetonate"] },
    droneGuardRecovery: { branch: "economy", baseCost: 360, growth: 1.75, maxLevel: 3, threat: [8, 10, 12], requires: { droneGuard: 1 }, excludes: ["droneDetonate"] },
    frost: { branch: "element", costs: [260], maxLevel: 1, threat: [4], towerLevel: 2, requires: { damage: 2 } },
    fire: { branch: "element", costs: [420], maxLevel: 1, threat: [6], towerLevel: 2, requires: { damage: 4 } },
    lightning: { branch: "element", costs: [760], maxLevel: 1, threat: [8], towerLevel: 3, requires: { rate: 3 } },
    cannonSiege: { branch: "cannon", costs: [360], maxLevel: 1, threat: [5], requires: { damage: 3 }, excludes: ["cannonSplit"] },
    cannonCharge: { branch: "cannon", baseCost: 180, growth: 1.65, maxLevel: 3, threat: [6, 8, 10], requires: { cannonSiege: 1 } },
    cannonPierce: { branch: "cannon", baseCost: 240, growth: 1.75, maxLevel: 3, threat: [7, 9, 11], requires: { cannonSiege: 1 } },
    cannonWeakpoint: { branch: "cannon", baseCost: 280, growth: 1.8, maxLevel: 3, threat: [8, 10, 12], requires: { cannonSiege: 1 } },
    cannonStarPiercer: { branch: "cannon", costs: [1500], maxLevel: 1, threat: [13], requires: { cannonCharge: 3, cannonPierce: 3, cannonWeakpoint: 3 } },
    cannonSplit: { branch: "cannon", costs: [360], maxLevel: 1, threat: [5], requires: { damage: 3 }, excludes: ["cannonSiege"] },
    cannonGrowth: { branch: "cannon", baseCost: 180, growth: 1.65, maxLevel: 3, threat: [6, 8, 10], requires: { cannonSplit: 1 } },
    cannonEcho: { branch: "cannon", baseCost: 280, growth: 1.8, maxLevel: 3, threat: [7, 9, 11], requires: { cannonSplit: 1 } },
    cannonCascade: { branch: "cannon", costs: [1500], maxLevel: 1, threat: [13], requires: { cannonGrowth: 3, cannonEcho: 3 } }
  },
  coins: { clickRadius: 24, maxOrbs: 80, collectDuration: 0.42, lifetime: 10, blinkStart: 7, droneInterval: 1.25, droneOrbitRadius: 148, towerInterval: 5 },
  relics: {
    initialSlots: 1,
    maxSlots: 4,
    decoy: { hp: 240, radius: 27, distance: 270, explosionRadius: 155, explosionDamageMultiplier: 5, survivalCoins: 42 },
    lunar: { dayCoinMultiplier: 1.25, nightElementMultiplier: 1.4, transitionDuration: 6, transitionDamageMultiplier: 1.2, transitionRateMultiplier: 1.15 },
    mirror: { everyShots: 5, refractRange: 280, refractDamageMultiplier: 0.65 },
    ember: { duration: 4.2, radius: 72, tickInterval: 0.45, damageMultiplier: 0.55, coinLifetimeMultiplier: 0.55, maxZones: 12 },
    ward: { kills: 20, shieldFraction: 0.12, maxShieldFraction: 0.5 },
    frostbloom: { radius: 105, damageMultiplier: 1.5, freezeDuration: 0.8 },
    stormglass: { extraChains: 2, rangeMultiplier: 1.2, chainMultiplier: 0.72 },
    gilded: { chance: 0.24, bonusMultiplier: 0.75 },
    execution: { hpThreshold: 0.35, damageMultiplier: 1.4 },
    hourglass: { cooldownRateMultiplier: 1.75 },
    prismArc: { chainCount: 3, chainRange: 190, chainMultiplier: 0.52 },
    frostfire: { freezeDuration: 0.55, damageMultiplier: 0.72 },
    decoyWard: { shieldFraction: 0.18 },
    numeric: { damage: 0.08, rate: 0.06, hybridDamage: 0.04, hybridRate: 0.03 },
    endless: { damagePerStack: 0.08, ratePerStack: 0.05 }
  },
  relicResearch: { ward: 0, decoy: 3, lunar: 4, mirror: 5, ember: 6, frostbloom: 7, stormglass: 9, gilded: 11, execution: 13, hourglass: 15 },
  relicCombos: {
    prismArc: { requires: ["mirror", "stormglass"], set: ["mirror", "stormglass", "prismArc"] },
    frostfire: { requires: ["frostbloom", "ember"], set: ["frostbloom", "ember", "frostfire"] },
    decoyWard: { requires: ["decoy", "ward"], set: ["decoy", "ward", "decoyWard"] }
  },
  relicSlotResearch: { costs: [2, 4, 7] },
  relicUpgradeResearch: { maxLevel: 3, costs: [4, 8, 12], effectPerLevel: 0.12 },
  relicArchiveResearch: { initialDisabledSlots: 1, maxDisabledSlots: 3, costs: [8, 16] },
  activeSkillResearch: {
    costs: [3, 6],
    heal: {
      branches: {
        guardian: { name: "晶壳守护", description: "把晶愈变成低血量的安全网", nodes: [
          { id: "reinforcedCore", name: "强化晶核", effect: "治疗量 +30%，过量治疗护盾转化 +35%" },
          { id: "lastStand", name: "绝境护膜", effect: "生命低于 35% 释放后，获得 5 秒 35% 减伤" }
        ] },
        retaliation: { name: "晶片反制", description: "把满盾受击变成推线窗口", nodes: [
          { id: "repulse", name: "反冲晶片", effect: "满盾晶片爆炸额外击退敌人" },
          { id: "shardBurst", name: "碎晶增幅", effect: "晶片爆炸伤害 +80%，并扩大爆炸半径" }
        ] }
      },
      burstKnockbackDistance: 80, bossKnockbackMultiplier: 0.3, lowHpThreshold: 0.35, damageReduction: 0.35, damageReductionDuration: 5, burstDamageMultiplier: 1.8, burstRadiusMultiplier: 1.2,
      healMultiplier: 1.3, shieldMultiplier: 1.35
    },
    overload: {
      branches: {
        sustain: { name: "稳压回路", description: "延长超载窗口，换取更安全的热量曲线", nodes: [
          { id: "stabilizer", name: "稳压线圈", effect: "持续时间 +25%，热量积累速度 -25%" },
          { id: "coolingVent", name: "冷却泄压", effect: "提前结束后，超载减速惩罚时间 -50%" }
        ] },
        rupture: { name: "临界爆裂", description: "主动泄压，把热量转成一次爆发", nodes: [
          { id: "pressureValve", name: "压力阀门", effect: "提前结束时，根据当前热量提高冲击击退" },
          { id: "thermalNova", name: "热核爆裂", effect: "结束时造成范围伤害，过热时伤害 +60%" }
        ] }
      },
      durationMultiplier: 1.25, heatGainMultiplier: 0.75, earlyPulseBonus: 0.8, damageMultiplier: 3, overheatDamageMultiplier: 1.6
    },
    starfall: {
      branches: {
        precision: { name: "精准轨道", description: "扩大锁定区，并让主炮追击暴露目标", nodes: [
          { id: "wideReticle", name: "扩展瞄准", effect: "手动瞄准扇区扩大 30%" },
          { id: "starMark", name: "星痕标记", effect: "命中留下 5 秒星痕，主炮伤害 +30%" }
        ] },
        bombardment: { name: "轨道轰击", description: "牺牲稳定性，换取多目标终结", nodes: [
          { id: "counterBurst", name: "反制落星", effect: "命中 3 个目标或打断首领后追加小型落星" },
          { id: "impactField", name: "坠星余场", effect: "追加落星范围 +35%，伤害 +25%" }
        ] }
      },
      coneMultiplier: 1.3, markDuration: 5, markDamageMultiplier: 1.3, followupMinHits: 3, followupRadius: 105, followupDamageMultiplier: 2.5, followupDuration: 0.45, followupRadiusMultiplier: 1.35, followupDamageBoost: 1.25
    },
    coinVacuum: {
      branches: {
        salvage: { name: "回收循环", description: "稳定提高资源转化与技能周转", nodes: [
          { id: "magnet", name: "末秒磁吸", effect: "优先回收将消失金币，金币价值 +12%" },
          { id: "cooldownLoop", name: "冷却回路", effect: "吸收 8 枚金币后，下一主动技能冷却 -20%" }
        ] },
        conversion: { name: "火力转化", description: "少拿即时收益，换取晶塔短时爆发", nodes: [
          { id: "surge", name: "金潮脉冲", effect: "吸收 15 枚金币后，晶塔攻速 +25% 持续 7 秒" },
          { id: "overdrive", name: "价值过载", effect: "吸收 20 枚金币后，晶塔伤害 +20% 持续 7 秒" }
        ] }
      },
      valueMultiplier: 1.12, cooldownThreshold: 8, cooldownReduction: 0.2, buffThreshold: 15, buffDuration: 7, fireRateMultiplier: 1.25, damageMultiplier: 1.2, damageBuffThreshold: 20
    }
  },
  permanentResources: { clickRadius: 30, maxDrops: 72, eliteEcho: 2, bossCore: 3, colossusCore: 8, sovereignCore: 15 },
  score: {
    enemy: { wisp: 100, runner: 120, crawler: 150, brute: 300, hexer: 350, sentinel: 450, rammer: 500, inkHound: 260, orbitMote: 390, rustBeetle: 520, porcelainWarden: 480, boss: 5000, colossus: 20000, sovereign: 50000 },
    eliteMultiplier: 4,
    coinMultiplier: 10,
    leaderboardSize: 10, leaderboardMessageMaxLength: 10
  },
  drones: {
    attackSpeed: 285, returnSpeed: 340, damageMultiplier: 0.22, hitInterval: 0.45, contactRadius: 13,
    energyMax: 100, batteryCapacityPerLevel: 25, guardRegenPerSecond: 5, coinEnergy: 18, attackDrainPerSecond: 5, hitEnergyCost: 7, minAttackEnergy: 15,
    scavengeIntervalMultiplier: 0.55, scavengeValueMultiplier: 1.25,
    interceptRecharge: 16,
    huntMarkDuration: 6, huntDamageMultiplier: 1.35,
    detonate: { damageMultiplier: 4.5, radius: 126, triggerDistance: 28, energyCost: 28, recoveryDuration: 10, recoveryMultiplier: 0.78 },
    guard: { drainPerSecond: 10, shieldPerEnergy: 3.1, shieldMax: 180, shieldPerBattery: 28, shieldDecayPerSecond: 22, cooldown: 10, cooldownMultiplier: 0.78 }
  },
  skills: {
    heal: { cooldown: 30, fraction: 0.2, shieldCapFraction: 0.35, burstRadius: 260, burstDamageMultiplier: 3, burstDuration: 0.55 },
    overload: { cooldown: 25, duration: 6, rateMultiplier: 2, passiveHeatPerSecond: 5, heatPerVolley: 5, heatCap: 120, overheatThreshold: 90, slowDuration: 3, slowRateMultiplier: 0.6, coolPerSecond: 24, knockbackRadius: 360, knockbackDistance: 100, bossKnockbackMultiplier: 0.35, pulseDuration: 0.55 },
    starfall: { cooldown: 45, damageMultiplier: 6, coneHalfAngle: 0.42, activeDuration: 0.8 },
    coinVacuum: { cooldown: 45, activeDuration: 0.75 }
  },
  enemies: {
    wisp: { hp: 18, speed: 46, damage: 7, reward: 5, radius: 14 },
    runner: { hp: 12, speed: 80, damage: 5, reward: 4, radius: 11 },
    brute: { hp: 85, speed: 24, damage: 20, reward: 14, radius: 23 },
    crawler: { hp: 22, speed: 66, damage: 8, reward: 6, radius: 13 },
    sentinel: { hp: 145, speed: 20, damage: 27, reward: 22, radius: 28 },
    hexer: { hp: 58, speed: 31, damage: 13, reward: 11, radius: 17, attackRange: 145 },
    rammer: { hp: 118, speed: 49, damage: 31, reward: 25, radius: 25 },
    inkHound: { hp: 38, speed: 102, damage: 10, reward: 8, radius: 13 },
    orbitMote: { hp: 72, speed: 40, damage: 16, reward: 14, radius: 19, attackRange: 165 },
    rustBeetle: { hp: 132, speed: 18, damage: 25, reward: 21, radius: 26 },
    porcelainWarden: { hp: 108, speed: 28, damage: 19, reward: 18, radius: 22 },
    boss: { hp: 900, speed: 16, damage: 42, reward: 180, radius: 48 },
    colossus: { hp: 5000, speed: 0, damage: 58, reward: 620, radius: 76 },
    sovereign: { hp: 2800, speed: 0, damage: 76, reward: 1500, radius: 128 },
    anchor: { hp: 115, speed: 0, damage: 0, reward: 0, radius: 17 }
  },
  research: { bonusPerLevel: 0.05, maxLevel: 30, costBase: 2, costGrowth: 1.3 },
  combat: {
    enemyAttackInterval: 0.7,
    maxEnemies: 420,
    normalEnemyBudget: 240,
    crowdRadiusPerDoubling: 0.14,
    crowdMaxRadiusMultiplier: 1.55,
    crowdVisualScalePerDoubling: 0.12,
    crowdMaxVisualScale: 1.8
  }
});

export function getCrowdVisualScale(unitCount = 1) {
  const count = Number.isFinite(Number(unitCount)) ? Math.max(1, Number(unitCount)) : 1;
  return Math.min(
    GAME_CONFIG.combat.crowdMaxVisualScale,
    1 + Math.log2(count) * GAME_CONFIG.combat.crowdVisualScalePerDoubling
  );
}

export function getArenaEdgePosition(angle, outward = 0) {
  const ring = GAME_CONFIG.arena.spawnRing;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const edgeDistance = 1 / Math.max(Math.abs(dx) / ring.radiusX, Math.abs(dy) / ring.radiusY, Number.EPSILON);
  const distance = edgeDistance + Math.max(0, outward);
  return {
    x: ring.centerX + dx * distance,
    y: ring.centerY + dy * distance
  };
}

export const TECH_ORDER = ["damage", "rate", "ascend", "cannonSiege", "cannonCharge", "cannonPierce", "cannonWeakpoint", "cannonStarPiercer", "cannonSplit", "cannonGrowth", "cannonEcho", "cannonCascade", "saw", "sawOverdrive", "sawAccelerator", "sawMagnitude", "sawBreathing", "sawGun", "sawStorm", "sawLaunch", "sawRicochet", "sawRecovery", "sawHomecoming", "drone", "droneScavenge", "autoCollect", "droneBattery", "droneDetonate", "droneDetonateRecovery", "droneGuard", "droneGuardRecovery", "droneIntercept", "droneHunt", "frost", "fire", "lightning"];
export const UPGRADE_ORDER = TECH_ORDER;
export const SKILL_ORDER = ["heal", "overload", "starfall", "coinVacuum"];
export const TARGET_PROTOCOL_ORDER = ["guard", "hunter", "breach", "radar"];
