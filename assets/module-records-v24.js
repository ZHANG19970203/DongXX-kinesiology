import {createUsageTracker} from './usage-v23.js';
// Supplement auxiliary modules. Clinic, SOAP and restored lab have their own detailed collectors.
if(!/\/(clinic3d|soap|lab|teacher|painting)\//.test(location.pathname)&&window.top===window){
 let session=null,token=null,key='',queue=[],starting=false,flushing=false;
 const module=()=>({'/painting/':'肌肉彩绘','/certificate/':'学习荣誉','/assembly/':'骨肌拼接','/pressure/':'足底压力探究','/topics/':'运动机制专题','/learning/':'学习目标与自测','/project-guide/':'项目导引'}[Object.keys({'/painting/':1,'/certificate/':1,'/assembly/':1,'/pressure/':1,'/topics/':1,'/learning/':1,'/project-guide/':1}).find(p=>location.pathname.includes(p))]||'学习首页');
 const save=()=>{if(session)localStorage.setItem('dxx_activity_queue_'+session.id,JSON.stringify(queue));};
 async function post(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Learner-Token':token}:{})},body:JSON.stringify(data)});if(!r.ok)throw Error('sync');return r.json();}
 function record(type,payload){if(!session)return;queue.push({id:crypto.randomUUID(),sessionId:session.id,type,at:new Date().toISOString(),payload});save();}
 async function start(){const p=window.DXXHub?.profile?.();if(!p||starting)return;if(session&&key===p.teacher+'|'+p.studentId)return;starting=true;try{key=p.teacher+'|'+p.studentId;session=null;const k='dxx_activity_session_'+key;let s=JSON.parse(localStorage.getItem(k)||'null');if(!s){s={id:'activity.'+crypto.randomUUID(),caseId:'cai',startedAt:new Date().toISOString(),student:p};localStorage.setItem(k,JSON.stringify(s));}token=localStorage.getItem('dxx_learning_capability_v15_'+s.id);const d=await post('/api/learning/start',{session:s});token=d.accessToken;localStorage.setItem('dxx_learning_capability_v15_'+s.id,token);session=s;queue=JSON.parse(localStorage.getItem('dxx_activity_queue_'+s.id)||'[]');record('learning_module_open',{module:module(),page:location.pathname});}catch{session=null;}finally{starting=false;}}
 async function flush(){if(!session||flushing||!queue.length)return;flushing=true;const batch=queue.slice(0,50);try{await post('/api/learning/events',{session,events:batch});queue=queue.filter(e=>!batch.some(b=>b.id===e.id));save();return true;}catch{return false;}finally{flushing=false;}}
 window.DXXModuleRecords={save:async(type,payload)=>{await start();if(!session)return false;record(type,payload);return await flush()===true;}};
 const tracker=createUsageTracker({enabled:()=>!!session&&!!window.DXXHub?.profile?.(),getModule:module,record});
 document.addEventListener('click',e=>{const b=e.target.closest('button,a');if(b&&!b.closest('.dxx-assistant')&&!b.closest('#entryForm'))record('learning_module_action',{module:module(),control:(b.getAttribute('aria-label')||b.textContent||'').trim().slice(0,120),page:location.pathname});});
 setInterval(()=>{start();flush();},5000);window.addEventListener('pagehide',()=>{tracker.flush();save();});start();
}
