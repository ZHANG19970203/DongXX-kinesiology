import {createDialogueAudio} from '../clinic3d/dialogue-audio.js';
import {splitDialogue} from '../clinic3d/dialogue-player.js';

// Video stills and synthetic speech are presented as a portrait dialogue,
// never as newly filmed or lip-synchronised patient footage.
export function createMediaExperience({getMedia,record}){
 const dialog=document.createElement('dialog');dialog.className='encounter-media';
 dialog.innerHTML='<section><header><div><small id="mediaMode">接诊情境</small><h2 id="mediaTitle"></h2></div><button type="button" id="mediaClose">返回学习 ×</button></header><video id="encounterVideo" controls playsinline preload="metadata"></video><div id="portraitScene" hidden><img id="portraitBackdrop" alt=""><div class="portrait-caption"><img id="portraitAvatar" alt=""><div><b id="portraitName"></b><p id="portraitLine" aria-live="polite"></p></div></div></div><footer><span id="mediaInstruction">看完自动返回本步操作。</span><button type="button" id="mediaPause" hidden>暂停交流</button><button type="button" id="mediaResume" hidden>播放视频</button></footer></section>';
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#'+id),video=$('encounterVideo'),portrait=$('portraitScene');
 let enabled=false,revision=0,active=null,returnFocus=null,paused=false,index=0,lines=[],timer;
 const seen=new Set(),autoSeen=new Set();
 const audio=createDialogueAudio({enabled:()=>true,onTalking:()=>{},onStatus:t=>{if(t)$('mediaInstruction').textContent=t;}});
 const script=fetch('interview-dialogue.json').then(r=>r.json());
 function stop(){revision++;clearTimeout(timer);audio.cancel();video.pause();}
 function close(reason='closed_early'){
  if(!dialog.open)return;const id=active;stop();dialog.close();video.removeAttribute('src');video.load();active=null;
  record('soap_media_return',{mediaId:id,reason,assessmentCredit:false});returnFocus?.focus?.();
 }
 function finish(){seen.add(active);record('soap_media_ended',{mediaId:active,assessmentCredit:false});close('ended');}
 async function showLine(){
  const run=++revision;audio.cancel();clearTimeout(timer);
  if(!dialog.open||paused||!lines[index])return;
  const turn=lines[index],name=turn.speaker==='patient'?'陈女士':'林治疗师',src='media/portrait-'+turn.speaker+'.jpg';
  $('portraitName').textContent=name;$('portraitLine').textContent=turn.text;
  for(const id of ['portraitBackdrop','portraitAvatar']){$(id).src=src;$(id).dataset.role=turn.speaker;}
  $('portraitAvatar').alt=name+'的视频肖像';$('mediaInstruction').textContent=`补充问诊 ${index+1} / ${lines.length} · 播完返回，继续自主追问`;
  record('soap_portrait_dialogue',{index,role:turn.speaker,assessmentCredit:false});
  const start=performance.now();await audio.speak(name,turn.text);if(run!==revision||paused||!dialog.open)return;
  timer=setTimeout(()=>{if(run!==revision)return;if(++index<lines.length)showLine();else finish();},Math.max(1500-(performance.now()-start),250));
 }
 async function supplement(){
  const run=revision;video.pause();video.hidden=true;portrait.hidden=false;
  $('mediaMode').textContent='补充问诊 · 肖像对白';$('mediaTitle').textContent='听清疼痛，也听清“不稳”的感觉';$('mediaPause').hidden=false;$('mediaResume').hidden=true;
  const data=await script;if(run!==revision||!dialog.open)return;
  lines=data.turns.flatMap(t=>splitDialogue(t.text).map(text=>({...t,text})));index=0;paused=false;showLine();
 }
 function open(id,trigger){
  if(dialog.open)close('replaced');enabled=true;active=id;returnFocus=trigger||document.activeElement;paused=false;
  portrait.hidden=true;video.hidden=false;$('mediaPause').hidden=true;$('mediaResume').hidden=true;
  $('mediaMode').textContent='接诊情境';$('mediaInstruction').textContent='看完自动收回，回到本步操作。';dialog.showModal();
  record('soap_media_open',{mediaId:id,assessmentCredit:false});
  if(id==='interview'&&seen.has('intro')){supplement();return;}
  const m=getMedia()[id==='interview'?'intro':id];
  if(!m){close('missing_media');return;}
  $('mediaTitle').textContent=m.title;video.src=m.src;video.poster=m.poster;
  video.play().catch(()=>{$('mediaResume').hidden=false;$('mediaInstruction').textContent='点击播放视频；播完会自动返回。';});
 }
 video.addEventListener('ended',()=>{if(active==='interview'){seen.add('intro');supplement();}else finish();});
 video.addEventListener('error',()=>{if(dialog.open&&!video.hidden){$('mediaInstruction').textContent='影片暂未载入，可返回继续学习。';$('mediaResume').hidden=false;}});
 $('mediaResume').onclick=()=>video.play().then(()=>{$('mediaResume').hidden=true;}).catch(()=>{});
 $('mediaClose').onclick=()=>close();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('mediaPause').onclick=()=>{paused=!paused;$('mediaPause').textContent=paused?'继续交流':'暂停交流';if(paused)stop();else showLine();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){if(!portrait.hidden){paused=true;stop();$('mediaPause').textContent='继续交流';}else video.pause();}});
 function card(id,{auto=false,key=id}={}){
  const m=getMedia()[id==='interview'?'intro':id],card=document.createElement('section');card.className='card media-launch';
  const button=document.createElement('button');button.type='button';button.className='media-trigger';
  const img=document.createElement('img');img.src=m?.poster||'media/intro-original.jpg';img.alt='';
  const text=document.createElement('span'),b=document.createElement('b'),small=document.createElement('small');
  b.textContent=id==='interview'?'与陈女士继续聊一聊':m?.title||'接诊片段';small.textContent=id==='interview'?'疼痛情境 · 发软感受 · 活动目标':'观看交流 → 播完返回操作';text.append(b,small);button.append(img,text);button.onclick=()=>{autoSeen.add(key);open(id,button);};card.append(button);
  if(auto&&enabled&&!autoSeen.has(key)){autoSeen.add(key);queueMicrotask(()=>{if(card.isConnected)open(id,button);});}
  return card;
 }
 return{card,close,enable(){enabled=true;}};
}
