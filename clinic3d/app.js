import {reactionFor,repairLabel,REPAIR_ACK} from './communication-v26.js';
import {installImmersion} from './immersion-v23.js';
import {installLearningBubbles} from './learning-bubbles-v25.js';
import {createUsageTracker} from '../assets/usage-v23.js';
import { SOAP_STAGES } from './soap-route-v20.js';
import { createDialogueAudio } from './dialogue-audio.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createClinicRoom } from './scene-room.js';
import { createActors } from './actors.js';
import { sampleStanding, sampleWalking, renderPressureDiagram } from './pressure-engine.js';
import { createPressureStage } from './pressure-stage.js';
import { createLearningUI } from './learning-ui.js';
import { createDialoguePlayer } from './dialogue-player.js';
import { createFilmSequence } from './film-sequence.js';
import { createLearningHub } from '../learning/learning-hub.js';
import { MUSCLE_ITEMS } from './case-muscle-v14.js';
import { migrateProgress } from './progress-migration.js';
import { GAIT_CASE, sampleGait, isGaitEventMatch } from './gait-lesson.js';
import { CASE_DATA, FLOW, START_NODE, TEACHER_LIMITATIONS, EVIDENCE_CATALOG } from './case-flow.js';

const $=id=>document.getElementById(id), profile=window.DXXHub?.profile?.()||null;
const uid=()=>crypto.randomUUID(), now=()=>new Date().toISOString();
const personKey=profile?profile.teacher+'|'+profile.studentId:'guest';
const roundParam=new URLSearchParams(location.search).get('round');
const navigationRound=roundParam&&/^[A-Za-z0-9-]{8,80}$/.test(roundParam)?roundParam:null;
const STORE='dxx_clinic3d_v21_'+personKey+(navigationRound?'_round_'+navigationRound:'');
const chapters=CASE_DATA.acts.map(a=>[a.id,a.title]);
const NAVIGATION_STAGES=SOAP_STAGES;
const reviewParam=new URLSearchParams(location.search).get('review');
const REVIEW_NODE=['muscle_match','arch_compare'].includes(reviewParam)?reviewParam:null;
const flow=Array.isArray(FLOW)?Object.fromEntries(FLOW.map(n=>[n.id,n])):FLOW;
const state={sessionId:'clinic3d.'+uid(),caseId:'cai',startedAt:now(),student:profile,node:null,history:[],evidence:[],events:[],visited:[],taskReceipts:{},records:[],exitLock:false,reflection:'',completedAt:null,view:'third',paused:false};
let renderer,scene,camera,controls,room,actors,activeNode,selectedNext,last=performance.now(),cameraMove,movement,drawerFocus,elapsed=0,talkUntil=0,taskPhase=.08,taskRunning=false,pressureMode='static',toastTimer,flushRunning=false;
let queue=[],saved=null,hasStarted=false,lastDraw=0,immersion=null,usageTracker=null,learningBubbles=null;
try{
 saved=JSON.parse(localStorage.getItem(STORE)||'null');
 if(false)for(const version of []){
  const prior=JSON.parse(localStorage.getItem('dxx_clinic3d_'+version+'_'+personKey)||'null');
  if(prior?.caseId==='cai'&&flow[prior.node]){saved=migrateProgress(prior,version,flow,now());break;}
 }
}catch{}
const stepBook=new Map(), catalog=Array.isArray(EVIDENCE_CATALOG)?Object.fromEntries(EVIDENCE_CATALOG.map(e=>[e.id,e])):EVIDENCE_CATALOG||{};
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3300);}
function record(type,payload={}){if(!hasStarted)return null;const e={id:'v14.'+uid(),sessionId:state.sessionId,type,at:now(),payload:{source:'clinic3d-v14',...payload}};state.events.push(e);queue.push(e);persist();flush();return e;}
function persist(){if(!hasStarted)return;if(activeNode?.task)state.taskState={nodeId:activeNode.id,values:Object.fromEntries(stepBook),phase:taskPhase,pressureMode};try{localStorage.setItem(STORE,JSON.stringify(state));$('saveStatus').textContent='进度已在本机保存';}catch{$('saveStatus').textContent='请及时导出学习记录';}}
async function flush(){if(flushRunning||!queue.length)return;flushRunning=true;const batch=queue.slice(0,50);let sent=false;try{const r=await fetch('/api/learning/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:{id:state.sessionId,caseId:'cai',startedAt:state.startedAt,student:profile},events:batch}),signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('offline');const receipt=await r.json();if(receipt.sessionId!==state.sessionId||receipt.accepted+receipt.duplicates!==batch.length)throw Error('receipt');queue=queue.filter(e=>!batch.includes(e));sent=true;$('saveStatus').textContent='本机保存 · 已同步课堂记录';}catch{$('saveStatus').textContent='本机保存 · 可导出记录';}finally{flushRunning=false;if(sent&&queue.length)setTimeout(flush,0);}}
function nodeEl(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;}
function button(label,action){const b=nodeEl('button','',label);b.type='button';b.addEventListener('click',action);return b;}
function showFacts(node,entries){node.replaceChildren();const dl=document.createElement('dl');for(const [term,value] of entries){dl.append(nodeEl('dt','',term),nodeEl('dd','',String(value)));}node.append(dl);}
function evidenceText(id){const x=catalog[id];return typeof x==='string'?x:x?.text||x?.label||x?.title||id;}
function addEvidence(ids=[]){for(const id of ids){if(!state.evidence.includes(id))state.evidence.push(id);} $('evidenceCount').textContent=state.evidence.length;}
function appendLine(speaker,text,kind='dialogue'){state.history.push({at:now(),speaker,text,kind,node:activeNode?.id||null});}
const dialogueAudio=createDialogueAudio({enabled:()=>$('voice').getAttribute('aria-pressed')==='true',onTalking:role=>{actors?.setTalking(role);talkUntil=role?Infinity:0;},onStatus:message=>{$('audioStatus').textContent=message;$('audioStatus').hidden=!message;}});
function speak(speaker,text){return dialogueAudio.speak(speaker,text);}

function currentAct(){let act=activeNode?.act||'act1';if(typeof act==='number')act='act'+act;return chapters.some(x=>x[0]===act)?act:'act1';}
function displayNodeText(node){
 const heard=state.filmProgress?.['01A:normal']?.completed;
 const bridge=heard?{history:'根据她刚才的描述，还需要确认什么？'}:{};
 return bridge[node.id]||node.text||'';
}
function cameras(){const a=room?.anchors||{},seat=a.patientSeat||[.8,0,-.82];const target=[seat[0],1.06,seat[2]];return{
 consult:{third:{position:activeNode?[-1.1,1.6,.7]:[-1.7,1.95,2.35],target:activeNode?[1,.95,-1.65]:[.35,.95,-1.5]},first:{position:[1.30,1.32,-2.57],target:[seat[0],1.24,seat[2]]},feet:{position:[seat[0]-.8,.5,seat[2]-.8],target:[seat[0],.18,seat[2]-.35]}},
 exam:{third:{position:[1.6,1.7,1.9],target:[-1.2,.85,-.15]},first:{position:[.10,1.42,-.1],target:[-1.3,.9,-.15]},feet:{position:[1.10,.65,.95],target:[-.78,.12,.05]}},
 wall:{third:{position:[-1.7,1.8,1.8],target:[-.35,1,-2.0]},first:{position:[-.85,1.4,-1.6],target:[-.2,1,-2.5]},feet:{position:[.5,.55,-1.8],target:[-.2,.22,-2.55]}},
 gait:{third:{position:[-1.85,1.65,2.7],target:[-.1,.85,.25]},first:{position:[2.05,1.35,1.0],target:[-.1,.85,1.0]},feet:{position:[.9,.48,.25],target:[-.1,.12,.35]}},
 pressure:{third:{position:[-1.8,1.65,2.7],target:[-.1,.8,1.1]},first:{position:[2.05,1.65,-.65],target:[-.1,.85,.60]},feet:{position:[.7,.55,1.95],target:[-.1,.1,1.1]}},
 balance:{third:{position:[-1.8,1.7,2.3],target:[-.1,.9,-.15]},first:{position:[1.1,1.5,.2],target:[-.1,1,-.2]},feet:{position:[.7,.42,.6],target:[-.1,.15,-.15]}}
};}
let visualZone='consult',pressureStage=null,removalReturn=null,lastPressurePaint=0;
function updateComposition(){if(!camera||!$('clinic'))return;const w=$('clinic').clientWidth,h=$('clinic').clientHeight;if(state.view!=='equipment'&&activeNode?.kind==='task'&&w>=651)camera.setViewOffset(w,h,0,state.view==='feet'?h*.04:0,w,h);else camera.clearViewOffset();camera.updateProjectionMatrix();}
function setView(id,immediate=false){updateComposition();const set=cameras()[visualZone]||cameras().consult,preset=id==='equipment'?(room.anchors.equipmentView||{position:[-.9,1.35,1.1],target:[1.825,1.0,2.0]}):set[id]||set.third;state.view=id;camera.fov=['gait','pressure'].includes(visualZone)&&id==='first'?54:48;document.body.dataset.inspectEquipment=String(id==='equipment');if(room.objects.pressurePrompt)room.objects.pressurePrompt.visible=id!=='equipment';if(id==='equipment'){taskRunning=false;actors?.setTalking(null);dialogueAudio.cancel();}updateComposition();document.querySelectorAll('[data-view]').forEach(b=>{const selected=b.dataset.view===id;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});controls.enabled=false;controls.enableDamping=false;controls.update();cameraMove={at:performance.now(),from:camera.position.clone(),look:controls.target.clone(),to:new THREE.Vector3(...preset.position),target:new THREE.Vector3(...preset.target),duration:immediate?0:1000};$('cameraNote').textContent=id==='equipment'?'康复器材架':id==='first'?(visualZone==='consult'?'治疗师面对患者':'治疗师观察位'):id==='feet'?'观察右足与地面的关系':'第三视角 · 可拖动观察';record('clinic3d_camera',{view:id,zone:visualZone});}
function actorPose(actor,pose,pos,yaw,immediate=false){if(!actor)return;actor.setLocomotion?.(false);if(pos)actor.setPosition(pos);if(yaw!=null)actor.face(yaw);actor.setPose(pose,immediate);}
function setVisual(node){const act=node.act||currentAct(),vm=String(node.visualMode||'').toLowerCase();let zone=act==='act2'?(vm.includes('wall')||node.task?.type==='trial'?'wall':'exam'):['act3','act4'].includes(act)?'exam':act==='act5'?'gait':act==='act6'?'pressure':act==='act7'?'balance':'consult';
 if(node.task?.type==='staticCOP'||node.id==='balance_intro')zone='pressure';
 if(zone!==visualZone){visualZone=zone;movement=null;taskRunning=false;room.setActivity?.(zone==='balance'?{zone:'balance',supportRail:true}:zone==='consult'?'reception':zone==='exam'?'static':zone);const a=room.anchors;
  if(zone==='consult'){actorPose(actors.patient,'seated',a.patientSeat,Math.PI);actorPose(actors.therapist,'seated',a.therapistSeat,0);}
  if(zone==='exam'){actorPose(actors.patient,'seated',a.examSeat||[-1.48,.15,-.1],Math.PI/2);actorPose(actors.therapist,'examine',a.examTherapist||[-.8,0,.0],-Math.PI/2);}
  if(zone==='wall'){actorPose(actors.patient,'standing',a.wallLunge||[-.25,0,-2.25],Math.PI);actorPose(actors.therapist,'standing',[-.85,0,-2.0],Math.PI/2);}
  if(zone==='gait'){actorPose(actors.patient,'standing',[-.1,0,.2],Math.PI);actorPose(actors.therapist,'standing',[.9,0,.0],-Math.PI/2);}
  if(zone==='pressure'){actorPose(actors.patient,'standing',a.pressure||[-.1,0,1.3],Math.PI);actorPose(actors.therapist,'standing',[.85,0,1.3],-Math.PI/2);}
  if(zone==='balance'){actorPose(actors.patient,'standing',a.balance||[-.1,0,-.2],0);actorPose(actors.therapist,'standing',a.therapistProtection||[.9,0,-.05],-Math.PI/2);}
  setView(state.view);
 }
 actors.setTalking(null);
 actors.therapist.setFootwear?.('shoes');actors.therapist.setDocumentation?.(['consult','balance','exam','wall'].includes(zone)?'desk':'carry');
 if(!actors.patient.getState().footwearRemoval?.active){actors.patient.setFootwear?.(state.barefootPrepared?'barefoot':'shoes');}
 if(['act2','act3','act4','act5','act6','act7'].includes(act)&&node.id!=='__preparation'&&!state.barefootPrepared&&state.evidence.includes('screening')&&state.evidence.includes('consent')&&!actors.patient.getState().footwearRemoval?.active&&(typeof filmSequence==='undefined'||!filmSequence.needsBriefing(node)))startPreparation(false);
}
function drawRail(){ $('chapterRail').replaceChildren();for(const [id,label] of chapters){const b=button(String(chapters.findIndex(x=>x[0]===id)+1),()=>{});b.append(nodeEl('span','',label));const current=id===currentAct();b.classList.toggle('active',current);b.setAttribute('aria-label',label+' · 进度指示');if(current)b.setAttribute('aria-current','step');b.disabled=true;$('chapterRail').append(b);}}
function navigationAccess(act){
 if(!NAVIGATION_STAGES.some(stage=>stage.act===act))return{ok:false,reason:'unknown_stage'};
 if(REVIEW_NODE)return{ok:false,reason:'teacher_preview'};
 if(!actors?.ready)return{ok:false,reason:'not_ready'};
 const working=hasStarted?state:(saved||state);
 if(working.exitLock)return{ok:false,reason:'safety_exit'};
 if(working.completedAt)return{ok:false,reason:'completed'};
 if(actors.patient.getState().footwearRemoval?.active)return{ok:false,reason:'preparing'};
 return{ok:true};
}
function rememberNavigationPosition(){
 if(!activeNode||!NAVIGATION_STAGES.some(stage=>stage.act===activeNode.act))return;
 state.navigationBookmarks=state.navigationBookmarks||{};
 state.navigationBookmarks[activeNode.act]={nodeId:activeNode.id,
  taskState:activeNode.task?{nodeId:activeNode.id,values:Object.fromEntries(stepBook),phase:taskPhase,pressureMode}:null,
  choiceLock:state.choiceLock?.nodeId===activeNode.id?{...state.choiceLock}:null};
}
function jumpToAct(act){
 const access=navigationAccess(act);
 if(!access.ok){toast(({safety_exit:'本轮已因安全或意愿结束。可另开新接诊，原记录保留。',completed:'本轮已保存完成。可另开新接诊，原记录保留。',preparing:'请先看完脱鞋袜动作，再切换环节。',teacher_preview:'这是教师单项预览。请返回普通接诊后使用项目导引。',not_ready:'诊室还在准备，请稍候。'})[access.reason]||'当前无法进入该环节。');return access;}
 const wasStarted=hasStarted;
 if(!hasStarted){
  if(saved?.node){Object.assign(state,saved);queue=[...(state.events||[])];activeNode=flow[state.node]||null;stepBook.clear();if(state.taskState?.nodeId===activeNode?.id){for(const [key,value]of Object.entries(state.taskState.values||{}))stepBook.set(key,value);taskPhase=state.taskState.phase??.08;pressureMode=state.taskState.pressureMode||'static';}}
  hasStarted=true;state.taskReceipts=state.taskReceipts||{};state.records=state.records||[];
 }
 rememberNavigationPosition();
 state.preparationReturnNode=null;
 const stage=NAVIGATION_STAGES.find(item=>item.act===act),bookmark=state.navigationBookmarks?.[act];
 const restore=bookmark&&flow[bookmark.nodeId]?.act===act?bookmark:null;
 const targetId=restore?.nodeId||stage.entry,fromNode=activeNode?.id||null,fromAct=activeNode?.act||null;
 if(wasStarted&&targetId===fromNode){closeProjectGuide();return{ok:true,unchanged:true,fromNode,toNode:targetId,fromAct,toAct:act,missedStages:[]};}
 const visitedActs=new Set((state.visited||[]).map(id=>flow[id]?.act));
 const missedStages=NAVIGATION_STAGES.slice(0,NAVIGATION_STAGES.findIndex(item=>item.act===act)).filter(item=>!visitedActs.has(item.act)).map(item=>item.act);
 const payload={fromNode,toNode:targetId,fromAct,toAct:act,missedStages,restoredBookmark:!!restore,sessionPreserved:true,notClinicalSkillAssessment:true};
 state.navigationJumps=state.navigationJumps||[];state.navigationJumps.push({at:now(),...payload});
 if(['act2','act3','act4','act5','act6','act7'].includes(act)&&(!state.barefootPrepared||wasStarted&&actors.patient.getState().footwear==='shoes'))state.barefootPrepared=false;
 if(restore){state.taskState=restore.taskState;state.choiceLock=restore.choiceLock;}else state.choiceLock=null;
 closeProjectGuide();state.paused=false;movement=null;taskRunning=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-pressed','false');
 goto(targetId,{restoring:!!restore,navigation:true});
 record('student_navigation_jump',{...payload,source:'clinic3d-v16-navigation',scope:'navigation_only_no_assessment_credit'});
 toast(restore?'已回到这一步的原位置；已有证据与操作记录保留。':'已进入所选环节。跳过的检查不会补记为完成。');
 return{ok:true,...payload};
}
function goto(id,{restoring=false,navigation=false}={}) {
 if(REVIEW_NODE&&id!==REVIEW_NODE){toast('本页只预览这一项。返回主线可继续原接诊，预览不保存学习结果。');return;}
 if(immersion?.beforeNode(id,()=>goto(id,{restoring,navigation})))return;
 actors?.patient.setEmotion?.('neutral');$('communicationState').hidden=true;delete $('conversation').dataset.communication;
 const node=flow[id];
 if(!node){toast('当前环节已结束，请打开接诊记录复盘。');return;}
 if(state.completedAt){const finalId=state.exitLock?'safe_finish':'finish';if(restoring&&id!==finalId)return goto(finalId,{restoring:true});if(!node.terminal){toast('本次学习已保存，请在接诊记录中回看。');openDrawer('notes');return;}}
 const safetyNodes=['medical_stop','symptom_stop','decline_stop','safe_finish'];
 const restoredChoice=restoring&&state.choiceLock?.nodeId===id?state.choiceLock:null;
 const restoringSafetyChoice=restoredChoice&&safetyNodes.includes(restoredChoice.nextId);
 if(state.exitLock&&!safetyNodes.includes(id)&&!restoringSafetyChoice){toast('本轮体能任务已结束，请保留停止原因并复盘。');return;}
 if(['medical_stop','symptom_stop','decline_stop','safe_finish'].includes(id)){state.exitLock=true;state.preparationReturnNode=null;if(!state.exitReason)state.exitReason=id;}
 activeNode=node;state.node=id;usageTracker?.flush();state.autoDialogueNext=null;state.choiceLock=restoredChoice;selectedNext=null;taskRunning=false;stepBook.clear();if(!restoring)taskPhase=node.task?.type==='gait'?0:.08;if(restoring&&state.taskState?.nodeId===id){for(const [k,v]of Object.entries(state.taskState.values||{}))stepBook.set(k,v);taskPhase=state.taskState.phase??.08;pressureMode=state.taskState.pressureMode||'static';}actors?.patient.setGaitPhase?.(null);actors?.patient.setLocomotion?.(false);
 if(!state.visited.includes(id))state.visited.push(id);
 document.body.dataset.nodeKind=node.kind||'dialogue';document.body.dataset.node=id;document.body.dataset.act=currentAct();
 $('welcome').hidden=true;$('conversation').hidden=false;$('feedback').hidden=true;
 $('taskSurface').hidden=true;$('taskSurface').replaceChildren();$('options').replaceChildren();
 $('next').hidden=false;$('next').disabled=false;$('next').textContent='继续 →';
 const chapter=chapters.find(x=>x[0]===currentAct());
 $('chapterNumber').textContent=currentAct()==='debrief'?'教学复盘':(chapters.indexOf(chapter)+1)+' / 8 · '+(chapter?.[1]||'接诊');
 $('chapterTitle').textContent=chapter?.[1]||'接诊';
 $('purpose').textContent=node.purpose||({'act1':'先了解患者的体验、安全与目标。','act2':'统一方法，再解释检查发现。','act3':'认识肌群，统一检查条件。','act4':'比较负重前后足弓外观。','act5':'同一时间轴，区分事件与推断。','act6':'先核对条件，再比较负荷记录。','act7':'先建立可保护的任务起点。','act8':'围绕目标，选择有依据的下一步。','debrief':'分清已知、未做与尚未证明。'}[currentAct()]);
 $('speaker').textContent=node.speaker||'林治疗师';
 $('taskLabel').textContent=node.kind==='task'?'观察与操作':node.kind==='summary'?'共同复盘':'';
 const presentedText=typeof displayNodeText==='undefined'?node.text||'':displayNodeText(node);
 $('line').textContent=presentedText;$('progressText').textContent='已走过 '+state.visited.length+' 个对话与操作';
 setVisual(node);updateComposition();lessonUI.presentNode(node);immersion?.enterNode(node);if(restoring){actors.patient.setPose(actors.patient.getState().pose,true);actors.therapist.setPose(actors.therapist.getState().pose,true);}drawRail();addEvidence([]);
 if(!restoring){
  appendLine(node.speaker||'林治疗师',presentedText,node.kind);
  if(node.evidence&&!navigation)addEvidence(node.evidence);
  if(node.record&&!navigation)state.records.push({nodeId:id,...node.record});
  record('clinic3d_node',{nodeId:id,act:currentAct(),kind:node.kind,record:!navigation?node.record||null:null,navigationEntry:navigation});
 }
 if(node.task)renderTask(node.task);
 if(node.options?.length){$('next').hidden=true;for(const option of node.options){const b=button(option.shortLabel||option.label,()=>choose(option,b));b.dataset.option=option.id;b.dataset.number=String(node.options.indexOf(option)+1).padStart(2,'0');b.disabled=!!restoredChoice||!!state.completedAt;b.classList.toggle('selected',restoredChoice?.optionId===option.id);$('options').append(b);}if(restoredChoice){const option=node.options.find(x=>x.id===restoredChoice.optionId);selectedNext=restoredChoice.nextId;$('feedback').textContent=option?.feedback||'已恢复上次选择，请继续当前路线。';$('feedback').hidden=false;$('next').hidden=false;$('next').textContent=option?.retry?'重新核对 →':'继续 →';}}
 else selectedNext=node.next;
 if(node.terminal||(!node.next&&!node.options?.length)){$('next').hidden=false;$('next').textContent='保存本次学习 →';selectedNext='__complete';}
 if(state.communicationRepairs?.[id]?.pending){state.choiceLock=null;selectedNext=null;playPatientReaction(state.communicationRepairs[id],true);persist();return;}
 const filmTrigger=restoredChoice&&!node.options?.find(option=>option.id===restoredChoice.optionId)?.retry?'choice':'entry';
 if(typeof filmSequence==='undefined'||!filmSequence.present(node,{restoring,trigger:filmTrigger}))dialoguePlayer.load(presentedText,node.speaker||'',node.id);if(actors?.patient.getState().footwearRemoval?.active)$('next').disabled=true;$('conversation').scrollTop=0;persist();
}
function choose(option,b) {
 if(typeof filmSequence!=='undefined'&&dialoguePlayer.getState().pending){toast('先听完这段交流，再选择如何回应。');return;}
 if(actors?.patient.getState().footwearRemoval?.active){toast('请等患者坐稳、脱好鞋袜，再继续。');return;}
 if(state.completedAt){toast('本次学习已保存，请在接诊记录中回看。');return;}
 if(selectedNext)return;
 if(state.exitLock&&!['medical_stop','symptom_stop','decline_stop','safe_finish'].includes(activeNode.id))return;
 if(!REVIEW_NODE&&['act2','act3','act4','act5','act6','act7'].includes(activeNode.act)&&!state.barefootPrepared&&!ensurePreparation())return;
 if(option.requiresTask&&!taskComplete()){toast('请先完成上方观察与核对，再选择下一步。');record('clinic3d_task_needed',{nodeId:activeNode.id,optionId:option.id});return;}
 if(option.requiresEvidence?.some(id=>!state.evidence.includes(id))){toast('当前没有取得这项依据，可先补齐评估或选择其他合理方向。');return;}
 const previous=state.communicationRepairs?.[activeNode.id];
 const priorCount=previous?.attempts||0;
 const reaction=(option.retry||option.good===false)?reactionFor(option.id,priorCount+1):null;
 document.querySelectorAll('#options button').forEach(x=>{x.classList.toggle('selected',x===b);x.disabled=true;});
 appendLine('我的选择',option.label,'choice');
 record('clinic3d_choice',{nodeId:activeNode.id,optionId:option.id,label:option.label,good:option.good??null,safe:option.safe??null,record:option.record||null});
 if(reaction){
  state.communicationRepairs||={};
  const repair={nodeId:activeNode.id,optionId:option.id,attempts:priorCount+1,pending:true,phase:'reaction',reaction,selectedText:option.shortLabel||option.label};
  state.communicationRepairs[activeNode.id]=repair;state.choiceLock=null;selectedNext=null;
  record('clinic3d_communication_reaction',{nodeId:activeNode.id,optionId:option.id,attempt:repair.attempts,kind:reaction.kind,emotion:reaction.emotion,reply:reaction.text,scope:'authored_communication_practice',notClinicalSkillScore:true});
  playPatientReaction(repair);persist();return;
 }
 selectedNext=option.next||activeNode.next;if(option.retry&&!selectedNext)selectedNext=activeNode.id;
 state.choiceLock={nodeId:activeNode.id,optionId:option.id,nextId:selectedNext,chosenAt:now()};
 if(['medical_stop','symptom_stop','decline_stop','safe_finish'].includes(selectedNext)){state.exitLock=true;if(!state.exitReason)state.exitReason=selectedNext;}
 if(option.evidence)addEvidence(Array.isArray(option.evidence)?option.evidence:[option.evidence]);
 if(option.record)state.records.push({nodeId:activeNode.id,optionId:option.id,...option.record});
 if(option.planDomain)state.records.push({planDomain:option.planDomain,supports:option.supports?.filter(id=>state.evidence.includes(id))||[]});
 $('feedback').textContent=option.feedback||'已记录您的选择。';$('feedback').hidden=false;
 $('next').hidden=false;$('next').textContent=option.retry?'重新核对 →':'继续 →';
 if(previous?.pending&&!option.retry&&option.good!==false){
  previous.pending=false;previous.phase='repaired';previous.repairedAt=now();previous.correctedOption=option.id;
  record('clinic3d_communication_repaired',{nodeId:activeNode.id,optionId:option.id,attempts:previous.attempts,notClinicalSkillScore:true});
  $('communicationState').hidden=false;$('communicationState').dataset.tone='calm';$('communicationState').textContent='已回应患者顾虑 · 继续共同商量';
  actors?.patient.setEmotion?.('neutral');
  const reply=repairLabel(option);appendLine('林治疗师',reply,'communication-repair');appendLine('陈女士',REPAIR_ACK,'communication-repair');
  dialoguePlayer.loadSequence([{speaker:'therapist',text:reply},{speaker:'patient',text:REPAIR_ACK}],activeNode.id+':repair-accepted');
 }else{
  $('speaker').textContent='林治疗师';$('speakerAvatar').textContent='林';$('conversation').dataset.speaker='therapist';
  dialoguePlayer.load(option.shortLabel||option.label,'林治疗师',activeNode.id+':'+option.id);
  if(!option.retry&&typeof filmSequence!=='undefined')filmSequence.present(activeNode,{trigger:'choice'});
 }
 persist();
}
function playPatientReaction(repair,restoring=false){
 if(!activeNode||repair.nodeId!==activeNode.id)return;
 repair.phase='reaction';taskRunning=false;selectedNext=null;
 $('next').hidden=true;$('feedback').hidden=true;$('filmCue').hidden=true;$('filmHandoff').hidden=true;
 $('communicationState').hidden=false;$('communicationState').dataset.tone=repair.reaction.emotion;
 $('communicationState').textContent=repair.reaction.emotion==='upset'?'患者表达不满 · 先倾听，再回应':'患者有顾虑 · 请听完后重新回应';
 $('conversation').dataset.communication='repair';actors?.patient.setEmotion?.(repair.reaction.emotion);
 document.querySelectorAll('#options button').forEach(x=>x.disabled=true);
 if(!restoring)appendLine('陈女士',repair.reaction.text,'patient-reaction');
 dialoguePlayer.loadSequence([{speaker:'patient',text:repair.reaction.text}],activeNode.id+':patient-reaction');
}
function offerRepair(){
 const repair=state.communicationRepairs?.[activeNode?.id];if(!repair?.pending)return false;
 repair.phase='respond';selectedNext=null;state.choiceLock=null;
 $('next').hidden=true;$('options').replaceChildren();
 for(const option of activeNode.options||[]){const b=button(repairLabel(option),()=>choose(option,b));b.dataset.option=option.id;$('options').append(b);}
 $('taskLabel').textContent='请重新回应';
 $('communicationState').textContent='先回应顾虑，再说明理由。您可以重新选择。';
 persist();return true;
}

function taskComplete() {
 const task=activeNode.task;if(!task)return true;let valid=true;
 if(task.type==='goniometer')valid=['axis','fixed','moving'].every(x=>stepBook.has(x));
 if(task.type==='muscle')valid=MUSCLE_ITEMS.every(x=>stepBook.get('muscle_'+x.id)===true);
 if(task.type==='arch')valid=['arch_seated','arch_standing'].every(x=>stepBook.get(x)===true);
 if(task.type==='gait')valid=task.events.every(e=>stepBook.has(e.id)&&isGaitEventMatch(stepBook.get(e.id),e.targetPhase,e.tolerance));
 if(task.type==='pressure')valid=task.stage==='conditions'?stepBook.has('mode'):stepBook.has('region')&&Number(stepBook.get('dynamicMax')||0)-Number(stepBook.get('dynamicMin')||0)>=.15;
 if(task.type==='archIndex')valid=stepBook.get('arch_index_checked')===true;
 if(task.type==='staticCOP')valid=stepBook.get('static_cop_checked')===true&&stepBook.get('cop_compared')===true;
 if(task.type==='balance')valid=(task.checklist||[]).every((_,i)=>stepBook.get('check'+i));
 if(valid){state.taskReceipts[activeNode.id]={at:now(),values:Object.fromEntries(stepBook),scope:'teaching-operation-only'};record('clinic3d_task_completed',{nodeId:activeNode.id,...state.taskReceipts[activeNode.id]});}
 return valid;
}
function complete(){if(!activeNode?.terminal){toast('请先完成本轮复盘。');return;}if(state.completedAt){toast('本次学习已保存。');openDrawer('notes');return;}state.completedAt=now();state.reflection=$('reflection').value||state.reflection;record('clinic3d_learning_complete',{caseId:'cai',completedAt:state.completedAt,visited:state.visited,evidence:state.evidence,reflection:state.reflection,notClinicalSkillAssessment:true});try{const list=JSON.parse(localStorage.getItem('dxx_encounter_completed_v1')||'[]');list.push({id:state.sessionId,caseId:'cai',student:profile,source:'clinic3d-v14',completedAt:state.completedAt,summary:{visited:state.visited,evidence:state.evidence,reflection:state.reflection,notClinicalSkillAssessment:true}});localStorage.setItem('dxx_encounter_completed_v1',JSON.stringify(list.filter((x,i,arr)=>arr.findIndex(y=>y.id===x.id)===i)));}catch{}toast('已保存本次学习，可在接诊记录中回看和导出。');openDrawer('notes');}
function intro(){hasStarted=true; $('welcome').hidden=true;$('conversation').hidden=false;$('speaker').textContent='林治疗师';$('line').textContent='陈女士，您好。我是林治疗师。请慢慢走到这边坐，先不用做动作。我们先聊聊您最担心的事。';$('conversation').dataset.speaker='therapist';$('dialogueKind').textContent='欢迎来到诊室';$('speakerAvatar').textContent='林';$('options').replaceChildren();$('taskSurface').hidden=true;$('next').hidden=false;$('next').textContent='进入问诊 →';selectedNext=START_NODE;state.node=null;const a=room.anchors;actorPose(actors.patient,'standing',a.entrance||[-1.65,0,-2.55],0);actorPose(actors.therapist,'standing',a.welcome||[.4,0,-1.0],-Math.PI/2);const seat=a.patientSeat||[.8,0,-.85];movement={time:0,duration:7,patientPath:[a.entrance||[-1.65,0,-2.55],[-1.0,0,-1.7],[seat[0],0,seat[2]+.5],seat],doctorPath:[a.welcome||[.4,0,-1.],[.20,0,-1.3],[.20,0,-2.55],a.therapistSeat],done:false};actors.patient.setLocomotion(true);actors.therapist.setLocomotion(true);record('clinic3d_reception_started');goto(START_NODE);}
function finishIntro(){if(!movement)return;const a=room.anchors;actorPose(actors.patient,'seated',a.patientSeat,Math.PI);actorPose(actors.therapist,'seated',a.therapistSeat,0);movement=null;visualZone='consult';setView('first');}
function followPath(points,t){const segments=points.length-1,at=Math.min(segments-.00001,t*segments),i=Math.floor(at),fraction=at-i;return new THREE.Vector3(...points[i]).lerp(new THREE.Vector3(...points[i+1]),fraction);}
function animate(t){requestAnimationFrame(animate);if(t-lastDraw<32)return;lastDraw=t;const dt=Math.min((t-last)/1000,.05);last=t;if(!state.paused){elapsed+=dt;actors?.update(dt);if(actors&&elapsed>talkUntil)actors.setTalking(null);if(movement){movement.time+=dt;const travel=Math.min(movement.time/5.2,1),pos=followPath(movement.patientPath,travel),ahead=followPath(movement.patientPath,Math.min(travel+.015,1));actors.patient.setPosition(pos.toArray());if(travel<.995)actors.patient.face(Math.atan2(ahead.x-pos.x,ahead.z-pos.z));const dp=followPath(movement.doctorPath,travel),da=followPath(movement.doctorPath,Math.min(travel+.015,1));actors.therapist.setPosition(dp.toArray());if(travel<.995)actors.therapist.face(Math.atan2(da.x-dp.x,da.z-dp.z));if(travel>=1&&!movement.done){movement.done=true;actorPose(actors.patient,'seated',room.anchors.patientSeat,Math.PI);actorPose(actors.therapist,'seated',room.anchors.therapistSeat,0);}if(movement.time>=movement.duration)finishIntro();}
 if(taskRunning){const rate=activeNode?.task?.type==='gait'?.25/GAIT_CASE.cycleSeconds:pressureMode==='static'?1/8:.25/(2*GAIT_CASE.cycleSeconds);taskPhase=Math.min(1,taskPhase+dt*rate);if(taskPhase>=1)taskRunning=false;stepBook.set('observed',true);const slider=$('taskPhase');if(slider)slider.value=String(taskPhase);if(t-lastPressurePaint>100||!taskRunning){paintTask();lastPressurePaint=t;}}syncGaitVisual();updatePreparation();
 }
 if(cameraMove){const v=cameraMove.duration?Math.min((t-cameraMove.at)/cameraMove.duration,1):1,k=v*v*(3-2*v);camera.position.lerpVectors(cameraMove.from,cameraMove.to,k);controls.target.lerpVectors(cameraMove.look,cameraMove.target,k);camera.lookAt(controls.target);if(v>=1){cameraMove=null;controls.enabled=state.view==='third';controls.enableDamping=state.view==='third';}}
 if(actors)actors.therapist.root.visible=state.view==='third'&&!actors.patient.getState().footwearRemoval?.active;controls?.update();if(!lessonUI.anatomyIsOpen()&&!learningHub.isOpen())renderer?.render(scene,camera);}

function startPreparation(replay=false){
 if(!actors||actors.patient.getState().footwearRemoval?.active)return;
 taskRunning=false;const returnView=state.view;
 removalReturn=replay?{view:returnView,preview:true}:{view:returnView,preview:false};
 document.body.dataset.inspectEquipment='false';state.view='third';
 document.body.dataset.footwearPreparation='true';
 if(visualZone!=='exam')setVisual({act:'act2',visualMode:'exam',id:'__preparation'});
 actorPose(actors.patient,'seated',room.anchors.examSeat,Math.PI/2,true);
 actors.patient.setFootwear('shoes');actors.patient.startFootwearRemoval();
 state.paused=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-pressed','false');
 $('next').disabled=true;focusPreparation();record('clinic3d_footwear_preparation',{replay,source:'authored-continuous-action'});
 lessonUI.refreshCoach();
}
function focusPreparation(){
 if(!camera)return;state.paused=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-pressed','false');controls.enabled=false;controls.enableDamping=false;
 cameraMove={at:performance.now(),from:camera.position.clone(),look:controls.target.clone(),to:new THREE.Vector3(1.05,1.18,1.15),target:new THREE.Vector3(-.80,.65,.05),duration:700};
 $('cameraNote').textContent='赤足准备 · 坐位观察';
}
function updatePreparation(){
 const removal=actors?.patient.getState().footwearRemoval;
 if(removal?.active){$('next').disabled=true;lessonUI.refreshCoach();return;}
 if(removalReturn&&removal?.completed){
  const previous=removalReturn;removalReturn=null;state.barefootPrepared=true;document.body.dataset.footwearPreparation='false';$('next').disabled=false;
  setVisual(activeNode||{act:'act1',visualMode:'consult'});
  setView(previous.preview?previous.view:'third');
  record('clinic3d_barefoot_prepared',{animationCompleted:true,clinicalSkillAssessed:false});lessonUI.refreshCoach();if(state.autoDialogueNext===activeNode?.id&&!dialoguePlayer.getState().pending){state.autoDialogueNext=null;continueEncounter();}
 }
}
function staticFootCentres(){
 const result={};for(const [side,name]of [['left','foot.L'],['right','foot.R']]){const p=actors.patient.bones.get(name).getWorldPosition(new THREE.Vector3());result[side]={x:p.x,z:p.z};}return result;
}
function currentPressureFrame(){
 const isGait=activeNode?.task?.type==='gait';
 if(isGait||pressureMode==='dynamic')return sampleWalking(taskPhase*(isGait?1:2));
 return sampleStanding(taskPhase,{centres:staticFootCentres()});
}
function syncGaitVisual(){
 if(!actors||actors.patient.getState().footwearRemoval?.active){pressureStage?.update(null,false);return;}
 const isGait=activeNode?.task?.type==='gait',isPressure=activeNode?.task?.type==='pressure',walking=isGait||(isPressure&&pressureMode==='dynamic');
 if(walking){const cycle=taskPhase*(isGait?1:2),start=room.anchors.pressureWalkStart||[-.1,0,1.45];actors.patient.setGaitPhase(cycle%1);actors.patient.setPosition([start[0],0,start[2]-GAIT_CASE.strideLength*cycle]);if(actors.patient.getState().footwear!=='barefoot')actors.patient.setFootwear('barefoot');}
 else if(isPressure||activeNode?.task?.type==='staticCOP'){actors.patient.setGaitPhase(null);actors.patient.setLocomotion(false);actors.patient.setPosition(room.anchors.pressureStand||[-.1,0,1.1]);}
 const showPressure=isGait||(isPressure&&pressureMode!=='maximum');pressureStage?.update(showPressure?currentPressureFrame():null,showPressure);
}
function renderTask(task){lessonUI.presentTask(task);}
function paintTask(){lessonUI.paintTask();}
function drawPressure(svg){
 const isGait=activeNode?.task?.type==='gait',mode=isGait?'dynamic':pressureMode;
 if(mode==='dynamic'&&!isGait){stepBook.set('dynamicMin',Math.min(Number(stepBook.get('dynamicMin')??1),taskPhase));stepBook.set('dynamicMax',Math.max(Number(stepBook.get('dynamicMax')??0),taskPhase));}
 renderPressureDiagram(svg,{mode,phase:taskPhase*(mode==='dynamic'&&!isGait?2:1),centres:mode==='static'?staticFootCentres():undefined});
}
const dialoguePlayer=createDialoguePlayer({$,speak,cancelSpeech:()=>dialogueAudio.cancel(),record,
 isPaused:()=>state.paused||!$('projectGuide').hidden||!$('teacher').hidden||!$('notes').hidden||lessonUI.anatomyIsOpen()||learningHub.isOpen(),
 onChange:()=>lessonUI.refreshCoach(),onUtterance:info=>{filmSequence.onUtterance(info);learningBubbles?.utterance(info);},
 onComplete:()=>{if(offerRepair())return;if(activeNode&&(activeNode.kind==='dialogue'||state.choiceLock?.nodeId===activeNode.id)&&selectedNext&&!activeNode?.terminal&&!state.paused){state.autoDialogueNext=activeNode.id;if(!actors?.patient.getState().footwearRemoval?.active)continueEncounter();}else if(!activeNode&&selectedNext===START_NODE&&!state.paused){const wait=()=>{if(state.paused)return;if(movement){setTimeout(wait,200);return;}continueEncounter();};wait();}}
});
let filmPauseRevision=0;
function pauseSceneForFilm(){
 const previous={paused:state.paused,nodeId:activeNode?.id,revision:filmPauseRevision};
 state.paused=true;taskRunning=false;actors?.setTalking(null);dialogueAudio.cancel();
 $('pause').textContent='▶';$('pause').setAttribute('aria-pressed','true');return previous;
}
function resumeSceneFromFilm(previous){
 if(previous&&previous.nodeId===activeNode?.id&&previous.revision===filmPauseRevision&&!state.exitLock)state.paused=!!previous.paused;
 $('pause').textContent=state.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-pressed',String(state.paused));
}
const filmSequence=createFilmSequence({$,state,player:dialoguePlayer,record,persist,appendLine,
 refreshCoach:()=>lessonUI.refreshCoach(),
 pauseScene:pauseSceneForFilm,resumeScene:resumeSceneFromFilm
});
const lessonUI=createLearningUI({$ ,state,catalog,stepBook,nodeEl,button,record,
 getCurrent:()=>({node:activeNode,phase:taskPhase,running:taskRunning,pressureMode}),
 getRemovalState:()=>actors?.patient.getState().footwearRemoval,focusPreparation,replayPreparation:()=>startPreparation(true),
 setPhase(value){taskRunning=false;taskPhase=value;actors.patient.setLocomotion(false);syncGaitVisual();paintTask();},
 toggleRun(){if(state.paused){state.paused=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-pressed','false');$('pause').setAttribute('aria-label','暂停场景');}if(taskPhase>=1)taskPhase=0;taskRunning=!taskRunning;record('clinic3d_task_play',{nodeId:activeNode.id,playing:taskRunning});},
 setPressureMode(value){pressureMode=value;taskPhase=0;taskRunning=false;actors?.patient.setGaitPhase(null);syncGaitVisual();},pauseTask(){taskRunning=false;},setView,openDrawer,drawPressure,
 focusTask(){if(activeNode?.task?.type==='gait')setView('first');$('taskSurface')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
});
let learningPauseBefore=false;
const learningHub=createLearningHub({
 inertTarget:$('clinic'),
 getSession(){const selected=hasStarted?state:(saved||state);return {id:selected.sessionId,caseId:'cai',startedAt:selected.startedAt,student:selected.student||profile};},
 getObjective(){const n=Number(String(currentAct()).replace('act',''));return 'O'+(n>=1&&n<=8?n:8);},
 onOpen(){learningPauseBefore=state.paused;state.paused=true;taskRunning=false;actors?.setTalking(null);dialogueAudio.cancel();$('pause').textContent='▶';$('pause').setAttribute('aria-pressed','true');record('clinic3d_learning_space_open',{act:currentAct(),notClinicalMeasurement:true});},
 onClose(){state.paused=learningPauseBefore;$('pause').textContent=state.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-pressed',String(state.paused));record('clinic3d_learning_space_close',{act:currentAct()});}
});
$('learningOpen').addEventListener('click',()=>learningHub.open());
immersion=installImmersion({state,flow,catalog,getNode:()=>activeNode,record,persist,
 pause(){const previous=state.paused;state.paused=true;taskRunning=false;dialogueAudio.cancel();actors?.setTalking(null);return()=>{state.paused=previous;};}});
usageTracker=createUsageTracker({enabled:()=>hasStarted,getModule:()=>currentAct(),record});
learningBubbles=installLearningBubbles({record,persist,openConcept:act=>immersion.openConcept(act),pause(){const previous={paused:state.paused,running:taskRunning};state.paused=true;taskRunning=false;actors?.setTalking(null);dialogueAudio.cancel();filmSequence.pauseVideo('optional_learning');return()=>{state.paused=previous.paused;taskRunning=previous.running;$('pause').textContent=state.paused?'▶':'Ⅱ';};}});

let projectGuideFocus=null,projectGuidePausedBefore=false;
function renderProjectGuide(){
 const working=hasStarted?state:(saved||state),currentNode=flow[working.node],currentStage=NAVIGATION_STAGES.find(stage=>stage.act===currentNode?.act),visitedActs=new Set((working.visited||[]).map(id=>flow[id]?.act));
 $('guidePosition').textContent=currentStage?'你目前在：'+currentStage.title+'。点这一环节可回到原位置。':'可从问诊开始，也可选择本次想学习的环节。';
 $('guideProgress').textContent=`到访 ${NAVIGATION_STAGES.filter(stage=>visitedActs.has(stage.act)).length} / 8 个环节 · 实际证据 ${(working.evidence||[]).length} 条。到访不等于达标。`;
 const reason=navigationAccess('act1').reason;
 $('guideAccessNote').textContent=({safety_exit:'本轮已因安全或患者意愿结束，原停止原因会保留。若想重新练习，请另开新接诊。',completed:'本轮已提交保存，可查阅接诊记录。继续练习请另开新接诊，保留这次结果。',preparing:'患者正在脱鞋袜。请先返回看完准备动作，再切换环节。',teacher_preview:'当前是教师单项预览。学生跳步请使用普通接诊入口。',not_ready:'诊室仍在准备，准备好后即可选择。'})[reason]||'自由切换环节，按实际完成情况留记录。';
 $('guideStageCards').replaceChildren();
 for(const [index,stage]of NAVIGATION_STAGES.entries()){
  const card=nodeEl('article','guide-stage-card'),isCurrent=currentNode?.act===stage.act;
  card.dataset.stage=stage.act;card.classList.toggle('is-current',isCurrent);
  const heading=nodeEl('div','guide-stage-heading');heading.append(nodeEl('span','guide-stage-number',String(index+1).padStart(2,'0')),nodeEl('span','guide-stage-state',isCurrent?'当前位置':visitedActs.has(stage.act)?'到访过':'尚未到访'));
  const control=button(isCurrent?'回到当前环节 →':working.navigationBookmarks?.[stage.act]?'回到上次位置 →':'进入这一环节 →',()=>jumpToAct(stage.act));
  control.dataset.jumpAct=stage.act;control.disabled=!navigationAccess(stage.act).ok;
  card.append(heading,nodeEl('h3','',stage.title),nodeEl('p','guide-stage-goal',stage.goal),nodeEl('small','',stage.task),control);$('guideStageCards').append(card);
 }
 const fresh=new URL('index.html',location.href);fresh.searchParams.set('demo','1');fresh.searchParams.set('round',uid());$('guideNewSession').href=fresh.href;
}
function openProjectGuide(){
 if(!$('projectGuide').hidden)return;
 projectGuideFocus=document.activeElement;projectGuidePausedBefore=state.paused;state.paused=true;taskRunning=false;actors?.setTalking(null);dialogueAudio.cancel();
 $('settings').hidden=true;renderProjectGuide();$('projectGuide').hidden=false;$('clinic').inert=true;$('projectGuideClose').focus();
}
function closeProjectGuide(){
 if($('projectGuide').hidden)return;
 $('projectGuide').hidden=true;$('clinic').inert=false;state.paused=projectGuidePausedBefore;$('pause').textContent=state.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-pressed',String(state.paused));
 if(projectGuideFocus?.getClientRects().length)projectGuideFocus.focus();else $('projectGuideOpen').focus();
}
$('projectGuideOpen').addEventListener('click',openProjectGuide);$('projectGuideWelcome').addEventListener('click',openProjectGuide);$('projectGuideClose').addEventListener('click',closeProjectGuide);
window.DXXClinicNavigation=Object.freeze({getStages:()=>NAVIGATION_STAGES.map(stage=>({...stage})),access:navigationAccess,jumpToAct,openGuide:openProjectGuide});
function openDrawer(id){drawerFocus=document.activeElement;$(id).hidden=false;$('clinic').inert=true;$(id).querySelector('button').focus();if(id==='notes')renderNotes();}
function closeDrawer(id){$(id).hidden=true;$('clinic').inert=false;drawerFocus?.focus();}
function renderNotes(){$('noteEvidence').replaceChildren();if(!state.evidence.length)$('noteEvidence').append(nodeEl('p','drawer-intro','从问诊和检查中逐步收集证据。'));for(const id of state.evidence){const p=nodeEl('div','note-evidence',evidenceText(id));p.append(nodeEl('small','','来源类别：'+({patient_report:'患者报告（虚构情境）',authored_demonstration:'教学示意操作',fictional_case_record:'课程病例记录',synthetic_teaching_data:'合成教学数据',reasoning:'学习者推理',communication:'沟通记录',safety_decision:'安全决策',shared_plan:'共同计划',not_performed:'本轮未做'}[catalog[id]?.status]||'学习选择')));$('noteEvidence').append(p);}for(const r of state.records||[]){if(r.newLearningNotPerformed?.length)$('noteEvidence').append(nodeEl('div','note-evidence','本轮尚未完成新增学习项：'+r.newLearningNotPerformed.map(x=>({muscle_match:'肌群配对',arch_compare:'足弓坐站比较'}[x]||x)).join('、')+'。旧记录保留，不补写新证据。'));for(const [key,label]of Object.entries({localCheck:'局部活动检查',balanceCheck:'平衡任务',physicalTasks:'本轮体能任务',remainingPhysicalTasks:'后续体能任务'})){if(r[key]==='not_performed')$('noteEvidence').append(nodeEl('div','note-evidence',label+'：本轮未做。'));}if(r.stopReason)$('noteEvidence').append(nodeEl('div','note-evidence','停止原因：'+({increased_discomfort:'不适增加',new_symptoms:'出现新的症状',opposite_foot_contact_and_patient_request:'另一脚落地且患者请求停止'}[r.stopReason]||'按当前情境结束任务')));}$('transcript').replaceChildren();for(const h of state.history){const p=nodeEl('p','',String(h.text||'').replaceAll('陈先生','陈女士'));p.prepend(nodeEl('b','',String(h.speaker||'').replaceAll('陈先生','陈女士')));$('transcript').append(p);}$('reflection').value=state.reflection;}
function exportData(technical=false){const data=technical?{format:'clinic3d-v14-technical-review',exportedAt:now(),node:state.node,view:state.view,room:room?.details||null,actors:actors?.details||null,limitations:TEACHER_LIMITATIONS,events:state.events,clinicalApproved:false,filmIntegration:'v18-node-bound',filmMediaPolicy:'accepted-only',heygenStatus:'see_teacher_production_record',productionRecord:'docs/heygen-v18-production.json'}:{format:'dongxiaoxue-clinic3d-learning-v14',...state,scope:'虚构教学病例的选择与解释记录，不是临床技能成绩或真实患者测量。'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=technical?'三维诊室_技术核对_v14.json':'足踝接诊_学习记录_v14.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('dockToggle').addEventListener('click',()=>{const collapsed=document.body.dataset.dockCollapsed!=='true';document.body.dataset.dockCollapsed=String(collapsed);$('dockToggle').setAttribute('aria-expanded',String(!collapsed));$('dockToggle').textContent=collapsed?'展开操作':'收起操作';updateComposition();});
$('prepReplay').addEventListener('click',()=>{$('settings').hidden=true;startPreparation(true);});
$('begin').addEventListener('click',intro);$('resume').addEventListener('click',()=>{if(!saved)return;Object.assign(state,saved);hasStarted=true;queue=[...(state.events||[])];state.paused=false;movement=null;visualZone='';state.taskReceipts=state.taskReceipts||{};state.records=state.records||[];goto(state.node||START_NODE,{restoring:true});toast(state.appearanceMigration?'已保留接诊进度；新增肌力与足弓学习项不会自动记为完成。':'已恢复本机保存的接诊进度。');});
function ensurePreparation(){
 if(state.barefootPrepared)return true;
 if(state.exitLock)return false;
 if(!state.evidence.includes('screening')||!state.evidence.includes('consent')){
  state.preparationReturnNode=activeNode.id;
  const target=state.evidence.includes('screening')?'consent':'safety';
  record('clinic3d_film_handoff_needs_consent',{fromNode:activeNode.id,toNode:target,assessmentCredit:false});
  goto(target);toast('检查前先补问近期情况、商量检查。确认后会回到你选的环节。');return false;
 }
 if(!actors.patient.getState().footwearRemoval?.active)startPreparation(false);
 return false;
}
function continueEncounter(){
 if(dialoguePlayer.getState().pending||state.communicationRepairs?.[activeNode?.id]?.pending)return;
 if(movement)finishIntro();
 if(activeNode&&['act2','act3','act4','act5','act6','act7'].includes(activeNode.act)&&!ensurePreparation())return;
 if(activeNode?.id==='consent_reply'&&selectedNext==='arch_intro'&&state.preparationReturnNode&&state.evidence.includes('screening')&&state.evidence.includes('consent')&&!state.exitLock){const returnNode=state.preparationReturnNode;state.preparationReturnNode=null;goto(returnNode);return;}
 if(selectedNext==='__complete')return complete();if(selectedNext)goto(selectedNext);
}
$('next').addEventListener('click',continueEncounter);
$('pause').addEventListener('click',()=>{filmPauseRevision++;state.paused=!state.paused;filmSequence.pauseVideo('scene_pause');$('pause').textContent=state.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-pressed',String(state.paused));$('pause').setAttribute('aria-label',state.paused?'继续场景':'暂停场景');if(state.paused)dialogueAudio.cancel();record('clinic3d_pause',{paused:state.paused});});
$('stop').addEventListener('click',()=>{filmPauseRevision++;filmSequence.pauseVideo('safety_pause');state.paused=true;actors.setTalking(null);taskRunning=false;actors.patient.setLocomotion(false);$('pause').textContent='▶';$('pause').setAttribute('aria-pressed','true');$('pause').setAttribute('aria-label','继续场景');dialogueAudio.cancel();record('clinic3d_safety_pause',{node:state.node});toast('已暂停。先询问患者感受，再决定继续、调整或结束。');});
$('menuOpen').addEventListener('click',()=>{$('settings').hidden=!$('settings').hidden;$('menuOpen').setAttribute('aria-expanded',String(!$('settings').hidden));});
$('settings').addEventListener('click',e=>{if(e.target.closest('button,a')){$('settings').hidden=true;$('menuOpen').setAttribute('aria-expanded','false');}});
document.addEventListener('pointerdown',e=>{if(!$('settings').hidden&&!$('settings').contains(e.target)&&!$('menuOpen').contains(e.target)){$('settings').hidden=true;$('menuOpen').setAttribute('aria-expanded','false');}});
$('notesOpen').addEventListener('click',()=>openDrawer('notes'));$('teacherOpen').addEventListener('click',()=>{$('settings').hidden=true;openDrawer('teacher');});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDrawer(b.dataset.close)));
$('save').addEventListener('click',()=>{persist();flush();toast('已保存当前接诊进度。');});$('saveReflection').addEventListener('click',()=>{state.reflection=$('reflection').value;record('clinic3d_reflection',{text:state.reflection});toast('已保存你的判断与下一步。');});$('export').addEventListener('click',()=>exportData());$('exportReview').addEventListener('click',()=>exportData(true));
$('voice').addEventListener('click',()=>{const on=$('voice').getAttribute('aria-pressed')!=='true';$('voice').setAttribute('aria-pressed',String(on));$('voice').textContent=on?'朗读开启':'朗读关闭';if(!on)dialogueAudio.cancel();else dialoguePlayer.replay();});
document.addEventListener('keydown',e=>{const drawer=['projectGuide','notes','teacher'].find(id=>!$(id).hidden);if(drawer){if(e.key==='Escape'){e.preventDefault();if(drawer==='projectGuide')closeProjectGuide();else closeDrawer(drawer);}if(e.key==='Tab'){const nodes=[...$(drawer).querySelectorAll('button,a,textarea')].filter(x=>x.getClientRects().length),first=nodes[0],lastNode=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();lastNode.focus();}else if(!e.shiftKey&&document.activeElement===lastNode){e.preventDefault();first.focus();}}}else if(e.key==='Escape'&&actors)$('stop').click();});
async function init(){renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.3));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;scene=new THREE.Scene();scene.background=new THREE.Color('#e2e9de');camera=new THREE.PerspectiveCamera(48,1,.04,40);camera.position.set(-1.8,2.0,2.8);controls=new OrbitControls(camera,$('scene'));controls.target.set(.2,1,-1);controls.enablePan=false;controls.minDistance=1;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.48;controls.enableDamping=true;controls.addEventListener('start',()=>{if(state.view==='third')cameraMove=null;});room=createClinicRoom(scene);pressureStage=createPressureStage(scene,room);scene.add(new THREE.HemisphereLight('#ffffee','#9eac96',2.3));const key=new THREE.DirectionalLight('#fff9e8',2.9);key.position.set(-3,6,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});key.shadow.bias=-.00003;key.shadow.normalBias=.0015;scene.add(key);const fill=new THREE.DirectionalLight('#e5f2f1',1.0);fill.position.set(3,4,-3);scene.add(fill);const resize=()=>{const w=$('clinic').clientWidth,h=$('clinic').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;updateComposition();};resize();window.addEventListener('resize',resize);requestAnimationFrame(animate);actors=await createActors(scene,{modelUrl:'assets/patient-motion.glb'});actors.therapist.bindDocumentation({notes:room.objects.clinicalNotes,pen:room.objects.clinicalPen,deskParent:room.objects.documentationDeskParent});actors.therapist.setDocumentation('desk');const a=room.anchors;actorPose(actors.patient,'standing',a.entrance||[-1.65,0,-2.55],0);actorPose(actors.therapist,'standing',a.welcome||[.5,0,-1.2],-Math.PI/2);$('loading').hidden=true;$('welcome').hidden=false;$('resume').hidden=!saved?.node;document.body.dataset.ready='true';showFacts($('teacherFacts'),[['人物','2个独立骨架的蒙皮角色'],['病例','1个主线病例 · 八幕与复盘'],['节点',Object.keys(flow).length],['运动学审核','尚未签审'],['双人短片','5段用户情境视频已剪辑接入；不作临床动作认证'],['足压来源','课程合成示意'],['学习记录','本机保存；同源教学服务可接收事件']]);setView('third',true);drawRail();lessonUI.refreshCoach();}
function startReview(){
 if(!REVIEW_NODE)return;
 state.barefootPrepared=true;hasStarted=false;visualZone='';goto(REVIEW_NODE);setView('third',true);
 const badge=nodeEl('div','teacher-preview-badge','教师预览 · 不保存学习结果　');
 const back=nodeEl('a','','返回主线');back.href='index.html?demo=1';badge.append(back);$('clinic').append(badge);
 for(const id of ['save','export','prepReplay','notesOpen','learningOpen'])$(id).hidden=true;
 $('saveStatus').textContent='教师预览 · 原接诊记录保持不变';
}
init().then(startReview).catch(error=>{$('loading').querySelector('h2').textContent='诊室未能载入';$('loadMessage').textContent='请刷新重试，或在教师制作记录中核对资源。';$('loader')?.remove();console.error(error);});
