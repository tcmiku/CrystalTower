import { writeFile } from 'node:fs/promises';
import { createGameState, spawnEnemy, updateGame } from '../src/engine.js';
import { buildForts } from '../src/fortifications.js';
const s=createGameState(73);s.coins=10000;s.tower.upgrades.ascend=3;s.tower.moduleBay.installed=[];s.wave.nextAt=99999;
const points=[];for(let x=540;x<=900;x+=30)points.push({x,y:320},{x,y:680});for(let y=350;y<680;y+=30)points.push({x:540,y},{x:900,y});
buildForts(s,'wall',points);
for(let i=0;i<160;i++){const a=i*2.399963,e=spawnEnemy(s,'runner',{x:720+Math.cos(a)*300,y:500+Math.sin(a)*300},{waveIndex:1});e.damage=0;}
const times=[];
for(let i=0;i<180;i++){const start=performance.now();updateGame(s,1/60);times.push(performance.now()-start);}
times.sort((a,b)=>a-b);
const result={enemies:s.enemies.length,walls:s.fortifications.items.length,frames:times.length,maxMs:times.at(-1),p95Ms:times[Math.floor(times.length*.95)],meanMs:times.reduce((a,b)=>a+b)/times.length};
await writeFile(new URL('../qa/fortification-stress.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
