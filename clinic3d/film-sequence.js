import { FILM_SEQUENCE } from './film-sequence-data.js';

export const FILM_CLIPS=FILM_SEQUENCE.clips;
const roles={therapist:'林治疗师',patient:'陈女士'};
const has=(state,id)=>(state.evidence||[]).includes(id);
const recorded=(state,key,value)=>(state.records||[]).some(row=>row[key]===value);
const alternative=(clip,condition)=>clip.alternative.find(item=>item.condition===condition);

// Select from actual state, never from a visited tab or an animation's appearance.
export function selectFilmBranch(clip,state){
  let condition=null;
  if(state.exitLock){
    condition=clip.id==='08A'?'declined_or_medical_stop_route':clip.id==='08B'?'medical_stop_or_declined_route':
      state.exitReason==='decline_stop'?'declined':clip.alternative.find(item=>item.handoff?.physicalTasks==='ended')?.condition;
    const item=alternative(clip,condition)||clip.alternative.find(item=>/declined|stopped|refused/.test(item.condition));
    return {condition:item?.condition||'physical_tasks_ended',lines:item?.lines||[{speaker:'therapist',text:'今天先结束体能任务。未做的如实记录，我们一起安排下一步。'},{speaker:'patient',text:'好，谢谢您尊重我的感受。'}],normal:false};
  }
  if(clip.id==='02B'&&recorded(state,'localCheck','not_performed'))condition='local_check_not_performed';
  if(clip.id==='03B'&&recorded(state,'muscleLearning','not_performed'))condition='muscle_learning_incomplete';
  if(clip.id==='07B'&&recorded(state,'balanceCheck','not_performed'))condition='balance_not_performed';
  
  if(clip.id==='08A'&&has(state,'goal')&&['local_record','arch_record','pressure_record','balance_record'].filter(id=>has(state,id)).length<2)condition='several_checks_skipped';
  if(condition){const item=alternative(clip,condition);if(item)return {condition,lines:item.lines,normal:false};}
  if((clip.evidenceRequirement?.all||[]).every(id=>has(state,id)))return {condition:'normal',lines:clip.normal,normal:true};
  const missing={
    '01B':'screening_or_goal_missing','02A':'consent_missing','02B':'local_check_not_performed',
    '03B':'muscle_learning_incomplete','04B':'arch_check_not_performed','05B':has(state,'gait_events')?'events_not_marked':'gait_task_not_performed',
    '06B':has(state,'pressure_conditions')?'pressure_not_performed':'conditions_not_checked',
    '07B':'balance_not_performed','08A':'goal_not_obtained','08B':'plan_not_selected'
  };
  const item=alternative(clip,missing[clip.id]);
  return {condition:item?.condition||'consent_missing',lines:item?.lines||[{speaker:'therapist',text:'我先把这一步的目的和过程说明白。您可以决定是否尝试，不舒服就停。'},{speaker:'patient',text:'好，请先说一下。'}],normal:false};
}

export function approvedFilmMedia(clipId,condition,manifest,baseUrl){
  const entry=manifest?.clips?.[clipId]?.[condition];
  if(entry?.approved!==true||entry?.reviewStatus!=='accepted'||! /^[a-f0-9]{64}$/i.test(entry.sha256||''))return null;
  try{const base=new URL(baseUrl),url=new URL(entry.src,base);if(url.origin!==base.origin||!url.pathname.toLowerCase().endsWith('.mp4'))return null;return {...entry,src:url.href};}catch{return null;}
}

