import test from "node:test";
import assert from "node:assert/strict";
import { buyResearch, defaultSave, loadSave, sanitizePlayerName, sanitizeSave, SAVE_KEY, submitLeaderboardEntry, writeSave } from "../src/storage.js";

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
  assert.deepEqual(safe.records, { highestThreat: 1, longestTime: 0, totalKills: 0 });
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
