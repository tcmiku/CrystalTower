import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, updateGame, spawnEnemy, damageTower, applyElementalHit, getTowerStats, getTechStatus, purchaseUpgrade, toggleDroneMode, getDroneEnergyMax, snapshotState, collectCoinAt, useSkill, chooseRelic } from "../src/engine.js";
import { MODULES, moduleAt, occupiedSlots, adjacentReactors, moduleDamageMultiplier, modulePlacementStatus, installModule, moveModule, removeModule, upgradeModule } from "../src/modules.js";
import { getTowerVisualState } from "../src/renderer.js";
import { buildTowerModel } from "../src/tower-model.js";

function emptyBay(seed = 71) {
  const state = createGameState(seed);
  assert.equal(removeModule(state, 0), true);
  state.coins = 6000;
  state.spawnTimer = state.wave.nextAt = 9999;
  return state;
}
function advance(state, seconds, observer = () => {}) {
  for (let tick = 0; tick < Math.round(seconds * 60); tick += 1) {
    updateGame(state, 1 / 60);
    observer(state);
  }
}
function target(state, x = 1020, y = 500, type = "brute") {
  const enemy = spawnEnemy(state, type, { x, y });
  Object.assign(enemy, { hp: 100000, maxHp: 100000, speed: 0, damage: 0 });
  return enemy;
}

test("production start has 180 gold, a one-slot cannon and five free slots; restart is independent", () => {
  const state = createGameState(7);
  assert.equal(state.coins, 180);
  assert.equal(occupiedSlots(state), 1);
  assert.equal(moduleAt(state, 0).id, "pulse");
  assert.equal(installModule(state, "blade", 1), true);
  const next = createGameState(7);
  assert.equal(occupiedSlots(next), 1);
  assert.equal(next.tower.upgrades.saw, 0);
  assert.equal(next.coins, 180);
  assert.equal(next.tower.moduleBay.refitCooldown, 0);
});

test("even unlimited gold cannot exceed six slots or bypass them through the old tree or endless relic", () => {
  const state = emptyBay();
  state.coins = 1e9;
  assert.equal(installModule(state, "cannon", 0), true);
  assert.equal(installModule(state, "blade", 3), true);
  assert.equal(installModule(state, "hangar", 2, 1), true);
  assert.equal(occupiedSlots(state), 6);
  state.endlessMode = true;
  state.endlessShop.equippedRelics.push("breakthroughLimit");
  for (const id of ["shield", "frost", "fire", "lightning", "pulse"]) {
    const before = snapshotState(state);
    for (let slot = 0; slot < 6; slot += 1) assert.equal(installModule(state, id, slot), false);
    assert.deepEqual(snapshotState(state), before);
  }
  assert.equal(purchaseUpgrade(state, "fire"), false);
  assert.equal(purchaseUpgrade(state, "sawGun"), false);
  assert.match(getTechStatus(state, "frost").reason, /装配/);
});

test("grid placement rejects row wrapping and supports vertical rotation atomically", () => {
  const state = emptyBay();
  assert.equal(installModule(state, "cannon", 2), false);
  assert.ok(installModule(state, "cannon", 2, 1));
  assert.equal(moduleAt(state, 2), moduleAt(state, 5));
  assert.ok(installModule(state, "fire", 1));
  const before = snapshotState(state);
  for (const slot of [-1, 6, 1.5, NaN, "1"]) assert.equal(installModule(state, "frost", slot), false);
  assert.equal(installModule(state, "__proto__", 0), false);
  assert.equal(installModule(state, "blade", 3, 1), false);
  assert.equal(installModule(state, "blade", 0, 2), false);
  assert.equal(moveModule(state, 5, 1, 0), false);
  assert.deepEqual(snapshotState(state), before);
  assert.ok(moveModule(state, 5, 3, 0));
  assert.equal(moduleAt(state, 4).id, "cannon");
  assert.equal(moduleAt(state, 5), undefined);
  assert.ok(removeModule(state, 1));
  assert.ok(moveModule(state, 3, 0, 1));
  assert.ok(moveModule(state, 0, 0, 0));
  assert.equal(moduleAt(state, 1).id, "cannon");
});

