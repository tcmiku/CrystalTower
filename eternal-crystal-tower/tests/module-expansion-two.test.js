import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState,updateGame,spawnEnemy,getTowerPosition,getTowerStats,offerRelicChoice,chooseRelic,snapshotState} from '../src/engine.js';
import {installModule,removeModule,moveModule,upgradeModule,installedModule,specializeModule,setModuleFacing,bridgeConnection,weaponReactors,moduleDamageMultiplier,bindCapacitor,capacitorTargets} from '../src/modules.js';
import {buildTowerModel} from '../src/tower-model.js';
import {recordModuleAttack,sampleModuleEffects} from '../src/module-effects.js';

function arena(){const s=createGameState(93);removeModule(s,0);s.coins=10000;s.spawnTimer=s.wave.nextAt=99999;return s;}
function advance(s,seconds,observe=()=>{},dt=1/60){for(let i=0;i<Math.round(seconds/dt);i++){updateGame(s,dt);observe(s);}}
function enemy(s,dx=0,dy=-250){const p=getTowerPosition(s),e=spawnEnemy(s,'brute',{x:p.x+dx,y:p.y+dy});Object.assign(e,{hp:100000,maxHp:100000,speed:0,damage:0,attackCooldown:9999});return e;}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

test('laser ramps for three seconds, cools without damage, and resumes from low power',()=>{
  const s=arena();installModule(s,'laser',0);const e=enemy(s),base=getTowerStats(s).damage;
  advance(s,3);near(100000-e.hp,base*4.2);const m=installedModule(s,'laser');near(m.cooling,2);
  const hp=e.hp;advance(s,1.9);near(e.hp,hp);advance(s,.2);assert.ok(e.hp<hp);assert.ok(m.lockTime<.2);
});
test('laser upgrades accelerate ramp and reduce cooling; changing targets cannot prolong the firing window',()=>{
  const s=arena();installModule(s,'laser',0);upgradeModule(s,0);upgradeModule(s,0);const first=enemy(s);
  advance(s,2);const next=enemy(s,0,-200);advance(s,1/60);near(installedModule(s,'laser').lockTime,1/60);
  assert.ok(next.hp<100000);const hp=first.hp;advance(s,59/60);near(first.hp,hp);near(installedModule(s,'laser').cooling,1.5);
});
test('laser damage integrates consistently across fixed steps and never hits beyond range',()=>{
  const run=dt=>{const s=arena();installModule(s,'laser',0);const e=enemy(s),out=enemy(s,0,-340);advance(s,3,()=>{},dt);assert.equal(out.hp,100000);return e.hp;};near(run(1/60),run(1/30));
});
test('laser elemental cadence stays at two attempts per second, including target changes',()=>{
  const s=arena();installModule(s,'laser',0);installModule(s,'fire',2);enemy(s);s.rng.next=()=>0;
  let procs=0;advance(s,1.5,x=>procs+=x.events.filter(e=>e.type==='elementHit').length);enemy(s,0,-200);
  advance(s,1.5,x=>procs+=x.events.filter(e=>e.type==='elementHit').length);assert.equal(procs,6);
});
test('laser focus extends firing with longer cooling; sweep hits only the target fan without ramp',()=>{
  const s=arena();installModule(s,'laser',0);specializeModule(s,'laserFocus');const e=enemy(s);advance(s,5);near(100000-e.hp,getTowerStats(s).damage*11.7);near(installedModule(s,'laser').cooling,3);
  const a=arena();installModule(a,'laser',0);specializeModule(a,'laserSweep');const front=enemy(a,0,-200),side=enemy(a,40,-220),behind=enemy(a,0,230);advance(a,1);
  near(100000-front.hp,getTowerStats(a).damage*.8);near(front.hp,side.hp);assert.equal(behind.hp,100000);
});
test('minelayer respects deployment delay, capacity, lifetime, upgrade cadence and pause',()=>{
  const s=arena();installModule(s,'mine',0);advance(s,3.9);assert.equal(s.tower.moduleBay.combat.mines.length,0);advance(s,8.2);
  const initial=s.tower.moduleBay.combat.mines.map(m=>m.id);assert.equal(initial.length,3);s.paused=true;const frozen=JSON.stringify(s.tower.moduleBay);advance(s,10);assert.equal(JSON.stringify(s.tower.moduleBay),frozen);
  s.paused=false;advance(s,7.1);assert.ok(!s.tower.moduleBay.combat.mines.some(m=>m.id===initial[0]));
  s.paused=true;upgradeModule(s,0);upgradeModule(s,0);s.paused=false;advance(s,12.9);assert.equal(s.tower.moduleBay.combat.mines.length,4);
});
test('mines snapshot elements when deployed and explode only once on contact',()=>{
  const s=arena();installModule(s,'mine',0);installModule(s,'frost',2);s.rng.next=()=>0;advance(s,4.1);const mine={...s.tower.moduleBay.combat.mines[0]};assert.equal(mine.element,'frost');
  s.rng.next=()=>.99;const p=getTowerPosition(s),e=enemy(s,mine.x-p.x,mine.y-p.y);let explosions=0;
  advance(s,.1,x=>explosions+=x.events.filter(e=>e.type==='mineExplosion').length);assert.equal(explosions,1);assert.ok(e.freezeTimer>0);near(100000-e.hp,getTowerStats(s).damage*2.5*1.15);
  advance(s,1,x=>explosions+=x.events.filter(e=>e.type==='mineExplosion').length);assert.equal(explosions,1);
});
test('chain mines propagate with a delay and never duplicate explosions',()=>{
  const s=arena();installModule(s,'mine',0);specializeModule(s,'mineChain');advance(s,12.1);
  const p=getTowerPosition(s),first=s.tower.moduleBay.combat.mines[0];enemy(s,first.x-p.x,first.y-p.y);
  const ids=[];advance(s,1/60,x=>ids.push(...x.events.filter(e=>e.type==='mineExplosion').map(e=>e.id)));assert.equal(ids.length,1);
  assert.equal(s.tower.moduleBay.combat.mines.filter(m=>m.detonateAt>s.time).length,1);assert.equal(s.tower.moduleBay.combat.mines.filter(m=>m.detonateAt==null).length,1);advance(s,.4,x=>ids.push(...x.events.filter(e=>e.type==='mineExplosion').map(e=>e.id)));
  assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.equal(s.tower.moduleBay.combat.mines.length,0);
});
test('slow mines reduce ordinary movement, bosses resist, and expiry restores speed',()=>{
  const s=arena();installModule(s,'mine',0);specializeModule(s,'mineSlow');advance(s,4.1);const mine=s.tower.moduleBay.combat.mines[0],p=getTowerPosition(s);
  const a=enemy(s,mine.x-p.x,mine.y-p.y),boss=enemy(s,mine.x-p.x+5,mine.y-p.y);boss.type='boss';advance(s,1/60);
  near(a.mineSlow,.55);near(boss.mineSlow,.85);a.speed=20;const before={x:a.x,y:a.y};advance(s,.5);near(Math.hypot(a.x-before.x,a.y-before.y),5.5);
  a.speed=0;advance(s,2.6);near(a.mineSlow,1);near(boss.mineSlow,1);
});
test('turning or moving a minelayer clears old mines and requires a fresh deployment delay',()=>{
  const s=arena();installModule(s,'mine',0);advance(s,4.1);assert.equal(s.tower.moduleBay.combat.mines.length,1);assert.ok(setModuleFacing(s,'mine',4));assert.equal(s.tower.moduleBay.combat.mines.length,0);
  advance(s,3.9);assert.equal(s.tower.moduleBay.combat.mines.length,0);advance(s,.2);assert.ok(s.tower.moduleBay.combat.mines[0].y>getTowerPosition(s).y);
  s.paused=true;assert.ok(moveModule(s,0,3));assert.equal(s.tower.moduleBay.combat.mines.length,0);
});
test('bridge links opposite endpoints, rotates in one cell, and never grants direct damage',()=>{
  const s=arena();s.tower.upgrades.ascend=1;installModule(s,'fire',1);installModule(s,'bridge',4);installModule(s,'pulse',7);
  assert.equal(bridgeConnection(s),null);assert.ok(moveModule(s,4,4,1));const link=bridgeConnection(s);assert.equal(link.reactor.id,'fire');assert.equal(link.weapon.id,'pulse');
  near(weaponReactors(s,'pulse')[0].efficiency,.7);assert.equal(moduleDamageMultiplier(s,'pulse'),1);
  upgradeModule(s,4);near(weaponReactors(s,'pulse')[0].efficiency,.85);upgradeModule(s,4);near(weaponReactors(s,'pulse')[0].efficiency,1);
  moveModule(s,4,0,0);assert.equal(bridgeConnection(s),null);assert.equal(weaponReactors(s,'pulse').length,0);
});
test('bridge efficiency changes real shot proc probability while keeping projectile damage unchanged',()=>{
  const s=arena();installModule(s,'fire',0);installModule(s,'bridge',1);installModule(s,'pulse',2);enemy(s);s.rng.next=()=>.26;
  s.tower.fireCooldown=0;updateGame(s,1/60);assert.equal(s.projectiles[0].element,null);near(s.projectiles[0].damage,getTowerStats(s).damage);
  s.paused=true;upgradeModule(s,1);s.paused=false;s.projectiles=[];s.tower.fireCooldown=0;updateGame(s,1/60);assert.equal(s.projectiles[0].element,'fire');near(s.projectiles[0].damage,getTowerStats(s).damage);
});
test('capacitor requires an eligible neighbor and explicit choice when two are available',()=>{
  const s=arena();installModule(s,'pulse',0);installModule(s,'mortar',2,1);installModule(s,'capacitor',1);
  const cap=installedModule(s,'capacitor');assert.equal(cap.boundId,null);assert.deepEqual(capacitorTargets(s).map(m=>m.id),['pulse','mortar']);
  assert.equal(bindCapacitor(s,'laser'),false);assert.ok(bindCapacitor(s,'pulse'));assert.equal(cap.boundId,'pulse');
  advance(s,4.1);assert.equal(cap.stacks,2);s.paused=true;assert.ok(bindCapacitor(s,'mortar'));assert.equal(cap.stacks,0);assert.equal(cap.chargeTime,0);
});
test('capacitor charges only genuine ready-without-target time, never pause or refit time',()=>{
  const s=arena();installModule(s,'pulse',0);installModule(s,'capacitor',1);const cap=installedModule(s,'capacitor');s.tower.fireCooldown=3;
  advance(s,2);assert.equal(cap.stacks,0);advance(s,3.1);assert.equal(cap.stacks,1);s.paused=true;advance(s,10);assert.equal(cap.stacks,1);
  s.paused=false;s.tower.moduleBay.refitCooldown=8;advance(s,5);assert.equal(cap.stacks,1);
  s.tower.moduleBay.refitCooldown=0;enemy(s);advance(s,6);assert.equal(cap.stacks,0);assert.equal(cap.chargeTime,0);
});
test('capacitor boosts exactly the next volley and imposes a persistent firing interval cost',()=>{
  const s=arena();installModule(s,'pulse',0);installModule(s,'capacitor',1);advance(s,6.1);assert.equal(installedModule(s,'capacitor').stacks,3);
  enemy(s);s.tower.fireCooldown=0;updateGame(s,1/60);near(s.projectiles[0].damage,getTowerStats(s).damage*1.75);assert.equal(installedModule(s,'capacitor').stacks,0);near(s.tower.fireCooldown,1/getTowerStats(s).fireRate*1.1);
  s.projectiles=[];s.tower.fireCooldown=0;updateGame(s,1/60);near(s.projectiles[0].damage,getTowerStats(s).damage);near(s.tower.fireCooldown,1/getTowerStats(s).fireRate*1.1);
});
test('capacitor upgrades shorten charge time, raise capacity, and amplify mortar volleys once',()=>{
  const s=arena();installModule(s,'mortar',0);installModule(s,'capacitor',2);upgradeModule(s,2);upgradeModule(s,2);advance(s,9.2);
  const cap=installedModule(s,'capacitor');assert.equal(cap.stacks,4);enemy(s,0,-400);updateGame(s,1/60);near(s.tower.moduleBay.combat.shells[0].damage,getTowerStats(s).damage*6);assert.equal(cap.stacks,0);
  s.paused=true;removeModule(s,2);assert.equal(s.tower.moduleBay.combat.shells.length,0);installModule(s,'capacitor',2);assert.equal(installedModule(s,'capacitor').stacks,0);
});
test('both new weapons have real specialization choices and preserve one-choice-per-weapon',()=>{
  for(const id of ['laser','mine']){const s=arena();installModule(s,id,0);offerRelicChoice(s);const choice=s.relicChoice.choices.find(c=>c.startsWith(`spec:${id}`));assert.ok(choice);assert.ok(chooseRelic(s,choice));assert.ok(installedModule(s,id).specialization);assert.equal(specializeModule(s,id==='laser'?'laserFocus':'mineSlow'),false);}
});
test('new model geometry and activity effects are finite, distinct and bounded at every level',()=>{
  const identities=new Set();for(const id of ['laser','mine','bridge','capacitor'])for(const level of [1,2,3]){
    const module={id,slot:0,level,rotation:0},model=buildTowerModel({tier:1,modules:[module]});const part=model.parts.find(p=>p.name===`gun-${id}`||p.name===`module-${id}`);assert.ok(part.vertices.length>100);assert.ok(Array.from(part.vertices).every(Number.isFinite));identities.add(Array.from(part.vertices).join(','));
    const fx={};recordModuleAttack(fx,{type:id==='laser'?'moduleLaser':id==='mine'?'moduleMine':'moduleCharge'});const effects=sampleModuleEffects(module,model.layout,1,0,.45);assert.ok(effects.length>0&&effects.length<50);assert.ok(effects.flatMap(e=>e.points.flat()).every(Number.isFinite));
  }assert.equal(identities.size,12);
});

test('mixed second-batch combat repeats with the same seed and inputs, pauses cleanly, and resets on removal',()=>{
  const run=()=>{
    const s=arena();s.tower.upgrades.ascend=3;
    for(const [id,slot,rotation=0] of [['fire',0],['bridge',1],['pulse',2],['mine',3],['capacitor',5],['laser',6],['mortar',8,1],['gravity',9]])assert.ok(installModule(s,id,slot,rotation));
    bindCapacitor(s,'pulse');specializeModule(s,'laserSweep');specializeModule(s,'mineChain');advance(s,6.1);
    for(let i=0;i<7;i++){const e=enemy(s,-60+i*20,-310-i*8);e.speed=15;}
    advance(s,8);s.paused=true;const paused=snapshotState(s);advance(s,3);assert.deepEqual(snapshotState(s),paused);s.paused=false;advance(s,4);
    const result=snapshotState(s);s.paused=true;assert.ok(removeModule(s,6));assert.ok(Object.values(s.tower.moduleBay.combat).every(items=>items.length===0));assert.equal(installedModule(s,'capacitor').stacks,0);
    assert.deepEqual(createGameState(93).tower.moduleBay.installed.map(m=>m.id),['pulse']);return result;
  };
  assert.deepEqual(run(),run());
});
