import { MUSCLE_ITEMS } from './case-muscle-v14.js';

// Contextual instructions point to genuine controls; they never answer a task.
export function createLessonCoach(ctx){
 const {$,getCurrent,stepBook,record}=ctx;
 let destination=null,activation=null,lastSignature='';
 const box=$('coach'),text=$('coachText'),button=$('coachAction');
 $('prepPause').addEventListener('click',()=>{$('pause').click();update();});
 function visible(el){return !!el&&!el.hidden&&!!el.getClientRects().length;}
 function locate(selector){
  let target=document.querySelector(selector);if(!target)return;
  if(target.closest('#taskDock')&&document.body.dataset.dockCollapsed==='true')$('dockToggle').click();
  document.querySelectorAll('.coach-focus').forEach(el=>el.classList.remove('coach-focus'));
  target.scrollIntoView({block:'nearest',behavior:'smooth'});target.focus?.();target.classList.add('coach-focus');
  setTimeout(()=>target.classList.remove('coach-focus'),3500);
 }
 button.addEventListener('click',()=>{
  if(activation)activation();else if(destination)locate(destination);
  record('clinic3d_coach_used',{nodeId:getCurrent().node?.id||'arrival',target:destination});
 });
 $('coachToggle').addEventListener('click',()=>{
  const closed=box.dataset.collapsed!=='true';box.dataset.collapsed=String(closed);
  $('coachToggle').setAttribute('aria-expanded',String(!closed));$('coachToggle').textContent=closed?'展开':'收起';
 });
 function update(){
  const {node,phase,pressureMode}=getCurrent(),removal=ctx.getRemovalState?.();
  $('prepPause').hidden=!removal?.active;$('prepPause').textContent=ctx.state.paused?'继续动作':'暂停动作';
  let message='',label='定位操作',selector=null,action=null;
  if(removal?.active){message='她正在坐稳脱鞋袜。等双脚准备好，再开始检查。';label='观看准备动作';action=()=>ctx.focusPreparation?.();}
  else if(document.body.dataset.dialoguePending==='true'){
   message='双方正在自动交流。听完后，动小助会指向本步操作。';label='暂停交流';selector='#pause';action=()=>$('pause').click();
  }else if(!node&&visible($('next'))){message='她已准备好入座。点“进入问诊”，开始了解困扰。';label='进入问诊';selector='#next';action=()=>$('next').click();}
  else if(!node){message='你好，我是动小助。点“接待患者”开始；查看器材后，可切回接诊。';label='接待患者';selector='#begin';action=()=>$('begin').click();}
  else if(visible($('next'))&&!$('next').disabled){const handoff=$('filmHandoff');message=node.terminal?'接诊已结束。保存本轮记录，再做复盘。':visible(handoff)?handoff.textContent+'。点左侧“继续”衔接这一步。':'这一步已准备好，点“继续”进入下一环节。';label=node.terminal?'保存学习':'继续接诊';selector='#next';action=()=>$('next').click();}
  else if(['archIndex','staticCOP'].includes(node.task?.type)){
   const done=stepBook.get(node.task.type==='archIndex'?'arch_index_checked':'static_cop_checked');
   message=done?'计算已核对。点右边“完成记录，继续”，保存后自动衔接。':node.task.type==='archIndex'?'中足面积除以总面积，在右边输入结果并核对。':'先比较两组同条件轨迹，再用对照路径除以30秒，输入平均速度。';selector=done?'#options button':'#soapNumericAnswer';
  }
  else if(node.task?.type==='goniometer'){
   if(node.task.stage==='tool'){message='在右边选择量角教具；想看运动方向，可先打开踝足运动窗。';selector='#options button';}
   else{const todo=['axis','fixed','moving'].find(k=>!stepBook.has(k));const names={axis:'轴心·外踝',fixed:'固定臂·小腿参考线',moving:'移动臂·足外侧参考线'};
    if(todo){message=`先核对“${names[todo]}”。每核对一处，点对应按钮；共三处。`;selector=`[data-landmark="${todo}"]`;}
    else{message='三处已核对。右边面板下方选择你的判断，就能继续。';selector='#options button';}
   }
  }else if(node.task?.type==='muscle'){
   const item=MUSCLE_ITEMS.find(value=>!stepBook.get('muscle_'+value.id));
   message=item?`在右边为“${item.label}”选择主要肌群；可打开解剖窗对照。`:'四种动作已匹配。到右边面板下方选择你的判断，再继续。';
   selector=item?`select[data-muscle="${item.id}"]`:'#options button';
  }else if(node.task?.type==='arch'){
   const mode=['seated','standing'].find(value=>!stepBook.get('arch_'+value));
   message=mode?`切到“${mode==='seated'?'坐位 · 非负重':'站立 · 负重'}”，比较同一病例的内侧足弓。`:'两种条件已看过。选择外观变化能说明什么，再继续。';
   selector=mode?`[data-arch-mode="${mode}"]`:'#options button';
  }else if(node.task?.type==='gait'){
   const done=(node.task.events||[]).filter(e=>stepBook.has(e.id)&&ctx.eventMatches(stepBook.get(e.id),e.targetPhase,e.tolerance));
   if(done.length===2){message='两个事件已记录。点右边下方“标记完成”，进入步态解释。';selector='#options button';}
   else if(!stepBook.has('initial_contact')){message='点“播放采集”看右足。接地时暂停，再点“标记右足初始接触”。可拖动回看。';selector='#taskPlay';}
   else if(!stepBook.has('toe_off')){message='继续看右足完全离地的时刻，暂停后点“标记右足离地”。';selector='button[data-event="toe_off"]';}
   else{message='有个标记还没对上动作。拖动时间轴，回看接地或离地前后，再修改标记。';selector='#taskPhase';}
  }else if(node.task?.type==='pressure'){
   if(node.task.stage==='conditions'){
    message=stepBook.has('mode')?'已切换图形。核对任务和图形类型，再点右边下方的判断。':'先看“静态站立”；再切换“行走瞬时”或“最大压力复合图”，留意三者含义不同。';selector=stepBook.has('mode')?'#options button':'[data-mode="dynamic"]';
   }else if(!stepBook.has('region')){message='先在右边选足跟、中足或前足。然后播放行走，看这个区域何时承重。';selector='[data-region="中足"]';}
   else if(Number(stepBook.get('dynamicMax')||0)-Number(stepBook.get('dynamicMin')||0)>=.15){message='已有一段动态观察。点右边下方的判断，继续解释足底负荷。';selector='#options button';}
   else if(pressureMode!=='dynamic'){message='现在切到“行走瞬时”，才能观察踩板时的压力和COP变化。';selector='[data-mode="dynamic"]';}
   else if(Number(stepBook.get('dynamicMax')||0)-Number(stepBook.get('dynamicMin')||0)<.15){message='点“播放采集”，让患者走过压力板。也可以拖动，比较不同时刻。';selector='#taskPlay';}
   else{message='已有一段动态观察。点右边下方的判断，继续解释足底负荷。';selector='#options button';}
  }else if(node.task?.type==='balance'){
   const list=node.task.checklist||[],i=list.findIndex((_,n)=>!stepBook.get('check'+n));
   message=i>=0?`先确认“${list[i]}”，再勾选；安全条件齐备后选择下一步。`:'条件已核对。与患者商量下一步；她可以选择不做。';selector=i>=0?`#taskSurface input[data-condition="${i}"]`:'#options button';
  }else if(node.options?.length){message=node.task&&!['history','evidence'].includes(node.task.type)?'在右边面板下方选择判断，随后自动衔接。':'从左边选择你的回应，随后自动衔接。';selector='#options button';}
  else{message='回到左侧，查看当前说明或接诊记录。';selector='#conversation';}
  const signature=message+'|'+label+'|'+selector;
  if(signature!==lastSignature){text.textContent=message;button.textContent=label;lastSignature=signature;}
  destination=selector;activation=action;button.disabled=!selector&&!action;
  $('coachStage').textContent=removal?.active?'赤足准备':({goniometer:'第2步 · 活动度',trial:'第2步 · 试次条件',muscle:'第3步 · 动作与肌群',arch:'第4步 · 静态足弓',gait:'第5步 · 步态采集',pressure:'第6步 · 足压观察',balance:'第7步 · 平衡准备',plan:'第8步 · 综合判断'})[node?.task?.type]||'下一步怎么做';
  box.hidden=false;
 }
 return {update,locate};
}
