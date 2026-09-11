import {mkdir,writeFile} from 'node:fs/promises';
import {buildEnemyModel,ENEMY_MODEL_TYPES} from '../src/enemy-model.js';

// Export the same procedural meshes the game uses. One GLB per common mob type.
const directory=new URL('../assets/models/',import.meta.url);
await mkdir(directory,{recursive:true});
for(const type of ENEMY_MODEL_TYPES) {
  const model=buildEnemyModel(type);
  const json={asset:{version:'2.0',generator:'CrystalTower enemy mesh exporter'},scene:0,
    scenes:[{nodes:[0]}],nodes:[{name:`Enemy ${type}`,children:[1],scale:[.01,.01,.01]},
      {name:model.parts[0]?.name??type,mesh:0}],
    meshes:[],accessors:[],bufferViews:[],buffers:[],
    materials:[{name:'Corruption rock and molten crystal',doubleSided:true,pbrMetallicRoughness:{metallicFactor:.2,roughnessFactor:.48}}]};
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
  const filename=`enemy-${type}.glb`;
  await writeFile(new URL(filename,directory),Buffer.concat([header,jsonHeader,jsonChunk,binHeader,binary]));
  const tris=model.parts.reduce((n,p)=>n+p.vertices.length/30,0);
  console.log(`${filename}: ${tris} triangles`);
}
