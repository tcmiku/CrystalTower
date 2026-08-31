import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config.js';
import { CHAPTER_TWO_CONFIG, CHAPTER_TWO_TECH_ORDER } from '../src/chapter-two.js';
import { createGameState, damageEnemy, getChapterTwoDroneAmmoMax, getDroneEnergyMax, getTechStatus, getTowerStats, purchaseUpgrade, setTargetProtocol, spawnEnemy, toggleDroneMode, updateGame } from '../src/engine.js';
import { defaultSave, grantChapterCoreEnergy, repairChapterNode, sanitizeSave } from '../src/storage.js';

function createChapterTwo(seed = 71) {
  return createGameState(seed, { damage: 0, health: 0, income: 0 }, { ward: true }, 1, {}, [], {}, 2);
}

test('第二章以无人机航母构筑开局且舰载机默认主动出击', () => {
  const state = createChapterTwo();
  assert.equal(state.chapter, 2);
  assert.equal(state.tower.upgrades.drone, 3);
  assert.equal(state.tower.upgrades.autoCollect, 1);
  assert.equal(state.tower.upgrades.droneBattery, 1);
  assert.equal(getDroneEnergyMax(state), 156.25);
  assert.equal(state.tower.droneMode, 'attack');
  assert.equal(state.tower.targetProtocol, 'radar');
  assert.equal(toggleDroneMode(state), true);
  assert.equal(state.tower.droneMode, 'collect');
});

test('第二章让同构筑舰载无人机承担更高输出', () => {
  const chapterOne = createGameState(19);
  Object.assign(chapterOne.tower.upgrades, CHAPTER_TWO_CONFIG.starterUpgrades);
  chapterOne.tower.droneEnergy = getDroneEnergyMax(chapterOne);
  const chapterTwo = createChapterTwo(19);
  assert.ok(getTowerStats(chapterTwo).damage < getTowerStats(chapterOne).damage);

  for (const state of [chapterOne, chapterTwo]) {
    state.spawnTimer = 999;
    state.wave.nextAt = 999;
    state.tower.fireCooldown = 999;
    if (state.chapter === 1) toggleDroneMode(state);
    state.testTarget = spawnEnemy(state, 'brute', { x: 480, y: 155 });
    for (let step = 0; step < 150; step += 1) updateGame(state, GAME_CONFIG.fixedStep);
  }
  const chapterOneTarget = chapterOne.testTarget;
  const chapterTwoTarget = chapterTwo.testTarget;
  const chapterOneLoss = chapterOneTarget.maxHp - chapterOneTarget.hp;
  const chapterTwoLoss = chapterTwoTarget.maxHp - chapterTwoTarget.hp;
  assert.ok(chapterTwoLoss > chapterOneLoss * 1.5);
});

test('第二章航母不会主动开火且常规输出由无人机承担', () => {
  const state = createChapterTwo(23);
  state.spawnTimer = state.wave.nextAt = 999;
  state.tower.droneMode = 'collect';
  const target = spawnEnemy(state, 'brute', { x: GAME_CONFIG.arena.centerX + 120, y: GAME_CONFIG.arena.centerY });
  target.speed = 0;

  for (let step = 0; step < 120; step += 1) updateGame(state, GAME_CONFIG.fixedStep);

  assert.equal(state.projectiles.length, 0);
  assert.equal(state.events.some((event) => event.type === 'shoot'), false);
  assert.equal(target.hp, target.maxHp);
});

test('极夜航道在威胁 XII 清空海面并生成渊潮王舰终局', () => {
  const state = createChapterTwo(31);
  state.threat = CHAPTER_TWO_CONFIG.finalThreat - 1;
  state.time = (CHAPTER_TWO_CONFIG.finalThreat - 1) * GAME_CONFIG.threat.duration - GAME_CONFIG.fixedStep / 2;
  state.spawnTimer = 999;
  state.wave.nextAt = 999;
  updateGame(state, GAME_CONFIG.fixedStep);
  assert.equal(state.threat, CHAPTER_TWO_CONFIG.finalThreat);
  const sovereign = state.enemies.find((enemy) => enemy.type === 'sovereign');
  assert.ok(sovereign);
  const unscaledHealth = GAME_CONFIG.enemies.sovereign.hp * GAME_CONFIG.threat.hpGrowth ** (state.threat - 1);
  assert.equal(sovereign.maxHp, unscaledHealth * CHAPTER_TWO_CONFIG.sovereignHealthMultiplier);
  assert.equal(state.enemies.some((enemy) => enemy.type === 'colossus'), false);
});

