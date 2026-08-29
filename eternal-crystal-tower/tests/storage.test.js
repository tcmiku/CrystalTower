import test from "node:test";
import assert from "node:assert/strict";
import { buyRelicArchiveUpgrade, buyRelicSlot, buyRelicUpgrade, buyResearch, buySkillResearch, defaultSave, discoverHiddenRelic, grantChapterCoreEnergy, grantPermanentResource, loadSave, markBaseRecoverySeen, relicArchiveCapacity, repairChapterNode, researchCost, registerFailure, sanitizeLeaderboardMessage, sanitizePlayerName, sanitizeSave, setDisabledRelic, setSkillResearchBranch, skillResearchCost, toggleRelicSet, SAVE_KEY, submitLeaderboardEntry, unlockDoubleSpeed, writeSave } from "../src/storage.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data)
  };
}

test("公告自动弹出偏好会被安全保存", () => {
  const safeDefault = sanitizeSave({ version: 1 });
  assert.equal(safeDefault.settings.updatesDismissed, false);
  assert.equal(safeDefault.settings.introSeen, false);
  assert.equal(safeDefault.settings.introDisabled, false);
  const safeDismissed = sanitizeSave({ version: 1, settings: { updatesDismissed: true } });
  assert.equal(safeDismissed.settings.updatesDismissed, true);
  const legacyProgress = sanitizeSave({ version: 1, records: { totalKills: 1 } });
  assert.equal(legacyProgress.settings.introSeen, true);
  const storage = memoryStorage();
  const save = defaultSave();
  save.settings.updatesDismissed = true;
  save.settings.introSeen = true;
  save.settings.introDisabled = true;
  writeSave(save, storage);
  assert.equal(loadSave(storage).settings.updatesDismissed, true);
  assert.equal(loadSave(storage).settings.introSeen, true);
  assert.equal(loadSave(storage).settings.introDisabled, true);
});
test("非法与旧版本存档回退到安全默认值", () => {
  assert.deepEqual(sanitizeSave(null), defaultSave());
  assert.deepEqual(sanitizeSave({ version: 9, stardust: 99 }), defaultSave());
  const storage = memoryStorage({ [SAVE_KEY]: "{broken" });
  assert.deepEqual(loadSave(storage), defaultSave());
});

test("存档值被限制在安全范围", () => {
  const safe = sanitizeSave({
    version: 1,
    stardust: -8,
    research: { damage: 999, health: -2, income: "3" },
    settings: { muted: 1 },
    records: { highestThreat: 0, longestTime: -5, totalKills: -2 }
  });
  assert.equal(safe.stardust, 0);
  assert.deepEqual(safe.research, { damage: 30, health: 0, income: 3 });
  assert.equal(safe.settings.muted, true);
  assert.deepEqual(safe.records, { highestThreat: 1, longestTime: 0, totalKills: 0, failures: 0 });
});

test("永久研究费用按等级指数增长并限制在满级", () => {
  const save = defaultSave();
  assert.equal(researchCost(0), 2);
  assert.equal(researchCost(1), 3);
  assert.ok(researchCost(10) > researchCost(1));
  save.stardust = 5;
  assert.equal(buyResearch(save, "damage"), true);
  assert.equal(save.research.damage, 1);
  assert.equal(save.stardust, 3);
  assert.equal(buyResearch(save, "damage"), true);
  assert.equal(save.research.damage, 2);
  assert.equal(save.stardust, 0);
  assert.equal(buyResearch(save, "damage"), false);
  const maxed = defaultSave();
  maxed.research.damage = 30;
  maxed.stardust = 1_000_000_000;
  assert.equal(buyResearch(maxed, "damage"), false);
});

test("写入后能够无损读回有效存档", () => {
  const storage = memoryStorage();
  const save = defaultSave();
  save.stardust = 12;
  save.research.health = 4;
  writeSave(save, storage);
  assert.deepEqual(loadSave(storage), save);
});


test("威胁十首领奖励会永久解锁二倍速且不能重复解锁", () => {
  const storage = memoryStorage();
  const save = defaultSave();
  assert.equal(save.unlocks.doubleSpeed, false);
  assert.equal(unlockDoubleSpeed(save), true);
  assert.equal(unlockDoubleSpeed(save), false);
  writeSave(save, storage);
  assert.equal(loadSave(storage).unlocks.doubleSpeed, true);
});

