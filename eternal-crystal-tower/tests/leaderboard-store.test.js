import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LeaderboardStore } from "../scripts/leaderboard-store.js";

test("全服排行榜跨实例持久化并返回所有人的名次", async () => {
  const directory = await mkdtemp(join(tmpdir(), "crystal-tower-ranking-"));
  const file = join(directory, "leaderboard.json");
  const firstServer = new LeaderboardStore(file);

  await firstServer.submit({ name: "守望者乙", score: 1200, threat: 4, kills: 12, date: 2 });
  const result = await firstServer.submit({ name: "守望者甲", score: 3200, threat: 6, kills: 30, date: 1 });

  assert.equal(result.rank, 1);
  assert.deepEqual(result.entries.map((entry) => entry.name), ["守望者甲", "守望者乙"]);
  const restartedServer = new LeaderboardStore(file);
  assert.deepEqual((await restartedServer.read()).map((entry) => entry.score), [3200, 1200]);
});

test("排行榜前三留言随成绩条目排序并覆盖旧榜位", async () => {
  const directory = await mkdtemp(join(tmpdir(), "crystal-tower-ranking-"));
  const store = new LeaderboardStore(join(directory, "leaderboard.json"));
  await store.submit({ name: "旧榜一", message: "旧留言", score: 100, threat: 1, kills: 1, date: 1 });
  const result = await store.submit({ name: "新榜一", message: "新留言", score: 200, threat: 1, kills: 1, date: 2 });
  assert.deepEqual(result.entries.slice(0, 2).map((entry) => [entry.name, entry.message]), [["新榜一", "新留言"], ["旧榜一", "旧留言"]]);
  const normalized = await store.submit({ name: "超长", message: "一二三四五六七八九十十一", score: 300, threat: 1, kills: 1, date: 3 });
  assert.equal(Array.from(normalized.entry.message).length, 10);
});
test("并发提交不会互相覆盖", async () => {
  const directory = await mkdtemp(join(tmpdir(), "crystal-tower-ranking-"));
  const store = new LeaderboardStore(join(directory, "leaderboard.json"));
  await Promise.all(Array.from({ length: 20 }, (_, index) => store.submit({
    name: `P${index}`,
    score: index * 100,
    threat: index + 1,
    kills: index,
    date: index + 1
  })));
  const entries = await store.read();
  assert.equal(entries.length, 20);
  assert.equal(entries[0].score, 1900);
  assert.equal(entries.at(-1).score, 0);
});