test('第二章核心能源、战绩与后续节点能够安全保存', () => {
  const save = defaultSave();
  save.campaign.coreEnergy[1] = true;
  save.campaign.repairedNodes[1] = true;
  save.campaign.unlockedChapters[2] = true;
  assert.equal(grantChapterCoreEnergy(save, 2, { time: 520, kills: 180, score: 42000 }), true);
  assert.equal(grantChapterCoreEnergy(save, 2, { time: 600, kills: 220, score: 51000 }), false);
  assert.equal(save.campaign.chapterRecords[2].clears, 2);
  assert.equal(save.campaign.chapterRecords[2].bestScore, 51000);
  assert.equal(repairChapterNode(save, 2), true);
  const sanitized = sanitizeSave(save);
  assert.equal(sanitized.campaign.coreEnergy[2], true);
  assert.equal(sanitized.campaign.repairedNodes[2], true);
  assert.equal(sanitized.campaign.unlockedChapters[3], true);
});

test('两章科技目录完全隔离且第二章机库可以扩编到七架', () => {
  const chapterOne = createGameState(88);
  const chapterTwo = createChapterTwo(88);
  chapterOne.coins = chapterTwo.coins = 100000;
  chapterOne.threat = chapterTwo.threat = 12;
  assert.equal(getTechStatus(chapterTwo, 'damage').reason, '未知科技');
  assert.equal(getTechStatus(chapterOne, 'dronePayload').reason, '未知科技');
  assert.equal(purchaseUpgrade(chapterTwo, 'damage'), false);
  assert.equal(purchaseUpgrade(chapterOne, 'dronePayload'), false);
  while (purchaseUpgrade(chapterTwo, 'drone')) {}
  assert.equal(chapterTwo.tower.upgrades.drone, 7);
  assert.equal(CHAPTER_TWO_TECH_ORDER.length, 16);
});

test('重型载荷与矢量加力会实际提高舰载机输出', () => {
  const run = (enhanced) => {
    const state = createChapterTwo(93);
    state.threat = 8;
    state.spawnTimer = state.wave.nextAt = 999;
    state.tower.fireCooldown = 999;
    if (enhanced) Object.assign(state.tower.upgrades, { dronePayload: 3, droneAfterburner: 3 });
    state.tower.droneEnergy = getDroneEnergyMax(state);
    const target = spawnEnemy(state, 'brute', { x: GAME_CONFIG.arena.centerX + GAME_CONFIG.coins.droneOrbitRadius, y: GAME_CONFIG.arena.centerY });
    target.speed = 0;
    const events = [];
    for (let step = 0; step < 240; step += 1) {
      updateGame(state, GAME_CONFIG.fixedStep);
      events.push(...state.events);
    }
    return { damage: target.maxHp - target.hp, maxShot: Math.max(...events.filter((event) => event.type === 'droneWeapon').map((event) => event.damage), 0) };
  };
  const normal = run(false);
  const enhanced = run(true);
  assert.ok(enhanced.damage > normal.damage);
  assert.ok(enhanced.maxShot > normal.maxShot);
});

test('能源中继提高护航充能，协同齐射每四次命中触发', () => {
  const base = createChapterTwo(101);
  const relayed = createChapterTwo(101);
  for (const state of [base, relayed]) {
    state.spawnTimer = state.wave.nextAt = 999;
    state.tower.fireCooldown = 999;
    state.tower.droneEnergy = 0;
  }
  relayed.tower.upgrades.droneRelay = 3;
  for (let step = 0; step < 60; step += 1) {
    updateGame(base, GAME_CONFIG.fixedStep);
    updateGame(relayed, GAME_CONFIG.fixedStep);
  }
  assert.ok(relayed.tower.droneEnergy > base.tower.droneEnergy * 1.7);

  const salvo = createChapterTwo(102);
  salvo.spawnTimer = salvo.wave.nextAt = 999;
  salvo.tower.fireCooldown = 999;
  salvo.tower.upgrades.droneSalvo = 1;
  salvo.tower.droneEnergy = getDroneEnergyMax(salvo);
  const target = spawnEnemy(salvo, 'sentinel', { x: GAME_CONFIG.arena.centerX + GAME_CONFIG.coins.droneOrbitRadius, y: GAME_CONFIG.arena.centerY });
  target.speed = 0;
  target.hp = target.maxHp = 100000;
  let fired = false;
  for (let step = 0; step < 300 && !fired; step += 1) {
    updateGame(salvo, GAME_CONFIG.fixedStep);
    fired = salvo.events.some((event) => event.type === 'droneSalvo' && event.hits >= 1);
  }
  assert.equal(fired, true);
});

