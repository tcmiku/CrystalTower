import test from "node:test";
import assert from "node:assert/strict";
import { getCombatViewport, getCoverCrop } from "../src/renderer.js";

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
