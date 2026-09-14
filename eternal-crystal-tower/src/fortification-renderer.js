import { FORT_TYPES, FORT_RULES, fortLimits } from './fortifications.js';

export function drawFortifications(ctx,s) {
  const f=s.fortifications;if(!f)return;const u=s.fortUi;
  ctx.save();ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
  if(u){
    const outer=fortLimits(s).radius;ctx.strokeStyle='#91d7c1';ctx.lineWidth=2;ctx.setLineDash([8,7]);
    for(const radius of [FORT_RULES.inner,outer]){ctx.beginPath();ctx.arc(720,500,radius,0,Math.PI*2);ctx.stroke();}ctx.setLineDash([]);
    ctx.fillStyle='#b6dfd2';ctx.fillText(`晶能控制区 ${outer}`,720,500-outer-10);
    ctx.fillStyle='#91d7c140';for(let x=720-outer;x<=720+outer;x+=30)for(let y=500-outer;y<=500+outer;y+=30){const d=Math.hypot(x-720,y-500);if(d>150&&d<outer)ctx.fillRect(x-1,y-1,2,2);}
  }
  for(const b of [...f.items].sort((a,b)=>a.y-b.y||a.id-b.id)){
    const h=b.size/2,dead=b.hp<=0,site=b.construction>0;
    ctx.save();ctx.translate(b.x,b.y);
    if(u?.selected===b.id){ctx.strokeStyle='#fff0a9';ctx.lineWidth=2;ctx.strokeRect(-h-4,-h-4,b.size+8,b.size+8);
      if(b.type==='gun'&&!dead){ctx.fillStyle='#9cdfc10d';ctx.strokeStyle='#9cdfc17a';ctx.beginPath();ctx.arc(0,0,190,0,Math.PI*2);ctx.fill();ctx.stroke();}}
    if(dead||site){ctx.setLineDash([4,4]);ctx.strokeStyle=dead?'#a28c7977':'#a3ded0';ctx.strokeRect(-h,-h,b.size,b.size);ctx.setLineDash([]);
      ctx.fillStyle=dead?'#44444b':'#85c7ba';ctx.fillRect(-h+4,h-9,b.size-8,5);
      if(site){ctx.fillStyle='#d9fff1';ctx.fillText(`${b.construction.toFixed(1)}s`,0,-h-6);}ctx.restore();continue;}
    ctx.fillStyle='#08121c88';ctx.fillRect(-h+5,-h+7,b.size,b.size);
    if(b.type==='wall'){
      ctx.fillStyle='#263e4b';ctx.fillRect(-h,-h,b.size,b.size);ctx.fillStyle='#597784';ctx.fillRect(-h,-h-10,b.size,b.size-3);
      ctx.strokeStyle='#8fa9ac';ctx.lineWidth=1;ctx.strokeRect(-h+.5,-h-9.5,b.size-1,b.size-4);
      ctx.fillStyle='#93d6c5';ctx.fillRect(-h+5,-h-5,b.size-10,3);
      if(b.hp<b.maxHp*.55){ctx.strokeStyle='#18202c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,-h-8);ctx.lineTo(1,-4);ctx.lineTo(-4,4);ctx.lineTo(6,12);ctx.stroke();}
    }else{
      ctx.fillStyle='#243b4b';ctx.beginPath();ctx.roundRect(-h,-h,b.size,b.size,8);ctx.fill();ctx.strokeStyle='#718e9b';ctx.stroke();
      ctx.fillStyle='#526f7b';ctx.beginPath();ctx.arc(0,-6,19,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.save();ctx.translate(0,-10);ctx.rotate(b.aim);ctx.fillStyle='#829eaa';ctx.fillRect(0,-9,31,6);ctx.fillRect(0,3,31,6);ctx.fillStyle='#243643';ctx.fillRect(-12,-12,24,24);ctx.fillStyle='#9dd8c4';ctx.fillRect(-7,-5,10,10);ctx.restore();
    }
    if(u||b.hp<b.maxHp){ctx.fillStyle='#101924';ctx.fillRect(-h,-h-20,b.size,4);ctx.fillStyle=b.hp/b.maxHp<.3?'#ee9b7c':'#95d9b8';ctx.fillRect(-h,-h-20,b.size*b.hp/b.maxHp,4);}
    if(b.repairing){ctx.fillStyle='#d1f2ba';ctx.fillText('+',h+8,-h);}
    ctx.restore();
  }
  for(const shot of f.shots){ctx.strokeStyle='#ffe1a9';ctx.lineWidth=2;ctx.globalAlpha=shot.life/.1;ctx.beginPath();ctx.moveTo(shot.x,shot.y);ctx.lineTo(shot.tx,shot.ty);ctx.stroke();}ctx.globalAlpha=1;
  for(const e of s.enemies){if(!e.fortCharge)continue;ctx.strokeStyle='#ffb879';ctx.lineWidth=4;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.fortCharge.x,e.fortCharge.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffddb1';ctx.fillText('冲撞蓄力',e.x,e.y-e.radius-14);}
  for(const e of s.enemies){if(!e.fortStompTarget)continue;const p=e.fortStompTarget;ctx.strokeStyle='#ffc28d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,48,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe0ba';ctx.fillText(`重踏 ${Math.max(0,e.fortStomp).toFixed(1)}s`,p.x,p.y-55);}
  for(const p of s.hostileProjectiles){if(p.kind==='enemyBolt'||p.life<=0)continue;ctx.strokeStyle='#ffbc8866';ctx.setLineDash([6,6]);ctx.beginPath();ctx.arc(p.targetX,p.targetY,85,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  if(u?.points.length){const moving=f.items.find(b=>b.id===u.moveId),type=moving?.type??u.tool,size=FORT_TYPES[type]?.size??30;ctx.strokeStyle=u.valid?'#b3f0d1':'#ff9e8c';ctx.fillStyle=u.valid?'#85d7b844':'#e8796744';ctx.lineWidth=2;
    for(const p of u.points){ctx.fillRect(p.x-size/2,p.y-size/2,size,size);ctx.strokeRect(p.x-size/2,p.y-size/2,size,size);}
    if(type==='gun'){const p=u.points[0];ctx.beginPath();ctx.arc(p.x,p.y,190,0,Math.PI*2);ctx.stroke();}}
  ctx.restore();
}
