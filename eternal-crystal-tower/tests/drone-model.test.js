import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDroneModel,DRONE_MODES,DroneModelRenderer} from '../src/drone-model.js';
test('all drone modes have deterministic valid colored geometry',()=>{
  for(const mode of DRONE_MODES){
    const a=buildDroneModel(mode).parts[0].vertices;
    assert.deepEqual(a,buildDroneModel(mode).parts[0].vertices);
    assert.equal(a.length%30,0);assert.ok(a.length>1000);assert.ok(a.every(Number.isFinite));
    for(let i=0;i<a.length;i+=10){assert.ok(Math.abs(Math.hypot(a[i+3],a[i+4],a[i+5])-1)<1e-5);for(let j=6;j<10;j++)assert.ok(a[i+j]>=0&&a[i+j]<=1);}
  }
  assert.notDeepEqual(buildDroneModel('collect'),buildDroneModel('attack'));
});
test('drone supports software drawing and state changes',()=>{
  let faces=0;const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{if(k==='fill')faces++},set:(o,k,v)=>(o[k]=v,true)});
  const r=new DroneModelRenderer();for(const mode of DRONE_MODES)r.drawDrone(ctx,mode,1,2);
  assert.ok(faces>100);r.dispose();
});
