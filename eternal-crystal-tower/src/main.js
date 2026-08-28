import { GAME_CONFIG, SKILL_ORDER, TECH_ORDER } from "./config.js";
import { calculateAchievementProgress, calculateRunScore, calculateStardust, chooseRelic, lockRelicChoice, collectCoinAt, collectPermanentResourceAt, createGameState, cycleTargetProtocol, getDroneDetonateRecovery, getDroneEnergyMax, getTechStatus, getThreatSealModifiers, getTowerPosition, getTowerStats, getUpgradeCost, lockAnchorAt, offerRelicChoice, purchaseUpgrade, setTargetProtocol, spawnEnemy, spawnPermanentResourceDrop, toggleDroneDetonate, toggleDroneMode, updateGame, useSkill } from "./engine.js";
import { seedFromUrl } from "./rng.js";
import { buyRelicArchiveUpgrade, buyRelicSlot, buyRelicUpgrade, buyResearch, buySkillResearch, defaultSave, discoverHiddenRelic, grantChapterCoreEnergy, grantPermanentResource, loadSave, markBaseRecoverySeen, registerFailure, relicArchiveCapacity, relicUpgradeCost, repairChapterNode, researchCost, SAVE_KEY, sanitizeLeaderboardMessage, sanitizePlayerName, setDisabledRelic, skillResearchCost, toggleRelicSet, toggleThreatSeal, unlockDoubleSpeed, writeSave } from "./storage.js";
import { fetchLeaderboard, postLeaderboardEntry } from "./leaderboard-api.js";
import { fetchGithubCommits } from "./github-updates.js";
import { deleteAccount, loginAccount, logoutAccount, readCloudSave, registerAccount, restoreSession, writeCloudSave } from "./account-api.js";
import { AudioSynth } from "./audio.js";
import { Renderer } from "./renderer.js";

const UPGRADE_META = {
  damage: { icon: "✦", name: "淬亮晶矢", description: "每级伤害 +25%", max: 10 },
  rate: { icon: "⌁", name: "加速咏唱", description: "每级攻速 +15%", max: 8 },
  ascend: { icon: "◇", name: "唤醒塔阶", description: "三元素共鸣后融合万象", max: 3 },
  cannonSiege: { icon: "▣", name: "破城炮膛", description: "单体专精：锁定首领与精英，开启蓄能、穿透与弱点路线", max: 1 },
  cannonCharge: { icon: "◈", name: "蓄能晶矢", description: "连续攻击同一目标，每层使后续晶矢伤害 +12%", max: 3 },
  cannonPierce: { icon: "➤", name: "贯星穿透", description: "晶矢穿透敌人；每级提高穿透次数并使首领伤害 +18%", max: 3 },
  cannonWeakpoint: { icon: "⌖", name: "弱点校准", description: "攻击首领或精英有概率暴露弱点，短时间承伤 +35%", max: 3 },
  cannonStarPiercer: { icon: "━", name: "贯星炮", description: "蓄能满层时，对 Boss 或精英发射无视护盾的贯星激光", max: 1 },
  cannonSplit: { icon: "✣", name: "裂晶炮膛", description: "群体专精：命中后分裂晶矢，开启增殖与晶爆路线", max: 1 },
  cannonGrowth: { icon: "✧", name: "碎片增殖", description: "分裂晶矢命中后继续寻找附近目标，逐级增加追击次数", max: 3 },
  cannonEcho: { icon: "✹", name: "晶爆回响", description: "击杀敌人时产生小范围晶爆，对周围敌人造成伤害", max: 3 },
  cannonCascade: { icon: "✺", name: "裂界连爆", description: "晶爆在短时间内连续击杀 3 个敌人后，触发大型连锁爆炸", max: 1 },
  saw: { icon: "✺", name: "环绕晶刃", description: "增加一枚近身晶刃", max: 5 },
  sawOverdrive: { icon: "◌", name: "疾旋锻刃", description: "专精：提高环速与接触伤害", max: 3 },
  sawGun: { icon: "➶", name: "晶刃炮膛", description: "疾旋分支：保留并强化金色弹幕", max: 3 },
  sawLaunch: { icon: "➤", name: "弹射飞刃", description: "专精：发射晶刃并禁用晶刃弹幕", max: 1 },
  sawRicochet: { icon: "⌁", name: "折跃棱面", description: "飞刃命中后增加一次弹射", max: 3 },
  sawRecovery: { icon: "↻", name: "快速重铸", description: "缩短飞刃返回前的恢复时间", max: 3 },
  drone: { icon: "⌁", name: "拾荒无人机", description: "最多五架，逐级增加自动拾币无人机", max: 5 },
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
  power: { icon: "✦", name: "晶塔火力", subtitle: "基础强化 · 炮膛专精", routes: ["路线 A · 破城炮膛", "路线 B · 裂晶炮膛"], keys: ["damage", "rate", "cannonSiege", "cannonCharge", "cannonPierce", "cannonWeakpoint", "cannonStarPiercer", "cannonSplit", "cannonGrowth", "cannonEcho", "cannonCascade", "ascend"] },
  blade: { icon: "✺", name: "环刃工事", subtitle: "疾旋或弹射路线", routes: ["路线 A · 疾旋炮刃", "路线 B · 弹射飞刃"], keys: ["saw", "sawOverdrive", "sawGun", "sawLaunch", "sawRicochet", "sawRecovery"] },
  economy: { icon: "⌁", name: "无人机协议", subtitle: "拾荒 · 战术 · 防御", routes: ["路线 A · 自爆猎杀", "路线 B · 防御护盾"], keys: ["drone", "droneScavenge", "autoCollect", "droneIntercept", "droneHunt", "droneBattery", "droneDetonate", "droneDetonateRecovery", "droneGuard", "droneGuardRecovery"] },
  element: { icon: "◇", name: "元素共鸣", subtitle: "三元素可同时研究", keys: ["frost", "fire", "lightning"] }
};
const TECH_LAYOUT = {
  power: {
    rows: 4,
    nodes: { damage: [2, 1], rate: [4, 1], cannonSiege: [1, 2], cannonSplit: [3, 2], cannonCharge: [1, 3], cannonPierce: [2, 3], cannonWeakpoint: [3, 3], cannonGrowth: [4, 3], cannonEcho: [5, 3], cannonStarPiercer: [1, 4], cannonCascade: [5, 4], ascend: [3, 4] },
    edges: [["damage", "rate"], ["damage", "cannonSiege"], ["damage", "cannonSplit"], ["cannonSiege", "cannonCharge"], ["cannonSiege", "cannonPierce"], ["cannonSiege", "cannonWeakpoint"], ["cannonCharge", "cannonStarPiercer"], ["cannonPierce", "cannonStarPiercer"], ["cannonWeakpoint", "cannonStarPiercer"], ["cannonSplit", "cannonGrowth"], ["cannonSplit", "cannonEcho"], ["cannonGrowth", "cannonCascade"], ["cannonEcho", "cannonCascade"], ["rate", "ascend"]],
    excludes: [["cannonSiege", "cannonSplit"]]
  },
  blade: {
    rows: 3,
    nodes: { saw: [3, 1], sawOverdrive: [2, 2], sawLaunch: [4, 2], sawGun: [2, 3], sawRicochet: [4, 3], sawRecovery: [5, 3] },
    edges: [["saw", "sawOverdrive"], ["saw", "sawLaunch"], ["sawOverdrive", "sawGun"], ["sawLaunch", "sawRicochet"], ["sawLaunch", "sawRecovery"]],
    excludes: [["sawOverdrive", "sawLaunch"]]
  },
  economy: {
    rows: 5,
    nodes: { drone: [3, 1], droneScavenge: [1, 2], autoCollect: [3, 2], droneIntercept: [5, 2], droneHunt: [2, 3], droneBattery: [4, 3], droneDetonate: [3, 4], droneGuard: [5, 4], droneDetonateRecovery: [3, 5], droneGuardRecovery: [5, 5] },
    edges: [["drone", "droneScavenge"], ["drone", "autoCollect"], ["drone", "droneIntercept"], ["autoCollect", "droneHunt"], ["autoCollect", "droneBattery"], ["droneBattery", "droneDetonate"], ["droneBattery", "droneGuard"], ["droneDetonate", "droneDetonateRecovery"], ["droneGuard", "droneGuardRecovery"]],
    excludes: [["droneDetonate", "droneGuard"]]
  },
  element: { rows: 3, nodes: { frost: [1, 2], fire: [3, 2], lightning: [5, 2] }, edges: [], excludes: [] }
};
const TECH_ART = {
  power: { sheet: "./assets/generated/tech-icons-power-v2.png", cols: 5, rows: 2 },
  blade: { sheet: "./assets/generated/tech-icons-blade-v2.png", cols: 3, rows: 2 },
  economy: { sheet: "./assets/generated/tech-icons-drone-v2.png", cols: 5, rows: 2 },
  element: { sheet: "./assets/generated/tech-icons-element-v2.png", cols: 3, rows: 1 }
};
const SKILL_META = {
  heal: { key: "Q", name: "晶愈", description: "满盾后受击引爆晶片", tooltip: "恢复晶塔生命；生命已满时转化为护盾，满盾受击会引爆晶片。", art: "./assets/generated/skill-heal-ai-v1.png", icon: `<svg class="skill-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5.2c0 4.2-2.7 7.6-7 9.8-4.3-2.2-7-5.6-7-9.8V6l7-3Z"></path><path d="M12 7v7M8.5 10.5h7"></path></svg>` },
  overload: { key: "W", name: "超载", description: "再按 W 提前释放冲击", tooltip: "短时间提升攻速并持续积热；再次按 W 可提前释放冲击。", art: "./assets/generated/skill-overload-ai-v1.png", icon: `<svg class="skill-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m13.4 2-7 10h5.2L10.8 22l7-11h-5.1L13.4 2Z"></path><path d="M4 6h2M18 18h2"></path></svg>` },
  starfall: { key: "E", name: "星落", description: "手动选择轰击方向", tooltip: "选择方向轰击敌群，造成范围伤害，并可打断巨兽射线。", art: "./assets/generated/skill-starfall-ai-v1.png", icon: `<svg class="skill-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2 1.5 5.2 5.3 1.4-5.3 1.5L13 15l-1.5-4.9-5.3-1.5 5.3-1.4L13 2Z"></path><path d="m19 14 .7 2.4 2.3.6-2.3.7L19 20l-.7-2.3-2.3-.7 2.3-.6L19 14ZM4 19l5-5"></path></svg>` },
  coinVacuum: { key: "F", name: "金潮归塔", description: "立即吸收全场金币", tooltip: "立即吸收全场金币，将它们送回晶塔并触发金币结算。", art: "./assets/generated/skill-coin-vacuum-ai-v1.png", icon: `<svg class="skill-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.5"></circle><path d="M12 5.8v4.4M10.4 8h3.2M5 16h12"></path><path d="m15 13 2.5 3-2.5 3M17.5 16H8"></path></svg>` }
};
const ACTIVE_SKILL_RESEARCH_META = {
  heal: { protocol: "生存协议" },
  overload: { protocol: "临界协议" },
  starfall: { protocol: "轨道协议" },
  coinVacuum: { protocol: "经济协议" }
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
  prismArc: { icon: "ϟ◇", art: "./assets/generated/relic-mirror-ai.png", name: "折光雷晶", type: "隐藏 · 折射回路", description: "镜面折射命中后，从第二目标继续释放折线闪电。", effect: "折射后额外连锁 3 个目标" },
  frostfire: { icon: "❉♨", art: "./assets/generated/relic-ember-ai.png", name: "霜烬共生核", type: "隐藏 · 冰火回路", description: "霜葬爆发会在原地留下同时冻结与灼烧的冰火区域。", effect: "霜爆生成持续冰火区域" },
  decoyWard: { icon: "◈⬡", art: "./assets/generated/relic-decoy-ai.png", name: "棱光替身", type: "隐藏 · 防御回路", description: "诱饵被摧毁后将爆炸余波转化为晶塔护盾。", effect: "诱饵爆炸后获得 18% 最大生命护盾" },
  "boost:damage": { icon: "✦", art: "./assets/generated/relic-boost-ai.png", name: "晶矢增幅", type: "缺口强化", description: "栏位多于已解锁遗物，将富余能量灌注主炮。", effect: "本局攻击力 +8% · 可重复" },
  "boost:rate": { icon: "⌁", art: "./assets/generated/relic-boost-ai.png", name: "咏唱增幅", type: "缺口强化", description: "栏位多于已解锁遗物，以富余能量缩短咏唱。", effect: "本局攻击速度 +6% · 可重复" },
  "boost:hybrid": { icon: "✧", art: "./assets/generated/relic-boost-ai.png", name: "双相增幅", type: "缺口强化", description: "栏位多于已解锁遗物，将富余能量均衡分配。", effect: "本局攻击力 +4% · 攻速 +3%" },
  "boost:endless": { icon: "∞", art: "./assets/generated/relic-endless-amplifier-ai.png", name: "无界增幅核", type: "无尽专属 · 无限叠层", description: "每肃清一轮无尽怪潮，核心便复制一层火力回路；不占用遗物栏位。", effect: "每层攻击力 +8% · 攻击速度 +5%" }
};
const RELIC_SET_META = {
  prismArc: { name: "雷镜折光套", hint: "镜面裂片 + 雷脉导体", effect: "发现折光雷晶；登记后优先补齐三件套" },
  frostfire: { name: "霜烬轮回套", hint: "霜葬花冠 + 余烬回收", effect: "发现霜烬共生核；登记后优先补齐三件套" },
  decoyWard: { name: "棱光诱饵套", hint: "诡光诱饵 + 棱镜护佑", effect: "发现棱光替身；登记后优先补齐三件套" }
};
const THREAT_SEAL_META = {
  longNight: { name: "长夜封印", type: "天象扭曲", risk: "长夜由 2 个威胁阶段延长至 3 个；夜间元素效果 +25%", reward: "资源 +8% · 排名 +8% · 特殊遗物 +3% · 成就 ×1.15", art: 0 },
  severedSupply: { name: "断供封印", type: "后勤封锁", risk: "无人机无法拾取金币；手动拾币与金潮归塔仍可使用", reward: "敌人金币 ×2 · 资源 +12% · 排名 +15% · 成就 ×1.20", art: 1 },
  frenzy: { name: "狂潮封印", type: "怪潮增殖", risk: "每轮怪潮敌人数量 +30%", reward: "高品质遗物候选 +1 · 资源 +15% · 特殊遗物 +12% · 排名 +18% · 成就 ×1.25", art: 2 },
  colossus: { name: "巨兽封印", type: "灾厄召引", risk: "虚环吞星兽由威胁 XV 提前至威胁 XII", reward: "击败后额外掉落余烬核心 · 资源 +20% · 排名 +20% · 成就 ×1.30", art: 3 },
  flawless: { name: "无伤封印", type: "治疗禁约", risk: "晶愈冷却 +65%", reward: "伤害型技能 +30% · 资源 +12% · 排名 +15% · 成就 ×1.20", art: 4 }
};
const RELIC_SOURCE_TEXT = {
  eliteWave: "怪潮精英已被肃清，选择一项回路继续守望。",
  boss: "腐化首领已经倒下，回收一项战场模块。",
  colossusPhase: "巨兽命核破碎，从暴露的回路中夺取一项模块。",
  colossusDefeat: "虚环吞星兽崩解，选择最后一项战利品。",
  sealElite: "威胁封印撕开了特殊回路，选择一项额外遗物。",
  endlessWave: "无尽怪潮已被完全肃清。无界增幅核正在复制下一层火力回路。"
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
  "scoreText", "openLeaderboardButton", "openUpdatesButton", "updatesModal", "closeUpdatesButton", "updatesDismissButton", "updatesList", "updatesSyncStatus", "updatesCurrentVersion", "updatesCurrentDate", "accountButton", "accountModal", "closeAccountButton", "accountGuestPanel", "deleteLocalSaveButton", "accountUserPanel", "saveChoicePanel", "loginForm", "loginUsername", "loginPassword", "showRegisterButton", "registerForm", "registerUsername", "registerPassword", "showLoginButton", "accountAvatar", "accountUsername", "accountSyncStatus", "syncSaveButton", "logoutButton", "deleteAccountButton", "useCloudSaveButton", "useLocalSaveButton", "cloudSaveSummary", "localSaveSummary", "accountStatus", "leaderboardModal", "closeLeaderboardButton", "globalLeaderboardList", "globalLeaderboardCount", "globalLeaderboardPodium", "gameOverModal", "gameOverTitle", "gameOverLine", "resultTime", "resultKills", "resultThreat", "resultStardust", "resultScore", "resultCombatScore", "resultCoinScore", "resultScoreMultiplier", "resultSealAchievement", "endEndlessButton",
  "scoreEntryForm", "playerNameInput", "playerMessageInput", "submitScoreButton", "scoreEntryStatus", "leaderboardList", "leaderboardCount", "stardustText", "researchList", "restartButton", "clearSaveButton",
  "loadingScreen", "loadingProgress", "loadingStatus", "loadingPercent", "storyIntro", "storyIntroStage", "storyIntroBackdrop", "storyIntroLayers", "storyIntroBubbles", "storyIntroChapter", "storyIntroProgress", "storyIntroTimeline", "storyIntroDisable", "storyIntroSkip", "storyIntroNext", "tutorialGuide", "tutorialTitle", "tutorialText", "tutorialChoices", "tutorialDismiss",
  "openBaseCampButton", "battleEchoShardText", "battleCoreFragmentText", "baseRecoveryModal", "recoveryEventTitle", "recoveryEventText", "recoveryContinueButton",
  "baseCampModal", "baseCampShell", "closeBaseCampButton", "baseCampEchoShardText", "baseCampCoreFragmentText", "baseCampStardustText", "baseCampModuleList", "baseCampModulePage", "closeBaseCampModuleButton", "baseCampModulePageIcon", "baseCampModulePageKicker", "baseCampModulePageTitle", "baseCampModulePageSummary", "baseCampModulePageStatus", "campaignPanel", "campaignProgressText", "chapterNodeList", "nexusPanel", "relicResearchPanel", "relicArchivePanel", "relicArchiveProgress", "relicArchiveDisabledList", "relicArchiveCodexList", "relicArchiveSetList", "threatSealPanel", "threatSealUnlockStatus", "threatSealList", "sealScoreMultiplier", "sealResourceMultiplier", "sealRelicChance", "sealAchievementMultiplier", "sealEquippedSummary", "sealAchievementProgress", "relicResearchList", "relicResearchEchoText", "relicResearchCoreText", "relicSlotResearch", "relicResearchTab", "skillResearchTab", "relicResearchView", "skillResearchView", "activeSkillResearchList", "openBaseCampFromGameOver", "resultEchoShards", "resultCoreFragments", "chapterCompleteModal", "chapterCoreAwardStatus", "finishExpeditionButton", "startEndlessButton",
  "relicRunHud", "threatSealHud", "relicChoiceModal", "relicChoiceTitle", "relicChoiceSource", "relicChoiceSlots", "relicChoiceList", "relicChoiceKeys"
].map((id) => [id, document.getElementById(id)]));

