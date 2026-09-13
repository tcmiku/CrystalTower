import { MODULES, MODULE_BALANCE, installedModule, modulesAdjacent, moduleFacingAngle, FACING_NAMES } from './modules.js';
import { sectorAngle, SECTOR_NAMES } from './chapter-one.js';

const TAU = Math.PI * 2;

export function drawModuleGround(ctx, state, time, tower, towerRadius) {
  const bay = state.tower.moduleBay;
  if (!bay) return;
  const combat = bay.combat;
  const preview = state.modulePreview;
  const selected = preview ?? installedModule(state, state.moduleSelection);
  if (selected && MODULES[selected.id]?.directional) {
    const angle = moduleFacingAngle(selected), color = preview?.valid === false ? '#ff8d91' : MODULES[selected.id].color;
    const reach = selected.id === 'gravity' ? MODULE_BALANCE.gravity.distance + 100 : selected.id === 'mine' ? MODULE_BALANCE.mine.distance + 70 : towerRadius + MODULE_BALANCE.interceptor.rangeBeyondTower;
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.globalAlpha = .07;
    ctx.beginPath(); ctx.moveTo(tower.x, tower.y); ctx.arc(tower.x, tower.y, reach, angle - Math.PI / 6, angle + Math.PI / 6); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .65; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]);
    if (selected.id === 'gravity') {
      ctx.beginPath(); ctx.arc(tower.x + Math.cos(angle) * 230, tower.y + Math.sin(angle) * 230, MODULE_BALANCE.gravity.radius[(selected.level ?? 1) - 1], 0, TAU); ctx.stroke();
    }
    ctx.font = '12px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.globalAlpha = .95;
    ctx.fillText(`${Number.isInteger(selected.facing)?FACING_NAMES[selected.facing]:SECTOR_NAMES[selected.slot%6]} · ${selected.id === 'gravity' ? '牵引区域' : selected.id==='mine'?'布雷区域':selected.id==='shield'?'护盾扇区':'拦截扇区'}`, tower.x + Math.cos(angle) * (reach + 20), tower.y + Math.sin(angle) * (reach + 20));
    ctx.restore();
  }
  for(const field of combat.slowFields??[]){
    ctx.save();ctx.fillStyle='#d4b574';ctx.strokeStyle='#e8ce97';ctx.globalAlpha=.10;ctx.beginPath();ctx.arc(field.x,field.y,field.radius,0,TAU);ctx.fill();
    ctx.globalAlpha=.55;ctx.setLineDash([6,9]);ctx.stroke();ctx.restore();
  }
  for(const mine of combat.mines??[]){
    ctx.save();ctx.translate(mine.x,mine.y);ctx.strokeStyle=mine.detonateAt!=null?'#fff5bb':'#f3cd83';ctx.fillStyle='#6c542f';ctx.lineWidth=1.5;
    ctx.globalAlpha=.3;ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(0,0,MODULE_BALANCE.mine.trigger,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.beginPath();ctx.moveTo(-9,2);ctx.lineTo(0,-13);ctx.lineTo(9,2);ctx.lineTo(0,9);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=mine.element?MODULES[mine.element].color:'#ffebad';ctx.beginPath();ctx.arc(0,-2,3,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(0,0,17,-Math.PI/2,-Math.PI/2+TAU*mine.life/15);ctx.stroke();
    if(selected?.id==='mine'){ctx.font='10px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(`${Math.ceil(mine.life)}s`,0,29);}
    ctx.restore();
  }
  for (const field of combat.fields) {
    const fade = Math.min(1, field.life * 3, (field.duration - field.life) * 5 + .15);
    ctx.save(); ctx.translate(field.x, field.y); ctx.fillStyle = '#ae8dff'; ctx.strokeStyle = '#c1a7ff'; ctx.lineWidth = 1.5;
    ctx.globalAlpha = .08 * fade; ctx.beginPath(); ctx.arc(0, 0, field.radius, 0, TAU); ctx.fill();
    ctx.globalAlpha = .6 * fade; ctx.setLineDash([3, 8]); ctx.beginPath(); ctx.arc(0, 0, field.radius, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const progress = (time * .8 + i / 3) % 1, r = 12 + (1 - progress) * (field.radius - 12);
      ctx.globalAlpha = Math.sin(progress * Math.PI) * .65 * fade;
      ctx.beginPath(); ctx.arc(0, 0, r, time + i, time + i + Math.PI * 1.6); ctx.stroke();
    }
    ctx.globalAlpha = fade; ctx.fillStyle = '#ebddff'; ctx.beginPath();
    ctx.moveTo(0,-8);ctx.lineTo(6,0);ctx.lineTo(0,8);ctx.lineTo(-6,0);ctx.closePath();ctx.fill();ctx.restore();
  }
  for (const shell of combat.shells) {
    const progress = 1 - Math.max(0, shell.life) / shell.duration;
    ctx.save(); ctx.translate(shell.x, shell.y); ctx.strokeStyle = '#9ccaff'; ctx.fillStyle = '#9ccaff'; ctx.lineWidth = 1.5;
    ctx.globalAlpha = .055 + progress * .05; ctx.beginPath(); ctx.arc(0, 0, shell.radius, 0, TAU); ctx.fill();
    ctx.globalAlpha = .55; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(0, 0, shell.radius, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = .95; ctx.beginPath(); ctx.arc(0, 0, 13, -Math.PI/2, -Math.PI/2 + progress * TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) {ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(23,0);ctx.stroke();}
    ctx.restore();
  }
  const interceptor = installedModule(state, 'interceptor');
  if (interceptor) {
    const angle = moduleFacingAngle(interceptor), reach = towerRadius + MODULE_BALANCE.interceptor.rangeBeyondTower;
    ctx.save();ctx.strokeStyle = interceptor.charges > 0 ? '#7df3db' : '#42675f';ctx.lineWidth = interceptor.charges > 0 ? 2 : 1;ctx.globalAlpha = .7;
    ctx.beginPath();ctx.arc(tower.x,tower.y,reach,angle-Math.PI/6,angle+Math.PI/6);ctx.stroke();
    const capacity = MODULE_BALANCE.interceptor.capacity[interceptor.level-1];
    for(let i=0;i<capacity;i++) {
      const a=angle+(i-(capacity-1)/2)*.075,x=tower.x+Math.cos(a)*(reach+7),y=tower.y+Math.sin(a)*(reach+7);
      ctx.fillStyle=i<interceptor.charges?'#c2fff0':'#284b47';ctx.beginPath();ctx.arc(x,y,3,0,TAU);ctx.fill();
    }
    ctx.restore();
  }
}

export function drawModuleOrdnance(ctx, state, time, tower) {
  const combat = state.tower.moduleBay?.combat;
  if (!combat) return;
  for(const beam of combat.beams??[]){
    ctx.save();ctx.strokeStyle='#ff9a56';ctx.shadowColor='#ff7e38';ctx.shadowBlur=14;ctx.lineWidth=3+beam.power*5;
    ctx.beginPath();ctx.moveTo(beam.fromX,beam.fromY);ctx.lineTo(beam.x,beam.y);ctx.stroke();
    ctx.strokeStyle='#fff4d0';ctx.lineWidth=1+beam.power*2;ctx.stroke();ctx.fillStyle='#fff6db';ctx.beginPath();ctx.arc(beam.x,beam.y,4+beam.power*5,0,TAU);ctx.fill();ctx.restore();
  }
  for (const shell of combat.shells) {
    const progress = Math.max(0, Math.min(1, 1 - shell.life / shell.duration));
    const position = t => ({ x: shell.fromX + (shell.x - shell.fromX) * t, y: shell.fromY + (shell.y - shell.fromY) * t - Math.sin(t * Math.PI) * 110 });
    const p = position(progress), trail = position(Math.max(0,progress-.09));
    ctx.save();ctx.strokeStyle='#b9dcff';ctx.fillStyle='#eff9ff';ctx.shadowColor='#6baaff';ctx.shadowBlur=10;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(trail.x,trail.y);ctx.lineTo(p.x,p.y);ctx.stroke();
    ctx.translate(p.x,p.y);ctx.rotate(time*5+shell.id);ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,0);ctx.lineTo(0,7);ctx.lineTo(-5,0);ctx.closePath();ctx.fill();ctx.restore();
  }
  for (const effect of combat.effects) {
    const fade = Math.max(0,effect.life/effect.duration), age=1-fade;
    ctx.save();ctx.globalAlpha=fade;ctx.lineWidth=2;ctx.strokeStyle=effect.kind==='intercept'?'#c5fff0':effect.kind==='mine'?'#ffe29a':'#b8dcff';
    if(effect.kind==='intercept') {
      ctx.shadowColor='#7df3db';ctx.shadowBlur=10;
      ctx.beginPath();ctx.moveTo(effect.fromX,effect.fromY);ctx.lineTo(effect.x,effect.y);ctx.stroke();
      ctx.beginPath();ctx.arc(effect.x,effect.y,5+age*18,0,TAU);ctx.stroke();
    } else {
      ctx.beginPath();ctx.arc(effect.x,effect.y,effect.radius*(.2+age*.8),0,TAU);ctx.stroke();
      for(let i=0;i<8;i++){const a=i*TAU/8,r=age*effect.radius*.75;ctx.beginPath();ctx.moveTo(effect.x+Math.cos(a)*r,effect.y+Math.sin(a)*r);ctx.lineTo(effect.x+Math.cos(a)*(r+8*fade),effect.y+Math.sin(a)*(r+8*fade));ctx.stroke();}
    }
    ctx.restore();
  }
  const capacitor=installedModule(state,'capacitor'),laser=installedModule(state,'laser');
  if(capacitor||laser?.cooling>0){
    ctx.save();ctx.textAlign='center';ctx.font='11px "Microsoft YaHei",sans-serif';
    if(capacitor){const count=MODULE_BALANCE.capacitor.capacity[capacitor.level-1];for(let i=0;i<count;i++){
      const x=tower.x+(i-(count-1)/2)*13,y=tower.y+87;ctx.fillStyle=i<capacitor.stacks?'#acffee':'#234840';ctx.strokeStyle='#78c9b7';
      ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+4,y);ctx.lineTo(x,y+5);ctx.lineTo(x-4,y);ctx.closePath();ctx.fill();ctx.stroke();
    }ctx.fillStyle='#a2edda';ctx.fillText(capacitor.boundId?`储能 · ${MODULES[capacitor.boundId].name}`:'储能晶匣 · 未绑定',tower.x,tower.y+105);}
    if(laser?.cooling>0){ctx.fillStyle='#ffc18d';ctx.fillText(`射线散热 · ${laser.cooling.toFixed(1)}s`,tower.x,tower.y-110);}
    ctx.restore();
  }
  const service=installedModule(state,'service');
  if(service && modulesAdjacent(state,'hangar','service') && (service.servicing || service.launchBuff>0 || service.recharged && service.level>=3)) {
    ctx.save();ctx.font='11px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.fillStyle='#b6f4c5';ctx.shadowColor='#0d281e';ctx.shadowBlur=4;
    ctx.fillText(service.launchBuff>0?`整备加速 · ${service.launchBuff.toFixed(1)}s`:service.recharged&&service.level>=3?'整备完成 · 出击省电':'归航整备 · 回电加速',tower.x,tower.y+115);
    ctx.restore();
  }
}
