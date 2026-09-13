import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, purchaseUpgrade, snapshotState, updateGame } from "../src/engine.js";
import { installModule, upgradeModule, removeModule } from "../src/modules.js";

function simulate(seed, seconds, prepare = () => {}) {
  const state = createGameState(seed);
  prepare(state);
  for (let step = 0; step < seconds * 60; step += 1) updateGame(state, 1 / 60);
  return state;
}

test("相同种子与输入产生相同结果", () => {
  const prepare = (state) => { state.tower.hp = 1_000_000; state.coins = 500; purchaseUpgrade(state, "damage"); assert.ok(installModule(state, "blade", 1)); };
  const first = simulate(20260824, 120, prepare);
  const second = simulate(20260824, 120, prepare);
  assert.deepEqual(snapshotState(first), snapshotState(second));
});

test("不同种子改变出生序列", () => {
  const prepare = (state) => { state.tower.hp = 1_000_000; removeModule(state,0); };
  const first = snapshotState(simulate(11, 20, prepare));
  const second = snapshotState(simulate(12, 20, prepare));
  assert.notDeepEqual(first.enemies, second.enemies);
});

test("威胁十排入首领，完成清理和登场预警后出现", () => {
  const state = createGameState(99);
  state.tower.hp = 1_000_000_000_000_000;
  state.assault.difficultyTime=404;
  state.threat=9;
  for (let step = 0; step < 15 * 60; step += 1) updateGame(state, 1 / 60);
  assert.equal(state.threat, 10);
  assert.ok(state.assault.pendingBosses.includes('boss'));
  // Finish the current wave; the boss must not erase live enemies on its arrival.
  for(let i=0;i<120*60;i++) {
    state.enemies.forEach(e=>{if(e.type!=='boss'&&e.type!=='anchor')e.hp=0;});
    updateGame(state,1/60);
    if(state.enemies.some(e=>e.type==='boss'))break;
  }
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
    assert.ok(installModule(current, "blade", 1));
    assert.ok(upgradeModule(current, 1));
    assert.ok(upgradeModule(current, 1));
    current.tower.hp = 1_000_000_000_000;
  });
  assert.equal(state.time >= 899.9, true);
  assert.ok(state.threat>1&&state.threat<20,'difficulty advances during assaults, not the entire wall-clock run');
  assert.ok(state.enemies.length <= 420);
  assert.ok(state.projectiles.length < 1000);
  assert.ok(Number.isFinite(state.tower.hp));
  assert.ok(Number.isFinite(state.coins));
  for (const enemy of state.enemies) {
    assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y) && Number.isFinite(enemy.hp));
  }
});
