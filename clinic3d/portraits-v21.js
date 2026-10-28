
const person=document.getElementById('speaker'),image=document.getElementById('speakerPortrait');
function update(){const t=person.textContent,role=/陈女士|患者/.test(t)?'patient':/林治疗师|治疗师/.test(t)?'therapist':null;image.hidden=!role;if(role){image.src='../soap/media/portrait-'+role+'.jpg';image.dataset.role=role;image.alt=role==='patient'?'陈女士 · 视频肖像':'林治疗师 · 视频肖像';}}
new MutationObserver(update).observe(person,{childList:true,characterData:true,subtree:true});update();
