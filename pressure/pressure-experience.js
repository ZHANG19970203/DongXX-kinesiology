/* Original guided inquiry. Its feedback checks source evidence, never clinical skill. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),P=window.DXXPressure;
 if(!P||!$('missionPanel'))return;
 const names={toe:'向趾端移动',heel:'向跟端移动',unknown:'暂不能判断',equal:'变化不明显'};
 let scene=null,stage=null,stageFailed=false;
 document.querySelector('.mission-heading').append($('missionStart'));
 if(!$('sensorHint')){const hint=document.createElement('small');hint.id='sensorHint';hint.textContent='在场景里点选，或展开二维读数选点';$('selectedSensor').parentElement.append(hint);}
 const fresh=()=>({step:0,startedAt:null,prediction:'',evidence:{},peaks:{},attempts:[],events:[],saved:false,persisted:false});
 let task=fresh();
 const fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:d}):'—';
 const log=(type,detail={})=>task.events.push({type,at:new Date().toISOString(),...detail});
 function feedback(text){$('missionFeedback').textContent=text;}
 function emitTask(){window.dispatchEvent(new CustomEvent('dxx:pressure-task',{detail:{step:task.step,evidenceCount:Object.keys(task.evidence).length,peakCount:Object.keys(task.peaks).length,completed:task.saved}}));}
 function render(){
  const titles=['一个最高值，能代表整只脚吗？','先预测 · 用分布提出想法','找证据 · 亲手核对两帧','作解释 · 把单点与整体联系起来','本次探究已完成'];
  const prompts=[
   '有人看到最高测点的读数降低，就认为整只鞋垫的读数都降低了。你担任运动观察员，用两帧记录检验这个说法，解释高值区域与压力中心怎样变化。',
   '观察左足第25与50帧的柱形分布。先不看COP：你预计加权中心向哪里移动？预测允许修改，不计能力分数。',
   '分别查看左足第25与50帧：点选每帧最高的柱，再标记为证据。两帧保持相同色标和筛选条件。',
   '现在把最高单点、32点总和和COP放在一起看。解释为什么单点降低，整体加权中心仍能向趾端移动。',
   task.persisted?'预测、点选过程和两帧原值已保存到本机。你可以继续自由观察，或导出报告交给教师。':'探究已完成；记录仅暂存在当前页。请立即导出，避免刷新或关闭后丢失。'
  ];
  $('missionPanel').dataset.step=String(task.step);document.body.dataset.missionStep=String(task.step);
  $('missionTitle').textContent=titles[task.step];$('missionPrompt').textContent=prompts[task.step];
  $('missionStep').textContent=task.step===0?'任务简报':task.step===4?'完成':String(task.step)+' / 3';
  $('missionStatus').textContent=task.step===0?'预计用时 3—5 分钟':task.step===1?'预测尚待证据检验':task.step===2?'已标记 '+Object.keys(task.evidence).length+'/2 帧 · 已找到 '+Object.keys(task.peaks).length+'/2 最高测点':task.step===3?'依据证据完成解释':task.persisted?'已保存到本机':'仅暂存，请立即导出';
  $('missionStart').hidden=task.step!==0;$('missionStart').disabled=!scene;
  $('missionNext').hidden=task.step===0;$('missionNext').disabled=task.step===4;
  $('missionNext').textContent=task.step===1?'记录预测，进入找证据':task.step===2?'揭示比较，进入解释':task.step===3?'完成探究并保存':task.persisted?'已完成并保存':'已完成，请导出';
  $('markEvidence').disabled=task.step!==2;
  $('prediction').disabled=task.step!==1;$('sensorAnswer').disabled=task.step!==3;
  $('missionObservation').disabled=task.step!==3;$('missionExplanation').disabled=task.step!==3;
  document.querySelectorAll('[data-mission-phase]').forEach(el=>{el.hidden=Number(el.dataset.missionPhase)!==task.step;});
  document.querySelectorAll('.mission-route [data-mission-step]').forEach(el=>{const s=Number(el.dataset.missionStep);el.classList.toggle('is-active',s===Math.min(3,task.step));el.classList.toggle('is-complete',s<task.step);el.setAttribute('aria-current',s===Math.min(3,task.step)?'step':'false');});
  if($('missionNotes'))$('missionNotes').open=task.step>=3;
  const list=$('evidenceList');list.replaceChildren();
  for(const index of [25,50]){
   const row=document.createElement('div');row.className='evidence-item';
   const button=document.createElement('button');button.type='button';button.textContent='查看帧 '+index;button.disabled=!scene;
   button.addEventListener('click',()=>{if(scene.side!=='L')P.setSide('L');P.seek(index);});
   const text=document.createElement('span'),e=task.evidence[index],peak=task.peaks[index];
   text.textContent=(e?'已标记 · 总和 '+fmt(e.sum):'待标记证据')+(peak?' · 最高点 #'+peak.channel+' 已核对':' · 最高点待查');
   row.append(button,text);list.append(row);
  }
  emitTask();
 }
 function start(){
  if(!scene){feedback('数据正在载入，请稍候。');return;}
  task=fresh();task.step=1;task.startedAt=new Date().toISOString();
  $('prediction').value='';$('sensorAnswer').value='';$('missionObservation').value='';$('missionExplanation').value='';
  P.setSide('L');P.resetThreshold();P.seek(25);P.revealCop(false);log('started',{caseId:P.source()?.caseId,side:'L',referenceFrames:[25,50]});
  feedback('先转动实验台、比较两帧。COP暂时隐藏，提交预测后再揭示。');render();
 }
 function reset(){task=fresh();P.revealCop(true);feedback('已回到任务简报；已经保存的学习记录保留。');render();}
 function mark(){
  if(task.step!==2||!scene)return;
  if(scene.side!=='L'||![25,50].includes(scene.frame.index)){feedback('本次任务请标记左足第25与50帧。其他时刻可在自由观察记录中保存。');return;}
  const snapshot=P.snapshot();
  if(!snapshot.validCop){feedback('这一帧没有通过当前筛选，不能作为COP位置证据。请调整筛选或恢复默认，再标记。');return;}
  task.evidence[snapshot.frameIndex]={...snapshot,markedAt:new Date().toISOString()};P.pin(snapshot.frameIndex===25?'A':'B',snapshot.frameIndex);
  log('evidence_marked',{side:snapshot.side,frameIndex:snapshot.frameIndex,threshold:snapshot.threshold});
  feedback('已保留帧 '+snapshot.frameIndex+' 的32点原值、总和和COP。'+(task.peaks[snapshot.frameIndex]?'此帧最高点也已核对。':'再点选实验台上本帧最高的测点。'));
  render();
 }
 function inspect(detail){
  if(!scene)return;
  $('selectedSensor').textContent='测点 #'+detail.channel;$('selectedSensorValue').textContent=fmt(detail.value);
  const max=Math.max(...scene.frame.values),isPeak=detail.value===max;
  if($('sensorHint'))$('sensorHint').textContent='原坐标 ('+fmt(detail.point.x)+', '+fmt(detail.point.y)+') · '+(isPeak?'✓ 本帧最高读数':'还不是最高点，继续比较');
  if(task.step!==2)return;
  const attempt={at:new Date().toISOString(),side:detail.side,frameIndex:detail.frameIndex,channel:detail.channel,value:detail.value,isFrameMaximum:isPeak};task.attempts.push(attempt);
  if(detail.side!=='L'||![25,50].includes(detail.frameIndex)){feedback('已查看这个测点；本次任务需要左足第25与50帧的证据。');return;}
  if(isPeak){task.peaks[detail.frameIndex]={...attempt,point:detail.point};log('maximum_inspected',attempt);feedback('找到了：帧 '+detail.frameIndex+' 的最高测点是 #'+detail.channel+'，原值 '+fmt(detail.value)+'。再看COP是否与这个测点重合，并标记此帧。');render();}
  else feedback('测点 #'+detail.channel+' 的原值为 '+fmt(detail.value)+'。它不是本帧最高值，换个角度继续比较，或展开二维数值核对。');
 }
 function next(){
  if(task.step===1){
   const value=$('prediction').value;if(!Object.hasOwn(names,value)){feedback('请先选一个预测。暂不能判断也可以，接下来用证据检验。');$('prediction').focus();return;}
   task.prediction=value;log('prediction_submitted',{value});task.step=2;$('showLabels').checked=true;P.revealCop(true);P.seek(25);feedback('已记录预测，不先判对错。请找出两帧最高测点，并分别标记证据。');render();return;
  }
  if(task.step===2){
   if([25,50].some(i=>!task.evidence[i]||!task.peaks[i])){feedback('还需要两帧的证据和最高测点。点击“查看帧25/50”，分别找出最高柱并标记；二维读数表也能选中测点。');return;}
   if(task.evidence[25].threshold!==task.evidence[50].threshold){feedback('两帧的筛选阈值不同。请在同一阈值下重新标记两帧，便于解释比较条件。');return;}
   task.step=3;P.seek(50);P.pin('A',25);P.pin('B',50);
   const a=task.evidence[25],b=task.evidence[50];
   feedback('最高单点 '+fmt(task.peaks[25].value)+' → '+fmt(task.peaks[50].value)+'；32点总和 '+fmt(a.sum)+' → '+fmt(b.sum)+'；COP的y '+fmt(a.sourceCop[1])+' → '+fmt(b.sourceCop[1])+'（y减小指向趾端）。请解释这些变化为何可以同时发生。');render();return;
  }
  if(task.step!==3||task.saved)return;
  if($('sensorAnswer').value!=='weighted'){feedback('最高点只反映一个位置；COP还受到其余31个通道和各自位置影响。请重新选择解释原理。');$('sensorAnswer').focus();return;}
  const observation=$('missionObservation').value.trim(),explanation=$('missionExplanation').value.trim();
  if(!observation||!explanation){feedback('请分别写下一条观察和一条解释。这里只检查是否填写，文字质量与科学性由教师审阅。');(!observation?$('missionObservation'):$('missionExplanation')).focus();return;}
  const a=task.evidence[25],b=task.evidence[50],dy=b.sourceCop[1]-a.sourceCop[1],actual=dy<0?'toe':dy>0?'heel':'equal';
  const experience={schemaVersion:'dxx-pressure-inquiry-v1',mission:'single-sensor-and-whole-distribution',startedAt:task.startedAt,completedAt:new Date().toISOString(),sourceCase:P.source()?.caseId,prediction:{initial:task.prediction,referenceDirection:actual,supportedByEvidence:task.prediction==='unknown'?null:task.prediction===actual,notASkillGrade:true},evidence:[a,b],peaksInspected:[task.peaks[25],task.peaks[50]],selectionAttempts:task.attempts,events:task.events,conclusion:{conceptAnswer:'weighted',conceptCorrect:true,deltaSourceCop:b.sourceCop.map((v,i)=>v-a.sourceCop[i]),channelSumChange:b.sum-a.sum,maximumChannelChange:task.peaks[50].value-task.peaks[25].value,openExplanationAutoGraded:false},completionCriteria:{twoSourceFrames:true,maximumInBothFramesInspected:true,sameThreshold:true,conceptChoiceCorrect:true,observationAndExplanationPresent:true},scope:'Teaching evidence and concept checks, not contact-event labels or clinical performance.'};
  P.setSide('L');P.setThreshold(a.threshold);P.seek(50);P.pin('A',25);P.pin('B',50);
  const result=P.save({observation,explanation,experience});task.saved=true;task.persisted=result.persisted;task.step=4;
  $('observation').value=observation;$('explanation').value=explanation;
  feedback((task.prediction==='unknown'?'你用证据形成了判断。':task.prediction===actual?'数据支持你最初的预测。':'证据与最初预测不同；根据证据修正解释，就是本次学习的一部分。')+(result.persisted?' 已保存完整探究过程，可导出报告。':' 记录暂留本页；请立即导出报告，避免刷新后丢失。')+' 开放解释没有自动评分。');render();
 }
 function sync(detail){
  if(!detail)return;scene=detail;
  if(!stage&&!stageFailed&&window.PressureStage){
   try{stage=new PressureStage($('stageCanvas'),{onSelect:index=>P.selectSensor(index),onError:message=>{$('stageStatus').textContent=message;}});if(!stage.ready)throw Error('当前浏览器没有启用可用的三维显示。');$('stageStatus').textContent='拖动旋转 · 滚轮缩放 · 点击测点查看原值';}
   catch(error){stageFailed=true;$('stageStatus').textContent='三维场景未能启动，可用下方二维核对和可点击数值表完成同一任务。'+error.message;}
  }
  if(stage)try{stage.update(detail);}catch(error){$('stageStatus').textContent='场景暂未更新：'+error.message;}
  if(detail.selected>=0){$('selectedSensor').textContent='测点 #'+detail.selected;$('selectedSensorValue').textContent=fmt(detail.frame.values[detail.selected]);if($('sensorHint')){const point=detail.points[detail.selected],isPeak=detail.frame.values[detail.selected]===Math.max(...detail.frame.values);$('sensorHint').textContent='原坐标 ('+fmt(point.x)+', '+fmt(point.y)+') · '+(isPeak?'✓ 本帧最高读数':'可继续比较其他测点');}}
  else{$('selectedSensor').textContent='点击任意测点';$('selectedSensorValue').textContent='—';if($('sensorHint'))$('sensorHint').textContent='在场景里点选，或展开二维读数选点';}
  if($('stageFrame'))$('stageFrame').textContent='帧 '+detail.frame.index+' / 248';
  if($('stageSide'))$('stageSide').textContent=detail.side==='L'?'左足':'右足';
  if($('peakReadout'))$('peakReadout').textContent=fmt(Math.max(...detail.frame.values));
  $('missionStart').disabled=false;
  document.querySelectorAll('#evidenceList button').forEach(button=>button.disabled=false);
 }
 $('missionStart').addEventListener('click',start);$('missionReset').addEventListener('click',reset);$('missionNext').addEventListener('click',next);$('markEvidence').addEventListener('click',mark);
 document.querySelectorAll('[data-jump-frame]').forEach(button=>button.addEventListener('click',()=>{if(!scene)return;if(scene.side!=='L')P.setSide('L');P.seek(Number(button.dataset.jumpFrame));}));
 document.querySelectorAll('[data-stage-view]').forEach(button=>button.addEventListener('click',()=>{stage?.setView(button.dataset.stageView);document.querySelectorAll('[data-stage-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
 $('stageReset').addEventListener('click',()=>stage?.reset());
 $('stageFullscreen').addEventListener('click',async()=>{const viewport=$('stageViewport');try{if(document.fullscreenElement)await document.exitFullscreen();else if(viewport.requestFullscreen)await viewport.requestFullscreen();else throw Error('fullscreen unavailable');}catch{viewport.classList.toggle('focus-mode');$('stageStatus').textContent=viewport.classList.contains('focus-mode')?'已进入专注布局；按Esc或再次点击全屏退出。':'已返回课程布局。';}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')$('stageViewport').classList.remove('focus-mode');});
 document.addEventListener('fullscreenchange',()=>{$('stageFullscreen').textContent=document.fullscreenElement?'退出全屏':'沉浸全屏';});
 window.addEventListener('dxx:pressure-frame',event=>sync(event.detail));window.addEventListener('dxx:pressure-sensor',event=>inspect(event.detail));
 render();sync(P.scene());
})();
