import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createGameState,updateGame,spawnEnemy,getTowerStats,getTowerPosition,getTechStatus,purchaseUpgrade,collectCoinAt,useSkill,chooseRelic,toggleDroneMode,getDroneEnergyMax} from '../src/engine.js';
import {installModule,removeModule,upgradeModule,moduleUpgradeCost,installedModule,moveModule,specializeModule} from '../src/modules.js';

// Legal six-cell builds. Keep the starter gun to cover a specialist's blind spot.
export const BALANCE_BUILDS={
  cannon:{primary:'cannon',modules:[['cannon',1],['fire',4],['frost',5],['shield',3]]},
  blade:{primary:'blade',modules:[['blade',1],['frost',4],['fire',5],['shield',3]]},
  hive:{primary:'hangar',modules:[['hangar',1],['fire',4],['lightning',5],['shield',3]]},
  element:{primary:'pulse',pulseSlot:1,modules:[['frost',0],['fire',2],['lightning',4],['shield',3]]},
  mixed:{primary:'cannon',modules:[['cannon',1],['blade',3],['frost',5]]}
};

export function simulateBuild(id,seed=71,{seconds=900,startingGold=700}={}) {
  const preset=BALANCE_BUILDS[id],s=createGameState(seed);
  s.coins=startingGold;
  if(preset.pulseSlot!=null) moveModule(s,0,preset.pulseSlot);
  let spent=0,returns=0,reactions=0,attackSeconds=0,peakEnemies=0;
  const sample=[];
  for(let tick=0;tick<seconds*60&&!s.over;tick++) {
    if(tick%30===0) {
      for(const orb of s.coinOrbs) collectCoinAt(s,orb.x,orb.y,12);
      if(s.relicChoice) {
        // Same decision policy for every build; avoid randomized specialization luck.
        const choices=s.relicChoice.choices;
        const reward=s.tower.hp<getTowerStats(s).maxHp*.6&&choices.includes('supply:repair')?'supply:repair':choices.includes('supply:coins')?'supply:coins':choices.find(c=>!c.startsWith('spec:'))??choices[0];
        chooseRelic(s,reward);
      }
      if(installedModule(s,'hangar')&&s.tower.droneMode==='collect'&&s.tower.droneEnergy>=getDroneEnergyMax(s)*.9)toggleDroneMode(s);
      if(s.tower.hp<getTowerStats(s).maxHp*.75)useSkill(s,'heal');
      const missing=preset.modules.find(([module])=>!installedModule(s,module));
      const before=s.coins;
      if(missing) installModule(s,...missing);
      else {
        const candidates=[];
        for(const key of ['damage','rate','ascend']) {
          const status=getTechStatus(s,key);
          if(status.unlocked&&!status.maxed)candidates.push({cost:status.cost,apply:()=>purchaseUpgrade(s,key)});
        }
        // Equal purchase policy: cheapest affordable core/weapon upgrade, then reactors.
        if(s.tower.moduleBay.refitCooldown===0)for(const m of s.tower.moduleBay.installed) {
          if(m.level<3&&m.id!=='shield')candidates.push({cost:moduleUpgradeCost(m),apply:()=>upgradeModule(s,m.slot)});
        }
        candidates.sort((a,b)=>a.cost-b.cost);
        candidates.find(a=>a.cost<=s.coins)?.apply();
      }
      spent+=Math.max(0,before-s.coins);
    }
    updateGame(s,1/60);
    returns+=s.events.filter(e=>e.type==='droneDepleted').length;
    reactions+=s.events.filter(e=>e.type==='moduleReaction').length;
    attackSeconds+=s.tower.droneMode==='attack'?1/60:0;
    peakEnemies=Math.max(peakEnemies,s.enemies.length);
    if(tick%3600===0)sample.push({time:Math.round(s.time),hp:Math.round(s.tower.hp),kills:s.stats.kills,levels:s.tower.moduleBay.installed.map(m=>[m.id,m.level])});
  }
  return {build:id,seed,seconds:+s.time.toFixed(1),over:s.over,kills:s.stats.kills,bossKills:s.stats.bossKills,threat:s.threat,hp:Math.round(s.tower.hp),spent,returns,reactions,attackDuty:+(attackSeconds/Math.max(1,s.time)).toFixed(3),peakEnemies,levels:s.tower.moduleBay.installed.map(m=>[m.id,m.level]),core:[s.tower.upgrades.damage,s.tower.upgrades.rate,s.tower.upgrades.ascend],sample};
}

