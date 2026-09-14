import { GAME_CONFIG } from './config.js';

export const FORT_RULES = Object.freeze({ grid: 30, inner: 150, radii: [300, 330, 360, 360], walls: [24, 32, 40, 48], guns: [3, 4, 5, 6] });
export const FORT_TYPES = Object.freeze({
  wall: { name: '晶钢围墙', size: 30, cost: 15, hp: 240, buildTime: 3 },
  gun: { name: '晶脉机枪', size: 60, cost: 100, hp: 180, buildTime: 6 }
});
const center = { x: GAME_CONFIG.arena.centerX, y: GAME_CONFIG.arena.centerY };
const heavyTypes = new Set(['brute', 'sentinel', 'rammer', 'rustBeetle', 'porcelainWarden', 'boss', 'colossus', 'sovereign']);
export const createFortifications = () => ({ items: [], revision: 0, credit: 130, shots: [], breachAt: -99 });
export const fortPlanning = s => ['rest', 'warning', 'boss-warning'].includes(s.assault?.phase) && !s.enemies.some(e => e.hp > 0);
export const fortLimits = s => { const tier = Math.max(0, Math.min(3, s.tower.upgrades.ascend)); return { radius: FORT_RULES.radii[tier], wall: FORT_RULES.walls[tier], gun: FORT_RULES.guns[tier] }; };
export const snapFort = p => ({ x: center.x + Math.round((p.x-center.x)/30)*30, y: center.y + Math.round((p.y-center.y)/30)*30 });
export const solidForts = s => s.fortifications?.items.filter(b => b.hp > 0 && b.construction <= 0) ?? [];
export const fortAt = (s,p) => s.fortifications?.items.find(b => Math.abs(b.x-p.x)<=b.size/2 && Math.abs(b.y-p.y)<=b.size/2);
const liveForts = s => s.fortifications?.items.filter(b => b.hp > 0) ?? [];
export function wallLine(a,b) {
  a=snapFort(a);b=snapFort(b); const result=[];
  let x=a.x,y=a.y; result.push({x,y});
  // Orthogonal joins never leave diagonal holes in a dragged wall.
  while(x!==b.x && result.length<80){x+=Math.sign(b.x-x)*30;result.push({x,y});}
  while(y!==b.y && result.length<80){y+=Math.sign(b.y-y)*30;result.push({x,y});}
  return result;
}
export function fortPlacement(s,type,points,{ignoreId=null}={}) {
  const cfg=FORT_TYPES[type];
  if(!s.fortifications||s.over||!cfg||!points.length)return {ok:false,reason:'当前无法建造'};
  const snapped=points.map(snapFort),half=cfg.size/2,limits=fortLimits(s);
  if(liveForts(s).filter(b=>b.type===type&&b.id!==ignoreId).length+points.length>limits[type])return {ok:false,reason:'已达工事数量上限'};
  for(let i=0;i<snapped.length;i++){
    const p=snapped[i];
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return {ok:false,reason:'无效位置'};
    const dx=Math.abs(p.x-center.x),dy=Math.abs(p.y-center.y);
    if(Math.hypot(Math.max(0,dx-half),Math.max(0,dy-half))<FORT_RULES.inner)return {ok:false,reason:'中央 150 范围需留空'};
    if(Math.hypot(dx+half,dy+half)>limits.radius)return {ok:false,reason:'超出晶能控制区'};
    if(s.fortifications.items.some(b=>b.id!==ignoreId&&Math.abs(b.x-p.x)<(b.size+cfg.size)/2&&Math.abs(b.y-p.y)<(b.size+cfg.size)/2)
      ||snapped.slice(0,i).some(q=>Math.abs(q.x-p.x)<cfg.size&&Math.abs(q.y-p.y)<cfg.size))return {ok:false,reason:'位置被工事或废墟占用'};
    if(s.enemies.some(e=>e.hp>0&&Math.abs(e.x-p.x)<half+e.radius+2&&Math.abs(e.y-p.y)<half+e.radius+2)
      ||s.decoys.some(e=>e.hp>0&&Math.abs(e.x-p.x)<half+e.radius&&Math.abs(e.y-p.y)<half+e.radius))return {ok:false,reason:'位置被单位占用'};
  }
  const cost=cfg.cost*snapped.length,credit=Math.min(cost,s.fortifications.credit);
  return {ok:s.coins+credit>=cost,reason:s.coins+credit>=cost?'可以建造':`还差 ${Math.ceil(cost-credit-s.coins)} 金币`,cost,credit,points:snapped};
}
export function buildForts(s,type,points) {
  const status=fortPlacement(s,type,points);if(!status.ok)return status;
  const cfg=FORT_TYPES[type],instant=fortPlanning(s);let credit=status.credit;
  for(const p of status.points){const funded=Math.min(credit,cfg.cost);credit-=funded;
    s.fortifications.items.push({id:s.nextId++,type,...p,size:cfg.size,hp:cfg.hp,maxHp:cfg.hp,level:1,invested:cfg.cost,paid:cfg.cost-funded,credit:funded,
      construction:instant?0:cfg.buildTime,buildTime:cfg.buildTime,lastHit:-99,repairing:false,cooldown:0,aim:-Math.PI/2,priority:'near',fresh:instant});}
  s.coins-=status.cost-status.credit;s.fortifications.credit-=status.credit;s.fortifications.revision++;
  return {...status,reason:instant?'工事已部署':'施工开始 · 工地可受伤，完工前不阻挡'};
}
export function fortAction(s,id,action,point) {
  const f=s.fortifications,b=f?.items.find(b=>b.id===id);if(!b||s.over)return {ok:false,reason:'未选中工事'};
  const safe=fortPlanning(s);
  if(action==='priority'){b.priority=({near:'fast',fast:'ranged',ranged:'near'})[b.priority];return {ok:true,reason:'目标优先级已切换'};}
  if(action==='remove'){
    const undo=safe&&b.fresh&&b.hp===b.maxHp;
    s.coins+=undo?b.paid:Math.floor(b.paid*.6*Math.max(0,b.hp/b.maxHp));
    if(undo)f.credit+=b.credit;
    f.items=f.items.filter(item=>item!==b);f.revision++;return {ok:true,reason:undo?'已撤销新建工事':'已拆除 · 按剩余耐久返还金币'};
  }
  if(action==='move'){
    if(!safe||b.hp<=0)return {ok:false,reason:'整备或预警清场后才能移动'};
    const status=fortPlacement(s,b.type,[point],{ignoreId:id});
    if(!status.points)return status;
    Object.assign(b,status.points[0]);b.fresh=false;f.revision++;return {ok:true,reason:'已移动 · 保留原有耐久'};
  }
  if(action==='rebuild'){
    if(b.hp>0)return {ok:false,reason:'该工事尚未摧毁'};
    const status=fortPlacement(s,b.type,[b],{ignoreId:id});if(!status.points)return status;
    const cost=b.invested;if(s.coins<cost)return {ok:false,reason:`重建需要 ${cost} 金币`};
    s.coins-=cost;Object.assign(b,{hp:b.maxHp,paid:cost,credit:0,construction:safe?0:FORT_TYPES[b.type].buildTime,repairing:false,fresh:false});f.revision++;
    return {ok:true,reason:'已安排重建'};
  }
  if(action==='upgrade'){
    if(!safe||b.hp<=0||b.level>=3)return {ok:false,reason:'清场整备时升级，最高 III 级'};
    const cost=Math.round(FORT_TYPES[b.type].cost*(1.5**b.level));if(s.coins<cost)return {ok:false,reason:`升级需要 ${cost} 金币`};
    const ratio=b.hp/b.maxHp;s.coins-=cost;b.level++;b.invested+=cost;b.paid+=cost;b.maxHp=Math.round(FORT_TYPES[b.type].hp*(1+.6*(b.level-1)));b.hp=b.maxHp*ratio;b.fresh=false;
    return {ok:true,reason:'工事已升级 · 保留耐久比例'};
  }
  if(action==='repair'){
    if(b.hp<=0||b.hp>=b.maxHp||b.construction>0)return {ok:false,reason:'请选择受损且已完工的工事'};
    b.repairing=!b.repairing;return {ok:true,reason:b.repairing?'维修已开启 · 按实际修复扣费，受击后等待 3 秒':'维修已停止'};
  }
  return {ok:false,reason:'无效操作'};
}
export function damageFort(s,b,damage) {
  if(!b||b.hp<=0)return;
  b.hp=Math.max(0,b.hp-damage);b.lastHit=s.time;b.fresh=false;
  if(b.hp===0){b.repairing=false;s.fortifications.revision++;
    if(s.time-s.fortifications.breachAt>2){s.fortifications.breachAt=s.time;const dx=b.x-center.x,dy=b.y-center.y;
      s.events.push({type:'fortBreach',direction:Math.abs(dx)>Math.abs(dy)?dx>0?'东':'西':dy>0?'南':'北',x:b.x,y:b.y});}}
}
// Swept segment vs expanded rectangle: used by walking, forces, and enemy bolts.
export function segmentFort(a,z,b,pad=0) {
  const h=b.size/2+pad;let enter=0,leave=1;
  for(const key of ['x','y']){const d=z[key]-a[key],lo=b[key]-h,hi=b[key]+h;
    if(Math.abs(d)<1e-9){if(a[key]<lo||a[key]>hi)return null;continue;}
    let t1=(lo-a[key])/d,t2=(hi-a[key])/d;if(t1>t2)[t1,t2]=[t2,t1];enter=Math.max(enter,t1);leave=Math.min(leave,t2);if(enter>leave)return null;
  }
  return enter;
}
export function firstFort(s,a,z,pad=0,includeSites=false) {
  let hit=null,t=Infinity;
  for(const b of includeSites?liveForts(s):solidForts(s)){const n=segmentFort(a,z,b,pad);if(n!==null&&n<t){hit=b;t=n;}}
  return hit?{building:hit,t}:null;
}
export function moveFortEnemy(s,e,p) {
  const hit=firstFort(s,e,p,e.radius+1);
  if(hit){const t=Math.max(0,hit.t-.002);e.x+=(p.x-e.x)*t;e.y+=(p.y-e.y)*t;return hit.building;}
  e.x=p.x;e.y=p.y;return null;
}
export function clearFortSpawn(s,e,origin=e) {
  if(!firstFort(s,e,e,e.radius+2))return;
  const initial={x:e.x,y:e.y};
  // Keep summons on their source's side of a wall; do not jump them through it.
  for(let r=30;r<=240;r+=30)for(let i=0;i<16;i++){
    const a=i*Math.PI/8,p={x:initial.x+Math.cos(a)*r,y:initial.y+Math.sin(a)*r};
    if(firstFort(s,p,p,e.radius+2))continue;
    if(origin!==e&&firstFort(s,origin,p,0))continue;
    e.x=p.x;e.y=p.y;return;
  }
}
export function fortArtilleryTarget(s,boss,fallback) {
  const items=liveForts(s);if(!items.length)return fallback;
  boss.fortSalvo=(boss.fortSalvo??0)+1;
  // Alternate pressure on the core with visible bombardment of dense defenses.
  if(boss.fortSalvo%2)return fallback;
  return items.map(b=>({b,count:items.filter(c=>Math.hypot(c.x-b.x,c.y-b.y)<90).length}))
    .sort((a,b)=>b.count-a.count||a.b.id-b.b.id)[0].b;
}
// Bounded A*: only runs for blocked units, with per-unit path reuse and stable ties.
function detour(s,e,target,maxExtra) {
  const step=30,solids=solidForts(s),key=(x,y)=>`${x},${y}`;
  const start={x:e.x,y:e.y,g:0,parent:null};start.key=key(0,0);start.ix=0;start.iy=0;
  const open=[start],best=new Map([[start.key,0]]),direct=Math.hypot(target.x-e.x,target.y-e.y);
  let attempts=0;
  while(open.length&&attempts++<350){
    open.sort((a,b)=>a.f-b.f||a.g-b.g);const n=open.shift();
    if(!solids.some(b=>segmentFort(n,target,b,e.radius+2)!==null)){
      if(n.g+Math.hypot(target.x-n.x,target.y-n.y)>direct+maxExtra)return null;
      const path=[];for(let p=n;p.parent;p=p.parent)path.unshift({x:p.x,y:p.y});return path;
    }
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]){
      const ix=n.ix+dx,iy=n.iy+dy,p={x:e.x+ix*step,y:e.y+iy*step},g=n.g+Math.hypot(dx,dy)*step,h=Math.hypot(target.x-p.x,target.y-p.y),k=key(ix,iy);
      if(g+h>direct+maxExtra||g>=(best.get(k)??Infinity)||solids.some(b=>segmentFort(n,p,b,e.radius+2)!==null))continue;
      best.set(k,g);open.push({...p,ix,iy,key:k,g,f:g+h,parent:n});
    }
  }
  return null;
}
export function fortEnemyTarget(s,e,target) {
  if(!s.fortifications||!liveForts(s).length)return {target};
  const ranged=e.attackRange>0;
  if(ranged){
    const gun=liveForts(s).filter(b=>b.type==='gun'&&Math.hypot(b.x-e.x,b.y-e.y)<e.attackRange+b.size/2+e.radius)
      .sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y)||a.id-b.id)[0];
    if(gun)target=gun;
  }
  const hit=firstFort(s,e,target,e.radius+2,true);
  if(!hit)return {target};
  const b=hit.building;
  if(ranged)return {target:b};
  if(heavyTypes.has(e.type))return {target:b};
  if(b.construction>0)return {target};
  if(!e.fortPath||e.fortRevision!==s.fortifications.revision||s.time>e.fortRepathAt||e.fortDestination!==target.id){
    e.fortPath=detour(s,e,target,['runner','crawler'].includes(e.type)?330:120)??[];
    e.fortRevision=s.fortifications.revision;e.fortRepathAt=s.time+2;e.fortDestination=target.id;
  }
  while(e.fortPath.length&&Math.hypot(e.fortPath[0].x-e.x,e.fortPath[0].y-e.y)<3)e.fortPath.shift();
  return e.fortPath.length?{target,waypoint:e.fortPath[0]}:{target:b};
}
export function stepFortEnemy(s,e,target,dt,{damageTower,intervalMultiplier=1}) {
  if(!s.fortifications||!liveForts(s).length)return false;
  const choice=fortEnemyTarget(s,e,target),t=choice.target,b=s.fortifications.items.includes(t)?t:null;
  const dx=t.x-e.x,dy=t.y-e.y,distance=Math.hypot(dx,dy)||1;
  const reach=b?Math.max(Math.abs(dx)-b.size/2,Math.abs(dy)-b.size/2):distance-(t.radius??38);
  const speed=e.freezeTimer>0?0:e.speed*(e.gravitySlow??1)*(e.mineSlow??1);
  if(e.type==='rammer'&&b&&!choice.waypoint&&reach<150){
    if(e.freezeTimer>0||e.moduleSuppression>0){e.fortCharge=null;e.fortChargeCooldown=s.time+2;return true;}
    if(!e.fortCharge&&s.time>=(e.fortChargeCooldown??0))e.fortCharge={x:b.x,y:b.y,id:b.id,remaining:1.5,travel:170};
    if(e.fortCharge){const c=e.fortCharge;c.remaining-=dt;
      if(c.remaining<=0){const len=Math.hypot(c.x-e.x,c.y-e.y)||1,travel=Math.min(c.travel,260*dt);const hit=moveFortEnemy(s,e,{x:e.x+(c.x-e.x)/len*travel,y:e.y+(c.y-e.y)/len*travel});c.travel-=travel;
        if(hit){damageFort(s,hit,e.damage*3);e.fortCharge=null;e.fortChargeCooldown=s.time+5;}
        else if(c.travel<=0||len<3){e.fortCharge=null;e.fortChargeCooldown=s.time+5;}}
      return true;
    }
  }else e.fortCharge=null;
  if(choice.waypoint||reach>e.radius+3+(e.attackRange??0)){
    const p=choice.waypoint??t,d=Math.hypot(p.x-e.x,p.y-e.y)||1,travel=Math.min(d,speed*dt);
    moveFortEnemy(s,e,{x:e.x+(p.x-e.x)/d*travel,y:e.y+(p.y-e.y)/d*travel});e.attackCooldown=0;return true;
  }
  if(e.freezeTimer>0||e.moduleSuppression>0)return true;
  e.attackCooldown-=dt;
  if(e.volleyAt!=null){if(s.time<e.volleyAt)return true;e.volleyAt=Math.ceil((s.time+.1)/6)*6;e.attackCooldown=0;}
  if(e.attackCooldown>0)return true;
  const interval=GAME_CONFIG.combat.enemyAttackInterval*intervalMultiplier,damage=e.damage*GAME_CONFIG.combat.enemyAttackInterval*(e.volleyAt!=null?3:1);
  if(e.attackRange>0){const v=300;s.hostileProjectiles.push({id:s.nextId++,kind:'enemyBolt',interceptable:true,x:e.x,y:e.y,vx:dx/distance*v,vy:dy/distance*v,targetX:t.x,targetY:t.y,
    fortId:b?.id??null,decoyId:!b&&t.id?t.id:null,radius:6,life:distance/v+1,damage,heavy:heavyTypes.has(e.type),source:e.type});e.rangedFlash=.16;
  }else{
    // Only enemies with an unobstructed contact slot can bite, never rear rows.
    const blocked=s.enemies.some(other=>other!==e&&other.hp>0&&Math.hypot(other.x-t.x,other.y-t.y)<distance-4&&Math.hypot(other.x-e.x,other.y-e.y)<e.radius+other.radius);
    if(blocked){const side=e.id%2?1:-1;moveFortEnemy(s,e,{x:e.x-dy/distance*side*speed*dt,y:e.y+dx/distance*side*speed*dt});return true;}
    if(b)damageFort(s,b,damage*(e.type==='brute'?1.4:1));else if(t.id)t.hp=Math.max(0,t.hp-damage);else damageTower(s,damage,heavyTypes.has(e.type),e.type,e);
  }
  e.attackCooldown=interval;return true;
}
export function updateForts(s,dt,damageEnemy,locked=false) {
  const f=s.fortifications;if(!f)return;
  f.shots=f.shots.filter(shot=>(shot.life-=dt)>0);
  for(const b of f.items){
    if(b.hp<=0)continue;
    if(!fortPlanning(s))b.fresh=false;
    if(b.construction>0){
      // Occupants can pass through a site; completion waits until they leave.
      if(b.construction>dt||!s.enemies.some(e=>e.hp>0&&Math.abs(e.x-b.x)<b.size/2+e.radius+2&&Math.abs(e.y-b.y)<b.size/2+e.radius+2)){
        b.construction=Math.max(0,b.construction-dt);if(b.construction===0)f.revision++;
      }continue;
    }
    if(b.repairing&&s.time-b.lastHit>=3){const price=b.invested*.6/b.maxHp,amount=Math.min(b.maxHp-b.hp,b.maxHp/(fortPlanning(s)?4:15)*dt,s.coins/price);
      b.hp+=amount;s.coins=Math.max(0,s.coins-amount*price);if(b.hp>=b.maxHp)b.repairing=false;}
    if(b.type!=='gun'||locked)continue;
    b.cooldown=Math.max(0,b.cooldown-dt);
    const targets=s.enemies.filter(e=>e.hp>0&&e.type!=='anchor'&&Math.hypot(e.x-b.x,e.y-b.y)<=190+e.radius);
    const rank=e=>b.priority==='fast'?e.speed*100:b.priority==='ranged'?(e.attackRange??0)*100:0;
    targets.sort((a,c)=>rank(c)-rank(a)||Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y)||a.id-c.id);
    const enemy=targets[0];if(!enemy)continue;b.aim=Math.atan2(enemy.y-b.y,enemy.x-b.x);
    if(b.cooldown===0){damageEnemy(s,enemy,3*(1+.7*(b.level-1))*(heavyTypes.has(enemy.type)? .55:1),'fortGun');b.cooldown=.2;f.shots.push({x:b.x,y:b.y-12,tx:enemy.x,ty:enemy.y,life:.1});}
  }
}
