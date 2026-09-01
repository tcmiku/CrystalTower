import test from "node:test";
import assert from "node:assert/strict";
import { applyAdminSettings, applyElementalHit, calculateAchievementProgress, calculateRunScore, calculateStardust, chooseEnemyType, chooseRelic, collectCoinAt, collectPermanentResourceAt, createGameState, cycleTargetProtocol, damageEnemy, enableAdminCheats, findTargets, getDayPhase, getDroneDetonateRecovery, getDroneEnergyMax, getDroneGuardCooldown, getDroneGuardShieldMax, getEndlessEliteChance, getEndlessWaveEliteCount, getSkillCooldownDuration, getTechStatus, getThreatSealModifiers, getTowerPosition, getTowerRadius, getTowerStats, getUpgradeCost, getStarfallConeHalfAngle, lockAnchorAt, lockRelicChoice, offerRelicChoice, purchaseUpgrade, setTargetProtocol, spawnEnemy, spawnPermanentResourceDrop, toggleDroneDetonate, toggleDroneMode, updateGame, useSkill } from "../src/engine.js";
import { GAME_CONFIG, getCrowdVisualScale } from "../src/config.js";
import { ENDLESS_SHOP_RULES, getEndlessShopPrice, purchaseEndlessShopItem, refreshEndlessShop, rerollEndlessShop } from "../src/endless-shop.js";

test("基础塔属性符合策划", () => {
  const state = createGameState(1);
  const stats = getTowerStats(state);
  assert.equal(stats.damage, 12);
  assert.equal(stats.fireRate, 1.2);
  assert.equal(stats.range, 360);
  assert.equal(stats.maxHp, 600);
});

test("怪群贴图随叠加数量逐级放大并保持视觉上限", () => {
  assert.equal(getCrowdVisualScale(1), 1);
  assert.ok(getCrowdVisualScale(4) > getCrowdVisualScale(2));
  assert.ok(getCrowdVisualScale(16) > getCrowdVisualScale(4));
  assert.equal(getCrowdVisualScale(1024), GAME_CONFIG.combat.crowdMaxVisualScale);
  assert.equal(getCrowdVisualScale(Number.NaN), 1);
});

test("管理员配置只修改本局并永久标记本局不可上榜", () => {
  const state = createGameState(101);
  assert.equal(applyAdminSettings(state, { coins: 999 }), false);
  assert.equal(enableAdminCheats(state), true);
  assert.equal(state.admin.leaderboardEligible, false);
  assert.equal(applyAdminSettings(state, {
    towerHp: 420,
    coins: 98765,
    threat: 5,
    waveIndex: 7,
    nextWaveIn: 12.5,
    invincible: true,
    damage: 321,
    fireRate: 8.5,
    skillCooldowns: { heal: 3, overload: 4, starfall: 5, coinVacuum: 6 },
    shopEnabled: true,
    doubleSpeedEnabled: true,
    relics: ["ward", "hourglass"]
  }), true);
  assert.equal(state.tower.hp, 420);
  assert.equal(state.coins, 98765);
  assert.equal(state.threat, 5);
  assert.equal(state.time, GAME_CONFIG.threat.duration * 4);
  assert.equal(state.wave.index, 7);
  assert.equal(state.wave.nextAt - state.time, 12.5);
  assert.equal(state.admin.invincible, true);
  assert.equal(state.admin.shopEnabled, true);
  assert.equal(state.admin.doubleSpeedEnabled, true);
  assert.equal(state.endlessShop.unlocked, true);
  assert.equal(getTowerStats(state).damage, 321);
  assert.equal(getTowerStats(state).fireRate, 8.5);
  assert.equal(getSkillCooldownDuration(state, "heal"), 3);
  assert.equal(getSkillCooldownDuration(state, "coinVacuum"), 6);
  assert.equal(state.relics.owned.ward, true);
  assert.equal(state.relics.owned.hourglass, true);
  assert.equal(state.relics.owned.decoy, false);
  assert.equal(useSkill(state, "heal"), true);
  assert.equal(state.skills.heal.cooldown, 3);
  const hpBeforeAttack = state.tower.hp;
  const attacker = spawnEnemy(state, "brute", getTowerPosition(state));
  attacker.damage = 10_000;
  attacker.speed = 0;
  updateGame(state, 0.02);
  assert.equal(state.tower.hp, hpBeforeAttack);

  const nextRun = createGameState(102);
  assert.equal(nextRun.admin.enabled, false);
  assert.equal(nextRun.admin.leaderboardEligible, true);
  assert.equal(nextRun.admin.invincible, false);
  assert.equal(nextRun.admin.shopEnabled, false);
  assert.equal(nextRun.admin.doubleSpeedEnabled, false);
  assert.equal(getTowerStats(nextRun).damage, 12);
});

test("管理员模式不会生成、拾取或结算遗响碎片、核心残片和星尘", () => {
  const state = createGameState(103);
  assert.ok(spawnPermanentResourceDrop(state, "echo", 2));
  assert.ok(spawnPermanentResourceDrop(state, "core", 1));
  assert.equal(enableAdminCheats(state), true);
  assert.equal(state.resourceDrops.length, 0);
  assert.equal(spawnPermanentResourceDrop(state, "echo", 2), null);
  state.resourceDrops.push({ resourceType: "core", value: 99, x: 0, y: 0, renderX: 0, renderY: 0, source: "test" });
  assert.equal(collectPermanentResourceAt(state, 0, 0), null);
  assert.equal(state.resourceDrops.length, 0);
  state.stats.kills = 100;
  state.stats.bossKills = 4;
  assert.equal(calculateStardust(state), 0);
  assert.deepEqual([state.stats.echoShards, state.stats.coreFragments], [0, 0]);
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

test("弹丸空间索引不会漏掉跨网格的大体型目标", () => {
  const state = createGameState(52);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  const target = spawnEnemy(state, "brute", { x: 250, y: 250 });
  target.speed = 0;
  target.radius = 130;
  target.hp = target.maxHp = 1_000;
  state.projectiles.push({ id: 9992, x: 125, y: 250, vx: 0, vy: 0, damage: 10, radius: 7, pierce: 0, life: 1, tier: 0 });

  updateGame(state);

  assert.equal(target.hp, 990);
  assert.equal(state.projectiles.length, 0);
});

test("晶塔火力炮膛分支互斥并提供首领/怪潮两套专精", () => {
  const siege = createGameState(501);
  siege.threat = 13; siege.coins = 100_000;
  for (let index = 0; index < 3; index += 1) assert.equal(purchaseUpgrade(siege, "damage"), true);
  assert.equal(purchaseUpgrade(siege, "cannonSiege"), true);
  assert.equal(purchaseUpgrade(siege, "cannonSplit"), false);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(purchaseUpgrade(siege, "cannonCharge"), true);
    assert.equal(purchaseUpgrade(siege, "cannonPierce"), true);
    assert.equal(purchaseUpgrade(siege, "cannonWeakpoint"), true);
  }
  assert.equal(purchaseUpgrade(siege, "cannonStarPiercer"), true);
  assert.equal(getTowerStats(siege).pierce, 3);
  assert.equal(getTechStatus(siege, "cannonSplit").reason, "已选择破城炮膛分支");

  const split = createGameState(502);
  split.threat = 13; split.coins = 100_000;
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(split, "damage");
  assert.equal(purchaseUpgrade(split, "cannonSplit"), true);
  assert.equal(purchaseUpgrade(split, "cannonSiege"), false);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(purchaseUpgrade(split, "cannonGrowth"), true);
    assert.equal(purchaseUpgrade(split, "cannonEcho"), true);
  }
  assert.equal(purchaseUpgrade(split, "cannonCascade"), true);
});

