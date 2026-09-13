import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, updateGame, spawnEnemy, getTowerPosition, getTowerStats, getDroneEnergyMax, getTechStatus, toggleDroneMode, offerRelicChoice, chooseRelic, snapshotState, damageTower } from '../src/engine.js';
import { installModule, removeModule, moveModule, upgradeModule, installedModule, specializeModule, occupiedSlots, MODULE_BALANCE, setModuleFacing } from '../src/modules.js';
import { buildTowerModel } from '../src/tower-model.js';
import { recordModuleAttack, sampleModuleEffects } from '../src/module-effects.js';

function arena(seed = 83) {
  const s = createGameState(seed);
  removeModule(s, 0); s.coins = 10000; s.spawnTimer = s.wave.nextAt = 99999;
  return s;
}
function advance(s, seconds, observe = () => {}) {
  for(let i=0;i<Math.round(seconds*60);i++){updateGame(s,1/60);observe(s);}
}
function enemy(s, dx=0, dy=-250, type='brute') {
  const p=getTowerPosition(s), e=spawnEnemy(s,type,{x:p.x+dx,y:p.y+dy});
  Object.assign(e,{hp:10000,maxHp:10000,speed:0,damage:0,attackCooldown:999});
  return e;
}
function bolt(s, angle=-Math.PI/2, attributes={}) {
  const p=getTowerPosition(s);
  const shot={id:s.nextId++,kind:'enemyBolt',interceptable:true,x:p.x+Math.cos(angle)*150,y:p.y+Math.sin(angle)*150,
    vx:-Math.cos(angle)*300,vy:-Math.sin(angle)*300,targetX:p.x,targetY:p.y,radius:6,life:3,damage:100,source:'hexer',heavy:false,...attributes};
  s.hostileProjectiles.push(shot);return shot;
}
function dock(level=1, connected=true) {
  const s=arena();installModule(s,'hangar',0);installModule(s,'service',connected?2:5);
  for(let i=1;i<level;i++)upgradeModule(s,connected?2:5);
  s.tower.droneEnergy=40;advance(s,.02);return s;
}

test('new modules respect the six-slot budget, upgrades and independent restart',()=>{
  const s=arena();assert.ok(installModule(s,'mortar',0));assert.ok(installModule(s,'gravity',3));
  assert.ok(installModule(s,'interceptor',2));assert.ok(installModule(s,'service',5));assert.equal(occupiedSlots(s),6);
  assert.equal(installModule(s,'hangar',1),false);
  for(const slot of [0,3,2,5]){assert.ok(upgradeModule(s,slot));assert.ok(upgradeModule(s,slot));assert.equal(upgradeModule(s,slot),false);}
  assert.equal(getTechStatus(s,'rate').maxed,false);
  assert.equal(createGameState(83).tower.moduleBay.installed.length,1);
});

test('mortar fixes its impact point, damages an area only on landing and can miss a moving target',()=>{
  const s=arena();installModule(s,'mortar',0);
  const first=enemy(s), nearby=enemy(s,45,-250), outside=enemy(s,200,-250);
  installedModule(s,'mortar').cooldown=0;
  updateGame(s,1/60);
  assert.equal(s.tower.moduleBay.combat.shells.length,1);assert.equal(first.hp,10000);
  const shell={...s.tower.moduleBay.combat.shells[0]};
  first.x+=400;
  advance(s,.4);assert.equal(nearby.hp,10000);
  assert.equal(s.tower.moduleBay.combat.shells[0].x,shell.x);
  advance(s,.55);
  assert.equal(first.hp,10000);assert.equal(outside.hp,10000);
  assert.equal(nearby.hp,10000-getTowerStats(s).damage*3);
  assert.ok(s.tower.moduleBay.combat.effects.some(fx=>fx.kind==='mortar'));
});

