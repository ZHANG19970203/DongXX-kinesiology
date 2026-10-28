// Visible, recently engaged time estimate, not attention detection or a grade.
export function createUsageTracker({enabled=()=>true,getModule=()=>location.pathname,record}){
 let last=Date.now(),activeAt=Date.now(),module=getModule(),visible=!document.hidden;
 const flush=()=>{const now=Date.now(),next=getModule(),seconds=(now-last)/1000;
  if(enabled()&&visible&&now-activeAt<120000&&seconds>0&&seconds<=30)record('learning_active_interval',{module:String(module),from:new Date(last).toISOString(),to:new Date(now).toISOString(),seconds,method:'visible_recent_input_120s_v23'});
  last=now;module=next;visible=!document.hidden;};
 const touch=()=>{activeAt=Date.now();};for(const type of ['pointerdown','keydown','wheel','touchstart'])document.addEventListener(type,touch,{passive:true});
 document.addEventListener('visibilitychange',flush);window.addEventListener('pagehide',flush);
 const timer=setInterval(flush,10000);return{flush,dispose(){flush();clearInterval(timer);document.removeEventListener('visibilitychange',flush);window.removeEventListener('pagehide',flush);}};
}
