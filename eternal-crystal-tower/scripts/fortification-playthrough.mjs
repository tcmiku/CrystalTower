import { writeFile } from 'node:fs/promises';
import { createGameState, updateGame, collectCoinAt, chooseRelic, getTechStatus, purchaseUpgrade, useSkill } from '../src/engine.js';
import { buildForts, fortAction, fortPlanning } from '../src/fortifications.js';
import { installModule, moduleUpgradeCost, upgradeModule } from '../src/modules.js';

// Equal opening wallet and decision policy, including unspent construction funds.
const layouts={
  wall: [['wall',Array.from({length:8},(_,i)=>({x:615+i*30,y:260}))],['wall',Array.from({length:8},(_,i)=>({x:615+i*30,y:740}))]],
  gun: [['gun',[{x:720,y:290}]],['gun',[{x:720,y:710}]]],
  mixed: [['wall',Array.from({length:4},(_,i)=>({x:660+i*30,y:260}))],['wall',Array.from({length:4},(_,i)=>({x:660+i*30,y:740}))],['gun',[{x:720,y:320}]]]
};
const results=[];
for(const seed of [41,73,95])for(const [layout,placements] of Object.entries(layouts)){
  const s=createGameState(seed);for(const [type,points] of placements){const result=buildForts(s,type,points);if(!result.ok)throw Error(result.reason);}
  let peak=0,damage=0,repairSpent=0,steps=0;const started=performance.now();
  for(;steps<1200*60&&!s.over&&s.assault.lastCleared<22;steps++){
    if(steps%30===0){
      for(const orb of s.coinOrbs)collectCoinAt(s,orb.x,orb.y,12);
      if(s.relicChoice){const choices=s.relicChoice.choices;chooseRelic(s,choices.find(c=>c==='supply:coins')??choices.find(c=>!c.startsWith('spec:'))??choices[0]);}
      if(s.tower.hp<300)useSkill(s,'heal');
      if(fortPlanning(s))for(const b of s.fortifications.items){if(b.hp>0&&b.hp<b.maxHp&&!b.repairing)fortAction(s,b.id,'repair');}
      if(!s.tower.moduleBay.installed.some(m=>m.id==='cannon'))installModule(s,'cannon',1);
      else {
        const options=['damage','rate','ascend'].map(key=>({key,status:getTechStatus(s,key)})).filter(c=>c.status.unlocked&&!c.status.maxed).map(c=>({cost:c.status.cost,apply:()=>purchaseUpgrade(s,c.key)}));
        for(const m of s.tower.moduleBay.installed)if(m.level<3)options.push({cost:moduleUpgradeCost(m),apply:()=>upgradeModule(s,m.slot)});
        options.sort((a,b)=>a.cost-b.cost);options.find(o=>o.cost<=s.coins)?.apply();
      }
    }
    const hp=s.tower.hp,cash=s.coins;updateGame(s,1/60);damage+=Math.max(0,hp-s.tower.hp);if(s.fortifications.items.some(b=>b.repairing))repairSpent+=Math.max(0,cash-s.coins);
    peak=Math.max(peak,s.enemies.length);
  }
  results.push({seed,layout,seconds:Number(s.time.toFixed(1)),cleared:s.assault.lastCleared,phase:s.assault.phase,over:s.over,hp:Math.round(s.tower.hp),damage:Math.round(damage),ruins:s.fortifications.items.filter(b=>b.hp<=0).length,repairSpent:Number(repairSpent.toFixed(1)),peakEnemies:peak,simulationMs:Math.round(performance.now()-started)});
}
await writeFile(new URL('../qa/fortification-playthrough.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results));
