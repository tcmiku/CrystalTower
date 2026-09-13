import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, getTowerStats, purchaseUpgrade } from '../src/engine.js';
import { coreUpgradePresentation } from '../src/core-upgrade-ui.js';

test('核心升级预览与实际购买结果一致，预览不修改本局状态', () => {
  for (const key of ['damage', 'rate', 'ascend']) {
    const state = createGameState(1);
    state.coins = 10000;
    state.threat = 10;
    state.tower.upgrades.damage = 1;
    const before = structuredClone(state);
    const preview = coreUpgradePresentation(state, key);
    assert.deepEqual(structuredClone(state), before);
    assert.equal(preview.ready, true);
    assert.equal(purchaseUpgrade(state, key), true);
    const stats = getTowerStats(state);
    const format = value => Number(value.toFixed(1)).toString();
    if (key === 'damage') assert.ok(preview.effect.endsWith(`→ ${format(stats.damage)}`));
    if (key === 'rate') assert.ok(preview.effect.endsWith(`→ ${format(stats.fireRate)} 次`));
    if (key === 'ascend') assert.match(preview.effect, /6 → 9 格 · 生命 \+200/);
  }
});

test('核心升级区分前置条件、威胁、余额、满级和结束状态', () => {
  const state = createGameState(1);
  assert.equal(coreUpgradePresentation(state, 'rate').reason, '需要伤害 1 级');
  assert.equal(coreUpgradePresentation(state, 'ascend').reason, '威胁 3 解锁');
  state.coins = 19;
  assert.equal(coreUpgradePresentation(state, 'damage').reason, '还差 1 金币');
  state.coins = 20;
  assert.equal(coreUpgradePresentation(state, 'damage').ready, true);
  state.over = true;
  assert.equal(coreUpgradePresentation(state, 'damage').ready, false);
  state.tower.upgrades.damage = 10;
  const maxed = coreUpgradePresentation(state, 'damage');
  assert.equal(maxed.ready, false);
  assert.equal(maxed.reason, '已达到最高等级');
  assert.doesNotMatch(maxed.effect, /Infinity|NaN/);
});
