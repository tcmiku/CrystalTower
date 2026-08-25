import test from "node:test";
import assert from "node:assert/strict";
import { applyElementalHit, calculateRunScore, calculateStardust, chooseEnemyType, collectCoinAt, createGameState, cycleTargetProtocol, damageEnemy, findTargets, getDayPhase, getTechStatus, getTowerStats, getUpgradeCost, lockAnchorAt, purchaseUpgrade, setTargetProtocol, spawnEnemy, toggleDroneMode, updateGame, useSkill } from "../src/engine.js";
import { GAME_CONFIG } from "../src/config.js";

test("基础塔属性符合策划", () => {
  const state = createGameState(1);
  const stats = getTowerStats(state);
  assert.equal(stats.damage, 12);
  assert.equal(stats.fireRate, 1.2);
  assert.equal(stats.range, 360);
  assert.equal(stats.maxHp, 600);
});

test("塔优先选择射程内离中心最近的目标", () => {
  const state = createGameState(2);
  const far = spawnEnemy(state, "wisp", { x: 780, y: 360 });
  const near = spawnEnemy(state, "wisp", { x: 560, y: 360 });
  spawnEnemy(state, "wisp", { x: 900, y: 360 });
  assert.deepEqual(findTargets(state, 2).map((enemy) => enemy.id), [near.id, far.id]);
});

test("四种目标协议会改变自动攻击的优先目标", () => {
  const state = createGameState(12);
  const brute = spawnEnemy(state, "brute", { x: 580, y: 360 });
  const runner = spawnEnemy(state, "runner", { x: 620, y: 360 });
  const hexer = spawnEnemy(state, "hexer", { x: 750, y: 360 });
  const elite = spawnEnemy(state, "sentinel", { x: 700, y: 270 }, { elite: true, affix: "shield" });
  assert.equal(findTargets(state, 1)[0].id, brute.id);

  assert.equal(setTargetProtocol(state, "hunter"), true);
  assert.equal(findTargets(state, 1)[0].id, elite.id);
  assert.equal(setTargetProtocol(state, "radar"), true);
  assert.equal(findTargets(state, 1)[0].id, hexer.id);
  assert.equal(setTargetProtocol(state, "breach"), true);
  assert.equal(findTargets(state, 1)[0].id, runner.id);
  assert.equal(setTargetProtocol(state, "invalid"), false);
  assert.equal(cycleTargetProtocol(state), true);
  assert.equal(state.tower.targetProtocol, "radar");
});

test("锚点不再强制抢占目标，点击后会锁定五秒", () => {
  const state = createGameState(13);
  spawnEnemy(state, "brute", { x: 540, y: 360 }, { elite: true, affix: "sprint" });
  const boss = spawnEnemy(state, "boss", { x: 720, y: 360 });
  setTargetProtocol(state, "hunter");
  assert.equal(findTargets(state, 1)[0].id, boss.id);
  const repair = state.enemies.find((enemy) => enemy.anchorRole === "repair");
  assert.equal(lockAnchorAt(state, repair.x, repair.y), true);
  assert.equal(findTargets(state, 1)[0].id, repair.id);
  state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999; state.tower.hp = 1_000_000;
  updateGame(state, 5.01);
  assert.equal(state.tower.anchorLockId, null);
  assert.equal(findTargets(state, 1)[0].id, boss.id);
});

test("金币不足时拒绝升级且不改变状态", () => {
  const state = createGameState(3);
  assert.equal(purchaseUpgrade(state, "damage"), false);
  assert.equal(state.tower.upgrades.damage, 0);
  assert.equal(state.coins, 0);
});

test("攻击与攻速价格、成长符合策划", () => {
  const state = createGameState(4);
  assert.equal(getUpgradeCost(state, "damage"), 20);
  state.coins = 100;
  assert.equal(purchaseUpgrade(state, "damage"), true);
  assert.equal(getUpgradeCost(state, "damage"), 31);
  assert.equal(getTowerStats(state).damage, 15);
  assert.equal(getUpgradeCost(state, "rate"), 25);
  assert.equal(purchaseUpgrade(state, "rate"), true);
  assert.equal(getUpgradeCost(state, "rate"), 41);
  assert.equal(Number(getTowerStats(state).fireRate.toFixed(2)), 1.38);
});

test("三次升阶改变全属性且万象晶塔要求三元素共鸣", () => {
  const state = createGameState(5);
  state.threat = 8;
  state.coins = 100_000;
  for (let index = 0; index < 5; index += 1) purchaseUpgrade(state, "damage");
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(state, "rate");
  const preAscendDamage = getTowerStats(state).damage;
  assert.equal(getUpgradeCost(state, "ascend"), 180);
  assert.equal(purchaseUpgrade(state, "ascend"), true);
  const tierTwo = getTowerStats(state);
  assert.equal(tierTwo.damage, preAscendDamage * 1.5);
  assert.equal(tierTwo.range, 400);
  assert.equal(tierTwo.maxHp, 800);
  assert.equal(tierTwo.pierce, 0);
  assert.equal(tierTwo.projectileCount, 1);
  assert.equal(getUpgradeCost(state, "ascend"), 900);
  assert.equal(purchaseUpgrade(state, "ascend"), true);
  const tierThree = getTowerStats(state);
  assert.equal(tierThree.damage, preAscendDamage * 2.25);
  assert.equal(tierThree.range, 440);
  assert.equal(tierThree.maxHp, 1000);
  assert.equal(tierThree.projectileCount, 2);
  assert.equal(getUpgradeCost(state, "ascend"), 2400);
  assert.equal(purchaseUpgrade(state, "ascend"), false);
  assert.match(getTechStatus(state, "ascend").reason, /霜棱炮口/);
  assert.equal(purchaseUpgrade(state, "frost"), true);
  assert.equal(purchaseUpgrade(state, "fire"), true);
  assert.equal(purchaseUpgrade(state, "lightning"), true);
  assert.equal(purchaseUpgrade(state, "ascend"), true);
  const ultimate = getTowerStats(state);
  assert.equal(ultimate.damage, preAscendDamage * 3.35);
  assert.equal(ultimate.range, 480);
  assert.equal(ultimate.maxHp, 1200);
  assert.equal(ultimate.projectileCount, 3);
  assert.equal(ultimate.name, "万象晶塔");
  assert.equal(getUpgradeCost(state, "ascend"), Infinity);
});

