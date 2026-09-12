import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState} from '../src/engine.js';
import {installModule,moveModule,moduleAt,moduleMoveStatus} from '../src/modules.js';

test('拥挤装配允许合法交换，保留投入与金币',()=>{
  const s=createGameState(1);s.coins=2000;
  assert.ok(installModule(s,'cannon',1));assert.ok(installModule(s,'blade',3));assert.ok(installModule(s,'shield',5));
  const coins=s.coins,pulse=structuredClone(moduleAt(s,0));
  assert.equal(moduleMoveStatus(s,'pulse',5).swap,'shield');assert.ok(moveModule(s,0,5));
  assert.equal(moduleAt(s,0).id,'shield');assert.deepEqual(moduleAt(s,5),{...pulse,slot:5,rotation:0});
  assert.ok(moveModule(s,1,3));assert.equal(moduleAt(s,3).id,'cannon');assert.equal(moduleAt(s,1).id,'blade');assert.equal(s.coins,coins);
});
test('交换不能挤压第三件模块或绕过重整冷却',()=>{
  const s=createGameState(1);s.coins=2000;
  assert.ok(installModule(s,'cannon',1));assert.ok(installModule(s,'shield',3));
  const before=structuredClone(s.tower.moduleBay);
  assert.equal(moveModule(s,1,0),false);assert.deepEqual(s.tower.moduleBay,before);
  s.tower.moduleBay.refitCooldown=8;assert.equal(moveModule(s,0,3),false);
});
