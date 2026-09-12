import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildBladeModel,BladeModelRenderer} from '../src/blade-model.js';
import {buildEnemyModel,EnemyModelRenderer,ENEMY_MODEL_TYPES} from '../src/enemy-model.js';
import {MODULES} from '../src/modules.js';
import {getModelLayout} from '../src/tower-model.js';
import {sampleModuleEffects,recordModuleAttack,MODULE_ATTACK_DURATION} from '../src/module-effects.js';

const types=['inkHound','orbitMote','rustBeetle'];
test('crystal blade and three new mobs have distinct, finite 3D meshes and valid exported geometry',async()=>{
  const meshes=[];
  for(const type of ['blade',...types]) {
    const build=()=>type==='blade'?buildBladeModel():buildEnemyModel(type);
    const vertices=build().parts[0].vertices;
    assert.deepEqual(vertices,build().parts[0].vertices);
    assert.ok(vertices.length>3000 && vertices.length<40000);
    assert.equal(vertices.length%30,0);
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<vertices.length;i+=10) {
      assert.ok(vertices.slice(i,i+10).every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...vertices.slice(i+3,i+6))-1)<1e-5);
      for(let j=0;j<3;j++){min[j]=Math.min(min[j],vertices[i+j]);max[j]=Math.max(max[j],vertices[i+j]);}
    }
    for(let j=0;j<3;j++) assert.ok(max[j]-min[j]>10,'models must have real depth');
    for(let i=0;i<vertices.length;i+=30) {
      const ab=[0,1,2].map(j=>vertices[i+10+j]-vertices[i+j]),ac=[0,1,2].map(j=>vertices[i+20+j]-vertices[i+j]);
      assert.ok(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])>1e-5);
    }
    for(const previous of meshes) assert.notDeepEqual(vertices,previous);
    meshes.push(vertices);
    const file=await readFile(new URL(`../assets/models/${type==='blade'?'crystal-blade':`enemy-${type}`}.glb`,import.meta.url));
    assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.readUInt32LE(4),2);assert.equal(file.readUInt32LE(8),file.length);
    const jsonLength=file.readUInt32LE(12),gltf=JSON.parse(file.subarray(20,20+jsonLength));
    assert.equal(gltf.accessors[0].count,vertices.length/10);
    assert.deepEqual(file.subarray(28+jsonLength),Buffer.from(vertices.buffer));
  }
  for(const type of types) assert.ok(ENEMY_MODEL_TYPES.includes(type));
});

test('new models draw without WebGL and flying blades retain cached geometry',()=>{
  let faces=0;
  const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{if(k==='fill')faces++},set:(o,k,v)=>(o[k]=v,true)});
  const blade=new BladeModelRenderer(),enemy=new EnemyModelRenderer();
  blade.drawBlade(ctx,.2,0);const mesh=blade.model;
  blade.drawBlade(ctx,2,1,1.5,true,1);assert.equal(blade.model,mesh);
  for(const type of types) enemy.drawEnemy(ctx,{type,x:0,y:0,id:1,radius:17},.5,1);
  assert.ok(faces>2500);blade.dispose();enemy.dispose();
});

test('combat events trigger only the matching module; idle and irrelevant events do not fire',()=>{
  const cases=[['pulse',{type:'shoot',weaponId:'pulse'}],['cannon',{type:'shoot',weaponId:'cannon'}],['blade',{type:'hit',source:'saw'}],['hangar',{type:'droneHit'}],['shield',{type:'sectorBlock',prevented:4}],...['frost','fire','lightning'].map(element=>[element,{type:'elementHit',element}])];
  for(const [id,event] of cases) {
    const fx={},before=structuredClone(event);recordModuleAttack(fx,event);
    assert.deepEqual(fx,{[`attack-${id}`]:MODULE_ATTACK_DURATION});assert.deepEqual(event,before);
    for(let i=0;i<100;i++)recordModuleAttack(fx,event);
    assert.deepEqual(fx,{[`attack-${id}`]:MODULE_ATTACK_DURATION});
  }
  const fx={};for(const event of [{type:'coin'},{type:'towerHit',mitigated:40},{type:'sectorBlock',prevented:0},{type:'shoot',weaponId:null},{type:'hit',source:'burn'}])recordModuleAttack(fx,event);
  assert.deepEqual(fx,{});
});

test('attack bursts are bounded, fade back to idle and follow individual gun aim',()=>{
  const layout=getModelLayout(2);
  for(const id of Object.keys(MODULES)) {
    const module={id,slot:3,rotation:1,level:3},before=structuredClone(module);
    const idle=sampleModuleEffects(module,layout,1,.2);
    const active=sampleModuleEffects(module,layout,1,.2,.4);
    assert.ok(active.length>idle.length);
    assert.notDeepEqual(active,sampleModuleEffects(module,layout,1,.2,.1));
    assert.deepEqual(idle,sampleModuleEffects(module,layout,1,.2,0));
    for(const time of [0,1,10000]) for(const attack of [-1,0,.1,.45,100]) {
      const effects=sampleModuleEffects(module,layout,time,.2,attack);
      assert.ok(effects.length<=16);
      for(const effect of effects){assert.ok(effect.alpha>=0&&effect.alpha<=1);assert.ok(effect.points.length<=25);assert.ok(effect.points.flat().every(Number.isFinite));}
    }
    assert.deepEqual(module,before);
    if(['pulse','cannon'].includes(id))assert.notDeepEqual(active,sampleModuleEffects(module,layout,1,1.7,.4));
  }
});
