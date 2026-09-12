import { MODULES } from './modules.js';
import { getModuleMount } from './module-model.js';

export const MODULE_ATTACK_DURATION = .45;
// Only actual combat events light up the corresponding equipment.
export function recordModuleAttack(fx,event) {
  let id=null;
  if(event.type==='shoot') id=event.weaponId;
  else if(event.type==='elementHit') id=event.element;
  else if(['sawLaunch','sawBounce','sawShoot','sawStorm','sawHomecoming'].includes(event.type) || ['hit','kill'].includes(event.type) && ['saw','launchedSaw','sawHomecoming','sawGun','sawStorm'].includes(event.source)) id='blade';
  else if(['droneHit','droneWeapon','droneLaunch','droneSalvo','droneDetonate','droneSupport'].includes(event.type)) id='hangar';
  else if(event.type==='sectorBlock' && event.prevented>0) id='shield';
  else if(event.type==='moduleGravity') id='gravity';
  else if(event.type==='moduleIntercept') id='interceptor';
  else if(['moduleService','moduleServiceLaunch'].includes(event.type)) id='service';
  if(MODULES[id]) fx[`attack-${id}`]=MODULE_ATTACK_DURATION;
}

// Bounded, deterministic particles: no game RNG, accumulated emitters or saved state.
export function sampleModuleEffects(module, layout, time, aimYaw=0, attack=0, peers=null) {
  const mount=getModuleMount(module,layout,peers), effects=[], level=Math.max(1,Math.min(3,module.level??1));
  const color=MODULES[module.id].color, phase=time+module.slot*.37;
  const yaw=['pulse','cannon','mortar'].includes(module.id)?aimYaw:mount.yaw;
  const point=([x,y,z])=>[mount.x+mount.scale*(x*Math.cos(yaw)-z*Math.sin(yaw)),mount.y+y*mount.scale,mount.z+mount.scale*(x*Math.sin(yaw)+z*Math.cos(yaw))];
  const path=(points,alpha=.65,width=1,fill=false,tint=color)=>effects.push({points:points.map(point),alpha,width,fill,color:tint});
  const ring=(radius,y,start=0,arc=Math.PI*2,alpha=.5)=>path(Array.from({length:25},(_,i)=>{const a=start+i*arc/24;return [Math.cos(a)*radius,y,Math.sin(a)*radius]}),alpha,1.2);
  const diamond=(x,y,z,r,alpha,tint=color)=>path([[x-r,y,z],[x,y+r,z],[x+r,y,z],[x,y-r,z],[x-r,y,z]],alpha,1,true,tint);
  switch(module.id) {
    case 'mortar':
      for(const z of [-7,7]) diamond(-12,20+Math.sin(phase*3)*2,z,2.3,.7);
      ring(14,12,phase,Math.PI,.4);
      break;
    case 'gravity':
      for(let i=0;i<3;i++) ring(9+i*2,20+i*6,phase*(i%2?-2:2)+i,Math.PI*1.3,.65);
      diamond(0,29,0,3,.6);
      break;
    case 'interceptor':
      path([[0,23,-6],[21,23,-6],[24,23,6],[0,23,6]],.45,1);
      for(let i=0;i<3;i++) diamond(17,20,-6+i*6,1.5,.5);
      break;
    case 'service':
      for(const x of [-6,6]) {const y=22+(phase*8)%12;path([[x-2,y,6],[x+2,y,6]],.8,2);}
      break;
    case 'pulse': case 'cannon': {
      const heavy=module.id==='cannon', length=heavy?30:22;
      for(const side of [-1,1]) {
        const x=6+((phase*1.7)%1)*length;
        path([[x-5,23,side*4],[x,23,side*4]],.55+.35*Math.sin(phase*7)**2,2);
      }
      if(heavy) ring(11,12,phase,Math.PI*1.5,.3);
      break;
    }
    case 'blade':
      for(let i=0;i<3;i++) ring(27+i*.7,18,phase*6+i*Math.PI*2/3,.85,.55-i*.1);
      break;
    case 'hangar': {
      const sweep=(phase*.45)%1;
      path([[-17,12,13],[-17,12,13+sweep*22],[17,12,13+sweep*22],[17,12,13]],(1-sweep)*.5,1.2);
      for(let i=0;i<3;i++) diamond(-11+i*11,20,13,1.6,.25+.7*Math.max(0,Math.sin(phase*4-i*1.5)));
      ring(7,31,phase*2,Math.PI,.5);
      break;
    }
    case 'shield': {
      for(let i=0;i<2;i++) {
        const t=(phase*.55+i*.5)%1,r=14+t*9;
        path(Array.from({length:7},(_,k)=>{const a=Math.PI/6+k*Math.PI/3;return [Math.cos(a)*r,24+Math.sin(a)*r,8+t*4]}),(1-t)*.7,1.4);
      }
      break;
    }
    case 'frost':
      ring(14,16,-phase*.6,Math.PI*1.7,.3);
      for(let i=0;i<5+level;i++) {
        const t=(phase*.24+i*.147)%1,a=i*2.4+phase*.5;
        diamond(Math.cos(a)*(9+t*7),42-t*29,Math.sin(a)*(9+t*7),1.3+t*.8,Math.sin(t*Math.PI)*.75,'#d8faff');
      }
      break;
    case 'fire':
      for(let i=0;i<5+level;i++) {
        const t=(phase*.65+i*.173)%1,a=i*2.4;
        const x=Math.cos(a)*(4+t*6),z=Math.sin(a)*(4+t*6),y=24+t*24;
        const dx=Math.cos(a)*2*(1-t),dz=Math.sin(a)*2*(1-t);
        path([[x-dx,y,z-dz],[x+Math.sin(phase*7+i)*2,y+7*(1-t),z],[x+dx,y,z+dz]],(1-t)*.8,1,true,i%2?'#ffb946':'#ff6844');
      }
      break;
    case 'lightning': {
      const tick=Math.floor(phase*12);
      for(let strand=0;strand<2;strand++) path(Array.from({length:9},(_,i)=>[-8+i*2,29+strand*4+Math.sin(i*11+tick*2+strand)*3,i===0||i===8?0:Math.cos(i*7+tick)*3]),tick%5===0?.15:.85,1.3,false,'#e5d1ff');
      ring(12,16,-phase*1.5,Math.PI*1.25,.4);
      break;
    }
  }
  const power=Math.max(0,Math.min(1,attack/MODULE_ATTACK_DURATION));
  if(power>0) {
    const age=1-power;
    if(module.id==='mortar') {
      path([[11,40,-6],[18+age*12,53+age*28,0],[20,42,6]],power,1,true,'#e9f7ff');
      ring(14+age*20,14,0,Math.PI*2,power*.7);
    } else if(module.id==='gravity') {
      for(let i=0;i<3;i++) ring(26-age*16,18+i*9,phase+i,Math.PI*1.7,power*.8);
    } else if(module.id==='interceptor') {
      for(const z of [-6,0,6]) path([[17,19,z],[31+age*12,22,z]],power,2,false,'#e6fff7');
    } else if(module.id==='service') {
      for(const x of [-6,6]) path([[x-3,22,6],[x,40+age*14,6],[x+3,22,6]],power*.7,1,true,'#d7ffe1');
    } else if(module.id==='pulse'||module.id==='cannon') {
      const heavy=module.id==='cannon',tip=heavy?35:26,reach=(heavy?37:25)*power;
      // Directional muzzle lance, white hot center and a spreading shock collar.
      path([[tip,16,-4],[tip+reach,18,0],[tip,20,4],[tip+4,18,0]],power,1,true,'#fff7de');
      for(const side of [-1,1]) path([[tip,18,side*3],[tip+10+age*16,19+age*8,side*(5+age*9)]],power*.85,2);
      path(Array.from({length:17},(_,i)=>{const a=i*Math.PI/8,r=3+age*12;return [tip+age*14,18+Math.sin(a)*r,Math.cos(a)*r]}),power*.8,2);
    } else if(module.id==='blade') {
      for(let i=0;i<3;i++) ring(29+age*14+i*2,18,phase*6+i*Math.PI*2/3,1.6,power*(.9-i*.2));
    } else if(module.id==='hangar') {
      for(const x of [-11,0,11]) {
        path([[x-3,14,13],[x,14,20+age*27],[x+3,14,13]],power*.8,1,true,'#fff1ad');
        diamond(x,20,13,3*power,power,'#ffffff');
      }
    } else if(module.id==='shield') {
      path(Array.from({length:7},(_,i)=>{const a=Math.PI/6+i*Math.PI/3,r=17+age*12;return [Math.cos(a)*r,24+Math.sin(a)*r,10+age*6]}),power*.32,1,true);
      ring(19+age*18,12,0,Math.PI*2,power*.8);
    } else if(module.id==='frost') {
      ring(16+age*23,17,0,Math.PI*2,power*.8);
      for(let i=0;i<6;i++) {const a=i*Math.PI/3,r=12+age*20,x=Math.cos(a)*r,z=Math.sin(a)*r,w=3*power+.5,y=30+age*9;
        path([[x-Math.cos(a)*w,y,z-Math.sin(a)*w],[x,y+w*2,z],[x+Math.cos(a)*w,y,z+Math.sin(a)*w],[x,y-w,z]],power,1,true,'#efffff');}
    } else if(module.id==='fire') {
      for(let i=0;i<5;i++) {const a=i*Math.PI*2/5,x=Math.cos(a)*(5+age*10),z=Math.sin(a)*(5+age*10);
        const dx=Math.cos(a)*7*power,dz=Math.sin(a)*7*power;
        path([[x-dx,30,z-dz],[x,46+age*25,z],[x+dx,30,z+dz]],power*.9,1,true,i%2?'#fff0ae':'#ff7947');}
      ring(15+age*20,17,phase,Math.PI*2,power*.65);
    } else if(module.id==='lightning') {
      for(let i=0;i<4;i++) {const a=i*Math.PI/2+phase,r=15+age*23;
        path([[0,37,0],[Math.cos(a)*r*.4,46,Math.sin(a)*r*.4],[Math.cos(a+.25)*r*.7,29,Math.sin(a+.25)*r*.7],[Math.cos(a)*r,37,Math.sin(a)*r]],power,2,false,'#f5eaff');}
      ring(17+age*21,17,0,Math.PI*2,power*.7);
    }
  }
  return effects;
}

export function drawModuleEffects(ctx,modules,layout,time,viewYaw,aimYaw,behind=false,fx={},gunYaws={}) {
  if(!modules) return;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';
  for(const module of modules) {
    const mount=getModuleMount(module,layout,modules);
    if((mount.x*Math.sin(viewYaw)+mount.z*Math.cos(viewYaw)<-8)!==behind) continue;
    for(const effect of sampleModuleEffects(module,layout,time,gunYaws[module.id]??aimYaw,fx[`attack-${module.id}`]??0,modules)) {
      ctx.globalAlpha=effect.alpha;ctx.strokeStyle=effect.color;ctx.fillStyle=effect.color;ctx.lineWidth=effect.width;
      ctx.beginPath();
      effect.points.forEach(([x,y,z],i)=>{
        const px=x*Math.cos(viewYaw)-z*Math.sin(viewYaw),py=38-.8*y+.6*(x*Math.sin(viewYaw)+z*Math.cos(viewYaw));
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      });
      if(effect.fill){ctx.closePath();ctx.fill()}else ctx.stroke();
    }
  }
  ctx.restore();
}
