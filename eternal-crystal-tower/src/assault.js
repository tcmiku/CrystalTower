import { modulesAdjacent, installedModule, MODULE_BALANCE } from './modules.js';
import { GAME_CONFIG, getArenaEdgePosition } from './config.js';
import { FORMATIONS } from './chapter-one.js';

export const GATES = Object.freeze([
  { name: '北侧裂口', short: '北', angle: -Math.PI / 2, color: '#90caff', node: '寒晶脉冲', benefit: '中圈敌军冻结 3 秒' },
  { name: '东侧通道', short: '东', angle: 0, color: '#80efdc', node: '截光屏障', benefit: '拦截本入口 6 枚普通敌弹' },
  { name: '南侧裂口', short: '南', angle: Math.PI / 2, color: '#ffd18a', node: '近圈守护', benefit: '近圈危急时获得 100 护盾' },
  { name: '西侧通道', short: '西', angle: Math.PI, color: '#bda3ff', node: '快速整备', benefit: '本波无人机整备回电 +40%' }
]);
export const ASSAULT_RULES = Object.freeze({ warning: 10, rest: 12, approachSpeed: 120, battleRadius: 360, vanguardDuration: 10, mainDuration: 24, missionDuration: 12 });
const OPENING = [['scout',0],['rush',2],['wall',0],['battery',1],['brood',3],['pincer',0]];
export const assaultFormation = key => FORMATIONS[key] ?? { name: key === 'scout' ? '裂口试探' : '疾行突袭', hint: key === 'scout' ? '观察北侧入口 · 提升晶塔伤害' : '快速敌军突进 · 留意内圈漏怪' };
export const angleDistance = (a,b) => Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
export const gatePoint = (gate,radius=360,lane=0) => {
  const a=GATES[gate].angle;
  return {x:720+Math.cos(a)*radius-Math.sin(a)*lane,y:500+Math.sin(a)*radius+Math.cos(a)*lane};
};
export function createAssaultState() {
  return { phase:'rest', plan:[], deferredSpawns:[], pendingBosses:[], bossMilestones:[], difficultyTime:0, history:[], bossAt:null, resonance:null, nodeChoices:[], mission:null, salvageAvailable:false, autoRecall:true, lastCleared:0, lastGate:0 };
}
// Only the finite attack window advances difficulty. Waiting for the last enemy
// or a free arena slot cannot make the next wave grow indefinitely.
export function advanceAssaultDifficulty(state,dt) {
  const a=state.assault;
  if(!['vanguard','main'].includes(a.phase))return;
  const end=a.contactAt+ASSAULT_RULES.vanguardDuration+ASSAULT_RULES.mainDuration;
  a.difficultyTime+=Math.max(0,Math.min(state.time,end)-Math.max(state.time-dt,a.contactAt));
}
export function planAssault(state) {
  const index=state.wave.index+1, opening=OPENING[index-1];
  const history=state.assault.history,previous=history.at(-1),repeated=previous&&history.at(-2);
  const formations=['wall','pincer','brood','battery'].filter(f=>!repeated||previous.formation!==f||repeated.formation!==f);
  const gates=[0,1,2,3].filter(g=>!repeated||previous.gate!==g||repeated.gate!==g);
  const formation=opening?.[0] ?? formations[Math.floor(state.rng.next()*formations.length)];
  const gate=opening?.[1] ?? gates[Math.floor(state.rng.next()*gates.length)];
  const secondary=formation==='pincer'?(gate+2)%4:index>6?(gate+1)%4:null;
  const base=[12,14,18,20,22,26][index-1]??Math.min(90,18+index*3);
  const weight=({scout:1,rush:1,wall:.65,battery:.7,brood:.8,pincer:.9})[formation];
  const count=Math.ceil(base*weight*(state.threatSeals?.modifiers?.waveCountMultiplier??1));
  return { index, formation, gate, secondary, count, threat:state.threat };
}
// Authored narrow ingress lanes go through the cardinal gaps in the model.
// Units march quickly outside the firing line, then retain their combat speed.
export function assaultRoute(gate,lane=0) {
  const edge=getArenaEdgePosition(GATES[gate].angle,6), a=GATES[gate].angle;
  const spawn={x:edge.x-Math.sin(a)*lane,y:edge.y+Math.cos(a)*lane};
  const target=gatePoint(gate,ASSAULT_RULES.battleRadius,lane);
  const travel=Math.hypot(target.x-spawn.x,target.y-spawn.y)/ASSAULT_RULES.approachSpeed;
  return {spawn,target,travel};
}
function planUnit(state,gate,type,arrival,extra={}) {
  const route=assaultRoute(gate,(state.rng.next()-.5)*76);
  return {type,gate,arrival,at:arrival-route.travel,...route,...extra};
}
function beginWarning(state,eliteCount) {
  const a=state.assault,w=state.wave,p=planAssault(state);
  Object.assign(w,{direction:p.gate,secondary:p.secondary,formation:p.formation,sectorCount:4,warningStarted:true,remaining:p.count});
  a.wave=p;a.phase='warning';a.salvageAvailable=false;a.contactAt=w.nextAt;a.mainAt=w.nextAt+ASSAULT_RULES.vanguardDuration;
  a.history.push({gate:p.gate,formation:p.formation});a.history=a.history.slice(-2);
  const eligible=[p.gate,(p.gate+1)%4,(p.gate+2)%4,(p.gate+3)%4].filter(g=>g!==3||installedModule(state,'hangar'));
  a.nodeChoices=p.index>=5&&(p.index-5)%3===0?eligible.slice(0,2):[];
  a.resonance=null;
  const frontCount=Math.max(3,Math.floor(p.count*.2));
  const types=FORMATIONS[p.formation]?.types??(p.formation==='scout'?['wisp']:['runner','crawler']);
  a.plan=[];
  const scheduledCount=p.formation==='brood'?Math.max(frontCount+1,p.count-8):p.count;
  const elites=Math.min(eliteCount,scheduledCount-frontCount);
  for(let i=0;i<scheduledCount;i++) {
    const front=i<frontCount;
    const gate=p.secondary!==null&&(p.formation==='pincer'?i%2===1:!front&&i%5===0)?p.secondary:p.gate;
    const arrival=w.nextAt+(front?Math.floor(i/2)*1.5:ASSAULT_RULES.vanguardDuration+(i-frontCount)/Math.max(1,scheduledCount-frontCount-1)*ASSAULT_RULES.mainDuration);
    const type=front?(p.formation==='wall'?'brute':'wisp'):types[(i-frontCount)%types.length];
    const elite=!front&&i>=scheduledCount-elites;
    const brood=p.formation==='brood'&&i===frontCount;
    a.plan.push(planUnit(state,gate,brood?'sentinel':type,arrival,{elite,brood,waveIndex:p.index}));
  }
  // Four finite hatch groups replace eight scheduled units in the wave budget.

  a.plan.sort((x,y)=>x.at-y.at);
  state.events.push({type:'waveWarning',index:p.index,direction:p.gate});
}
export function chooseResonance(state,gate) {
  const a=state.assault;
  if(!a||state.over||a.phase!=='warning'||a.resonance||!a.nodeChoices.includes(gate))return false;
  a.resonance={gate,used:false,charges:6};
  // The price is explicit and bounded; added units always belong to this wave.
  for(let i=0;i<3;i++)a.plan.push(planUnit(state,gate,'brute',a.mainAt+4+i*2,{waveIndex:a.wave.index}));
  a.plan.sort((x,y)=>x.at-y.at);state.wave.remaining+=3;
  state.events.push({type:'resonanceChosen',gate});return true;
}
export function startSalvage(state) {
  const a=state.assault,hangar=state.tower.moduleBay?.installed.find(m=>m.id==='hangar');
  if(!a||!hangar||state.over||!a.salvageAvailable||a.mission||!['rest','cleanup'].includes(a.phase)||state.tower.droneEnergy<25||!state.drones.length)return false;
  const idle=state.drones.filter(d=>!d.recoveryTimer);
  const count=Math.min(2,Math.max(1,Math.floor(state.drones.length/2)),idle.length);
  if(!count)return false;
  const ids=idle.slice(0,count).map(d=>d.index);
  a.mission={ids,progress:0,phase:'outbound',gate:(a.lastGate+2)%4,reward:45+state.wave.index*5,earned:0};
  a.salvageAvailable=false;state.tower.droneEnergy-=15;
  state.events.push({type:'salvageStarted'});return true;
}
export function recallSalvage(state) {
  const m=state.assault?.mission;
  if(!m||m.phase==='returning')return false;
  m.phase='returning';m.earned=Math.floor(m.reward*Math.min(1,m.progress/ASSAULT_RULES.missionDuration));return true;
}
export function updateSalvage(state,dt) {
  const a=state.assault,m=a?.mission;if(!m)return;
  const hangar=state.tower.moduleBay?.installed.find(m=>m.id==='hangar');
  if(!hangar||!m.ids.every(id=>state.drones.some(d=>d.index===id))){for(const d of state.drones)if(m.ids.includes(d.index))d.phase=null;a.mission=null;return;}
  if((a.autoRecall&&a.phase==='warning'&&state.wave.nextAt-state.time<=5)||a.phase==='boss'||a.phase==='boss-warning'||state.tower.droneEnergy<=0)recallSalvage(state);
  if(m.phase!=='returning')state.tower.droneEnergy=Math.max(0,state.tower.droneEnergy-dt);
  const returning=m.phase==='returning';
  const destination=returning?{x:720,y:500}:gatePoint(m.gate,410,65);
  const service=modulesAdjacent(state,'hangar','service')?installedModule(state,'service'):null;
  const speed=(m.phase==='returning'?340:285)*(1+(hangar.level-1)*MODULE_BALANCE.hangar.speedPerLevel)*(m.phase==='returning'&&service?.level>=2?MODULE_BALANCE.service.returnMultiplier:1);
  let arrived=true;
  for(const id of m.ids){const d=state.drones.find(d=>d.index===id);if(!d)continue;const dx=destination.x-d.x,dy=destination.y-d.y,dist=Math.hypot(dx,dy);const step=Math.min(dist,speed*dt);if(dist>8)arrived=false;d.x+=dx/(dist||1)*step;d.y+=dy/(dist||1)*step;d.angle=Math.atan2(dy,dx);d.targetId=null;d.phase='salvage';}
  if(arrived&&m.phase==='outbound')m.phase='working';
  if(m.phase==='working'){m.progress+=dt;if(m.progress>=ASSAULT_RULES.missionDuration)recallSalvage(state);}
  if(arrived&&returning){state.coins+=m.earned;for(const d of state.drones)if(m.ids.includes(d.index))d.phase=null;state.events.push({type:'salvageComplete',coins:m.earned});a.mission=null;}
}
function expireResonance(state){
  const r=state.assault.resonance;
  if(r?.shieldRemaining>0)state.tower.shield=Math.max(0,state.tower.shield-r.shieldRemaining);
  state.assault.resonance=null;
}
export function updateResonance(state,dt) {
  const a=state.assault,r=a?.resonance;if(!r||!['vanguard','main','cleanup'].includes(a.phase))return;
  const inGate=e=>angleDistance(Math.atan2(e.y-500,e.x-720),GATES[r.gate].angle)<Math.PI/6;
  if(r.gate===0&&!r.used&&state.enemies.some(e=>e.hp>0&&inGate(e)&&Math.hypot(e.x-720,e.y-500)<330)){
    for(const e of state.enemies)if(e.hp>0&&inGate(e)&&Math.hypot(e.x-720,e.y-500)<=360&&!['boss','colossus','sovereign','anchor'].includes(e.type))e.freezeTimer=Math.max(e.freezeTimer??0,3);
    r.used=true;state.events.push({type:'resonancePulse',gate:r.gate});
  }
  if(r.gate===1&&r.charges>0)for(const p of state.hostileProjectiles)if(p.life>0&&p.interceptable&&inGate(p)&&Math.hypot(p.x-720,p.y-500)<300){p.life=0;r.charges--;if(r.charges<=0)break;}
  if(r.gate===2&&!r.used&&state.enemies.some(e=>e.hp>0&&Math.hypot(e.x-720,e.y-500)<145)){state.tower.shield+=100;r.shieldRemaining=100;r.used=true;state.events.push({type:'resonancePulse',gate:r.gate});}
}
export function updateAssault(state,dt,{spawn,eliteCount=0}) {
  const a=state.assault,w=state.wave;
  while(a.deferredSpawns.length&&state.enemies.length<GAME_CONFIG.combat.maxEnemies){
    const unit=a.deferredSpawns[0],enemy=spawn(unit.type,unit.position,unit.options);
    if(!enemy)break;
    enemy.gate=unit.gate;a.deferredSpawns.shift();
  }
  const boss=state.enemies.some(e=>e.hp>0&&['boss','colossus','sovereign'].includes(e.type));
  if(boss){
    if(a.phase!=='boss'){a.resumePhase=a.phase;a.phase='boss';recallSalvage(state);}
    w.nextAt+=dt;if(Number.isFinite(a.contactAt))a.contactAt+=dt;if(Number.isFinite(a.mainAt))a.mainAt+=dt;
    for(const unit of a.plan){unit.at+=dt;unit.arrival+=dt;}
    return;
  }
  if(a.phase==='boss') {
    if(state.enemies.some(e=>e.hp>0&&e.type!=='anchor')||a.deferredSpawns.length||state.hostileProjectiles.some(p=>p.life>0)||state.summonRifts.length)return;
    a.phase=a.resumePhase==='boss-warning'?'rest':a.resumePhase??'rest';
    if(a.phase==='rest'){a.bossRestUntil=state.time+ASSAULT_RULES.rest;w.nextAt=state.time+ASSAULT_RULES.rest+ASSAULT_RULES.warning;a.salvageAvailable=Boolean(installedModule(state,'hangar'));}
  }
  if(a.phase==='boss-warning'){
    if(state.time>=a.bossAt){const type=a.pendingBosses[0];if(spawn(type,type==='sovereign'?{x:720,y:200}:gatePoint(0,430))){a.pendingBosses.shift();a.phase='boss';a.resumePhase='rest';}}
    return;
  }
  const occupied=state.enemies.some(e=>e.hp>0&&e.type!=='anchor');
  if(a.phase==='cleanup'&&!occupied&&!a.deferredSpawns.length&&!state.hostileProjectiles.some(p=>p.life>0)&&!state.summonRifts.length){
    a.lastCleared=w.index;a.lastGate=w.direction;a.phase='rest';expireResonance(state);a.nodeChoices=[];
    a.salvageAvailable=Boolean(state.tower.moduleBay.installed.some(m=>m.id==='hangar'));
    w.nextAt=state.time+ASSAULT_RULES.rest+ASSAULT_RULES.warning;w.direction=null;
    const reward=w.index<=2?50:20+w.index*5;state.coins+=reward;
    state.events.push({type:'assaultRest',coins:reward});
  }
  if(a.pendingBosses.length&&state.time<(a.bossRestUntil??0))return;
  if(a.pendingBosses.length&&!w.active&&!a.plan.length&&!a.deferredSpawns.length&&!occupied&&!state.hostileProjectiles.some(p=>p.life>0)&&!state.summonRifts.length){a.phase='boss-warning';a.bossAt=state.time+ASSAULT_RULES.warning;w.warningStarted=false;expireResonance(state);a.salvageAvailable=false;recallSalvage(state);state.events.push({type:'assaultBossWarning',boss:a.pendingBosses[0]});return;}
  if(a.pendingBosses.length&&a.phase==='rest'&&occupied){w.nextAt=Math.max(w.nextAt,state.time+ASSAULT_RULES.rest);return;}
  if(a.phase==='rest'&&state.time>=w.nextAt-ASSAULT_RULES.warning){beginWarning(state,eliteCount);}
  if(a.phase==='warning'&&state.time>=w.nextAt){a.phase='vanguard';w.index=a.wave.index;w.active=true;w.warningStarted=false;state.events.push({type:'waveStart',index:w.index,direction:w.direction,count:a.wave.count,endless:state.endlessMode,eliteCount});}
  if(a.phase==='vanguard'&&state.time>=a.mainAt)a.phase='main';
  if(['warning','vanguard','main'].includes(a.phase)){
    while(a.plan.length&&a.plan[0].at<=state.time){
      if(state.enemies.length>=GAME_CONFIG.combat.maxEnemies)break;
      const unit=a.plan[0];const e=spawn(unit.type,unit.spawn,{elite:unit.elite,waveElite:unit.elite,waveIndex:unit.waveIndex,threat:a.wave.threat});
      if(!e)break; // A full arena delays a scheduled unit rather than dropping it.
      a.plan.shift();e.gate=unit.gate;e.approachTarget=unit.target;e.formation=w.formation;e.formationFront=w.formation==='wall'&&e.type==='brute';
      if(w.formation==='wall'){e.formationSpeed=e.speed;e.speed=Math.min(e.speed,24);}
      if(unit.brood){e.broodRemaining=4;e.broodTimer=6;e.speed*=.5;}
      if(w.formation==='battery'&&e.attackRange>0){e.volleyAt=null;e.battery=true;}
      w.remaining=a.plan.length;
    }
    if(!a.plan.length&&a.phase==='main'&&state.time>=a.mainAt+ASSAULT_RULES.mainDuration){a.phase='cleanup';a.cleanupAt=state.time;w.active=false;w.pendingClear.push(w.index);state.events.push({type:'waveEnd',index:w.index});}
  }

}
export function assaultStatus(state){
  const a=state.assault,w=state.wave;if(!a)return '';
  if(a.phase==='rest')return `整备 · ${Math.ceil(Math.max(0,w.nextAt-state.time))} 秒后接敌`;
  if(a.phase==='boss-warning')return `首领接近 · ${Math.ceil(Math.max(0,a.bossAt-state.time))} 秒`;
  if(a.phase==='boss')return '首领战 · 普通增援暂停';
  const name={warning:'预警',vanguard:'前锋',main:'主攻',cleanup:'清理残敌'}[a.phase];
  return `${name} · ${GATES[w.direction]?.short??''}${w.secondary!=null?' + '+GATES[w.secondary].short:''} · ${assaultFormation(w.formation).name}${a.phase==='warning'?` · ${Math.ceil(Math.max(0,w.nextAt-state.time))} 秒后接敌`:''}`;
}
