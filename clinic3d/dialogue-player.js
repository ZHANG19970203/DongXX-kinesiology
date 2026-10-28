export function splitDialogue(text){return (String(text||'').match(/[^。！？\n]+[。！？]?/gu)||[]).map(x=>x.trim()).filter(Boolean);}
export function createDialoguePlayer({$,speak,cancelSpeech=()=>{},record,onChange,onUtterance,onComplete,isPaused=()=>false}){
 let lines=[],index=0,speaker='',nodeId=null,sequence=false,busy=false,run=0,timer=null,interrupted=false;
 const previous=$('linePrevious'),next=$('lineNext');
 const delay=ms=>new Promise(resolve=>{timer=setTimeout(resolve,ms);});
 const item=()=>sequence?lines[index]:{speaker,text:lines[index]||''};
 const name=()=>sequence?(item()?.speaker==='patient'?'陈女士':'林治疗师'):speaker;
 function state(){return{index,total:lines.length,pending:busy||index<lines.length-1,text:item()?.text||'',sequence};}
 function emit(){document.body.dataset.dialoguePending=String(state().pending);onChange?.();onUtterance?.({...state(),nodeId,speaker:name()});}
 function invalidate(){run++;clearTimeout(timer);timer=null;cancelSpeech();}
 async function paint(announce=true){
  invalidate();const token=run;busy=announce;const text=item()?.text||'',person=name();$('line').textContent=text;
  if(sequence){const patient=item()?.speaker==='patient';$('speaker').textContent=person;$('speakerAvatar').textContent=patient?'陈':'林';$('conversation').dataset.speaker=patient?'patient':'therapist';$('dialogueKind').textContent=patient?'患者':'治疗师';}
  $('lineCount').textContent=lines.length>1?`${index+1} / ${lines.length} · 自动对话`:'';previous.hidden=index===0;next.hidden=true;emit();
  if(!announce)return;
  if(isPaused()||document.hidden){interrupted=true;return;}
  record('clinic3d_dialogue_segment',{nodeId,index,text,speaker:person,automatic:true});
  const start=performance.now();await speak(person,text);if(token!==run)return;
  await delay(Math.max(0,1500-(performance.now()-start)));if(token!==run)return;
  if(isPaused()||document.hidden){interrupted=true;return;}
  if(index<lines.length-1){index++;paint();return;}
  busy=false;emit();onComplete?.({nodeId,sequence});
 }
 const pauseWatcher=setInterval(()=>{const paused=isPaused()||document.hidden;if(paused&&busy&&!interrupted){interrupted=true;invalidate();}else if(!paused&&interrupted){interrupted=false;paint();}},100);
 previous.addEventListener('click',()=>{index=Math.max(0,index-1);interrupted=false;paint();});
 next.addEventListener('click',()=>{if(index<lines.length-1){index++;paint();}});
 return{
  load(text,name,id){sequence=false;lines=splitDialogue(text);index=0;speaker=name;nodeId=id;interrupted=false;paint();},
  loadSequence(turns,id,{startIndex=0,announce=true}={}){sequence=true;lines=turns.flatMap(t=>splitDialogue(t.text).map(text=>({speaker:t.speaker,text})));index=Math.max(0,Math.min(startIndex,lines.length-1));nodeId=id;interrupted=false;paint(announce);},
  finishSequence(){invalidate();busy=false;interrupted=false;index=Math.max(0,lines.length-1);emit();onComplete?.({nodeId,sequence});},
  advance(){if(index<lines.length-1){index++;paint();return true;}return false;},replay(){interrupted=false;paint();},getState:state,
  stop(){invalidate();busy=false;interrupted=false;},dispose(){invalidate();clearInterval(pauseWatcher);}
 };
}
