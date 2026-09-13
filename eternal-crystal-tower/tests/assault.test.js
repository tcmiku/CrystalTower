import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState,updateGame,spawnEnemy,damageEnemy} from '../src/engine.js';
import {installModule,removeModule,moveModule,installedModule,setModuleFacing,moduleCovers} from '../src/modules.js';
import {GATES,assaultRoute,updateAssault,chooseResonance,startSalvage,recallSalvage,updateSalvage,updateResonance} from '../src/assault.js';
import {GAME_CONFIG} from '../src/config.js';
const tick=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)updateGame(s,1/60);};
function sandbox(){const s=createGameState(7);s.coins=10000;s.wave.nextAt=99999;s.admin.invincible=true;return s;}
const drive=(s,dt=0)=>updateAssault(s,dt,{spawn:(type,p,o)=>spawnEnemy(s,type,p,o),eliteCount:1});

test('four ingress routes remain in map gaps and arrival schedules compensate horizontal distance',()=>{
  const s=sandbox();s.wave.index=5;s.wave.nextAt=20;s.time=10;drive(s);
  assert.equal(s.wave.formation,'pincer');assert.equal(s.wave.secondary,2);
  for(const gate of [0,1,2,3]){
    const route=assaultRoute(gate,30);
    const perpendicular=gate%2===0?route.spawn.x-720:route.spawn.y-500;
    assert.ok(Math.abs(Math.abs(perpendicular)-30)<1e-8);
    assert.ok(route.travel<10&&route.travel>0);
  }
  assert.ok(assaultRoute(1).travel>assaultRoute(0).travel);
  for(const u of s.assault.plan)assert.ok(Math.abs(u.at+u.travel-u.arrival)<1e-9);
  assert.deepEqual([...new Set(s.assault.plan.map(u=>u.gate))].sort(),[0,2]);
});

test('warning actually precedes contact; only gate-tagged units spawn and cleanup stops reinforcement',()=>{
  const s=createGameState(12);s.admin.invincible=true;removeModule(s,0);
  tick(s,2.1);assert.equal(s.assault.phase,'warning');assert.equal(s.wave.direction,0);
  tick(s,10);assert.equal(s.assault.phase,'vanguard');assert.ok(s.enemies.length);
  assert.ok(s.enemies.every(e=>e.gate===0&&e.waveIndex===1));
  tick(s,42);assert.equal(s.assault.phase,'cleanup');const ids=s.enemies.map(e=>e.id);
  tick(s,15);assert.deepEqual(s.enemies.map(e=>e.id),ids);
  for(const e of s.enemies)e.hp=0;
  tick(s,.1);assert.equal(s.assault.phase,'rest');const coins=s.coins;
  tick(s,3);assert.equal(s.enemies.length,0);assert.equal(s.coins,coins);
});

test('boss is queued until a wave clears, warns for ten seconds and suspends scheduled assaults',()=>{
  const s=sandbox();s.assault.pendingBosses=['boss'];const blocker=spawnEnemy(s,'wisp',{x:1000,y:500});
  drive(s);assert.equal(s.assault.phase,'rest');blocker.hp=0;drive(s);assert.equal(s.assault.phase,'boss-warning');
  s.time+=9;drive(s);assert.ok(!s.enemies.some(e=>e.type==='boss'));
  s.time+=1;drive(s);assert.ok(s.enemies.some(e=>e.type==='boss'));const before=s.enemies.length;
  tick(s,2);assert.equal(s.assault.phase,'boss');assert.equal(s.enemies.filter(e=>e.waveIndex!=null).length,0);
});

test('resonance is optional, bounded to one choice and adds exactly three tagged guards',()=>{
  const s=sandbox();s.wave.index=4;s.wave.nextAt=20;s.time=10;drive(s);
  assert.equal(s.assault.nodeChoices.length,2);const before=s.assault.plan.length;const gate=s.assault.nodeChoices[0];
  assert.ok(chooseResonance(s,gate));assert.equal(s.assault.plan.length,before+3);
  assert.equal(chooseResonance(s,s.assault.nodeChoices[1]),false);
  assert.ok(s.assault.plan.every(u=>u.waveIndex===5));
  s.assault.phase='main';assert.equal(chooseResonance(s,gate),false);
  s.assault.resonance={gate:2,used:false};spawnEnemy(s,'wisp',{x:720,y:600});
  updateResonance(s,1);const shield=s.tower.shield;updateResonance(s,1);assert.equal(shield,100);assert.equal(s.tower.shield,shield);
  s.assault.resonance={gate:0,used:false};
  const near=spawnEnemy(s,'wisp',{x:720,y:240}),far=spawnEnemy(s,'wisp',{x:720,y:0});
  updateResonance(s,1);assert.equal(near.freezeTimer,3);assert.equal(far.freezeTimer,0);
});

