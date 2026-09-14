import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, updateGame, spawnEnemy, snapshotState } from '../src/engine.js';
import { buildForts, fortAction, fortPlacement, fortLimits, damageFort, firstFort, moveFortEnemy, wallLine, updateForts, fortArtilleryTarget } from '../src/fortifications.js';
import { planAssault, updateAssault } from '../src/assault.js';

const tick=(s,t)=>{for(let i=0;i<Math.ceil(t*60);i++)updateGame(s,1/60);};
function sandbox(){const s=createGameState(73);s.coins=2000;s.fortifications.credit=0;s.wave.nextAt=99999;s.tower.moduleBay.installed=[];s.admin.invincible=true;return s;}
const north={x:720,y:260};
function wall(s,p=north){assert.ok(buildForts(s,'wall',[p]).ok);return s.fortifications.items.at(-1);}

test('control zone validates the entire footprint, joins walls, and rejects overlaps atomically',()=>{
  const s=sandbox();assert.equal(fortPlacement(s,'gun',[{x:720,y:350}]).ok,false);
  assert.equal(fortPlacement(s,'gun',[{x:720,y:200}]).ok,false);
  const points=wallLine({x:660,y:260},{x:720,y:290});assert.equal(points.length,4);
  const before=s.coins;assert.ok(buildForts(s,'wall',points).ok);assert.equal(s.coins,before-60);
  assert.equal(buildForts(s,'gun',[{x:690,y:290}]).ok,false);assert.equal(s.coins,before-60);
  s.tower.upgrades.ascend=2;assert.equal(fortLimits(s).radius,360);
});
test('capacity is enforced independently, and the chapter-two fleet has no construction state',()=>{
  const s=sandbox();s.fortifications.items=Array.from({length:24},(_,id)=>({id,type:'wall',hp:1,x:0,y:0,size:30}));
  assert.equal(buildForts(s,'wall',[north]).ok,false);
  const sea=createGameState(1,{}, {},1,{},[],{},2);assert.equal(sea.fortifications,undefined);assert.equal(buildForts(sea,'wall',[north]).ok,false);
});
test('tutorial credit cannot be converted to coins, and damage is retained on movement and upgrades',()=>{
  const s=sandbox();s.fortifications.credit=130;const cash=s.coins,b=wall(s);assert.equal(s.coins,cash);
  assert.ok(fortAction(s,b.id,'remove').ok);assert.equal(s.coins,cash);assert.equal(s.fortifications.credit,130);
  const c=wall(s);damageFort(s,c,120);assert.ok(fortAction(s,c.id,'move',{x:750,y:260}).ok);assert.equal(c.hp,120);
  assert.ok(fortAction(s,c.id,'upgrade').ok);assert.equal(c.hp/c.maxHp,.5);
  const before=s.coins;fortAction(s,c.id,'remove');assert.ok(s.coins-before<23);
});
test('combat construction takes real time, remains passable, and cannot finish on occupants',()=>{
  const s=sandbox();s.assault.phase='main';const b=wall(s);assert.equal(b.construction,3);assert.equal(firstFort(s,{x:720,y:180},{x:720,y:300},12),null);
  s.paused=true;tick(s,4);assert.equal(b.construction,3);s.paused=false;
  const e=spawnEnemy(s,'runner',north);e.speed=0;e.damage=0;tick(s,4);assert.ok(b.construction>0);
  e.hp=0;tick(s,.2);assert.equal(b.construction,0);
});
test('occupied cells reject new buildings and rebuilding without spending coins',()=>{
  const s=sandbox(),b=wall(s);damageFort(s,b,999);spawnEnemy(s,'runner',north);const cash=s.coins;
  assert.equal(fortAction(s,b.id,'rebuild').ok,false);assert.equal(s.coins,cash);
  assert.equal(buildForts(s,'gun',[north]).ok,false);
});
test('repairs wait after a hit, charge only actual restoration, pause, and never resurrect ruins',()=>{
  const s=sandbox(),b=wall(s);damageFort(s,b,120);fortAction(s,b.id,'repair');const cash=s.coins;
  tick(s,2.8);assert.equal(b.hp,120);assert.equal(s.coins,cash);
  tick(s,1);assert.ok(b.hp>120);assert.ok(s.coins<cash);
  const hp=b.hp;s.paused=true;tick(s,5);assert.equal(b.hp,hp);s.paused=false;
  damageFort(s,b,999);tick(s,5);assert.equal(b.hp,0);assert.equal(b.repairing,false);
});
test('a runner finds a short route around a wall without attacking it or crossing its footprint',()=>{
  const s=sandbox(),b=wall(s),e=spawnEnemy(s,'runner',{x:720,y:180});
  for(let i=0;i<180;i++){updateGame(s,1/60);assert.ok(!(Math.abs(e.x-b.x)<b.size/2+e.radius&&Math.abs(e.y-b.y)<b.size/2+e.radius));}
  assert.ok(e.y>290,`${e.x},${e.y}`);assert.equal(b.hp,b.maxHp);
});
test('a sealed ring is legal and heavy enemies break a wall then advance through the breach',()=>{
  const s=sandbox();s.tower.upgrades.ascend=3;
  const points=[];for(let x=540;x<=900;x+=30){points.push({x,y:320},{x,y:680});}for(let y=350;y<680;y+=30)points.push({x:540,y},{x:900,y});
  assert.equal(points.length,48);assert.ok(buildForts(s,'wall',points).ok);
  const e=spawnEnemy(s,'brute',{x:720,y:230});e.damage=180;tick(s,8);
  assert.ok(s.fortifications.items.some(b=>b.hp===0));assert.ok(e.y>350,`brute stayed at ${e.y}`);
});
test('a sealed ring cannot softlock fast enemies either',()=>{
  const s=sandbox();s.tower.upgrades.ascend=3;
  const points=[];for(let x=540;x<=900;x+=30)points.push({x,y:320},{x,y:680});for(let y=350;y<680;y+=30)points.push({x:540,y},{x:900,y});
  assert.ok(buildForts(s,'wall',points).ok);const e=spawnEnemy(s,'runner',{x:720,y:230});e.damage=240;tick(s,5);
  assert.ok(s.fortifications.items.some(b=>b.hp===0));assert.ok(e.y>350);
});
test('rammer telegraphs before impact, freezes cancel the charge, then a later charge deals damage',()=>{
  const s=sandbox(),b=wall(s),e=spawnEnemy(s,'rammer',{x:720,y:150});tick(s,.5);
  assert.ok(e.fortCharge);assert.equal(b.hp,b.maxHp);e.freezeTimer=1;tick(s,.2);assert.equal(e.fortCharge,null);assert.equal(b.hp,b.maxHp);
  tick(s,5);assert.ok(b.hp<b.maxHp);
});
test('rear rows cannot damage a wall through a front-row unit',()=>{
  const s=sandbox(),b=wall(s),front=spawnEnemy(s,'brute',{x:720,y:220}),rear=spawnEnemy(s,'brute',{x:720,y:218});
  front.damage=0;front.speed=0;rear.speed=0;rear.damage=500;tick(s,.5);assert.equal(b.hp,b.maxHp);
});
test('ordinary enemy bolts hit the first wall and do not damage the tower after a destroyed target',()=>{
  const s=sandbox(),b=wall(s),hp=s.tower.hp;
  s.hostileProjectiles.push({kind:'enemyBolt',x:720,y:180,vx:0,vy:800,targetX:720,targetY:500,radius:6,life:2,damage:60});
  tick(s,.3);assert.equal(b.hp,180);assert.equal(s.tower.hp,hp);assert.equal(s.hostileProjectiles.length,0);
  damageFort(s,b,999);s.admin.invincible=false;
  s.hostileProjectiles.push({kind:'enemyBolt',fortId:b.id,x:720,y:180,vx:0,vy:300,targetX:b.x,targetY:b.y,radius:6,life:2,damage:60});
  tick(s,.6);assert.equal(s.tower.hp,hp);
});
test('ranged enemies actually target exposed turrets, and walls shield them',()=>{
  const s=sandbox();assert.ok(buildForts(s,'gun',[{x:750,y:320}]).ok);const gun=s.fortifications.items[0];
  const b=wall(s,{x:750,y:260}),e=spawnEnemy(s,'hexer',{x:750,y:150});e.hp=e.maxHp=10000;tick(s,3);
  assert.ok(b.hp<b.maxHp);assert.equal(gun.hp,gun.maxHp);damageFort(s,b,999);tick(s,4);assert.ok(gun.hp<gun.maxHp);
});
test('turrets fire only in range, honor priority, preserve damage independence and generate normal kill drops',()=>{
  const s=sandbox();assert.ok(buildForts(s,'gun',[{x:720,y:290}]).ok);const b=s.fortifications.items[0];
  const near=spawnEnemy(s,'brute',{x:720,y:210}),fast=spawnEnemy(s,'runner',{x:800,y:210});near.speed=0;fast.speed=80;fast.hp=fast.maxHp=100;
  b.priority='fast';const hits=[];updateForts(s,.1,(_s,e,d)=>hits.push([e.id,d]));assert.equal(hits[0][0],fast.id);assert.equal(hits[0][1],3);
  s.tower.upgrades.damage=10;b.cooldown=0;updateForts(s,.1,(_s,e,d)=>hits.push([e.id,d]));assert.equal(hits[1][1],3);
  near.hp=0;fast.hp=1;fast.speed=0;b.cooldown=0;tick(s,.1);assert.ok(s.coinOrbs.length>0);
});
test('swept movement prevents fast pushes and pulls from passing through walls',()=>{
  const s=sandbox(),b=wall(s),e=spawnEnemy(s,'runner',{x:720,y:200});
  const hit=moveFortEnemy(s,e,{x:720,y:400});assert.equal(hit,b);assert.ok(e.y<240);
  e.x=720;e.y=320;moveFortEnemy(s,e,{x:720,y:100});assert.ok(e.y>280);
});
test('seventh wave advertises and schedules a real breach formation',()=>{
  const s=sandbox();s.wave.index=6;assert.equal(planAssault(s).formation,'breach');s.wave.nextAt=10;
  updateAssault(s,0,{spawn:()=>null,eliteCount:1});assert.equal(s.wave.formation,'breach');assert.ok(s.assault.plan.some(p=>p.type==='rammer'));
});
test('fortified combat is deterministic and restart creates no inherited construction',()=>{
  function run(){const s=sandbox();wall(s);buildForts(s,'gun',[{x:780,y:320}]);spawnEnemy(s,'rammer',{x:720,y:120});spawnEnemy(s,'runner',{x:720,y:150});tick(s,6);return snapshotState(s);}
  assert.deepEqual(run(),run());const fresh=createGameState(73);assert.equal(fresh.fortifications.items.length,0);assert.equal(fresh.fortifications.credit,130);
});

