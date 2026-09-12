// A closed, beveled crystal rotor shared by the mount and flying blades.
export function buildCrystalBlade(builder) {
  const m=builder(), steel=[.45,.62,.70], dark=[.07,.15,.20], mint=[.65,.96,.48], white=[.88,1,.78];
  m.ring(0,-3,0,12,6,6,dark,16);
  m.ring(0,3,0,12,7,2,steel,16);
  m.ring(0,5,0,9,6,1,mint,16);
  m.crystal(0,-3,0,6,13,0,[mint,white,steel]);
  for(let i=0;i<6;i++) {
    const a=i*Math.PI/3, p=(r,t,y)=>[Math.cos(a+t)*r,y,Math.sin(a+t)*r];
    const rim=[p(9,-.17,0),p(20,-.12,0),p(29,.25,0),p(16,.43,0)];
    const ridge=p(18,.12,4);
    for(let j=0;j<4;j++) {
      const next=(j+1)%4, lower=v=>[v[0],-3,v[2]];
      m.face([rim[j],ridge,rim[next]],j===1?white:j===2?mint:steel,j===1?.65:.12);
      m.face([lower(rim[next]),[ridge[0],-4,ridge[2]],lower(rim[j])],dark);
      m.face([rim[j],rim[next],lower(rim[next]),lower(rim[j])],j===1?mint:steel,j===1?.65:0);
    }
  }
  return new Float32Array(m.data);
}
