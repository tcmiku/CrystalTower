import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, purchaseUpgrade, snapshotState, updateGame } from "../src/engine.js";

function simulate(seed, seconds, prepare = () => {}) {
  const state = createGameState(seed);
  prepare(state);
  for (let step = 0; step < seconds * 60; step += 1) updateGame(state, 1 / 60);
  return state;
}

test("相同种子与输入产生相同结果", () => {
  const prepare = (state) => { state.tower.hp = 1_000_000; state.coins = 500; purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "saw"); };
  const first = simulate(20260824, 120, prepare);
  const second = simulate(20260824, 120, prepare);
  assert.deepEqual(snapshotState(first), snapshotState(second));
});

test("不同种子改变出生序列", () => {
  const prepare = (state) => { state.tower.hp = 1_000_000; };
  const first = snapshotState(simulate(11, 20, prepare));
  const second = snapshotState(simulate(12, 20, prepare));
  assert.notDeepEqual(first.enemies, second.enemies);
});

test("约六分四十五秒进入威胁十并生成大首领", () => {
  const state = createGameState(99);
  state.tower.hp = 1_000_000_000_000_000;
  for (let step = 0; step < 406 * 60 + 2; step += 1) updateGame(state, 1 / 60);
  assert.equal(state.threat, 10);
  assert.ok(state.enemies.some((enemy) => enemy.type === "boss"));
});

test("十五分钟压力模拟保持有限且数值有效", { timeout: 60_000 }, () => {
  const state = simulate(777, 900, (current) => {
    current.threat = 10;
    current.tower.hp = 1_000_000_000_000;
    current.coins = 10_000_000;
    for (let index = 0; index < 9; index += 1) purchaseUpgrade(current, "damage");
    for (let index = 0; index < 7; index += 1) purchaseUpgrade(current, "rate");
    purchaseUpgrade(current, "ascend"); purchaseUpgrade(current, "ascend");
    for (let index = 0; index < 5; index += 1) purchaseUpgrade(current, "saw");
    current.tower.hp = 1_000_000_000_000;
  });
  assert.equal(state.time >= 899.9, true);
  assert.equal(state.threat, 20);
  assert.ok(state.enemies.length <= 420);
  assert.ok(state.projectiles.length < 1000);
  assert.ok(Number.isFinite(state.tower.hp));
  assert.ok(Number.isFinite(state.coins));
  for (const enemy of state.enemies) {
    assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y) && Number.isFinite(enemy.hp));
  }
});
