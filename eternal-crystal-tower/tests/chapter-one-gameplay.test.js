import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, offerRelicChoice, chooseRelic, lockRelicChoice, applyElementalHit, damageEnemy, spawnEnemy, updateGame, damageTower, toggleDroneMode, getTowerStats, getTowerPosition, updateChapterOneObjectives } from "../src/engine.js";
import { installModule, removeModule, specializeModule, installedModule, moveModule, SPECIALIZATIONS } from "../src/modules.js";
import { FORMATIONS, sectorAngle } from "../src/chapter-one.js";
import { Renderer } from "../src/renderer.js";

function arena(seed = 61) {
  const state = createGameState(seed);
  state.spawnTimer = state.wave.nextAt = 99999;
  state.coins = 10000;
  return state;
}
function advance(state, seconds, observe = () => {}) {
  for (let tick = 0; tick < Math.round(seconds * 60); tick++) { updateGame(state, 1 / 60); observe(state); }
}
function target(state, x = 970, y = 500, type = "brute") {
  const enemy = spawnEnemy(state, type, { x, y });
  Object.assign(enemy, { hp: 100000, maxHp: 100000, speed: 0, damage: 0, attackCooldown: 999 });
  return enemy;
}
function pick(state, id, replaceId) {
  state.relicChoice = { source: "eliteWave", choices: [id] };
  return chooseRelic(state, id, replaceId);
}

test("full relic slots continue offering rewards; replacement is explicit and atomic", () => {
  const s = arena();
  assert.ok(pick(s, "ward"));
  assert.ok(offerRelicChoice(s, "boss"));
  assert.equal(s.relicChoice.choices.length, 3);
  assert.ok(s.relicChoice.choices.some(id => id.startsWith("spec:")));
  assert.ok(s.relicChoice.choices.some(id => id.startsWith("supply:")));
  const next = s.relicChoice.choices.find(id => !id.includes(":"));
  const before = structuredClone(s.relics);
  assert.equal(chooseRelic(s, next), false);
  assert.equal(chooseRelic(s, next, "missing"), false);
  assert.deepEqual(s.relics, before);
  assert.ok(chooseRelic(s, next, "ward"));
  assert.equal(s.relics.owned.ward, false);
  assert.equal(s.relics.owned[next], true);
  assert.equal(s.relics.picks, 1);
});

test("specializations are exclusive, survive reinstall, reset next run and do not consume relic slots", () => {
  const s = arena();
  assert.ok(pick(s, "spec:pulseSplit"));
  assert.equal(s.relics.picks, 0);
  assert.equal(specializeModule(s, "pulseFocus"), false);
  assert.ok(removeModule(s, 0));
  assert.ok(installModule(s, "pulse", 4));
  assert.equal(installedModule(s, "pulse").specialization, "pulseSplit");
  assert.equal(installedModule(createGameState(61), "pulse").specialization, undefined);
  assert.equal(specializeModule(s, "hangarHeavy"), false);
});

test("reward locking excludes supplies and specializations; empty loadout still has a way out", () => {
  const s = arena();
  offerRelicChoice(s);
  const spec = s.relicChoice.choices.find(id => id.startsWith("spec:"));
  assert.equal(lockRelicChoice(s, spec), false);
  assert.ok(removeModule(s, 0));
  s.relicChoice = null;
  assert.ok(offerRelicChoice(s));
  assert.ok(s.relicChoice.choices.some(id => id.startsWith("supply:")));
  assert.ok(s.relicChoice.choices.every(id => !id.startsWith("spec:")));
  const hp = getTowerStats(s).maxHp;
  s.tower.hp = hp - 10;
  assert.ok(pick(s, "supply:repair"));
  assert.equal(s.tower.hp, hp);
  assert.equal(s.tower.shield, hp * 0.3 - 10);
  const money = s.coins;
  assert.ok(pick(s, "supply:coins"));
  assert.equal(s.coins - money, 92);
});

test("reactions have distinct damage, vulnerability and nonrecursive link behavior", () => {
  const melt = arena(), a = target(melt), b = target(melt, 990), outside = target(melt, 640);
  applyElementalHit(melt, a, "frost", 10); applyElementalHit(melt, a, "fire", 10);
  assert.equal(b.hp, 99982); assert.equal(outside.hp, 100000);
  const shard = arena(), c = target(shard), d = target(shard, 990);
  applyElementalHit(shard, c, "frost", 10); applyElementalHit(shard, c, "lightning", 10);
  assert.equal(d.fractureTimer, 4);
  const before = c.hp; damageEnemy(shard, c, 100);
  assert.equal(before - c.hp, 130);
  const chain = arena(), e = target(chain), f = target(chain, 990), g = target(chain, 1010);
  applyElementalHit(chain, e, "fire", 10); applyElementalHit(chain, e, "lightning", 10);
  const health = [e.hp, f.hp, g.hp];
  damageEnemy(chain, e, 100);
  assert.deepEqual([health[0]-e.hp, health[1]-f.hp, health[2]-g.hp], [100, 30, 30]);
  f.x = 1500; const farHp = f.hp; damageEnemy(chain, e, 100);
  assert.equal(f.hp, farHp);
  e.conductTimer = 0; const unlinkedHp = g.hp; damageEnemy(chain, e, 100);
  assert.equal(g.hp, unlinkedHp);
});

