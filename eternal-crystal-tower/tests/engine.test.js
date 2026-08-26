import test from "node:test";
import assert from "node:assert/strict";
import { applyElementalHit, calculateRunScore, calculateStardust, chooseEnemyType, chooseRelic, collectCoinAt, collectPermanentResourceAt, createGameState, cycleTargetProtocol, damageEnemy, findTargets, getDayPhase, getDroneDetonateRecovery, getDroneEnergyMax, getDroneGuardCooldown, getDroneGuardShieldMax, getTechStatus, getTowerPosition, getTowerRadius, getTowerStats, getUpgradeCost, lockAnchorAt, offerRelicChoice, purchaseUpgrade, setTargetProtocol, spawnEnemy, spawnPermanentResourceDrop, toggleDroneDetonate, toggleDroneMode, updateGame, useSkill } from "../src/engine.js";
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

test("无目标期间不会积累负开火冷却造成连发", () => {
  const state = createGameState(201);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 0;
  updateGame(state, 30);
  assert.equal(state.tower.fireCooldown, 0);

  spawnEnemy(state, "boss", { x: 650, y: 360 }).speed = 0;
  updateGame(state, 1 / 60);
  assert.equal(state.events.filter((event) => event.type === "shoot").length, 1);
  for (let index = 0; index < 30; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.events.filter((event) => event.type === "shoot").length, 0);

  const sawState = createGameState(202);
  sawState.spawnTimer = 999;
  sawState.wave.nextAt = 999;
  sawState.tower.fireCooldown = 999;
  sawState.tower.upgrades.saw = 3;
  sawState.tower.upgrades.sawGun = 1;
  updateGame(sawState, 30);
  assert.equal(sawState.tower.sawFireCooldown, 0);
  spawnEnemy(sawState, "boss", { x: 650, y: 360 }).speed = 0;
  updateGame(sawState, 1 / 60);
  assert.equal(sawState.events.filter((event) => event.type === "sawShoot").length, 1);
  for (let index = 0; index < 30; index += 1) updateGame(sawState, 1 / 60);
  assert.equal(sawState.events.filter((event) => event.type === "sawShoot").length, 0);
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

test("晶塔火力炮膛分支互斥并提供首领/怪潮两套专精", () => {
  const siege = createGameState(501);
  siege.threat = 12; siege.coins = 100_000;
  for (let index = 0; index < 3; index += 1) assert.equal(purchaseUpgrade(siege, "damage"), true);
  assert.equal(purchaseUpgrade(siege, "cannonSiege"), true);
  assert.equal(purchaseUpgrade(siege, "cannonSplit"), false);
  assert.equal(purchaseUpgrade(siege, "cannonCharge"), true);
  assert.equal(purchaseUpgrade(siege, "cannonPierce"), true);
  assert.equal(getTowerStats(siege).pierce, 1);
  assert.equal(getTechStatus(siege, "cannonSplit").reason, "已选择破城炮膛分支");

  const split = createGameState(502);
  split.threat = 12; split.coins = 100_000;
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(split, "damage");
  assert.equal(purchaseUpgrade(split, "cannonSplit"), true);
  assert.equal(purchaseUpgrade(split, "cannonSiege"), false);
  assert.equal(purchaseUpgrade(split, "cannonGrowth"), true);
  assert.equal(purchaseUpgrade(split, "cannonEcho"), true);
});

test("破城炮膛蓄能与穿透会强化连续单体攻击", () => {
  const state = createGameState(503);
  state.threat = 12; state.coins = 100_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.hp = 1_000_000;
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "cannonSiege"); purchaseUpgrade(state, "cannonCharge"); purchaseUpgrade(state, "cannonPierce");
  const first = spawnEnemy(state, "brute", { x: 600, y: 360 });
  const second = spawnEnemy(state, "brute", { x: 650, y: 360 });
  first.speed = 0; second.speed = 0;
  updateGame(state, 1 / 60);
  for (let index = 0; index < 24; index += 1) updateGame(state, 1 / 60);
  const firstDamage = first.maxHp - first.hp;
  const secondDamage = second.maxHp - second.hp;
  assert.ok(firstDamage > 0 && secondDamage > 0, "贯星穿透应命中同一直线的第二目标");
  state.tower.fireCooldown = 0;
  for (let index = 0; index < 24; index += 1) updateGame(state, 1 / 60);
  assert.ok(first.maxHp - first.hp > firstDamage, "蓄能晶矢应持续强化同一目标的后续攻击");
  assert.ok(state.tower.siegeStreak > 0);
});

test("裂晶炮膛会分裂晶矢并在击杀时触发晶爆", () => {
  const state = createGameState(504);
  state.threat = 12; state.coins = 100_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.hp = 1_000_000;
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "cannonSplit"); purchaseUpgrade(state, "cannonGrowth"); purchaseUpgrade(state, "cannonEcho");
  const target = spawnEnemy(state, "brute", { x: 600, y: 360 });
  const nearby = spawnEnemy(state, "wisp", { x: 650, y: 360 });
  target.speed = 0; nearby.speed = 0;
  let splitSeen = false;
  for (let index = 0; index < 24; index += 1) {
    updateGame(state, 1 / 60);
    splitSeen ||= state.events.some((event) => event.type === "cannonSplit");
  }
  assert.equal(splitSeen, true);
  target.hp = 0; target.lastDamageSource = "shot";
  const nearbyHp = nearby.hp;
  updateGame(state, 1 / 60);
  assert.ok(nearby.hp < nearbyHp, "击杀应触发晶爆伤害邻近目标");
  assert.ok(state.events.some((event) => event.type === "cannonEcho"));
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

test("星落只轰击玩家手动指定的方向", () => {
  const state = createGameState(9);
  state.threat = 4;
  const eastA = spawnEnemy(state, "brute", { x: 620, y: 350 });
  const eastB = spawnEnemy(state, "brute", { x: 650, y: 375 });
  const west = spawnEnemy(state, "brute", { x: 330, y: 360 });
  const before = new Map(state.enemies.map((enemy) => [enemy.id, enemy.hp]));
  assert.equal(useSkill(state, "starfall"), false);
  assert.equal(state.skills.starfall.cooldown, 0);
  assert.equal(useSkill(state, "starfall", { angle: 0 }), true);
  assert.equal(Number((before.get(eastA.id) - eastA.hp).toFixed(2)), 72);
  assert.equal(Number((before.get(eastB.id) - eastB.hp).toFixed(2)), 72);
  assert.equal(west.hp, before.get(west.id));
  assert.ok(Math.abs(state.skills.starfall.angle) < 0.2);
  assert.equal(state.skills.starfall.cooldown, 45);
});

test("星落手动方向不再受目标协议改写", () => {
  const state = createGameState(84);
  setTargetProtocol(state, "radar");
  const ranged = spawnEnemy(state, "hexer", { x: 480, y: 150 });
  const melee = spawnEnemy(state, "brute", { x: 650, y: 350 });
  const rangedHp = ranged.hp;
  assert.equal(useSkill(state, "starfall", { angle: 0 }), true);
  assert.equal(ranged.hp, rangedHp);
  assert.ok(melee.hp < melee.maxHp);
  assert.equal(state.skills.starfall.protocol, "manual");
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

test("威胁六开始加入异星敌群，威胁五及以前不会出现", () => {
  const early = createGameState(411);
  early.threat = 5;
  const earlyTypes = new Set(Array.from({ length: 1200 }, () => chooseEnemyType(early)));
  for (const type of ["inkHound", "orbitMote", "rustBeetle", "porcelainWarden"]) assert.equal(earlyTypes.has(type), false);

  const late = createGameState(412);
  late.threat = 6;
  const lateTypes = new Set(Array.from({ length: 2400 }, () => chooseEnemyType(late)));
  for (const type of ["inkHound", "orbitMote", "rustBeetle", "porcelainWarden"]) assert.equal(lateTypes.has(type), true);
  for (const type of ["inkHound", "orbitMote", "rustBeetle", "porcelainWarden"]) {
    const sample = createGameState(500 + type.length);
    sample.threat = 6;
    const enemy = spawnEnemy(sample, type, { x: 700, y: 360 });
    assert.equal(enemy.maxHp, GAME_CONFIG.enemies[type].hp * GAME_CONFIG.threat.hpGrowth ** 5);
  }
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

test("威胁十首领击败事件携带二倍速解锁门槛", () => {
  const state = createGameState(94);
  state.time = GAME_CONFIG.threat.duration * (GAME_CONFIG.unlocks.doubleSpeedThreat - 1);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  const boss = spawnEnemy(state, "boss", { x: 700, y: 360 });
  for (const anchor of state.enemies.filter((enemy) => enemy.type === "anchor")) anchor.hp = 0;
  updateGame(state, 0.01);
  boss.spawnShield = 0;
  boss.hp = 1;
  damageEnemy(state, boss, 10);
  updateGame(state, 0.01);
  assert.deepEqual(state.events.find((event) => event.type === "bossDefeated"), {
    type: "bossDefeated",
    threat: GAME_CONFIG.unlocks.doubleSpeedThreat,
    x: boss.x,
    y: boss.y
  });
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

test("移动端可以使用扩大的触控半径拾取金币", () => {
  const preciseState = createGameState(611);
  preciseState.coinOrbs.push({ x: 200, y: 180, renderX: 200, renderY: 180, value: 9, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  assert.equal(collectCoinAt(preciseState, 238, 180), false);

  const touchState = createGameState(611);
  touchState.coinOrbs.push({ x: 200, y: 180, renderX: 200, renderY: 180, value: 9, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  assert.equal(collectCoinAt(touchState, 238, 180, GAME_CONFIG.coins.clickRadius * 1.8), true);
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

test("无人机满级后才能解锁晶塔磁吸并每五秒吸收永久资源", () => {
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
  spawnPermanentResourceDrop(state, "echo", 2, 120, 120, { source: "elite" });
  spawnPermanentResourceDrop(state, "core", 1, 160, 120, { source: "boss" });
  const before = { echo: state.stats.echoShards, core: state.stats.coreFragments };
  for (let index = 0; index < 294; index += 1) updateGame(state, 1 / 60);
  assert.deepEqual([state.stats.echoShards, state.stats.coreFragments], [before.echo, before.core]);
  assert.equal(state.resourceDrops.length, 2);
  let pulseCount = 0;
  for (let index = 0; index < 36; index += 1) {
    updateGame(state, 1 / 60);
    pulseCount += state.events.filter((event) => event.type === "towerCollectPulse" && event.count === 2).length;
  }
  assert.deepEqual([state.stats.echoShards, state.stats.coreFragments], [before.echo + 2, before.core + 1]);
  assert.equal(state.resourceDrops.length, 0);
  assert.equal(pulseCount, 1);
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
  spawnPermanentResourceDrop(state, "echo", 2, 300, 300, { source: "elite" });
  state.coinOrbs.push({ x: 300, y: 300, renderX: 300, renderY: 300, value: 10, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  const coins = state.coins;
  updateGame(state, 1);
  assert.equal(state.tower.droneMode, "attack");
  assert.equal(state.tower.droneEnergy, 15);
  assert.equal(state.resourceDrops.length, 1);
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

test("协议电池扩容提高无人机电量且自爆与防御路线互斥", () => {
  const state = createGameState(741);
  state.time = 315; state.threat = 8; state.coins = 100_000; state.spawnTimer = 999; state.wave.nextAt = 999;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect");
  assert.equal(getDroneEnergyMax(state), GAME_CONFIG.drones.energyMax);
  assert.equal(purchaseUpgrade(state, "droneBattery"), true);
  assert.equal(getDroneEnergyMax(state), GAME_CONFIG.drones.energyMax + GAME_CONFIG.drones.batteryCapacityPerLevel);
  assert.equal(state.tower.droneEnergy, getDroneEnergyMax(state));
  assert.equal(purchaseUpgrade(state, "droneDetonate"), true);
  assert.equal(getTechStatus(state, "droneGuard").unlocked, false);
  assert.match(getTechStatus(state, "droneGuard").reason, /自爆协议/);
  assert.equal(getDroneDetonateRecovery(state), GAME_CONFIG.drones.detonate.recoveryDuration);
});

test("自爆协议优先锁定精英并在接近后造成范围伤害，随后进入十秒恢复", () => {
  const state = createGameState(742);
  state.time = 315; state.threat = 8; state.coins = 100_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect"); purchaseUpgrade(state, "droneBattery"); purchaseUpgrade(state, "droneDetonate");
  const ordinary = spawnEnemy(state, "brute", { x: 430, y: 360 });
  const elite = spawnEnemy(state, "sentinel", { x: 700, y: 360 }, { elite: true, affix: "sprint" });
  elite.hp = elite.maxHp = 10_000; elite.speed = 0;
  assert.equal(toggleDroneDetonate(state), true);
  updateGame(state, 1 / 60);
  state.drones[0].x = elite.x + 40;
  state.drones[0].y = elite.y;
  const eliteHp = elite.hp;
  const ordinaryHp = ordinary.hp;
  updateGame(state, 1 / 60);
  const detonation = state.events.find((event) => event.type === "droneDetonate");
  assert.equal(detonation.targetId, elite.id);
  assert.ok(elite.hp < eliteHp);
  assert.equal(ordinary.hp, ordinaryHp);
  assert.equal(state.drones[0].recoveryTimer, getDroneDetonateRecovery(state));
  assert.equal(state.tower.droneEnergy, getDroneEnergyMax(state) - GAME_CONFIG.drones.detonate.energyCost);
});

test("防御协议消耗电力生成无人机护盾，耗尽后冷却并自动恢复", () => {
  const state = createGameState(743);
  state.time = 315; state.threat = 8; state.coins = 100_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999; state.tower.hp = 1_000_000;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect"); purchaseUpgrade(state, "droneBattery"); purchaseUpgrade(state, "droneGuard");
  updateGame(state, 3);
  assert.ok(state.tower.droneGuardShield > 0);
  assert.ok(state.tower.droneGuardShield <= getDroneGuardShieldMax(state));
  const shieldBeforeHit = state.tower.droneGuardShield;
  const rammer = spawnEnemy(state, "rammer", { x: 520, y: 360 });
  rammer.speed = 0;
  const hp = state.tower.hp;
  updateGame(state, 0.71);
  assert.equal(state.tower.hp, hp);
  assert.ok(state.tower.droneGuardShield < shieldBeforeHit + GAME_CONFIG.drones.guard.drainPerSecond * 0.71 * GAME_CONFIG.drones.guard.shieldPerEnergy);
  assert.ok(state.events.some((event) => event.type === "towerHit" && event.droneShieldAbsorbed > 0));
  state.tower.droneEnergy = 0.5;
  updateGame(state, 0.1);
  assert.equal(state.tower.droneEnergy, 0);
  assert.equal(state.tower.droneGuardCooldown, getDroneGuardCooldown(state));
  assert.ok(state.events.some((event) => event.type === "droneGuardDepleted"));
  state.tower.droneMode = "attack";
  const cooldownBefore = state.tower.droneGuardCooldown;
  updateGame(state, 1);
  assert.ok(state.tower.droneGuardCooldown < cooldownBefore);
  updateGame(state, cooldownBefore);
  assert.equal(state.tower.droneGuardCooldown, 0);
  assert.equal(state.tower.droneEnergy, getDroneEnergyMax(state));
  assert.ok(state.events.some((event) => event.type === "droneGuardReady"));
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

test("普通怪超过二百四十个后压缩且完整保留战斗与结算总量", () => {
  const state = createGameState(116);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  state.tower.hp = 1_000_000;
  for (let index = 0; index < 1000; index += 1) spawnEnemy(state, "wisp", { x: 700, y: 300 });

  assert.equal(state.enemies.length, GAME_CONFIG.combat.normalEnemyBudget);
  assert.equal(state.enemies.reduce((sum, enemy) => sum + enemy.unitCount, 0), 1000);
  assert.equal(state.enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0), GAME_CONFIG.enemies.wisp.hp * 1000);
  assert.equal(state.enemies.reduce((sum, enemy) => sum + enemy.damage, 0), GAME_CONFIG.enemies.wisp.damage * 1000);
  assert.equal(state.enemies.reduce((sum, enemy) => sum + enemy.reward, 0), GAME_CONFIG.enemies.wisp.reward * 1000);
  assert.ok(state.enemies.some((enemy) => enemy.radius > GAME_CONFIG.enemies.wisp.radius));

  for (const enemy of state.enemies) enemy.hp = 0;
  updateGame(state, GAME_CONFIG.fixedStep);
  assert.equal(state.stats.kills, 1000);
  assert.equal(state.stats.score, GAME_CONFIG.score.enemy.wisp * 1000);
  assert.equal(state.coinOrbs.length, GAME_CONFIG.coins.maxOrbs);
  assert.equal(state.coinOrbs.reduce((sum, orb) => sum + orb.value, 0), GAME_CONFIG.enemies.wisp.reward * 1000);
  assert.equal(state.coinOrbs.reduce((sum, orb) => sum + orb.pileCount, 0), 1000);
});

test("金币达到八十枚后合并最近金币堆且不刷新十秒寿命", () => {
  const state = createGameState(117);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  const oldest = { x: 700, y: 300, renderX: 700, renderY: 300, value: 2, pileCount: 1, age: 8.4, collectAge: 0, collector: null, droneIndex: 0 };
  state.coinOrbs.push(oldest);
  for (let index = 1; index < GAME_CONFIG.coins.maxOrbs; index += 1) {
    state.coinOrbs.push({ x: 40 + index, y: 40, renderX: 40 + index, renderY: 40, value: 1, pileCount: 1, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  }
  const enemy = spawnEnemy(state, "wisp", { x: 702, y: 300 });
  enemy.hp = 0;
  updateGame(state, 0.01);

  assert.equal(state.coinOrbs.length, GAME_CONFIG.coins.maxOrbs);
  assert.equal(oldest.value, 2 + GAME_CONFIG.enemies.wisp.reward);
  assert.equal(oldest.pileCount, 2);
  assert.ok(oldest.age >= 8.4);
});

test("精英、首领和锚点不会被普通怪预算压缩", () => {
  const state = createGameState(118);
  for (let index = 0; index < GAME_CONFIG.combat.normalEnemyBudget; index += 1) spawnEnemy(state, "wisp", { x: 700, y: 300 });
  const elite = spawnEnemy(state, "brute", { x: 720, y: 320 }, { elite: true, affix: "shield" });
  const boss = spawnEnemy(state, "boss", { x: 760, y: 360 });
  assert.equal(elite.elite, true);
  assert.equal(elite.unitCount, 1);
  assert.equal(boss.type, "boss");
  assert.equal(state.enemies.filter((enemy) => enemy.type === "anchor").length, 4);
  assert.equal(state.enemies.filter((enemy) => enemy.elite).length, 1);
});

test("威胁十五触发虚环吞星兽并冻结常规刷怪与怪潮", () => {
  const state = createGameState(115);
  state.time = GAME_CONFIG.threat.duration * 14 - 0.05;
  state.spawnTimer = 0;
  state.wave.nextAt = GAME_CONFIG.threat.duration * 14;
  state.tower.hp = 1_000_000;
  updateGame(state, 0.1);
  const colossus = state.enemies.find((enemy) => enemy.type === "colossus");
  assert.ok(colossus);
  assert.equal(state.threat, 15);
  assert.deepEqual(state.enemies.map((enemy) => enemy.type), ["colossus"]);
  assert.equal(state.wave.active, false);
  assert.ok(state.wave.nextAt > GAME_CONFIG.threat.duration * 14);
});

test("巨型首领沿地图外圈运动而不会逼近中央晶塔", () => {
  const state = createGameState(116);
  state.threat = 15;
  state.spawnTimer = 0;
  state.wave.nextAt = 0;
  const colossus = spawnEnemy(state, "colossus", undefined, { orbitAngle: 0 });
  colossus.skillCooldown = 999;
  const beforeAngle = colossus.orbitAngle;
  updateGame(state, 1);
  const normalizedOrbit = ((colossus.x - GAME_CONFIG.arena.centerX) / GAME_CONFIG.colossus.orbitRadiusX) ** 2
    + ((colossus.y - GAME_CONFIG.arena.centerY) / GAME_CONFIG.colossus.orbitRadiusY) ** 2;
  assert.ok(colossus.orbitAngle > beforeAngle);
  assert.ok(Math.abs(normalizedOrbit - 1) < 0.0001);
  assert.deepEqual(state.enemies.map((enemy) => enemy.type), ["colossus"]);
});

test("巨型首领四项技能按互斥状态依次施放", () => {
  const state = createGameState(117);
  state.threat = 15;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.hp = 1_000_000;
  state.tower.fireCooldown = 999;
  const colossus = spawnEnemy(state, "colossus");
  const seen = [];
  for (const expected of GAME_CONFIG.colossus.skillOrder) {
    colossus.skillCooldown = 0;
    updateGame(state, 0.01);
    assert.equal(colossus.intentSkill, expected);
    assert.equal(colossus.activeSkill, null);
    colossus.intentTimer = 0;
    updateGame(state, 0.01);
    seen.push(colossus.activeSkill);
    assert.equal(colossus.activeSkill, expected);
    assert.equal(typeof colossus.activeSkill, "string");
    colossus.skillTimer = 0;
    if (expected === "summon") colossus.summonsRemaining = 0;
    updateGame(state, 0.01);
    assert.equal(colossus.activeSkill, null);
  }
  assert.deepEqual(seen, ["artillery", "summon", "beam", "bulwark"]);
});

test("陨晶炮击产生敌方弹体且巨兽死亡后恢复常规刷怪", () => {
  const state = createGameState(118);
  state.threat = 15;
  state.spawnTimer = 0;
  state.wave.nextAt = 999;
  state.tower.hp = 1_000_000;
  state.tower.fireCooldown = 999;
  const colossus = spawnEnemy(state, "colossus");
  colossus.skillCooldown = 0;
  updateGame(state, 0.01);
  assert.equal(colossus.intentSkill, "artillery");
  assert.equal(state.hostileProjectiles.length, 0);
  colossus.intentTimer = 0;
  updateGame(state, 0.01);
  assert.equal(colossus.activeSkill, "artillery");
  updateGame(state, 0.01);
  assert.equal(state.hostileProjectiles[0]?.kind, "colossusMortar");
  colossus.spawnShield = 0;
  damageEnemy(state, colossus, colossus.maxHp * 2, "shot");
  assert.equal(colossus.healthBar, 1);
  assert.equal(colossus.enraged, true);
  assert.equal(state.colossusEncounter.defeated, false);
  colossus.phaseBreakInvulnerability = 0;
  damageEnemy(state, colossus, colossus.maxHp * 2, "shot");
  updateGame(state, 0.01);
  assert.equal(state.colossusEncounter.defeated, true);
  assert.equal(state.hostileProjectiles.length, 0);
  assert.ok(state.enemies.some((enemy) => enemy.type !== "colossus"));
});

test("召唤、射线与堡垒技能各自生效且不会串招", () => {
  const summonState = createGameState(119);
  summonState.threat = 15; summonState.spawnTimer = 999; summonState.wave.nextAt = 999; summonState.tower.fireCooldown = 999;
  const summoner = spawnEnemy(summonState, "colossus");
  summoner.spawnShield = 0;
  summoner.activeSkill = "summon"; summoner.skillTimer = 2; summoner.skillTick = 0; summoner.summonsRemaining = 2;
  updateGame(summonState, 0.01);
  assert.equal(summonState.summonRifts.length, 1);
  updateGame(summonState, GAME_CONFIG.colossus.summon.telegraphDuration + 0.01);
  assert.ok(summonState.enemies.some((enemy) => enemy.type !== "colossus"));
  assert.equal(summonState.hostileProjectiles.length, 0);

  const beamState = createGameState(120);
  beamState.threat = 15; beamState.spawnTimer = 999; beamState.wave.nextAt = 999; beamState.tower.fireCooldown = 999;
  const beamer = spawnEnemy(beamState, "colossus");
  beamer.activeSkill = "beam"; beamer.skillTimer = 2; beamer.skillTick = 0;
  const hpBefore = beamState.tower.hp;
  updateGame(beamState, 0.01);
  assert.ok(beamState.tower.hp < hpBefore);
  assert.equal(beamState.hostileProjectiles.length, 0);

  const openState = createGameState(121);
  const shieldState = createGameState(121);
  openState.threat = shieldState.threat = 15;
  const openBoss = spawnEnemy(openState, "colossus", undefined, { colossusAffix: "siege" });
  const shieldBoss = spawnEnemy(shieldState, "colossus", undefined, { colossusAffix: "siege" });
  openBoss.spawnShield = shieldBoss.spawnShield = 0;
  shieldBoss.activeSkill = "bulwark";
  damageEnemy(openState, openBoss, 100, "shot");
  damageEnemy(shieldState, shieldBoss, 100, "shot");
  assert.ok(openBoss.maxHp - openBoss.hp > (shieldBoss.maxHp - shieldBoss.hp) * 2);
});

test("巨型首领血量强化并携带可复现的随机词条", () => {
  const first = createGameState(122);
  const second = createGameState(122);
  first.threat = second.threat = 15;
  const firstBoss = spawnEnemy(first, "colossus");
  const secondBoss = spawnEnemy(second, "colossus");
  assert.ok(firstBoss.maxHp > 40_000);
  assert.equal(firstBoss.colossusAffix, secondBoss.colossusAffix);
  assert.ok(GAME_CONFIG.colossus.affixOrder.includes(firstBoss.colossusAffix));

  const carapaceState = createGameState(123);
  const normalState = createGameState(123);
  carapaceState.threat = normalState.threat = 15;
  const normal = spawnEnemy(normalState, "colossus", undefined, { colossusAffix: "siege" });
  const carapace = spawnEnemy(carapaceState, "colossus", undefined, { colossusAffix: "carapace" });
  assert.ok(carapace.maxHp > normal.maxHp);
});

test("巨型首领拥有登场护盾且第一命核破碎后开启第二血条狂暴", () => {
  const state = createGameState(124);
  state.threat = 15;
  const colossus = spawnEnemy(state, "colossus", undefined, { colossusAffix: "siege" });
  assert.equal(colossus.healthBars, 2);
  assert.equal(colossus.healthBar, 2);
  assert.equal(colossus.spawnShield, colossus.maxHp * GAME_CONFIG.colossus.spawnShieldFraction);
  const hpBeforeShield = colossus.hp;
  damageEnemy(state, colossus, colossus.spawnShield * 0.5, "shot");
  assert.equal(colossus.hp, hpBeforeShield);
  assert.ok(colossus.spawnShield < colossus.spawnShieldMax);
  colossus.spawnShield = 0;
  colossus.freezeTimer = 2;
  damageEnemy(state, colossus, colossus.maxHp * 2, "shot");
  assert.equal(colossus.healthBar, 1);
  assert.equal(colossus.hp, colossus.maxHp);
  assert.equal(colossus.enraged, true);
  assert.equal(colossus.freezeTimer, 0);
  assert.ok(state.events.some((event) => event.type === "colossusEnrage"));
  assert.equal(applyElementalHit(state, colossus, "frost", 100), false);
  assert.equal(colossus.freezeTimer, 0);
  assert.ok(state.events.some((event) => event.type === "colossusFreezeImmune"));
});

test("巨型首领第一阶段保留预兆且狂暴阶段可同时发动四项技能", () => {
  const state = createGameState(125);
  state.threat = 15; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  const colossus = spawnEnemy(state, "colossus", undefined, { colossusAffix: "prism" });
  colossus.spawnShield = 0;
  colossus.skillCooldown = 0;
  updateGame(state, 0.01);
  assert.equal(colossus.intentSkill, "artillery");
  assert.equal(colossus.activeSkill, null);
  assert.equal(state.hostileProjectiles.length, 0);
  damageEnemy(state, colossus, colossus.maxHp * 2, "shot");
  colossus.phaseBreakInvulnerability = 0;
  for (const skill of GAME_CONFIG.colossus.skillOrder) colossus.parallelCooldowns[skill] = 0;
  const towerHp = state.tower.hp;
  updateGame(state, 0.01);
  assert.deepEqual(Object.keys(colossus.activeSkills).sort(), [...GAME_CONFIG.colossus.skillOrder].sort());
  updateGame(state, 0.01);
  assert.ok(state.hostileProjectiles.length > 0);
  assert.ok(state.summonRifts.length > 0);
  assert.ok(state.tower.hp < towerHp);
});

test("永久资源不会被滑过拾取且点击后才记入本轮统计", () => {
  const state = createGameState(9101);
  spawnPermanentResourceDrop(state, "echo", 3, 320, 280, { source: "elite" });
  spawnPermanentResourceDrop(state, "core", 1, 520, 280, { source: "boss" });
  updateGame(state, GAME_CONFIG.fixedStep);
  assert.equal(state.stats.echoShards, 0);
  assert.equal(state.stats.coreFragments, 0);
  assert.equal(collectPermanentResourceAt(state, 320, 280)?.value, 3);
  assert.equal(state.stats.echoShards, 3);
  assert.equal(state.resourceDrops.length, 1);
  assert.equal(collectPermanentResourceAt(state, 520, 280)?.resourceType, "core");
  assert.equal(state.stats.coreFragments, 1);
});

test("精英只掉遗响碎片而核心残片只由首领掉落", () => {
  const state = createGameState(9102);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  const elite = spawnEnemy(state, "sentinel", { x: 300, y: 300 }, { elite: true, affix: "shield" });
  const boss = spawnEnemy(state, "boss", { x: 700, y: 300 });
  elite.hp = 0;
  boss.hp = 0;
  updateGame(state, GAME_CONFIG.fixedStep);
  assert.ok(state.resourceDrops.some((drop) => drop.resourceType === "echo" && drop.source === "elite"));
  assert.equal(state.resourceDrops.some((drop) => drop.resourceType === "core" && drop.source === "specialElite"), false);
  assert.ok(state.resourceDrops.some((drop) => drop.resourceType === "core" && drop.source === "boss"));
});
test("炮击预兆锚点被摧毁后会削减炮弹预算", () => {
  const state = createGameState(9301);
  state.threat = 15; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  const boss = spawnEnemy(state, "colossus", undefined, { colossusAffix: "siege" });
  boss.spawnShield = 0; boss.skillCooldown = 0; boss.skillSequence = 0;
  updateGame(state, 0.01);
  const anchor = state.enemies.find((enemy) => enemy.counterSkill === "artillery" && enemy.anchorBossId === boss.id);
  assert.ok(anchor);
  damageEnemy(state, anchor, anchor.maxHp * 2, "shot");
  updateGame(state, 0.01);
  assert.equal(boss.artilleryCountered, true);
  boss.intentTimer = 0;
  updateGame(state, 0.01);
  const fullBudget = Math.ceil(GAME_CONFIG.colossus.artillery.duration / (GAME_CONFIG.colossus.artillery.interval * GAME_CONFIG.colossus.affixes.siege.artilleryIntervalMultiplier));
  assert.equal(boss.activeSkill, "artillery");
  assert.ok(boss.artilleryShotsRemaining < fullBudget);
  assert.equal(boss.artilleryShotsRemaining, Math.max(1, Math.floor(fullBudget * GAME_CONFIG.colossus.counters.artilleryShotMultiplier)));
});

test("射线预兆期间用星落命中巨兽会切断技能并暴露弱点", () => {
  const state = createGameState(9302);
  state.threat = 15; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  const boss = spawnEnemy(state, "colossus", undefined, { colossusAffix: "siege" });
  boss.spawnShield = 0; boss.skillCooldown = 0; boss.skillSequence = 2;
  updateGame(state, 0.01);
  assert.equal(boss.intentSkill, "beam");
  const angle = Math.atan2(boss.y - GAME_CONFIG.arena.centerY, boss.x - GAME_CONFIG.arena.centerX);
  const hpBefore = boss.hp;
  assert.equal(useSkill(state, "starfall", { angle }), true);
  assert.equal(boss.intentSkill, null);
  assert.equal(boss.exposedTimer, GAME_CONFIG.colossus.counters.exposedDuration);
  assert.ok(hpBefore - boss.hp > getTowerStats(state).damage * GAME_CONFIG.skills.starfall.damageMultiplier);
  assert.ok(state.events.some((event) => event.type === "colossusCounter" && event.counter === "beam"));
});

test("召唤预兆期间切换猎杀协议会让裂隙可攻击并可阻止召唤", () => {
  const state = createGameState(9303);
  state.threat = 15; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  const boss = spawnEnemy(state, "colossus", undefined, { colossusAffix: "siege" });
  boss.spawnShield = 0; boss.skillCooldown = 0; boss.skillSequence = 1;
  updateGame(state, 0.01);
  assert.equal(boss.intentSkill, "summon");
  assert.equal(setTargetProtocol(state, "hunter"), true);
  assert.equal(boss.summonCountered, true);
  boss.intentTimer = 0;
  updateGame(state, 0.01);
  updateGame(state, 0.01);
  const rift = state.summonRifts[0];
  assert.equal(rift.attackable, true);
  const target = state.enemies.find((enemy) => enemy.id === rift.targetId);
  assert.ok(target?.riftAnchor);
  damageEnemy(state, target, target.maxHp * 2, "shot");
  updateGame(state, 0.01);
  assert.equal(state.summonRifts.some((candidate) => candidate.id === rift.id), false);
  assert.equal(state.enemies.some((enemy) => enemy.summonedByColossus), false);
});

test("堡垒状态期间启动超载会提前破盾并增加热量", () => {
  const state = createGameState(9304);
  state.threat = 15; state.spawnTimer = 999; state.wave.nextAt = 999;
  const boss = spawnEnemy(state, "colossus", undefined, { colossusAffix: "siege" });
  boss.spawnShield = 0; boss.activeSkill = "bulwark"; boss.skillTimer = 3;
  assert.equal(useSkill(state, "overload"), true);
  assert.equal(boss.activeSkill, null);
  assert.equal(state.skills.overload.heat, GAME_CONFIG.colossus.counters.bulwarkHeat);
  assert.ok(state.events.some((event) => event.type === "colossusCounter" && event.counter === "bulwark"));
});
test("临时遗物初始一槽且只开放棱镜护佑", () => {
  const state = createGameState(9401);
  assert.equal(state.relics.slots, 1);
  assert.deepEqual(state.relics.available, ["ward"]);
  assert.equal(offerRelicChoice(state, "eliteWave"), true);
  assert.deepEqual(state.relicChoice.choices, ["ward"]);
  assert.equal(chooseRelic(state, "ward"), true);
  assert.equal(state.relics.picks, 1);
  assert.equal(offerRelicChoice(state, "boss"), false);
});

test("栏位多于已解锁遗物时才出现低幅数值强化", () => {
  const gap = createGameState(94011, undefined, { ward: true }, 2);
  assert.equal(offerRelicChoice(gap), true);
  assert.ok(gap.relicChoice.choices.includes("ward"));
  assert.ok(gap.relicChoice.choices.some((id) => id.startsWith("boost:")));
  assert.equal(chooseRelic(gap, "ward"), true);
  assert.equal(offerRelicChoice(gap), true);
  assert.ok(gap.relicChoice.choices.every((id) => id.startsWith("boost:")));
  const damageBefore = getTowerStats(gap).damage;
  assert.equal(chooseRelic(gap, "boost:damage"), true);
  assert.equal(Number((getTowerStats(gap).damage / damageBefore).toFixed(2)), 1.08);

  const filledPool = createGameState(94012, undefined, { ward: true, decoy: true }, 2);
  assert.equal(offerRelicChoice(filledPool), true);
  assert.equal(filledPool.relicChoice.choices.some((id) => id.startsWith("boost:")), false);
});

test("怪潮精英、普通首领与巨兽阶段会触发临时遗物奖励", () => {
  const eliteState = createGameState(9402);
  eliteState.spawnTimer = 999; eliteState.wave.nextAt = 999; eliteState.tower.fireCooldown = 999;
  const elite = spawnEnemy(eliteState, "wisp", { x: 650, y: 360 }, { elite: true, waveElite: true, waveIndex: 1 });
  damageEnemy(eliteState, elite, elite.maxHp * 2, "shot");
  updateGame(eliteState, 0.01);
  assert.equal(eliteState.relicChoice?.source, "eliteWave");

  const bossState = createGameState(9403);
  bossState.spawnTimer = 999; bossState.wave.nextAt = 999; bossState.tower.fireCooldown = 999;
  const boss = spawnEnemy(bossState, "boss", { x: 650, y: 360 });
  damageEnemy(bossState, boss, boss.maxHp * 20, "shot");
  updateGame(bossState, 0.01);
  assert.equal(bossState.relicChoice?.source, "boss");

  const giantState = createGameState(9404);
  giantState.threat = 15; giantState.spawnTimer = 999; giantState.wave.nextAt = 999; giantState.tower.fireCooldown = 999;
  const giant = spawnEnemy(giantState, "colossus", undefined, { colossusAffix: "siege" });
  giant.spawnShield = 0;
  damageEnemy(giantState, giant, giant.maxHp * 2, "shot");
  assert.equal(giantState.relicChoice?.source, "colossusPhase");
});

test("诡光诱饵在怪潮方向生成、吸引敌人并在摧毁时爆炸", () => {
  const state = createGameState(9405);
  state.relics.owned.decoy = true; state.relics.picks = 1;
  state.spawnTimer = 999; state.tower.fireCooldown = 999;
  state.time = GAME_CONFIG.waves.firstAt - 0.01;
  updateGame(state, 0.02);
  const decoy = state.decoys[0];
  assert.ok(decoy);
  const waveEnemy = state.enemies.find((enemy) => enemy.waveIndex === state.wave.index);
  assert.ok(waveEnemy);
  const before = Math.hypot(waveEnemy.x - decoy.x, waveEnemy.y - decoy.y);
  updateGame(state, 0.1);
  assert.ok(Math.hypot(waveEnemy.x - decoy.x, waveEnemy.y - decoy.y) < before);
  const victim = spawnEnemy(state, "brute", { x: decoy.x + 20, y: decoy.y });
  const hpBefore = victim.hp;
  decoy.hp = 0;
  updateGame(state, 0.01);
  assert.equal(state.decoys.length, 0);
  assert.ok(victim.hp < hpBefore);
});

test("月相调律提高白昼金币、长夜元素效果并在昼夜切换时强化", () => {
  const day = createGameState(9406);
  day.relics.owned.lunar = true; day.relics.picks = 1;
  day.spawnTimer = 999; day.wave.nextAt = 999; day.tower.fireCooldown = 999;
  const target = spawnEnemy(day, "wisp", { x: 650, y: 360 });
  const reward = target.reward;
  damageEnemy(day, target, target.maxHp * 2, "shot");
  updateGame(day, 0.01);
  assert.equal(day.coinOrbs[0].value, Math.round(reward * GAME_CONFIG.relics.lunar.dayCoinMultiplier));

  const night = createGameState(9407);
  night.relics.owned.lunar = true; night.relics.picks = 1; night.phase = "night";
  const frozen = spawnEnemy(night, "wisp", { x: 650, y: 360 });
  applyElementalHit(night, frozen, "frost", 20);
  assert.equal(frozen.freezeTimer, GAME_CONFIG.elements.frost.freezeDuration * GAME_CONFIG.relics.lunar.nightElementMultiplier);

  const transition = createGameState(9408);
  transition.relics.owned.lunar = true; transition.relics.picks = 1;
  transition.spawnTimer = 999; transition.wave.nextAt = 999; transition.tower.fireCooldown = 999;
  transition.time = GAME_CONFIG.threat.duration * GAME_CONFIG.threat.dayWaves - 0.01;
  updateGame(transition, 0.02);
  assert.ok(transition.relics.phaseBuff > 0);
});

test("镜面裂片每五次普通攻击折射且首领目标不会触发", () => {
  const state = createGameState(9409);
  state.relics.owned.mirror = true; state.relics.picks = 1;
  state.spawnTimer = 999; state.wave.nextAt = 999;
  const first = spawnEnemy(state, "sentinel", { x: 590, y: 360 });
  const second = spawnEnemy(state, "sentinel", { x: 640, y: 360 });
  for (let volley = 0; volley < GAME_CONFIG.relics.mirror.everyShots; volley += 1) {
    state.tower.fireCooldown = 0;
    updateGame(state, 0.001);
    if (volley < GAME_CONFIG.relics.mirror.everyShots - 1) state.projectiles.length = 0;
  }
  state.tower.fireCooldown = 999;
  const secondHp = second.hp;
  let refracted = false;
  for (let step = 0; step < 24 && second.hp === secondHp; step += 1) {
    updateGame(state, GAME_CONFIG.fixedStep);
    refracted ||= state.events.some((event) => event.type === "relicMirror");
  }
  assert.equal(refracted, true);
  assert.ok(second.hp < secondHp);

  const bossState = createGameState(9410);
  bossState.relics.owned.mirror = true; bossState.relics.picks = 1;
  bossState.relics.mirrorShots = GAME_CONFIG.relics.mirror.everyShots - 1;
  bossState.spawnTimer = 999; bossState.wave.nextAt = 999;
  spawnEnemy(bossState, "boss", { x: 590, y: 360 });
  spawnEnemy(bossState, "sentinel", { x: 640, y: 360 });
  bossState.tower.targetProtocol = "hunter";
  let bossRefracted = false;
  for (let step = 0; step < 24; step += 1) {
    updateGame(bossState, GAME_CONFIG.fixedStep);
    bossRefracted ||= bossState.events.some((event) => event.type === "relicMirror");
  }
  assert.equal(bossRefracted, false);
});

test("余烬回收由灼烧或爆炸击杀生成区域并加速区内金币消失", () => {
  const state = createGameState(9411);
  state.relics.owned.ember = true; state.relics.picks = 1;
  state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  const target = spawnEnemy(state, "wisp", { x: 650, y: 360 });
  damageEnemy(state, target, target.maxHp * 2, "fire");
  updateGame(state, 0.01);
  assert.equal(state.emberZones.length, 1);
  const orb = state.coinOrbs[0];
  const ageBefore = orb.age;
  updateGame(state, 0.5);
  assert.ok(orb.age - ageBefore > 0.5);
});

test("未研究遗物不会进入随机池，研究后才会出现", () => {
  const lockedIds = new Set(["decoy", "lunar", "mirror", "ember", "frostbloom", "stormglass", "gilded", "execution", "hourglass"]);
  for (let seed = 1; seed <= 12; seed += 1) {
    const state = createGameState(seed);
    offerRelicChoice(state);
    assert.deepEqual(state.relicChoice.choices, ["ward"]);
    assert.equal(state.relicChoice.choices.some((id) => lockedIds.has(id)), false);
  }
  let decoySeen = false;
  for (let seed = 1; seed <= 30; seed += 1) {
    const state = createGameState(seed, undefined, { ward: true, decoy: true }, 2);
    offerRelicChoice(state);
    assert.equal(state.relicChoice.choices.some((id) => lockedIds.has(id) && id !== "decoy"), false);
    decoySeen ||= state.relicChoice.choices.includes("decoy");
  }
  assert.equal(decoySeen, true);
});

test("棱镜护佑按击杀数补充护盾，霜葬花冠让冻结死亡扩散", () => {
  const ward = createGameState(9501, undefined, { ward: true });
  ward.relics.owned.ward = true; ward.spawnTimer = 999; ward.wave.nextAt = 999; ward.tower.fireCooldown = 999;
  const pack = spawnEnemy(ward, "wisp", { x: 700, y: 360 });
  pack.unitCount = GAME_CONFIG.relics.ward.kills;
  pack.hp = 0;
  updateGame(ward, 0.01);
  assert.ok(ward.tower.shield > 0);

  const frost = createGameState(9502, undefined, { frostbloom: true });
  frost.relics.owned.frostbloom = true; frost.spawnTimer = 999; frost.wave.nextAt = 999; frost.tower.fireCooldown = 999;
  const frozen = spawnEnemy(frost, "wisp", { x: 650, y: 360 });
  const nearby = spawnEnemy(frost, "sentinel", { x: 700, y: 360 });
  frozen.freezeTimer = 1; frozen.hp = 0;
  const hpBefore = nearby.hp;
  updateGame(frost, 0.01);
  assert.ok(nearby.hp < hpBefore);
  assert.ok(nearby.freezeTimer > 0);
});

test("雷脉导体、断罪刻印和逆时沙漏分别强化雷链、斩杀与冷却", () => {
  const storm = createGameState(9503, undefined, { stormglass: true });
  storm.relics.owned.stormglass = true;
  const origin = spawnEnemy(storm, "sentinel", { x: 480, y: 360 });
  for (let index = 0; index < 6; index += 1) spawnEnemy(storm, "sentinel", { x: 520 + index * 22, y: 360 });
  applyElementalHit(storm, origin, "lightning", 100);
  assert.equal(storm.events.find((event) => event.type === "elementHit")?.chains, GAME_CONFIG.elements.lightning.chainCount + GAME_CONFIG.relics.stormglass.extraChains);

  const execute = createGameState(9504, undefined, { execution: true });
  execute.relics.owned.execution = true;
  const target = spawnEnemy(execute, "sentinel", { x: 650, y: 360 });
  target.hp = target.maxHp * 0.3;
  const before = target.hp;
  damageEnemy(execute, target, 10, "shot");
  assert.equal(Number((before - target.hp).toFixed(2)), 10 * GAME_CONFIG.relics.execution.damageMultiplier);

  const time = createGameState(9505, undefined, { hourglass: true });
  time.relics.owned.hourglass = true; time.spawnTimer = 999; time.wave.nextAt = 999; time.tower.fireCooldown = 999;
  for (const skill of Object.values(time.skills)) skill.cooldown = 10;
  updateGame(time, 1);
  for (const skill of Object.values(time.skills)) assert.equal(Number(skill.cooldown.toFixed(2)), Number((10 - GAME_CONFIG.relics.hourglass.cooldownRateMultiplier).toFixed(2)));
});

test("拾金脉冲可复制金币价值，遗响碎片可在战场点击收集", () => {
  const state = createGameState(9506, undefined, { gilded: true });
  state.relics.owned.gilded = true; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  state.rng.next = () => 0;
  state.coinOrbs.push({ x: 480, y: 360, renderX: 480, renderY: 360, value: 20, pileCount: 1, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  collectCoinAt(state, 480, 360);
  updateGame(state, GAME_CONFIG.coins.collectDuration + 0.01);
  assert.equal(state.coins, 35);

  spawnPermanentResourceDrop(state, "echo", 3, 520, 300, { source: "elite" });
  assert.equal(collectPermanentResourceAt(state, 520, 300)?.resourceType, "echo");
  assert.equal(state.stats.echoShards, 3);
});

test("威胁二十清空战场并只生成固定于顶部的超巨型首领", () => {
  const state = createGameState(20001);
  spawnEnemy(state, "wisp", { x: 100, y: 100 });
  spawnEnemy(state, "boss", { x: 800, y: 500 });
  state.time = GAME_CONFIG.threat.duration * 19 - 0.05;
  state.tower.hp = 1_000_000;
  updateGame(state, 0.1);
  const sovereign = state.enemies.find((enemy) => enemy.type === "sovereign");
  assert.ok(sovereign);
  assert.deepEqual(state.enemies.map((enemy) => enemy.type), ["sovereign"]);
  assert.equal(sovereign.x, GAME_CONFIG.sovereign.fixedX);
  assert.equal(sovereign.y, GAME_CONFIG.sovereign.fixedY);
  assert.equal(sovereign.healthBars, 4);
  assert.ok(state.events.some((event) => event.type === "sovereignSpawn"));
  assert.equal(state.enemies.some((enemy) => enemy.type === "boss"), false);
});

test("裂界魔君拥有四管血且最后半管狂暴后免疫全部元素效果", () => {
  const state = createGameState(20002);
  const boss = spawnEnemy(state, "sovereign");
  boss.entryTimer = 0; boss.phaseBreakInvulnerability = 0;
  for (const expectedBar of [3, 2, 1]) {
    damageEnemy(state, boss, boss.maxHp * 2, "shot");
    assert.equal(boss.healthBar, expectedBar);
    boss.phaseBreakInvulnerability = 0;
  }
  assert.equal(boss.enraged, false);
  damageEnemy(state, boss, boss.maxHp * 0.55, "shot");
  assert.equal(boss.enraged, true);
  assert.equal(boss.elementImmune, true);
  for (const element of ["frost", "fire", "lightning"]) assert.equal(applyElementalHit(state, boss, element, 100), false);
  assert.equal(boss.freezeTimer, 0);
  assert.equal(boss.burnTimer, 0);
});

test("裂界魔君一次召唤会同时在四处开启裂隙", () => {
  const state = createGameState(20003);
  state.spawnTimer = 999; state.wave.nextAt = 999;
  const boss = spawnEnemy(state, "sovereign");
  boss.entryTimer = 0; boss.phaseBreakInvulnerability = 0;
  boss.intentSkill = "summon"; boss.intentTimer = 0;
  updateGame(state, 0.01);
  updateGame(state, 0.01);
  assert.equal(state.summonRifts.length, GAME_CONFIG.sovereign.summon.portalsPerWave);
  assert.ok(state.events.some((event) => event.type === "sovereignRiftWave" && event.count === 4));
});

test("裂界魔君远程技能会暂时降低晶塔子弹攻击频率", () => {
  const state = createGameState(20004);
  state.spawnTimer = 999; state.wave.nextAt = 999;
  const boss = spawnEnemy(state, "sovereign");
  boss.entryTimer = 0; boss.phaseBreakInvulnerability = 0;
  const baseRate = getTowerStats(state).fireRate;
  boss.intentSkill = "beam"; boss.intentTimer = 0;
  updateGame(state, 0.01);
  assert.ok(state.tower.fireRateSuppression > 0);
  assert.equal(Number((getTowerStats(state).fireRate / baseRate).toFixed(2)), GAME_CONFIG.sovereign.rangedSlowMultiplier);
  assert.ok(state.events.some((event) => event.type === "sovereignSuppress"));
});

test("超巨型首领在场时晶塔下移缩小，击败后恢复中央尺寸", () => {
  const state = createGameState(20005);
  const defaultPosition = getTowerPosition(state);
  const defaultRadius = getTowerRadius(state);
  const boss = spawnEnemy(state, "sovereign");
  assert.deepEqual(getTowerPosition(state), { x: GAME_CONFIG.sovereign.towerX, y: GAME_CONFIG.sovereign.towerY });
  assert.equal(Number((getTowerRadius(state) / defaultRadius).toFixed(2)), GAME_CONFIG.sovereign.towerScale);
  boss.entryTimer = 0; boss.phaseBreakInvulnerability = 0;
  boss.healthBar = 1;
  damageEnemy(state, boss, boss.maxHp * 10, "shot");
  updateGame(state, 0.01);
  assert.deepEqual(getTowerPosition(state), defaultPosition);
  assert.equal(getTowerRadius(state), defaultRadius);
});
