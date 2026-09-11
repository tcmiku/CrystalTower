import { MODULES } from './modules.js';

const armor = [.16, .25, .38], edge = [.49, .64, .75], dark = [.025, .055, .09];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// Local +X is the long side. Geometry and normals are transformed together when mounted.
export function buildModuleMesh(builder, { id, level = 1, component = "all" }) {
  const m = builder(), meta = MODULES[id];
  if (!meta) return new Float32Array();
  const color = rgb(meta.color), long = meta.size === 2;
  // Module-colored armor separates equipment from the tower's blue chassis.
  const armor=color.map(v=>v*.43+.08), edge=color.map(v=>Math.min(1,v*.45+.45));
  m.box(0, 0, 0, long ? 37 : 24, 5, 23, dark);
  m.box(0, 5, 0, long ? 35 : 22, 3, 21, edge);
  for (const side of [-1, 1]) m.box(0, 8, side * 10, long ? 32 : 20, 2, 2, color);
  const gunStart=m.data.length;
  if (id === 'pulse' || id === 'cannon') {
    const heavy = id === 'cannon';
    m.ring(-5, 8, 0, heavy ? 10 : 8, 0, 5, armor, 12);
    m.box(-4, 13, 0, heavy ? 20 : 13, 10, 15, armor);
    m.box(-6, 23, 0, 12, 3, 12, edge);
    // Barrel segments along X, with dark recessed bore and energized rails.
    m.box(heavy ? 17 : 12, 15, 0, heavy ? 35 : 24, heavy ? 9 : 6, heavy ? 10 : 6, armor);
    m.box(heavy ? 32 : 23, 14, 0, 5, heavy ? 11 : 8, heavy ? 13 : 9, edge);
    m.box(heavy ? 35 : 26, 16, 0, 1, heavy ? 7 : 4, heavy ? 8 : 5, dark);
    for (const side of [-1, 1]) {
      m.box(heavy ? 15 : 11, 21, side * (heavy ? 4 : 2), heavy ? 31 : 22, 2, 2, color);
      if (heavy) m.box(-10, 12, side * 10, 12, 8, 5, armor);
    }
  } else if (id === 'blade') {
    m.ring(0, 8, 0, 12, 0, 7, armor, 12);
    m.ring(0, 15, 0, 19, 12, 3, edge, 24);
    m.ring(0, 18, 0, 14, 10, 2, color, 24);
    m.crystal(0, 16, 0, 5, 12, 0, [color, edge, color]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, p = (r, t, y) => [Math.cos(t) * r, y, Math.sin(t) * r];
      m.face([p(15,a,18),p(25,a+.16,18),p(17,a+.42,18)],edge);
      m.face([p(15,a,16),p(17,a+.42,18),p(25,a+.16,18)],armor);
    }
  } else if (id === 'hangar') {
    m.box(0, 8, 0, 35, 14, 22, armor);
    m.box(0, 22, 0, 37, 3, 24, edge);
    for (const x of [-11, 0, 11]) {
      m.box(x, 10, 11.2, 8, 10, 1, dark);
      m.box(x, 19, 12, 6, 2, 1, color);
      m.box(x, 25, 0, 7, 2, 12, dark);
    }
    // A docked scout makes the hangar readable even at battlefield scale.
    m.box(0, 29, 0, 9, 4, 5, color);
    for (const x of [-8, 8]) m.ring(x, 29, 0, 5, 3, 2, armor, 10);
    m.box(13, 25, -7, 2, 14, 2, edge);
    m.crystal(13, 39, -7, 2, 4, 0, [color,color,edge]);
  } else if (id === 'shield') {
    m.box(0, 8, 0, 8, 17, 8, armor);
    // Faceted upright shield, with an inset emitter and thick rim.
    const panel = (scale, z, c, glow) => m.face([[-12*scale,30,z],[0,36*scale,z],[12*scale,30,z],[10*scale,15,z],[0,8,z],[-10*scale,15,z]],c,glow);
    panel(1,5,edge,0); panel(.78,5.5,color,.35);
    m.crystal(0, 17, 7, 4, 13, 0, [color,edge,color]);
    m.box(0, 11, 1, 18, 3, 5, armor);
  } else {
    m.ring(0, 8, 0, 10, 0, 5, armor, 8);
    m.ring(0, 13, 0, 11, 7, 3, edge, 8);
    if (id === 'frost') {
      for (const [x,z,h] of [[0,0,29],[-6,2,18],[5,4,15]]) m.crystal(x,16,z, x === 0 ? 6 : 4,h,x*.06,[color,[.8,.96,1],[.2,.52,.8]]);
    } else if (id === 'fire') {
      m.ring(0, 16, 0, 9, 6, 14, dark, 10);
      m.crystal(0,17,0,7,22,0,[color,[1,.7,.15],[.8,.16,.06]]);
      for (const side of [-1,1]) m.box(side*8,16,0,3,18,9,armor);
      m.ring(0,30,0,11,8,3,edge,10);
    } else {
      for (const side of [-1,1]) {
        m.box(side*8,16,0,3,21,4,edge);
        for (let y=20;y<=32;y+=6) m.ring(side*8,y,0,5,2,2,color,10);
      }
      m.crystal(0,26,0,6,16,0,[color,[.92,.82,1],[.37,.2,.65]]);
    }
  }
  // Energized identity strips stay legible at gameplay scale.
  for(let i=0;i<m.data.length;i+=10) {
    if(color.every((v,k)=>Math.abs(m.data[i+6+k]-v)<1e-6)) m.data[i+9]=Math.max(m.data[i+9],.35);
  }
  const gunEnd=m.data.length;
  // Level markers are physical illuminated studs; higher levels add armored ribs.
  for (let i=0;i<Math.min(3,Math.max(1,level));i++) {
    m.box(-7+i*7,3,12,4,3,2,color);
    if (level > 1) m.box(-10+i*10,8,-11,3,5+level*2,3,edge);
  }
  return new Float32Array(component === "gun" ? m.data.slice(gunStart,gunEnd) : component === "base" ? [...m.data.slice(0,gunStart),...m.data.slice(gunEnd)] : m.data);
}

