/* Keeps both tested apps in their own documents to avoid global/CSS/WebGL collisions. */
(function(){'use strict';
 const H=window.DXXHub,isGame=!!window.AssemblyGame,kind=isGame?'assembly':'lab';let active=false;
 function leave(to){
  if(isGame&&window.AssemblyGame){const s=AssemblyGame.getState();if(s.page==='game'&&!s.complete&&!s.explore){if(!confirm('返回前保存当前已完成的拼接记录？未完成项目按部分完成记录。'))return;}AssemblyGame.hubLeave();}
  if(!isGame&&window.App){App.pause();App.closeEmbedded?.();App.save();if(App.state.clinic)App.state.clinic.active=false;}
  location.href=to;
 }
 const bar=document.createElement('div');bar.className='hub-linkbar';bar.dataset.app=kind;
 const brand=document.createElement('strong');brand.textContent='动小学 · 统一学习平台';bar.appendChild(brand);
 const user=document.createElement('span');user.className='hub-user';bar.appendChild(user);
 const nav=document.createElement('nav');
 const links=[['← 统一首页','index.html#home'],[isGame?'进入虚拟实验室':'进入骨肌拼接',isGame?'lab/index.html':'assembly/index.html'],['结束与合并导出','index.html#finish']];
 for(const [text,path]of links){const a=document.createElement('a');a.textContent=text;a.href=new URL(path,H.root).href;a.onclick=e=>{e.preventDefault();leave(a.href);};nav.appendChild(a);}bar.appendChild(nav);document.body.prepend(bar);
 function init(){
  if(active)return;const p=H.profile();user.textContent=p?p.name+' · 学号 '+p.studentId:'未共享登记信息，可返回统一首页登记';
  if(isGame){active=true;if(p){const n=document.getElementById('nickname');n.value=p.name;n.readOnly=true;n.title='姓名来自统一入口，切换学生请返回统一首页。';}
   const task=new URL(location.href).searchParams.get('task');if(['bone','muscle'].includes(task)){
    document.querySelectorAll('#chapters [data-task]').forEach(b=>{if(b.dataset.task!==task)b.hidden=true;});
    const h=document.querySelector('.section-heading h2');if(h)h.textContent=task==='bone'?'选择骨骼拼接部位':'选择肌肉安放部位';
   }
   window.DXX_BRIDGE_READY=true;return;
  }
  if(!window.App||!window.Portal||window.DXX_DEPLOY_DIAGNOSTICS?.state!=='ready')return;
  active=true;
  if(p){const err=Portal.validate(p.name,p.studentId,p.teacher);if(typeof err!=='string'){
   document.getElementById('studentName').value=p.name;document.getElementById('studentId').value=p.studentId;document.getElementById('teacherName').value=p.teacher;
   document.getElementById('loginForm').requestSubmit();
   if(Portal.access)openRequestedLesson();
  }}
  for(const id of ['switchStudent','finishLogout']){const b=document.getElementById(id);if(b)b.onclick=()=>{Portal.logout();H.clear();H.go('login');};}
  // Existing validated login continues to work when the app is opened directly.
  window.addEventListener('dxx:student-ready',()=>{if(Portal.access&&App.state.profile){H.set(App.state.profile);user.textContent=App.state.profile.name+' · 学号 '+App.state.profile.studentId;openRequestedLesson();}});
  window.DXX_BRIDGE_READY=true;
 }
 function openRequestedLesson(){const requested=Number(new URL(location.href).searchParams.get('lesson'));if(requested>=1&&requested<=13){App.openLesson(requested);return;}const params=new URL(location.href).searchParams,id=Number(params.get('experiment'));if(params.get('topic')==='muscles'){App.openLesson(201);return;}if(Number.isInteger(id)&&id>=1&&id<=13){App.openLesson(id);if(params.get('dynamic')==='1'){const a=App.state.module?.actions.find(a=>a.kind==='embedded');if(a)App.selectAction(a.id);}return;}App.home();}
 init();window.addEventListener('dxx:lab-ready',init);
 if(!active){const interval=setInterval(()=>{init();if(active||window.DXX_DEPLOY_DIAGNOSTICS?.state==='error')clearInterval(interval);},250);setTimeout(()=>clearInterval(interval),300000);}
})();
