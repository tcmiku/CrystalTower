import { FORT_TYPES, buildForts, fortAt, fortAction, fortLimits, fortPlacement, fortPlanning, snapFort, wallLine } from './fortifications.js';

export function createFortUi(getState,canvas,toWorld,notify,canOpen) {
  const launch=document.createElement('button');launch.type='button';launch.className='fort-launch';launch.textContent='修筑防线  B';
  document.querySelector('.assault-panel').append(launch);
  const root=document.createElement('section');root.className='fort-panel';root.hidden=true;root.setAttribute('aria-label','修筑防线');
  root.innerHTML=`<header><div><b>修筑防线</b><span data-status></span></div><button type="button" data-action="close" aria-label="关闭建造">完成 / B</button></header>
    <p class="fort-capacity"></p><div class="fort-tools"><button type="button" data-tool="wall">围墙 <small>15 金币</small></button><button type="button" data-tool="gun">机枪 <small>100 金币</small></button><button type="button" data-tool="select">选择工事</button></div>
    <p class="fort-help">拖动拉墙，点击放炮塔；确认后建造。触屏点墙起点，再点终点。</p>
    <p class="fort-selection"></p><div class="fort-actions"><button type="button" data-action="repair">维修</button><button type="button" data-action="upgrade">升级</button><button type="button" data-action="priority">目标</button><button type="button" data-action="move">移动</button><button type="button" data-action="rebuild">重建</button><button type="button" data-action="remove">拆除</button></div>
    <footer><span class="fort-result" role="status" aria-live="polite"></span><button type="button" data-action="confirm">确认建造</button><button type="button" data-action="cancel">取消预览</button><button type="button" data-action="rebuild-all">重建全部</button></footer>`;
  document.body.append(root);
  let owner=null,pausedByUs=false,dragStart=null,touchStart=null;
  const ui=()=>getState().fortUi;
  const say=result=>{root.querySelector('.fort-result').textContent=result.reason;if(!result.ok)notify(result.reason);};
  function close(resume=true){
    if(owner){owner.fortUi=null;if(pausedByUs&&resume)owner.paused=false;}
    owner=null;pausedByUs=false;dragStart=touchStart=null;root.hidden=true;document.body.classList.remove('fort-building');canvas.classList.remove('fort-cursor');
  }
  function toggle(){
    if(owner){close();return;}
    const s=getState();if(!s.fortifications||s.over||!canOpen())return;
    owner=s;pausedByUs=fortPlanning(s)&&!s.paused;if(pausedByUs)s.paused=true;
    s.fortUi={tool:'wall',points:[],selected:null,moveId:null};root.hidden=false;
    document.body.classList.add('fort-building');canvas.classList.add('fort-cursor');
    say({ok:true,reason:s.fortifications.credit?`本局工程额度 ${s.fortifications.credit} · 仅用于新建`:'选择工事，预览后确认'});update(s);
  }
  launch.addEventListener('click',toggle);
  document.addEventListener('click',e=>{
    if(owner&&!root.contains(e.target)&&!launch.contains(e.target)&&e.target!==canvas&&e.target.closest('button'))close();
  },true);
  root.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||!ui())return;const s=getState(),u=ui(),action=button.dataset.action;
    if(button.dataset.tool){u.tool=button.dataset.tool;u.points=[];u.moveId=null;u.selected=null;dragStart=touchStart=null;}
    else if(action==='close'){close();return;}
    else if(action==='cancel'){u.points=[];u.moveId=null;dragStart=touchStart=null;}
    else if(action==='confirm'){
      const result=u.moveId?fortAction(s,u.moveId,'move',u.points[0]):buildForts(s,u.tool,u.points);say(result);
      if(result.ok){u.points=[];u.moveId=null;dragStart=touchStart=null;}
    }else if(action==='rebuild-all'){
      const ruins=s.fortifications.items.filter(b=>b.hp<=0),cost=ruins.reduce((v,b)=>v+b.invested,0);
      if(s.coins<cost)say({ok:false,reason:`重建全部需要 ${cost} 金币`});
      else {let count=0;for(const b of ruins)if(fortAction(s,b.id,'rebuild').ok)count++;say({ok:true,reason:`已重建 ${count} 处，受占用的位置保留废墟`});}
    }else if(action==='move'){u.moveId=u.selected;u.points=[];say({ok:true,reason:'点击新位置，预览后确认移动'});}
    else say(fortAction(s,u.selected,action));
    update(s);
  });
  function down(e){
    if(!ui())return false;e.preventDefault();if(e.button===2){ui().points=[];touchStart=null;return true;}if(e.button!==0)return true;
    const s=getState(),u=ui(),p=toWorld(e),b=fortAt(s,p);
    if(u.moveId){u.points=[snapFort(p)];return true;}
    if(b){u.selected=b.id;u.points=[];touchStart=null;update(s);return true;}
    u.selected=null;if(u.tool==='select')return true;
    if(u.tool==='gun'){u.points=[snapFort(p)];update(s);return true;}
    if(e.pointerType==='touch'){
      if(touchStart){u.points=wallLine(touchStart,p);touchStart=null;}else{touchStart=p;u.points=[snapFort(p)];}
    }else{dragStart=p;u.points=[snapFort(p)];canvas.setPointerCapture(e.pointerId);}
    update(s);return true;
  }
  function move(e){if(!ui())return false;if(dragStart)ui().points=wallLine(dragStart,toWorld(e));update(getState());return true;}
  function up(e){if(!ui())return;dragStart=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);update(getState());}
  canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',()=>{dragStart=touchStart=null;if(ui())ui().points=[];});
  function update(s){
    launch.hidden=!s.fortifications||s.over;
    launch.textContent=s.fortifications?.credit?`修筑防线 B · 工程额度 ${s.fortifications.credit}`:'修筑防线 B';
    if(owner&&(owner!==s||s.over||!canOpen())){close(false);return;}
    const u=ui();if(!u)return;
    const f=s.fortifications,limits=fortLimits(s),items=f.items.filter(b=>b.hp>0),b=f.items.find(b=>b.id===u.selected);
    root.querySelector('[data-status]').textContent=s.paused?'规划暂停':'战时施工';
    root.querySelector('.fort-capacity').textContent=`控制区 ${limits.radius} · 围墙 ${items.filter(b=>b.type==='wall').length}/${limits.wall} · 机枪 ${items.filter(b=>b.type==='gun').length}/${limits.gun} · 金币 ${Math.floor(s.coins)}${f.credit?` · 工程额度 ${f.credit}`:''}`;
    for(const button of root.querySelectorAll('[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===u.tool));
    root.querySelector('.fort-actions').hidden=!b;
    root.querySelector('.fort-selection').textContent=b?`${FORT_TYPES[b.type].name} ${['I','II','III'][b.level-1]} · 耐久 ${Math.ceil(b.hp)}/${b.maxHp}${b.construction>0?` · 施工 ${b.construction.toFixed(1)}s`:''}${b.type==='gun'?` · 优先${({near:'最近',fast:'疾行',ranged:'远程'})[b.priority]}`:''}`:'围墙挡怪与普通弹；机枪射程 190，对重装伤害降低。';
    for(const button of root.querySelectorAll('.fort-actions button')){
      const a=button.dataset.action;button.disabled=!b||(a==='upgrade'&&(!fortPlanning(s)||b.level>=3||b.hp<=0))||(a==='move'&&(!fortPlanning(s)||b.hp<=0))||(a==='priority'&&b.type!=='gun')||(a==='rebuild'&&b.hp>0)||(a==='repair'&&(b.hp<=0||b.hp>=b.maxHp||b.construction>0));
      if(b&&a==='repair')button.textContent=b.repairing?'停止维修':`维修 ≤${Math.ceil((b.maxHp-b.hp)*b.invested*.6/b.maxHp)}`;
      if(b&&a==='upgrade')button.textContent=b.level<3?`升级 ${Math.round(FORT_TYPES[b.type].cost*1.5**b.level)}`:'已满级';
      if(b&&a==='rebuild')button.textContent=`重建 ${b.invested}`;
      if(b&&a==='remove')button.textContent=b.fresh&&b.hp===b.maxHp&&fortPlanning(s)?'撤销新建':`拆除 +${Math.floor(b.paid*.6*Math.max(0,b.hp/b.maxHp))}`;
    }
    const placement=u.points.length?fortPlacement(s,u.moveId?b?.type:u.tool,u.points,{ignoreId:u.moveId}):null;
    u.valid=Boolean(placement&&(placement.ok||u.moveId&&placement.points));
    const confirm=root.querySelector('[data-action="confirm"]');confirm.hidden=!u.points.length;confirm.disabled=!u.valid;
    confirm.textContent=u.moveId?'确认移动':`建造 ${u.points.length} 处 · ${placement?.cost??0} 金币${placement?.credit?`（额度抵 ${placement.credit}）`:''}`;
    root.querySelector('[data-action="cancel"]').hidden=!u.points.length&&!u.moveId;
    const ruins=f.items.filter(b=>b.hp<=0),rebuild=root.querySelector('[data-action="rebuild-all"]');rebuild.hidden=!ruins.length;rebuild.textContent=`重建全部 ${ruins.reduce((v,b)=>v+b.invested,0)}`;
    if(placement&&!u.valid)root.querySelector('.fort-result').textContent=placement.reason;
    else if(u.points.length)root.querySelector('.fort-result').textContent=touchStart?'再次点击终点，或直接确认这一段':u.moveId?'移动保留耐久':'位置有效 · 确认后扣费';
  }
  return {toggle,close,update,down,move,get active(){return Boolean(owner);}};
}