test('甲板维修响应无人机击沉，低能超频以额外耗能换取伤害', () => {
  const repair = createChapterTwo(109);
  repair.spawnTimer = repair.wave.nextAt = 999;
  repair.tower.fireCooldown = 999;
  repair.tower.upgrades.droneRepair = 1;
  repair.tower.hp = getTowerStats(repair).maxHp * 0.5;
  const damagedHp = repair.tower.hp;
  for (let index = 0; index < 5; index += 1) {
    const enemy = spawnEnemy(repair, 'wisp', { x: 100 + index * 30, y: 100 });
    enemy.hp = 1;
    damageEnemy(repair, enemy, 2, 'drone');
    updateGame(repair, GAME_CONFIG.fixedStep);
  }
  assert.ok(repair.tower.hp > damagedHp);
  assert.ok(repair.events.some((event) => event.type === 'droneRepair'));

  const run = (overdrive) => {
    const state = createChapterTwo(110);
    state.spawnTimer = state.wave.nextAt = 999;
    state.tower.fireCooldown = 999;
    state.tower.upgrades.droneOverdrive = Number(overdrive);
    state.tower.droneEnergy = getDroneEnergyMax(state) * 0.34;
    const target = spawnEnemy(state, 'sentinel', { x: GAME_CONFIG.arena.centerX + GAME_CONFIG.coins.droneOrbitRadius, y: GAME_CONFIG.arena.centerY });
    target.speed = 0;
    target.hp = target.maxHp = 100000;
    for (let step = 0; step < 180; step += 1) updateGame(state, GAME_CONFIG.fixedStep);
    return { damage: target.maxHp - target.hp, energy: state.tower.droneEnergy };
  };
  const normal = run(false);
  const boosted = run(true);
  assert.ok(boosted.damage > normal.damage * 1.4);
  assert.ok(boosted.energy < normal.energy);
});

test('舰载机完成离舰编队开火返航补给并再次出击的循环', () => {
  const state = createChapterTwo(116);
  state.spawnTimer = state.wave.nextAt = 999;
  const target = spawnEnemy(state, 'sentinel', { x: GAME_CONFIG.arena.centerX + 210, y: GAME_CONFIG.arena.centerY });
  target.speed = 0;
  target.hp = target.maxHp = 100000;

  const observedEvents = [];
  for (let step = 0; step < 1400; step += 1) {
    updateGame(state, GAME_CONFIG.fixedStep);
    observedEvents.push(...state.events);
  }

  const firstDroneLaunches = observedEvents.filter((event) => event.type === 'droneLaunch' && event.droneIndex === 0);
  assert.ok(firstDroneLaunches.length >= 2);
  assert.ok(observedEvents.some((event) => event.type === 'droneFormation' && event.droneIndex === 0));
  assert.ok(observedEvents.some((event) => event.type === 'droneWeapon' && event.droneIndex === 0));
  assert.ok(observedEvents.some((event) => event.type === 'droneLanded' && event.droneIndex === 0));
  assert.ok(observedEvents.some((event) => event.type === 'droneRearmed' && event.droneIndex === 0));
});

test('移动敌舰不会让无人机永久卡在出航阶段且载弹上限可查询', () => {
  const state = createChapterTwo(117);
  state.spawnTimer = state.wave.nextAt = 999;
  state.tower.upgrades.drone = 1;
  const target = spawnEnemy(state, 'inkHound', { x: GAME_CONFIG.arena.centerX + 240, y: GAME_CONFIG.arena.centerY });
  target.speed = 0;
  target.hp = target.maxHp = 100_000;

  updateGame(state, GAME_CONFIG.fixedStep);
  const drone = state.drones[0];
  assert.equal(drone.phase, 'outbound');
  const observedEvents = [];
  for (let step = 0; step < 180; step += 1) {
    if (drone.phase === 'outbound') {
      target.x = drone.x - Math.cos(drone.formationAngle) * 120;
      target.y = drone.y - Math.sin(drone.formationAngle) * 120;
    }
    updateGame(state, GAME_CONFIG.fixedStep);
    observedEvents.push(...state.events);
  }

  assert.ok(observedEvents.some((event) => event.type === 'droneFormation'));
  assert.ok(observedEvents.some((event) => event.type === 'droneWeapon'));
  assert.equal(getChapterTwoDroneAmmoMax(state, 'fighter'), 5);
  state.tower.upgrades.dronePayload = 3;
  assert.equal(getChapterTwoDroneAmmoMax(state, 'bomber'), 4);
});