test("insufficient gold, illegal movement and a fourth level never debit money or mutate equipment", () => {
  const state = emptyBay();
  state.coins = 119;
  assert.equal(installModule(state, "blade", 1), false);
  assert.equal(state.coins, 119);
  state.coins = 1000;
  assert.ok(installModule(state, "blade", 1));
  assert.ok(installModule(state, "shield", 4));
  assert.equal(moveModule(state, 2, 3), false);
  assert.ok(moveModule(state, 2, 0, 1));
  assert.equal(moduleAt(state, 0).id, "blade");
  assert.ok(upgradeModule(state, 0));
  assert.ok(upgradeModule(state, 0));
  const before = snapshotState(state);
  assert.equal(upgradeModule(state, 0), false);
  assert.deepEqual(snapshotState(state), before);
  assert.equal(occupiedSlots(state), 3);
});

test("removal refunds 80% of actual investment and removes all derived combat effects", () => {
  const state = emptyBay();
  assert.ok(installModule(state, "blade", 1)); // 120
  assert.ok(upgradeModule(state, 1)); // 180
  assert.ok(upgradeModule(state, 1)); // 270
  assert.equal(state.tower.upgrades.saw, 7);
  assert.equal(state.tower.upgrades.sawStorm, 1);
  const coins = state.coins;
  assert.ok(removeModule(state, 2)); // second cell addresses the same whole module
  assert.equal(state.coins - coins, 456);
  assert.equal(state.tower.upgrades.saw, 0);
  assert.equal(state.tower.upgrades.sawStorm, 0);
  assert.equal(occupiedSlots(state), 0);
  assert.ok(installModule(state, "hangar", 0));
  assert.ok(toggleDroneMode(state));
  advance(state, 0.1);
  state.paused = true;
  assert.ok(removeModule(state, 0));
  assert.equal(state.drones.length, 0);
  assert.equal(state.tower.upgrades.autoCollect, 0);
  assert.equal(toggleDroneMode(state), false);
});

test("adjacency uses shared grid edges, excludes diagonals and never wraps rows", () => {
  const state = emptyBay();
  assert.ok(installModule(state, "cannon", 0));
  assert.ok(installModule(state, "frost", 3));
  assert.ok(installModule(state, "fire", 2));
  assert.ok(installModule(state, "lightning", 5));
  assert.deepEqual(adjacentReactors(state, "cannon").map((module) => module.id), ["frost", "fire"]);
  assert.equal(moduleDamageMultiplier(state, "cannon"), 1.3);
  assert.ok(removeModule(state, 5));
  assert.ok(moveModule(state, 2, 5));
  assert.deepEqual(adjacentReactors(state, "cannon").map((module) => module.id), ["frost"]);
  assert.equal(moduleDamageMultiplier(state, "cannon"), 1.15);
});

test("sector shield reduces only the matching incoming direction, including after moving", () => {
  const state = emptyBay();
  assert.ok(installModule(state, "shield", 0));
  const start = state.tower.hp;
  damageTower(state, 100, false, "test", { x: 720, y: 240 });
  assert.equal(state.tower.hp, start - 55);
  damageTower(state, 100, false, "test", { x: 720, y: 760 });
  assert.equal(state.tower.hp, start - 155);
  assert.ok(moveModule(state, 0, 3));
  damageTower(state, 100, false, "test", { x: 720, y: 760 });
  assert.equal(state.tower.hp, start - 210);
  assert.ok(upgradeModule(state, 3));
  damageTower(state, 100, false, "test", { x: 720, y: 760 });
  assert.equal(state.tower.hp, start - 255);
});