test("旧存档与伪造的二倍速值安全回退为未解锁", () => {
  assert.equal(sanitizeSave({ version: 1 }).unlocks.doubleSpeed, false);
  assert.equal(sanitizeSave({ version: 1, unlocks: { doubleSpeed: 1 } }).unlocks.doubleSpeed, false);
});

test("排行榜留言会清洗并限制为十个字符", () => {
  assert.equal(sanitizeLeaderboardMessage("守望者!<script>"), "守望者!script");
  assert.equal(Array.from(sanitizeLeaderboardMessage("一二三四五六七八九十十一")).length, 10);
  assert.equal(sanitizeLeaderboardMessage(""), "");
});
test("排行榜清理姓名、按积分排序并只保留前十名", () => {
  const save = defaultSave();
  assert.equal(sanitizePlayerName("  <ACE> 王!  "), "ACE 王");
  for (let index = 0; index < 12; index += 1) {
    submitLeaderboardEntry(save, {
      name: `P${index}`,
      score: index * 100,
      kills: index,
      threat: Math.max(1, index),
      time: index * 10,
      coins: index,
      date: index + 1
    });
  }
  assert.equal(save.leaderboard.length, 10);
  assert.equal(save.leaderboard[0].score, 1100);
  assert.equal(save.leaderboard[9].score, 200);
});

test("排行榜随存档写入并安全读回", () => {
  const storage = memoryStorage();
  const save = defaultSave();
  submitLeaderboardEntry(save, { name: "晶刃王", message: "守住核心", score: 9876, kills: 42, threat: 8, time: 300, coins: 17, date: 123 });
  writeSave(save, storage);
  assert.deepEqual(loadSave(storage).leaderboard, save.leaderboard);
  assert.equal(loadSave(storage).leaderboard[0].message, "守住核心");
});

test("首次失败只解锁一次核心残响并开启大本营", () => {
  const save = defaultSave();
  assert.equal(registerFailure(save), true);
  assert.equal(save.baseCamp.unlocked, true);
  assert.equal(save.baseCamp.coreEcho, true);
  assert.equal(save.records.failures, 1);
  assert.equal(registerFailure(save), false);
  assert.equal(save.records.failures, 2);
  assert.equal(markBaseRecoverySeen(save), true);
  assert.equal(save.baseCamp.recoverySeen, true);
});

test("两类永久资源按类型安全累积", () => {
  const save = defaultSave();
  assert.equal(grantPermanentResource(save, "echo", 4), true);
  assert.equal(grantPermanentResource(save, "core", 2), true);
  assert.equal(grantPermanentResource(save, "unknown", 6), false);
  assert.deepEqual(save.resources, { echoShards: 4, coreFragments: 2 });
});

test("威胁二十通关立即保护章节能源且修复节点不消耗资源", () => {
  const save = defaultSave();
  assert.equal(grantChapterCoreEnergy(save, 1, { time: 900, kills: 300, score: 50000 }), true);
  assert.equal(save.campaign.coreEnergy[1], true);
  assert.equal(save.campaign.chapterRecords[1].clears, 1);
  assert.equal(grantChapterCoreEnergy(save, 1, { time: 1200, kills: 500, score: 90000 }), false);
  assert.equal(save.campaign.chapterRecords[1].clears, 2);
  assert.equal(repairChapterNode(save, 1), true);
  assert.equal(save.campaign.repairedNodes[1], true);
  assert.equal(save.campaign.unlockedChapters[2], true);
  assert.equal(repairChapterNode(save, 1), false);
});

test("所有遗物默认解锁，研究舱消耗遗响碎片强化已发现遗物三次", () => {
  const save = defaultSave();
  assert.ok(Object.values(save.relicUnlocks).every(Boolean));
  save.resources.echoShards = 24;
  assert.equal(buyRelicUpgrade(save, "decoy"), false);
  assert.equal(discoverHiddenRelic(save, "decoy"), true);
  assert.equal(buyRelicUpgrade(save, "decoy"), true);
  assert.equal(buyRelicUpgrade(save, "decoy"), true);
  assert.equal(buyRelicUpgrade(save, "decoy"), true);
  assert.equal(save.resources.echoShards, 0);
  assert.equal(save.relicArchive.upgrades.decoy, 3);
  assert.equal(buyRelicUpgrade(save, "decoy"), false);
  assert.equal(sanitizeSave(save).relicArchive.upgrades.decoy, 3);
});