test('战斗机攻击机和轰炸机会选择各自擅长的敌舰', () => {
  const state = createChapterTwo(118);
  state.spawnTimer = state.wave.nextAt = 999;
  Object.assign(state.tower.upgrades, { droneHunt: 1, dronePayload: 1 });
  const runner = spawnEnemy(state, 'runner', { x: 760, y: 250 });
  const brute = spawnEnemy(state, 'brute', { x: 720, y: 360 });
  const boss = spawnEnemy(state, 'boss', { x: 780, y: 470 });
  runner.speed = brute.speed = boss.speed = 0;

  updateGame(state, GAME_CONFIG.fixedStep);

  assert.deepEqual(state.drones.map((drone) => drone.droneClass), ['fighter', 'attacker', 'bomber']);
  assert.equal(state.drones[0].targetId, runner.id);
  assert.equal(state.drones[1].targetId, brute.id);
  assert.equal(state.drones[2].targetId, boss.id);
});

test('集中打击让全部舰载机锁定同一高威胁目标', () => {
  const state = createChapterTwo(119);
  state.spawnTimer = state.wave.nextAt = 999;
  Object.assign(state.tower.upgrades, { droneHunt: 1, dronePayload: 1 });
  spawnEnemy(state, 'runner', { x: 700, y: 220 }).speed = 0;
  spawnEnemy(state, 'brute', { x: 720, y: 360 }).speed = 0;
  const boss = spawnEnemy(state, 'boss', { x: 700, y: 500 });
  boss.speed = 0;
  setTargetProtocol(state, 'hunter');

  updateGame(state, GAME_CONFIG.fixedStep);

  assert.deepEqual(state.drones.map((drone) => drone.targetId), [boss.id, boss.id, boss.id]);
});

test('分散清扫为舰载机分配不同目标以减少火力浪费', () => {
  const state = createChapterTwo(120);
  state.spawnTimer = state.wave.nextAt = 999;
  Object.assign(state.tower.upgrades, { droneHunt: 1, dronePayload: 1 });
  for (const [type, x] of [['wisp', 680], ['runner', 720], ['crawler', 760]]) spawnEnemy(state, type, { x, y: 300 }).speed = 0;
  setTargetProtocol(state, 'breach');

  updateGame(state, GAME_CONFIG.fixedStep);

  assert.equal(new Set(state.drones.map((drone) => drone.targetId)).size, 3);
});

test('航母护航只拦截进入警戒圈的敌舰', () => {
  const state = createChapterTwo(122);
  state.spawnTimer = state.wave.nextAt = 999;
  const intruder = spawnEnemy(state, 'runner', { x: GAME_CONFIG.arena.centerX + 180, y: GAME_CONFIG.arena.centerY });
  const distant = spawnEnemy(state, 'boss', { x: GAME_CONFIG.arena.centerX + 430, y: GAME_CONFIG.arena.centerY });
  intruder.speed = distant.speed = 0;
  setTargetProtocol(state, 'guard');

  updateGame(state, GAME_CONFIG.fixedStep);

  assert.ok(state.drones.every((drone) => drone.targetId === intruder.id));
  assert.ok(state.drones.every((drone) => drone.targetId !== distant.id));
});

test('航母回收甲板在无人机强袭时独立收取金币', () => {
  const state = createChapterTwo(121);
  state.spawnTimer = state.wave.nextAt = 999;
  state.tower.fireCooldown = 999;
  state.tower.droneCooldown = 0;
  state.coinOrbs.push({ x: 240, y: 180, renderX: 240, renderY: 180, value: 10, age: 0, collectAge: 0, collector: null, droneIndex: 0 });

  updateGame(state, GAME_CONFIG.fixedStep);
  assert.equal(state.tower.droneMode, 'attack');
  assert.equal(state.coinOrbs[0].collector, 'carrier');

  for (let step = 0; step < 40; step += 1) updateGame(state, GAME_CONFIG.fixedStep);
  assert.equal(state.coinOrbs.length, 0);
  assert.equal(state.coins, 10);
});
