import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTowerModel,getCannonPose,getModelLayout} from '../src/tower-model.js';

test('四阶各炮膛网格没有退化面、非法顶点或无效法线',()=>{
  for(const tier of [0,1,2,3]) for(const cannonRoute of ['none','siege','split']) {
    const model=buildTowerModel({tier,cannonRoute,elements:{frost:true,fire:true,lightning:true}});
    assert.equal(model.parts.length,4);
    for(const {vertices} of model.parts) {
      assert.equal(vertices.length%30,0);
      assert.ok(vertices.every(Number.isFinite));
      for(let i=0;i<vertices.length;i+=30){
        const a=vertices.slice(i,i+3),b=vertices.slice(i+10,i+13),c=vertices.slice(i+20,i+23);
        const ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]);
        const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
        assert.ok(Math.hypot(...cross)>1e-5,'晶体尖端不能由共线点组成');
        assert.ok(Math.abs(Math.hypot(...vertices.slice(i+3,i+6))-1)<1e-5);
      }
    }
  }
});

test('四阶炮口投影在所有方位与瞄准线重合，后坐不移动炮座',()=>{
  for(const tier of [0,1,2,3]) for(const route of ['none','siege','split']) for(let i=0;i<72;i++) {
    const angle=i*Math.PI/36,layout=getModelLayout(tier);
    const idle=getCannonPose(tier,angle,0,route),firing=getCannonPose(tier,angle,.28,route);
    for(const pose of [idle,firing]) {
      const dx=pose.muzzleX,dy=pose.muzzleY-layout.mountY;
      assert.ok(Math.abs(dx*Math.sin(angle)-dy*Math.cos(angle))<1e-8);
      assert.ok(dx*Math.cos(angle)+dy*Math.sin(angle)>0);
      assert.ok(Math.abs(38-.8*layout.mountHeight-layout.mountY)<1e-8);
    }
    assert.ok(Math.hypot(firing.muzzleX,firing.muzzleY-layout.mountY)<Math.hypot(idle.muzzleX,idle.muzzleY-layout.mountY));
  }
});

test('八种挂载模型有独立实体，移动旋转强化会重建几何，拆卸不残留', async()=>{
  const {MODULES}=await import('../src/modules.js');
  for(const id of Object.keys(MODULES)) for(const tier of [0,3]) {
    const modules=[{id,slot:0,rotation:0,level:1}];
    const first=buildTowerModel({tier,modules});
    const part=first.parts.find(p=>p.name===`module-${id}`);
    assert.ok(part.vertices.length>300);
    for(const {vertices} of first.parts) {
      assert.ok(vertices.every(Number.isFinite));
      for(let i=0;i<vertices.length;i+=30) {
        const ab=[0,1,2].map(k=>vertices[i+10+k]-vertices[i+k]);
        const ac=[0,1,2].map(k=>vertices[i+20+k]-vertices[i+k]);
        assert.ok(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])>1e-5);
        assert.ok(Math.abs(Math.hypot(...vertices.slice(i+3,i+6))-1)<1e-5);
      }
    }
    for(const change of [{slot:3},{rotation:1},{level:3}]) {
      const next=buildTowerModel({tier,modules:[{...modules[0],...change}]}).parts.find(p=>p.name===`module-${id}`);
      assert.notDeepEqual(next.vertices,part.vertices);
    }
    assert.equal(buildTowerModel({tier,modules:[]}).parts.some(p=>p.name===`module-${id}`),false);
  }
});

test('模型缓存随模块布局变化刷新，不受金币等战斗状态影响', async()=>{
  const {TowerModelRenderer}=await import('../src/tower-model.js');
  const renderer=new TowerModelRenderer();
  const visual={tier:0,modules:[{id:'cannon',slot:0,rotation:0,level:1}]};
  renderer.prepare(visual);const first=renderer.model;
  renderer.prepare({...visual,coins:200});assert.equal(renderer.model,first);
  renderer.prepare({...visual,modules:[{...visual.modules[0],slot:3}]});assert.notEqual(renderer.model,first);
  renderer.prepare({...visual,modules:[]});assert.equal(renderer.model.parts.length,5);
});

