/**
 * Software-project enemy meshes to SVG contact sheets for visual QA.
 * Mirrors TowerModelRenderer.drawSoftware's orthographic projection.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {buildEnemyModel,ENEMY_MODEL_TYPES} from '../src/enemy-model.js';

const W=520, H=420, CX=W/2, CY=H*0.72;
const outDir=new URL('../qa/screenshots/',import.meta.url);
await mkdir(outDir,{recursive:true});

function project(p, yaw) {
  const c=Math.cos(yaw), s=Math.sin(yaw);
  const x=p[0]*c-p[2]*s, z=p[0]*s+p[2]*c, y=p[1];
  return {x:CX+x*3.4, y:CY-(0.8*y-0.6*z)*3.4, depth:0.6*y+0.8*z};
}

function renderSvg(type, yaw=0.7) {
  const model=buildEnemyModel(type);
  const tris=[];
  for(const part of model.parts){
    const d=part.vertices;
    for(let i=0;i<d.length;i+=30){
      const pts=[];
      let depth=0;
      for(let j=0;j<3;j++){
        const k=i+j*10;
        const pr=project([d[k],d[k+1],d[k+2]], yaw);
        pts.push(pr); depth+=pr.depth;
      }
      const n=[d[i+3],d[i+4],d[i+5]];
      const nx=n[0]*Math.cos(yaw)-n[2]*Math.sin(yaw);
      const nz=n[0]*Math.sin(yaw)+n[2]*Math.cos(yaw);
      const lit=0.57+Math.abs(-nx*0.35+n[1]*0.64+nz*0.44)*0.48+d[i+9]*0.4;
      const rgb=[d[i+6],d[i+7],d[i+8]].map(v=>Math.round(Math.min(255,v*255*lit)));
      tris.push({pts, depth:depth/3, color:`rgb(${rgb.join(',')})`});
    }
  }
  tris.sort((a,b)=>a.depth-b.depth);
  const polys=tris.map(t=>{
    const points=t.pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `<polygon points="${points}" fill="${t.color}"/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#12162a"/>
  <text x="12" y="28" fill="#e4dcf2" font-family="system-ui,sans-serif" font-size="18">${type}</text>
  <ellipse cx="${CX}" cy="${CY+48}" rx="90" ry="18" fill="rgba(0,0,0,.35)"/>
  ${polys}
</svg>`;
}

const sheets=[];
for(const type of ENEMY_MODEL_TYPES){
  const svg=renderSvg(type);
  await writeFile(new URL(`enemy-3d-${type}.svg`, outDir), svg);
  sheets.push(`<div style="display:inline-block;margin:8px;border:1px solid #463549;border-radius:12px;overflow:hidden">${svg.replace('<svg ','<svg width="260" height="210" ')}</div>`);
  console.log('wrote', type);
}
const contact=`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0c1120;padding:16px;font:14px system-ui;color:#e4dcf2"><h2>Common enemy 3D models</h2>${sheets.join('')}`;
await writeFile(new URL('enemy-3d-contact-sheet.html', outDir), contact);
console.log('contact sheet ready');