test("弹丸首次命中后立即消失且不会继续命中后方目标", () => {
  const state = createGameState(51);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  const first = spawnEnemy(state, "brute", { x: 600, y: 360 });
  const second = spawnEnemy(state, "brute", { x: 600, y: 360 });
  first.speed = 0;
  second.speed = 0;
  const firstHp = first.hp;
  const secondHp = second.hp;
  state.projectiles.push({ id: 9991, x: 600, y: 360, vx: 0, vy: 0, damage: 10, radius: 7, pierce: 99, life: 1, tier: 2 });

  updateGame(state);

  assert.equal(state.projectiles.length, 0);
  assert.equal(first.hp, firstHp - 10);
  assert.equal(second.hp, secondHp);
});

test("环绕晶刃最多五枚", () => {
  const state = createGameState(6);
  state.threat = 8;
  state.coins = 100_000;
  purchaseUpgrade(state, "damage");
  for (let level = 1; level <= 5; level += 1) {
    assert.equal(purchaseUpgrade(state, "saw"), true);
    assert.equal(state.tower.upgrades.saw, level);
  }
  assert.equal(purchaseUpgrade(state, "saw"), false);
  assert.equal(getUpgradeCost(state, "saw"), Infinity);
});

test("晶愈的过量治疗转为护盾且护盾优先吸收伤害", () => {
  const state = createGameState(7);
  state.tower.hp = 550;
  assert.equal(useSkill(state, "heal"), true);
  assert.equal(state.tower.hp, 600);
  assert.equal(state.tower.shield, 70);
  assert.equal(state.skills.heal.cooldown, 30);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  const attacker = spawnEnemy(state, "brute", { x: 520, y: 360 });
  attacker.speed = 0;
  updateGame(state, 0.1);
  assert.equal(state.tower.hp, 600);
  assert.ok(state.tower.shield < 70);
  assert.equal(useSkill(state, "heal"), false);
});

test("超载结束释放击退且过热会触发短暂降速", () => {
  const state = createGameState(8);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.hp = 1_000_000;
  const normal = spawnEnemy(state, "brute", { x: 600, y: 330 });
  const boss = spawnEnemy(state, "boss", { x: 600, y: 400 });
  normal.speed = 0;
  boss.speed = 0;
  const normalBefore = Math.hypot(normal.x - 480, normal.y - 360);
  const bossBefore = Math.hypot(boss.x - 480, boss.y - 360);
  assert.equal(useSkill(state, "overload"), true);
  assert.equal(state.skills.overload.active, 6);
  assert.equal(state.skills.overload.cooldown, 25);
  state.skills.overload.heat = 90;
  state.skills.overload.active = 0.01;
  updateGame(state, 0.02);
  assert.equal(state.skills.overload.active, 0);
  assert.equal(state.skills.overload.overheated, true);
  assert.ok(state.skills.overload.slow > 2.9);
  assert.ok(state.skills.overload.pulse > 0.5);
  const normalPush = Math.hypot(normal.x - 480, normal.y - 360) - normalBefore;
  const bossPush = Math.hypot(boss.x - 480, boss.y - 360) - bossBefore;
  assert.ok(normalPush > bossPush * 2);
  assert.ok(state.events.some((event) => event.type === "overloadRelease" && event.overheated));
});

test("再次使用超载会提前结束并立即击退且保留原冷却", () => {
  const state = createGameState(81);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  const enemy = spawnEnemy(state, "brute", { x: 600, y: 360 });
  enemy.speed = 0;
  const before = enemy.x;
  assert.equal(useSkill(state, "overload"), true);
  state.skills.overload.heat = 40;
  assert.equal(useSkill(state, "overload"), true);
  assert.equal(state.skills.overload.active, 0);
  assert.equal(state.skills.overload.cooldown, 25);
  assert.equal(state.skills.overload.overheated, false);
  assert.ok(enemy.x > before);
  assert.ok(state.events.some((event) => event.type === "overloadRelease" && event.early));
});

