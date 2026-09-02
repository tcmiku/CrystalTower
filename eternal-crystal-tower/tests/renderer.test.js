import test from "node:test";
import assert from "node:assert/strict";
import { getCombatViewport, getCoverCrop, getTowerAimTarget, getTowerVisualState } from "../src/renderer.js";
import { createGameState, getTowerStats } from "../src/engine.js";

test("桌面 UI 收缩后战斗视口扩展到剩余场地中央", () => {
  const expanded = getCombatViewport(2048, 956, { sidePanelCollapsed: false, skillBarCollapsed: false });
  const collapsed = getCombatViewport(2048, 956, { sidePanelCollapsed: true, skillBarCollapsed: true });
  assert.deepEqual(
    { width: expanded.width, height: expanded.height, rightInset: expanded.rightInset, bottomInset: expanded.bottomInset },
    { width: 1780, height: 852, rightInset: 268, bottomInset: 104 }
  );
  assert.deepEqual(
    { width: collapsed.width, height: collapsed.height, rightInset: collapsed.rightInset, bottomInset: collapsed.bottomInset },
    { width: 1966, height: 956, rightInset: 82, bottomInset: 0 }
  );
});

test("超宽战斗画布通过上下裁切保持背景比例", () => {
  const crop = getCoverCrop(1448, 1086, 2048, 956, 0.4, 0.42);
  assert.equal(crop.x, 0);
  assert.equal(crop.width, 1448);
  assert.ok(crop.y > 0);
  assert.ok(crop.height < 1086);
  assert.ok(Math.abs(crop.width / crop.height - 2048 / 956) < 1e-10);
});

test("竖向战斗画布通过左右裁切保持背景比例", () => {
  const crop = getCoverCrop(1448, 1086, 720, 960);
  assert.equal(crop.y, 0);
  assert.equal(crop.height, 1086);
  assert.ok(crop.x > 0);
  assert.ok(crop.width < 1448);
  assert.ok(Math.abs(crop.width / crop.height - 720 / 960) < 1e-10);
});

test("晶塔视觉状态按生命比例分为四档", () => {
  const state = createGameState(42);
  const maxHp = getTowerStats(state).maxHp;
  for (const [ratio, band] of [[0.7, "intact"], [0.699, "damaged"], [0.4, "damaged"], [0.399, "critical"], [0.15, "critical"], [0.149, "collapse"]]) {
    state.tower.hp = maxHp * ratio;
    assert.equal(getTowerVisualState(state).damageBand, band);
  }
});

test("晶塔视觉状态识别互斥炮膛路线与技能热区", () => {
  const state = createGameState(42);
  state.tower.upgrades.ascend = 2;
  state.tower.upgrades.cannonSiege = 1;
  assert.equal(getTowerVisualState(state).cannonRoute, "siege");
  state.tower.upgrades.cannonSiege = 0;
  state.tower.upgrades.cannonSplit = 1;
  state.skills.overload.active = 1;
  state.skills.overload.heat = 52;
  assert.equal(getTowerVisualState(state).cannonRoute, "split");
  assert.equal(getTowerVisualState(state).overloadBand, "hot");
  state.skills.overload.heat = 100;
  assert.equal(getTowerVisualState(state).overloadBand, "overheated");
  state.skills.overload.active = 0;
  state.skills.starfall.aiming = true;
  assert.equal(getTowerVisualState(state).starfallBand, "aiming");
  state.skills.heal.shieldBurstArmed = true;
  assert.equal(getTowerVisualState(state).shieldBand, "armed");
});
test("晶塔主炮优先锁定当前优先目标并在失效后回退最近目标", () => {
  const state = createGameState(7);
  state.enemies = [
    { id: 1, hp: 10, x: 610, y: 300, radius: 16, type: "wisp" },
    { id: 2, hp: 10, x: 560, y: 420, radius: 16, type: "brute" }
  ];
  state.tower.priorityTargetIds = [1];
  assert.equal(getTowerAimTarget(state).id, 1);
  state.enemies[0].hp = 0;
  assert.equal(getTowerAimTarget(state).id, 2);
  state.enemies[1].hp = 0;
  assert.equal(getTowerAimTarget(state), null);
});