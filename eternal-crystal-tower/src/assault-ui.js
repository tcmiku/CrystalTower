import { GATES, assaultFormation, assaultStatus, chooseResonance, startSalvage, recallSalvage, ASSAULT_RULES } from './assault.js';

export function createAssaultUi(getState,notify) {
  const root=document.createElement('aside');root.className='assault-panel';root.setAttribute('aria-label','战线指挥');
  root.innerHTML='<details><summary><span class="assault-kicker">战线指挥</span><strong class="assault-status"></strong></summary><div class="assault-body"><p class="assault-hint"></p><div class="assault-nodes"></div><div class="assault-mission"></div><p class="assault-guide">外圈削减 · 中圈控制 · 内圈兜底<br>预警与整备期间调整模块无需重整</p></div></details>';
  document.body.append(root);let signature='';
  const details=root.querySelector('details');details.open=matchMedia('(min-width: 801px)').matches;
  root.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    const state=getState();let ok=false;
    if(button.dataset.node!==undefined)ok=chooseResonance(state,Number(button.dataset.node));
    if(button.dataset.action==='salvage')ok=startSalvage(state);
    if(button.dataset.action==='recall')ok=recallSalvage(state);
    if(ok){notify(button.dataset.node!==undefined?'共鸣已激活 · 本波追加 3 名重装护卫':button.dataset.action==='salvage'?'无人机远征开始 · 可随时召回':'远征队正在归航');signature='';update(state);}
  });
  root.addEventListener('change',e=>{if(e.target.matches('[data-auto-recall]'))getState().assault.autoRecall=e.target.checked;});
  function update(state){
    const a=state.assault;root.hidden=!state.tower.moduleBay||!a||state.over;
    if(root.hidden)return;
    root.querySelector('.assault-status').textContent=assaultStatus(state);
    root.dataset.phase=a.phase;
    const m=a.mission,hangar=state.tower.moduleBay.installed.some(m=>m.id==='hangar');
    const remaining=a.phase==='cleanup'?state.enemies.filter(e=>e.hp>0&&e.type!=='anchor').length:null;
    const next=JSON.stringify([a.phase,a.nodeChoices,a.resonance,m&&[m.phase,Math.floor(m.progress),m.earned,m.reward],a.salvageAvailable,a.autoRecall,hangar,state.tower.droneEnergy>=25,state.drones.length,state.wave.formation,remaining]);
    if(signature===next)return;signature=next;
    const focus=root.contains(document.activeElement)?document.activeElement.dataset.action??document.activeElement.dataset.node:null;
    root.querySelector('.assault-hint').textContent=a.phase==='rest'?'收取补给，升级晶塔；预警开始后确认下波方向。':a.phase==='cleanup'?`剩余敌军 ${remaining} · 普通增援已停止${remaining?'，留意边缘残敌箭头':'，等待危险弹体消散'}。`:a.phase==='boss-warning'||a.phase==='boss'?'首领战：优先处理弱点与召唤源，普通进攻暂停。':assaultFormation(state.wave.formation).hint;
    root.querySelector('.assault-nodes').innerHTML=a.resonance?`<p class="assault-chosen">◆ ${GATES[a.resonance.gate].node} · 本波生效<br><small>额外护卫已计入本波</small></p>`:a.phase==='warning'&&a.nodeChoices.length?`<b>可选晶簇共鸣 · 二选一</b><small>激活后本入口追加 3 名重装护卫；也可跳过</small>${a.nodeChoices.map(g=>`<button type="button" data-node="${g}"><strong>${GATES[g].short} · ${GATES[g].node}</strong><span>${GATES[g].benefit}</span></button>`).join('')}`:'';
    root.querySelector('.assault-mission').innerHTML=m?`<b>无人机远征 · ${m.phase==='returning'?'归航中':m.phase==='working'?`回收 ${Math.floor(m.progress)}/${ASSAULT_RULES.missionDuration}s`:'前往残骸'}</b><progress max="12" value="${m.progress}" aria-label="远征回收进度"></progress><small>完整回收 ◆${m.reward} · 提前召回按进度结算</small><button type="button" data-action="recall" ${m.phase==='returning'?'disabled':''}>立即召回</button><label><input type="checkbox" data-auto-recall ${a.autoRecall?'checked':''}> 接敌前 5 秒自动召回</label>`:a.salvageAvailable&&hangar?`<b>外圈发现补给残骸</b><small>派出半数机群（最多 2 架） · 回收 12 秒<br>出发耗电 15，途中持续耗电；需要至少 25 电量</small><button type="button" data-action="salvage" ${state.tower.droneEnergy<25||!state.drones.length?'disabled':''}>派出无人机 · 回收补给</button>`:'';
    if(focus)root.querySelector(`[data-action="${focus}"], [data-node="${focus}"]`)?.focus({preventScroll:true});
  }
  return {update};
}