test("晶愈护盾达到上限后下一次受击只释放一次晶片爆炸", () => {
  const state = createGameState(82);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  state.tower.shield = 90;
  assert.equal(useSkill(state, "heal"), true);
  assert.equal(state.tower.shield, 210);
  assert.equal(state.skills.heal.shieldBurstArmed, true);
  const attacker = spawnEnemy(state, "brute", { x: 520, y: 360 });
  attacker.speed = 0;
  const before = attacker.hp;
  updateGame(state, 0.1);
  assert.equal(state.skills.heal.shieldBurstArmed, false);
  assert.equal(attacker.hp, before - 36);
  assert.ok(state.skills.heal.burst > 0);
  assert.equal(state.events.filter((event) => event.type === "shieldBurst").length, 1);
});

test("星落只集中轰击敌人最密集的方向", () => {
  const state = createGameState(9);
  state.threat = 4;
  const eastA = spawnEnemy(state, "brute", { x: 620, y: 350 });
  const eastB = spawnEnemy(state, "brute", { x: 650, y: 375 });
  const west = spawnEnemy(state, "brute", { x: 330, y: 360 });
  const before = new Map(state.enemies.map((enemy) => [enemy.id, enemy.hp]));
  assert.equal(useSkill(state, "starfall"), true);
  assert.equal(Number((before.get(eastA.id) - eastA.hp).toFixed(2)), 72);
  assert.equal(Number((before.get(eastB.id) - eastB.hp).toFixed(2)), 72);
  assert.equal(west.hp, before.get(west.id));
  assert.ok(Math.abs(state.skills.starfall.angle) < 0.2);
  assert.equal(state.skills.starfall.cooldown, 45);
});

test("星落在近卫协议瞄准塔前最近威胁，在雷达协议偏向远程单位", () => {
  const guardState = createGameState(83);
  const nearWest = spawnEnemy(guardState, "brute", { x: 400, y: 360 });
  const eastA = spawnEnemy(guardState, "brute", { x: 650, y: 340 });
  spawnEnemy(guardState, "brute", { x: 660, y: 370 });
  const eastHp = eastA.hp;
  assert.equal(useSkill(guardState, "starfall"), true);
  assert.ok(nearWest.hp < nearWest.maxHp);
  assert.equal(eastA.hp, eastHp);
  assert.equal(guardState.skills.starfall.protocol, "guard");

  const radarState = createGameState(84);
  setTargetProtocol(radarState, "radar");
  const ranged = spawnEnemy(radarState, "hexer", { x: 480, y: 150 });
  const melee = spawnEnemy(radarState, "brute", { x: 650, y: 350 });
  spawnEnemy(radarState, "brute", { x: 660, y: 375 });
  const meleeHp = melee.hp;
  assert.equal(useSkill(radarState, "starfall"), true);
  assert.ok(ranged.hp < ranged.maxHp);
  assert.equal(melee.hp, meleeHp);
  assert.equal(radarState.skills.starfall.protocol, "radar");
});

test("星尘结算至少一枚，并计入击杀和首领", () => {
  const state = createGameState(10);
  assert.equal(calculateStardust(state), 1);
  state.stats.kills = 74;
  state.stats.bossKills = 2;
  assert.equal(calculateStardust(state), 8);
});

test("普通怪、精英和首领使用统一街机积分规则", () => {
  const state = createGameState(101);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.hp = 1_000_000;
  const wisp = spawnEnemy(state, "wisp", { x: 700, y: 300 });
  const elite = spawnEnemy(state, "brute", { x: 720, y: 400 }, { elite: true, affix: "shield" });
  wisp.hp = 0;
  elite.hp = 0;
  updateGame(state, GAME_CONFIG.fixedStep);
  assert.equal(state.stats.score, 100 + 300 * 4);
  assert.deepEqual(state.events.filter((event) => event.type === "kill").map((event) => event.score), [100, 1200]);
});

test("最终积分加入剩余金币奖励且不改变战斗积分", () => {
  const state = createGameState(102);
  state.stats.score = 4321;
  state.coins = 27.9;
  assert.deepEqual(calculateRunScore(state), { combat: 4321, coinBonus: 270, total: 4591 });
  assert.equal(state.stats.score, 4321);
});

test("昼夜按四个威胁波次循环", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(getDayPhase), ["day", "day", "night", "night", "day", "day"]);
});

test("怪潮提前十秒预警并从标记方向集中生成", () => {
  const state = createGameState(31);
  state.tower.hp = 1_000_000;
  state.time = 79.95;
  updateGame(state, 0.1);
  assert.equal(state.wave.warningStarted, true);
  assert.ok(Number.isInteger(state.wave.direction));
  assert.ok(state.events.some((event) => event.type === "waveWarning"));
  state.time = 89.95;
  updateGame(state, 0.1);
  assert.equal(state.wave.index, 1);
  assert.equal(state.wave.nextAt, 180);
  assert.ok(state.events.some((event) => event.type === "waveStart"));
});

test("高威胁等级解锁爬行怪、晶甲守卫、咒晶怪与冲撞兽", () => {
  const state = createGameState(41);
  state.threat = 9;
  const types = new Set(Array.from({ length: 400 }, () => chooseEnemyType(state)));
  assert.ok(types.has("crawler"));
  assert.ok(types.has("sentinel"));
  assert.ok(types.has("hexer"));
  assert.ok(types.has("rammer"));
});

