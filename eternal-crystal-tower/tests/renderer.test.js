import test from "node:test";
import assert from "node:assert/strict";
import { Renderer, getCombatViewport, getCoverCrop, getTowerAimTarget, getTowerCannonLayout, getTowerVisualState } from "../src/renderer.js";
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

test("主炮转向和后坐期间安装轴固定在炮座上，无目标时仍绘制", () => {
  const state = createGameState(42);
  for (const tier of [0, 1, 2, 3]) {
    const layout = getTowerCannonLayout(tier);
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
      for (const shoot of [0, 0.28]) {
        let matrix = [1, 0, 0, 1, 0, 0];
        const stack = [];
        let draws = 0;
        const ctx = {
          save() { stack.push([...matrix]); },
          restore() { matrix = stack.pop(); },
          translate(x, y) { matrix[4] += matrix[0] * x + matrix[2] * y; matrix[5] += matrix[1] * x + matrix[3] * y; },
          rotate(a) {
            const [a0,b,c,d] = matrix, cos = Math.cos(a), sin = Math.sin(a);
            matrix.splice(0, 4, a0*cos+c*sin, b*cos+d*sin, c*cos-a0*sin, d*cos-b*sin);
          },
          scale(x, y) { matrix[0] *= x; matrix[1] *= x; matrix[2] *= y; matrix[3] *= y; },
          drawImage(...args) {
            const x = args[5] + args[7] * layout.pivotX;
            const y = args[6] + args[8] * layout.pivotY;
            assert.ok(Math.abs(matrix[0]*x + matrix[2]*y + matrix[4] - layout.mountX) < 1e-8);
            assert.ok(Math.abs(matrix[1]*x + matrix[3]*y + matrix[5] - layout.mountY) < 1e-8);
            draws++;
          }
        };
        Renderer.prototype.drawTowerAim.call({
          towerAimTarget: null, towerAimAngle: angle, towerFx: { shoot },
          assets: { towerMainCannonTiers: { complete: true, naturalWidth: 1254, naturalHeight: 1254 } }
        }, ctx, state, getTowerVisualState(state), tier);
        assert.equal(draws, 1);
      }
    }
  }
});