test("突破极限解除无尽模式科技树互斥限制", () => {
  const state = createGameState(183);
  state.endlessMode = true;
  state.threat = 30;
  state.coins = 100_000;
  state.endlessShop.equippedRelics = ["breakthroughLimit"];
  state.tower.upgrades.damage = 3;
  state.tower.upgrades.saw = 3;

  assert.equal(getTechStatus(state, "cannonSiege").unlocked, true);
  assert.equal(purchaseUpgrade(state, "cannonSiege"), true);
  assert.equal(getTechStatus(state, "cannonSplit").unlocked, true);
  assert.equal(purchaseUpgrade(state, "cannonSplit"), true);

  state.tower.upgrades.sawOverdrive = 1;
  assert.equal(getTechStatus(state, "sawLaunch").unlocked, true);
  assert.equal(purchaseUpgrade(state, "sawLaunch"), true);
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

test("贯星炮满蓄能时只对精英或首领发射并直接穿透护盾", () => {
  const state = createGameState(505);
  state.threat = 13; state.coins = 100_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.hp = 1_000_000;
  for (let index = 0; index < 3; index += 1) purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "cannonSiege");
  for (let index = 0; index < 3; index += 1) {
    purchaseUpgrade(state, "cannonCharge"); purchaseUpgrade(state, "cannonPierce"); purchaseUpgrade(state, "cannonWeakpoint");
  }
  purchaseUpgrade(state, "cannonStarPiercer");
  const elite = spawnEnemy(state, "brute", { x: 600, y: 360 }, { elite: true, affix: "shield" });
  elite.speed = 0; elite.hp = elite.maxHp = 100_000; elite.affixShield = elite.affixShieldMax = 5_000;
  let laserSeen = false;
  for (let volley = 0; volley < 8; volley += 1) {
    state.tower.fireCooldown = 0;
    const hpBefore = elite.hp;
    const shieldBefore = elite.affixShield;
    updateGame(state, 1 / 60);
    const laser = state.events.find((event) => event.type === "cannonStarPiercer");
    if (laser) {
      laserSeen = true;
      assert.equal(elite.affixShield, shieldBefore, "贯星炮不消耗护盾值");
      assert.ok(elite.hp < hpBefore, "贯星炮应直接削减生命");
      assert.ok(state.elementFx.some((effect) => effect.element === "starPiercer"), "贯星炮应生成激光特效");
    }
    state.projectiles.length = 0;
  }
  assert.equal(laserSeen, true);

  const normal = createGameState(506);
  normal.threat = 13; normal.spawnTimer = 999; normal.wave.nextAt = 999;
  normal.tower.upgrades = { ...state.tower.upgrades };
  const brute = spawnEnemy(normal, "brute", { x: 600, y: 360 });
  brute.speed = 0; brute.hp = brute.maxHp = 100_000;
  for (let volley = 0; volley < 8; volley += 1) {
    normal.tower.fireCooldown = 0;
    updateGame(normal, 1 / 60);
    assert.equal(normal.events.some((event) => event.type === "cannonStarPiercer"), false, "普通怪不能触发贯星炮");
    normal.projectiles.length = 0;
  }
});

test("裂晶回响短时间连续击杀会触发醒目的大型连锁爆炸", () => {
  const state = createGameState(507);
  state.threat = 13; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  state.tower.upgrades.cannonSplit = 1;
  state.tower.upgrades.cannonGrowth = 3;
  state.tower.upgrades.cannonEcho = 3;
  state.tower.upgrades.cannonCascade = 1;
  for (let index = 0; index < GAME_CONFIG.cannon.split.cascadeKills; index += 1) {
    const defeated = spawnEnemy(state, "wisp", { x: 590 + index * 8, y: 350 + index * 5 });
    defeated.speed = 0; defeated.hp = 0; defeated.lastDamageSource = "cannonEcho";
  }
  const survivor = spawnEnemy(state, "brute", { x: 650, y: 360 });
  survivor.speed = 0; survivor.hp = survivor.maxHp = 100_000;
  const hpBefore = survivor.hp;

  updateGame(state, 1 / 60);

  const cascade = state.events.find((event) => event.type === "cannonCascade");
  assert.ok(cascade, "连续晶爆击杀应触发裂界连爆");
  assert.equal(cascade.radius, GAME_CONFIG.cannon.split.cascadeRadius);
  assert.ok(cascade.hits >= 1);
  assert.ok(survivor.hp < hpBefore, "大型连锁爆炸应伤害范围内目标");
  assert.ok(state.elementFx.some((effect) => effect.element === "cannonCascade"), "应生成大型爆炸特效");
  assert.equal(state.tower.cannonEchoChain, 0);
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

test("星落大范围命中合并音效事件与飘字", () => {
  const state = createGameState(904);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.upgrades.cannonEcho = 3;
  state.tower.upgrades.cannonCascade = 1;
  for (let index = 0; index < 120; index += 1) {
    const enemy = spawnEnemy(state, "wisp", { x: 560 + (index % 20) * 6, y: 360 + (index % 5 - 2) * 4 });
    enemy.hp = 1;
  }
  for (let index = 0; index < 20; index += 1) {
    const survivor = spawnEnemy(state, "sentinel", { x: 560 + index * 3, y: 430 + index % 2 * 7 });
    survivor.hp = survivor.maxHp = 100_000;
  }
  assert.equal(useSkill(state, "starfall", { angle: 0 }), true);
  assert.equal(state.events.filter((event) => event.type === "hit" && event.source === "starfall").length, 1);
  assert.equal(state.events.filter((event) => event.type === "kill").length, 120);
  assert.ok(state.events.filter((event) => event.type === "cannonEcho").length <= 8);
  assert.equal(state.floaters.filter((floater) => floater.text.startsWith("星落命中")).length, 1);
  assert.equal(state.floaters.filter((floater) => floater.text.startsWith("星落连锁 ×")).length, 1);
  assert.ok(state.floaters.length <= 2);
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

test("普通敌人沿宽屏场地的地图边缘生成", () => {
  const state = createGameState(3101);
  const ring = GAME_CONFIG.arena.spawnRing;
  for (let index = 0; index < 80; index += 1) {
    const enemy = spawnEnemy(state, "wisp");
    const normalizedEdge = Math.max(
      Math.abs(enemy.x - ring.centerX) / ring.radiusX,
      Math.abs(enemy.y - ring.centerY) / ring.radiusY
    );
    assert.ok(normalizedEdge >= 1 && normalizedEdge < 1.04);
    assert.ok(Math.hypot(enemy.x - ring.centerX, enemy.y - ring.centerY) > GAME_CONFIG.tower.range);
  }
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

test("无尽模式常规刷怪获得递增精英概率且不会影响标准远征", () => {
  const standard = createGameState(421);
  standard.threat = 28;
  assert.equal(getEndlessEliteChance(standard), 0);

  const endless = createGameState(421);
  endless.endlessMode = true;
  endless.threat = 20;
  assert.equal(getEndlessEliteChance(endless), GAME_CONFIG.endless.baseEliteChance);
  endless.threat = 28;
  assert.equal(Number(getEndlessEliteChance(endless).toFixed(2)), 0.14);
  endless.threat = 100;
  assert.equal(getEndlessEliteChance(endless), GAME_CONFIG.endless.eliteChanceCap);

  endless.threat = 20;
  endless.wave.nextAt = 999;
  endless.tower.fireCooldown = 999;
  for (let cycle = 0; cycle < 80; cycle += 1) {
    endless.spawnTimer = 0;
    updateGame(endless, 0.001);
  }
  assert.ok(endless.enemies.some((enemy) => enemy.elite));
});

test("无尽怪潮从两只精英开始并随威胁提升至六只", () => {
  const state = createGameState(422);
  state.endlessMode = true;
  state.tower.hp = 1_000_000;
  state.tower.fireCooldown = 999;
  state.spawnTimer = 999;
  state.threat = 28;
  assert.equal(getEndlessWaveEliteCount({ ...state, threat: 20 }), 2);
  assert.equal(getEndlessWaveEliteCount(state), 4);
  assert.equal(getEndlessWaveEliteCount({ ...state, threat: 100 }), GAME_CONFIG.endless.waveEliteCap);
  state.time = (state.threat - 1) * GAME_CONFIG.threat.duration + 0.1;
  state.wave.nextAt = state.time + 0.05;
  updateGame(state, 0.1);
  assert.ok(state.events.some((event) => event.type === "waveStart" && event.endless && event.eliteCount === 4));
  for (let step = 0; step < 400 && state.wave.active; step += 1) updateGame(state, 0.1);
  const waveElites = state.enemies.filter((enemy) => enemy.elite && enemy.waveIndex === 1);
  assert.equal(waveElites.length, 4);
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

test("主动技能研究只在创建下一局时装载", () => {
  const savedResearch = { heal: { branch: null, nodes: [] }, overload: { branch: null, nodes: [] }, starfall: { branch: null, nodes: [] }, coinVacuum: { branch: null, nodes: [] } };
  const currentRun = createGameState(6401, undefined, undefined, undefined, undefined, undefined, savedResearch);
  savedResearch.heal = { branch: "guardian", nodes: ["reinforcedCore"] };
  assert.deepEqual(currentRun.skillResearch.heal, { branch: null, nodes: [] });
  const nextRun = createGameState(6402, undefined, undefined, undefined, undefined, undefined, savedResearch);
  assert.deepEqual(nextRun.skillResearch.heal, { branch: "guardian", nodes: ["reinforcedCore"] });
});

test("主动技能研究可学习两条路线但战斗只启用当前路线", () => {
  const state = createGameState(64025, undefined, undefined, undefined, undefined, undefined, {
    starfall: { branch: "precision", nodes: ["wideReticle", "starMark", "counterBurst", "impactField"] }
  });
  const baseAngle = GAME_CONFIG.skills.starfall.coneHalfAngle;
  assert.equal(getStarfallConeHalfAngle(state), baseAngle * GAME_CONFIG.activeSkillResearch.starfall.coneMultiplier);
  state.skillResearch.starfall.branch = "bombardment";
  assert.equal(getStarfallConeHalfAngle(state), baseAngle);
});

test("晶愈分支分别强化治疗安全网与满盾反制", () => {
  const state = createGameState(6403, undefined, undefined, undefined, undefined, undefined, { heal: { branch: "guardian", nodes: ["reinforcedCore", "lastStand"] } });
  const stats = getTowerStats(state);
  state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  state.tower.hp = 100;
  assert.equal(useSkill(state, "heal"), true);
  assert.equal(state.tower.hp, 256);
  assert.equal(state.skills.heal.damageReduction, 5);

  state.skills.heal.cooldown = 0;
  state.tower.hp = stats.maxHp;
  state.tower.shield = 100;
  assert.equal(useSkill(state, "heal"), true);
  assert.equal(state.tower.shield, stats.maxHp * GAME_CONFIG.skills.heal.shieldCapFraction);
  const retaliation = createGameState(64031, undefined, undefined, undefined, undefined, undefined, { heal: { branch: "retaliation", nodes: ["repulse"] } });
  retaliation.spawnTimer = 999; retaliation.wave.nextAt = 999; retaliation.tower.fireCooldown = 999;
  retaliation.tower.hp = getTowerStats(retaliation).maxHp;
  retaliation.tower.shield = getTowerStats(retaliation).maxHp * GAME_CONFIG.skills.heal.shieldCapFraction;
  const enemy = spawnEnemy(retaliation, "brute", { x: GAME_CONFIG.arena.centerX + 40, y: GAME_CONFIG.arena.centerY });
  enemy.speed = 0;
  const beforeX = enemy.x;
  retaliation.skills.heal.shieldBurstArmed = true;
  updateGame(retaliation, 0.01);
  assert.ok(enemy.x > beforeX);
  assert.ok(retaliation.events.some((event) => event.type === "shieldBurst" && event.knockbackHits >= 1));

  const protectedState = createGameState(6404, undefined, undefined, undefined, undefined, undefined, { heal: { branch: "guardian", nodes: ["reinforcedCore", "lastStand"] } });
  protectedState.spawnTimer = 999; protectedState.wave.nextAt = 999; protectedState.tower.fireCooldown = 999;
  protectedState.tower.hp = 100;
  useSkill(protectedState, "heal");
  protectedState.tower.hp = 300;
  const protectedEnemy = spawnEnemy(protectedState, "wisp", { x: GAME_CONFIG.arena.centerX, y: GAME_CONFIG.arena.centerY });
  protectedEnemy.speed = 0;
  updateGame(protectedState, 0.01);
  const hitEvent = protectedState.events.find((event) => event.type === "towerHit");
  assert.ok(hitEvent.mitigated > 0);
});

test("超载研究延长持续、降低积热并强化提前泄压与结束伤害", () => {
  const researched = createGameState(6405, undefined, undefined, undefined, undefined, undefined, { overload: { branch: "sustain", nodes: ["stabilizer"] } });
  researched.spawnTimer = 999; researched.wave.nextAt = 999; researched.tower.fireCooldown = 999;
  assert.equal(useSkill(researched, "overload"), true);
  assert.equal(researched.skills.overload.active, 7.5);
  updateGame(researched, 1);
  assert.equal(researched.skills.overload.heat, 3.75);
  const rupture = createGameState(64051, undefined, undefined, undefined, undefined, undefined, { overload: { branch: "rupture", nodes: ["pressureValve", "thermalNova"] } });
  rupture.spawnTimer = 999; rupture.wave.nextAt = 999; rupture.tower.fireCooldown = 999;
  assert.equal(useSkill(rupture, "overload"), true);
  const target = spawnEnemy(rupture, "brute", { x: GAME_CONFIG.arena.centerX + 120, y: GAME_CONFIG.arena.centerY });
  target.speed = 0; target.hp = target.maxHp = 1000;
  const beforeX = target.x;
  const beforeHp = target.hp;
  rupture.skills.overload.heat = 100;
  assert.equal(useSkill(rupture, "overload"), true);
  assert.ok(target.x - beforeX > GAME_CONFIG.skills.overload.knockbackDistance * 0.55);
  assert.ok(target.hp < beforeHp);
  const release = rupture.events.findLast((event) => event.type === "overloadRelease");
  assert.ok(release.damage > getTowerStats(rupture).damage * GAME_CONFIG.activeSkillResearch.overload.damageMultiplier);
  assert.ok(release.knockbackMultiplier > 1);
});

test("星落研究扩大瞄准、附加星痕并在群体命中后追加落星", () => {
  const state = createGameState(6406, undefined, undefined, undefined, undefined, undefined, { starfall: { branch: "precision", nodes: ["wideReticle", "starMark"] } });
  state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  const radius = 180;
  const targets = [0.49, 0.5, 0.51].map((angle) => {
    const enemy = spawnEnemy(state, "brute", { x: GAME_CONFIG.arena.centerX + Math.cos(angle) * radius, y: GAME_CONFIG.arena.centerY + Math.sin(angle) * radius });
    enemy.speed = 0; enemy.hp = enemy.maxHp = 1000;
    return enemy;
  });
  assert.equal(useSkill(state, "starfall", { angle: 0 }), true);
  assert.ok(targets.every((enemy) => enemy.starMarkTimer === GAME_CONFIG.activeSkillResearch.starfall.markDuration));
  const bombardment = createGameState(64061, undefined, undefined, undefined, undefined, undefined, { starfall: { branch: "bombardment", nodes: ["counterBurst", "impactField"] } });
  bombardment.spawnTimer = 999; bombardment.wave.nextAt = 999; bombardment.tower.fireCooldown = 999;
  const burstTargets = [0, 0.03, -0.03].map((angle) => spawnEnemy(bombardment, "brute", { x: GAME_CONFIG.arena.centerX + Math.cos(angle) * radius, y: GAME_CONFIG.arena.centerY + Math.sin(angle) * radius }));
  burstTargets.forEach((enemy) => { enemy.speed = 0; enemy.hp = enemy.maxHp = 1000; });
  assert.equal(useSkill(bombardment, "starfall", { angle: 0 }), true);
  assert.ok(bombardment.events.some((event) => event.type === "starfallFollowup" && event.hits >= 3));
  assert.ok(bombardment.elementFx.some((effect) => effect.element === "starfallFollowup"));
});

test("金潮归塔研究提高金币价值并把大量回收转为冷却与攻速循环", () => {
  const state = createGameState(6407, undefined, undefined, undefined, undefined, undefined, { coinVacuum: { branch: "salvage", nodes: ["magnet", "cooldownLoop"] } });
  for (let index = 0; index < 15; index += 1) {
    state.coinOrbs.push({ x: 200 + index, y: 180, renderX: 200 + index, renderY: 180, value: 10, age: index / 2, collectAge: 0, collector: null, droneIndex: 0 });
  }
  assert.equal(useSkill(state, "coinVacuum"), true);
  assert.equal(state.coins, 165);
  assert.equal(state.skills.coinVacuum.cooldownCredit, 0.2);
  assert.equal(state.skills.coinVacuum.fireRateBuff, 0);
  state.tower.hp -= 100;
  assert.equal(useSkill(state, "heal"), true);
  assert.equal(state.skills.heal.cooldown, 24);
  assert.equal(state.skills.coinVacuum.cooldownCredit, 0);
  const conversion = createGameState(64071, undefined, undefined, undefined, undefined, undefined, { coinVacuum: { branch: "conversion", nodes: ["surge", "overdrive"] } });
  conversion.coinOrbs.push(...Array.from({ length: 20 }, (_, index) => ({ x: 200 + index, y: 180, renderX: 200 + index, renderY: 180, value: 1, age: 0, collectAge: 0, collector: null, droneIndex: 0 })));
  assert.equal(useSkill(conversion, "coinVacuum"), true);
  assert.equal(conversion.skills.coinVacuum.fireRateBuff, 7);
  assert.equal(conversion.skills.coinVacuum.damageBuff, 7);
});

test("拾荒无人机科技最多解锁五架", () => {
  const state = createGameState(70);
  state.threat = 8;
  state.coins = 100_000;
  purchaseUpgrade(state, "damage");
  for (let index = 0; index < 5; index += 1) {
    assert.equal(purchaseUpgrade(state, "drone"), true);
  }
  assert.equal(state.tower.upgrades.drone, 5);
  assert.equal(purchaseUpgrade(state, "drone"), false);
  updateGame(state, 1 / 60);
  assert.equal(state.drones.length, 5);
  assert.equal(GAME_CONFIG.techTree.drone.maxLevel, 5);
});
test("三架无人机即可开放磁吸、拦截和电池协议", () => {
  const state = createGameState(701);
  state.threat = 8;
  state.coins = 100_000;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  assert.equal(getTechStatus(state, "autoCollect").unlocked, true);
  assert.equal(purchaseUpgrade(state, "autoCollect"), true);
  assert.equal(getTechStatus(state, "droneIntercept").unlocked, true);
  assert.equal(getTechStatus(state, "droneBattery").unlocked, true);
});
test("无人机达到三架后即可解锁晶塔磁吸并每五秒吸收永久资源", () => {
  const state = createGameState(71);
  state.threat = 6;
  state.coins = 10_000;
  purchaseUpgrade(state, "damage");
  assert.equal(purchaseUpgrade(state, "autoCollect"), false);
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "autoCollect");
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
  purchaseUpgrade(state, "autoCollect");
  toggleDroneMode(state);
  const enemy = spawnEnemy(state, "brute", { x: 650, y: 360 });
  enemy.hp = enemy.maxHp = 100_000;
  const beforeHp = enemy.hp;
  for (let index = 0; index < 120; index += 1) updateGame(state, 1 / 60);
  assert.equal(state.drones.length, 5);
  assert.ok(enemy.hp < beforeHp);
});

test("攻击模式暂停自动回收但保留手动拾币，耗尽后返回护航充能", () => {
  const state = createGameState(74);
  state.threat = 6; state.coins = 10_000; state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  purchaseUpgrade(state, "damage");
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "autoCollect");
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone");
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
  purchaseUpgrade(state, "damage"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "droneIntercept");
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
  purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "drone"); purchaseUpgrade(state, "autoCollect"); purchaseUpgrade(state, "droneHunt");
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
test("无尽挑战中的精英和首领只计分且不再掉专属资源或遗物", () => {
  const state = createGameState(9103);
  state.endlessMode = true;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  const elite = spawnEnemy(state, "sentinel", { x: 300, y: 300 }, { elite: true, waveElite: true, affix: "shield" });
  const boss = spawnEnemy(state, "boss", { x: 700, y: 300 });
  elite.hp = 0;
  boss.hp = 0;
  updateGame(state, GAME_CONFIG.fixedStep);
  assert.equal(state.resourceDrops.length, 0);
  assert.equal(state.relicChoice, null);
  assert.ok(state.stats.score > 0);
  assert.ok(state.stats.kills >= 2);
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
test("临时遗物初始一槽且所有遗物默认进入候选池", () => {
  const state = createGameState(9401);
  assert.equal(state.relics.slots, 1);
  assert.equal(state.relics.available.length, 13);
  assert.ok(state.relics.available.includes("ward"));
  assert.ok(state.relics.available.includes("prismArc"));
  assert.equal(offerRelicChoice(state, "eliteWave"), true);
  assert.equal(state.relicChoice.choices.length, 3);
  assert.equal(chooseRelic(state, state.relicChoice.choices[0]), true);
  assert.equal(state.relics.picks, 1);
  assert.equal(offerRelicChoice(state, "boss"), false);
});

test("研究舱强化等级会实际提高遗物战斗效果", () => {
  const base = createGameState(94011);
  const upgraded = createGameState(94011, undefined, undefined, 1, { upgrades: { hourglass: 3 } });
  base.relics.owned.hourglass = true;
  upgraded.relics.owned.hourglass = true;
  base.skills.heal.cooldown = 10;
  upgraded.skills.heal.cooldown = 10;
  updateGame(base, 1);
  updateGame(upgraded, 1);
  assert.ok(upgraded.skills.heal.cooldown < base.skills.heal.cooldown);
  assert.equal(upgraded.relics.upgrades.hourglass, 3);
});

test("无尽怪潮彻底肃清后获得不占栏位且可无限叠加的无界增幅核", () => {
  const state = createGameState(94013);
  state.endlessMode = true;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.wave.pendingClear = [7];
  state.tower.fireCooldown = 999;
  const finalEnemy = spawnEnemy(state, "wisp", { x: 700, y: 360 }, { waveIndex: 7 });

  updateGame(state, 0.01);
  assert.equal(state.relicChoice, null);
  damageEnemy(state, finalEnemy, finalEnemy.maxHp * 2, "shot");
  updateGame(state, 0.01);
  assert.deepEqual(state.relicChoice, { source: "endlessWave", choices: ["boost:endless"] });
  assert.ok(state.events.some((event) => event.type === "waveCleared" && event.index === 7 && event.endless));

  const slotsBefore = state.relics.slots;
  const picksBefore = state.relics.picks;
  assert.equal(chooseRelic(state, "boost:endless"), true);
  assert.deepEqual([state.relics.slots, state.relics.picks, state.relics.endlessStacks], [slotsBefore, picksBefore, 1]);
  assert.equal(state.relics.damageBonus, GAME_CONFIG.relics.endless.damagePerStack);
  assert.equal(state.relics.rateBonus, GAME_CONFIG.relics.endless.ratePerStack);

  assert.equal(offerRelicChoice(state, "endlessWave"), true);
  assert.equal(chooseRelic(state, "boost:endless"), true);
  assert.equal(state.relics.endlessStacks, 2);
  assert.equal(state.relics.damageBonus, GAME_CONFIG.relics.endless.damagePerStack * 2);
  assert.equal(state.relics.rateBonus, GAME_CONFIG.relics.endless.ratePerStack * 2);
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

test("所有基础与隐藏遗物从新存档起即可随机出现", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed += 1) {
    const state = createGameState(seed);
    offerRelicChoice(state);
    state.relicChoice.choices.forEach((id) => seen.add(id));
    assert.equal(state.relicChoice.choices.length, 3);
  }
  assert.ok(seen.has("decoy"));
  assert.ok(seen.has("prismArc"));
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
  assert.equal(GAME_CONFIG.relics.hourglass.cooldownRateMultiplier, 1.75);
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
  assert.equal(sovereign.spawnShield, sovereign.maxHp * GAME_CONFIG.sovereign.spawnShieldFraction);
  assert.ok(state.events.some((event) => event.type === "sovereignSpawn"));
  assert.equal(state.enemies.some((enemy) => enemy.type === "boss"), false);
});

test("裂界魔君进入最后一管血时立即狂暴并免疫全部元素效果", () => {
  const state = createGameState(20002);
  const boss = spawnEnemy(state, "sovereign");
  boss.entryTimer = 0; boss.phaseBreakInvulnerability = 0;
  for (const expectedBar of [3, 2, 1]) {
    damageEnemy(state, boss, boss.maxHp * 2, "shot");
    assert.equal(boss.healthBar, expectedBar);
    boss.phaseBreakInvulnerability = 0;
  }
  assert.equal(boss.enraged, true);
  assert.equal(boss.elementImmune, true);
  assert.ok(state.events.some((event) => event.type === "sovereignEnrage"));
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
test("裂界魔君降临护盾击破后会取消当前技能并强制召唤", () => {
  const state = createGameState(200031);
  const boss = spawnEnemy(state, "sovereign");
  boss.entryTimer = 0; boss.phaseBreakInvulnerability = 0;
  boss.activeSkill = "beam";
  state.hostileProjectiles.push({ id: state.nextId++, kind: "sovereignMortar", x: 100, y: 100, vx: 0, vy: 0, targetX: 100, targetY: 100, radius: 5, life: 2, damage: 1 });
  damageEnemy(state, boss, boss.spawnShieldMax + 1, "shot");
  assert.equal(boss.spawnShield, 0);
  assert.equal(boss.activeSkill, null);
  assert.equal(boss.intentSkill, "summon");
  assert.equal(state.hostileProjectiles.length, 0);
  assert.ok(state.events.some((event) => event.type === "sovereignShieldBreak" && event.forcedSkill === "summon"));
});

test("裂界魔君失去两管血后召唤七处裂隙且每波包含词缀精英", () => {
  const state = createGameState(200032);
  state.spawnTimer = 999; state.wave.nextAt = 999;
  const boss = spawnEnemy(state, "sovereign");
  boss.entryTimer = 0; boss.phaseBreakInvulnerability = 0; boss.spawnShield = 0;
  boss.healthBar = GAME_CONFIG.sovereign.summon.empoweredHealthBar;
  boss.intentSkill = "summon"; boss.intentTimer = 0;
  updateGame(state, 0.01);
  updateGame(state, 0.01);
  assert.equal(state.summonRifts.length, GAME_CONFIG.sovereign.summon.empoweredPortalsPerWave);
  assert.equal(state.summonRifts.filter((rift) => rift.elite).length, GAME_CONFIG.sovereign.summon.elitePerWave);
  assert.ok(state.events.some((event) => event.type === "sovereignRiftWave" && event.empowered && event.eliteCount === 1));
  boss.activeSkill = null; boss.skillCooldown = 999;
  updateGame(state, GAME_CONFIG.sovereign.summon.telegraphDuration + 0.01);
  const elite = state.enemies.find((enemy) => enemy.elite && enemy.type !== "sovereign");
  assert.ok(elite);
  assert.ok(GAME_CONFIG.eliteAffixes.order.includes(elite.affix));
});

test("裂界魔君登场动画期间冻结双方攻击但倒计时继续", () => {
  const state = createGameState(200033);
  state.spawnTimer = 999; state.wave.nextAt = 999;
  const boss = spawnEnemy(state, "sovereign");
  const before = boss.entryTimer;
  state.tower.fireCooldown = 0;
  assert.equal(useSkill(state, "starfall", { angle: -Math.PI / 2 }), false);
  updateGame(state, 0.1);
  assert.ok(boss.entryTimer < before);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.hostileProjectiles.length, 0);
  assert.equal(boss.hp, boss.maxHp);
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

test("tower health bar timer starts after a hit and expires", () => {
  const state = createGameState(744);
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  const enemy = spawnEnemy(state, "wisp", { x: 520, y: 360 });
  enemy.speed = 0;
  updateGame(state, 1 / 60);
  assert.ok(state.tower.healthBarTimer > 0);
  assert.equal(state.tower.healthBarTimer, GAME_CONFIG.tower.healthBarDuration);
  state.enemies = [];
  updateGame(state, GAME_CONFIG.tower.healthBarDuration);
  assert.equal(state.tower.healthBarTimer, 0);
});
test("档案馆可从下局候选池同时排除多个目标", () => {
  const state = createGameState(9601, undefined, undefined, 2, { disabledRelics: ["ward", "lunar", "ember"] });
  assert.equal(state.relics.available.length, 10);
  offerRelicChoice(state);
  assert.equal(state.relicChoice.choices.includes("ward"), false);
  assert.equal(state.relicChoice.choices.includes("lunar"), false);
  assert.equal(state.relicChoice.choices.includes("ember"), false);
});

test("锁定的遗物选项会跨过本轮选择保留到下一次奖励", () => {
  const state = createGameState(9602, undefined, { ward: true, decoy: true, lunar: true }, 4);
  offerRelicChoice(state);
  const locked = state.relicChoice.choices[0];
  const chosen = state.relicChoice.choices.find((id) => id !== locked && !id.startsWith("boost:"));
  assert.equal(lockRelicChoice(state, locked), true);
  assert.equal(chooseRelic(state, chosen), true);
  assert.equal(state.relics.lockedChoice, locked);
  assert.equal(offerRelicChoice(state, "boss"), true);
  assert.equal(state.relicChoice.choices[0], locked);
  assert.equal(chooseRelic(state, locked), true);
  assert.equal(state.relics.lockedChoice, null);
});

test("两件基础遗物共存会发现隐藏遗物并永久加入当前候选池", () => {
  const state = createGameState(9603, undefined, { mirror: true, stormglass: true }, 4);
  state.relicChoice = { source: "test", choices: ["mirror"] };
  assert.equal(chooseRelic(state, "mirror"), true);
  state.relicChoice = { source: "test", choices: ["stormglass"] };
  assert.equal(chooseRelic(state, "stormglass"), true);
  assert.equal(state.relics.discovered.prismArc, true);
  assert.equal(state.relics.available.includes("prismArc"), true);
  assert.ok(state.events.some((event) => event.type === "relicComboDiscovered" && event.id === "prismArc"));
});

test("登记套装后持有组件会优先补出同套装遗物", () => {
  const archive = { discovered: { prismArc: true }, registeredSets: { prismArc: true } };
  const state = createGameState(9604, undefined, { mirror: true, stormglass: true }, 4, archive);
  state.relics.owned.mirror = true; state.relics.picks = 1;
  offerRelicChoice(state);
  assert.equal(state.relicChoice.choices[0], "stormglass");
});

test("折光雷晶让镜面折射继续生成可见连锁闪电", () => {
  const state = createGameState(9605, undefined, { mirror: true, stormglass: true }, 4, { discovered: { prismArc: true } });
  state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  state.relics.owned.mirror = true; state.relics.owned.prismArc = true;
  const first = spawnEnemy(state, "brute", { x: 520, y: 360 });
  const second = spawnEnemy(state, "brute", { x: 580, y: 360 });
  const third = spawnEnemy(state, "brute", { x: 630, y: 360 });
  for (const enemy of [first, second, third]) { enemy.speed = 0; enemy.hp = enemy.maxHp = 1000; }
  state.projectiles.push({ id: state.nextId++, x: first.x, y: first.y, vx: 0, vy: 0, damage: 100, radius: 5, pierce: 0, life: 1, tier: 1, mirrorReady: true });
  updateGame(state, 1 / 60);
  assert.ok(state.events.some((event) => event.type === "relicPrismArc" && event.chains >= 1));
  assert.ok(state.elementFx.some((effect) => effect.element === "lightning"));
  assert.ok(third.hp < third.maxHp);
});

test("霜烬共生核让霜葬击杀生成冻结与灼烧并存的区域", () => {
  const state = createGameState(9606, undefined, { frostbloom: true, ember: true }, 4, { discovered: { frostfire: true } });
  state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  state.relics.owned.frostbloom = true; state.relics.owned.frostfire = true;
  const frozen = spawnEnemy(state, "wisp", { x: 520, y: 360 });
  const nearby = spawnEnemy(state, "brute", { x: 560, y: 360 });
  frozen.speed = 0; nearby.speed = 0; frozen.freezeTimer = 2; nearby.hp = nearby.maxHp = 1000;
  damageEnemy(state, frozen, frozen.maxHp * 2, "frost");
  updateGame(state, 1 / 60);
  assert.ok(state.emberZones.some((zone) => zone.frostfire));
  updateGame(state, GAME_CONFIG.relics.ember.tickInterval + 0.01);
  assert.ok(nearby.hp < nearby.maxHp);
  assert.ok(nearby.freezeTimer > 0);
});

test("棱光替身在诱饵爆炸后为晶塔生成护盾", () => {
  const state = createGameState(9607, undefined, { decoy: true, ward: true }, 4, { discovered: { decoyWard: true } });
  state.relics.owned.decoy = true; state.relics.owned.decoyWard = true;
  state.tower.shield = 0; state.time = GAME_CONFIG.waves.firstAt; state.wave.nextAt = GAME_CONFIG.waves.firstAt;
  updateGame(state, 1 / 60);
  assert.ok(state.decoys.length > 0);
  state.decoys[0].hp = 0;
  updateGame(state, 1 / 60);
  assert.ok(state.tower.shield > 0);
  assert.ok(state.events.some((event) => event.type === "relicDecoyWard"));
});

test("威胁封印叠加公共收益，并只在装备时推进封印成就", () => {
  const modifiers = getThreatSealModifiers(["longNight", "severedSupply", "frenzy", "colossus", "flawless", "unknown", "frenzy"]);
  assert.deepEqual(modifiers.ids, ["longNight", "severedSupply", "frenzy", "colossus", "flawless"]);
  assert.equal(modifiers.resourceMultiplier, 1.67);
  assert.equal(modifiers.scoreMultiplier, 1.76);
  assert.equal(modifiers.relicChanceBonus, 0.33);
  assert.equal(modifiers.achievementMultiplier, 2.1);

  const equipped = createGameState(9701, undefined, undefined, undefined, undefined, ["longNight", "frenzy"]);
  equipped.stats.kills = 40;
  equipped.stats.bossKills = 2;
  assert.equal(calculateAchievementProgress(equipped), Math.round((40 + 50) * 1.4));

  const plain = createGameState(9702);
  plain.stats.kills = 40;
  plain.stats.bossKills = 2;
  assert.equal(calculateAchievementProgress(plain), 0);
});

test("长夜、狂潮与断供封印实际改写昼夜、怪潮、遗物和金币规则", () => {
  assert.equal(getDayPhase(5, 3), "night");
  assert.equal(getDayPhase(6, 3), "day");

  const longNight = createGameState(9703, undefined, undefined, undefined, undefined, ["longNight"]);
  longNight.phase = "night";
  const frozen = spawnEnemy(longNight, "wisp", { x: 650, y: 360 });
  applyElementalHit(longNight, frozen, "frost", 20);
  assert.equal(frozen.freezeTimer, GAME_CONFIG.elements.frost.freezeDuration * GAME_CONFIG.threatSeals.longNight.elementMultiplier);

  const frenzy = createGameState(9704, undefined, { ward: true, decoy: true, lunar: true, mirror: true }, 4, undefined, ["frenzy"]);
  assert.equal(offerRelicChoice(frenzy, "boss"), true);
  assert.equal(frenzy.relicChoice.choices.length, 4);
  frenzy.relicChoice = null;
  frenzy.spawnTimer = 999; frenzy.tower.fireCooldown = 999;
  frenzy.time = GAME_CONFIG.waves.firstAt - 0.01;
  updateGame(frenzy, 0.02);
  const waveStart = frenzy.events.find((event) => event.type === "waveStart");
  assert.equal(waveStart.count, Math.ceil((GAME_CONFIG.waves.baseCount + frenzy.threat * GAME_CONFIG.waves.countPerThreat) * GAME_CONFIG.threatSeals.frenzy.waveCountMultiplier));

  const severed = createGameState(9705, undefined, undefined, undefined, undefined, ["severedSupply"]);
  severed.spawnTimer = 999; severed.wave.nextAt = 999; severed.tower.fireCooldown = 999;
  const target = spawnEnemy(severed, "wisp", { x: 650, y: 360 });
  damageEnemy(severed, target, target.maxHp * 2, "shot");
  updateGame(severed, 0.01);
  assert.equal(severed.coinOrbs[0].value, target.reward * GAME_CONFIG.threatSeals.severedSupply.coinMultiplier);
  severed.tower.upgrades.drone = 1;
  severed.tower.droneCooldown = 0;
  severed.coinOrbs.push({ x: 350, y: 300, renderX: 350, renderY: 300, value: 5, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  updateGame(severed, 1);
  assert.equal(severed.coinOrbs.every((orb) => !orb.collector || orb.collector !== "drone"), true);
});

test("封印会给标准怪潮精英排队额外特殊遗物，而不是跳过它", () => {
  const state = createGameState(9706, undefined, { ward: true, decoy: true, lunar: true, mirror: true }, 4, undefined, ["frenzy"]);
  state.rng.next = () => 0;
  state.spawnTimer = 999; state.wave.nextAt = 999; state.tower.fireCooldown = 999;
  const elite = spawnEnemy(state, "wisp", { x: 650, y: 360 }, { elite: true, waveElite: true, waveIndex: 1 });
  damageEnemy(state, elite, elite.maxHp * 2, "shot");
  updateGame(state, 0.01);
  assert.equal(state.relicChoice?.source, "eliteWave");
  assert.deepEqual(state.relics.rewardQueue, ["sealElite"]);
  assert.ok(state.events.some((event) => event.type === "sealRelicDrop"));
  assert.equal(chooseRelic(state, state.relicChoice.choices[0]), true);
  assert.equal(state.relicChoice?.source, "sealElite");
});

test("巨兽与无伤封印分别提前首领、补发核心并强化技能代价", () => {
  const colossusState = createGameState(9707, undefined, undefined, undefined, undefined, ["colossus"]);
  colossusState.spawnTimer = 999; colossusState.wave.nextAt = 999; colossusState.tower.fireCooldown = 999;
  colossusState.time = GAME_CONFIG.threat.duration * 11 - 0.01;
  updateGame(colossusState, 0.02);
  const colossus = colossusState.enemies.find((enemy) => enemy.type === "colossus");
  assert.equal(colossusState.threat, GAME_CONFIG.threatSeals.colossus.spawnThreat);
  assert.ok(colossus);
  assert.ok(colossusState.events.some((event) => event.type === "colossusSpawn" && event.threat === GAME_CONFIG.threatSeals.colossus.spawnThreat));
  colossus.spawnShield = 0;
  damageEnemy(colossusState, colossus, colossus.maxHp * 3, "shot");
  colossus.phaseBreakInvulnerability = 0;
  damageEnemy(colossusState, colossus, colossus.maxHp * 3, "shot");
  updateGame(colossusState, 0.01);
  assert.ok(colossusState.resourceDrops.some((drop) => drop.source === "emberCore" && drop.value >= GAME_CONFIG.threatSeals.colossus.emberCoreBonus));

  const flawless = createGameState(9708, undefined, undefined, undefined, undefined, ["flawless"]);
  flawless.tower.hp = 200;
  assert.equal(useSkill(flawless, "heal"), true);
  assert.equal(flawless.skills.heal.cooldown, GAME_CONFIG.skills.heal.cooldown * GAME_CONFIG.threatSeals.flawless.healCooldownMultiplier);
  const target = spawnEnemy(flawless, "brute", { x: 650, y: 360 });
  target.hp = target.maxHp = 1_000;
  const hpBefore = target.hp;
  assert.equal(useSkill(flawless, "starfall", { angle: 0 }), true);
  assert.equal(target.hp, hpBefore - getTowerStats(flawless).damage * GAME_CONFIG.skills.starfall.damageMultiplier * GAME_CONFIG.threatSeals.flawless.skillDamageMultiplier);
});

test("永久资源倍率通过余数累计，避免低值掉落被向上取整失衡", () => {
  const state = createGameState(9709, undefined, undefined, undefined, undefined, ["longNight"]);
  const drops = Array.from({ length: 7 }, () => spawnPermanentResourceDrop(state, "echo", 2));
  assert.deepEqual(drops.map((drop) => drop.value), [2, 2, 2, 2, 2, 2, 3]);
  assert.ok(Math.abs(state.threatSeals.resourceCarry.echo - 0.12) < 1e-9);
});

test("威胁二十五开启裂隙商店并按五级威胁刷新涨价", () => {
  const state = createGameState(9801);
  state.endlessMode = true;
  state.coins = 500_000;
  assert.equal(refreshEndlessShop(state, 25), true);
  assert.equal(state.endlessShop.unlocked, true);
  assert.equal(state.endlessShop.relicOffers.length, 3);
  assert.equal(state.endlessShop.randomOffers.length, 3);
  assert.equal(getEndlessShopPrice(state, "attackProtocol"), 10_000);
  assert.equal(refreshEndlessShop(state, 30), true);
  assert.equal(getEndlessShopPrice(state, "attackProtocol"), 13_500);
  assert.equal(state.endlessShop.refreshSerial, 2);
});

test("裂隙商店重复升级、三级重置和消费计分返还生效", () => {
  const state = createGameState(9802);
  state.endlessMode = true;
  state.coins = 500_000;
  refreshEndlessShop(state, 25);
  const baseDamage = getTowerStats(state).damage;
  assert.equal(purchaseEndlessShopItem(state, "attackProtocol", getTowerStats(state)).allowed, true);
  assert.equal(getTowerStats(state).damage, baseDamage * 1.12);
  assert.equal(getEndlessShopPrice(state, "attackProtocol"), 15_500);
  assert.equal(rerollEndlessShop(state).price, 6_000);
  assert.equal(rerollEndlessShop(state).price, 12_000);
  assert.equal(rerollEndlessShop(state).price, 24_000);
  assert.equal(rerollEndlessShop(state).allowed, false);
  const expectedCoinBasis = Math.floor(state.coins + state.endlessShop.spent * 0.5);
  assert.equal(calculateRunScore(state).coinBonus, expectedCoinBasis * GAME_CONFIG.score.coinMultiplier);
});

test("永续超载、全屏星落与终焉保险按专属遗物规则工作", () => {
  const overload = createGameState(9803);
  overload.endlessMode = true;
  overload.endlessShop.equippedRelics.push("perpetualOverload");
  assert.equal(useSkill(overload, "overload"), true);
  assert.equal(overload.skills.overload.permanentEngaged, true);
  overload.skills.overload.heat = GAME_CONFIG.skills.overload.heatCap - 0.1;
  updateGame(overload, 0.1);
  assert.ok(overload.skills.overload.heat >= 30 && overload.skills.overload.heat < 31);
  assert.ok(overload.skills.overload.unstable > 1);

  const starfall = createGameState(9804);
  starfall.endlessMode = true;
  starfall.endlessShop.equippedRelics.push("globalStarfall");
  const east = spawnEnemy(starfall, "brute", { x: 700, y: 360 });
  const west = spawnEnemy(starfall, "brute", { x: 260, y: 360 });
  assert.equal(useSkill(starfall, "starfall"), true);
  assert.ok(east.hp < east.maxHp && west.hp < west.maxHp);
  assert.equal(starfall.skills.starfall.protocol, "global");

  const insurance = createGameState(9805);
  insurance.endlessMode = true;
  insurance.endlessShop.equippedRelics.push("finalInsurance");
  insurance.endlessShop.insuranceCharges = 1;
  insurance.tower.hp = 1;
  const attacker = spawnEnemy(insurance, "brute", getTowerPosition(insurance));
  attacker.damage = 10_000;
  attacker.speed = 0;
  updateGame(insurance, 0.02);
  assert.ok(insurance.tower.hp > 1);
  assert.equal(insurance.endlessShop.insuranceCharges, 0);
  assert.ok(insurance.tower.damageImmunity > 0);
});

test("无尽专属遗物栏允许装备四件并在第五件时阻止购买", () => {
  const state = createGameState(9806);
  state.endlessMode = true;
  state.coins = 1_000_000;
  refreshEndlessShop(state, 25);
  state.endlessShop.equippedRelics.push("perpetualOverload", "globalStarfall", "finalInsurance");
  state.endlessShop.relicOffers = ["goldenSingularity"];
  assert.equal(ENDLESS_SHOP_RULES.maxRelics, 4);
  assert.equal(purchaseEndlessShopItem(state, "goldenSingularity", getTowerStats(state)).allowed, true);
  assert.equal(state.endlessShop.equippedRelics.length, 4);
  state.endlessShop.relicOffers = ["apexHunter"];
  const blocked = purchaseEndlessShopItem(state, "apexHunter", getTowerStats(state));
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "专属遗物栏已满");
});

test("鎏金奇点翻倍金币结算并额外恢复技能冷却", () => {
  const state = createGameState(9807);
  state.endlessMode = true;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  state.endlessShop.equippedRelics.push("goldenSingularity");
  for (const skill of Object.values(state.skills)) skill.cooldown = 10;
  state.coinOrbs.push({ x: 220, y: 190, renderX: 220, renderY: 190, value: 20, pileCount: 1, age: 0, collectAge: 0, collector: null, droneIndex: 0 });
  assert.equal(collectCoinAt(state, 220, 190), true);
  updateGame(state, GAME_CONFIG.coins.collectDuration + 0.01);
  assert.equal(state.coins, 40);
  assert.ok(state.skills.heal.cooldown <= 10 - GAME_CONFIG.coins.collectDuration - ENDLESS_SHOP_RULES.goldenCooldownPerOrb);
});

test("时停回响阵列让手动技能联动减半其余冷却", () => {
  const state = createGameState(9808);
  state.endlessMode = true;
  state.endlessShop.equippedRelics.push("chronostasisArray");
  state.tower.hp = 100;
  state.skills.overload.cooldown = 20;
  state.skills.starfall.cooldown = 12;
  assert.equal(useSkill(state, "heal"), true);
  assert.equal(state.skills.overload.cooldown, 10);
  assert.equal(state.skills.starfall.cooldown, 6);
  assert.ok(state.events.some((event) => event.type === "endlessChronostasis" && event.affected === 2));
});

test("终末猎杀冠冕强化精英与首领伤害但不影响普通敌人", () => {
  const state = createGameState(9809);
  state.endlessMode = true;
  state.endlessShop.equippedRelics.push("apexHunter");
  const normal = spawnEnemy(state, "brute", { x: 620, y: 300 });
  const elite = spawnEnemy(state, "brute", { x: 660, y: 300 }, { elite: true });
  const boss = spawnEnemy(state, "brute", { x: 700, y: 300 });
  boss.type = "boss";
  for (const enemy of [normal, elite, boss]) enemy.hp = enemy.maxHp = 1_000;
  damageEnemy(state, normal, 100, "shot");
  damageEnemy(state, elite, 100, "shot");
  damageEnemy(state, boss, 100, "shot");
  assert.equal(normal.hp, 900);
  assert.equal(elite.hp, 825);
  assert.equal(boss.hp, 825);
});

test("棱镜主宰矩阵保证三元素附魔并强化元素附加效果", () => {
  const state = createGameState(9810);
  state.endlessMode = true;
  state.endlessShop.equippedRelics.push("prismaticSovereign");
  state.tower.upgrades.frost = 1;
  state.tower.upgrades.fire = 1;
  state.tower.upgrades.lightning = 1;
  state.rng.next = () => 0.99;
  const target = spawnEnemy(state, "brute", { x: 650, y: 360 });
  state.tower.fireCooldown = 0;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  updateGame(state, 0.01);
  assert.ok(["frost", "fire", "lightning"].includes(state.projectiles[0]?.element));

  target.freezeTimer = 0;
  assert.equal(applyElementalHit(state, target, "frost", 100), true);
  assert.equal(target.freezeTimer, GAME_CONFIG.elements.frost.freezeDuration * ENDLESS_SHOP_RULES.prismaticEffectMultiplier);
});