test('boss artillery alternates dense fortifications with core pressure and splashes only at its impact',()=>{
  const s=sandbox(),b=wall(s),boss={};wall(s,{x:750,y:260});
  assert.deepEqual(fortArtilleryTarget(s,boss,{x:720,y:500}),{x:720,y:500});assert.equal(fortArtilleryTarget(s,boss,{x:720,y:500}).id,b.id);
  s.hostileProjectiles.push({kind:'colossusMortar',x:720,y:140,vx:0,vy:300,targetX:720,targetY:260,radius:8,life:2,damage:80});
  tick(s,.5);assert.equal(b.hp,160);assert.equal(s.fortifications.items[1].hp,160);
});
test('colossus collision holds its orbit, telegraphs a stomp and damages an obstructing wall',()=>{
  const s=sandbox();s.tower.upgrades.ascend=2;const b=wall(s,{x:720,y:170});
  const boss=spawnEnemy(s,'colossus');boss.skillCooldown=999;tick(s,2.5);
  assert.ok(b.hp<b.maxHp||boss.fortStompTarget,'colossus must react to the wall');
  assert.ok(!firstFort(s,boss,boss,boss.radius), 'boss cannot sit inside a solid wall');
});
test('summoned enemies and boss interaction nodes never start inside solid construction',()=>{
  const s=sandbox(),b=wall(s),e=spawnEnemy(s,'crawler',north),node=spawnEnemy(s,'anchor',north);
  assert.equal(firstFort(s,e,e,e.radius),null);assert.equal(firstFort(s,node,node,node.radius),null);assert.equal(b.hp,b.maxHp);
});
