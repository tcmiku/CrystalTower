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