test('实际装配状态进入塔身渲染，换位强化和拆卸即时反映', async()=>{
  const {createGameState}=await import('../src/engine.js');
  const {getTowerVisualState}=await import('../src/renderer.js');
  const {installModule,moveModule,upgradeModule,removeModule}=await import('../src/modules.js');
  const state=createGameState(23);state.coins=1000;state.paused=true;
  assert.ok(installModule(state,'hangar',2,1));
  let visual=getTowerVisualState(state);
  assert.deepEqual(visual.modules.find(m=>m.id==='hangar'),{id:'hangar',slot:2,rotation:1,level:1});
  assert.ok(buildTowerModel(visual).parts.some(p=>p.name==='module-hangar'));
  assert.ok(moveModule(state,5,3,0));assert.ok(upgradeModule(state,3));
  visual=getTowerVisualState(state);
  assert.deepEqual(visual.modules.find(m=>m.id==='hangar'),{id:'hangar',slot:3,rotation:0,level:2});
  assert.ok(removeModule(state,4));
  assert.equal(buildTowerModel(getTowerVisualState(state)).parts.some(p=>p.name==='module-hangar'),false);
});

test('圆塔保持完整主体，附件沿六个塔身扇区挂载', async()=>{
  const {getModuleMount}=await import('../src/module-model.js');
  for(const tier of [0,1,2,3]) {
    const layout=getModelLayout(tier);
    const bare=buildTowerModel({tier,modules:[]});
    const armed=buildTowerModel({tier,modules:[{id:'cannon',slot:0,level:1}]});
    assert.equal(bare.parts.find(p=>p.name==='turret').vertices.length,0);
    assert.equal(armed.parts.find(p=>p.name==='barrel').vertices.length,0);
    assert.deepEqual(bare.parts[0].vertices,armed.parts[0].vertices);
    const original=buildTowerModel({tier,cannonEnabled:false}).parts[0].vertices;
    assert.deepEqual(bare.parts[0].vertices.slice(0,original.length),original);
    const sockets=Array.from({length:6},(_,slot)=>getModuleMount({id:'pulse',slot},layout));
    assert.equal(new Set(sockets.map(p=>`${p.x}:${p.z}`)).size,6);
    for(const p of sockets) assert.ok(Math.hypot(p.x,p.z)>layout.radius);
    assert.ok(sockets[0].z<0);assert.ok(sockets[3].z>0);
    const horizontal=getModuleMount({id:'cannon',slot:1,rotation:0},layout);
    const vertical=getModuleMount({id:'cannon',slot:1,rotation:1},layout);
    assert.equal(vertical.x,horizontal.x);assert.equal(vertical.z,horizontal.z);
    assert.ok(Math.abs(vertical.yaw-horizontal.yaw-Math.PI/2)<1e-9);
  }
});

test('炮组独立于安装底盘转向，开火后坐的炮口与旋转位置一致', async()=>{
  const {getMountedMuzzle}=await import('../src/tower-model.js');
  for(const id of ['pulse','cannon']) for(const rotation of [0,1]) {
    const module={id,slot:1,rotation,level:2};
    const model=buildTowerModel({modules:[module]});
    const gun=model.parts.find(p=>p.name===`gun-${id}`),base=model.parts.find(p=>p.name===`module-${id}`);
    assert.ok(gun.aim);assert.equal(gun.weapon,id);assert.equal(base.aim,undefined);
    assert.equal(gun.pivot.length,3);assert.ok(gun.vertices.every(Number.isFinite));
    for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
      const idle=getMountedMuzzle(module,0,angle,0),shot=getMountedMuzzle(module,0,angle,.28);
      assert.ok(Math.hypot(idle.muzzleX-shot.muzzleX,idle.muzzleY-shot.muzzleY)>2);
      assert.ok(Number.isFinite(shot.muzzleX)&&Number.isFinite(shot.muzzleY));
    }
  }
});