test("主动技能研究可跨路线学习并切换启用路线", () => {
  const save = defaultSave();
  assert.deepEqual(save.skillResearch.heal, { branch: null, nodes: [] });
  save.resources.coreFragments = 12;
  assert.equal(skillResearchCost(save, "heal", "guardian", "reinforcedCore"), 3);
  assert.equal(buySkillResearch(save, "heal", "guardian", "reinforcedCore"), true);
  assert.equal(skillResearchCost(save, "heal", "guardian", "lastStand"), 6);
  assert.equal(skillResearchCost(save, "heal", "retaliation", "repulse"), 3);
  assert.equal(buySkillResearch(save, "heal", "retaliation", "repulse"), true);
  assert.equal(buySkillResearch(save, "heal", "guardian", "lastStand"), true);
  assert.equal(save.resources.coreFragments, 0);
  assert.equal(setSkillResearchBranch(save, "heal", "retaliation"), true);
  assert.equal(save.skillResearch.heal.branch, "retaliation");
  assert.equal(skillResearchCost(save, "heal", "guardian", "lastStand"), null);
  assert.equal(buySkillResearch(save, "heal", "guardian", "lastStand"), false);
  assert.deepEqual(sanitizeSave({ version: 1, skillResearch: { heal: { branch: "retaliation", nodes: ["reinforcedCore", "lastStand", "repulse", "unknown", "shardBurst"] }, overload: { branch: "bad", nodes: ["stabilizer"] } } }).skillResearch, {
    heal: { branch: "retaliation", nodes: ["reinforcedCore", "lastStand", "repulse", "shardBurst"] }, overload: { branch: null, nodes: [] }, starfall: { branch: null, nodes: [] }, coinVacuum: { branch: null, nodes: [] }
  });
});

test("遗物栏位初始一格并消耗核心残片逐步扩展至四格", () => {
  const save = defaultSave();
  assert.equal(save.relicSlots, 1);
  save.resources.coreFragments = 13;
  assert.equal(buyRelicSlot(save), true);
  assert.deepEqual([save.relicSlots, save.resources.coreFragments], [2, 11]);
  assert.equal(buyRelicSlot(save), true);
  assert.deepEqual([save.relicSlots, save.resources.coreFragments], [3, 7]);
  assert.equal(buyRelicSlot(save), true);
  assert.deepEqual([save.relicSlots, save.resources.coreFragments], [4, 0]);
  assert.equal(buyRelicSlot(save), false);
});

test("遗物档案馆升级后可安全保存最多三件禁用、发现与套装登记", () => {
  const save = defaultSave();
  save.resources.echoShards = 24;
  for (const id of ["decoy", "lunar", "prismArc"]) discoverHiddenRelic(save, id);
  assert.equal(relicArchiveCapacity(save), 1);
  assert.equal(setDisabledRelic(save, "decoy"), true);
  assert.equal(setDisabledRelic(save, "lunar"), false);
  assert.equal(buyRelicArchiveUpgrade(save), true);
  assert.equal(buyRelicArchiveUpgrade(save), true);
  assert.equal(relicArchiveCapacity(save), 3);
  assert.equal(setDisabledRelic(save, "lunar"), true);
  assert.equal(setDisabledRelic(save, "prismArc"), true);
  assert.equal(toggleRelicSet(save, "prismArc"), true);
  const safe = sanitizeSave(save);
  assert.deepEqual(safe.relicArchive.disabledRelics, ["decoy", "lunar", "prismArc"]);
  assert.equal(safe.relicArchive.discovered.prismArc, true);
  assert.equal(safe.relicArchive.registeredSets.prismArc, true);
  const forged = sanitizeSave({ ...save, relicArchive: { disabledRelic: "unknown", discovered: { prismArc: false }, registeredSets: { prismArc: true } } });
  assert.deepEqual(forged.relicArchive.disabledRelics, []);
  assert.equal(forged.relicArchive.registeredSets.prismArc, false);
});
