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
