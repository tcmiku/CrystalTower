import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config.js';
import { CHAPTER_TWO_CONFIG, CHAPTER_TWO_TECH_ORDER } from '../src/chapter-two.js';
import { createGameState, damageEnemy, getDroneEnergyMax, getTechStatus, getTowerStats, purchaseUpgrade, spawnEnemy, toggleDroneMode, updateGame } from '../src/engine.js';
import { defaultSave, grantChapterCoreEnergy, repairChapterNode, sanitizeSave } from '../src/storage.js';

function createChapterTwo(seed = 71) {
  return createGameState(seed, { damage: 0, health: 0, income: 0 }, { ward: true }, 1, {}, [], {}, 2);
}

test('第二章以无人机航母构筑开局并立即允许护航与强袭切换', () => {
  const state = createChapterTwo();
  assert.equal(state.chapter, 2);
  assert.equal(state.tower.upgrades.drone, 3);
  assert.equal(state.tower.upgrades.autoCollect, 1);
  assert.equal(state.tower.upgrades.droneBattery, 1);
  assert.equal(getDroneEnergyMax(state), 156.25);
  assert.equal(toggleDroneMode(state), true);
  assert.equal(state.tower.droneMode, 'attack');
});

test('第二章削弱航母炮组并让同构筑无人机承担更高输出', () => {
  const chapterOne = createGameState(19);
  Object.assign(chapterOne.tower.upgrades, CHAPTER_TWO_CONFIG.starterUpgrades);
  chapterOne.tower.droneEnergy = getDroneEnergyMax(chapterOne);
  const chapterTwo = createChapterTwo(19);
  assert.ok(getTowerStats(chapterTwo).damage < getTowerStats(chapterOne).damage);

  for (const state of [chapterOne, chapterTwo]) {
    state.spawnTimer = 999;
    state.wave.nextAt = 999;
    state.tower.fireCooldown = 999;
    toggleDroneMode(state);
    spawnEnemy(state, 'brute', { x: 480, y: 155 });
    for (let step = 0; step < 150; step += 1) updateGame(state, GAME_CONFIG.fixedStep);
  }
  const chapterOneTarget = chapterOne.enemies.find((enemy) => enemy.type === 'brute');
  const chapterTwoTarget = chapterTwo.enemies.find((enemy) => enemy.type === 'brute');
  const chapterOneLoss = chapterOneTarget.maxHp - chapterOneTarget.hp;
  const chapterTwoLoss = chapterTwoTarget.maxHp - chapterTwoTarget.hp;
  assert.ok(chapterTwoLoss > chapterOneLoss * 1.5);
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
    toggleDroneMode(state);
    const target = spawnEnemy(state, 'brute', { x: GAME_CONFIG.arena.centerX + GAME_CONFIG.coins.droneOrbitRadius, y: GAME_CONFIG.arena.centerY });
    target.speed = 0;
    for (let step = 0; step < 240; step += 1) updateGame(state, GAME_CONFIG.fixedStep);
    return target.maxHp - target.hp;
  };
  assert.ok(run(true) > run(false) * 1.45);
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
  toggleDroneMode(salvo);
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
    toggleDroneMode(state);
    const target = spawnEnemy(state, 'sentinel', { x: GAME_CONFIG.arena.centerX + GAME_CONFIG.coins.droneOrbitRadius, y: GAME_CONFIG.arena.centerY });
    target.speed = 0;
    target.hp = target.maxHp = 100000;
    for (let step = 0; step < 50; step += 1) updateGame(state, GAME_CONFIG.fixedStep);
    return { damage: target.maxHp - target.hp, energy: state.tower.droneEnergy };
  };
  const normal = run(false);
  const boosted = run(true);
  assert.ok(boosted.damage > normal.damage * 1.4);
  assert.ok(boosted.energy < normal.energy);
});
