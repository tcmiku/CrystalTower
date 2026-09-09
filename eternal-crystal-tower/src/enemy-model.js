import { meshBuilder, TowerModelRenderer } from './tower-model.js';

// Wisp: the first atlas cell. Its front points along +X.
export function buildWispModel() {
  const m = meshBuilder();
  const rock = [.19,.12,.27], lava = [1,.16,.035];
  function gem(cx,cy,cz,rx,ry,rz,color,glow=0) {
    const p=(a,b)=>[cx+rx*Math.sin(b)*Math.cos(a),cy+ry*Math.cos(b),cz+rz*Math.sin(b)*Math.sin(a)];
    for(let j=0;j<6;j++) for(let i=0;i<12;i++) {
      const a=i*Math.PI/6,b=(i+1)*Math.PI/6,c=j*Math.PI/6,d=(j+1)*Math.PI/6;
      const shade=.8+((i*7+j*3)%5)*.07;
      m.face([p(a,c),p(a,d),p(b,d)],color.map(v=>v*shade),glow);
      m.face([p(a,c),p(b,d),p(b,c)],color.map(v=>v*shade),glow);
    }
  }
  gem(0,0,0,20,17,17,lava,.65);
  // Separated armor scales leave narrow molten seams visible.
  for(let j=1;j<6;j++) for(let i=0;i<10;i++) {
    const a=i*Math.PI/5+(j%2)*.2,b=j*Math.PI/6;
    const x=19*Math.sin(b)*Math.cos(a),y=16*Math.cos(b),z=16*Math.sin(b)*Math.sin(a);
    if(x>12 && Math.abs(y)<10 && Math.abs(z)<11) continue;
    gem(x,y,z,5.6,5,5,rock);
  }
  gem(19,0,0,5,10,10,[.45,.035,.06],.3);
  gem(23,0,0,2.4,6.7,6.7,[1,.32,.025],1);
  gem(25,0,0,1.2,3.4,3.4,[1,.83,.31],1);
  for(const z of [-1,1]) for(const y of [-1,1]) {
    const root=[9,y*9,z*12],elbow=[18,y*17,z*23],tip=[32,y*6,z*17];
    m.face([root,[9,y*15,z*14],elbow,[22,y*13,z*23],tip],rock);
    m.face([root,tip,[22,y*10,z*20],elbow], [.45,.055,.13]);
    m.face([elbow,[22,y*13,z*23],tip,[24,y*9,z*19]],lava,.5);
  }
  for(let i=0;i<7;i++) {
    const z=(i%3-1)*11,x=-16+(i%3)*8;
    m.crystal(x,7+Math.floor(i/3)*3,z,4,13+i%3*4,-.7,[[.42,.025,.21],[.75,.025,.19],[1,.12,.12]]);
  }
  return {layout:{radius:22,mountHeight:0},parts:[{name:'Wisp rock armor, molten eye and crystal claws',vertices:new Float32Array(m.data)}]};
}

export class EnemyModelRenderer extends TowerModelRenderer {
  prepare() {
    if(this.key==='wisp') return;
    this.model=buildWispModel();this.key='wisp';
    if(!this.gl||this.lost) return;
    for(const buffer of this.buffers) this.gl.deleteBuffer(buffer);
    this.buffers=this.model.parts.map(part=>{
      const buffer=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER,part.vertices,this.gl.STATIC_DRAW);return buffer;
    });
    this.canvas.width=256;this.canvas.height=256;
  }
  drawEnemy(ctx,enemy,time,angle,scale=1) {
    ctx.save();ctx.translate(enemy.x,enemy.y);
    const size=enemy.radius/17*scale;
    ctx.scale(size,size);
    ctx.translate(0,-38+Math.sin(time*3+enemy.id)*2);
    super.draw(ctx,{tier:0,overloadBand:'off',hpRatio:1},0,time,{hit:enemy.hitFlash},Math.atan2(Math.sin(angle)/.6,Math.cos(angle)));
    ctx.restore();
  }
}