test("每次大怪潮固定生成一只高生命精英怪", () => {
  const state = createGameState(42);
  state.tower.hp = 1_000_000;
  state.tower.fireCooldown = 999;
  state.spawnTimer = 999;
  state.time = 89.95;
  for (let step = 0; step < 300 && (state.wave.index === 0 || state.wave.active); step += 1) updateGame(state, 0.1);
  const elites = state.enemies.filter((enemy) => enemy.elite);
  assert.equal(state.wave.index, 1);
  assert.equal(elites.length, 1);
  const base = GAME_CONFIG.enemies[elites[0].type];
  const threatScale = GAME_CONFIG.threat.hpGrowth ** (state.threat - 1);
  assert.equal(elites[0].maxHp, base.hp * threatScale * 3.2);
  assert.equal(elites[0].reward, Math.round(base.reward * (GAME_CONFIG.threat.rewardGrowth ** (state.threat - 1)) * 3));
  assert.ok(GAME_CONFIG.eliteAffixes.order.includes(elites[0].affix));
});

test("精英怪会确定性获得护盾、狂奔、吞金或分裂词缀", () => {
  const first = createGameState(44);
  const second = createGameState(44);
  const affixA = spawnEnemy(first, "brute", { x: 700, y: 300 }, { elite: true }).affix;
  const affixB = spawnEnemy(second, "brute", { x: 700, y: 300 }, { elite: true }).affix;
  assert.equal(affixA, affixB);
  assert.ok(["shield", "sprint", "devour", "split"].includes(affixA));

  const shielded = spawnEnemy(first, "brute", { x: 700, y: 350 }, { elite: true, affix: "shield" });
  const hp = shielded.hp;
  damageEnemy(first, shielded, 30);
  assert.equal(shielded.hp, hp);
  assert.ok(shielded.affixShield < shielded.affixShieldMax);

  const sprinter = spawnEnemy(first, "brute", { x: 700, y: 400 }, { elite: true, affix: "sprint" });
  assert.equal(sprinter.speed, GAME_CONFIG.enemies.brute.speed * 1.55);
});