export function createFilmSequence({$,state,player,record,persist,appendLine,pauseScene,resumeScene,refreshCoach}){
  let active=null,manifest={clips:{}},videoPause=null,pendingAuto=false;
  const cue=$('filmCue'),name=$('filmSegmentName'),handoff=$('filmHandoff'),replay=$('filmReplay'),watch=$('filmWatch'),overlay=$('filmOverlay'),video=$('filmVideo');
  const media=()=>active&&approvedFilmMedia(active.clip.id,active.branch.condition,manifest,location.href);
  fetch('film-media-v18.json',{cache:'no-cache'}).then(response=>response.ok?response.json():{clips:{}}).then(value=>{manifest=value;watch.hidden=!media();if(pendingAuto&&active&&media())openVideo();}).catch(()=>{});
  function clear(){pendingAuto=false;if(!overlay.hidden)closeVideo('node_changed');active=null;cue.hidden=true;handoff.hidden=true;watch.hidden=true;document.body.dataset.filmSegment='';}
  function present(node,{trigger='entry',restoring=false,force=false}={}){
    if(trigger==='entry'||active?.clip.anchorNode!==node.id)clear();
    const clip=FILM_CLIPS.find(item=>item.anchorNode===node.id&&item.trigger===trigger);
    if(!clip)return false;
    const branch=selectFilmBranch(clip,state),key=clip.id+':'+branch.condition;
    state.filmProgress=state.filmProgress||{};
    const prior=state.filmProgress[key];
    const actionLabel=branch.condition==='consent_missing'?'先补问安全情况，并商量是否检查':state.exitLock?'结束体能任务，讨论下一步':clip.actionLabel;
    active={clip,branch,key,actionLabel};cue.hidden=false;name.textContent=clip.title;
    replay.hidden=false;watch.hidden=!media();document.body.dataset.filmSegment=clip.id;
    handoff.textContent='接下来 · '+actionLabel;
    handoff.hidden=false;
    if(prior?.completed&&!force){refreshCoach?.();return false;}
    const startIndex=restoring&&!force?prior?.index||0:0;
    record(force?'clinic3d_film_segment_replay':'clinic3d_film_segment_open',{clipId:clip.id,nodeId:node.id,condition:branch.condition,mode:'live_scene_dialogue',assessmentCredit:false});
    if(!restoring||force)for(const turn of branch.lines)appendLine(roles[turn.speaker],turn.text,'film-dialogue');
    pendingAuto=!restoring||force;
    player.loadSequence(branch.lines,node.id+':film:'+clip.id,{startIndex,announce:!media()});
    if(pendingAuto&&media())openVideo();
    return true;
  }
  function onUtterance(info){
    if(!active||!info.sequence||!info.nodeId.endsWith(':film:'+active.clip.id))return;
    const previous=state.filmProgress[active.key];
    state.filmProgress[active.key]={index:info.index,completed:!info.pending,condition:active.branch.condition};
    if(!info.pending&&!previous?.completed)record('clinic3d_film_dialogue_read',{clipId:active.clip.id,condition:active.branch.condition,nodeId:active.clip.anchorNode,assessmentCredit:false});
    handoff.hidden=info.pending;
    persist();refreshCoach?.();
  }
  function needsBriefing(node){
    const clip=FILM_CLIPS.find(item=>item.anchorNode===node.id&&item.trigger==='entry');
    if(!clip)return false;
    const branch=selectFilmBranch(clip,state);
    return !state.filmProgress?.[clip.id+':'+branch.condition]?.completed;
  }
  function closeVideo(reason='return_to_scene'){
    if(overlay.hidden)return;
    video.pause();video.removeAttribute('src');video.load();overlay.hidden=true;
    document.body.dataset.filmPlaying='false';
    record('clinic3d_film_return',{clipId:active?.clip.id,reason,assessmentCredit:false});
    resumeScene(videoPause);videoPause=null;watch.focus();if(reason!=='ended'&&reason!=='node_changed')player.replay();
  }
  function pauseVideo(reason='pause'){
    if(overlay.hidden)return;
    video.pause();$('filmVideoStatus').textContent='已暂停。先确认患者感受，再决定是否继续。';
    record('clinic3d_film_video_pause',{clipId:active?.clip.id,reason,assessmentCredit:false});
  }
  replay.addEventListener('click',()=>{if(active)present({id:active.clip.anchorNode},{trigger:active.clip.trigger,force:true});});
  function openVideo(){
    pendingAuto=false;player.stop();
    const entry=media();if(!entry)return;
    videoPause=pauseScene();overlay.hidden=false;document.body.dataset.filmPlaying='true';
    $('filmVideoTitle').textContent=active.clip.title;$('filmVideoContinue').textContent='返回接诊 · '+active.actionLabel;
    $('filmVideoStatus').textContent='看完交流，再回到诊室完成这一步。';
    video.src=entry.src;video.controls=true;video.focus();
    record('clinic3d_film_video_open',{clipId:active.clip.id,condition:active.branch.condition,sha256:entry.sha256,assessmentCredit:false});
    video.play().catch(()=>{$('filmVideoStatus').textContent='点击视频播放，播完会自动返回本步操作。';});
  }
  watch.addEventListener('click',openVideo);
  video.addEventListener('ended',()=>{if(!active)return;const current=active;record('clinic3d_film_video_ended',{clipId:current.clip.id,assessmentCredit:false});closeVideo('ended');player.loadSequence(current.branch.lines,current.clip.anchorNode+':film:'+current.clip.id,{startIndex:1000000,announce:false});player.finishSequence();});
  video.addEventListener('error',()=>{if(!overlay.hidden){closeVideo('media_load_error');player.replay();}});
  $('filmVideoContinue').addEventListener('click',()=>closeVideo());
  $('filmVideoClose').addEventListener('click',()=>closeVideo('closed_early'));
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeVideo('closed_early');}else if(event.key==='Tab'){const stops=[$('filmVideoClose'),video,$('filmVideoContinue')],first=stops[0],last=stops.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  return {present,onUtterance,needsBriefing,clear,closeVideo,pauseVideo,getActive:()=>active};
}