test('salvage withdraws part of the fleet, allows partial recall and pays only after return',()=>{
  const s=sandbox();assert.ok(installModule(s,'hangar',1));tick(s,.1);
  s.assault.salvageAvailable=true;s.assault.lastGate=0;s.tower.droneEnergy=100;
  assert.ok(startSalvage(s));assert.equal(startSalvage(s),false);assert.ok(s.assault.mission.ids.length<s.drones.length);
  const before=s.coins;
  for(let i=0;i<5*60;i++)updateSalvage(s,1/60);
  assert.equal(s.coins,before);assert.ok(s.assault.mission.progress>0);
  assert.ok(recallSalvage(s));const earned=s.assault.mission.earned;assert.ok(earned>0&&earned<s.assault.mission.reward);
  for(let i=0;i<3*60;i++)updateSalvage(s,1/60);
  assert.equal(s.assault.mission,null);assert.equal(s.coins,before+earned);
  updateSalvage(s,5);assert.equal(s.coins,before+earned);
});

test('independent facing survives grid moves; battle turning suspends protection for three seconds',()=>{
  const s=sandbox();removeModule(s,0);installModule(s,'shield',0);const shield=installedModule(s,'shield');
  assert.ok(setModuleFacing(s,'shield',2));assert.ok(moveModule(s,0,3));
  assert.ok(moduleCovers(shield,{x:900,y:500},{x:720,y:500}));
  assert.equal(moduleCovers(shield,{x:720,y:300},{x:720,y:500}),false);
  s.assault.phase='main';assert.ok(setModuleFacing(s,'shield',0));assert.equal(setModuleFacing(s,'shield',2),false);
  assert.equal(moduleCovers(shield,{x:720,y:300},{x:720,y:500}),false);
  tick(s,3.1);assert.ok(moduleCovers(shield,{x:720,y:300},{x:720,y:500}));
});

test('salvage drones do not attack while the remaining fleet defends and auto recall respects warning',()=>{
  const s=sandbox();installModule(s,'hangar',1);tick(s,.1);s.assault.lastGate=0;s.assault.salvageAvailable=true;
  startSalvage(s);const ids=[...s.assault.mission.ids];s.tower.droneMode='attack';
  const e=spawnEnemy(s,'brute',{x:850,y:500});e.hp=e.maxHp=10000;e.speed=0;
  tick(s,2);assert.ok(ids.every(id=>s.drones.find(d=>d.index===id).targetId===null));assert.ok(e.hp<10000);
  s.assault.phase='warning';s.wave.nextAt=s.time+4;updateSalvage(s,.1);assert.equal(s.assault.mission.phase,'returning');
});

test('full salvage finishes at the wreck but credits the reward only at home',()=>{
  const s=sandbox();installModule(s,'hangar',1);tick(s,.1);s.assault.salvageAvailable=true;
  startSalvage(s);const before=s.coins,reward=s.assault.mission.reward;
  for(let i=0;i<20*60&&s.assault.mission.phase!=='returning';i++)updateSalvage(s,1/60);
  const m=s.assault.mission;
  assert.equal(m.phase,'returning');assert.equal(m.earned,reward);assert.equal(s.coins,before);
  assert.ok(m.ids.every(id=>{const d=s.drones.find(d=>d.index===id);return Math.hypot(d.x-720,d.y-500)>400;}));
  for(let i=0;i<3*60;i++)updateSalvage(s,1/60);
  assert.equal(s.assault.mission,null);assert.equal(s.coins,before+reward);
  updateSalvage(s,30);assert.equal(s.coins,before+reward);
});

test('removing a hangar cancels an expedition without payout or stale drone phases',()=>{
  const s=sandbox();installModule(s,'hangar',1);tick(s,.1);s.assault.salvageAvailable=true;
  startSalvage(s);updateSalvage(s,2);removeModule(s,1);const before=s.coins;
  updateSalvage(s,20);assert.equal(s.assault.mission,null);assert.equal(s.coins,before);
  assert.ok(s.drones.every(d=>d.phase!=='salvage'));
});

test('rest and cleanup do not escalate difficulty; every unit of a wave keeps its announced strength',()=>{
  const s=sandbox();removeModule(s,0);tick(s,50);assert.equal(s.time>49,true);assert.equal(s.threat,1);
  s.assault.difficultyTime=44;s.wave.nextAt=s.time+10;tick(s,11.2);
  assert.equal(s.threat,2);assert.equal(s.assault.wave.threat,1);
  tick(s,40);assert.equal(s.assault.phase,'cleanup');assert.ok(s.enemies.length>0);
  assert.ok(s.enemies.every(e=>e.spawnThreat===1));
  const difficulty=s.assault.difficultyTime;tick(s,60);assert.equal(s.assault.difficultyTime,difficulty);
});

