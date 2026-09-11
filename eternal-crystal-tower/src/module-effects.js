import { MODULES } from './modules.js';
import { getModuleMount } from './module-model.js';

// Bounded, deterministic particles: no game RNG, accumulated emitters or saved state.
export function sampleModuleEffects(module, layout, time, aimYaw=0) {
  const mount=getModuleMount(module,layout), effects=[], level=Math.max(1,Math.min(3,module.level??1));
  const color=MODULES[module.id].color, phase=time+module.slot*.37;
  const yaw=['pulse','cannon'].includes(module.id)?aimYaw:mount.yaw;
  const point=([x,y,z])=>[mount.x+mount.scale*(x*Math.cos(yaw)-z*Math.sin(yaw)),mount.y+y*mount.scale,mount.z+mount.scale*(x*Math.sin(yaw)+z*Math.cos(yaw))];
  const path=(points,alpha=.65,width=1,fill=false,tint=color)=>effects.push({points:points.map(point),alpha,width,fill,color:tint});
  const ring=(radius,y,start=0,arc=Math.PI*2,alpha=.5)=>path(Array.from({length:25},(_,i)=>{const a=start+i*arc/24;return [Math.cos(a)*radius,y,Math.sin(a)*radius]}),alpha,1.2);
  const diamond=(x,y,z,r,alpha,tint=color)=>path([[x-r,y,z],[x,y+r,z],[x+r,y,z],[x,y-r,z],[x-r,y,z]],alpha,1,true,tint);
  switch(module.id) {
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
        path([[x-2*(1-t),y,z],[x+Math.sin(phase*7+i)*2,y+7*(1-t),z],[x+2*(1-t),y,z]],(1-t)*.8,1,true,i%2?'#ffb946':'#ff6844');
      }
      break;
    case 'lightning': {
      const tick=Math.floor(phase*12);
      for(let strand=0;strand<2;strand++) path(Array.from({length:9},(_,i)=>[-8+i*2,29+strand*4+Math.sin(i*11+tick*2+strand)*3,i===0||i===8?0:Math.cos(i*7+tick)*3]),tick%5===0?.15:.85,1.3,false,'#e5d1ff');
      ring(12,16,-phase*1.5,Math.PI*1.25,.4);
      break;
    }
  }
  return effects;
}

export function drawModuleEffects(ctx,modules,layout,time,viewYaw,aimYaw,behind=false) {
  if(!modules) return;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';
  for(const module of modules) {
    const mount=getModuleMount(module,layout);
    if((mount.x*Math.sin(viewYaw)+mount.z*Math.cos(viewYaw)<-8)!==behind) continue;
    for(const effect of sampleModuleEffects(module,layout,time,aimYaw)) {
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
