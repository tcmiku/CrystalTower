import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../src/modules.js';
import { getModelLayout, buildTowerModel } from '../src/tower-model.js';
import { sampleModuleEffects } from '../src/module-effects.js';

test('八种模块特效有界、确定、连续更新且不修改装配状态',()=>{
  for(const id of Object.keys(MODULES)) {
    const module={id,slot:3,rotation:1,level:3},before=structuredClone(module);
    const layout=getModelLayout(3),first=sampleModuleEffects(module,layout,.4);
    assert.ok(first.length>0&&first.length<=9);
    assert.deepEqual(first,sampleModuleEffects(module,layout,.4));
    assert.notDeepEqual(first,sampleModuleEffects(module,layout,.8));
    for(const time of [0,.4,10000]) for(const effect of sampleModuleEffects(module,layout,time)) {
      assert.ok(effect.alpha>=0&&effect.alpha<=1);
      assert.ok(effect.points.length<=25);
      assert.ok(effect.points.flat().every(Number.isFinite));
    }
    assert.deepEqual(module,before);
    assert.notDeepEqual(first,sampleModuleEffects({...module,slot:1},layout,.4));
  }
});
test('环刃转子独立旋转，拆卸后没有残留部件',()=>{
  const model=buildTowerModel({modules:[{id:'blade',slot:3,level:1}]});
  assert.equal(model.parts.find(p=>p.name==='rotor-blade').spin,6);
  assert.equal(model.parts.find(p=>p.name==='module-blade').spin,undefined);
  assert.equal(buildTowerModel({modules:[]}).parts.some(p=>p.name==='rotor-blade'),false);
});