test('brood budget reserves eight hatches and multiple elite slots remain assigned',()=>{
  const s=sandbox();s.wave.index=4;s.wave.nextAt=20;s.time=10;
  updateAssault(s,0,{spawn:()=>null,eliteCount:3});
  assert.equal(s.assault.plan.length+8,s.assault.wave.count);
  assert.equal(s.assault.plan.filter(u=>u.brood).length,1);
  assert.equal(s.assault.plan.filter(u=>u.elite).length,3);
});

test('full arenas delay all planned units including elites without deleting existing enemies',()=>{
  const s=sandbox();s.wave.nextAt=20;s.time=10;drive(s);
  s.enemies=Array.from({length:GAME_CONFIG.combat.maxEnemies},(_,id)=>({id,hp:1,type:'wisp'}));
  s.time=100;const count=s.assault.plan.length,ids=s.enemies.map(e=>e.id);drive(s);
  assert.equal(s.assault.plan.length,count);assert.deepEqual(s.enemies.map(e=>e.id),ids);
  s.enemies=[];drive(s);assert.equal(s.assault.plan.length,0);assert.equal(s.enemies.length,count);
});

test('clear rewards and temporary shield expire before a queued boss, with rest between bosses',()=>{
  const s=sandbox();Object.assign(s.assault,{phase:'cleanup',pendingBosses:['boss','colossus'],resonance:{gate:2,used:true,shieldRemaining:70}});
  s.wave.index=2;s.wave.direction=2;s.tower.shield=90;const before=s.coins;
  drive(s);assert.equal(s.coins,before+50);assert.equal(s.tower.shield,20);assert.equal(s.assault.phase,'boss-warning');
  s.time+=10;drive(s);s.enemies.forEach(e=>e.hp=0);drive(s);
  assert.equal(s.assault.phase,'rest');assert.equal(s.coins,before+50);
  s.time+=11.9;drive(s);assert.equal(s.assault.phase,'rest');
  s.time+=.2;drive(s);assert.equal(s.assault.phase,'boss-warning');
});

test('formations and main gates cannot repeat three times, and service resonance requires a hangar',()=>{
  const s=sandbox();s.rng.next=()=>0;s.wave.index=6;
  const history=[];
  for(let i=0;i<10;i++){
    s.assault.phase='rest';s.assault.plan=[];s.wave.nextAt=s.time+10;drive(s);
    const p=s.assault.wave;history.push(p);
    assert.ok(!s.assault.nodeChoices.includes(3));
    if(history.length>=3){const last=history.slice(-3);assert.ok(new Set(last.map(p=>p.gate)).size>1);assert.ok(new Set(last.map(p=>p.formation)).size>1);}
    s.wave.index++;s.time+=100;
  }
});

test('a splitting elite at capacity defers both children and preserves its wave strength',()=>{
  const s=sandbox();removeModule(s,0);
  const parent=spawnEnemy(s,'wisp',{x:1000,y:500},{elite:true,affix:'split',waveIndex:3,threat:2});parent.gate=1;
  for(let i=1;i<GAME_CONFIG.combat.maxEnemies;i++)spawnEnemy(s,'wisp',{x:1000,y:500},{waveIndex:4});
  damageEnemy(s,parent,parent.maxHp*10);tick(s,1/60);
  assert.equal(s.assault.deferredSpawns.length,2);
  tick(s,1/60);assert.equal(s.assault.deferredSpawns.length,1);
  const blocker=s.enemies.find(e=>!e.splitChild);damageEnemy(s,blocker,blocker.maxHp*10);tick(s,2/60);
  assert.equal(s.assault.deferredSpawns.length,0);
  const children=s.enemies.filter(e=>e.splitChild);assert.equal(children.length,2);
  assert.ok(children.every(e=>e.spawnThreat===2&&e.waveIndex===3&&e.gate===1&&!e.elite));
});

test('boss death waits for summons and live projectiles before starting the rest window',()=>{
  const s=sandbox();Object.assign(s.assault,{phase:'boss',resumePhase:'rest'});
  const minion=spawnEnemy(s,'wisp',{x:1000,y:500});drive(s);assert.equal(s.assault.phase,'boss');
  minion.hp=0;s.hostileProjectiles.push({life:1});drive(s);assert.equal(s.assault.phase,'boss');
  s.hostileProjectiles=[];drive(s);assert.equal(s.assault.phase,'rest');assert.equal(s.wave.nextAt-s.time,22);
});

test('crossed boss milestones are queued once even if threat is recalculated',()=>{
  const s=sandbox();spawnEnemy(s,'wisp',{x:1000,y:500});s.assault.difficultyTime=19*45;
  tick(s,1/60);assert.deepEqual(s.assault.pendingBosses,['boss','colossus','sovereign']);
  s.threat=1;tick(s,1/60);assert.deepEqual(s.assault.pendingBosses,['boss','colossus','sovereign']);
});
