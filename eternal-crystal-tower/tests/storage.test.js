import test from "node:test";
import assert from "node:assert/strict";
import { buyRelicSlot, buyRelicUnlock, buyResearch, defaultSave, grantPermanentResource, loadSave, markBaseRecoverySeen, registerFailure, sanitizePlayerName, sanitizeSave, SAVE_KEY, submitLeaderboardEntry, unlockDoubleSpeed, writeSave } from "../src/storage.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data)
  };
}

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
  assert.deepEqual(safe.research, { damage: 10, health: 0, income: 3 });
  assert.equal(safe.settings.muted, true);
  assert.deepEqual(safe.records, { highestThreat: 1, longestTime: 0, totalKills: 0, failures: 0 });
});

test("永久研究花费为当前等级加一", () => {
  const save = defaultSave();
  save.stardust = 3;
  assert.equal(buyResearch(save, "damage"), true);
  assert.equal(save.research.damage, 1);
  assert.equal(save.stardust, 2);
  assert.equal(buyResearch(save, "damage"), true);
  assert.equal(save.research.damage, 2);
  assert.equal(save.stardust, 0);
  assert.equal(buyResearch(save, "damage"), false);
});

test("写入后能够无损读回有效存档", () => {
  const storage = memoryStorage();
  const save = defaultSave();
  save.stardust = 12;
  save.research.health = 4;
  writeSave(save, storage);
  assert.deepEqual(loadSave(storage), save);
});


test("威胁十五首领奖励会永久解锁二倍速且不能重复解锁", () => {
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
  submitLeaderboardEntry(save, { name: "晶刃王", score: 9876, kills: 42, threat: 8, time: 300, coins: 17, date: 123 });
  writeSave(save, storage);
  assert.deepEqual(loadSave(storage).leaderboard, save.leaderboard);
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

test("四类永久资源按类型安全累积", () => {
  const save = defaultSave();
  assert.equal(grantPermanentResource(save, "echo", 4), true);
  assert.equal(grantPermanentResource(save, "core", 2), true);
  assert.equal(grantPermanentResource(save, "ember", 6), true);
  assert.equal(grantPermanentResource(save, "emberCore", 3), true);
  assert.deepEqual(save.resources, { echoShards: 4, coreFragments: 2, emberShards: 6, emberCores: 3 });
});

test("研究舱消耗余烬碎片并永久解锁临时遗物", () => {
  const save = defaultSave();
  save.resources.emberShards = 5;
  assert.equal(save.relicUnlocks.ward, true);
  assert.equal(buyRelicUnlock(save, "ward"), false);
  assert.equal(buyRelicUnlock(save, "decoy"), true);
  assert.equal(save.resources.emberShards, 2);
  assert.equal(save.relicUnlocks.decoy, true);
  assert.equal(buyRelicUnlock(save, "stormglass"), false);
  assert.equal(sanitizeSave(save).relicUnlocks.ward, true);
});

test("遗物栏位初始一格并消耗余烬核心逐步扩展至四格", () => {
  const save = defaultSave();
  assert.equal(save.relicSlots, 1);
  save.resources.emberCores = 13;
  assert.equal(buyRelicSlot(save), true);
  assert.deepEqual([save.relicSlots, save.resources.emberCores], [2, 11]);
  assert.equal(buyRelicSlot(save), true);
  assert.deepEqual([save.relicSlots, save.resources.emberCores], [3, 7]);
  assert.equal(buyRelicSlot(save), true);
  assert.deepEqual([save.relicSlots, save.resources.emberCores], [4, 0]);
  assert.equal(buyRelicSlot(save), false);
});
