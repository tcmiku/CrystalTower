import {meshBuilder, TowerModelRenderer} from './tower-model.js';
import {buildCrystalBlade} from './blade-geometry.js';

export function buildBladeModel() {
  return {layout:{radius:26,mountHeight:0},parts:[{name:'Six beveled crystal blades and reactor hub',vertices:buildCrystalBlade(meshBuilder)}]};
}

export class BladeModelRenderer extends TowerModelRenderer {
  prepare() {
    if(this.key==='blade') return;
    this.model=buildBladeModel();this.key='blade';
    if(!this.gl||this.lost) return;
    for(const buffer of this.buffers) this.gl.deleteBuffer(buffer);
    this.buffers=this.model.parts.map(part=>{
      const buffer=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER,part.vertices,this.gl.STATIC_DRAW);return buffer;
    });
  }
  drawBlade(ctx,rotation,time,scale=1,returning=false,activity=0) {
    ctx.save();ctx.scale(scale*.72,scale*.72);ctx.translate(0,-38);
    super.draw(ctx,{tier:0,overloadBand:'off',hpRatio:1},0,time,{},rotation);
    ctx.save();ctx.translate(0,38);ctx.scale(1,.6);ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=returning?'#88edff':'#c8ff9b';
    for(let i=0;i<3;i++) {
      ctx.globalAlpha=(.24+activity*.35)*(1-i*.22);ctx.lineWidth=2.3-i*.5;
      ctx.beginPath();ctx.arc(0,0,29+i,rotation+i*2.094,rotation+i*2.094+1.1+activity*.5);ctx.stroke();
    }
    ctx.restore();ctx.restore();
  }
}
