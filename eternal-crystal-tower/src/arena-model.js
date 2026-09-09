import {TowerModelRenderer,meshBuilder} from './tower-model.js';

// Orthographic ground projection: (x, height, z) -> (x, .6*z-.8*height).
// Keeping ground positions in combat coordinates preserves all hit tests.
export function buildArenaModel(){
  const mesh=meshBuilder();
  const stone=[.19,.27,.36],edge=[.105,.15,.23],metal=[.26,.36,.47];
  const random=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
  for(let x=-2200;x<3200;x+=80)for(let z=-2200;z<3400;z+=80){
    const n=random(x,z),h=-2-n*2;
    const color=stone.map(v=>v*(.82+n*.25));
    {
      // Close-set beveled paving keeps the combat floor quiet and readable.
      const cx=x+40,cz=z+40;
      const corners=[[-39,-34],[-34,-39],[34,-39],[39,-34],[39,34],[34,39],[-34,39],[-39,34]].map(([dx,dz])=>[cx+dx,h,cz+dz]);
      mesh.face(corners.slice().reverse(),color);
      for(let i=0;i<8;i++){
        const p=corners[i],q=corners[(i+1)%8];
        mesh.face([p,q,[q[0],-12,q[2]],[p[0],-12,p[2]]],edge);
      }
      mesh.face([[x,-13,z],[x,-13,z+80],[x+80,-13,z+80],[x+80,-13,z]],edge);
    }
  }
  {
    mesh.ring(480,-15,650,118,0,15,edge,48);
    mesh.ring(480,0,650,115,104,3,metal,48);
    mesh.ring(480,0,650,105,100,2,[.13,.48,.56],48);
    mesh.ring(480,0,650,98,0,1,[.18,.25,.33],48);
  }
  // Broken boundary architecture leaves four cardinal approaches open.
  for(let i=0;i<32;i++){
    const a=i*Math.PI*2/32;
    if(i%8<2||i%8>6)continue;
    const x=480+Math.cos(a)*650,z=600+Math.sin(a)*780;
    const h=25+random(i,7)*65;
    mesh.box(x,-8,z,78,h,54,edge,a);
    mesh.box(x,h-8,z,84,6,60,metal,a);
    for(let j=0;j<3;j++){
      const cx=x+(j-1)*29,cz=z+Math.sin(j*2)*24;
      mesh.crystal(cx,h-1,cz,8+random(i,j)*11,30+random(j,i)*65,.4,
        [[.23,.18,.45],[.25,.42,.62],[.45,.59,.73]]);
    }
  }
  for(let i=0;i<56;i++){
    const a=i*2.39996,r=600+random(i,5)*340;
    const x=480+Math.cos(a)*r,z=600+Math.sin(a)*r*1.4;
    mesh.box(x,-8,z,12+random(i,3)*40,9+random(i,4)*18,22,stone,a);
  }
  return new Float32Array(mesh.data);
}

export class ArenaModelRenderer extends TowerModelRenderer{
  initialize(){
    super.initialize();
    this.arenaBuffer=null;
  }
  drawArena(ctx,{width,height,scale,offsetX,offsetY,dayMix=1,time=0}){
    if(!this.gl||this.lost)return false;
    const gl=this.gl,u=this.uniforms;
    if(!this.arenaBuffer){
      if(this.arenaBuffer)gl.deleteBuffer(this.arenaBuffer);
      this.arenaVertices=buildArenaModel();this.arenaBuffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.arenaBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.arenaVertices,gl.STATIC_DRAW);
    }
    const w=Math.ceil(width),h=Math.ceil(height);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    gl.viewport(0,0,w,h);gl.useProgram(this.program);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.clearColor(.025,.045,.075,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform4f(u.camera,(width/2-offsetX)/scale,(offsetY-height/2)/scale,width/scale/2,height/scale/2);
    gl.uniform1f(u.yaw,0);gl.uniform1f(u.viewYaw,0);gl.uniform1f(u.expansion,1);gl.uniform3f(u.offset,0,0,0);
    gl.uniform1f(u.heat,0);gl.uniform1f(u.hit,0);gl.uniform1f(u.pulse,Math.sin(time)*.5+.5);gl.uniform1f(u.damage,1);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.arenaBuffer);
    this.attributes.forEach((attr,j)=>{gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,j===3?1:3,gl.FLOAT,false,40,j*12);});
    gl.drawArrays(gl.TRIANGLES,0,this.arenaVertices.length/10);
    ctx.drawImage(this.canvas,0,0,width,height);
    ctx.fillStyle=`rgba(5,9,30,${.05+(1-dayMix)*.28})`;ctx.fillRect(0,0,width,height);
    return true;
  }
  dispose(){if(this.gl&&this.arenaBuffer)this.gl.deleteBuffer(this.arenaBuffer);this.arenaBuffer=null;super.dispose();}
}