test("enraged chapter-one bosses retain elemental reactions and convert freeze to brittle", () => {
  const s = arena();
  const boss = spawnEnemy(s, "sovereign");
  Object.assign(boss, { hp: boss.maxHp, healthBar: 1, spawnShield: 0, phaseBreakInvulnerability: 0, entryTimer: 0 });
  damageEnemy(s, boss, 1);
  assert.ok(boss.enraged); assert.equal(boss.elementImmune, false);
  assert.ok(applyElementalHit(s, boss, "frost", 10));
  assert.equal(boss.freezeTimer, 0); assert.equal(boss.fractureTimer, 2);
  applyElementalHit(s, boss, "fire", 10);
  assert.ok(s.events.some(event => event.type === "moduleReaction"));
});

test("boss nodes are hittable near the tower, transmit damage, and only one outcome resolves", () => {
  const s = arena(); removeModule(s, 0);
  const boss = spawnEnemy(s, "sovereign");
  Object.assign(boss, { entryTimer: 0, phaseBreakInvulnerability: 0, spawnShield: 0, damage: 0, skillCooldown: 99 });
  updateChapterOneObjectives(s, 0.1);
  const nodes = s.enemies.filter(enemy => enemy.weakpointRole);
  assert.equal(nodes.length, 3);
  const chain = nodes.find(enemy => enemy.weakpointRole === "chain");
  const center = getTowerPosition(s);
  assert.ok(Math.hypot(chain.x-center.x, chain.y-center.y) < 100);
  const before = boss.hp;
  damageEnemy(s, chain, 10);
  assert.equal(before-boss.hp, 20);
  damageEnemy(s, chain, chain.hp+1);
  advance(s, 0.02);
  assert.equal(s.enemies.filter(enemy => enemy.weakpointRole).length, 0);
  assert.equal(s.events.filter(event => event.type === "bossWeakpointBroken").length, 1);
  updateChapterOneObjectives(s, 1);
  assert.equal(s.enemies.filter(enemy => enemy.weakpointRole).length, 0);
  boss.hp = 0; updateChapterOneObjectives(s, 20);
  assert.equal(s.enemies.filter(enemy => enemy.weakpointRole).length, 0);
});

test("shield adjacency charges heavy cannon, and refits remove the benefit", () => {
  const s = arena(); removeModule(s, 0);
  installModule(s, "shield", 0); installModule(s, "cannon", 1);
  damageTower(s, 100, false, "test", { x:720,y:300 });
  assert.equal(s.tower.moduleShieldCharge, 1);
  damageTower(s, 100, false, "test", { x:720,y:300 });
  assert.equal(s.tower.moduleShieldCharge, 1);
  moveModule(s, 0, 3);
  assert.equal(s.tower.moduleShieldCharge, 0);
});

test("low-energy recall boosts an adjacent light cannon but cannot be spammed", () => {
  const s = arena(); installModule(s, "hangar", 1);
  toggleDroneMode(s); s.tower.droneEnergy = 30;
  toggleDroneMode(s);
  assert.equal(s.tower.pulseRelay, 6);
  s.tower.pulseRelay = 0;
  toggleDroneMode(s); toggleDroneMode(s);
  assert.equal(s.tower.pulseRelay, 0);
});

test("every specialization changes a real combat path", () => {
  for (const [id, meta] of Object.entries(SPECIALIZATIONS)) {
    const s = arena(); removeModule(s, 0); installModule(s, meta.module, 0);
    assert.ok(specializeModule(s, id));
    target(s, 940); target(s, 1000, 515);
    if (meta.module === "hangar") toggleDroneMode(s);
    const seen = new Set();
    advance(s, 8, state => state.events.forEach(event => seen.add(event.type)));
    if (id === "bladeReturn") assert.ok(seen.has("sawLaunch"));
    if (id === "cannonLance") assert.ok(seen.has("cannonStarPiercer"));
    if (id === "pulseSplit") assert.ok(seen.has("cannonSplit"));
    if (id === "pulseFocus") assert.ok(installedModule(s, "pulse").focusStacks > 0);
    if (id === "hangarHeavy") assert.equal(s.tower.upgrades.drone, 2);
    if (id === "hangarSwarm") assert.equal(s.tower.upgrades.drone, 5);
    if (id === "cannonBurst") assert.equal(s.tower.upgrades.cannonPierce, 0);
  }
});