test('mortar blind spot, upgrades and idle cadence remain meaningful',()=>{
  const s=arena();installModule(s,'mortar',0);enemy(s,0,-130);
  let launches=0;advance(s,8,c=>launches+=c.events.filter(e=>e.type==='shoot'&&e.weaponId==='mortar').length);
  assert.equal(launches,0);
  enemy(s,0,-500);advance(s,1,c=>launches+=c.events.filter(e=>e.type==='shoot'&&e.weaponId==='mortar').length);
  assert.equal(launches,1,'waiting without targets must not accumulate a firing burst');
  s.paused=true;assert.ok(upgradeModule(s,0));assert.ok(upgradeModule(s,0));s.paused=false;
  installedModule(s,'mortar').cooldown=0;updateGame(s,1/60);
  const shell=s.tower.moduleBay.combat.shells[0];assert.equal(shell.duration,.7);assert.equal(shell.radius,110);
  assert.ok(Math.abs(shell.damage-50.4)<1e-9);
});

test('mortar elements require adjacency and resolve at impact once, not every flight frame',()=>{
  const s=arena();installModule(s,'mortar',0);installModule(s,'fire',2);const target=enemy(s);
  s.rng.next=()=>0;installedModule(s,'mortar').cooldown=0;updateGame(s,1/60);
  assert.equal(s.tower.moduleBay.combat.shells[0].element,'fire');assert.equal(target.burnTimer,0);
  advance(s,.4);assert.equal(target.burnTimer,0);advance(s,.55);assert.ok(target.burnTimer>0);
  s.paused=true;assert.ok(moveModule(s,2,5));s.paused=false;
  installedModule(s,'mortar').cooldown=0;updateGame(s,1/60);
  assert.equal(s.tower.moduleBay.combat.shells[0].element,null);
});

test('mortar specializations enter real rewards and change cluster or suppression behavior',()=>{
  const s=arena();installModule(s,'mortar',0);offerRelicChoice(s);
  const reward=s.relicChoice.choices.find(id=>id.startsWith('spec:mortar'));assert.ok(reward);assert.ok(chooseRelic(s,reward));
  assert.equal(specializeModule(s,reward.endsWith('Cluster')?'mortarStagger':'mortarCluster'),false);
  const cluster=arena();installModule(cluster,'mortar',0);specializeModule(cluster,'mortarCluster');enemy(cluster);
  installedModule(cluster,'mortar').cooldown=0;updateGame(cluster,1/60);
  const shells=cluster.tower.moduleBay.combat.shells;assert.equal(shells.length,3);assert.equal(new Set(shells.map(p=>`${p.x},${p.y}`)).size,3);
  assert.ok(shells.every(p=>p.damage===36*.42));
  const stagger=arena();installModule(stagger,'mortar',0);specializeModule(stagger,'mortarStagger');
  const caster=enemy(stagger,0,-250,'hexer');caster.volleyAt=0;
  const boss=enemy(stagger,10,-250);boss.type='boss';boss.attackRange=200;
  installedModule(stagger,'mortar').cooldown=0;advance(stagger,1);
  assert.ok(caster.moduleSuppression>0);assert.ok(caster.volleyAt>stagger.time);assert.equal(boss.moduleSuppression??0,0);
});

test('gravity pulls only its sector field, elites resist, and bosses or fixed anchors never teleport',()=>{
  const s=arena();installModule(s,'gravity',0);
  const normal=enemy(s,70,-230), elite=enemy(s,-70,-230);elite.elite=true;
  const boss=enemy(s,0,-260);boss.type='boss';const fixed=enemy(s,30,-230);fixed.type='anchor';fixed.anchorRole='shield';
  const other=enemy(s,70,230);const initial=[normal.x,elite.x,boss.x,boss.y,fixed.x,fixed.y,other.x,other.y];
  advance(s,1.3);
  assert.ok(normal.x<initial[0]);assert.ok(elite.x>initial[1]);assert.ok(initial[0]-normal.x>elite.x-initial[1]);
  assert.deepEqual([boss.x,boss.y,fixed.x,fixed.y,other.x,other.y],initial.slice(2));
  assert.equal(boss.gravitySlow,.85);assert.equal(normal.hp,10000);
  s.paused=true;assert.ok(moveModule(s,0,3));assert.equal(s.tower.moduleBay.combat.fields.length,0);
  const frozen=snapshotState(s);advance(s,4);assert.deepEqual(snapshotState(s),frozen);
  s.paused=false;assert.equal(installedModule(s,'gravity').facing,0);
  s.assault.phase='rest';assert.ok(setModuleFacing(s,'gravity',4));
  advance(s,1.3);assert.ok(s.tower.moduleBay.combat.fields[0].y>getTowerPosition(s).y);
});