export function measureWeapon(id,level,scenario,{specialization,seconds=30}={}) {
  const s=createGameState(193),p=getTowerPosition(s);
  removeModule(s,0);s.coins=100000;s.spawnTimer=s.wave.nextAt=9999;
  installModule(s,id,0);
  for(let n=1;n<level;n++)upgradeModule(s,0);
  if(specialization) specializeModule(s,specialization);
  if(id==='hangar')toggleDroneMode(s);
  const count=scenario.endsWith('crowd')?12:1,radius=scenario==='near'||scenario==='crowd'?118:300;
  const targetHp=1_000_000_000;
  const targets=Array.from({length:count},(_,i)=>{
    const a=i*Math.PI*2/count,e=spawnEnemy(s,scenario==='boss'?'boss':'brute',{x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius});
    Object.assign(e,{hp:targetHp,maxHp:targetHp,speed:0,damage:0,attackRange:0});return e;
  });
  // Isolate weapon damage from boss repair anchors and encounter summons.
  s.enemies=targets;
  let attackTicks=0,returns=0;
  for(let tick=0;tick<seconds*60;tick++) {
    if(id==='hangar'&&s.tower.droneMode==='collect'&&s.tower.droneEnergy>=getDroneEnergyMax(s)*.9)toggleDroneMode(s);
    updateGame(s,1/60);if(s.tower.droneMode==='attack')attackTicks++;
    returns+=s.events.filter(e=>e.type==='droneDepleted').length;
  }
  const damage=targets.reduce((sum,e)=>sum+targetHp-e.hp,0),cost=installedModule(s,id).invested;
  return {weapon:id,level,scenario,...(specialization?{specialization}:{}),dps:+(damage/seconds).toFixed(2),cost,dpsPer100Gold:+(damage/seconds/cost*100).toFixed(2),attackDuty:+(attackTicks/(seconds*60)).toFixed(3),returns};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const output=process.argv[2]??'qa/module-balance/latest.json';
  const seeds=(process.env.BALANCE_SEEDS??'11,71,20260911').split(',').map(Number);
  const weapons=['pulse','cannon','blade','hangar'].flatMap(id=>[1,2,3].flatMap(level=>['near','ranged','crowd','ranged-crowd','boss'].map(scenario=>measureWeapon(id,level,scenario))));
  const specs=[['pulse','pulseSplit'],['pulse','pulseFocus'],['cannon','cannonLance'],['cannon','cannonBurst'],['blade','bladeGuard'],['blade','bladeReturn'],['hangar','hangarHeavy'],['hangar','hangarSwarm']].flatMap(([id,specialization])=>['crowd','ranged-crowd','boss'].map(scenario=>measureWeapon(id,3,scenario,{specialization})));
  const runs=[];
  for(const id of Object.keys(BALANCE_BUILDS))for(const seed of seeds){const run=simulateBuild(id,seed);runs.push(run);console.log(id,seed,run.seconds,run.kills,run.core.join('/'));}
  const summary=Object.keys(BALANCE_BUILDS).map(build=>{const subset=runs.filter(r=>r.build===build);return {build,meanSeconds:+(subset.reduce((n,r)=>n+r.seconds,0)/subset.length).toFixed(1),meanKills:Math.round(subset.reduce((n,r)=>n+r.kills,0)/subset.length),range:subset.map(r=>r.seconds)};});
  await mkdir(new URL('../qa/module-balance/',import.meta.url),{recursive:true});
  await writeFile(output,JSON.stringify({seeds,policy:'700 gold, starter gun retained, legal build first, cheapest core/module upgrades, heal and manual collection, neutral supply rewards, 900 second horizon; isolated weapon tests use base tower stats and 30 seconds',summary,weapons,specs,runs},null,2)+'\n');
  console.log(JSON.stringify(summary));
}
