import {meshBuilder, TowerModelRenderer} from './tower-model.js';

export const DRONE_MODES = ['collect','attack','guard','detonate','recovery'];
export function buildDroneModel(mode='collect') {
  const m=meshBuilder(), navy=[.1,.16,.29], silver=[.65,.79,.9], gold=[.92,.61,.22];
  const light=({collect:[.2,.86,1],attack:[1,.55,.12],guard:[.64,.38,1],detonate:[1,.2,.1],recovery:[.3,.35,.44]})[mode] ?? [.2,.86,1];
  // Closed, faceted diamond hull; +X is the flight direction.
  const outline=[[31,0],[-8,-13],[-24,-8],[-24,8],[-8,13]];
  for(let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length];
    m.face([[0,8,0],[a[0],2,a[1]],[b[0],2,b[1]]],i%2?navy:silver);
    m.face([[0,-6,0],[b[0],2,b[1]],[a[0],2,a[1]]],navy);
  }
  for(const side of [-1,1]) {
    m.box(-5,-1,side*17,19,4,12,navy);
    m.box(-5,3,side*17,16,1,3,gold);
    m.ring(-7,-2,side*25,10,6,5,silver,16);
    m.ring(-7,3,side*25,8,6,1,light,16);
    m.crystal(-7,-6,side*25,4,9,0,[light,light,silver]);
    m.box(11,-2,side*12,20,4,4,navy);
    m.box(22,-1,side*12,3,2,3,light);
    m.box(-21,1,side*8,5,3,3,light);
  }
  m.ring(-1,6,0,7,4,2,gold,12);
  m.crystal(-1,7,0,5,10,.3,[light,light,silver]);
  m.box(18,3,0,8,2,3,light);
  return {layout:{radius:29,mountHeight:0},parts:[{name:'Crystal drone',vertices:new Float32Array(m.data)}]};
}

export class DroneModelRenderer extends TowerModelRenderer {
  prepare(visual) {
    const key=visual.droneMode ?? 'collect';
    this.meshCache ??= new Map();
    if(!this.meshCache.has(key)) this.meshCache.set(key,buildDroneModel(key));
    this.model=this.meshCache.get(key);
    if(this.key===key) return;
    this.key=key;
    if(!this.gl||this.lost) return;
    for(const buffer of this.buffers) this.gl.deleteBuffer(buffer);
    this.buffers=this.model.parts.map(part=>{
      const buffer=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER,part.vertices,this.gl.STATIC_DRAW);return buffer;
    });
  }
  drawDrone(ctx,mode,angle,time,scale=.5) {
    ctx.save();ctx.scale(scale,scale);ctx.translate(0,-38+Math.sin(time*4)*1.5);
    ctx.globalAlpha*=mode==='recovery'?.45:1;
    super.draw(ctx,{tier:0,droneMode:mode,overloadBand:'off',hpRatio:mode==='recovery'?0:1},0,time,{},Math.atan2(Math.sin(angle)/.6,Math.cos(angle)));
    ctx.restore();
  }
}
