import test from 'node:test';
import assert from 'node:assert/strict';
import { measureWeapon } from '../scripts/module-balance.mjs';

// Behavioral guardrails, measured over combat updates rather than copied tuning constants.
test('heavy cannon upgrades increase sustained damage while preserving its close-range blind spot', () => {
  const damage = [1, 2, 3].map(level => measureWeapon('cannon', level, 'ranged').dps);
  assert.ok(damage[1] > damage[0] * 1.3);
  assert.ok(damage[2] > damage[1] * 1.15);
  assert.equal(measureWeapon('cannon', 3, 'near').dps, 0);
  assert.ok(measureWeapon('cannon', 3, 'boss').dps > damage[2] * 1.5);
});

test('lance specialization reaches useful charge sooner against a durable boss', () => {
  const plain = measureWeapon('cannon', 3, 'boss', { seconds: 8 });
  const lance = measureWeapon('cannon', 3, 'boss', { seconds: 8, specialization: 'cannonLance' });
  assert.ok(lance.dps > plain.dps, `${lance.dps} should exceed ${plain.dps} during initial lock-on`);
});

test('orbit blade keeps its close crowd role with bounded tier growth', () => {
  const damage = [1, 2, 3].map(level => measureWeapon('blade', level, 'crowd').dps);
  assert.ok(damage[0] > 600);
  assert.ok(damage[1] > damage[0] && damage[1] < damage[0] * 4);
  // Tier III unlocks the storm; retain that spike but cap total I-to-III growth.
  assert.ok(damage[2] > damage[1] && damage[2] < damage[1] * 5);
  assert.ok(damage[2] < damage[0] * 12);
  assert.equal(measureWeapon('blade', 3, 'ranged').dps, 0);
});

test('return blades remain effective without inheriting the exponential contact stack', () => {
  const cannon = measureWeapon('cannon', 3, 'boss').dps;
  const blade = measureWeapon('blade', 3, 'boss', { specialization: 'bladeReturn' }).dps;
  assert.ok(blade > cannon * .5 && blade < cannon * 2, `${blade} versus cannon ${cannon}`);
  const tiers = [1, 2, 3].map(level => measureWeapon('blade', level, 'ranged', { specialization: 'bladeReturn' }).dps);
  assert.ok(tiers[1] > tiers[0] && tiers[2] > tiers[1]);
});

test('hangar upgrades improve sustained output without spending most of combat recharging', () => {
  const levels = [1, 2, 3].map(level => measureWeapon('hangar', level, 'ranged'));
  for (const result of levels) {
    assert.ok(result.returns >= 2, 'measurement must cover depletion and relaunch');
    assert.ok(result.attackDuty > .5 && result.attackDuty < .8);
    assert.ok(Number.isFinite(result.dps));
  }
  assert.ok(levels[1].dps > levels[0].dps * 1.4);
  assert.ok(levels[2].dps > levels[1].dps * 1.4);
});
