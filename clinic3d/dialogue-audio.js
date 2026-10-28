// Local prerecorded Chinese voices. No key, upload or paid request.
export function createDialogueAudio({enabled,onTalking,onStatus}){
 const audio=new Audio();audio.id='dialogueVoice';audio.hidden=true;document.body.append(audio);audio.preload='auto';let stopCurrent=null,revision=0;
 const manifest=fetch(new URL('./assets/dialogue-v20/manifest.json',import.meta.url)).then(r=>r.ok?r.json():{clips:{}}).catch(()=>({clips:{}}));
 const role=name=>/^(陈女士|患者)$/.test(name)?'patient':'therapist';
 function cancel(){revision++;audio.pause();audio.onended=null;audio.onerror=null;stopCurrent?.();stopCurrent=null;onTalking(null);}
 function unlock(){if(audio.currentSrc)return;audio.src='data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==';audio.play().catch(()=>{});}
 async function speak(name,text){
  cancel();const token=revision,r=role(name);if(!enabled()||!text)return {muted:true};
  const table=await manifest;if(token!==revision)return{cancelled:true};const entry=table.clips[r+'|'+text];
  if(!entry){onStatus('这句暂无录音，字幕继续。');return{missing:true};}
  return new Promise(resolve=>{
   let done=false;const finish=result=>{if(done)return;done=true;if(token===revision){onTalking(null);stopCurrent=null;}resolve(result);};
   stopCurrent=()=>finish({cancelled:true});audio.dataset.role=r;audio.dataset.text=text;audio.src=new URL(entry.src,import.meta.url).href;
   audio.onended=()=>finish({played:true});audio.onerror=()=>{onStatus('声音暂未载入，字幕继续。');finish({failed:true});};
   audio.play().then(()=>{if(token===revision){audio.dataset.playStatus='playing';onStatus('');onTalking(r);}}).catch(error=>{audio.dataset.playStatus=error.name;onStatus(error.name==='NotAllowedError'?'浏览器已阻止声音；点击任意接诊操作后可恢复。':'声音暂未载入，字幕继续。');finish({blocked:true});});
  });
 }
 document.addEventListener('pointerdown',unlock,{once:true,capture:true});
 return{speak,cancel,unlock};
}
