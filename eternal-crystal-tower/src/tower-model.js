import { drawModuleEffects } from './module-effects.js';
import { buildMountedModules, getModuleMount } from './module-model.js';
// Local mesh assets: Y is up, the cannon's local +X is forward.
// The orthographic camera matches the illustrated battlefield (no CDN/runtime dependency).
const TAU = Math.PI * 2;
export const MODEL_SIZE = 480;
const ELEVATION = .8;
const GROUND_DEPTH = .6;
const GROUND_Y = 38;
const PALETTE = {
  navy: [0.10, .17, .34], armor: [.22, .34, .57], bevel: [.40, .54, .76],
  dark: [.025, .055, .12], silver: [.71, .82, .93], gold: [.94, .64, .19],
  cyan: [.13, .85, 1], ice: [.64, .97, 1], purple: [.40, .18, .91],
  violet: [.75, .47, 1], fire: [1, .34, .12]
};
export function getModelLayout(tier = 0) {
  tier = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
  const mountY = [-10, -28, -40, -49][tier];
  // Keep visual rings aligned with the assembly board capacity (6 / 9 / 9 / 12).
  const bayRows = [2, 3, 3, 4][tier];
  const slotCount = 3 * bayRows;
  const rings = Math.max(1, Math.ceil(slotCount / 6));
  return {
    tier,
    radius: [45, 53, 63, 72][tier],
    mountX: 0,
    mountY,
    mountHeight: (GROUND_Y - mountY) / ELEVATION,
    length: [52, 67, 81, 96][tier],
    bayRows,
    slotCount,
    rings
  };
}
export function getCannonPose(tier, angle = 0, shoot = 0, route = 'none') {
  const layout = getModelLayout(tier);
  const yaw = Math.atan2(Math.sin(angle) / GROUND_DEPTH, Math.cos(angle));
  const recoil = Math.max(0, Math.min(1, shoot / .28)) * 6;
  const length = layout.length + (route === 'siege' ? 12 : 0) - recoil;
  return { yaw, recoil, muzzleX: Math.cos(yaw) * length,
    muzzleY: layout.mountY + Math.sin(yaw) * length * GROUND_DEPTH };
}
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const sub = (a, b) => a.map((v, i) => v-b[i]);
const normalize = (v) => { const d = Math.hypot(...v) || 1; return v.map(x => x/d); };
export function meshBuilder() {
  const data = [];
  function face(points, color, glow = 0) {
    const normal = normalize(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    if (Math.hypot(...cross(sub(points[1], points[0]), sub(points[2], points[0]))) < 1e-7) return;
    for (let i = 1; i < points.length-1; i++) {
      if (Math.hypot(...cross(sub(points[i], points[0]), sub(points[i+1], points[0]))) < 1e-7) continue;
      for (const p of [points[0], points[i], points[i+1]]) data.push(...p, ...normal, ...color, glow);
    }
  }
  function ring(x, y, z, outer, inner, height, color, segments = 24, start = 0, arc = TAU) {
    const point = (r, h, a) => [x+Math.cos(a)*r, y+h, z+Math.sin(a)*r];
    for (let i = 0; i < segments; i++) {
      const a = start+arc*i/segments, b = start+arc*(i+1)/segments;
      face([point(outer,0,a),point(outer,height,a),point(outer,height,b),point(outer,0,b)],color);
      face([point(inner,height,a),point(outer,height,a),point(outer,height,b),point(inner,height,b)],color);
      if (inner) face([point(inner,0,b),point(inner,height,b),point(inner,height,a),point(inner,0,a)],PALETTE.dark);
      else face([[x,y+height,z],point(outer,height,a),point(outer,height,b)],color);
      if (i === 0 && arc < TAU) face([point(inner,0,a),point(outer,0,a),point(outer,height,a),point(inner,height,a)],color);
      if (i === segments-1 && arc < TAU) face([point(outer,0,b),point(inner,0,b),point(inner,height,b),point(outer,height,b)],color);
    }
  }
  function box(x,y,z,w,h,d,color, yaw = 0) {
    const p = (a,b,c) => [x+a*Math.cos(yaw)-c*Math.sin(yaw), y+b, z+a*Math.sin(yaw)+c*Math.cos(yaw)];
    const v = [p(-w/2,0,-d/2),p(w/2,0,-d/2),p(w/2,h,-d/2),p(-w/2,h,-d/2),p(-w/2,0,d/2),p(w/2,0,d/2),p(w/2,h,d/2),p(-w/2,h,d/2)];
    for (const ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) face(ids.map(i=>v[i]),color);
  }
  function crystal(x,y,z,r,h,tilt = 0, colors = [PALETTE.purple,PALETTE.cyan,PALETTE.ice]) {
    const n = 6, lower = [], shoulder = [];
    const tip = [x+Math.sin(tilt)*h*.25,y+h,z];
    for (let i=0;i<n;i++) {
      const a = TAU*i/n+Math.PI/6;
      lower.push([x+Math.cos(a)*r*.60,y,z+Math.sin(a)*r*.60]);
      shoulder.push([x+Math.cos(a)*r+Math.sin(tilt)*h*.12,y+h*.60,z+Math.sin(a)*r]);
    }
    for (let i=0;i<n;i++) {
      const j=(i+1)%n;
      face([lower[i],shoulder[i],shoulder[j]],colors[i%3],.32);
      face([lower[i],shoulder[j],lower[j]],colors[(i+1)%3],.22);
      face([shoulder[i],tip,shoulder[j]],colors[(i+2)%3],.45);
    }
  }
  // An octagonal barrel with stepped collars and a faceted crystal muzzle.
  function barrel(length, radius, z, trim) {
    const oct = (x,r,i) => [x, Math.cos(TAU*i/8+Math.PI/8)*r, z+Math.sin(TAU*i/8+Math.PI/8)*r];
    const sections = [[4,radius*1.22],[12,radius*1.22],[17,radius],[length-19,radius],[length-16,radius*1.30],[length-9,radius*1.30],[length-7,radius*.83]];
    for (let s=0;s<sections.length-1;s++) for(let i=0;i<8;i++) {
      const [x,r]=sections[s], [nx,nr]=sections[s+1];
      const color = s===0 || s===4 ? trim : s===2 ? (i%2 ? PALETTE.armor : PALETTE.cyan) : PALETTE.navy;
      face([oct(x,r,i),oct(nx,nr,i),oct(nx,nr,i+1),oct(x,r,i+1)],color,s===2&&i%2===0?.7:0);
    }
    for(let i=0;i<8;i++) face([oct(length-7,radius*.83,i),[length,0,z],oct(length-7,radius*.83,i+1)], [PALETTE.cyan,PALETTE.purple,PALETTE.ice][i%3], .5);
    for(const side of [-1,1]) box((length+10)/2,radius*.64,z+side*radius*.70,length-23,3,3,PALETTE.silver);
  }
  return { data, face, ring, box, crystal, barrel };
}

// The original round crystal tower remains the primary silhouette.
// Modules attach to radial wall brackets; the inventory grid is not a physical deck.
function buildModularChassis(layout, modules) {
  const tower=buildTowerModel({tier:layout.tier,cannonEnabled:false});
  const crown=meshBuilder(), collar=meshBuilder();
  const y=layout.mountHeight, r=layout.radius;
  const trim=layout.tier===3?PALETTE.gold:PALETTE.silver;
  collar.ring(0,y-5,0,r*.4,0,6,PALETTE.dark,16);
  collar.ring(0,y+1,0,r*.37,r*.25,4,trim,16);
  // One mounting belt only — bay cells fan around the wall, no stacked decks.
  const beltY=24+layout.tier*6;
  collar.ring(0,beltY-8,0,r*1.06,r*.88,6,PALETTE.dark,24);
  collar.ring(0,beltY-3,0,r*1.02,r*.9,2,layout.tier===3?PALETTE.gold:PALETTE.silver,24);
  for(let sector=0;sector<6;sector+=1){
    const a=sector*Math.PI/3-Math.PI/2;
    const px=Math.cos(a)*r*1.02,pz=Math.sin(a)*r*1.02;
    collar.box(px,beltY-2,pz,11,3,11,PALETTE.armor,a);
  }
  crown.crystal(0,y+9,0,12+layout.tier*2,31+layout.tier*5,0,[PALETTE.purple,PALETTE.cyan,PALETTE.ice]);
  for(let i=0;i<3;i++) crown.ring(0,y+14,0,r*.42,r*.42-2,2,PALETTE.cyan,8,i*TAU/3,TAU/3-.25);
  for(let i=9;i<crown.data.length;i+=10) crown.data[i]=Math.max(.4,crown.data[i]);
  const body=tower.parts[0].vertices;
  tower.parts[0].vertices=new Float32Array([...body,...collar.data]);
  tower.parts.push(...buildMountedModules(meshBuilder,modules,layout),{name:'core-energy',pivot:[0,0,0],spin:.28,vertices:new Float32Array(crown.data)});
  return tower;
}

export function getMountedMuzzle(module, tier=0, angle=0, shoot=0, viewYaw=0, peers=null) {
  const {x,y,z,scale}=getModuleMount(module,getModelLayout(tier),peers);
  const yaw=getCannonPose(tier,angle).yaw;
  const length=(module.id==='cannon'?35:module.id==='mortar'?15:26)*scale-Math.min(1,Math.max(0,shoot/.28))*4;
  const px=x+Math.cos(yaw)*length,pz=z+Math.sin(yaw)*length;
  return {muzzleX:px*Math.cos(viewYaw)-pz*Math.sin(viewYaw),muzzleY:GROUND_Y-.8*(y+(module.id==='mortar'?43:20)*scale)+.6*(px*Math.sin(viewYaw)+pz*Math.cos(viewYaw))};
}

// Arena-space spawn point for a mounted gun barrel tip (top-down x/y).
export function getGunMuzzleWorld(towerX, towerY, module, tier = 0, aimAngle = 0, peers = null) {
  if (!module) return { x: towerX, y: towerY };
  const { x, z, scale } = getModuleMount(module, getModelLayout(tier), peers);
  const mountX = towerX + x;
  const mountY = towerY + z;
  const barrel = (module.id === "cannon" ? 35 : module.id === "mortar" ? 15 : 26) * scale;
  return {
    x: mountX + Math.cos(aimAngle) * barrel,
    y: mountY + Math.sin(aimAngle) * barrel
  };
}

export function buildTowerModel({tier=0,cannonRoute='none',cannonEnabled=true,elements={},modules=null}={}) {
  const layout=getModelLayout(tier); tier=layout.tier;
  if (modules !== null) return buildModularChassis(layout, modules);
  const r=layout.radius, top=layout.mountHeight-9;
  const trim=tier===3?PALETTE.gold:PALETTE.silver;
  const body=meshBuilder(), turret=meshBuilder(), barrel=meshBuilder(), vents=meshBuilder();
  body.ring(0,0,0,r,0,8,PALETTE.dark,12);
  body.ring(0,8,0,r,0,5,trim,12);
  body.ring(0,13,0,r*.97,0,12,PALETTE.navy,12);
  body.ring(0,25,0,r*.94,r*.65,3,PALETTE.bevel,12);
  for(let i=0;i<12;i++) {
    const a=TAU*i/12+.035;
    body.ring(0,14,0,r*.98,r*.86,9,PALETTE.armor,2,a,TAU/12-.07);
    body.ring(0,23,0,r*.96,r*.84,2,PALETTE.bevel,2,a,TAU/12-.07);
  }
  body.ring(0,28,0,r*.67,0,top-28,PALETTE.navy,16);
  body.ring(0,30,0,r*.69,r*.60,3,PALETTE.cyan,32);
  body.ring(0,top-7,0,r*.74,r*.36,7,PALETTE.dark,24);
  body.ring(0,top,0,r*.55,r*.40,3,PALETTE.cyan,32);
  // Separated beveled crown blocks expose cyan channels between armor plates.
  for(let i=0;i<8;i++) {
    const a=TAU*i/8, arc=TAU/8-.06;
    body.ring(0,top-3,0,r*.76,r*.57,5,PALETTE.bevel,3,a+.03,arc);
    body.ring(0,top+2,0,r*.72,r*.59,3,PALETTE.armor,3,a+.04,arc-.02);
    const x=Math.cos(a)*r*.76,z=Math.sin(a)*r*.76;
    body.box(x,15,z,9,10,13,trim,a);
    if(i%2===0) body.box(x,28,z,5,Math.max(6,top-34),6,PALETTE.bevel,a);
    const panel=(width,y0,y1,radius,color)=>{
      const p=(t,y)=>[Math.cos(a)*radius-Math.sin(a)*t,y,Math.sin(a)*radius+Math.cos(a)*t];
      body.face([p(-width,y1),p(width,y1),p(width,y0+7),p(0,y0),p(-width,y0+7)],color);
    };
    if(tier>0){
      panel(r*.18,34,top-10,r*.683,PALETTE.bevel);
      panel(r*.15,38,top-11,r*.697,PALETTE.armor);
      panel(r*.075,38,Math.min(top-13,48),r*.70,trim);
    }
  }
  // Armor wall stays clean so mounted modules read as the outer silhouette.
  // The forward insignia is a physical diamond mounted on the base fascia.
  const dz=r*.96;
  body.face([[-11,19,dz],[0,4,dz+3],[11,19,dz],[0,36,dz-2]],trim);
  body.face([[-6,20,dz+1],[0,11,dz+4],[6,20,dz+1],[0,29,dz]],PALETTE.cyan,.4);
  for(let i=0;i<6;i++) {
    const a=TAU*i/6, x=Math.cos(a)*r*.56,z=Math.sin(a)*r*.56;
    vents.box(x,top-21,z,5,15,8,PALETTE.violet,a);
  }
  if(cannonRoute==='siege') for(const side of [-1,1]) {
    body.box(side*r*.86,30,0,13,12,28,PALETTE.navy);
    body.box(side*r*.86,42,0,10,3,28,PALETTE.gold);
  }
  if(cannonRoute==='split') for(let i=0;i<3;i++) {
    const a=Math.PI+Math.PI*i/3;
    body.crystal(Math.cos(a)*r*.92,top-9,Math.sin(a)*r*.92,5,20,0,[PALETTE.purple,PALETTE.violet,PALETTE.ice]);
  }
  for(const [key,side,color] of [['frost',-1,PALETTE.ice],['fire',1,PALETTE.fire],['lightning',0,PALETTE.violet]]) {
    if(modules || (!elements[key] && tier!==3)) continue;
    const x=side*r*.9,z=side?8:-r*.86,y=side?29:top-9;
    body.ring(x,y,z,9,0,6,trim,8);
    body.crystal(x,y+6,z,7,side?23:27,0,[color,PALETTE.purple,color]);
  }
  turret.ring(0,-12,0,r*.39,0,8,PALETTE.dark,24);
  turret.ring(0,-4,0,r*.39,0,4,trim,24);
  turret.ring(0,0,0,r*.34,0,11,PALETTE.armor,12);
  turret.ring(0,11,0,r*.27,0,3,PALETTE.bevel,12);
  turret.crystal(-4,14,0,8+tier,10,0);
  for(const side of [-1,1]) turret.box(0,0,side*r*.29,23,10,6,trim);
  const length=layout.length+(cannonRoute==='siege'?12:0);
  if(cannonRoute==='split' || tier===2) {
    for(const side of [-1,1]) barrel.barrel(length,5.8+tier*.5,side*8,trim);
  } else barrel.barrel(length,8+tier*1.1,0,trim);
  return {layout, parts: [body,turret,barrel,vents].map((m,i)=>({name:['body','turret','barrel','vents'][i],vertices:new Float32Array(!cannonEnabled && (i===1 || i===2) ? [] : m.data)})).concat(modules ? buildMountedModules(meshBuilder, modules, layout) : [])};
}

const VERTEX = `attribute vec3 position; attribute vec3 normal; attribute vec3 color; attribute float glow;
uniform float yaw; uniform vec3 offset; uniform vec3 pivot; uniform float expansion; uniform float viewYaw;
uniform vec4 camera;
varying vec3 vNormal; varying vec3 vColor; varying float vGlow;
vec3 turn(vec3 p,float a){return vec3(p.x*cos(a)-p.z*sin(a),p.y,p.x*sin(a)+p.z*cos(a));}
void main(){vec3 p=position;p.xz*=expansion;p=turn(p+offset-pivot,yaw)+pivot;p=turn(p,viewYaw);
gl_Position=vec4((p.x-camera.x)/camera.z,(.8*p.y-.6*p.z-camera.y)/camera.w,-(.6*p.y+.8*p.z)/4000.0,1.0);
vNormal=turn(turn(normal,yaw),viewYaw);vColor=color;vGlow=glow;}`;
const FRAGMENT = `precision mediump float;varying vec3 vNormal;varying vec3 vColor;varying float vGlow;
uniform float heat;uniform float hit;uniform float pulse;uniform float damage;
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
float key=max(0.0,dot(n,normalize(vec3(-.5,.9,.6))));float rim=max(0.0,dot(n,normalize(vec3(.8,.3,-.6))));
float spec=pow(max(0.0,dot(n,normalize(vec3(-.3,.85,.6)))),26.0);
vec3 base=vColor;float energy=step(.2,vGlow);base=mix(base,vec3(1.0,.26,.1),heat*energy);
vec3 lit=base*(.47+.65*key+.19*rim)+vec3(.6,.79,1.0)*spec*.18;
lit+=base*vGlow*(.5+pulse*.15)*damage;lit=mix(lit,vec3(1.0,.83,.8),hit*.65);
gl_FragColor=vec4(lit,1.0);}`;

export class TowerModelRenderer {
  constructor() {
    this.canvas = null; this.gl = null; this.key = ''; this.model = null; this.buffers = [];
    if(typeof document==='undefined') return;
    this.canvas=document.createElement('canvas'); this.canvas.width=MODEL_SIZE*2;this.canvas.height=MODEL_SIZE*2;
    const gl=this.canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:false});
    if(!gl) return;
    this.gl=gl;
    this.canvas.addEventListener('webglcontextlost', e=>{e.preventDefault();this.lost=true;});
    this.canvas.addEventListener('webglcontextrestored', ()=>{this.initialize();this.key='';this.lost=false;});
    try { this.initialize(); }
    catch (error) { console.warn('Tower mesh: using software rendering',error);this.gl=null; }
  }
  initialize() {
    const gl=this.gl;
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));return shader;};
    const vs=compile(gl.VERTEX_SHADER,VERTEX),fs=compile(gl.FRAGMENT_SHADER,FRAGMENT);
    this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    this.uniforms=Object.fromEntries(['yaw','offset','pivot','expansion','viewYaw','heat','hit','pulse','damage','camera'].map(k=>[k,gl.getUniformLocation(this.program,k)]));
    this.attributes=['position','normal','color','glow'].map(k=>gl.getAttribLocation(this.program,k));this.buffers=[];
  }
  prepare(visual) {
    const key=JSON.stringify([visual.tier,visual.cannonRoute,visual.cannonEnabled!==false,!!visual.elements?.frost,!!visual.elements?.fire,!!visual.elements?.lightning,visual.modules]);
    if(key===this.key) return;
    this.model=buildTowerModel(visual);this.key=key;
    if(!this.gl||this.lost) return;
    const gl=this.gl;
    for(const b of this.buffers) gl.deleteBuffer(b);
    this.buffers=this.model.parts.map(part=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,part.vertices,gl.STATIC_DRAW);return buffer;});
  }
  draw(ctx,visual,angle,time,fx={},viewYaw=0,gunAngles=null) {
    this.prepare(visual);
    const pose=getCannonPose(visual.tier,angle,fx.shoot??0,visual.cannonRoute);
    const expansion=visual.overloadBand==='off'?1:visual.overloadBand==='overheated'?1.30:1.16;
    const gunYaws={};
    if(gunAngles) for(const [weapon,gunAngle] of Object.entries(gunAngles)) gunYaws[weapon]=getCannonPose(visual.tier,gunAngle,fx.shoot??0,visual.cannonRoute).yaw;
    ctx.save();ctx.shadowBlur=0;
    ctx.fillStyle='rgba(2,8,23,.28)';ctx.beginPath();ctx.ellipse(0,GROUND_Y+4,this.model.layout.radius*1.12,this.model.layout.radius*.53,0,0,TAU);ctx.fill();
    drawModuleEffects(ctx,visual.modules,this.model.layout,time,viewYaw,pose.yaw,true,fx,gunYaws);
    if(this.gl&&!this.lost) {
      const gl=this.gl,u=this.uniforms;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);
      gl.uniform4f(u.camera,0,38,200,200);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(u.viewYaw,viewYaw);gl.uniform1f(u.heat,visual.overloadBand==='overheated'?1:visual.overloadBand==='hot'?.35:0);
      gl.uniform1f(u.hit,Math.min(1,(fx.hit??0)/.35));gl.uniform1f(u.pulse,.5+Math.sin(time*2.8)*.5);
      gl.uniform1f(u.damage,.4+(visual.hpRatio??1)*.6);
      this.model.parts.forEach((part,i)=>{
        gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[i]);
        this.attributes.forEach((attr,j)=>{gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,j===3?1:3,gl.FLOAT,false,40,j*12);});
        const movable=i===1||i===2;
        const partYaw=part.aim?(gunYaws[part.weapon]??pose.yaw):movable?pose.yaw:(part.spin??0)*time;
        gl.uniform1f(u.yaw,part.aim?partYaw-part.baseYaw:partYaw);
        gl.uniform3f(u.pivot,...(part.pivot??[0,0,0]));gl.uniform1f(u.expansion,i===3?expansion:1);
        const recoil=part.aim?Math.min(1,Math.max(0,(fx[`shoot-${part.weapon}`]??fx.shoot??0)/.28))*4:0;
        gl.uniform3f(u.offset,i===2?-pose.recoil:-Math.cos(part.baseYaw??0)*recoil,movable?this.model.layout.mountHeight:part.name==='core-energy'?Math.sin(time*1.7)*2.4:0,-Math.sin(part.baseYaw??0)*recoil);
        gl.drawArrays(gl.TRIANGLES,0,part.vertices.length/10);
      });
      ctx.drawImage(this.canvas,-MODEL_SIZE/2,-MODEL_SIZE/2,MODEL_SIZE,MODEL_SIZE);
    } else this.drawSoftware(ctx,pose,viewYaw,expansion,time,fx,gunYaws);
    drawModuleEffects(ctx,visual.modules,this.model.layout,time,viewYaw,pose.yaw,false,fx,gunYaws);
    if(visual.modules && (fx.shoot??0)>0) {
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(const module of visual.modules.filter(m=>['pulse','cannon'].includes(m.id))) {
        const shot=fx[`shoot-${module.id}`]??fx.shoot;
        if(!shot) continue;
        const pulse=Math.min(1,shot/.28);
        const p=getMountedMuzzle(module,visual.tier,gunAngles?.[module.id]??angle,shot,viewYaw,visual.modules),r=(module.id==='cannon'?10:6)*pulse;
        const glow=ctx.createRadialGradient(p.muzzleX,p.muzzleY,0,p.muzzleX,p.muzzleY,r*2);
        glow.addColorStop(0,'#fffbe9');glow.addColorStop(.25,module.id==='cannon'?'#ffc580':'#9ff4ff');glow.addColorStop(1,'#73cfff00');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(p.muzzleX,p.muzzleY,r*2,0,TAU);ctx.fill();
      }
      ctx.restore();
    }
    const selected=visual.modules?.find(m=>m.id===visual.selectedModule);
    for(const [module,preview] of [[selected,false],[visual.placementPreview,true]]) {
      if(!module)continue;
      const mount=getModuleMount(module,this.model.layout,visual.modules);
      const px=mount.x*Math.cos(viewYaw)-mount.z*Math.sin(viewYaw),py=38-.8*(mount.y+10)+.6*(mount.x*Math.sin(viewYaw)+mount.z*Math.cos(viewYaw));
      ctx.save();ctx.strokeStyle=preview&&!module.valid?'#ff887d':'#afffed';ctx.lineWidth=2;ctx.globalAlpha=.8;
      if(preview)ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(px,py,22*mount.scale,13*mount.scale,0,0,TAU);ctx.stroke();ctx.restore();
    }
    ctx.restore();return pose;
  }
  drawSoftware(ctx,pose,viewYaw,expansion,time=0,fx={},gunYaws=null) {
    // Same mesh on devices without WebGL. GPU depth testing is preferred.
    const triangles=[];
    const turn=(p,a)=>[p[0]*Math.cos(a)-p[2]*Math.sin(a),p[1],p[0]*Math.sin(a)+p[2]*Math.cos(a)];
    this.model.parts.forEach((part,index)=>{
      const movable=index===1||index===2, data=part.vertices;
      const yaw=movable?pose.yaw:part.aim?((gunYaws?.[part.weapon]??pose.yaw)-part.baseYaw):(part.spin??0)*time,pivot=part.pivot??[0,0,0];
      const recoil=part.aim?Math.min(1,Math.max(0,(fx[`shoot-${part.weapon}`]??fx.shoot??0)/.28))*4:0;
      for(let i=0;i<data.length;i+=30) {
        const points=[];let depth=0;
        for(let j=0;j<3;j++) {
          const k=i+j*10, e=index===3?expansion:1;
          let p=[data[k]*e-(index===2?pose.recoil:Math.cos(part.baseYaw??0)*recoil),data[k+1]+(movable?this.model.layout.mountHeight:part.name==='core-energy'?Math.sin(time*1.7)*2.4:0),data[k+2]*e-Math.sin(part.baseYaw??0)*recoil];
          p=turn(turn(p.map((v,k)=>v-pivot[k]),yaw).map((v,k)=>v+pivot[k]),viewYaw);depth+=.6*p[1]+.8*p[2];
          points.push([p[0],GROUND_Y-.8*p[1]+.6*p[2]]);
        }
        const n=turn(turn(Array.from(data.slice(i+3,i+6)),yaw),viewYaw);
        const lit=.57+Math.abs(-n[0]*.35+n[1]*.64+n[2]*.44)*.48+data[i+9]*.4;
        const rgb=Array.from(data.slice(i+6,i+9),v=>Math.round(Math.min(255,v*255*lit)));
        triangles.push({points,depth,color:`rgb(${rgb.join(',')})`});
      }
    });
    triangles.sort((a,b)=>a.depth-b.depth);
    for(const t of triangles){ctx.fillStyle=t.color;ctx.beginPath();t.points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}
  }
  dispose() {
    if(this.gl){for(const b of this.buffers)this.gl.deleteBuffer(b);this.gl.deleteProgram(this.program);}
    this.buffers=[];this.key='';
  }
}
