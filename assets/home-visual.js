/* Optional decorative motion. No analytics, scores or identity changes. */
(function(){'use strict';
 const root=document.documentElement,key='dxx_home_motion_v1',mql=window.matchMedia('(prefers-reduced-motion: reduce)');
 let enabled=!mql.matches,explicit=false;
 try { const choice=localStorage.getItem(key); if(choice!==null){enabled=choice==='on';explicit=true;} } catch (_) {}
 function sync(){
   const reduced=mql.matches;
   root.dataset.homeMotion=(enabled&&!reduced)?(document.hidden?'sleep':'on'):'off';
   document.querySelectorAll('[data-motion-toggle]').forEach(btn=>{
     const active=enabled&&!reduced;
     btn.setAttribute('aria-pressed',String(!active));
     btn.setAttribute('aria-label',reduced?'系统已减少动态效果':active?'暂停背景动效':'开启背景动效');
     btn.querySelector('[data-motion-label]').textContent=reduced?'静态展示':active?'暂停动效':'开启动效';
     btn.querySelector('[data-motion-symbol]').textContent=active?'Ⅱ':'▷';
     btn.disabled=reduced;
   });
 }
 document.querySelectorAll('[data-motion-toggle]').forEach(btn=>btn.addEventListener('click',()=>{
   enabled=!enabled;explicit=true;try{localStorage.setItem(key,enabled?'on':'off');}catch(_){}sync();
 }));
 if(mql.addEventListener)mql.addEventListener('change',()=>{if(!explicit)enabled=!mql.matches;sync();});
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('dxx:hubview',sync);
 document.querySelectorAll('[data-scroll-projects]').forEach(btn=>btn.addEventListener('click',()=>{
   document.getElementById('learningProjects')?.scrollIntoView({behavior:mql.matches?'auto':'smooth',block:'start'});
 }));
 document.addEventListener('click',e=>{document.querySelectorAll('.header-more[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;});});
 // Cosmetic image is optional: a pale background keeps the form usable on asset failure.
 document.querySelectorAll('.scene-art').forEach(img=>img.addEventListener('error',()=>{img.style.visibility='hidden';img.closest('.motion-scene')?.classList.add('art-unavailable');}));
 window.DXXHomeVisual={state:()=>({enabled:enabled&&!mql.matches,paused:root.dataset.homeMotion!=='on',reducedMotion:mql.matches,view:document.body.dataset.hubView}),setEnabled:(value)=>{enabled=!!value;explicit=true;try{localStorage.setItem(key,enabled?'on':'off');}catch(_){}sync();}};
 sync();
})();