test('interceptor consumes real charges only for ordinary projectiles in its own sector',()=>{
  const s=arena();installModule(s,'interceptor',0);advance(s,4.1);
  const module=installedModule(s,'interceptor');assert.equal(module.charges,2);
  const hp=s.tower.hp;bolt(s);advance(s,.4);assert.equal(s.hostileProjectiles.length,0);assert.equal(module.charges,1);assert.equal(s.tower.hp,hp);
  bolt(s,Math.PI/2);advance(s,.5);assert.equal(s.tower.hp,hp-100);assert.equal(module.charges,1);
  bolt(s,-Math.PI/2,{kind:'colossusMortar',interceptable:false});advance(s,.5);
  assert.equal(s.tower.hp,hp-200);assert.equal(module.charges,1);
  damageTower(s,25,true,'sovereignBeam');assert.equal(s.tower.hp,hp-225);assert.equal(module.charges,1);
});

test('interceptor empties under a volley, and pause or reinstall cannot refill it',()=>{
  const s=arena();installModule(s,'interceptor',0);advance(s,4);
  for(let i=0;i<3;i++)bolt(s);
  const hp=s.tower.hp;advance(s,.5);assert.equal(s.tower.hp,hp-100);assert.equal(installedModule(s,'interceptor').charges,0);
  s.paused=true;advance(s,20);assert.equal(installedModule(s,'interceptor').charges,0);
  assert.ok(removeModule(s,0));assert.ok(installModule(s,'interceptor',0));assert.equal(installedModule(s,'interceptor').charges,0);
  s.paused=false;advance(s,1.9);assert.equal(installedModule(s,'interceptor').charges,0);advance(s,.2);assert.equal(installedModule(s,'interceptor').charges,1);
});

test('ordinary ranged attacks now travel, can be intercepted, and preserve shield direction',()=>{
  const plain=arena();const caster=enemy(plain,0,-200,'hexer');Object.assign(caster,{attackRange:230,attackCooldown:0,damage:20});
  const hp=plain.tower.hp;updateGame(plain,1/60);assert.equal(plain.tower.hp,hp);assert.equal(plain.hostileProjectiles[0].kind,'enemyBolt');
  caster.attackCooldown=999;advance(plain,.7);assert.ok(plain.tower.hp<hp);
  const defended=arena();installModule(defended,'interceptor',0);installModule(defended,'shield',3);setModuleFacing(defended,'shield',4);advance(defended,4);
  const attacker=enemy(defended,0,-200,'hexer');Object.assign(attacker,{attackRange:230,attackCooldown:0,damage:20});
  advance(defended,.7);assert.equal(defended.tower.hp,getTowerStats(defended).maxHp);assert.equal(installedModule(defended,'interceptor').charges,1);
});

test('service needs shared-edge adjacency and returned drones before it adds regeneration',()=>{
  const connected=dock(), separate=dock(1,false);
  connected.tower.droneEnergy=separate.tower.droneEnergy=40;
  advance(connected,1);advance(separate,1);
  assert.ok(Math.abs((connected.tower.droneEnergy-40)/(separate.tower.droneEnergy-40)-1.4)<.01);
  const away=dock();for(const d of away.drones){d.x+=600;d.y+=400;}
  away.tower.droneEnergy=40;advance(away,.1);assert.ok(Math.abs(away.tower.droneEnergy-41.4)<.01);
  connected.paused=true;assert.ok(moveModule(connected,2,5));connected.paused=false;
  connected.tower.droneEnergy=40;advance(connected,1);assert.ok(Math.abs(connected.tower.droneEnergy-54)<.01);
});