const BASECAMP_MODULES = [
  {
    key: "campaign",
    panelId: "campaignPanel",
    category: "远征",
    name: "能源核心",
    description: "装配章节能源，选择远征地图",
    art: "./assets/generated/basecamp-module-campaign-v1.png",
    icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 24 14 7l5 9 7-4-5 13-7-5-8 4Z"/><path d="m14 7 1 13"/></svg>'
  },
  {
    key: "nexus",
    panelId: "nexusPanel",
    category: "成长",
    name: "晶核中枢",
    description: "永久研究与核心档案",
    art: "./assets/generated/basecamp-module-nexus-v1.png",
    icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 9 7-3 14-6 5-6-5-3-14 9-7Z"/><path d="m16 8 4 5-4 10-4-10 4-5Z"/></svg>'
  },
  {
    key: "relics",
    panelId: "relicResearchPanel",
    category: "成长",
    name: "研究舱 · 战术模块",
    description: "遗物强化与主动技能协议",
    art: "./assets/generated/basecamp-module-relics-v1.png",
    icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 4h8M14 4v8L7 24c-1 2 1 4 3 4h12c2 0 4-2 3-4l-7-12V4"/><path d="M10 21h12M12 17h8"/></svg>'
  },
  {
    key: "archive",
    panelId: "relicArchivePanel",
    category: "构筑",
    name: "遗物档案馆",
    description: "图鉴、禁用与套装登记",
    art: "./assets/generated/basecamp-module-archive-v1.png",
    icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 9 11-5 11 5-11 5L5 9Z"/><path d="m5 15 11 5 11-5M5 21l11 6 11-6"/></svg>'
  },
  {
    key: "seals",
    panelId: "threatSealPanel",
    category: "挑战",
    name: "封印圣坛",
    description: "提高风险与远征收益",
    art: "./assets/generated/basecamp-module-seals-v1.png",
    icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 26 7v8c0 7-4 11-10 14C10 26 6 22 6 15V7l10-4Z"/><path d="m12 16 3 3 6-7"/></svg>'
  }
];
let save = loadSave();
let runIndex = 0;
const baseSeed = seedFromUrl(location.search);
let state = createGameState(baseSeed, save.research, save.relicUnlocks, save.relicSlots, save.relicArchive, save.threatSeals.equipped, save.skillResearch);
const previewMode = new URLSearchParams(location.search).get("preview");
const INTRO_SCENES = [
  { background: "./assets/story/intro-bg-city-dawn-v1.png", layers: [], chapter: "序章 · 晶核纪元", bubbles: [{ text: "昔日，晶核照亮世界。", kind: "narration", position: "top-left" }], motion: "motion-push", tone: "dawn", duration: 2600 },
  { background: "./assets/story/intro-bg-ruined-wasteland-v1.png", layers: [], chapter: "序章 · 破碎之日", bubbles: [{ text: "直到那天，晶核破碎。", kind: "narration", position: "top-left" }], motion: "motion-shake", tone: "rupture", duration: 2400 },
  { background: "./assets/story/intro-bg-ruined-wasteland-v1.png", layers: [{ src: "./assets/story/intro-layer-monster-horde-v1.png", className: "layer-horde layer-horde-focus" }], chapter: "序章 · 长夜降临", bubbles: [{ text: "黑夜与怪物吞没了大陆。", kind: "narration", position: "top-left" }], motion: "motion-pan-right", tone: "night", duration: 2500 },
  { background: "./assets/story/intro-bg-last-bastion-v1.png", layers: [{ src: "./assets/story/intro-layer-last-tower-v1.png", className: "layer-tower" }], chapter: "序章 · 最后的晶塔", bubbles: [{ text: "如今，只剩永耀晶塔。", kind: "narration", position: "top-left" }], motion: "motion-rise", tone: "tower", duration: 2600 },
  { background: "./assets/story/intro-bg-last-bastion-v1.png", layers: [{ src: "./assets/story/intro-layer-last-tower-v1.png", className: "layer-tower" }, { src: "./assets/story/intro-layer-guardian-v1.png", className: "layer-guardian-left" }], chapter: "序章 · 守望者", bubbles: [{ text: "晶塔选择了最后的守望者。", kind: "narration", position: "top-left" }, { text: "我……能守住吗？", kind: "speech", position: "right" }], motion: "motion-pull", tone: "guardian", duration: 3000 },
  { background: "./assets/story/intro-bg-horde-night-v1.png", layers: [{ src: "./assets/story/intro-layer-monster-horde-v1.png", className: "layer-horde layer-horde-distant" }, { src: "./assets/story/intro-layer-elemental-burst-v1.png", className: "layer-elemental layer-elemental-behind" }, { src: "./assets/story/intro-layer-last-tower-v1.png", className: "layer-tower layer-tower-final" }], chapter: "序章 · 第一波防线", bubbles: [{ text: "检测到共鸣者。", kind: "system", position: "top-right" }, { text: "怪潮来袭。守住最后的光。", kind: "narration", position: "bottom-right" }], motion: "motion-flare", tone: "final", duration: 3200 }
];
const INTRO_MOTIONS = ["motion-push", "motion-shake", "motion-pan-right", "motion-rise", "motion-pull", "motion-flare"];
const introAssetsNeeded = previewMode === "intro" || save.settings.introDisabled !== true;
if (introAssetsNeeded) {
  for (const scene of INTRO_SCENES) {
    const preload = new Image();
    preload.src = scene.background;
    for (const layer of scene.layers) {
      const layerPreload = new Image();
      layerPreload.src = layer.src;
    }
  }
}
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
  const types = ["wisp", "runner", "crawler", "brute", "sentinel", "hexer", "rammer", "inkHound", "orbitMote", "rustBeetle", "porcelainWarden"];
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
}
if (previewMode === "drones") {
  state.threat = 6;
  state.phase = "day";
  state.time = 225.2;
  state.wave.nextAt = 999;
  state.spawnTimer = 999;
  state.coins = 100_000;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect");
  toggleDroneMode(state);
  spawnEnemy(state, "brute", { x: 710, y: 250 });
  spawnEnemy(state, "sentinel", { x: 720, y: 470 });
  spawnEnemy(state, "crawler", { x: 260, y: 220 });
}
if (previewMode === "astral-enemies") {
  state.threat = 6;
  state.phase = "night";
  state.time = 270;
  state.wave.nextAt = 999;
  state.spawnTimer = 999;
  state.tower.fireCooldown = 999;
  const previewEnemies = [
    ["inkHound", { x: 690, y: 210 }],
    ["orbitMote", { x: 720, y: 330 }],
    ["rustBeetle", { x: 675, y: 480 }],
    ["porcelainWarden", { x: 300, y: 220 }]
  ];
  for (const [type, position] of previewEnemies) {
    const enemy = spawnEnemy(state, type, position);
    enemy.speed = 0;
    enemy.hp = enemy.maxHp = 100_000;
  }
  state.paused = true;
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
if (previewMode === "basecamp" || previewMode === "nexus" || previewMode === "relic-research" || previewMode === "skill-research" || previewMode === "relic-archive" || previewMode === "threat-seals" || previewMode === "recovery") {
  save.baseCamp.unlocked = true;
  save.baseCamp.coreEcho = true;
  save.baseCamp.recoverySeen = previewMode === "basecamp" || previewMode === "nexus" || previewMode === "relic-research" || previewMode === "skill-research" || previewMode === "relic-archive" || previewMode === "threat-seals";
  save.resources.echoShards = Math.max(save.resources.echoShards, 42);
  save.resources.coreFragments = Math.max(save.resources.coreFragments, 7);
  save.resources.echoShards = Math.max(save.resources.echoShards, 28);
  save.resources.coreFragments = Math.max(save.resources.coreFragments, 9);
  if (previewMode === "nexus") {
    save.stardust = 100000;
    for (const key of Object.keys(save.research)) save.research[key] = 0;
  }
  if (previewMode === "skill-research") {
    save.resources.echoShards = Math.max(save.resources.echoShards, 80);
    save.resources.coreFragments = Math.max(save.resources.coreFragments, 24);
    save.skillResearch = {
      heal: { branch: "guardian", nodes: ["reinforcedCore", "lastStand"] },
      overload: { branch: "rupture", nodes: ["pressureValve"] },
      starfall: { branch: "precision", nodes: ["wideReticle", "starMark"] },
      coinVacuum: { branch: null, nodes: [] }
    };
  }
  if (previewMode === "relic-archive") {
    for (const id of [...Object.keys(GAME_CONFIG.relicResearch), ...Object.keys(GAME_CONFIG.relicCombos)]) save.relicArchive.discovered[id] = true;
    save.relicArchive.registeredSets.prismArc = true;
    save.relicArchive.exclusionLevel = 2;
    save.relicArchive.disabledRelics = ["ember", "lunar", "gilded"];
    save.relicArchive.upgrades.mirror = 2;
    save.relicArchive.upgrades.ember = 3;
  }
  if (previewMode === "threat-seals") {
    save.campaign.coreEnergy[1] = true;
    save.campaign.chapterRecords[1].cleared = true;
    save.threatSeals.unlocked = true;
    save.threatSeals.equipped = ["longNight", "frenzy", "colossus"];
  }
}
if (previewMode === "relic-lock") {
  state.relics.available = ["mirror", "ember", "lunar"];
  state.relics.slots = 3;
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
if (previewMode === "cannon-star") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.paused = true; state.threat = 13; state.phase = "night";
  state.tower.upgrades.ascend = 3;
  const elite = spawnEnemy(state, "brute", { x: 735, y: 275 }, { elite: true, affix: "shield" });
  elite.speed = 0;
  const tower = getTowerPosition(state);
  state.elementFx.push({ element: "starPiercer", x1: tower.x, y1: tower.y, x2: elite.x, y2: elite.y, life: 999, maxLife: 999 });
}
if (previewMode === "cannon-cascade") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.paused = true; state.threat = 13; state.phase = "night";
  state.tower.upgrades.ascend = 3;
  const center = { x: 650, y: 360 };
  const targets = [];
  for (let index = 0; index < 7; index += 1) {
    const angle = index * Math.PI * 2 / 7;
    const enemy = spawnEnemy(state, index % 2 ? "runner" : "brute", { x: center.x + Math.cos(angle) * 125, y: center.y + Math.sin(angle) * 125 });
    enemy.speed = 0;
    targets.push({ x: enemy.x, y: enemy.y });
  }
  state.elementFx.push({ element: "cannonCascade", x: center.x, y: center.y, radius: GAME_CONFIG.cannon.split.cascadeRadius, targets, life: .42, maxLife: .72 });
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
if (previewMode === "sovereign" || previewMode === "sovereign-entry") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = GAME_CONFIG.sovereign.spawnThreat; state.time = 855; state.phase = "night";
  const sovereign = spawnEnemy(state, "sovereign");
  sovereign.entryTimer = GAME_CONFIG.sovereign.entryDuration; sovereign.phaseBreakInvulnerability = GAME_CONFIG.sovereign.entryDuration;
  sovereign.hp = sovereign.maxHp; sovereign.healthBar = 4;
  state.tower.upgrades.ascend = 3; state.tower.upgrades.damage = 8; state.tower.upgrades.rate = 5;
  state.tower.fireCooldown = 999;
  state.tower.hp = getTowerStats(state).maxHp;
  sovereign.skillCooldown = 999;
}
if (previewMode === "sovereign-skills") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = GAME_CONFIG.sovereign.spawnThreat; state.time = 855; state.phase = "night";
  const sovereign = spawnEnemy(state, "sovereign");
  sovereign.entryTimer = 0; sovereign.phaseBreakInvulnerability = 0;
  sovereign.hp = sovereign.maxHp * .72; sovereign.healthBar = 2; sovereign.spawnShield = 0;
  sovereign.activeSkill = "summon"; sovereign.skillTimer = GAME_CONFIG.sovereign.summon.empoweredDuration; sovereign.summonWavesRemaining = 1;
  sovereign.skillTick = 999;
  state.tower.upgrades.ascend = 3; state.tower.upgrades.damage = 8; state.tower.upgrades.rate = 5;
  state.tower.fireRateSuppression = GAME_CONFIG.sovereign.rangedSlowDuration;
  const riftPositions = [[155,260],[355,315],[605,315],[805,260],[480,425],[245,410],[715,410]];
  riftPositions.forEach(([x, y], index) => state.summonRifts.push({ id: state.nextId++, bossId: sovereign.id, enemyType: GAME_CONFIG.sovereign.summon.types[index % GAME_CONFIG.sovereign.summon.types.length], x, y, life: 1.8, maxLife: 1.8, attackable: false, targetId: null, elite: index === 0 }));
  state.hostileProjectiles.push({ id: state.nextId++, kind: "sovereignMortar", x: sovereign.x, y: sovereign.y + 48, vx: 0, vy: 0, targetX: 480, targetY: 540, radius: 13, life: 1.1, damage: 30 });
  state.events.push({ type: "sovereignRiftWave", enemyId: sovereign.id, count: 7, eliteCount: 1, empowered: true });
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect"); purchaseUpgrade(state, "droneBattery"); purchaseUpgrade(state, "droneDetonate");
  const boss = spawnEnemy(state, "boss", { x: 730, y: 360 });
  boss.speed = 0; boss.hp = boss.maxHp = 100_000;
}
if (previewMode === "drone-energy") {
  state.spawnTimer = 999; state.wave.nextAt = 999; state.threat = 8; state.coins = 100_000;
  purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
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
if (previewMode === "tower-health") {
  state.threat = 8;
  state.phase = "night";
  state.time = 318;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.upgrades.ascend = 2;
  const previewStats = getTowerStats(state);
  state.tower.hp = previewStats.maxHp * 0.28;
  state.tower.shield = previewStats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction * 0.58;
  state.tower.healthBarTimer = GAME_CONFIG.tower.healthBarDuration;
  state.paused = true;
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
if (previewMode === "leaderboard" || previewMode === "leaderboard-messages") {
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.time = 367;
  state.threat = 9;
  state.stats = { kills: 128, bossKills: 2, highestThreat: 9, score: 38_450 };
  state.coins = 237;
  state.tower.hp = 0;
}
if (previewMode === "chapter-complete") {
  state.threat = 20;
  state.time = 900;
  state.paused = true;
  save.baseCamp.unlocked = true;
  save.campaign.coreEnergy[1] = true;
}
let runSettled = false;
let scoreSubmitted = false;
let scoreSubmitting = false;
let currentRunScore = null;
let currentRunMode = "standard";
let currentEntryDate = null;
let leaderboardEntries = [];
let leaderboardLoading = true;
let leaderboardError = "";
let lastFrame = performance.now();
let accumulator = 0;
let toastTimer = 0;
let announcementTimer = 0;
let techTreeOpen = false;
let activeTechBranch = "power";
let selectedTechKey = "damage";
let resumeAfterTechTree = false;
let leaderboardModalOpen = false;
let updatesModalOpen = false;
let pendingStartupFlow = null;
let pendingIntroFlow = null;
let introOpen = false;
let introSceneIndex = 0;
let introTimer = 0;
let resumeAfterIntro = false;
let resumeAfterUpdates = false;
let accountModalOpen = false;
let resumeAfterAccount = false;
let currentAccount = null;
let cloudSyncEnabled = false;
let pendingCloudSave = null;
let cloudSaveQueue = Promise.resolve();
let accountAuthMode = "login";
let resumeAfterLeaderboard = false;
let baseCampOpen = false;
let baseCampRoom = null;
let researchBayTab = "relics";
let resumeAfterBaseCamp = false;
let relicChoiceOpen = false;
let resumeAfterRelicChoice = false;
let relicHudSignature = "";
let sealHudSignature = "";
let recoveryEventStep = 0;
let firstFailureFlow = false;
let starfallAiming = false;
let doubleSpeedActive = previewMode === "speed";
let sovereignSpeedLocked = false;
let restoreDoubleSpeedAfterSovereign = false;
let chapterCompleteOpen = false;
let chapterClearWasFirst = false;
const firstRunTutorial = save.records.totalKills === 0 && !previewMode;
let tutorialStep = 0;
const loadingStartedAt = performance.now();
const renderer = new Renderer(dom.gameCanvas, updateLoadingProgress);
const audio = new AudioSynth(save.settings.muted);

function setAccountStatus(message = "", error = false) {
  dom.accountStatus.textContent = message;
  dom.accountStatus.classList.toggle("error", error);
}

function setAccountAuthMode(mode, focus = false) {
  accountAuthMode = mode === "register" ? "register" : "login";
  dom.loginForm.classList.toggle("hidden", accountAuthMode !== "login");
  dom.registerForm.classList.toggle("hidden", accountAuthMode !== "register");
  setAccountStatus("");
  if (focus) (accountAuthMode === "register" ? dom.registerUsername : dom.loginUsername).focus({ preventScroll: true });
}

function setCloudSyncStatus(message) {
  dom.accountSyncStatus.textContent = message;
}

function updateAccountUi(view) {
  const selectedView = view || (pendingCloudSave ? "choice" : currentAccount ? "user" : "guest");
  dom.accountGuestPanel.classList.toggle("hidden", selectedView !== "guest");
  dom.accountUserPanel.classList.toggle("hidden", selectedView !== "user");
  dom.saveChoicePanel.classList.toggle("hidden", selectedView !== "choice");
  dom.accountButton.classList.toggle("logged-in", Boolean(currentAccount));
  dom.accountButton.title = currentAccount ? `账号：${currentAccount.username}` : "登录或注册";
  dom.accountButton.setAttribute("aria-label", currentAccount ? `已登录：${currentAccount.username}` : "游客账号");
  if (currentAccount) {
    dom.accountUsername.textContent = currentAccount.username;
    dom.accountAvatar.textContent = currentAccount.username.slice(0, 1).toUpperCase();
  }
}

function setAccountOpen(open, restoreFocus = false) {
  const nextOpen = Boolean(open);
  if (nextOpen && !accountModalOpen) {
    if (starfallAiming) cancelStarfallAim(false);
    resumeAfterAccount = !state.paused && !state.over;
    state.paused = true;
    accountModalOpen = true;
    dom.accountModal.classList.remove("hidden");
    dom.accountButton.setAttribute("aria-expanded", "true");
    updateAccountUi();
    const focusTarget = pendingCloudSave ? dom.useCloudSaveButton : currentAccount ? dom.syncSaveButton : dom.loginUsername;
    focusTarget.focus({ preventScroll: true });
  } else if (!nextOpen && accountModalOpen) {
    accountModalOpen = false;
    dom.accountModal.classList.add("hidden");
    dom.accountButton.setAttribute("aria-expanded", "false");
    if (resumeAfterAccount && !state.over && !techTreeOpen && !leaderboardModalOpen && !updatesModalOpen && !baseCampOpen && !relicChoiceOpen) state.paused = false;
    resumeAfterAccount = false;
    if (restoreFocus) dom.accountButton.focus({ preventScroll: true });
  }
  updateUi();
}

function saveSummary(candidate) {
  const threat = candidate?.records?.highestThreat ?? 1;
  const stardust = candidate?.stardust ?? 0;
  const resources = candidate?.resources ?? {};
  return `威胁 ${threat} · 星尘 ${stardust} · 遗响 ${resources.echoShards ?? 0} · 核心 ${resources.coreFragments ?? 0}`;
}

function sameSave(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function queueCloudSync(candidate = save) {
  if (!currentAccount || !cloudSyncEnabled) return Promise.resolve();
  const accountId = currentAccount.id;
  const snapshot = JSON.parse(JSON.stringify(candidate));
  cloudSaveQueue = cloudSaveQueue.catch(() => {}).then(async () => {
    if (!currentAccount || currentAccount.id !== accountId || !cloudSyncEnabled) return;
    setCloudSyncStatus("正在同步云端存档…");
    await writeCloudSave(snapshot);
    setCloudSyncStatus("云端存档已同步");
  }).catch(() => {
    setCloudSyncStatus("同步失败，本地存档仍然安全");
  });
  return cloudSaveQueue;
}

function persistSave() {
  save = writeSave(save);
  void queueCloudSync(save);
  return save;
}

async function resolveAccountSave() {
  const localExists = localStorage.getItem(SAVE_KEY) !== null;
  const cloud = await readCloudSave();
  if (!cloud.save) {
    await writeCloudSave(save);
    cloudSyncEnabled = true;
    pendingCloudSave = null;
    setCloudSyncStatus("本地存档已上传云端");
    updateAccountUi("user");
    return;
  }
  if (!localExists) {
    writeSave(cloud.save);
    cloudSyncEnabled = true;
    location.reload();
    return;
  }
  if (sameSave(save, cloud.save)) {
    cloudSyncEnabled = true;
    pendingCloudSave = null;
    setCloudSyncStatus("本地与云端存档一致");
    updateAccountUi("user");
    return;
  }
  cloudSyncEnabled = false;
  pendingCloudSave = cloud.save;
  dom.localSaveSummary.textContent = saveSummary(save);
  dom.cloudSaveSummary.textContent = saveSummary(cloud.save);
  setAccountStatus("请选择一份存档继续。");
  updateAccountUi("choice");
  setAccountOpen(true);
}

async function activateAccount(user) {
  currentAccount = user;
  cloudSyncEnabled = false;
  pendingCloudSave = null;
  setAccountStatus("");
  setCloudSyncStatus("正在检查云端存档…");
  updateAccountUi("user");
  try {
    await resolveAccountSave();
  } catch (error) {
    setCloudSyncStatus("云端暂时不可用，本地存档仍然安全");
    setAccountStatus(error?.message || "无法读取云端存档", true);
  }
}

async function submitAccountForm(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const controls = [...form.elements];
  controls.forEach((control) => { control.disabled = true; });
  setAccountStatus(mode === "register" ? "正在创建账号…" : "正在登录…");
  try {
    const username = mode === "register" ? dom.registerUsername.value : dom.loginUsername.value;
    const password = mode === "register" ? dom.registerPassword.value : dom.loginPassword.value;
    const result = mode === "register" ? await registerAccount(username, password) : await loginAccount(username, password);
    form.reset();
    await activateAccount(result.user);
  } catch (error) {
    setAccountStatus(error?.message || "账号操作失败", true);
  } finally {
    controls.forEach((control) => { control.disabled = false; });
  }
}

async function restoreAccountSession() {
  try {
    const session = await restoreSession();
    if (session.authenticated && session.user) await activateAccount(session.user);
    else updateAccountUi("guest");
  } catch {
    updateAccountUi("guest");
  }
}

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

function renderStoryIntroScene(index) {
  const safeIndex = Math.max(0, Math.min(INTRO_SCENES.length - 1, index));
  const scene = INTRO_SCENES[safeIndex];
  introSceneIndex = safeIndex;
  window.clearTimeout(introTimer);
  dom.storyIntro.classList.remove("scene-playing");
  dom.storyIntroStage.classList.remove("is-entering", ...INTRO_MOTIONS);
  dom.storyIntro.dataset.tone = scene.tone;
  dom.storyIntroBackdrop.style.backgroundImage = "url('" + scene.background + "')";
  dom.storyIntroLayers.replaceChildren();
  for (const layer of scene.layers) {
    const image = document.createElement("img");
    image.className = "story-intro-layer " + layer.className;
    image.src = layer.src;
    image.alt = "";
    image.draggable = false;
    dom.storyIntroLayers.append(image);
  }
  dom.storyIntroBubbles.replaceChildren();
  for (const bubble of scene.bubbles) {
    const element = document.createElement("div");
    element.className = "story-bubble " + bubble.kind + " " + bubble.position;
    element.textContent = bubble.text;
    dom.storyIntroBubbles.append(element);
  }
  dom.storyIntroChapter.textContent = scene.chapter;
  dom.storyIntroProgress.textContent = String(safeIndex + 1).padStart(2, "0") + " / " + String(INTRO_SCENES.length).padStart(2, "0");
  dom.storyIntroNext.textContent = safeIndex === INTRO_SCENES.length - 1 ? "开始守望" : "继续";
  dom.storyIntro.style.setProperty("--intro-duration", scene.duration + "ms");
  dom.storyIntroTimeline.style.setProperty("--intro-duration", scene.duration + "ms");
  void dom.storyIntroStage.offsetWidth;
  dom.storyIntro.classList.add("scene-playing");
  dom.storyIntroStage.classList.add("is-entering", scene.motion);
  introTimer = window.setTimeout(() => advanceStoryIntro(), scene.duration);
}
function showStoryIntro(nextFlow = null) {
  if (introOpen) return;
  pendingIntroFlow = nextFlow;
  resumeAfterIntro = !state.paused && !state.over;
  state.paused = true;
  introOpen = true;
  dom.storyIntro.classList.remove("hidden");
  dom.pauseOverlay.classList.add("hidden");
  renderStoryIntroScene(0);
  dom.storyIntroNext.focus({ preventScroll: true });
  updateUi();
}

function finishStoryIntro() {
  if (!introOpen) return;
  window.clearTimeout(introTimer);
  introOpen = false;
  dom.storyIntro.classList.add("hidden");
  dom.storyIntro.classList.remove("scene-playing");
  if (resumeAfterIntro && !state.over && !techTreeOpen && !leaderboardModalOpen && !updatesModalOpen && !baseCampOpen && !relicChoiceOpen) state.paused = false;
  resumeAfterIntro = false;
  const nextFlow = pendingIntroFlow;
  pendingIntroFlow = null;
  updateUi();
  if (nextFlow) nextFlow();
}

function disableStoryIntro() {
  if (!previewMode) {
    save.settings.introDisabled = true;
    persistSave();
    showToast("第一章开篇剧情已关闭");
  }
  finishStoryIntro();
}

function advanceStoryIntro() {
  if (!introOpen) return;
  if (introSceneIndex >= INTRO_SCENES.length - 1) finishStoryIntro();
  else renderStoryIntroScene(introSceneIndex + 1);
}

function rewindStoryIntro() {
  if (!introOpen) return;
  renderStoryIntroScene(Math.max(0, introSceneIndex - 1));
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
    selectTechBranch("power", false);
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
    dom.upgradeList.querySelector('[data-branch-tab="blade"]')?.classList.add("tutorial-focus");
    dom.upgradeList.querySelector('[data-branch-tab="economy"]')?.classList.add("tutorial-focus");
  } else if (step === 4) {
    dom.tutorialTitle.textContent = "威胁 Ⅹ · 时流加速解锁";
    dom.tutorialText.textContent = "你已击败威胁 Ⅹ 首领，永久解锁 2× 时流。点击右上角的 1× / 2× 按钮，或按 X 切换战斗速度。";
    dom.tutorialDismiss.textContent = "我知道了";
  }
}

function createUpgradeUi() {
  dom.upgradeList.replaceChildren();
  const tabs = document.createElement("nav");
  tabs.className = "tech-branch-tabs";
  tabs.setAttribute("aria-label", "科技分支");
  for (const [branchKey, branch] of Object.entries(BRANCH_META)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tech-branch-tab";
    button.dataset.branchTab = branchKey;
    button.innerHTML = `<span class="branch-tab-icon">${branch.icon}</span><span><strong>${branch.name}</strong><small>${branch.subtitle}</small></span><b class="branch-progress">0 / ${branch.keys.length}</b><i class="branch-ready-dot" aria-hidden="true"></i>`;
    button.addEventListener("click", () => selectTechBranch(branchKey));
    tabs.append(button);
  }

  const workspace = document.createElement("div");
  workspace.className = "tech-workspace";
  const stage = document.createElement("section");
  stage.className = "tech-tree-stage";
  stage.setAttribute("aria-label", "当前科技分支");
  const detail = document.createElement("aside");
  detail.className = "tech-detail";
  detail.innerHTML = `<div class="tech-detail-state"></div><div class="tech-detail-heading"><span class="tech-detail-icon"></span><div><small>当前节点</small><h3></h3></div></div><p class="tech-detail-description"></p><dl class="tech-detail-facts"></dl><div class="tech-detail-route hidden"></div><button class="tech-research-button" type="button"></button>`;
  detail.querySelector(".tech-research-button").addEventListener("click", () => buyUpgrade(selectedTechKey));
  workspace.append(stage, detail);
  dom.upgradeList.append(tabs, workspace);
  selectTechBranch(activeTechBranch, false);
}

function createTechEdge(svg, from, to, layout, exclusive = false) {
  const [fromCol, fromRow] = layout.nodes[from];
  const [toCol, toRow] = layout.nodes[to];
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", `${(fromCol - 0.5) * 20}%`);
  line.setAttribute("y1", `${(fromRow - 0.5) / layout.rows * 100}%`);
  line.setAttribute("x2", `${(toCol - 0.5) * 20}%`);
  line.setAttribute("y2", `${(toRow - 0.5) / layout.rows * 100}%`);
  line.classList.add("tech-edge", exclusive ? "exclusive" : "requirement");
  line.dataset.from = from;
  line.dataset.to = to;
  svg.append(line);
}

function applyTechIconArt(element, key) {
  if (key === "cannonStarPiercer" || key === "cannonCascade") {
    element.classList.add("tech-icon-terminal");
    element.textContent = UPGRADE_META[key].icon;
    return;
  }
  element.classList.remove("tech-icon-terminal");
  element.textContent = "";
  const branchKey = Object.keys(BRANCH_META).find((branch) => BRANCH_META[branch].keys.includes(key));
  const art = TECH_ART[branchKey];
  const artKeys = BRANCH_META[branchKey].keys.filter((candidate) => candidate !== "cannonStarPiercer" && candidate !== "cannonCascade");
  const index = artKeys.indexOf(key);
  element.style.setProperty("--tech-icon-sheet", `url("${art.sheet}")`);
  element.style.setProperty("--tech-icon-cols", art.cols);
  element.style.setProperty("--tech-icon-rows", art.rows);
  element.style.setProperty("--tech-icon-size-x", `${art.cols * 100}%`);
  element.style.setProperty("--tech-icon-size-y", `${art.rows * 100}%`);
  element.style.setProperty("--tech-icon-x", index % art.cols);
  element.style.setProperty("--tech-icon-y", Math.floor(index / art.cols));
  element.style.setProperty("--tech-icon-pos-x", `${art.cols === 1 ? 50 : (index % art.cols) / (art.cols - 1) * 100}%`);
  element.style.setProperty("--tech-icon-pos-y", `${art.rows === 1 ? 50 : Math.floor(index / art.cols) / (art.rows - 1) * 100}%`);
}

function selectTechBranch(branchKey, focusNode = true) {
  if (!BRANCH_META[branchKey]) return;
  activeTechBranch = branchKey;
  const branch = BRANCH_META[branchKey];
  if (!branch.keys.includes(selectedTechKey)) selectedTechKey = branch.keys[0];
  for (const tab of dom.upgradeList.querySelectorAll(".tech-branch-tab")) {
    const active = tab.dataset.branchTab === branchKey;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-current", active ? "page" : "false");
  }
  const stage = dom.upgradeList.querySelector(".tech-tree-stage");
  if (!stage) return;
  stage.replaceChildren();
  stage.dataset.branch = branchKey;
  const layout = TECH_LAYOUT[branchKey];
  stage.style.setProperty("--tech-rows", layout.rows);
  const heading = document.createElement("header");
  heading.className = "tech-stage-heading";
  heading.innerHTML = `<span>${branch.icon}</span><div><h3>${branch.name}</h3><p>${branch.routes?.join("　/　") || branch.subtitle}</p></div>`;
  const graph = document.createElement("div");
  graph.className = "tech-graph";
  graph.style.setProperty("--tech-rows", layout.rows);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("tech-edges");
  svg.setAttribute("aria-hidden", "true");
  for (const [from, to] of layout.edges) createTechEdge(svg, from, to, layout);
  for (const [from, to] of layout.excludes) createTechEdge(svg, from, to, layout, true);
  graph.append(svg);
  for (const key of branch.keys) {
    const meta = UPGRADE_META[key];
    const [col, row] = layout.nodes[key];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tech-node";
    button.dataset.upgrade = key;
    button.style.setProperty("--tech-col", col);
    button.style.setProperty("--tech-row", row);
    button.setAttribute("aria-label", meta.name);
    button.innerHTML = `<span class="upgrade-icon" aria-hidden="true"></span><span class="tech-node-level"></span><span class="tech-node-mark" aria-hidden="true"></span>${key === "ascend" ? '<span class="tech-cross-badge" title="包含跨分支元素前置">元素</span>' : ""}<span class="tech-node-tooltip" role="tooltip"><b>${meta.name}</b><small></small></span>`;
    applyTechIconArt(button.querySelector(".upgrade-icon"), key);
    button.addEventListener("click", () => selectTechNode(key, true));
    graph.append(button);
  }
  stage.append(heading, graph);
  updateTechTreeUi();
  if (focusNode) graph.querySelector(`[data-upgrade="${selectedTechKey}"]`)?.focus({ preventScroll: true });
}

function selectTechNode(key, tryPurchase = false) {
  if (!UPGRADE_META[key]) return;
  selectedTechKey = key;
  updateTechTreeUi();
  const status = getTechStatus(state, key);
  if (tryPurchase && status.unlocked && !status.maxed && state.coins >= status.cost) buyUpgrade(key);
}

function techStateFor(key) {
  const level = state.tower.upgrades[key];
  const status = getTechStatus(state, key);
  if (status.maxed) return "completed";
  if (!status.unlocked && status.reason.startsWith("已选择")) return "exclusive";
  if (!status.unlocked) return "locked";
  if (state.coins < status.cost) return "poor";
  return level > 0 ? "researched available" : "available";
}

function techRequirementsText(key) {
  const cfg = GAME_CONFIG.techTree[key];
  const level = state.tower.upgrades[key];
  const requirements = cfg.requiresByLevel?.[level] ?? cfg.requires ?? {};
  const parts = Object.entries(requirements).map(([requiredKey, requiredLevel]) => `${UPGRADE_META[requiredKey].name} ${requiredLevel} 级`);
  return parts.length ? parts.join("、") : "无";
}

function updateTechDetail() {
  const detail = dom.upgradeList.querySelector(".tech-detail");
  if (!detail || !UPGRADE_META[selectedTechKey]) return;
  const key = selectedTechKey;
  const meta = UPGRADE_META[key];
  const cfg = GAME_CONFIG.techTree[key];
  const level = state.tower.upgrades[key];
  const status = getTechStatus(state, key);
  const stateName = techStateFor(key).split(" ")[0];
  const stateLabels = { completed: "已研究完成", available: "可以研究", researched: "已研究", poor: `金币不足 · 还差 ${formatNumber(Math.max(0, status.cost - state.coins))}`, locked: "前置未满足", exclusive: "互斥路线锁定" };
  detail.dataset.state = stateName;
  detail.querySelector(".tech-detail-state").textContent = stateLabels[stateName] ?? stateLabels.available;
  const detailIcon = detail.querySelector(".tech-detail-icon");
  detailIcon.textContent = "";
  applyTechIconArt(detailIcon, key);
  detail.querySelector("h3").textContent = meta.name;
  detail.querySelector(".tech-detail-description").textContent = meta.description;
  const nextThreat = cfg.threat[level] ?? cfg.threat.at(-1);
  detail.querySelector(".tech-detail-facts").innerHTML = `<div><dt>研究进度</dt><dd>${level} / ${meta.max}</dd></div><div><dt>本级效果</dt><dd>${level > 0 ? `${meta.description} · 已生效 ${level} 级` : "尚未研究"}</dd></div><div><dt>下一等级</dt><dd>${status.maxed ? "全部等级已完成" : meta.description}</dd></div><div><dt>金币成本</dt><dd>${status.maxed ? "—" : `${formatNumber(status.cost)} 金币`}</dd></div><div><dt>威胁要求</dt><dd>${status.maxed ? "已满足" : `威胁 ${formatThreat(nextThreat)}`}</dd></div><div><dt>晶塔等级</dt><dd>${cfg.towerLevel ? `${cfg.towerLevel} 级` : "无"}</dd></div><div><dt>前置科技</dt><dd>${techRequirementsText(key)}</dd></div><div><dt>互斥科技</dt><dd>${cfg.excludes?.map((excluded) => UPGRADE_META[excluded].name).join("、") || "无"}</dd></div>`;
  const route = detail.querySelector(".tech-detail-route");
  route.classList.toggle("hidden", !status.reason || status.unlocked || status.maxed);
  route.textContent = !status.unlocked && !status.maxed ? `首要缺口 · ${status.reason}` : "";
  const researchButton = detail.querySelector(".tech-research-button");
  researchButton.disabled = state.over || status.maxed || !status.unlocked || state.coins < status.cost;
  researchButton.textContent = status.maxed ? "研究完成" : !status.unlocked ? status.reason : state.coins < status.cost ? `还差 ${formatNumber(status.cost - state.coins)} 金币` : `研究 · ${formatNumber(status.cost)} 金币`;
}

function updateTechTreeUi() {
  for (const [branchKey, branch] of Object.entries(BRANCH_META)) {
    const tab = dom.upgradeList.querySelector(`[data-branch-tab="${branchKey}"]`);
    if (!tab) continue;
    const researched = branch.keys.filter((key) => state.tower.upgrades[key] > 0).length;
    const ready = branch.keys.some((key) => { const status = getTechStatus(state, key); return status.unlocked && !status.maxed && state.coins >= status.cost; });
    tab.querySelector(".branch-progress").textContent = `${researched} / ${branch.keys.length}`;
    tab.classList.toggle("has-ready", ready);
  }
  for (const button of dom.upgradeList.querySelectorAll(".tech-node")) {
    const key = button.dataset.upgrade;
    const level = state.tower.upgrades[key];
    const status = getTechStatus(state, key);
    const classes = techStateFor(key).split(" ");
    button.className = `tech-node ${classes.join(" ")}${key === selectedTechKey ? " selected" : ""}`;
    button.setAttribute("aria-label", `${UPGRADE_META[key].name}，${status.maxed ? "研究完成" : status.reason}${status.unlocked && state.coins < status.cost ? "，金币不足" : ""}`);
    button.setAttribute("aria-pressed", String(key === selectedTechKey));
    button.style.setProperty("--tech-progress", `${level / UPGRADE_META[key].max * 360}deg`);
    button.querySelector(".tech-node-level").textContent = status.maxed ? "✓" : `${level}/${UPGRADE_META[key].max}`;
    button.querySelector(".tech-node-mark").textContent = status.maxed ? "✓" : !status.unlocked ? "⌕" : "";
    button.querySelector(".tech-node-tooltip small").textContent = status.maxed ? "研究完成" : status.unlocked ? `${formatNumber(status.cost)} 金币 · ${level}/${UPGRADE_META[key].max}` : status.reason;
  }
  for (const line of dom.upgradeList.querySelectorAll(".tech-edge")) {
    const fromLevel = state.tower.upgrades[line.dataset.from] ?? 0;
    const toLevel = state.tower.upgrades[line.dataset.to] ?? 0;
    const targetCfg = GAME_CONFIG.techTree[line.dataset.to];
    const targetLevel = state.tower.upgrades[line.dataset.to] ?? 0;
    const targetRequirements = targetCfg.requiresByLevel?.[targetLevel] ?? targetCfg.requires ?? {};
    const requiredSourceLevel = targetRequirements[line.dataset.from] ?? 1;
    line.classList.toggle("active", line.classList.contains("exclusive") ? (fromLevel > 0 || toLevel > 0) : fromLevel >= requiredSourceLevel);
    line.classList.toggle("broken", line.classList.contains("exclusive") && (fromLevel > 0 || toLevel > 0));
  }
  updateTechDetail();
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

const FALLBACK_UPDATE_ENTRIES = [
  {
    version: "1.7.0",
    date: "2026.08.27",
    title: "登录功能现已上线",
    text: "现已上线登录功能",
    warning: "目前还在测试不保证数据不会丢失",
    tag: "重要提示"
  }
];

let updateEntries = [...FALLBACK_UPDATE_ENTRIES];
let updatesRequest = null;

function setUpdatesSyncStatus(message, state = "idle") {
  if (!dom.updatesSyncStatus) return;
  dom.updatesSyncStatus.textContent = message;
  dom.updatesSyncStatus.dataset.state = state;
}

function renderUpdates() {
  const latest = updateEntries[0];
  if (latest && dom.updatesCurrentVersion && dom.updatesCurrentDate) {
    const live = Boolean(latest.url);
    dom.updatesCurrentVersion.textContent = live ? `GitHub 最新提交 ${latest.version}` : `内置公告 ${latest.version}`;
    dom.updatesCurrentDate.textContent = live ? `提交日期 · ${latest.date}` : `回退日期 · ${latest.date}`;
  }
  dom.updatesList.replaceChildren();
  for (const entry of updateEntries) {
    const article = document.createElement("article");
    article.className = "update-entry";
    const heading = document.createElement("h3");
    heading.append(document.createTextNode(entry.title));
    const meta = document.createElement("small");
    meta.textContent = `${entry.version} · ${entry.date}`;
    heading.append(meta);
    const description = document.createElement("p");
    if (entry.warning) {
      description.append(document.createTextNode(entry.text));
      const warning = document.createElement("span");
      warning.className = "update-warning";
      warning.textContent = `（${entry.warning}）`;
      description.append(warning);
    } else {
      description.textContent = entry.text;
    }
    const tag = document.createElement("b");
    tag.textContent = entry.tag;
    article.append(heading, description, tag);
    if (entry.url) {
      const link = document.createElement("a");
      link.className = "update-entry-link";
      link.href = entry.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "查看提交 ↗";
      article.append(link);
    }
    dom.updatesList.append(article);
  }
}

async function loadGithubUpdates() {
  if (updatesRequest) return updatesRequest;
  setUpdatesSyncStatus("正在同步 GitHub 提交日志…", "loading");
  updatesRequest = fetchGithubCommits()
    .then((entries) => {
      if (!entries.length) throw new Error("GitHub commits list is empty");
      updateEntries = entries;
      renderUpdates();
      setUpdatesSyncStatus("来源：GitHub 提交日志 · tcmiku/CrystalTower", "ready");
    })
    .catch(() => {
      updateEntries = [...FALLBACK_UPDATE_ENTRIES];
      renderUpdates();
      setUpdatesSyncStatus("GitHub 暂不可用，当前显示内置回退公告", "fallback");
    })
    .finally(() => {
      updatesRequest = null;
    });
  return updatesRequest;
}

function updateUpdatesDismissButton() {
  if (!dom.updatesDismissButton) return;
  const dismissed = save.settings.updatesDismissed === true;
  dom.updatesDismissButton.textContent = dismissed ? "恢复自动弹出" : "下次不再弹出";
  dom.updatesDismissButton.setAttribute("aria-pressed", String(dismissed));
}

function toggleUpdatesDismissed() {
  save.settings.updatesDismissed = !save.settings.updatesDismissed;
  persistSave();
  updateUpdatesDismissButton();
  if (save.settings.updatesDismissed) {
    showToast("已关闭启动公告，可从右上角“告”重新打开");
    setUpdatesOpen(false, true);
  } else {
    showToast("已恢复启动公告");
  }
}

function setUpdatesOpen(open, restoreFocus = false) {
  const nextOpen = Boolean(open);
  if (nextOpen && !updatesModalOpen) {
    if (starfallAiming) cancelStarfallAim(false);
    resumeAfterUpdates = !state.paused && !state.over;
    state.paused = true;
    updatesModalOpen = true;
    dom.updatesModal.classList.remove("hidden");
    updateUpdatesDismissButton();
    dom.openUpdatesButton.setAttribute("aria-expanded", "true");
    renderUpdates();
    void loadGithubUpdates();
    dom.closeUpdatesButton.focus({ preventScroll: true });
  } else if (!nextOpen && updatesModalOpen) {
    updatesModalOpen = false;
    dom.updatesModal.classList.add("hidden");
    dom.openUpdatesButton.setAttribute("aria-expanded", "false");
    if (resumeAfterUpdates && !state.over && !techTreeOpen && !leaderboardModalOpen && !baseCampOpen && !relicChoiceOpen) state.paused = false;
    resumeAfterUpdates = false;
    const startupFlow = pendingStartupFlow;
    pendingStartupFlow = null;
    if (restoreFocus) dom.openUpdatesButton.focus({ preventScroll: true });
    if (startupFlow) startupFlow();
  }
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

function baseCampModuleStatus(key) {
  if (key === "campaign") {
    if (save.campaign.repairedNodes[1] === true) return "节点已修复";
    if (save.campaign.coreEnergy[1] === true) return "能源待装配";
    return "远征进行中";
  }
  if (key === "seals") {
    return save.threatSeals?.unlocked === true
      ? "已装备 " + save.threatSeals.equipped.length
      : "第一章解锁";
  }
  return "中枢在线";
}

function renderBaseCampNavigation() {
  dom.baseCampModuleList.replaceChildren();
  for (const [index, module] of BASECAMP_MODULES.entries()) {
    const button = document.createElement("button");
    const locked = module.key === "seals" && save.threatSeals?.unlocked !== true;
    button.type = "button";
    button.className = "base-room basecamp-module-card";
    button.dataset.basecampModule = module.key;
    button.classList.toggle("locked", locked);
    button.setAttribute("aria-pressed", String(baseCampRoom === module.key));
    const media = module.art
      ? '<span class="basecamp-module-art"><img src="' + module.art + '" alt="" aria-hidden="true" loading="lazy"></span>'
      : '<span class="basecamp-module-icon">' + module.icon + '</span>';
    button.innerHTML =
      media +
      '<span class="basecamp-module-copy"><small>0' + (index + 1) + ' · ' + module.category + '</small>' +
      '<strong>' + module.name + '</strong><span>' + module.description + '</span></span>' +
      '<b class="basecamp-module-status">' + baseCampModuleStatus(module.key) + '</b>';
    button.addEventListener("click", () => setBaseCampRoom(module.key, true));
    dom.baseCampModuleList.append(button);
  }

  const future = document.createElement("article");
  future.className = "base-room basecamp-module-future";
  future.setAttribute("aria-label", "预留的新系统模块槽位");
  future.innerHTML =
    '<span class="basecamp-module-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 6v20M6 16h20"/><circle cx="16" cy="16" r="12"/></svg></span>' +
    '<span class="basecamp-module-copy"><small>扩展接口</small><strong>等待新信号</strong><span>后续系统将自动接入此处</span></span>';
  dom.baseCampModuleList.append(future);
}

function renderBaseCamp() {
  updatePermanentResourceUi();
  renderCampaign();
  renderResearch();
  renderRelicResearch();
  renderRelicArchive();
  renderThreatSeals();
  renderBaseCampNavigation();
  if (baseCampRoom) setBaseCampRoom(baseCampRoom);
  else showBaseCampHub();
}
function renderThreatSeals() {
  const unlocked = save.threatSeals?.unlocked === true;
  const equipped = unlocked ? save.threatSeals.equipped : [];
  const modifiers = getThreatSealModifiers(equipped);
  dom.threatSealUnlockStatus.textContent = unlocked ? `已装备 ${equipped.length} / ${Object.keys(THREAT_SEAL_META).length}` : "通过第一章威胁 XX 后解锁";
  dom.sealScoreMultiplier.textContent = `×${modifiers.scoreMultiplier.toFixed(2)}`;
  dom.sealResourceMultiplier.textContent = `×${modifiers.resourceMultiplier.toFixed(2)}`;
  dom.sealRelicChance.textContent = `+${Math.round(modifiers.relicChanceBonus * 100)}%`;
  dom.sealAchievementMultiplier.textContent = `×${modifiers.achievementMultiplier.toFixed(2)}`;
  dom.sealEquippedSummary.textContent = equipped.length ? `下一次远征：${equipped.map((key) => THREAT_SEAL_META[key].name).join(" · ")}` : unlocked ? "下一次远征：未装备封印" : "封印圣坛尚未响应";
  dom.sealAchievementProgress.textContent = `封印征服进度 ${formatNumber(save.records.sealAchievementProgress ?? 0)}`;
  dom.threatSealList.replaceChildren();
  for (const [key, meta] of Object.entries(THREAT_SEAL_META)) {
    const active = equipped.includes(key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "threat-seal-card";
    button.classList.toggle("equipped", active);
    button.disabled = !unlocked;
    button.setAttribute("aria-pressed", String(active));
    button.innerHTML = `<i class="threat-seal-art" style="--seal-index:${meta.art}" aria-hidden="true"></i><span><small>${meta.type}</small><strong>${meta.name}</strong><p>${meta.risk}</p><b>${meta.reward}</b></span><em>${unlocked ? active ? "已装备 · 点击卸下" : "点击装备" : "完成第一章后解锁"}</em>`;
    button.addEventListener("click", () => {
      if (!toggleThreatSeal(save, key)) return;
      persistSave();
      audio.play("purchase");
      renderThreatSeals();
      showToast(`${meta.name} · ${save.threatSeals.equipped.includes(key) ? "将在下一次远征生效" : "已从下一次远征卸下"}`);
    });
    dom.threatSealList.append(button);
  }
}

function renderCampaign() {
  const repaired = save.campaign.repairedNodes[1] === true;
  const energy = save.campaign.coreEnergy[1] === true;
  const record = save.campaign.chapterRecords[1];
  dom.campaignProgressText.textContent = `${repaired ? 1 : 0} / 4 节点修复`;
  dom.chapterNodeList.replaceChildren();
  const chapters = [
    { id: 1, name: "永恒晶塔", kicker: "第一章", status: repaired ? "已修复" : energy ? "能源待装配" : "远征进行中", description: record.cleared ? `通关 ${record.clears} 次 · 最高击杀 ${record.bestKills}` : "挑战威胁 XX 的四阶段终局首领。" },
    { id: 2, name: "极夜航道", kicker: "第二章", status: repaired ? "开发中…" : "未激活", description: repaired ? "能源通路已建立，地图仍在开发中。" : "修复永恒晶塔节点后解锁。" },
    { id: 3, name: "腐蚀矿区", kicker: "第三章", status: "未激活", description: "等待前置能源节点。" },
    { id: 4, name: "破碎王座", kicker: "第四章", status: "未激活", description: "等待前置能源节点。" }
  ];
  for (const chapter of chapters) {
    const card = document.createElement("article");
    card.className = `chapter-node chapter-${chapter.id}`;
    if (chapter.id === 1 && energy) card.classList.add("energized");
    if (chapter.id === 1 && repaired) card.classList.add("repaired");
    card.innerHTML = `<div class="chapter-node-index">0${chapter.id}</div><div><small>${chapter.kicker}</small><strong>${chapter.name}</strong><p>${chapter.description}</p></div><span>${chapter.status}</span>`;
    const action = document.createElement("button");
    action.type = "button";
    if (chapter.id === 1 && energy && !repaired) {
      action.textContent = "修复能源节点";
      action.addEventListener("click", () => {
        if (!repairChapterNode(save, 1)) return;
        persistSave();
        audio.play("ascend");
        renderer.trigger("ascend", 2.5);
        dom.campaignPanel.classList.add("repairing");
        setTimeout(() => dom.campaignPanel.classList.remove("repairing"), 1500);
        renderCampaign();
        announce("永恒晶塔能源节点修复完成 · 极夜航道已解锁");
      });
    } else if (chapter.id === 1) {
      action.textContent = record.cleared ? "再次挑战" : "进入远征";
      action.addEventListener("click", startChapterOne);
    } else {
      action.textContent = chapter.id === 2 && repaired ? "开发中…" : "尚未解锁";
      action.disabled = true;
    }
    card.append(action);
    dom.chapterNodeList.append(card);
  }
}

function startChapterOne() {
  const beginChallenge = () => {
    restart();
    setBaseCampOpen(false);
  };
  if (save.settings.introDisabled !== true) showStoryIntro(beginChallenge);
  else beginChallenge();
}

function showBaseCampHub(restoreFocus = false) {
  const previousRoom = baseCampRoom;
  baseCampRoom = null;
  dom.baseCampShell.classList.remove("module-open");
  dom.baseCampModulePage.classList.add("hidden");
  dom.baseCampModuleList.closest(".basecamp-stage")?.classList.remove("hidden");
  for (const module of BASECAMP_MODULES) dom[module.panelId].classList.add("hidden");
  for (const button of dom.baseCampModuleList.querySelectorAll("[data-basecamp-module]")) {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  }
  if (restoreFocus && previousRoom) {
    dom.baseCampModuleList.querySelector('[data-basecamp-module="' + previousRoom + '"]')?.focus({ preventScroll: true });
  }
}

function setBaseCampRoom(room, focusPage = false) {
  const selectedModule = BASECAMP_MODULES.find((module) => module.key === room);
  if (!selectedModule) {
    showBaseCampHub();
    return;
  }
  baseCampRoom = selectedModule.key;
  dom.baseCampShell.classList.add("module-open");
  dom.baseCampModuleList.closest(".basecamp-stage")?.classList.add("hidden");
  dom.baseCampModulePage.classList.remove("hidden");
  dom.baseCampModulePageIcon.innerHTML = selectedModule.icon;
  dom.baseCampModulePageKicker.textContent = selectedModule.category + " · 中枢功能页";
  dom.baseCampModulePageTitle.textContent = selectedModule.name;
  dom.baseCampModulePageSummary.textContent = selectedModule.description;
  dom.baseCampModulePageStatus.textContent = baseCampModuleStatus(selectedModule.key);
  for (const module of BASECAMP_MODULES) {
    dom[module.panelId].classList.toggle("hidden", module.key !== baseCampRoom);
  }
  for (const button of dom.baseCampModuleList.querySelectorAll("[data-basecamp-module]")) {
    const active = button.dataset.basecampModule === baseCampRoom;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  if (focusPage) dom.closeBaseCampModuleButton.focus({ preventScroll: true });
}
function setBaseCampOpen(open, restoreFocus = false) {
  const nextOpen = Boolean(open) && save.baseCamp.unlocked;
  if (nextOpen && starfallAiming) cancelStarfallAim(false);
  if (nextOpen && !baseCampOpen) {
    resumeAfterBaseCamp = !state.paused && !state.over;
    state.paused = true;
    baseCampOpen = true;
    baseCampRoom = null;
    dom.gameOverModal.classList.add("hidden");
    dom.baseCampModal.classList.remove("hidden");
    renderBaseCamp();
    dom.closeBaseCampButton.textContent = state.over ? "返回结算" : "返回战场";
    dom.closeBaseCampButton.focus({ preventScroll: true });
  } else if (!nextOpen && baseCampOpen) {
    baseCampOpen = false;
    showBaseCampHub();
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
  if (!previewMode) persistSave();
  dom.baseRecoveryModal.classList.add("hidden");
  firstFailureFlow = false;
  setBaseCampOpen(true);
}

function commitPermanentDrop(drop) {
  if (!drop) return;
  grantPermanentResource(save, drop.resourceType, drop.value);
  persistSave();
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
    button.setAttribute('aria-label', `${meta.key} · ${meta.name}：${meta.tooltip}`);
    button.innerHTML = `<span class="skill-key">${meta.key}</span><img class="skill-icon skill-art" src="${meta.art}" alt="" aria-hidden="true" loading="lazy"><i class="cooldown-mask"></i><span class="cooldown-text"></span><span class="skill-tooltip" role="tooltip"><b>${meta.key} · ${meta.name}</b><span>${meta.tooltip}</span></span>`;
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
    button.dataset.research = key;
    button.disabled = maxed || save.stardust < cost;
    button.innerHTML = `<strong>${meta.name}</strong><span>等级 ${level}/${GAME_CONFIG.research.maxLevel} · +${level * 5}%</span><small>${maxed ? "研究完成" : `${meta.description} +5% · 花费 ${cost}`}</small>`;
    button.addEventListener("click", () => {
      if (!buyResearch(save, key)) return;
      persistSave();
      audio.play("purchase");
      renderResearch();
      playNexusUpgradeFx(key, save.research[key]);
    });
    dom.researchList.append(button);
  }
}

function playNexusUpgradeFx(key, level) {
  const panel = dom.nexusPanel;
  panel.dataset.upgradeKey = key;
  panel.dataset.upgradeLevel = String(level);
  panel.classList.remove("nexus-upgrade-success");
  void panel.offsetWidth;
  panel.classList.add("nexus-upgrade-success");
  const upgradedButton = [...dom.researchList.querySelectorAll("[data-research]")].find((item) => item.dataset.research === key);
  upgradedButton?.classList.add("research-upgraded");
  window.clearTimeout(panel.upgradeFxTimer);
  panel.upgradeFxTimer = window.setTimeout(() => {
    panel.classList.remove("nexus-upgrade-success");
    upgradedButton?.classList.remove("research-upgraded");
  }, 1100);
}

function setResearchBayTab(tab = "relics", focus = false) {
  researchBayTab = tab === "skills" ? "skills" : "relics";
  const skillsSelected = researchBayTab === "skills";
  dom.relicResearchView.classList.toggle("hidden", skillsSelected);
  dom.skillResearchView.classList.toggle("hidden", !skillsSelected);
  dom.relicResearchTab.setAttribute("aria-selected", String(!skillsSelected));
  dom.skillResearchTab.setAttribute("aria-selected", String(skillsSelected));
  dom.relicResearchTab.tabIndex = skillsSelected ? -1 : 0;
  dom.skillResearchTab.tabIndex = skillsSelected ? 0 : -1;
  if (focus) (skillsSelected ? dom.skillResearchTab : dom.relicResearchTab).focus({ preventScroll: true });
}

function renderActiveSkillResearch() {
  dom.activeSkillResearchList.replaceChildren();
  for (const key of SKILL_ORDER) {
    const skill = SKILL_META[key];
    const research = ACTIVE_SKILL_RESEARCH_META[key];
    const skillConfig = GAME_CONFIG.activeSkillResearch[key];
    const entry = save.skillResearch?.[key] ?? { branch: null, nodes: [] };
    const card = document.createElement("article");
    card.className = `active-skill-research-card skill-research-${key}`;
    card.dataset.skillResearch = key;
    const routes = Object.entries(skillConfig.branches).map(([branchKey, branch], branchIndex) => {
      const selectedRoute = entry.branch === branchKey;
      const lockedRoute = Boolean(entry.branch && !selectedRoute);
      const routeNodes = branch.nodes.map((node, nodeIndex) => {
        const selected = selectedRoute && entry.nodes.includes(node.id);
        const next = !selected && !lockedRoute && (entry.branch === null || selectedRoute) && entry.nodes.length === nodeIndex;
        const cost = GAME_CONFIG.activeSkillResearch.costs[nodeIndex];
        const affordable = save.resources.coreFragments >= cost;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `skill-research-node${selected ? " selected" : ""}${next && affordable ? " available" : ""}`;
        button.disabled = selected || lockedRoute || !next || !affordable;
        button.innerHTML = `<span><b>${nodeIndex + 1}</b><strong>${node.name}</strong></span><small>${selected ? "已装载" : `研究 · ${cost} 核心残片`}</small><em>${node.effect}</em>`;
        button.addEventListener("click", () => {
          if (!buySkillResearch(save, key, branchKey, node.id)) return;
          persistSave();
          audio.play("purchase");
          showToast(`${skill.name} · ${branch.name} · ${node.name}已装载 · 下一局生效`);
          renderBaseCamp();
        });
        return button;
      });
      const route = document.createElement("section");
      route.className = `active-skill-branch${selectedRoute ? " selected" : ""}${lockedRoute ? " locked" : ""}`;
      route.innerHTML = `<header><span>路线 ${branchIndex === 0 ? "A" : "B"}</span><strong>${branch.name}</strong><small>${selectedRoute ? "当前路线 · 可继续搭配" : lockedRoute ? "已锁定 · 另一条路线已选择" : branch.description}</small></header>`;
      const nodeList = document.createElement("div");
      nodeList.className = "active-skill-node-list";
      for (const node of routeNodes) nodeList.append(node);
      route.append(nodeList);
      return route;
    });
    card.innerHTML = `<span class="active-skill-research-icon"><img src="${skill.art}" alt="" aria-hidden="true" loading="lazy"></span><span class="active-skill-research-copy"><small>${research.protocol}</small><strong>${skill.name}<em>${entry.nodes.length ? `${skillConfig.branches[entry.branch]?.name ?? "路线"} · ${entry.nodes.length} / 2` : "选择一条路线"}</em></strong><span class="active-skill-research-base">基础：${skill.tooltip}</span></span>`;
    for (const route of routes) card.append(route);
    const footer = document.createElement("footer");
    footer.className = "active-skill-research-footer";
    footer.innerHTML = `<span>核心残片用于路线研究 · 同一技能只能选择一条路线</span><small>永久生效 · 下一局开始生效</small>`;
    card.append(footer);
    dom.activeSkillResearchList.append(card);
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
    persistSave();
    state.relics.slots = save.relicSlots;
    audio.play("purchase");
    showToast(`临时遗物栏位扩展至 ${save.relicSlots} 格`);
    renderBaseCamp();
  });
  dom.relicSlotResearch.append(slotButton);
  dom.relicResearchList.replaceChildren();
  for (const key of configuredRelicIds()) {
    const meta = RELIC_META[key];
    const discovered = save.relicArchive.discovered[key] === true;
    const level = save.relicArchive.upgrades[key] ?? 0;
    const cost = relicUpgradeCost(save, key);
    const maxed = cost == null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `relic-research-card ${relicRarityClass(level)}`;
    button.dataset.relic = key;
    button.disabled = !discovered || maxed || save.resources.echoShards < cost;
    const hidden = Object.hasOwn(GAME_CONFIG.relicCombos, key);
    const cardArt = discovered
      ? `<img src="${meta.art}" alt="" aria-hidden="true">`
      : `<div class="archive-silhouette relic-research-silhouette">${hidden ? "?" : "◇"}</div>`;
    const cardDetails = discovered
      ? `<small>${relicRarityName(level)} · ${meta.type}</small><strong>${meta.name} · +${level}</strong><p>${relicDescription(key, level)}</p><b>${maxed ? "强化完成 · 传说" : `强化至 +${level + 1} · ${cost} 遗响碎片`}</b>`
      : hidden
        ? `<small>隐藏回路 · 未发现</small><strong>未知遗物</strong><p>组合线索：${RELIC_SET_META[key].hint}</p><b>在战斗中发现后解锁</b>`
        : `<small>尚未发现</small><strong>未知遗物</strong><p>该遗物已进入候选池，获得一次后才会显示卡图与效果。</p><b>在战斗中发现后解锁</b>`;
    button.innerHTML = `${cardArt}<span>${cardDetails}</span>`;
    button.addEventListener("click", () => {
      if (!buyRelicUpgrade(save, key)) return;
      state.relics.upgrades[key] = save.relicArchive.upgrades[key];
      persistSave();
      audio.play("purchase");
      showToast(`${meta.name} · 强化至 +${save.relicArchive.upgrades[key]}`);
      renderBaseCamp();
    });
    dom.relicResearchList.append(button);
  }
  renderActiveSkillResearch();
  setResearchBayTab(researchBayTab);
}

function configuredRelicIds() {
  return [...Object.keys(GAME_CONFIG.relicResearch), ...Object.keys(GAME_CONFIG.relicCombos)];
}

function relicRarityClass(level = 0) {
  return level >= GAME_CONFIG.relicUpgradeResearch.maxLevel ? "relic-rarity-legendary" : level > 0 ? "relic-rarity-rare" : "relic-rarity-common";
}

function relicRarityName(level = 0) {
  return level >= GAME_CONFIG.relicUpgradeResearch.maxLevel ? "传说" : level > 0 ? "稀有" : "普通";
}

const RELIC_UPGRADE_TEXT = {
  decoy: (level, percent) => `强化 +${level}：诱饵耐久、爆炸伤害与存活金币 +${percent}%`,
  lunar: (level, percent) => `强化 +${level}：昼夜倍率与切换火力持续时间 +${percent}%`,
  mirror: (level, percent) => `强化 +${level}：折射间隔减少 ${level} 次，距离与伤害 +${percent}%`,
  ember: (level, percent) => `强化 +${level}：余烬区域伤害、范围、持续时间 +${percent}%`,
  ward: (level, percent) => `强化 +${level}：每 ${Math.max(5, 20 - level * 5)} 击杀获得护盾，护盾量 +${percent}%`,
  frostbloom: (level, percent) => `强化 +${level}：霜爆范围、伤害与冻结时间 +${percent}%`,
  stormglass: (level, percent) => `强化 +${level}：额外雷链 +${level}，范围与链伤 +${percent}%`,
  gilded: (level, percent) => `强化 +${level}：触发概率与额外金币 +${percent}%`,
  execution: (level, percent) => `强化 +${level}：斩杀线提高至 ${35 + level * 4}%，残血伤害 +${percent}%`,
  hourglass: (level, percent) => `强化 +${level}：冷却恢复速度额外 +${percent}%`,
  prismArc: (level, percent) => `强化 +${level}：折线连锁目标 +${level}，范围与伤害 +${percent}%`,
  frostfire: (level, percent) => `强化 +${level}：冰火区域范围、伤害与持续时间 +${percent}%`,
  decoyWard: (level, percent) => `强化 +${level}：诱饵爆炸后的护盾量 +${percent}%`
};

function relicDescription(id, level = 0) {
  const meta = RELIC_META[id];
  if (!meta || level <= 0) return meta?.description ?? "";
  const percent = level * Math.round(GAME_CONFIG.relicUpgradeResearch.effectPerLevel * 100);
  return `${meta.description} ${RELIC_UPGRADE_TEXT[id]?.(level, percent) ?? `强化 +${level}：效果强度 +${percent}%`}`;
}

function relicEffect(id, level = 0) {
  const meta = RELIC_META[id];
  if (!meta || level <= 0) return meta?.effect ?? "";
  const percent = level * Math.round(GAME_CONFIG.relicUpgradeResearch.effectPerLevel * 100);
  return `${meta.effect} · ${RELIC_UPGRADE_TEXT[id]?.(level, percent) ?? `强化效果 +${percent}%`}`;
}

function renderRelicArchive() {
  if (!dom.relicArchivePanel) return;
  const hiddenIds = new Set(Object.keys(GAME_CONFIG.relicCombos));
  const discovered = (id) => save.relicArchive.discovered[id] === true;
  const discoveredCount = configuredRelicIds().filter(discovered).length;
  const disabledRelics = save.relicArchive.disabledRelics ?? [];
  const disabledCapacity = relicArchiveCapacity(save);
  dom.relicArchiveProgress.textContent = `${discoveredCount} / ${configuredRelicIds().length}`;

  dom.relicArchiveDisabledList.replaceChildren();
  const upgrade = document.createElement("button");
  const archiveCost = GAME_CONFIG.relicArchiveResearch.costs[save.relicArchive.exclusionLevel];
  const archiveMaxed = archiveCost == null;
  upgrade.type = "button"; upgrade.className = "archive-disable-card archive-upgrade-card";
  upgrade.disabled = archiveMaxed || save.resources.echoShards < archiveCost;
  upgrade.innerHTML = `<strong>禁用容量 ${disabledRelics.length} / ${disabledCapacity}</strong><small>${archiveMaxed ? "构筑管理已满级" : `升级至可禁用 ${disabledCapacity + 1} 件 · ${archiveCost} 遗响碎片`}</small>`;
  upgrade.addEventListener("click", () => {
    if (!buyRelicArchiveUpgrade(save)) return;
    persistSave(); audio.play("purchase"); renderBaseCamp();
    showToast(`构筑管理升级 · 下局最多禁用 ${relicArchiveCapacity(save)} 件遗物`);
  });
  dom.relicArchiveDisabledList.append(upgrade);
  const clear = document.createElement("button");
  clear.type = "button"; clear.className = "archive-disable-card clear";
  clear.classList.toggle("active", disabledRelics.length === 0);
  clear.innerHTML = `<strong>不禁用</strong><small>保持完整遗物池</small>`;
  clear.addEventListener("click", () => { setDisabledRelic(save, null); persistSave(); renderRelicArchive(); });
  dom.relicArchiveDisabledList.append(clear);
  for (const id of configuredRelicIds().filter(discovered)) {
    const meta = RELIC_META[id];
    const button = document.createElement("button");
    button.type = "button"; button.className = "archive-disable-card";
    const disabled = disabledRelics.includes(id);
    button.classList.toggle("active", disabled);
    button.disabled = !disabled && disabledRelics.length >= disabledCapacity;
    button.innerHTML = `<i>${meta.icon}</i><span><strong>${meta.name}</strong><small>${disabled ? "已从下一局候选池排除" : button.disabled ? "禁用容量已满" : "点击加入下局禁用列表"}</small></span>`;
    button.addEventListener("click", () => { if (!setDisabledRelic(save, id)) return; persistSave(); audio.play("purchase"); renderRelicArchive(); });
    dom.relicArchiveDisabledList.append(button);
  }

  dom.relicArchiveCodexList.replaceChildren();
  for (const id of configuredRelicIds()) {
    const meta = RELIC_META[id];
    const known = discovered(id);
    const hidden = hiddenIds.has(id);
    const card = document.createElement("article");
    const level = save.relicArchive.upgrades[id] ?? 0;
    card.className = `archive-codex-card ${relicRarityClass(level)}${known ? " discovered" : " locked"}${hidden ? " hidden-relic" : ""}`;
    const combo = hidden ? RELIC_SET_META[id] : null;
    card.innerHTML = known
      ? `<img src="${meta.art}" alt=""><span><small>${relicRarityName(level)} · +${level} · ${meta.type}</small><strong>${meta.name}</strong><p>${relicDescription(id, level)}</p><b>${relicEffect(id, level)}</b></span>`
      : hidden
        ? `<div class="archive-silhouette">?</div><span><small>隐藏回路 · 未发现</small><strong>未知遗物</strong><p>组合线索：${combo.hint}</p><b>在同一局装配两件基础遗物</b></span>`
        : `<div class="archive-silhouette">◇</div><span><small>尚未发现</small><strong>${meta.name}</strong><p>该遗物已在候选池开放，获得一次后即可管理与强化。</p><b>进入战局寻找遗物</b></span>`;
    dom.relicArchiveCodexList.append(card);
  }

  dom.relicArchiveSetList.replaceChildren();
  for (const [id, combo] of Object.entries(GAME_CONFIG.relicCombos)) {
    const meta = RELIC_SET_META[id];
    const found = save.relicArchive.discovered[id] === true;
    const registered = save.relicArchive.registeredSets[id] === true;
    const button = document.createElement("button");
    button.type = "button"; button.className = "archive-set-card";
    button.classList.toggle("registered", registered);
    button.disabled = !found;
    const members = combo.set.map((member) => RELIC_META[member].name).join(" · ");
    button.innerHTML = `<span><small>${found ? "三件套已发现" : "组合尚未发现"}</small><strong>${found ? meta.name : "未命名套装"}</strong><p>${found ? members : meta.hint + " + 未知遗物"}</p></span><b>${!found ? "发现隐藏遗物后开放" : registered ? "已登记 · 点击取消" : "登记套装"}</b>`;
    button.addEventListener("click", () => {
      if (!toggleRelicSet(save, id)) return;
      state.relics.registeredSets[id] = save.relicArchive.registeredSets[id];
      persistSave(); audio.play("purchase"); renderRelicArchive();
      showToast(`${meta.name} · ${save.relicArchive.registeredSets[id] ? "已登记" : "已取消登记"}`);
    });
    dom.relicArchiveSetList.append(button);
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
  const towerPosition = getTowerPosition(state);
  return Math.atan2(y - towerPosition.y, x - towerPosition.x);
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

function createRelicHudChip({ icon, name, label = name, description, effect, rarityClass = "" }) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `relic-run-chip ${rarityClass}`;
  chip.title = effect;
  chip.setAttribute("aria-label", `${name}：${effect}`);
  chip.innerHTML = `<i aria-hidden="true">${icon}</i><span class="relic-run-name">${label}</span><span class="relic-run-tooltip" role="tooltip"><strong>${name}</strong><small>${description}</small><b>${effect}</b></span>`;
  return chip;
}

function renderRelicHud() {
  const owned = Object.entries(state.relics.owned).filter(([, active]) => active).map(([id]) => id);
  const endlessStacks = state.relics.endlessStacks ?? 0;
  const signature = [owned.join(","), state.relics.damageBonus.toFixed(3), state.relics.rateBonus.toFixed(3), endlessStacks].join("|");
  if (signature === relicHudSignature) return;
  relicHudSignature = signature;
  dom.relicRunHud.replaceChildren();
  for (const id of owned) {
    const meta = RELIC_META[id];
    const level = state.relics.upgrades[id] ?? 0;
    dom.relicRunHud.append(createRelicHudChip({ ...meta, description: relicDescription(id, level), effect: relicEffect(id, level), rarityClass: relicRarityClass(level) }));
  }
  if (endlessStacks > 0) {
    const damage = Math.round(endlessStacks * GAME_CONFIG.relics.endless.damagePerStack * 100);
    const rate = Math.round(endlessStacks * GAME_CONFIG.relics.endless.ratePerStack * 100);
    dom.relicRunHud.append(createRelicHudChip({
      icon: "∞",
      name: "无界增幅核",
      label: `无界增幅核 ×${endlessStacks}`,
      description: "无尽怪潮奖励，可无限叠加且不占用遗物栏位。",
      effect: `累计攻击力 +${damage}% · 攻速 +${rate}%`
    }));
  }
  const regularDamageBonus = state.relics.damageBonus - endlessStacks * GAME_CONFIG.relics.endless.damagePerStack;
  const regularRateBonus = state.relics.rateBonus - endlessStacks * GAME_CONFIG.relics.endless.ratePerStack;
  if (regularDamageBonus > 0.0001 || regularRateBonus > 0.0001) {
    const damage = Math.round(regularDamageBonus * 100);
    const rate = Math.round(regularRateBonus * 100);
    dom.relicRunHud.append(createRelicHudChip({
      icon: "✧",
      name: "数值增幅",
      label: `火力 +${damage}% · 攻速 +${rate}%`,
      description: "栏位缺口转化成的本局临时强化。",
      effect: `本局攻击力 +${damage}% · 攻速 +${rate}%`
    }));
  }
}

function renderThreatSealHud() {
  const equipped = state.threatSeals?.equipped ?? [];
  const signature = equipped.join(",");
  if (signature === sealHudSignature) return;
  sealHudSignature = signature;
  dom.threatSealHud.replaceChildren();
  dom.threatSealHud.classList.toggle("hidden", equipped.length === 0);
  for (const key of equipped) {
    const meta = THREAT_SEAL_META[key];
    if (!meta) continue;
    const chip = document.createElement("span");
    chip.className = "seal-hud-chip";
    chip.title = `${meta.name}：${meta.risk}`;
    chip.innerHTML = `<i class="threat-seal-art" style="--seal-index:${meta.art}" aria-hidden="true"></i><b>${meta.name.replace("封印", "")}</b>`;
    dom.threatSealHud.append(chip);
  }
}

function renderRelicChoice() {
  if (!state.relicChoice) return;
  const endlessChoice = state.relicChoice.source === "endlessWave";
  dom.relicChoiceTitle.textContent = endlessChoice ? "无尽回路增幅" : "战场遗物选择";
  dom.relicChoiceSource.textContent = RELIC_SOURCE_TEXT[state.relicChoice.source] ?? "回收一项战场模块。";
  const numericOnly = state.relicChoice.choices.every((id) => id.startsWith("boost:"));
  dom.relicChoiceSlots.textContent = endlessChoice
    ? `无视栏位 · 当前 ${state.relics.endlessStacks ?? 0} 层`
    : numericOnly
    ? `栏位缺口 · 数值强化`
    : `模块 ${state.relics.picks} / ${state.relics.slots}${state.relics.lockedChoice ? " · 已锁定 1 项" : ""}`;
  dom.relicChoiceKeys.textContent = endlessChoice ? "按数字键 1 选择" : `按数字键 ${state.relicChoice.choices.map((_, index) => index + 1).join(" / ")} 选择`;
  dom.relicChoiceList.classList.toggle("single-choice", endlessChoice);
  dom.relicChoiceList.classList.toggle("four-choice", state.relicChoice.choices.length === 4);
  dom.relicChoiceList.replaceChildren();
  state.relicChoice.choices.forEach((id, index) => {
    const meta = RELIC_META[id];
    const isLocked = state.relics.lockedChoice === id;
    const wrapper = document.createElement("div");
    wrapper.className = "relic-card-wrap";
    wrapper.classList.toggle("locked", isLocked);
    const button = document.createElement("button");
    button.type = "button";
    const level = save.relicArchive.upgrades[id] ?? 0;
    button.className = `relic-card ${id.startsWith("boost:") ? "" : relicRarityClass(level)}`;
    button.dataset.relic = id;
    const effect = id === "boost:endless" ? `${meta.effect} · 选择后达到 ${(state.relics.endlessStacks ?? 0) + 1} 层` : relicEffect(id, level);
    button.innerHTML = `<span class="relic-card-art"><img src="${meta.art}" alt="" aria-hidden="true" decoding="async"></span><span class="relic-card-index">0${index + 1}</span><span class="relic-card-icon">${meta.icon}</span><span class="relic-card-body"><span class="relic-card-type">${id.startsWith("boost:") ? meta.type : `${relicRarityName(level)} · +${level} · ${meta.type}`}</span><h3>${meta.name}</h3><p>${relicDescription(id, level)}</p><span class="relic-card-effect">${effect}</span></span>`;
    button.addEventListener("click", () => selectRunRelic(id));
    wrapper.append(button);
    if (!id.startsWith("boost:")) {
      const lock = document.createElement("button");
      lock.type = "button"; lock.className = "relic-lock-button";
      lock.setAttribute("aria-pressed", String(isLocked));
      lock.setAttribute("aria-label", isLocked ? `解除锁定：${meta.name}` : `锁定至下次奖励：${meta.name}`);
      lock.title = isLocked ? "解除锁定" : "锁定至下次奖励";
      lock.innerHTML = isLocked
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M12 14v2.5"></path></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7.7a4 4 0 0 1 7.5-2"></path><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M12 14v2.5"></path></svg>`;
      lock.addEventListener("click", () => {
        if (!lockRelicChoice(state, id)) return;
        audio.play("purchase");
        renderRelicChoice();
      });
      wrapper.append(lock);
    }
    dom.relicChoiceList.append(wrapper);
  });
  dom.relicChoiceList.querySelector(".relic-card")?.focus({ preventScroll: true });
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
  renderThreatSealHud();
  if (state.relicChoice) {
    relicChoiceOpen = true;
    dom.relicChoiceModal.classList.remove("hidden");
    renderRelicChoice();
  } else setRelicChoiceOpen(false);
}
function handleEvents(events) {
  for (const event of events) {
    if (event.type === "relicChoice") setRelicChoiceOpen(true);
    else if (event.type === "relicComboDiscovered") {
      if (discoverHiddenRelic(save, event.id)) persistSave();
      const meta = RELIC_META[event.id];
      audio.play("ascend"); renderer.trigger("ascend", 1.2); announce(`组合发现 · ${meta.name} 已写入遗物档案馆`);
      renderRelicArchive();
    }
    else if (event.type === "relicChoiceLocked") showToast(event.locked ? `${RELIC_META[event.id].name} · 将保留至下次奖励` : "遗物选项已解除锁定");
    else if (event.type === "relicChosen") {
      if (!event.id.startsWith("boost:") && discoverHiddenRelic(save, event.id)) {
        state.relics.discovered[event.id] = true;
        persistSave();
        renderRelicArchive();
      }
      announce(event.id === "boost:endless" ? `无界增幅核 · 当前 ${state.relics.endlessStacks} 层` : `${RELIC_META[event.id]?.name ?? "战场回路"} · 已接入本局构筑`);
    }
    else if (event.type === "relicDecoyExplode") { audio.play("overload"); renderer.trigger("overloadRelease", 0.7); announce("诡光诱饵崩解 · 爆炸清场"); }
    else if (event.type === "relicDecoySurvived") { audio.play("coin"); showToast(`诡光诱饵存活 · 转化金币 ${event.value}`); }
    else if (event.type === "relicPhaseBuff") { renderer.trigger("ascend", 0.45); showToast("月相调律 · 短暂火力强化"); }
    else if (event.type === "relicMirror") renderer.trigger("targetProtocol");
    else if (event.type === "relicPrismArc") { renderer.trigger("targetProtocol"); showToast(`折光雷晶 · 连锁 ${event.chains} 个目标`); }
    else if (event.type === "relicFrostfire") { renderer.trigger("ascend", .45); showToast("霜烬共生核 · 冰火区域展开"); }
    else if (event.type === "relicDecoyWard") showToast(`棱光替身 · 护盾 +${Math.round(event.value)}`);
    else if (event.type === "cannonWeakpoint") { renderer.trigger("cannonWeakpoint"); showToast("弱点校准 · 目标暴露"); }
    else if (event.type === "cannonSplit") renderer.trigger("cannonSplit");
    else if (event.type === "cannonEcho") renderer.trigger("cannonEcho");
    else if (event.type === "cannonStarPiercer") { audio.play("ascend"); renderer.trigger("cannonStarPiercer"); showToast("破城终点 · 贯星炮穿透护盾"); }
    else if (event.type === "cannonCascade") { audio.play("overload"); renderer.trigger("cannonCascade"); showToast(`裂晶终点 · 大型连锁爆炸 · 命中 ${event.hits}`); }
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
    else if (event.type === "colossusSpawn") { audio.play("boss"); renderer.trigger("bossSpawn", 1.5); announce(`威胁 ${formatThreat(event.threat ?? state.threat)} · 虚环吞星兽 · ${COLOSSUS_AFFIX_NAMES[event.affix] ?? "未知异变"}`); }
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
    else if (event.type === "sovereignSpawn") {
      restoreDoubleSpeedAfterSovereign = doubleSpeedActive;
      sovereignSpeedLocked = true;
      doubleSpeedActive = false;
      accumulator = 0;
      audio.play("boss"); renderer.trigger("bossSpawn", 2.6); announce("威胁 XX · 时流锁定 1× · 首领登场期间双方停火");
    }
    else if (event.type === "sovereignIntent") { audio.play("waveWarning"); renderer.trigger("waveWarning"); announce(`灭世预兆 · ${COLOSSUS_SKILL_NAMES[event.skill] ?? "未知技能"}`); }
    else if (event.type === "sovereignSkill") { audio.play(event.skill === "summon" ? "waveStart" : "boss"); announce(`裂界魔君 · ${COLOSSUS_SKILL_NAMES[event.skill] ?? "未知技能"}${event.enraged ? " · 狂暴强化" : ""}`); }
    else if (event.type === "sovereignRiftWave") { renderer.trigger("waveStart", 1.25); showToast(`多重裂隙同时开启 · ${event.count} 处${event.eliteCount ? ` · ${event.eliteCount} 只词缀精英` : ""}`); }
    else if (event.type === "sovereignSuppress") { renderer.trigger("towerHit", 1.2); announce(`远程压制 · 晶矢攻击频率降低 ${Math.round((1 - event.multiplier) * 100)}%`); }
    else if (event.type === "sovereignPhase") { audio.play("boss"); renderer.trigger("bossSpawn", 1.35); announce(`命核破碎 · 剩余 ${event.healthBar} 管生命`); }
    else if (event.type === "sovereignShieldBreak") { audio.play("waveStart"); renderer.trigger("waveStart", 1.7); announce("降临护盾破碎 · 裂界魔君被迫只施放召唤"); }
    else if (event.type === "sovereignSummonEmpowered") { audio.play("boss"); renderer.trigger("bossSpawn", 1.8); announce("双命核崩解 · 裂隙增殖 · 词缀精英加入召唤"); }
    else if (event.type === "sovereignEnrage") { audio.play("boss"); renderer.trigger("bossSpawn", 2.4); announce("终末狂暴 · 元素强化与异常效果全部失效"); }
    else if (event.type === "sovereignElementImmune") showToast("终末狂暴 · 元素效果无效");
    else if (event.type === "sovereignDefeated") {
      sovereignSpeedLocked = false;
      doubleSpeedActive = restoreDoubleSpeedAfterSovereign && save.unlocks.doubleSpeed;
      restoreDoubleSpeedAfterSovereign = false;
      accumulator = 0;
      const chapterScore = calculateRunScore(state).total;
      chapterClearWasFirst = grantChapterCoreEnergy(save, 1, { time: state.time, kills: state.stats.kills, score: chapterScore });
      persistSave();
      state.paused = true;
      chapterCompleteOpen = true;
      dom.chapterCoreAwardStatus.textContent = chapterClearWasFirst ? "首次获得 · 威胁封印圣坛已解锁" : "已再次确认 · 主线进度保持安全";
      dom.chapterCompleteModal.classList.remove("hidden");
      dom.finishExpeditionButton.focus({ preventScroll: true });
      audio.play("ascend"); renderer.trigger("ascend", 2); announce("裂界魔君陨落 · 永恒晶塔核心能源已永久入账");
    }
    else if (event.type === "bossDefeated") {
      audio.play("ascend");
      renderer.trigger("ascend");
      const unlockedNow = event.threat >= GAME_CONFIG.unlocks.doubleSpeedThreat && unlockDoubleSpeed(save);
      if (unlockedNow) persistSave();
      announce(unlockedNow ? `威胁 ${formatThreat(event.threat)} 首领击破 · 永久解锁 2× 时流` : "大首领崩解 · 战场回路已回收");
      if (unlockedNow) showFirstRunTutorial(4, true);
    }
    else if (event.type === "colossusDefeated") {
      audio.play("ascend");
      renderer.trigger("ascend");
      announce("虚环崩解 · 常规怪群恢复活动");
    }
    else if (event.type === "sealRelicDrop") showToast("威胁封印共鸣 · 发现额外特殊遗物");
    else if (event.type === "sealEmberCore") { renderer.trigger("ascend", 1.2); announce(`巨兽封印兑现 · 余烬核心 +${event.value}`); }
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
    else if (event.type === "threat") { announce(event.level === GAME_CONFIG.sovereign.spawnThreat ? `威胁 ${formatThreat(event.level)} · 超巨型灾厄来袭` : event.level === (state.threatSeals?.modifiers?.colossusSpawnThreat ?? GAME_CONFIG.colossus.spawnThreat) ? `威胁 ${formatThreat(event.level)} · 巨型首领来袭` : event.level % GAME_CONFIG.threat.bossEvery === 0 ? `威胁 ${formatThreat(event.level)} · 大首领来袭` : `威胁升至 ${formatThreat(event.level)}`); if (event.level === 2) showFirstRunTutorial(3); }
    else if (event.type === "phase") { audio.play("phase"); announce(event.phase === "day" ? "晨光穿透荒原" : "长夜笼罩战场"); }
    else if (event.type === "waveWarning") { audio.play("waveWarning"); renderer.trigger("waveWarning"); announce("侦测到大规模怪潮"); }
    else if (event.type === "waveStart") { audio.play("waveStart"); renderer.trigger("waveStart"); announce(event.endless ? `无尽怪潮 ${event.index} 抵达 · 精英信号 ${event.eliteCount}` : `第 ${event.index} 次怪潮抵达`); }
    else if (event.type === "waveCleared" && event.endless) showToast(`无尽怪潮 ${String(event.index).padStart(2, "0")} 已肃清 · 获得增幅选择`);
    else if (event.type === "overloadRelease") { audio.play("overload"); renderer.trigger("overloadRelease", event.overheated ? 1.5 : 1); announce(event.damage > 0 ? `${event.overheated ? "过热" : "临界"}泄压 · 范围冲击 ${Math.round(event.damage)}` : event.overheated ? "热浪爆发 · 晶塔过热" : event.early ? "超载中断 · 提前释放冲击" : "超载冲击释放"); }
    else if (event.type === "shieldBurst") { audio.play("hit"); renderer.trigger("shieldBurst"); announce(`满盾反击 · 晶片命中 ${event.hits}${event.knockbackHits ? ` · 击退 ${event.knockbackHits}` : ""}`); }
    else if (event.type === "anchorLocked") { audio.play("purchase"); renderer.trigger("anchorLocked"); announce(`锁定 ${ANCHOR_ROLE_NAMES[event.role]} · ${event.duration.toFixed(0)} 秒`); }
    else if (event.type === "starfallFollowup") announce(`轨道协议 · 追加落星命中 ${event.hits}`);
    else if (event.type === "healLastStand") showToast(`生存协议 · ${event.duration.toFixed(0)} 秒减伤 ${Math.round(event.reduction * 100)}%`);
    else if (event.type === "skillCooldownCredit") showToast(`${SKILL_META[event.key].name} · 经济协议缩短冷却 ${Math.round(event.reduction * 100)}%`);
    else if (event.type === "coinVacuum") { audio.play("coin"); renderer.trigger("coinVacuum"); announce(`金潮归塔 · ${event.count} 枚 · +${event.value}${event.fireRateBuff > 0 ? " · 火力循环启动" : ""}`); }
    else if (event.type === "skill") { audio.play(event.key); renderer.trigger(event.key); }
    else if (event.type === "gameOver") { audio.play("gameOver"); renderer.trigger("gameOver"); settleRun(event.stardust, "defeat"); }
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
  renderThreatSealHud();
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
  if (droneModeUnlocked && state.threatSeals?.modifiers?.severedSupply && !droneAttacking && !detonateActive) {
    dom.droneModeHint.textContent = "断供封印生效 · 无人机无法拾币 · 手动拾取仍可用";
  }
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

  updateTechTreeUi();

  for (const button of dom.skillList.children) {
    const key = button.dataset.skill;
    const researchEntry = state.skillResearch?.[key] ?? { branch: null, nodes: [] };
    const researchLevel = researchEntry.nodes?.length ?? 0;
    const researchBranch = researchEntry.branch ? GAME_CONFIG.activeSkillResearch[key]?.branches?.[researchEntry.branch]?.name : "";
    const cooldown = state.skills[key].cooldown;
    const total = GAME_CONFIG.skills[key].cooldown * (key === "heal" ? state.threatSeals?.modifiers?.healCooldownMultiplier ?? 1 : 1);
    const shieldFull = state.tower.shield >= stats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction - 0.01;
    const overloadCanEnd = key === "overload" && state.skills.overload.active > 0;
    button.disabled = state.over || (cooldown > 0 && !overloadCanEnd) || (key === "heal" && hpRatio >= 0.999 && shieldFull) || (key === "starfall" && !starfallAiming && !state.enemies.some((enemy) => enemy.hp > 0)) || (key === "coinVacuum" && !state.coinOrbs.some((orb) => !orb.expired && !orb.collected));
    if (key === "starfall") {
      button.classList.toggle("aiming", starfallAiming);
      button.setAttribute("aria-pressed", String(starfallAiming));
    }
    button.querySelector(".cooldown-mask").style.height = `${Math.min(100, cooldown / total * 100)}%`;
    button.querySelector(".cooldown-text").textContent = cooldown > 0 ? `${cooldown.toFixed(1)}s` : "";
    const tooltip = button.querySelector(".skill-tooltip span");
    if (tooltip) tooltip.textContent = `${SKILL_META[key].tooltip}${researchLevel > 0 ? ` · ${ACTIVE_SKILL_RESEARCH_META[key].protocol} · ${researchBranch} ${researchLevel}/2` : ""}${state.relics.owned.hourglass ? ` · 逆时沙漏：冷却恢复 +${Math.round((GAME_CONFIG.relics.hourglass.cooldownRateMultiplier - 1) * 100)}%` : ""}`;
  }

  const sovereign = state.enemies.find((enemy) => enemy.type === "sovereign" && enemy.hp > 0);
  const colossus = state.enemies.find((enemy) => enemy.type === "colossus" && enemy.hp > 0);
  if (sovereign) {
    dom.objectiveTitle.textContent = sovereign.entryTimer > 0 ? "时流锁定 · 双方停火" : sovereign.enraged ? "终末狂暴 · 元素无效" : sovereign.healthBar <= 2 ? "裂隙增殖 · 精英召唤" : `裂界魔君 · 命核 ${sovereign.healthBar}/4`;
    dom.objectiveText.textContent = sovereign.entryTimer > 0
      ? "战场已被清空并强制回归 1×，登场动画结束前双方无法攻击。"
      : sovereign.intentSkill === "summon" || sovereign.activeSkill === "summon" ? "多处裂隙将同时召唤怪群，优先清理靠近晶塔的目标。"
        : (state.tower.fireRateSuppression ?? 0) > 0 ? `远程压制生效中：晶矢攻击频率降低，剩余 ${state.tower.fireRateSuppression.toFixed(1)} 秒。`
          : sovereign.enraged ? "最后一管命核已进入狂暴：冰冻、灼烧与雷电连锁无法作用于首领。" : sovereign.healthBar <= 2 ? "召唤已强化：每波裂隙数量增加，并混入带词缀精英。" : sovereign.spawnShield > 0 ? "降临护盾存在；击破后首领下一招必定为召唤。" : "首领固定在战场上方，四条血量逐管击破。";
  } else if (colossus) {
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
  dom.pauseButton.classList.toggle("is-paused", state.paused);
  dom.pauseButton.setAttribute("aria-label", state.paused ? "继续战斗" : "暂停战斗");
  dom.muteButton.classList.toggle("is-muted", save.settings.muted);
  dom.muteButton.setAttribute("aria-label", save.settings.muted ? "解除静音" : "静音");
  const doubleSpeedUnlocked = save.unlocks.doubleSpeed || previewMode === "speed";
  const speedForced = sovereignSpeedLocked || Boolean(sovereign);
  dom.speedButton.textContent = speedForced ? "1×" : doubleSpeedActive ? "2×" : "1×";
  dom.speedButton.classList.toggle("active", doubleSpeedActive && !speedForced);
  dom.speedButton.classList.toggle("locked", !doubleSpeedUnlocked || speedForced);
  dom.speedButton.setAttribute("aria-pressed", String(doubleSpeedActive && !speedForced));
  dom.speedButton.setAttribute("aria-disabled", String(!doubleSpeedUnlocked || speedForced));
  dom.speedButton.setAttribute("aria-label", speedForced ? "威胁20首领战期间强制1倍速" : doubleSpeedUnlocked ? `当前 ${doubleSpeedActive ? "2" : "1"} 倍速，点击切换` : "2倍速未解锁");
  dom.speedButton.title = speedForced ? "威胁 XX 首领战期间时流锁定为 1×" : doubleSpeedUnlocked ? "切换 1× / 2× 倍速（X）" : "击败威胁 Ⅹ 首领后永久解锁 2× 倍速";
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
    if (slot.entry?.message) {
      const message = document.createElement("span");
      message.className = "podium-message";
      message.textContent = slot.entry.message;
      message.title = slot.entry.message;
      card.append(message);
    }
    const name = document.createElement("b");
    name.className = "podium-name";
    name.textContent = slot.entry?.name ?? "等待记录";
    const score = document.createElement("strong");
    score.className = "podium-score";
    score.textContent = slot.entry ? formatScore(slot.entry.score) : "—";
    const detail = document.createElement("small");
    detail.className = "podium-detail";
    detail.textContent = slot.entry ? "威胁 " + formatThreat(slot.entry.threat) + " · " + slot.entry.kills + " 击杀" : "空缺";
    const time = document.createElement("small");
    time.className = "podium-time";
    time.textContent = slot.entry ? "坚守 " + formatTime(slot.entry.time) : "";
    card.append(rank, name, score, detail, time);
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
    const time = document.createElement("span");
    time.className = "leaderboard-time";
    name.textContent = entry.name;
    score.textContent = formatScore(entry.score);
    threat.textContent = "威胁 " + formatThreat(entry.threat);
    kills.textContent = entry.kills + " 击杀";
    time.textContent = "坚守 " + formatTime(entry.time);
    item.append(name, score, threat, kills, time);
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
  if (previewMode === "leaderboard-messages") {
    leaderboardEntries = [
      { name: "星尘旅者", message: "昼夜皆守", score: 998800, kills: 740, threat: 18, time: 984, coins: 2100, date: 3 },
      { name: "晶刃回响", message: "锯刃开路", score: 882400, kills: 612, threat: 16, time: 841, coins: 1680, date: 2 },
      { name: "守塔人", message: "十字符测试留言", score: 760200, kills: 508, threat: 14, time: 733, coins: 1290, date: 1 }
    ];
    leaderboardLoading = false;
    renderLeaderboard();
    return;
  }
  try {
    leaderboardEntries = await fetchLeaderboard(save.campaign.currentChapter);
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
      message: sanitizeLeaderboardMessage(dom.playerMessageInput.value),
      chapter: save.campaign.currentChapter,
      mode: currentRunMode,
      date
    });
    save.settings.playerName = result.entry.name;
    dom.playerMessageInput.value = result.entry.message ?? "";
    persistSave();
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

function finishChapterExpedition() {
  if (!chapterCompleteOpen) return;
  chapterCompleteOpen = false;
  dom.chapterCompleteModal.classList.add("hidden");
  state.over = true;
  state.paused = true;
  settleRun(calculateStardust(state), "victory");
}

function startEndlessChallenge() {
  if (!chapterCompleteOpen) return;
  chapterCompleteOpen = false;
  dom.chapterCompleteModal.classList.add("hidden");
  state.endlessMode = true;
  state.paused = false;
  dom.endEndlessButton.classList.remove("hidden");
  announce("无尽挑战启动 · 专属掉落与主线推进已关闭");
  showToast("核心能源已受保护 · 本章排行榜开始计分");
}

function finishEndlessChallenge() {
  if (!state.endlessMode || state.over) return;
  state.over = true;
  state.paused = true;
  dom.endEndlessButton.classList.add("hidden");
  audio.play("gameOver");
  settleRun(calculateStardust(state), "endless");
}

function settleRun(stardust, outcome = state.endlessMode ? "endless" : "defeat") {
  if (runSettled) return;
  dom.endEndlessButton.classList.add("hidden");
  cancelStarfallAim(false);
  runSettled = true;
  currentRunScore = calculateRunScore(state);
  currentRunMode = state.endlessMode || outcome === "endless" ? "endless" : "standard";
  const sealAchievement = calculateAchievementProgress(state);
  scoreSubmitted = false;
  currentEntryDate = null;
  save.stardust += stardust;
  const firstFailure = outcome === "defeat" && !previewMode ? registerFailure(save) : false;
  const firstFailureCoreGift = firstFailure ? 1 : 0;
  if (firstFailureCoreGift) grantPermanentResource(save, "core", firstFailureCoreGift);
  save.records.highestThreat = Math.max(save.records.highestThreat, state.stats.highestThreat);
  save.records.longestTime = Math.max(save.records.longestTime, state.time);
  save.records.totalKills += state.stats.kills;
  save.records.sealAchievementProgress = (save.records.sealAchievementProgress ?? 0) + sealAchievement;
  persistSave();
  dom.resultTime.textContent = formatTime(state.time);
  dom.resultKills.textContent = formatNumber(state.stats.kills);
  dom.resultThreat.textContent = formatThreat(state.stats.highestThreat);
  dom.resultStardust.textContent = `+${stardust}`;
  dom.resultEchoShards.textContent = `+${state.stats.echoShards ?? 0}`;
  dom.resultCoreFragments.textContent = `+${(state.stats.coreFragments ?? 0) + firstFailureCoreGift}`;
  dom.resultSealAchievement.textContent = `+${sealAchievement}`;
  dom.resultScore.textContent = formatScore(currentRunScore.total);
  dom.resultCombatScore.textContent = formatNumber(currentRunScore.combat);
  dom.resultCoinScore.textContent = `${Math.floor(state.coins)} × ${GAME_CONFIG.score.coinMultiplier} = ${formatNumber(currentRunScore.coinBonus)}`;
  dom.resultScoreMultiplier.textContent = `封印 ×${(state.threatSeals?.modifiers?.scoreMultiplier ?? 1).toFixed(2)}`;
  dom.gameOverTitle.textContent = outcome === "victory" ? "远征凯旋" : outcome === "endless" ? "无尽挑战结束" : "晶光熄灭";
  dom.gameOverLine.textContent = outcome === "victory" ? "核心能源已带回大本营，等待装配。" : outcome === "endless" ? "排行榜数据已锁定，主线核心能源完好无损。" : "裂隙吞没了最后一道光。";
  dom.scoreEntryForm.classList.remove("hidden");
  dom.scoreEntryStatus.textContent = "";
  dom.playerNameInput.value = save.settings.playerName ?? "PLAYER";
  dom.playerMessageInput.value = "";
  dom.playerNameInput.disabled = false;
  dom.submitScoreButton.disabled = false;
  setTechTreeOpen(false);
  renderBaseCamp();
  refreshLeaderboard();
  setTimeout(() => {
    if (firstFailure) showBaseRecoveryEvent();
    else if (outcome === "victory") setBaseCampOpen(true);
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
  if (updatesModalOpen) {
    state.paused = true;
    return;
  }
  if (accountModalOpen) {
    if (force === true) resumeAfterAccount = false;
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
  if (sovereignSpeedLocked || state.enemies.some((enemy) => enemy.type === "sovereign" && enemy.hp > 0)) {
    showToast("威胁 XX · 时流锁定 1×");
    return;
  }
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
  const resumeSpeed = restoreDoubleSpeedAfterSovereign && save.unlocks.doubleSpeed;
  sovereignSpeedLocked = false;
  restoreDoubleSpeedAfterSovereign = false;
  doubleSpeedActive = resumeSpeed;
  cancelStarfallAim(false);
  relicChoiceOpen = false;
  resumeAfterRelicChoice = false;
  relicHudSignature = "";
  sealHudSignature = "";
  chapterCompleteOpen = false;
  chapterClearWasFirst = false;
  dom.chapterCompleteModal.classList.add("hidden");
  dom.endEndlessButton.classList.add("hidden");
  dom.relicChoiceModal.classList.add("hidden");
  runIndex += 1;
  state = createGameState((baseSeed + runIndex) >>> 0 || 1, save.research, save.relicUnlocks, save.relicSlots, save.relicArchive, save.threatSeals.equipped, save.skillResearch);
  runSettled = false;
  scoreSubmitted = false;
  currentRunScore = null;
  currentRunMode = "standard";
  currentEntryDate = null;
  accumulator = 0;
  lastFrame = performance.now();
  dom.gameOverModal.classList.add("hidden");
  setUpdatesOpen(false);
  setAccountOpen(false);
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
void restoreAccountSession();
if (previewMode === "relics" || previewMode === "relic-lock") {
  offerRelicChoice(state, "eliteWave");
  if (previewMode === "relic-lock" && state.relicChoice?.choices[0]) lockRelicChoice(state, state.relicChoice.choices[0]);
  handleEvents(state.events);
}
if (previewMode === "endless-relic") {
  state.endlessMode = true;
  offerRelicChoice(state, "endlessWave");
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
  if (introOpen) {
    if (event.key === "ArrowLeft") rewindStoryIntro();
    else if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight") {
      event.preventDefault();
      advanceStoryIntro();
    } else if (event.key === "Escape") finishStoryIntro();
    return;
  }
  if (relicChoiceOpen) {
    const index = Number(event.key) - 1;
    if (index >= 0 && index < (state.relicChoice?.choices.length ?? 0)) selectRunRelic(state.relicChoice.choices[index]);
    return;
  }
  if (firstFailureFlow) {
    if (event.key === "Enter" || event.key === " ") advanceBaseRecoveryEvent();
    return;
  }
  if (baseCampOpen) {
    if (event.key === "Escape") baseCampRoom ? showBaseCampHub(true) : setBaseCampOpen(false, true);
    return;
  }
  if (leaderboardModalOpen) {
    if (event.key === "Escape") setLeaderboardOpen(false, true);
    return;
  }
  if (updatesModalOpen) {
    if (event.key === "Escape") setUpdatesOpen(false, true);
    return;
  }
  if (accountModalOpen) {
    if (event.key === "Escape") setAccountOpen(false, true);
    return;
  }
  if (starfallAiming) {
    if (event.key === "Escape" || event.key.toLowerCase() === "e") cancelStarfallAim();
    return;
  }
  if (techTreeOpen && event.key >= "1" && event.key <= "4") {
    selectTechBranch(Object.keys(BRANCH_META)[Number(event.key) - 1]);
  } else if (techTreeOpen && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const keys = BRANCH_META[activeTechBranch].keys;
    const currentIndex = Math.max(0, keys.indexOf(selectedTechKey));
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    selectedTechKey = keys[(currentIndex + delta + keys.length) % keys.length];
    updateTechTreeUi();
    dom.upgradeList.querySelector(`[data-upgrade="${selectedTechKey}"]`)?.focus({ preventScroll: true });
  } else if (techTreeOpen && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    buyUpgrade(selectedTechKey);
  } else if (!techTreeOpen && event.key >= "1" && event.key <= "9") buyUpgrade(TECH_ORDER[Number(event.key) - 1]);
  else if (event.key.toLowerCase() === "q") activateSkill("heal");
  else if (event.key.toLowerCase() === "w") activateSkill("overload");
  else if (event.key.toLowerCase() === "e") activateSkill("starfall");
  else if (event.key.toLowerCase() === "f") activateSkill("coinVacuum");
  else if (event.key.toLowerCase() === "r") cycleProtocol();
  else if (event.key.toLowerCase() === "x") toggleDoubleSpeed();
  else if (event.key.toLowerCase() === "t") setTechTreeOpen(!techTreeOpen, techTreeOpen);
  else if (event.key.toLowerCase() === "u") setUpdatesOpen(!updatesModalOpen, updatesModalOpen);
  else if (event.key === "Escape" && techTreeOpen) setTechTreeOpen(false, true);
  else if (event.key.toLowerCase() === "p" || event.key === "Escape") togglePause();
});
dom.openBaseCampButton.addEventListener("click", () => setBaseCampOpen(true));
dom.openBaseCampFromGameOver.addEventListener("click", () => setBaseCampOpen(true));
dom.closeBaseCampModuleButton.addEventListener("click", () => showBaseCampHub(true));
dom.closeBaseCampButton.addEventListener("click", () => setBaseCampOpen(false, true));
dom.relicResearchTab.addEventListener("click", () => setResearchBayTab("relics", true));
dom.skillResearchTab.addEventListener("click", () => setResearchBayTab("skills", true));
dom.baseCampModal.addEventListener("pointerdown", (event) => { if (event.target === dom.baseCampModal) setBaseCampOpen(false, true); });
dom.recoveryContinueButton.addEventListener("click", advanceBaseRecoveryEvent);
dom.finishExpeditionButton.addEventListener("click", finishChapterExpedition);
dom.startEndlessButton.addEventListener("click", startEndlessChallenge);
dom.endEndlessButton.addEventListener("click", finishEndlessChallenge);
dom.openLeaderboardButton.addEventListener("click", () => setLeaderboardOpen(true));
dom.openUpdatesButton.addEventListener("click", () => setUpdatesOpen(true));
dom.closeUpdatesButton.addEventListener("click", () => setUpdatesOpen(false, true));
dom.updatesDismissButton.addEventListener("click", toggleUpdatesDismissed);
dom.updatesModal.addEventListener("pointerdown", (event) => { if (event.target === dom.updatesModal) setUpdatesOpen(false, true); });
dom.accountButton.addEventListener("click", () => setAccountOpen(true));
dom.closeAccountButton.addEventListener("click", () => setAccountOpen(false, true));
dom.accountModal.addEventListener("pointerdown", (event) => { if (event.target === dom.accountModal) setAccountOpen(false, true); });
dom.deleteLocalSaveButton.addEventListener("click", () => {
  if (currentAccount) return;
  if (!confirm("删除此设备上的游客本地存档？此操作无法撤销。")) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});
dom.loginForm.addEventListener("submit", (event) => submitAccountForm(event, "login"));
dom.registerForm.addEventListener("submit", (event) => submitAccountForm(event, "register"));
dom.showRegisterButton.addEventListener("click", () => setAccountAuthMode("register", true));
dom.showLoginButton.addEventListener("click", () => setAccountAuthMode("login", true));
dom.syncSaveButton.addEventListener("click", async () => {
  dom.syncSaveButton.disabled = true;
  setCloudSyncStatus("正在同步云端存档…");
  try {
    await writeCloudSave(save);
    cloudSyncEnabled = true;
    setCloudSyncStatus("云端存档已同步");
    setAccountStatus("同步完成。");
  } catch (error) {
    setAccountStatus(error?.message || "同步失败", true);
    setCloudSyncStatus("同步失败，本地存档仍然安全");
  } finally {
    dom.syncSaveButton.disabled = false;
  }
});
dom.useLocalSaveButton.addEventListener("click", async () => {
  dom.useLocalSaveButton.disabled = true;
  dom.useCloudSaveButton.disabled = true;
  setAccountStatus("正在上传本地存档…");
  try {
    await writeCloudSave(save);
    pendingCloudSave = null;
    cloudSyncEnabled = true;
    setCloudSyncStatus("已使用本地存档并覆盖云端");
    setAccountStatus("本地存档已成为当前云端存档。");
    updateAccountUi("user");
  } catch (error) {
    setAccountStatus(error?.message || "上传失败", true);
  } finally {
    dom.useLocalSaveButton.disabled = false;
    dom.useCloudSaveButton.disabled = false;
  }
});
dom.useCloudSaveButton.addEventListener("click", () => {
  if (!pendingCloudSave) return;
  writeSave(pendingCloudSave);
  pendingCloudSave = null;
  cloudSyncEnabled = true;
  setAccountStatus("云端存档已写入此设备，正在重新载入…");
  location.reload();
});
dom.logoutButton.addEventListener("click", async () => {
  dom.logoutButton.disabled = true;
  setAccountStatus("正在退出登录…");
  try {
    await logoutAccount();
    currentAccount = null;
    pendingCloudSave = null;
    cloudSyncEnabled = false;
    setAccountAuthMode("login");
    setAccountStatus("已退出登录，本地存档已保留。");
    updateAccountUi("guest");
  } catch (error) {
    setAccountStatus(error?.message || "退出失败", true);
  } finally {
    dom.logoutButton.disabled = false;
  }
});
dom.deleteAccountButton.addEventListener("click", async () => {
  if (!confirm(`永久删除账号“${currentAccount?.username ?? ""}”、云端存档和此设备本地存档？此操作无法撤销。`)) return;
  dom.deleteAccountButton.disabled = true;
  setAccountStatus("正在删除账号及数据…");
  try {
    await deleteAccount();
    currentAccount = null;
    pendingCloudSave = null;
    cloudSyncEnabled = false;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  } catch (error) {
    setAccountStatus(error?.message || "删除失败", true);
    dom.deleteAccountButton.disabled = false;
  }
});
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
  persistSave();
  updateUi();
});
dom.scoreEntryForm.addEventListener("submit", submitCurrentScore);
dom.storyIntroNext.addEventListener("click", advanceStoryIntro);
dom.storyIntroSkip.addEventListener("click", finishStoryIntro);
dom.storyIntroDisable.addEventListener("click", disableStoryIntro);
dom.storyIntroStage.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  advanceStoryIntro();
});
dom.tutorialDismiss.addEventListener("click", () => {
  dom.tutorialGuide.classList.add("hidden");
  clearTutorialHighlights();
});
dom.restartButton.addEventListener("click", startChapterOne);
dom.clearSaveButton.addEventListener("click", () => {
  if (!confirm("清除全部永久资源、基地进度、研究和纪录？此操作无法撤销。")) return;
  localStorage.removeItem(SAVE_KEY);
  save = defaultSave();
  persistSave();
  doubleSpeedActive = false;
  sovereignSpeedLocked = false;
  restoreDoubleSpeedAfterSovereign = false;
  audio.setMuted(false);
  setBaseCampOpen(false);
  renderBaseCamp();
  renderLeaderboard(null);
  showToast("存档已清除");
  updateUi();
});

document.addEventListener("pointerdown", () => audio.unlock(), { once: true });
revealGameWhenReady().then(() => {
  const startupFlow = () => {
    if (previewMode === "chapter-complete") {
      chapterCompleteOpen = true;
      dom.chapterCompleteModal.classList.remove("hidden");
      dom.finishExpeditionButton.focus({ preventScroll: true });
    }
    else if (previewMode === "basecamp" || previewMode === "nexus" || previewMode === "relic-research" || previewMode === "skill-research" || previewMode === "relic-archive" || previewMode === "threat-seals") {
      setBaseCampOpen(true);
      if (previewMode === "nexus") setBaseCampRoom("nexus");
      if (previewMode === "relic-research") setBaseCampRoom("relics");
      if (previewMode === "skill-research") { setBaseCampRoom("relics"); setResearchBayTab("skills"); }
      if (previewMode === "relic-archive") setBaseCampRoom("archive");
      if (previewMode === "threat-seals") setBaseCampRoom("seals");
    }
    else if (previewMode === "recovery" || (save.baseCamp.unlocked && !save.baseCamp.recoverySeen)) showBaseRecoveryEvent();
  };
  const continueStartup = () => {
    if (!previewMode && !save.settings.updatesDismissed) {
      pendingStartupFlow = startupFlow;
      setUpdatesOpen(true);
    } else {
      startupFlow();
    }
  };
  if (previewMode === "intro") showStoryIntro(continueStartup);
  else continueStartup();
});

globalThis.__ETERNAL_CRYSTAL_TOWER__ = {
  getState: () => state,
  buyUpgrade,
  useSkill: activateSkill,
  setTargetProtocol: switchTargetProtocol,
  restart,
  forceGameOver: () => { state.tower.hp = 0; updateGame(state, GAME_CONFIG.fixedStep); handleEvents(state.events); }
};