test("enemy attacks and hostile projectiles carry direction into the shield rule", () => {
  const state = emptyBay();
  assert.ok(installModule(state, "shield", 0));
  damageTower(state, 100, false, "wisp", { x: 720, y: 300 });
  assert.ok(state.events.some((event) => event.type === "sectorBlock"));
  const hp = state.tower.hp;
  state.hostileProjectiles.push({ kind: "colossusArtillery", x: 720, y: 465, targetX: 720, targetY: 500, vx: 0, vy: 200, radius: 10, life: 1, damage: 100 });
  advance(state, 0.02);
  assert.equal(state.tower.hp, hp - 55);
});

test("paused assembly supports multiple edits; running refits block immediate shield rotation", () => {
  const state = emptyBay();
  state.time = 1;
  state.paused = true;
  assert.ok(installModule(state, "shield", 0));
  assert.ok(installModule(state, "cannon", 1));
  assert.equal(state.tower.moduleBay.pendingRefit, true);
  state.tower.moduleBay.pendingRefit = false;
  state.tower.moduleBay.refitCooldown = 8; // close-panel commit
  advance(state, 12);
  assert.equal(state.tower.moduleBay.refitCooldown, 8);
  assert.equal(moveModule(state, 0, 4), false);
  state.paused = false;
  advance(state, 8.1);
  assert.ok(moveModule(state, 0, 4));
  assert.equal(moveModule(state, 4, 0), false);
});

test("heavy cannon reaches 620, has a real near blind spot and pierces; ring blades cover the blind spot", () => {
  const cannon = emptyBay();
  assert.ok(installModule(cannon, "cannon", 0));
  const near = target(cannon, 810);
  advance(cannon, 3);
  assert.equal(near.hp, 100000);
  const far = target(cannon, 1240);
  advance(cannon, 3);
  assert.ok(far.hp < 100000);
  const blade = emptyBay();
  assert.ok(installModule(blade, "blade", 0));
  const crowd = target(blade, 810);
  advance(blade, 3);
  assert.ok(crowd.hp < 100000);
  const ranged = target(blade, 990, 500, "hexer");
  advance(blade, 3);
  assert.equal(ranged.hp, 100000);
});

test("light and heavy cannons both fire with independent cadence, and removal stops their future fire", () => {
  const state = emptyBay();
  assert.ok(installModule(state, "pulse", 0));
  assert.ok(installModule(state, "cannon", 2, 1));
  target(state);
  const damages = new Set();
  advance(state, 5, (current) => current.projectiles.forEach((shot) => damages.add(shot.damage)));
  assert.ok(damages.has(12));
  assert.ok(damages.has(40.8));
  state.paused = true;
  assert.ok(removeModule(state, 0));
  assert.ok(removeModule(state, 2));
  state.paused = false;
  advance(state, 3);
  assert.equal(state.projectiles.length, 0);
  assert.equal(getTowerVisualState(state).cannonEnabled, false);
  const mesh = buildTowerModel(getTowerVisualState(state));
  assert.equal(mesh.parts.find((part) => part.name === "barrel").vertices.length, 0);
  assert.ok(mesh.parts.find((part) => part.name === "body").vertices.length > 0);
});

test("dual main guns lock different enemies and both projectiles fly", () => {
  const state = emptyBay();
  assert.ok(installModule(state, "pulse", 0));
  assert.ok(installModule(state, "cannon", 3));
  const near = target(state, 760, 500);
  const far = target(state, 1020, 500);
  const aimed = new Set();
  let dualAimFrames = 0;
  advance(state, 4, (current) => {
    const pulseId = current.tower.gunAimTargetIds?.pulse;
    const cannonId = current.tower.gunAimTargetIds?.cannon;
    if (pulseId && cannonId && pulseId !== cannonId) {
      dualAimFrames += 1;
      aimed.add(pulseId);
      aimed.add(cannonId);
    }
  });
  assert.ok(dualAimFrames > 10, "两门主炮应持续锁定不同目标");
  assert.ok(aimed.has(near.id) && aimed.has(far.id), "轻炮与重炮都应分别命中两个目标");
  const damages = new Set();
  advance(state, 2, (current) => current.projectiles.forEach((shot) => damages.add(shot.damage)));
  assert.ok(damages.has(12));
  assert.ok(damages.has(40.8));
});