test("four-gate opening advertises the actual formation and both pincer directions", () => {
  for (const [index, formation, gate] of [[2,'wall',0],[3,'battery',1],[4,'brood',3],[5,'pincer',0]]) {
    const s=arena();removeModule(s,0);s.wave.index=index;s.wave.nextAt=12;
    advance(s,2.1);
    assert.equal(s.wave.formation,formation);assert.equal(s.wave.direction,gate);assert.equal(s.wave.sectorCount,4);
    const planned=s.assault.plan;
    assert.ok(planned.length>0);assert.ok(planned.every(u=>u.gate===gate||formation==='pincer'&&u.gate===2));
    if(formation==='brood')assert.equal(planned.filter(u=>u.brood).length,1);
    advance(s,10);
    assert.ok(s.enemies.length>0);assert.ok(s.enemies.every(e=>e.formation===formation));
    if(formation==='pincer')assert.deepEqual([...new Set(s.enemies.map(e=>e.gate))].sort(),[0,2]);
  }
});

test("blade screen consumes real incoming projectiles with a cooldown", () => {
  const s = arena(); removeModule(s, 0); installModule(s, "blade", 0); specializeModule(s, "bladeGuard");
  const shot = () => ({ kind: "colossusArtillery", x: 820, y: 500, vx: -40, vy: 0, targetX: 720, targetY: 500, life: 10, damage: 100, radius: 5 });
  s.hostileProjectiles.push(shot(), shot());
  advance(s, 0.02);
  assert.equal(s.hostileProjectiles.length, 1);
  assert.ok(s.tower.bladeExpansion > 0);
  advance(s, 0.5);
  assert.equal(s.hostileProjectiles.length, 1);
  advance(s, 0.8);
  assert.equal(s.hostileProjectiles.length, 0);
});

test("bombard specialization splashes off-axis targets and flying blades keep adjacent elements", () => {
  const s = arena(); removeModule(s, 0); installModule(s, "cannon", 0); specializeModule(s, "cannonBurst");
  target(s, 950, 500); const splashTarget = target(s, 970, 540);
  advance(s, 3);
  assert.ok(splashTarget.hp < 100000);
  const blade = arena(); removeModule(blade, 0); installModule(blade, "blade", 0); installModule(blade, "frost", 3); specializeModule(blade, "bladeReturn");
  const distant = target(blade, 1020);
  let frosts = 0;
  advance(blade, 20, state => { frosts += state.events.filter(event => event.type === "elementHit" && event.element === "frost").length; });
  assert.ok(distant.hp < 100000);
  assert.ok(frosts > 0);
});

test("supply-node stun interrupts the boss; chapter two has no chapter-one objectives", () => {
  const s = arena(); removeModule(s, 0);
  const boss = spawnEnemy(s, "colossus");
  boss.skillCooldown = 99;
  updateChapterOneObjectives(s, 0);
  const relay = s.enemies.find(enemy => enemy.weakpointRole === "relay");
  boss.activeSkill = "beam";
  damageEnemy(s, relay, relay.hp + 1);
  advance(s, 0.02);
  assert.ok(boss.objectiveStun > 0);
  assert.equal(boss.activeSkill, null);
  const remaining = boss.skillCooldown;
  advance(s, 1);
  assert.equal(boss.skillCooldown, remaining);
  const sea = createGameState(9, undefined, undefined, undefined, undefined, undefined, undefined, 2);
  spawnEnemy(sea, "sovereign");
  updateChapterOneObjectives(sea, 20);
  assert.equal(sea.enemies.some(enemy => enemy.weakpointRole), false);
});

test("pincer warning stays inside the visible battlefield and below the top HUD", () => {
  const labels = [], points = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => {
    if (key === "fillText") labels.push(args);
    if (key === "moveTo" || key === "lineTo") points.push(args);
  }, set: () => true });
  const s = arena();
  Object.assign(s.wave, { nextAt: 10, warningStarted: true, direction: 0, secondary: 2, sectorCount: 4, formation: "pincer" });
  const bounds = { left: 18, right: 888, top: 84, bottom: 638 };
  Renderer.prototype.drawWaveWarning.call({ time: 0, warningBounds: bounds }, ctx, s);
  assert.equal(labels.length,0,'chapter-one warning text lives in the command panel');
  // Each ingress arc contributes 25 absolute world points, followed by its
  // three local arrow vertices. Exclude those local arrow coordinates.
  const arcs = [...points.slice(0, 25), ...points.slice(28, 53)];
  assert.ok(arcs.every(([x, y]) => x >= bounds.left - 1e-6 && x <= bounds.right + 1e-6 && y >= bounds.top - 1e-6 && y <= bounds.bottom + 1e-6));
});