test("吞金精英会吃掉附近金币回血，分裂精英死亡后生成两个子体", () => {
  const devourState = createGameState(45);
  devourState.spawnTimer = 999; devourState.wave.nextAt = 999; devourState.tower.fireCooldown = 999;
  const devourer = spawnEnemy(devourState, "brute", { x: 700, y: 300 }, { elite: true, affix: "devour" });
  devourer.hp *= 0.5;
  devourState.coinOrbs.push({ x: 705, y: 305, renderX: 705, renderY: 305, value: 20, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  const damagedHp = devourer.hp;
  updateGame(devourState, 0.6);
  assert.equal(devourState.coinOrbs.length, 0);
  assert.ok(devourer.hp > damagedHp);

  const splitState = createGameState(46);
  splitState.spawnTimer = 999; splitState.wave.nextAt = 999; splitState.tower.fireCooldown = 999;
  const splitter = spawnEnemy(splitState, "runner", { x: 700, y: 300 }, { elite: true, affix: "split" });
  damageEnemy(splitState, splitter, splitter.hp + 1);
  updateGame(splitState, 0.01);
  const children = splitState.enemies.filter((enemy) => enemy.splitChild);
  assert.equal(children.length, 2);
  assert.ok(children.every((enemy) => !enemy.elite && enemy.maxHp < GAME_CONFIG.enemies.runner.hp));
});

test("首领分阶段切换元素抗性并以四个锚点保护自身", () => {
  const state = createGameState(47);
  state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999; state.threat = 10;
  const boss = spawnEnemy(state, "boss", { x: 700, y: 360 });
  assert.equal(boss.resistance, "frost");
  assert.equal(state.enemies.filter((enemy) => enemy.type === "anchor").length, 4);
  assert.deepEqual(state.enemies.filter((enemy) => enemy.type === "anchor").map((enemy) => enemy.anchorRole), ["shield", "repair", "summon", "overload"]);
  for (const anchor of state.enemies.filter((enemy) => enemy.type === "anchor")) anchor.hp = 0;
  updateGame(state, 0.01);
  damageEnemy(state, boss, boss.maxHp * 0.31, "shot");
  assert.equal(boss.bossPhase, 1);
  assert.equal(boss.resistance, "fire");
  assert.equal(state.enemies.filter((enemy) => enemy.type === "anchor" && enemy.hp > 0).length, 4);
  const beforeFrost = boss.hp;
  damageEnemy(state, boss, 100, "frost");
  const frostDamage = beforeFrost - boss.hp;
  const beforeFire = boss.hp;
  damageEnemy(state, boss, 100, "fire");
  const fireDamage = beforeFire - boss.hp;
  assert.ok(frostDamage > fireDamage * 2);
  for (const anchor of state.enemies.filter((enemy) => enemy.type === "anchor")) anchor.hp = 0;
  updateGame(state, 0.01);
  damageEnemy(state, boss, boss.maxHp * 0.3, "shot");
  assert.equal(boss.bossPhase, 2);
  assert.equal(boss.resistance, "lightning");
  assert.equal(state.enemies.filter((enemy) => enemy.type === "anchor" && enemy.hp > 0).length, 4);
});

test("四种首领锚点分别提供减伤、修复、召唤和攻击过载", () => {
  const state = createGameState(91);
  state.threat = 10; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999; state.tower.hp = 1_000_000;
  const boss = spawnEnemy(state, "boss", { x: 520, y: 360 });
  boss.speed = 0;
  const shield = state.enemies.find((enemy) => enemy.anchorRole === "shield");
  const repair = state.enemies.find((enemy) => enemy.anchorRole === "repair");
  const summon = state.enemies.find((enemy) => enemy.anchorRole === "summon");
  const beforeShielded = boss.hp;
  damageEnemy(state, boss, 100, "shot");
  assert.equal(Number((beforeShielded - boss.hp).toFixed(2)), 45);

  shield.hp = 0;
  updateGame(state, 0.01);
  const beforeOpen = boss.hp;
  damageEnemy(state, boss, 100, "shot");
  assert.equal(Number((beforeOpen - boss.hp).toFixed(2)), 100);

  boss.hp = boss.maxHp * 0.5;
  const beforeRepair = boss.hp;
  summon.effectCooldown = 0;
  const beforeSummon = state.enemies.filter((enemy) => enemy.type === "wisp").length;
  updateGame(state, 1);
  assert.ok(boss.hp >= beforeRepair + boss.maxHp * 0.0119);
  assert.equal(state.enemies.filter((enemy) => enemy.type === "wisp").length, beforeSummon + 1);

  const measureBossDamage = (overloaded) => {
    const sample = createGameState(overloaded ? 92 : 93);
    sample.threat = 10; sample.spawnTimer = 999; sample.wave.nextAt = 999; sample.tower.fireCooldown = 999; sample.tower.hp = 1_000_000;
    const sampleBoss = spawnEnemy(sample, "boss", { x: 520, y: 360 });
    sampleBoss.speed = 0;
    for (const anchor of sample.enemies.filter((enemy) => enemy.type === "anchor")) if (anchor.anchorRole !== "overload" || !overloaded) anchor.hp = 0;
    updateGame(sample, 0.01);
    const before = sample.tower.hp;
    for (let index = 0; index < 180; index += 1) updateGame(sample, 1 / 60);
    return before - sample.tower.hp;
  };
  assert.ok(measureBossDamage(true) > measureBossDamage(false) * 1.5);
  assert.equal(repair.anchorRole, "repair");
});

test("咒晶怪会停在塔外进行远程攻击", () => {
  const state = createGameState(43);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  const enemy = spawnEnemy(state, "hexer", { x: 680, y: 360 });
  const startX = enemy.x;
  const hp = state.tower.hp;
  updateGame(state, 0.8);
  assert.equal(enemy.x, startX);
  assert.ok(state.tower.hp < hp);
  assert.ok(enemy.rangedFlash > 0);
});

test("科技树同时检查威胁等级和前置科技", () => {
  const state = createGameState(51);
  assert.equal(getTechStatus(state, "drone").unlocked, false);
  assert.match(getTechStatus(state, "drone").reason, /威胁 2/);
  state.threat = 2;
  assert.match(getTechStatus(state, "drone").reason, /淬亮晶矢/);
  state.coins = 1_000;
  purchaseUpgrade(state, "damage");
  assert.equal(getTechStatus(state, "drone").unlocked, true);
});

test("金币初始需要点击，点击后才飞向晶塔结算", () => {
  const state = createGameState(61);
  state.spawnTimer = 999;
  state.coinOrbs.push({ x: 200, y: 180, renderX: 200, renderY: 180, value: 9, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  for (let index = 0; index < 120; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.coins, 0);
  assert.equal(collectCoinAt(state, 200, 180), true);
  for (let index = 0; index < 30; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.coins, 9);
});

test("未收集金币十秒后消失且不会结算", () => {
  const state = createGameState(62);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.coinOrbs.push({ x: 220, y: 190, renderX: 220, renderY: 190, value: 13, age: 9.98, collectAge: 0, collector: null, droneIndex: 0 });
  updateGame(state, 0.01);
  assert.equal(state.coinOrbs.length, 1);
  updateGame(state, 0.02);
  assert.equal(state.coinOrbs.length, 0);
  assert.equal(state.coins, 0);
  assert.ok(state.events.some((event) => event.type === "coinExpire"));
});

test("十秒内开始回收的金币不会在飞行途中消失", () => {
  const state = createGameState(63);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.coinOrbs.push({ x: 220, y: 190, renderX: 220, renderY: 190, value: 13, age: 9.98, collectAge: 0, collector: null, droneIndex: 0 });
  assert.equal(collectCoinAt(state, 220, 190), true);
  for (let index = 0; index < 30; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.coinOrbs.length, 0);
  assert.equal(state.coins, 13);
});

test("金潮归塔立即吸收全场金币并应用永久金币倍率", () => {
  const state = createGameState(64, { damage: 0, health: 0, income: 2 });
  state.coinOrbs.push(
    { x: 220, y: 190, renderX: 220, renderY: 186, value: 5, age: 2, collectAge: 0, collector: null, droneIndex: 0 },
    { x: 700, y: 510, renderX: 650, renderY: 480, value: 7, age: 8, collectAge: 0.2, collector: "drone", droneIndex: 0 }
  );
  assert.equal(useSkill(state, "coinVacuum"), true);
  assert.equal(state.coins, 14);
  assert.equal(state.coinOrbs.length, 0);
  assert.equal(state.skills.coinVacuum.cooldown, 45);
  assert.equal(state.skills.coinVacuum.trails.length, 2);
  assert.ok(state.events.some((event) => event.type === "coinVacuum" && event.count === 2 && event.value === 14));
  assert.equal(useSkill(state, "coinVacuum"), false);
});

test("无人机满级后才能解锁晶塔自动收集", () => {
  const state = createGameState(71);
  state.threat = 6;
  state.coins = 10_000;
  purchaseUpgrade(state, "damage");
  assert.equal(purchaseUpgrade(state, "autoCollect"), false);
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  assert.equal(getTechStatus(state, "autoCollect").unlocked, true);
  assert.equal(purchaseUpgrade(state, "autoCollect"), true);
  state.spawnTimer = 999;
  state.tower.droneCooldown = 999;
  state.coinOrbs.push({ x: 120, y: 120, renderX: 120, renderY: 120, value: 11, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  state.coinOrbs.push({ x: 160, y: 120, renderX: 160, renderY: 120, value: 13, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  const before = state.coins;
  for (let index = 0; index < 294; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.coins, before);
  assert.equal(state.coinOrbs[0].collector, null);
  for (let index = 0; index < 36; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.coins, before + 11);
  assert.equal(state.coinOrbs.length, 1);
  assert.equal(state.coinOrbs[0].collector, null);
});

test("研究磁吸核心后护航模式仍允许手动点击金币", () => {
  const state = createGameState(711);
  state.threat = 6; state.coins = 10_000; state.spawnTimer = 999; state.wave.nextAt = 999;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "autoCollect");
  state.tower.droneCooldown = 999;
  state.coinOrbs.push({ x: 240, y: 200, renderX: 240, renderY: 200, value: 12, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  const before = state.coins;
  assert.equal(state.tower.droneMode, "collect");
  assert.equal(collectCoinAt(state, 240, 200), true);
  for (let index = 0; index < 30; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.coins, before + 12);
});

test("磁吸核心完成后才能切换无人机攻击模式", () => {
  const state = createGameState(72);
  assert.equal(toggleDroneMode(state), false);
  state.threat = 6;
  state.coins = 10_000;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  assert.equal(toggleDroneMode(state), false);
  purchaseUpgrade(state, "autoCollect");
  assert.equal(toggleDroneMode(state), true);
  assert.equal(state.tower.droneMode, "attack");
  assert.equal(toggleDroneMode(state), true);
  assert.equal(state.tower.droneMode, "collect");
});

test("攻击模式无人机脱离轨道并近身伤害敌人", () => {
  const state = createGameState(73);
  state.time = 225.2;
  state.threat = 6;
  state.wave.nextAt = 999;
  state.spawnTimer = 999;
  state.tower.fireCooldown = 999;
  state.coins = 10_000;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect");
  toggleDroneMode(state);
  const enemy = spawnEnemy(state, "brute", { x: 650, y: 360 });
  const beforeHp = enemy.hp;
  for (let index = 0; index < 120; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.drones.length, 3);
  assert.ok(enemy.hp < beforeHp);
  assert.ok(state.drones.some((drone) => drone.targetId === enemy.id));
});

test("攻击模式暂停自动回收但保留手动拾币，耗尽后返回护航充能", () => {
  const state = createGameState(74);
  state.threat = 6; state.coins = 10_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "autoCollect");
  state.tower.droneEnergy = 20;
  assert.equal(toggleDroneMode(state), true);
  state.coinOrbs.push({ x: 300, y: 300, renderX: 300, renderY: 300, value: 10, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  const coins = state.coins;
  updateGame(state, 1);
  assert.equal(state.tower.droneMode, "attack");
  assert.equal(state.tower.droneEnergy, 15);
  assert.equal(state.coinOrbs[0].collector, null);
  assert.equal(state.coins, coins);
  assert.equal(collectCoinAt(state, 300, 300), true);
  updateGame(state, 0.5);
  assert.equal(state.coins, coins + 10);
  state.coinOrbs.push({ x: 310, y: 300, renderX: 310, renderY: 300, value: 10, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  state.tower.droneEnergy = 1;
  updateGame(state, 0.3);
  assert.equal(state.tower.droneMode, "collect");
  assert.ok(state.events.some((event) => event.type === "droneDepleted"));
  updateGame(state, 0.5);
  assert.ok(state.coins > coins + 10);
  assert.ok(state.tower.droneEnergy >= GAME_CONFIG.drones.coinEnergy);
  state.tower.droneEnergy = GAME_CONFIG.drones.minAttackEnergy - 1;
  assert.equal(toggleDroneMode(state), false);
});

test("拾荒协议加快拾币并提高无人机带回的金币价值", () => {
  const state = createGameState(75);
  state.threat = 6; state.coins = 10_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "droneScavenge");
  state.tower.droneEnergy = 40;
  state.coinOrbs.push({ x: 620, y: 360, renderX: 620, renderY: 360, value: 10, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  const coins = state.coins;
  updateGame(state, 0.01);
  assert.ok(state.tower.droneCooldown < GAME_CONFIG.coins.droneInterval / 2);
  updateGame(state, 0.5);
  assert.equal(state.coins, coins + 13);
  assert.ok(state.tower.droneEnergy >= 58);
});

test("拦截协议在护航模式抵挡一次重击", () => {
  const state = createGameState(76);
  state.threat = 6; state.coins = 10_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "droneIntercept");
  const rammer = spawnEnemy(state, "rammer", { x: 520, y: 360 });
  rammer.speed = 0;
  const hp = state.tower.hp;
  updateGame(state, 0.71);
  assert.equal(state.tower.hp, hp);
  assert.equal(state.tower.interceptCharge, 0);
  assert.ok(state.events.some((event) => event.type === "droneIntercept"));
  updateGame(state, 0.71);
  assert.ok(state.tower.hp < hp);
});

test("猎杀协议标记精英并使所有炮弹增伤", () => {
  const state = createGameState(77);
  state.threat = 7; state.coins = 100_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "autoCollect"); purchaseUpgrade(state, "droneHunt");
  toggleDroneMode(state);
  const elite = spawnEnemy(state, "sentinel", { x: 628, y: 360 }, { elite: true, affix: "sprint" });
  elite.hp = elite.maxHp = 10_000; elite.speed = 0;
  updateGame(state, 0.02);
  assert.ok(elite.markTimer > 0);
  toggleDroneMode(state);
  const hp = elite.hp;
  state.projectiles.push({ id: state.nextId++, x: elite.x, y: elite.y, vx: 0, vy: 0, damage: 100, radius: 5, pierce: 0, life: 1, tier: 0 });
  updateGame(state, 0.01);
  assert.equal(hp - elite.hp, 135);
});

test("晶刃炮膛解锁后由每枚晶刃发射弹丸", () => {
  const state = createGameState(81);
  state.threat = 9;
  state.coins = 100_000;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "saw"); purchaseUpgrade(state, "saw"); purchaseUpgrade(state, "saw");
  assert.equal(purchaseUpgrade(state, "sawOverdrive"), true);
  assert.equal(purchaseUpgrade(state, "sawGun"), true);
  spawnEnemy(state, "brute", { x: 650, y: 360 });
  updateGame(state, 1 / 60);
  const sawShots = state.projectiles.filter((projectile) => projectile.source === "sawGun");
  assert.equal(sawShots.length, 3);
  assert.equal(Math.round(Math.hypot(sawShots[0].vx, sawShots[0].vy)), 430);
  assert.equal(sawShots[0].radius, 7);
});

test("晶刃疾旋与弹射专精互斥且疾旋分支保留炮膛", () => {
  const orbit = createGameState(811);
  orbit.threat = 10; orbit.coins = 100_000;
  purchaseUpgrade(orbit, "damage");
  purchaseUpgrade(orbit, "saw"); purchaseUpgrade(orbit, "saw"); purchaseUpgrade(orbit, "saw");
  assert.equal(purchaseUpgrade(orbit, "sawOverdrive"), true);
  assert.equal(purchaseUpgrade(orbit, "sawGun"), true);
  assert.equal(purchaseUpgrade(orbit, "sawLaunch"), false);
  assert.match(getTechStatus(orbit, "sawLaunch").reason, /已选择/);

  const launch = createGameState(812);
  launch.threat = 10; launch.coins = 100_000;
  purchaseUpgrade(launch, "damage");
  purchaseUpgrade(launch, "saw"); purchaseUpgrade(launch, "saw"); purchaseUpgrade(launch, "saw");
  assert.equal(purchaseUpgrade(launch, "sawLaunch"), true);
  assert.equal(purchaseUpgrade(launch, "sawOverdrive"), false);
  assert.equal(purchaseUpgrade(launch, "sawGun"), false);
});

test("疾旋锻刃提高环绕速度和伤害", () => {
  const base = createGameState(813);
  const boosted = createGameState(813);
  for (const sample of [base, boosted]) {
    sample.threat = 10; sample.coins = 100_000; sample.spawnTimer = 999; sample.wave.nextAt = 999; sample.tower.fireCooldown = 999;
    purchaseUpgrade(sample, "damage");
    purchaseUpgrade(sample, "saw"); purchaseUpgrade(sample, "saw"); purchaseUpgrade(sample, "saw");
  }
  purchaseUpgrade(boosted, "sawOverdrive"); purchaseUpgrade(boosted, "sawOverdrive"); purchaseUpgrade(boosted, "sawOverdrive");
  const baseEnemy = spawnEnemy(base, "boss", { x: 584, y: 360 });
  const boostedEnemy = spawnEnemy(boosted, "boss", { x: 584, y: 360 });
  for (const enemy of [...base.enemies, ...boosted.enemies]) if (enemy.type !== "anchor") enemy.speed = 0;
  updateGame(base, 0.01); updateGame(boosted, 0.01);
  assert.ok(boosted.tower.sawAngle > base.tower.sawAngle * 1.8);
  assert.ok(boostedEnemy.maxHp - boostedEnemy.hp > (baseEnemy.maxHp - baseEnemy.hp) * 1.6);
});

test("弹射飞刃连续命中其他目标并按科技缩短恢复", () => {
  const state = createGameState(814);
  state.threat = 10; state.coins = 100_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "saw"); purchaseUpgrade(state, "saw"); purchaseUpgrade(state, "saw");
  purchaseUpgrade(state, "sawLaunch");
  purchaseUpgrade(state, "sawRicochet"); purchaseUpgrade(state, "sawRicochet");
  purchaseUpgrade(state, "sawRecovery"); purchaseUpgrade(state, "sawRecovery");
  const first = spawnEnemy(state, "brute", { x: 650, y: 360 });
  const second = spawnEnemy(state, "brute", { x: 650, y: 450 });
  first.speed = 0; second.speed = 0;
  const firstHp = first.hp; const secondHp = second.hp;
  updateGame(state, 1 / 60);
  assert.equal(state.launchedSaws.length, 1);
  assert.equal(state.launchedSaws[0].bouncesRemaining, GAME_CONFIG.upgrades.sawLaunch.baseBounces + 2);
  state.tower.sawLaunchCooldown = 999;
  for (let index = 0; index < 120; index += 1) updateGame(state, 1 / 60);
  assert.ok(first.hp < firstHp);
  assert.ok(second.hp < secondHp);
  assert.ok(state.tower.sawRecoveries[0] > 0);
  assert.ok(state.tower.sawRecoveries[0] < GAME_CONFIG.upgrades.sawLaunch.baseRecovery * 0.7);
});

test("弹射飞刃分支禁用晶刃炮膛弹幕", () => {
  const state = createGameState(815);
  state.threat = 10; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  state.tower.upgrades.saw = 3;
  state.tower.upgrades.sawGun = 3;
  state.tower.upgrades.sawLaunch = 1;
  spawnEnemy(state, "brute", { x: 650, y: 360 }).speed = 0;
  updateGame(state, 1 / 60);
  assert.equal(state.projectiles.filter((projectile) => projectile.source === "sawGun").length, 0);
  assert.equal(state.launchedSaws.length, 1);
});

test("威胁等级持续提高怪物生命", () => {
  const low = createGameState(91);
  const high = createGameState(92);
  high.threat = 8;
  assert.ok(spawnEnemy(high, "wisp").maxHp > spawnEnemy(low, "wisp").maxHp * 2);
});

test("元素科技同时检查威胁、金币与晶塔等级", () => {
  const state = createGameState(101);
  state.tower.upgrades.damage = 4;
  assert.match(getTechStatus(state, "frost").reason, /威胁 4/);
  state.threat = 8;
  assert.match(getTechStatus(state, "frost").reason, /晶塔等级 2/);
  state.tower.upgrades.ascend = 1;
  assert.equal(getTechStatus(state, "frost").unlocked, true);
  assert.equal(purchaseUpgrade(state, "frost"), false);
  state.coins = 260;
  assert.equal(purchaseUpgrade(state, "frost"), true);
  assert.equal(state.coins, 0);
  assert.match(getTechStatus(state, "lightning").reason, /晶塔等级 3/);
});

test("冰霜弹能冻结普通敌人且对首领持续时间衰减", () => {
  const state = createGameState(102);
  const normal = spawnEnemy(state, "brute", { x: 700, y: 330 });
  const boss = spawnEnemy(state, "boss", { x: 700, y: 430 });
  applyElementalHit(state, normal, "frost", 20);
  applyElementalHit(state, boss, "frost", 20);
  assert.equal(normal.freezeTimer, 1.2);
  assert.equal(boss.freezeTimer, 0.3);
});

test("火焰弹附加持续灼烧且首领承受的灼烧更弱", () => {
  const state = createGameState(103);
  const normal = spawnEnemy(state, "brute", { x: 700, y: 330 });
  const boss = spawnEnemy(state, "boss", { x: 700, y: 430 });
  applyElementalHit(state, normal, "fire", 100);
  applyElementalHit(state, boss, "fire", 100);
  assert.ok(normal.burnDamagePerTick > boss.burnDamagePerTick);
  assert.ok(normal.burnTimer > boss.burnTimer);
});

test("雷电弹按距离连锁三名敌人并削弱对首领的连锁伤害", () => {
  const state = createGameState(104);
  const primary = spawnEnemy(state, "brute", { x: 500, y: 300 });
  const first = spawnEnemy(state, "brute", { x: 530, y: 300 });
  const boss = spawnEnemy(state, "boss", { x: 560, y: 300 });
  const third = spawnEnemy(state, "brute", { x: 590, y: 300 });
  const far = spawnEnemy(state, "brute", { x: 800, y: 300 });
  const before = new Map(state.enemies.map((enemy) => [enemy.id, enemy.hp]));
  applyElementalHit(state, primary, "lightning", 100);
  assert.equal(Number((before.get(first.id) - first.hp).toFixed(1)), 62);
  assert.ok(before.get(boss.id) - boss.hp < before.get(first.id) - first.hp);
  assert.ok(third.hp < before.get(third.id));
  assert.equal(far.hp, before.get(far.id));
  assert.equal(state.elementFx.length, 3);

  const bossSourceState = createGameState(106);
  const bossSource = spawnEnemy(bossSourceState, "boss", { x: 500, y: 300 });
  const chained = spawnEnemy(bossSourceState, "brute", { x: 530, y: 300 });
  const chainedBefore = chained.hp;
  applyElementalHit(bossSourceState, bossSource, "lightning", 100);
  assert.ok(chainedBefore - chained.hp < 62);
});

test("解锁元素科技后晶塔会实际发射元素晶矢", () => {
  const state = createGameState(105);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.upgrades.frost = 1;
  state.tower.upgrades.fire = 1;
  state.tower.upgrades.lightning = 1;
  const target = spawnEnemy(state, "boss", { x: 720, y: 360 });
  target.hp = target.maxHp = 1_000_000;
  const seen = new Set();
  for (let frame = 0; frame < 900; frame += 1) {
    updateGame(state, 1 / 60);
    for (const projectile of state.projectiles) if (projectile.element) seen.add(projectile.element);
  }
  assert.ok(seen.size >= 2);
});