test('service upgrades improve return speed, reward a real full recharge and leave hit energy alone',()=>{
  const base=dock(1), upgraded=dock(2);
  for(const s of [base,upgraded])for(const d of s.drones){d.x+=600;d.y+=400;}
  const a={...base.drones[0]},b={...upgraded.drones[0]};advance(base,.2);advance(upgraded,.2);
  const distance=(s,p)=>Math.hypot(s.drones[0].x-p.x,s.drones[0].y-p.y);
  assert.ok(distance(upgraded,b)>distance(base,a)*1.19);
  const ready=dock(3);advance(ready,5);const service=installedModule(ready,'service');
  assert.equal(ready.tower.droneEnergy,getDroneEnergyMax(ready));assert.equal(service.recharged,true);
  assert.ok(toggleDroneMode(ready));assert.equal(service.launchBuff,3);assert.equal(service.recharged,false);
  const energy=ready.tower.droneEnergy;advance(ready,1);assert.ok(Math.abs(energy-ready.tower.droneEnergy-1)<.02);
  assert.ok(toggleDroneMode(ready));assert.ok(toggleDroneMode(ready));assert.equal(service.launchBuff,0);
  const initial=dock(3);initial.tower.droneEnergy=getDroneEnergyMax(initial);assert.ok(toggleDroneMode(initial));assert.equal(installedModule(initial,'service').launchBuff,0);
});

test('refitting clears artillery and temporary support state without leaving delayed hits',()=>{
  const s=arena();installModule(s,'mortar',0);const target=enemy(s);installedModule(s,'mortar').cooldown=0;updateGame(s,1/60);
  assert.equal(s.tower.moduleBay.combat.shells.length,1);s.paused=true;assert.ok(removeModule(s,0));s.paused=false;
  advance(s,2);assert.equal(target.hp,10000);assert.ok(Object.values(s.tower.moduleBay.combat).every(items=>items.length===0));
});

test('new module meshes and attack feedback are finite and distinct at every level',()=>{
  const signatures=new Set();
  for(const id of ['mortar','gravity','interceptor','service'])for(const level of [1,2,3]){
    const m={id,slot:0,level};const model=buildTowerModel({tier:1,modules:[m],elements:{},cannonEnabled:false});
    for(const part of model.parts)assert.ok(part.vertices.every(Number.isFinite));
    signatures.add(Array.from(model.parts.find(p=>p.name===`module-${id}`)?.vertices??model.parts.find(p=>p.name==='gun-mortar').vertices).join(','));
    const fx={};recordModuleAttack(fx,{type:id==='mortar'?'shoot':id==='gravity'?'moduleGravity':id==='interceptor'?'moduleIntercept':'moduleService',weaponId:id});
    assert.ok(fx[`attack-${id}`]>0);
    assert.ok(sampleModuleEffects(m,model.layout,1,0,fx[`attack-${id}`]).some(effect=>effect.points.length>0));
  }
  assert.ok(signatures.size>=8);
});

test('mixed module combat and inputs reproduce with the same seed',()=>{
  function run(){const s=arena(93);s.tower.upgrades.ascend=1;
    for(const [id,slot] of [['gravity',0],['interceptor',2],['mortar',3],['pulse',5],['hangar',6],['service',8]])installModule(s,id,slot);
    enemy(s,60,-280);enemy(s,-40,-280);const caster=enemy(s,210,120,'hexer');caster.attackRange=300;caster.attackCooldown=0;
    s.tower.droneEnergy=40;advance(s,5);toggleDroneMode(s);advance(s,12);toggleDroneMode(s);advance(s,6);return snapshotState(s);}
  assert.deepEqual(run(),run());
});