test("moving a reactor away removes both the weapon damage bonus and elemental shots", () => {
  const state = emptyBay();
  assert.ok(installModule(state, "pulse", 0));
  assert.ok(installModule(state, "frost", 1));
  target(state);
  let frostShots = 0;
  let maxDamage = 0;
  advance(state, 12, (current) => { frostShots += current.projectiles.filter((shot) => shot.element === "frost").length; maxDamage = Math.max(maxDamage, ...current.projectiles.map((shot) => shot.damage)); });
  assert.ok(frostShots > 0);
  assert.ok(Math.abs(maxDamage - 13.8) < 1e-9);
  state.paused = true;
  assert.ok(moveModule(state, 1, 5));
  state.paused = false;
  advance(state, 2); // allow already-fired shots to finish
  advance(state, 10, (current) => {
    assert.ok(current.projectiles.every((shot) => !shot.element && shot.damage === 12));
  });
});

test("reactions require different elements within three seconds and consume the primer", () => {
  const state = emptyBay();
  const enemy = target(state);
  const neighbor = target(state, 1040, 520);
  const outside = target(state, 720, 200);
  applyElementalHit(state, enemy, "frost", 10);
  applyElementalHit(state, enemy, "frost", 10);
  assert.equal(state.events.filter((event) => event.type === "moduleReaction").length, 0);
  applyElementalHit(state, enemy, "fire", 10);
  assert.equal(state.events.find((event) => event.type === "moduleReaction").reaction, "融爆");
  assert.equal(neighbor.hp, 99982);
  assert.equal(outside.hp, 100000);
  assert.equal(enemy.moduleElement, null);
  applyElementalHit(state, enemy, "lightning", 10);
  assert.equal(state.events.filter((event) => event.type === "moduleReaction").length, 1);
  advance(state, 3.1);
  applyElementalHit(state, enemy, "fire", 10);
  assert.equal(state.events.filter((event) => event.type === "moduleReaction").length, 0);
  assert.equal(enemy.moduleElement, "fire");
});

test("element build triggers reactions through real projectiles, not only direct effect calls", () => {
  const state = emptyBay(19);
  assert.ok(installModule(state, "pulse", 0));
  assert.ok(installModule(state, "frost", 3));
  assert.ok(installModule(state, "fire", 1));
  target(state);
  let reactions = 0;
  advance(state, 30, (current) => { reactions += current.events.filter((event) => event.type === "moduleReaction").length; });
  assert.ok(reactions > 0);
});

test("hive build deals damage, spends energy, stops coin collection and must return to recharge", () => {
  const state = emptyBay();
  assert.ok(installModule(state, "hangar", 0));
  assert.ok(installModule(state, "fire", 5));
  assert.equal(state.tower.upgrades.drone, 3);
  assert.equal(toggleDroneMode(state), true);
  const enemy = target(state, 890);
  const energy = state.tower.droneEnergy;
  state.coinOrbs.push({ x: 690, y: 540, renderX: 690, renderY: 540, value: 10, age: 0, collectAge: 0, collector: null });
  advance(state, 1);
  assert.ok(state.tower.droneEnergy < energy);
  assert.equal(state.coinOrbs[0]?.collector, null);
  let depleted = false;
  for (let tick = 0; tick < 60 * 60 && !depleted; tick += 1) {
    updateGame(state, 1 / 60);
    depleted = state.events.some((event) => event.type === "droneDepleted");
  }
  assert.ok(enemy.hp < 100000);
  assert.ok(depleted);
  assert.equal(state.tower.droneMode, "collect");
  const before = state.tower.droneEnergy;
  advance(state, 5);
  assert.ok(state.tower.droneEnergy > before);
  assert.ok(state.tower.droneEnergy <= getDroneEnergyMax(state));
  assert.equal(toggleDroneMode(state), true);
});

