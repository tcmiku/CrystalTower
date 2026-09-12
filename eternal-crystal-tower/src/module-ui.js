import { MODULES, MODULE_BALANCE, SPECIALIZATIONS, getBayLayout, moduleAt, installedModule, occupiedSlots, adjacentReactors, modulesAdjacent, modulePlacementStatus, moduleMoveStatus, moduleUpgradeCost, installModule, removeModule, moveModule, upgradeModule } from './modules.js';

export const createCompactModuleUi = (root,state,options) => createModuleUi(root,state,{...options,compact:true});

export function createModuleUi(root,state,{icon,notify,refresh,coreStatus,buyCore,compact=false}) {
  const controller=new AbortController(), signal=controller.signal;
  let selected=null, held=null, gesture=null, hover=null, signature='', suppress=false, lastPoint=null;
  const directions=['北','东北','东南','南','西南','西北'];
  root.classList.add('module-editor');
  if(!compact) root.classList.add('module-workspace');
  root.innerHTML=`${compact?'<header class="module-float-header"><span>模块装配</span><button type="button" data-action="close" aria-label="关闭模块装配">×</button></header>':''}<section class="module-layout"><div class="module-heading"><span>装配</span><strong class="module-capacity"></strong></div><div class="module-board"></div><div class="module-editor-tools"><button type="button" data-action="rotate" title="旋转 R" aria-label="旋转模块">↻</button><button type="button" data-action="cancel">取消</button><span class="module-hint" role="status"></span></div><div class="module-selection"></div>${coreStatus?'<div class="module-core-upgrades"></div>':''}</section><section class="module-catalog"><div class="module-heading"><span>仓库</span><small class="module-wallet"></small></div><div class="module-cards"></div></section>`;
  const board=root.querySelector('.module-board'), info=root.querySelector('.module-selection');
  const ghost=document.createElement('div');ghost.className='module-drag-ghost';ghost.hidden=true;document.body.append(ghost);
  const listen=(target,type,fn)=>target.addEventListener(type,fn,{signal});
  const btn=(label,action,disabled=false)=>`<button type="button" data-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
  const locked=()=>state.over||state.tower.moduleBay.refitCooldown>0;
  const available=id=>!locked()&&(installedModule(state,id)||state.coins>=MODULES[id].cost);
  function select(id){selected=id;state.moduleSelection=id;signature='';update()}
  function begin(id,offset={x:0,y:0}) {
    if(!available(id))return false;
    const m=installedModule(state,id);
    held={id,from:m?.slot??null,rotation:m?.rotation??0,offset};selected=id;state.moduleSelection=id;
    ghost.style.setProperty('--module-color',MODULES[id].color);
    ghost.innerHTML='<span class="module-art"></span>';icon(ghost.firstChild,MODULES[id].icon);
    updateTools();paint();return true;
  }
  function cancel(){lastPoint=null;held=null;hover=null;gesture=null;ghost.hidden=true;delete state.modulePreview;signature='';update()}
  function bayLayout(){return getBayLayout(state)}
  function rawCell(event) {
    const {columns,rows}=bayLayout();
    const r=board.getBoundingClientRect(),style=getComputedStyle(board),gapX=parseFloat(style.columnGap)||0,gapY=parseFloat(style.rowGap)||0;
    const w=(r.width-gapX*(columns-1))/columns,h=(r.height-gapY*(rows-1))/rows,px=event.clientX-r.left,py=event.clientY-r.top;
    const x=Math.floor(px/(w+gapX)),y=Math.floor(py/(h+gapY));
    if(x<0||x>=columns||y<0||y>=rows||px-x*(w+gapX)>w||py-y*(h+gapY)>h)return null;
    return {x,y};
  }
  function target(event){const c=rawCell(event);if(!c||!held)return null;const {columns,rows}=bayLayout();const x=c.x-held.offset.x,y=c.y-held.offset.y;return x<0||x>=columns||y<0||y>=rows?null:y*columns+x}
  const placement=cell=>held.from!==null?moduleMoveStatus(state,held.id,cell,held.rotation):modulePlacementStatus(state,held.id,cell,false,held.rotation);
  function updateTools(){root.querySelector('[data-action="rotate"]').disabled=(!held&&!selected)||MODULES[held?.id??selected]?.size===1||locked();root.querySelector('[data-action="cancel"]').style.visibility=held?'visible':'hidden'}
  function paint(){
    board.querySelectorAll('.module-cell').forEach(n=>n.classList.remove('preview-good','preview-bad'));
    board.querySelectorAll('.module-piece').forEach(n=>n.classList.toggle('lifted',held?.id===n.dataset.id));
    const hint=root.querySelector('.module-hint');hint.textContent='';
    delete state.modulePreview;
    if(!held||hover===null)return;
    const status=placement(hover);
    state.modulePreview={id:held.id,slot:hover,rotation:held.rotation,valid:status.ok};
    const {columns,rows}=bayLayout();
    const x=hover%columns,y=Math.floor(hover/columns);
    for(let i=0;i<MODULES[held.id].size;i++){
      const cx=x+(held.rotation===0?i:0),cy=y+(held.rotation===1?i:0);
      if(cx<columns&&cy<rows)board.querySelector(`[data-cell="${cy*columns+cx}"]`)?.classList.add(status.ok?'preview-good':'preview-bad');
    }
    if(!status.ok||status.swap)hint.textContent=status.reason;
    ghost.classList.toggle('invalid',!status.ok);
  }
  function place(cell,dragged=false){
    if(!held)return;
    if(cell===null){cancel();return}
    const status=placement(cell);
    if(!status.ok){notify(status.reason);if(dragged)cancel();return}
    const same=held.from===cell&&(installedModule(state,held.id)?.rotation??0)===held.rotation;
    const ok=same||(held.from===null?installModule(state,held.id,cell,held.rotation):moveModule(state,held.from,cell,held.rotation));
    if(ok){cancel();refresh()}
  }
  function rotate(){
    if(!held&&selected)begin(selected);
    if(!held||MODULES[held.id].size===1)return;
    held.rotation=1-held.rotation;held.offset={x:held.offset.y,y:held.offset.x};if(lastPoint)hover=target(lastPoint);paint();updateTools();
  }
  function handleKey(event){
    if(event.key==='Escape'&&held)cancel();
    else if(event.key.toLowerCase()==='r'&&(held||selected)&&!locked())rotate();
    else return false;
    event.preventDefault();return true;
  }
  listen(root,'pointerdown',event=>{
    if(event.button!==0||held)return;
    const source=event.target.closest('[data-id]');if(!source||!available(source.dataset.id))return;
    const m=source.classList.contains('module-piece')?installedModule(state,source.dataset.id):null,c=rawCell(event);
    const {columns}=bayLayout();
    gesture={id:source.dataset.id,x:event.clientX,y:event.clientY,dragging:false,offset:m&&c?{x:c.x-m.slot%columns,y:c.y-Math.floor(m.slot/columns)}:{x:0,y:0}};
    root.setPointerCapture(event.pointerId);
  });
  listen(root,'pointermove',event=>{
    if(gesture&&!gesture.dragging&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7){gesture.dragging=begin(gesture.id,gesture.offset)}
    if(!held)return;
    lastPoint={clientX:event.clientX,clientY:event.clientY};hover=target(event);
    ghost.hidden=!gesture?.dragging;ghost.style.left=`${event.clientX+12}px`;ghost.style.top=`${event.clientY+12}px`;
    paint();
  });
  listen(root,'pointerleave',()=>{if(!gesture){hover=null;paint()}});
  listen(root,'pointerup',event=>{
    if(!gesture)return;const g=gesture;gesture=null;
    if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);
    suppress=true;setTimeout(()=>suppress=false,0);
    if(g.dragging)place(target(event),true);else select(g.id);
  });
  listen(root,'pointercancel',cancel);
  listen(root,'click',event=>{
    if(suppress)return;
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='close'){root.dispatchEvent(new CustomEvent('module-float-close',{bubbles:true}));return}
    if(action==='cancel'){cancel();return}
    if(action==='rotate'){rotate();return}
    if(action==='move'||action==='install'){begin(selected);return}
    const m=installedModule(state,selected);
    if(action==='upgrade'||action==='remove'){
      if(m&&(action==='upgrade'?upgradeModule(state,m.slot):removeModule(state,m.slot))){cancel();refresh()}return;
    }
    if(action?.startsWith('core-')){buyCore(action.slice(5));signature='';update();return}
    if(event.target.closest('.module-board')&&held){
      const cell=event.target.closest('[data-cell]')?.dataset.cell;
      const piece=event.target.closest('.module-piece')?.dataset.id;
      place(event.detail===0?(cell!==undefined?Number(cell):installedModule(state,piece)?.slot??null):target(event));return;
    }
    const id=event.target.closest('[data-id]')?.dataset.id;if(id)select(id);
  });
  function updateLive(){
    const live=info.querySelector('.module-live-status');if(!live)return;
    const m=installedModule(state,selected);let text='';
    if(m?.id==='mortar')text=`${m.cooldown>0?`装填 ${m.cooldown.toFixed(1)}s`:'等待射程内目标'} · 在途 ${state.tower.moduleBay.combat.shells.length} 枚`;
    else if(m?.id==='gravity')text=`${directions[m.slot%6]} · ${m.cooldown>0?`牵引冷却 ${m.cooldown.toFixed(1)}s`:'等待扇区目标'}`;
    else if(m?.id==='interceptor')text=`${directions[m.slot%6]} · 拦截弹 ${m.charges??0}/${MODULE_BALANCE.interceptor.capacity[m.level-1]}${m.charges<MODULE_BALANCE.interceptor.capacity[m.level-1]?` · 充能 ${Math.max(0,MODULE_BALANCE.interceptor.recharge[m.level-1]-(m.recharge??0)).toFixed(1)}s`:''}`;
    else if(m?.id==='service')text=!modulesAdjacent(state,'hangar','service')?'未连接 · 需与机库共享一条边':m.launchBuff>0?`出击省电 ${m.launchBuff.toFixed(1)}s`:m.servicing?'归航整备 · 回电加速':m.recharged&&m.level>=3?'整备完成 · 下次出击省电':'已连接机库 · 等待归航';
    else if(selected&&MODULES[selected]?.directional)text='锚定格决定防守方向 · 战场预览显示范围';
    else if(selected)text=`${MODULES[selected].size} 格${MODULES[selected].element?' · 只连接共享边的武器':''}`;
    if(live.textContent!==text)live.textContent=text;
  }
  function update(){
    if(gesture?.dragging)return;
    updateLive();
    const bay=state.tower.moduleBay,next=JSON.stringify([bay.revision,Math.floor(state.coins),Math.ceil(bay.refitCooldown),state.over,selected,held,state.tower.upgrades]);
    if(signature===next)return;signature=next;
    const focus=root.contains(document.activeElement)?document.activeElement.dataset.focus:null;
    const {columns,rows,slotCount}=bayLayout();
    board.style.setProperty('--module-rows',String(rows));
    root.querySelector('.module-capacity').innerHTML=`${occupiedSlots(state)}<small>/${slotCount}</small>`;
    root.querySelector('.module-wallet').textContent=`◆ ${Math.floor(state.coins)}${bay.refitCooldown>0?` · ${Math.ceil(bay.refitCooldown)}s`:''}`;
    board.innerHTML='';
    board.style.setProperty('--module-columns',String(columns));
    board.style.setProperty('--module-rows',String(rows));
    for(let cell=0;cell<slotCount;cell++){
      const n=document.createElement('button');n.type='button';n.className='module-cell';n.dataset.cell=cell;n.dataset.focus=`cell-${cell}`;
      n.style.gridColumn=String(cell%columns+1);
      n.style.gridRow=String(Math.floor(cell/columns)+1);
      n.innerHTML=`<b>${cell+1}</b>`;n.setAttribute('aria-label',`第 ${cell+1} 格，${directions[cell%6]}，${MODULES[moduleAt(state,cell)?.id]?.name??'空格'}`);board.append(n);
    }
    const connected=selected?(MODULES[selected]?.weapon?adjacentReactors(state,selected).map(m=>m.id):bay.installed.filter(m=>MODULES[m.id].weapon&&adjacentReactors(state,m.id).some(r=>r.id===selected)).map(m=>m.id)):[];
    if(['hangar','service'].includes(selected)&&modulesAdjacent(state,'hangar','service'))connected.push(selected==='hangar'?'service':'hangar');
    for(const m of bay.installed){
      const n=document.createElement('button');n.type='button';n.className=`module-piece${selected===m.id?' inspected':''}${connected.includes(m.id)?' connected':''}`;n.dataset.id=m.id;n.dataset.focus=`piece-${m.id}`;
      n.style.gridColumn=`${m.slot%columns+1} / span ${m.rotation?1:MODULES[m.id].size}`;n.style.gridRow=`${Math.floor(m.slot/columns)+1} / span ${m.rotation?MODULES[m.id].size:1}`;n.style.setProperty('--module-color',MODULES[m.id].color);
      n.innerHTML=`<span class="module-art"></span><small>Lv.${m.level}</small>`;n.setAttribute('aria-label',MODULES[m.id].name);icon(n.firstChild,MODULES[m.id].icon);board.append(n);
    }
    const cards=root.querySelector('.module-cards');cards.innerHTML='';
    for(const [id,meta] of Object.entries(MODULES)){
      const m=installedModule(state,id),n=document.createElement('button');n.type='button';n.className=`module-card${selected===id?' inspected':''}${!available(id)?' unavailable':''}`;n.dataset.id=id;n.dataset.focus=`card-${id}`;n.style.setProperty('--module-color',meta.color);
      n.innerHTML=`<span class="module-footprint" aria-hidden="true">${'<i></i>'.repeat(meta.size)}</span>${m?'<span class="module-installed">✓</span>':''}<span class="module-art"></span><span class="module-card-name">${meta.name}</span><span class="module-card-price">${m?`Lv.${m.level}`:`◆ ${meta.cost}`}</span>`;
      n.setAttribute('aria-label',`${meta.name}，${meta.size} 格，${m?'已安装':`${meta.cost} 金币`}`);icon(n.querySelector('.module-art'),meta.icon);cards.append(n);
    }
    if(selected){const meta=MODULES[selected],m=installedModule(state,selected);
      info.innerHTML=`<div class="module-selected-title"><strong>${meta.name}${m?.specialization ? ` · ${SPECIALIZATIONS[m.specialization].name}` : ""}</strong><details><summary aria-label="模块说明">ⓘ</summary><p>${meta.description}${m?.specialization ? `<br><b>${SPECIALIZATIONS[m.specialization].name}</b>：${SPECIALIZATIONS[m.specialization].description}` : meta.weapon ? "<br>击败精英后可获得武器专精，本局每件限选一个方向。" : ""}${selected === "shield" ? "<br>邻接重炮：格挡充能；邻接环刃：格挡后扩张。" : selected === "hangar" || selected === "pulse" ? "<br>机库与轻炮相邻：半电以下主动回航，轻炮加速 6 秒。" : ""}</p></details></div><div class="module-actions">${m?btn('移动','move',locked())+btn(m.level>=3?'已满级':`强化 ◆${moduleUpgradeCost(m)}`,'upgrade',locked()||m.level>=3||state.coins<moduleUpgradeCost(m))+btn(`拆卸 +${Math.floor(m.invested*.8)}`,'remove',locked()):btn(`安装 ◆${meta.cost}`,'install',!available(selected))}</div>`;
    }else info.innerHTML='<div class="module-selected-title"><strong>选择模块</strong></div><div class="module-actions"></div>';
    if(coreStatus){const core=root.querySelector('.module-core-upgrades');core.innerHTML='';for(const [key,title] of [['damage','伤害'],['rate','射速'],['ascend','升阶']]){const status=coreStatus(key);core.insertAdjacentHTML('beforeend',btn(`${title} · ${status.maxed?'满级':status.unlocked?`◆${status.cost}`:'未解锁'}`,`core-${key}`,!status.unlocked||state.coins<status.cost))}}
    info.insertAdjacentHTML('beforeend','<div class="module-live-status"></div>');
    updateLive();updateTools();paint();if(focus)root.querySelector(`[data-focus="${focus}"]`)?.focus({preventScroll:true});
  }
  update();return {update,handleKey,cancel,destroy:()=>{controller.abort();ghost.remove();delete state.moduleSelection;delete state.modulePreview}};
}
