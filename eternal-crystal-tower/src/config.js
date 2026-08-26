export const GAME_CONFIG = Object.freeze({
  arena: { width: 960, height: 720, centerX: 480, centerY: 360 },
  fixedStep: 1 / 60,
  tower: { maxHp: 600, damage: 12, fireRate: 1.2, range: 360, radius: 38, projectileSpeed: 650 },
  threat: { duration: 45, hpGrowth: 1.16, damageGrowth: 1.1, rewardGrowth: 1.08, spawnDecay: 0.91, spawnBase: 1.55, spawnMin: 0.34, dayWaves: 2, nightWaves: 2, packGrowthEvery: 4, maxPack: 3, bossEvery: 10 },
  waves: { firstAt: 90, interval: 90, warning: 10, spawnInterval: 0.2, baseCount: 14, countPerThreat: 3, eliteHpMultiplier: 3.2, eliteDamageMultiplier: 1.45, eliteRewardMultiplier: 3 },
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
  upgrades: {
    damage: { baseCost: 20, growth: 1.55, multiplier: 1.25 },
    rate: { baseCost: 25, growth: 1.65, multiplier: 1.15, cap: 5 },
    ascend: { costs: [180, 900, 2400], damage: [1, 1.5, 2.25, 3.35], rate: [1, 1.15, 1.3, 1.55], rangePerLevel: 40, hpPerLevel: 200, maxLevel: 3 },
    saw: { baseCost: 70, growth: 1.75, maxLevel: 5, damage: 16, growthDamage: 0.1, radius: 104, hitInterval: 0.24 },
    sawOverdrive: { speedPerLevel: 0.28, damagePerLevel: 0.22 },
    sawGun: { damage: 0.28, damagePerLevel: 0.12, fireRate: 0.5, fireRatePerLevel: 0.22, range: 330, projectileSpeed: 430 },
    sawLaunch: { projectileSpeed: 420, range: 410, damageMultiplier: 1.6, baseBounces: 1, bounceRange: 270, flightLife: 3, radius: 18, launchInterval: 0.35, baseRecovery: 3.4, recoveryMultiplier: 0.76 }
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
    saw: { branch: "blade", baseCost: 70, growth: 1.75, maxLevel: 5, threat: [2, 3, 4, 6, 8], requires: { damage: 1 } },
    sawOverdrive: { branch: "blade", baseCost: 190, growth: 1.9, maxLevel: 3, threat: [5, 7, 9], requires: { saw: 3 }, excludes: ["sawLaunch"] },
    sawGun: { branch: "blade", baseCost: 220, growth: 2, maxLevel: 3, threat: [6, 8, 10], requires: { sawOverdrive: 1 }, excludes: ["sawLaunch"] },
    sawLaunch: { branch: "blade", costs: [210], maxLevel: 1, threat: [5], requires: { saw: 3 }, excludes: ["sawOverdrive", "sawGun"] },
    sawRicochet: { branch: "blade", baseCost: 230, growth: 1.8, maxLevel: 3, threat: [6, 8, 10], requires: { sawLaunch: 1 } },
    sawRecovery: { branch: "blade", baseCost: 180, growth: 1.75, maxLevel: 3, threat: [6, 7, 9], requires: { sawLaunch: 1 } },
    drone: { branch: "economy", baseCost: 55, growth: 1.8, maxLevel: 3, threat: [2, 3, 4], requires: { damage: 1 } },
    autoCollect: { branch: "economy", costs: [520], maxLevel: 1, threat: [6], requires: { drone: 3 } },
    droneScavenge: { branch: "economy", costs: [300], maxLevel: 1, threat: [5], requires: { drone: 2 } },
    droneIntercept: { branch: "economy", costs: [480], maxLevel: 1, threat: [6], requires: { drone: 3 } },
    droneHunt: { branch: "economy", costs: [720], maxLevel: 1, threat: [7], requires: { autoCollect: 1, damage: 3 } },
    frost: { branch: "element", costs: [260], maxLevel: 1, threat: [4], towerLevel: 2, requires: { damage: 2 } },
    fire: { branch: "element", costs: [420], maxLevel: 1, threat: [6], towerLevel: 2, requires: { damage: 4 } },
    lightning: { branch: "element", costs: [760], maxLevel: 1, threat: [8], towerLevel: 3, requires: { rate: 3 } }
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
    hourglass: { cooldownRateMultiplier: 1.22 },
    numeric: { damage: 0.08, rate: 0.06, hybridDamage: 0.04, hybridRate: 0.03 }
  },
  relicResearch: { ward: 0, decoy: 3, lunar: 4, mirror: 5, ember: 6, frostbloom: 7, stormglass: 9, gilded: 11, execution: 13, hourglass: 15 },
  relicSlotResearch: { costs: [2, 4, 7] },
  permanentResources: { clickRadius: 30, maxDrops: 72, eliteEcho: 2, bossCore: 3, colossusCore: 8 },
  score: {
    enemy: { wisp: 100, runner: 120, crawler: 150, brute: 300, hexer: 350, sentinel: 450, rammer: 500, boss: 5000, colossus: 20000 },
    eliteMultiplier: 4,
    coinMultiplier: 10,
    leaderboardSize: 10
  },
  drones: {
    attackSpeed: 285, returnSpeed: 340, damageMultiplier: 0.22, hitInterval: 0.45, contactRadius: 13,
    energyMax: 100, guardRegenPerSecond: 5, coinEnergy: 18, attackDrainPerSecond: 5, hitEnergyCost: 7, minAttackEnergy: 15,
    scavengeIntervalMultiplier: 0.55, scavengeValueMultiplier: 1.25,
    interceptRecharge: 16,
    huntMarkDuration: 6, huntDamageMultiplier: 1.35
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
    boss: { hp: 900, speed: 16, damage: 42, reward: 180, radius: 48 },
    colossus: { hp: 5000, speed: 0, damage: 58, reward: 620, radius: 76 },
    anchor: { hp: 115, speed: 0, damage: 0, reward: 0, radius: 17 }
  },
  research: { bonusPerLevel: 0.05, maxLevel: 10 },
  combat: { enemyAttackInterval: 0.7, maxEnemies: 420, normalEnemyBudget: 240, crowdRadiusPerDoubling: 0.14, crowdMaxRadiusMultiplier: 1.55 }
});

export const TECH_ORDER = ["damage", "rate", "ascend", "saw", "sawOverdrive", "sawGun", "sawLaunch", "sawRicochet", "sawRecovery", "drone", "droneScavenge", "autoCollect", "droneIntercept", "droneHunt", "frost", "fire", "lightning"];
export const UPGRADE_ORDER = TECH_ORDER;
export const SKILL_ORDER = ["heal", "overload", "starfall", "coinVacuum"];
export const TARGET_PROTOCOL_ORDER = ["guard", "hunter", "breach", "radar"];
