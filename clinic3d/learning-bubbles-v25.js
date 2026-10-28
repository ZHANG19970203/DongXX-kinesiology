const topics=[
 {id:'muscle',re:/肌肉|腓骨.{0,2}肌|胫骨前肌|收缩|肌群|离心|向心/,title:'肌肉怎样把骨骼带动起来？',note:'看看起止点，再试试把它画出来。',act:'act3',lab:3,muscle:'fibLong'},
 {id:'joint',re:/关节|背屈|跖屈|量角|运动轴|运动面/,title:'转动模型，找到运动的轴与面。',note:'为什么要在相同体位下比较？',act:'act2',lab:10,muscle:'tibAnt'},
 {id:'arch',re:/足弓|脚弓|足形|扁平/,title:'三条足弓，怎样一起承重？',note:'看结构，再区分足形与症状。',act:'act4',lab:10,muscle:'tibPost'},
 {id:'gait',re:/步态|支撑|摆动|步长|步速|步宽/,title:'把行走放慢，找一个完整周期。',note:'支撑期、摆动期和双侧差异在哪里？',act:'act5',lab:13,muscle:'gastrocnemius'},
 {id:'cop',re:/COP|压力中心|重心|平衡|轨迹/,title:'压力中心，等于身体重心吗？',note:'一起比较足下轨迹与身体运动。',act:'act7',lab:12,muscle:'soleus'},
 {id:'evidence',re:/证据|复评|计划|因果/,title:'这些发现，能支持什么结论？',note:'把已知、未知和下一步分开想。',act:'act8',lab:10,muscle:'tibAnt'}
];
export function installLearningBubbles({pause,record,persist,openConcept}){
 const style=document.createElement('link');style.rel='stylesheet';style.href='learning-bubbles-v25.css';document.head.append(style);
 const bubble=document.createElement('aside');bubble.className='learning-bubble-v25';bubble.hidden=true;bubble.setAttribute('aria-label','可选的知识探索');
 bubble.innerHTML='<button class="bubble-dismiss" aria-label="暂时忽略这条学习提示">×</button><div class="bubble-heading"><img src="../soap/media/portrait-therapist.jpg" alt="动小助"><span>动小助<small>可以探索，也可以继续倾听</small></span></div><strong></strong><p></p><div class="bubble-links"><button data-model>看三维与概念</button><button data-paint>试试肌肉彩绘</button><button data-lab>进入相关实验 ↗</button></div>';
 document.body.append(bubble);let current=null,last='',dismissed=new Set(),resume=null,frame=null;
 const overlay=document.createElement('dialog');overlay.className='free-study-v25';overlay.innerHTML='<header><div><b>自由学习空间</b><small>诊室停在刚才的位置，学完随时返回。</small></div><button data-return>回到刚才的交流 ×</button></header><div class="free-study-frame"></div>';document.body.append(overlay);
 function close(){if(overlay.open)overlay.close();}
 overlay.addEventListener('close',()=>{frame?.remove();frame=null;resume?.();resume=null;record('clinic3d_free_study_return',{topic:current?.id});});overlay.querySelector('[data-return]').onclick=close;
 function open(path){persist();resume=pause();overlay.querySelector('b').textContent=current.title;frame=document.createElement('iframe');frame.title=current.title;frame.src=path;overlay.querySelector('.free-study-frame').replaceChildren(frame);overlay.showModal();overlay.querySelector('[data-return]').focus();record('clinic3d_free_study_open',{topic:current.id,path,notAssessmentCredit:true});}
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='dxx:study-return')close();if(e.data?.type==='dxx:study-assistant'){close();window.DXXAssistant?.open({objective:'LAB03'});}});
 bubble.querySelector('.bubble-dismiss').onclick=()=>{dismissed.add(last);bubble.hidden=true;record('clinic3d_concept_ignore',{topic:current?.id,notAssessmentCredit:true});};
 bubble.querySelector('[data-model]').onclick=()=>{openConcept(current.act);record('clinic3d_bubble_model_open',{topic:current.id});};bubble.querySelector('[data-paint]').onclick=()=>open('../painting/index.html?embedded=1&muscle='+current.muscle);
 bubble.querySelector('[data-lab]').onclick=()=>open('../lab/index.html?lesson='+current.lab+'&embedded=1');
 return {utterance(info){const t=topics.find(t=>t.re.test(info.text||''));if(!t)return;const id=info.nodeId+'|'+t.id;if(id===last||dismissed.has(id))return;last=id;current=t;bubble.querySelector('strong').textContent=t.title;bubble.querySelector('p').textContent=t.note;bubble.hidden=false;},hide(){bubble.hidden=true;},isOpen:()=>overlay.open};
}
