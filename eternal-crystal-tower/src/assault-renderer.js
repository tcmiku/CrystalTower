import { GATES, gatePoint } from './assault.js';

export function drawAssaultGround(ctx,state) {
  if(!state.tower.moduleBay||!state.assault)return;
  const a=state.assault,w=state.wave;
  if(a.phase==='boss'||a.phase==='boss-warning')return;
  ctx.save();ctx.font='12px "Microsoft YaHei", sans-serif';ctx.textAlign='center';
  const active=['warning','vanguard','main','cleanup'].includes(a.phase);
  for(let gate=0;gate<4;gate++){
    const main=active&&gate===w.direction,side=active&&gate===w.secondary;
    const p=gatePoint(gate,400),from=gatePoint(gate,650),to=gatePoint(gate,365);
    ctx.strokeStyle=main?'#ffbd87':side?'#e9db91':'#9ccddd';ctx.lineWidth=main?3:1;ctx.globalAlpha=(main||side) ? .65 : .16;
    if(main||side){ctx.setLineDash([8,12]);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.setLineDash([]);}
    ctx.globalAlpha=(main||side) ? .95 : .5;
    ctx.fillStyle='#091726';ctx.beginPath();ctx.roundRect(p.x-43,p.y-15,86,30,7);ctx.fill();ctx.stroke();
    ctx.fillStyle=main?'#ffd49d':GATES[gate].color;ctx.fillText(`${GATES[gate].short} ${main?'主攻':side?'侧翼':'入口'}`,p.x,p.y+4);
    if(a.nodeChoices.includes(gate)&&a.phase==='warning'||a.resonance?.gate===gate){
      const crystal=gatePoint(gate,440,75);ctx.save();ctx.translate(crystal.x,crystal.y);ctx.fillStyle=GATES[gate].color;ctx.globalAlpha=.75+.2*Math.sin(state.time*3);ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(13,0);ctx.lineTo(0,22);ctx.lineTo(-13,0);ctx.closePath();ctx.fill();ctx.fillText(a.resonance?'共鸣激活':'可选共鸣',0,40);ctx.restore();
    }
  }
  if(state.moduleSelection||w.warningStarted){
    for(const [radius,label] of [[145,'内圈 · 兜底'],[300,'中圈 · 控制'],[620,'外圈 · 削减']]){ctx.globalAlpha=.15;ctx.strokeStyle='#a4d7e8';ctx.setLineDash([4,12]);ctx.beginPath();ctx.arc(720,500,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=.55;ctx.fillStyle='#cae8f2';ctx.fillText(label,720+radius-40,530);}
  }
  const m=a.mission;
  if(m){const p=gatePoint(m.gate,410,65);ctx.globalAlpha=.8;ctx.strokeStyle='#b2f1bd';ctx.beginPath();ctx.arc(p.x,p.y,26,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ccf6bf';ctx.fillText(m.phase==='returning'?'远征归航':'补给回收',p.x,p.y+44);}
  for(const enemy of state.enemies){
    if(enemy.broodRemaining>0){ctx.globalAlpha=.9;ctx.fillStyle='#e9c7ff';ctx.fillText(`母巢 · 剩余 ${enemy.broodRemaining} 次孵化`,enemy.x,enemy.y-enemy.radius-16);}
    if(enemy.battery&&enemy.volleyAt!=null&&enemy.volleyAt-state.time<=3&&enemy.volleyAt>state.time){const t=enemy.volleyAt-state.time;ctx.globalAlpha=.85;ctx.strokeStyle='#ffb072';ctx.lineWidth=2;ctx.beginPath();ctx.arc(enemy.x,enemy.y,enemy.radius+10,-Math.PI/2,-Math.PI/2+(1-t/3)*Math.PI*2);ctx.stroke();ctx.fillStyle='#ffcc9a';ctx.fillText(`齐射 ${t.toFixed(1)}s`,enemy.x,enemy.y-enemy.radius-18);}
  }
  ctx.restore();
}