export function getModuleMount(module, layout) {
  // The numbered slot identifies a wall attachment sector, north first.
  const angle=module.slot*Math.PI/3-Math.PI/2;
  const radius=layout.radius*1.08+17;
  return {x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,
    y:29+layout.tier*6+Math.max(0,-Math.sin(angle))*18,
    scale:1.35+layout.tier*.07, yaw:angle+(module.rotation===1?Math.PI/2:0),angle};
}

export function buildMountedModules(builder, installed, layout) {
  const parts = [];
  for (const module of installed) {
    if (!MODULES[module.id]) continue;
    const {x,y,z,scale,yaw,angle}=getModuleMount(module,layout);
    const support = builder(), color=rgb(MODULES[module.id].color);
    // A short mechanical cantilever, anchored into a curved wall collar.
    const radius=Math.hypot(x,z), inner=layout.radius*.69, reach=radius-inner;
    support.ring(0,y-9,0,layout.radius*.88,layout.radius*.72,9,armor,5,angle-.24,.48);
    support.box(Math.cos(angle)*(inner+reach/2),y-6,Math.sin(angle)*(inner+reach/2),reach+6,6,12,dark,angle);
    support.box(x,y-3,z,28*scale,3,25*scale,edge,yaw);
    for(const side of [-1,1]) {
      const px=x-Math.sin(yaw)*side*10*scale,pz=z+Math.cos(yaw)*side*10*scale;
      support.box(px,y-1,pz,22*scale,2,3,color,yaw);
    }
    parts.push({name:`socket-${module.id}`,vertices:new Float32Array(support.data)});
    const gun=module.id==='pulse'||module.id==='cannon';
    for(const component of gun ? ['base','gun'] : module.id==='blade' ? ['base','rotor'] : ['all']) {
    const vertices=buildModuleMesh(builder,{...module,component:component==='rotor'?'gun':component});
    for(let i=0;i<vertices.length;i+=10) {
      const px=vertices[i]*scale,pz=vertices[i+2]*scale,nx=vertices[i+3],nz=vertices[i+5];
      vertices[i]=x+px*Math.cos(yaw)-pz*Math.sin(yaw);
      vertices[i+1]=y+vertices[i+1]*scale;
      vertices[i+2]=z+px*Math.sin(yaw)+pz*Math.cos(yaw);
      vertices[i+3]=nx*Math.cos(yaw)-nz*Math.sin(yaw);
      vertices[i+5]=nx*Math.sin(yaw)+nz*Math.cos(yaw);
    }
    parts.push({name:component==='gun'?`gun-${module.id}`:component==='rotor'?'rotor-blade':`module-${module.id}`,vertices,
      ...(component==='rotor'?{spin:6,pivot:[x,y,z]}:{}),
      ...(component==='gun'?{aim:true,weapon:module.id,baseYaw:yaw,pivot:[x,y,z]}:{})});
    }
  }
  return parts;
}
