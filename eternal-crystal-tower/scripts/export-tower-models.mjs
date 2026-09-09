import {mkdir,writeFile} from 'node:fs/promises';
import {buildTowerModel} from '../src/tower-model.js';

// GLB 2.0 layout: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout
// Export the exact mesh used in game. Articulated parts stay separate for DCC editing.
const directory=new URL('../assets/models/',import.meta.url);
await mkdir(directory,{recursive:true});
for(let tier=0;tier<4;tier++) {
  const model=buildTowerModel({tier});
  const json={asset:{version:'2.0',generator:'CrystalTower mesh exporter'},scene:0,
    scenes:[{nodes:[0]}],nodes:[{name:`Crystal Tower ${tier+1}`,children:[1,2,5],scale:[.01,.01,.01]},
      {name:'Armored base and crystal sockets',mesh:0},
      {name:'Cannon yaw joint',translation:[0,model.layout.mountHeight,0],children:[3,4]},
      {name:'Turret',mesh:1},{name:'Barrel recoil joint',mesh:2},{name:'Overload vents',mesh:3}],
    meshes:[],accessors:[],bufferViews:[],buffers:[],
    materials:[{name:'Crystal alloy and faceted gems',doubleSided:true,pbrMetallicRoughness:{metallicFactor:.25,roughnessFactor:.42}}]};
  let offset=0;const chunks=[];
  for(const part of model.parts){
    const buffer=Buffer.from(part.vertices.buffer,part.vertices.byteOffset,part.vertices.byteLength);
    const view=json.bufferViews.length;
    json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length,byteStride:40,target:34962});
    const attributes={};
    for(const [name,byteOffset] of [['POSITION',0],['NORMAL',12],['COLOR_0',24]]){
      const accessor={bufferView:view,byteOffset,componentType:5126,count:part.vertices.length/10,type:'VEC3'};
      if(name==='POSITION'){
        accessor.min=[Infinity,Infinity,Infinity];accessor.max=[-Infinity,-Infinity,-Infinity];
        for(let i=0;i<part.vertices.length;i+=10)for(let j=0;j<3;j++){
          accessor.min[j]=Math.min(accessor.min[j],part.vertices[i+j]);accessor.max[j]=Math.max(accessor.max[j],part.vertices[i+j]);
        }
      }
      attributes[name]=json.accessors.length;json.accessors.push(accessor);
    }
    json.meshes.push({name:part.name,primitives:[{attributes,material:0,mode:4}]});
    chunks.push(buffer);offset+=buffer.length;
  }
  json.buffers=[{byteLength:offset}];
  const encoded=Buffer.from(JSON.stringify(json));const jsonChunk=Buffer.alloc(Math.ceil(encoded.length/4)*4,0x20);encoded.copy(jsonChunk);
  const binary=Buffer.concat(chunks);const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+binary.length,8);
  const jsonHeader=Buffer.alloc(8);jsonHeader.writeUInt32LE(jsonChunk.length);jsonHeader.writeUInt32LE(0x4e4f534a,4);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
  const filename=`crystal-tower-tier-${tier+1}.glb`;
  await writeFile(new URL(filename,directory),Buffer.concat([header,jsonHeader,jsonChunk,binHeader,binary]));
  console.log(`${filename}: ${model.parts.reduce((n,p)=>n+p.vertices.length/30,0)} triangles`);
}