test("core tuning stays available without requiring a full elemental loadout", () => {
  const state = emptyBay();
  state.threat = 12;
  assert.ok(purchaseUpgrade(state, "ascend"));
  assert.ok(purchaseUpgrade(state, "ascend"));
  assert.ok(purchaseUpgrade(state, "ascend"));
  assert.equal(state.tower.upgrades.ascend, 3);
  assert.equal(occupiedSlots(state), 0);
  assert.equal(state.tower.upgrades.frost, 0);
});

export const LOADOUTS = {
  cannon: [["cannon", 0], ["shield", 5], ["fire", 3]],
  blade: [["blade", 0], ["shield", 5], ["frost", 3]],
  hive: [["hangar", 0], ["shield", 5], ["fire", 3]],
  element: [["pulse", 0], ["fire", 1], ["frost", 3], ["lightning", 5]],
  mixed: [["cannon", 0], ["blade", 3], ["shield", 2], ["fire", 5]]
};

export function simulateLoadout(id, seed = 20260911) {
  const state = emptyBay(seed);
  state.spawnTimer = 0.65; state.wave.nextAt = 90;
  state.coins = 700;
  for (const [module, slot] of LOADOUTS[id]) assert.ok(installModule(state, module, slot));
  let reactions = 0;
  let energyReturns = 0;
  for (let tick = 0; tick < 900 * 60 && !state.over; tick += 1) {
    if (tick % 30 === 0) {
      for (const orb of state.coinOrbs) collectCoinAt(state, orb.x, orb.y, 12);
      if (state.relicChoice) chooseRelic(state, state.relicChoice.choices[0]);
      if (id === "hive" && state.tower.droneMode === "collect" && state.tower.droneEnergy >= getDroneEnergyMax(state) * 0.9) toggleDroneMode(state);
      if (state.tower.hp < getTowerStats(state).maxHp * 0.75) useSkill(state, "heal");
      const primarySlot = LOADOUTS[id][0][1];
      if (moduleAt(state, primarySlot).level < 3) {
        if (state.tower.moduleBay.refitCooldown === 0) upgradeModule(state, primarySlot);
      } else {
        for (const key of ["damage", "rate", "ascend"]) purchaseUpgrade(state, key);
      }
    }
    updateGame(state, 1 / 60);
    reactions += state.events.filter((event) => event.type === "moduleReaction").length;
    energyReturns += state.events.filter((event) => event.type === "droneDepleted").length;
  }
  return { build: id, seconds: Math.round(state.time * 10) / 10, kills: state.stats.kills, threat: state.threat, over: state.over, hp: Math.round(state.tower.hp), reactions, energyReturns, snapshot: snapshotState(state) };
}

test("bounded fixed-seed runs expose build consequences and reproduce deterministically", { timeout: 60000 }, () => {
  const runs = Object.keys(LOADOUTS).map((id) => simulateLoadout(id));
  for (const run of runs) {
    assert.ok(run.over || run.seconds === 900, `${run.build} must finish or reach the simulation horizon`);
    assert.ok(run.seconds > 0 && run.seconds <= 900);
    assert.ok(run.kills > 0);
    assert.ok(Number.isFinite(run.hp));
  }
  assert.ok(new Set(runs.map((run) => run.kills)).size >= 3);
  assert.ok(runs.find((run) => run.build === "hive").energyReturns > 0);
  assert.ok(runs.find((run) => run.build === "element").reactions > 0);
  assert.deepEqual(simulateLoadout("element").snapshot, runs.find((run) => run.build === "element").snapshot);
  console.log("MODULE_BUILD_RUNS", JSON.stringify(runs.map(({ snapshot, ...result }) => result)));
});
