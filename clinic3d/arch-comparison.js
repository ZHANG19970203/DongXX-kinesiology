import { renderArchComparison } from './pressure-engine.js';
import { GAIT_CASE, sampleGait } from './gait-lesson.js';
import { ARCH_LESSON, ARCH_PROFILES, ARCH_QUESTIONS, ARCH_SOURCE_LINKS } from './arch-knowledge.js';

// Independent exploratory timeline: never replaces the patient case or grants a task receipt.
export const GAIT_REFERENCE=Object.freeze({...GAIT_CASE,id:'authored-symmetry-reference-v13',label:'对称教学参考',
 affectedSide:null,sourceType:'authored_controlled_reference',
 stance:Object.freeze({right:.60,left:.60}),stepLength:Object.freeze({right:.44,left:.44}),leftContactPhase:.50,
 limitations:Object.freeze(['本例对称参数用于理解双侧时空关系，不是临床正常值范围。','与病例共享周期、步速和步宽，不代表所有正常行走者均取这些值。'])});

export function createArchComparison(ctx){
 const {nodeEl,button,record}=ctx;
 const overlay=nodeEl('aside','arch-overlay');overlay.id='archComparison';overlay.hidden=true;
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','archComparisonTitle');
 const shell=nodeEl('section','arch-shell'),head=nodeEl('header','arch-heading'),identity=nodeEl('div');
 identity.append(nodeEl('small','arch-eyebrow','足踝生物力学 · 合成教学对照'));
 const heading=nodeEl('h2','','足弓不同，负荷怎样分配？');heading.id='archComparisonTitle';identity.append(heading);
 const closeButton=button('返回接诊',close);closeButton.id='archClose';head.append(identity,closeButton);
 const navigation=nodeEl('nav','arch-tabs');navigation.setAttribute('aria-label','对照学习内容');
 const body=nodeEl('div','arch-content');shell.append(head,navigation,body);overlay.append(shell);document.body.append(overlay);
 let tab='compare',mode='maximum',phase=.28,running=false,lastTime=0,frameId=0,lastFocus=null,lastPaint=0;
 const answers=new Map();
 for(const [id,label]of [['compare','正常与低足弓对照'],['high','高足弓拓展'],['gait','步态参考']]){
  const b=button(label,()=>{tab=id;running=false;render();record('clinic3d_comparison_tab',{tab,independentExtension:true});});b.dataset.archTab=id;navigation.append(b);
 }
 const text=(tag,cls,value)=>nodeEl(tag,cls,value);
 function open(options={}){
  if(!overlay.hidden)return;lastFocus=document.activeElement;ctx.pauseTask();tab=options.tab||'compare';running=false;
  overlay.hidden=false;ctx.clinic.inert=true;render();closeButton.focus();lastTime=0;frameId=requestAnimationFrame(tick);
  record('clinic3d_arch_comparison_open',{tab,source:'authored-controlled-comparison',patientCaseUnchanged:true});
 }
 function close(){overlay.hidden=true;running=false;cancelAnimationFrame(frameId);ctx.clinic.inert=false;if(lastFocus?.isConnected)lastFocus.focus();record('clinic3d_arch_comparison_close',{tab,patientCaseUnchanged:true});}
 function tick(t){
  if(overlay.hidden)return;const dt=lastTime?Math.min((t-lastTime)/1000,.1):0;lastTime=t;
  if(running){phase=Math.min(1,phase+dt/(tab==='gait'||mode==='dynamic'?4.8:8));if(phase>=1)running=false;if(t-lastPaint>90||!running){paint();lastPaint=t;}}
  frameId=requestAnimationFrame(tick);
 }
 function timeline(parent){
  const row=nodeEl('div','arch-timeline'),play=button(running?'暂停对照':'播放对照',()=>{if(phase>=1)phase=0;running=!running;paint();});play.id='archPlay';
  const label=text('label','','同一时刻回看');label.htmlFor='archPhase';const slider=document.createElement('input');Object.assign(slider,{type:'range',id:'archPhase',min:'0',max:'1',step:'.001',value:String(phase)});slider.setAttribute('aria-label','对照进度');
  slider.addEventListener('input',()=>{running=false;phase=Number(slider.value);paint();});
  slider.addEventListener('change',()=>record('clinic3d_arch_comparison_scrub',{tab,mode,phase,independentExtension:true}));
  const status=text('span','arch-time','');status.id='archTime';row.append(play,label,slider,status);parent.append(row);
 }
 function render(){
  heading.textContent=tab==='gait'?'同一周期，看双侧差异':tab==='high'?'高足弓：接触少，负荷去哪了？':'足弓不同，负荷怎样分配？';
  for(const b of navigation.querySelectorAll('button')){b.classList.toggle('selected',b.dataset.archTab===tab);b.setAttribute('aria-pressed',String(b.dataset.archTab===tab));}
  body.replaceChildren();body.scrollTop=0;
  if(tab==='compare')renderCompare();else if(tab==='high')renderHigh();else renderGait();
 }
 function renderCompare(){
  body.append(text('p','arch-lead','把任务、足侧、时刻与色标保持相同，才看得清足弓条件带来的分布差异。'));
  const modes=nodeEl('div','arch-modes');for(const [id,label]of [['static','静态站立'],['dynamic','行走瞬时'],['maximum','最大压力复合图']]){
   const b=button(label,()=>{mode=id;running=false;phase=.28;render();record('clinic3d_arch_comparison_mode',{mode,patientCaseUnchanged:true});});b.dataset.archMode=id;b.classList.toggle('selected',mode===id);b.setAttribute('aria-pressed',String(mode===id));modes.append(b);
  }body.append(modes);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='archDiagram';svg.setAttribute('role','img');body.append(svg);
  if(mode!=='maximum')timeline(body);
  body.append(text('p','arch-difference','观察中足：本教学设定中，低足弓覆盖较宽，高足弓接触较少。再看足跟与前足的局部负荷。'));
  const why=nodeEl('details','arch-meaning');why.append(text('summary','','这两项占比怎么看？'),text('p','','有色覆盖占比：中足有色区域占本图全足有色区域的比例。当前载荷占比：中足承担的合成载荷占本足当前总量的比例。峰值复合图来自不同时刻，不计算瞬时载荷占比。'));body.append(why);
  body.append(text('p','arch-coach-note','动小助：先比较中足，再切到行走看负荷转移。高足弓也参与对照；点“高足弓拓展”继续探究。'));
  body.append(text('p','arch-boundary','三图均为同条件的合成教学设定。正常足弓为参考形态，不是每个人都应达到的标准；本窗不改变陈女士的病例或三维足形。'));
  paint();
 }
 function paint(){
  const play=body.querySelector('#archPlay'),slider=body.querySelector('#archPhase'),status=body.querySelector('#archTime');if(play)play.textContent=running?'暂停对照':'播放对照';if(slider)slider.value=String(phase);
  if(tab==='compare'){
   const svg=body.querySelector('#archDiagram');if(!svg)return;
   const compared=renderArchComparison(svg,{mode,phase,side:'right',width:720,height:350});
   const hint=body.querySelector('.arch-difference'),foot=compared.profiles[0].foot;
   if(hint)hint.textContent=mode==='dynamic'&&!foot.contact?'当前右足在摆动，没有接触载荷。把进度拖回支撑期，再比较三种足弓。':mode==='dynamic'&&!foot.load?'此刻刚接触，尚未形成正载荷。重新播放或回看接触后的承重。':'观察中足：本教学设定中，低足弓覆盖较宽，高足弓接触较少。再看足跟与前足的局部负荷。';
   if(status)status.textContent=mode==='dynamic'?`同一周期 ${Math.round(phase*100)}% · ${sampleGait(phase).right.contact?'右足支撑':'右足摆动'}`:`站立观察 ${(phase*8).toFixed(1)} s`;
  }else if(tab==='gait'){drawGait();if(status)status.textContent=`同一周期 ${Math.round(phase*100)}% · ${(phase*1.2).toFixed(2)} s`;}
 }
 function renderHigh(){
  body.append(text('p','arch-lead',ARCH_LESSON.highArchSummary||'高足弓不是“足弓越高越好”。先看接触分布，再结合症状、活动与足部柔韧性。'));
  const grid=nodeEl('div','arch-knowledge-grid');
  for(const [title,value]of [['看哪里','中足接触可能较少，足跟或前足的局部负荷可能更集中。'],['为什么关心','走路不适、局部磨压或反复扭伤，需要结合活动和检查理解。'],['还需知道','不能用一张足印定诊断，也不能预设每位高足弓者的COP都向外偏。']]){const c=nodeEl('section','arch-knowledge-card');c.append(text('h3','',title),text('p','',value));grid.append(c);}body.append(grid);
  const investigate=button('回到三种足弓，比较中足',()=>{tab='compare';mode='maximum';render();});investigate.className='arch-primary';body.append(investigate);
  body.append(text('h3','arch-subtitle','用三个小问题巩固理解'));
  for(const q of ARCH_QUESTIONS){
   const field=nodeEl('fieldset','arch-question');field.append(text('legend','',q.prompt));
   const feedback=text('p','arch-answer','');feedback.setAttribute('role','status');
   const selected=answers.get(q.id);
   for(const option of q.options){const b=button(option.label,()=>{answers.set(q.id,option.id);record('clinic3d_arch_extension_answer',{questionId:q.id,optionId:option.id,conceptFeedbackOnly:true,notClinicalScore:true});render();body.querySelector(`[data-arch-question="${q.id}"][data-arch-answer="${option.id}"]`)?.focus();});b.dataset.archQuestion=q.id;b.dataset.archAnswer=option.id;if(selected===option.id)b.classList.add('selected');b.setAttribute('aria-pressed',String(selected===option.id));field.append(b);}
   if(selected){const chosen=q.options.find(o=>o.id===selected);feedback.textContent=chosen.feedback;feedback.dataset.correct=String(chosen.correct);field.append(feedback);}body.append(field);
  }
  const sources=nodeEl('details','arch-meaning');sources.append(text('summary','','进一步阅读'));
  for(const source of ARCH_SOURCE_LINKS){const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener';link.textContent=source.title;sources.append(link);}body.append(sources);
  body.append(text('p','arch-boundary','高足弓是独立知识拓展。疼痛、反复扭伤、明显不对称或进行性变化，应结合进一步评估；本窗不提供统一矫形或训练处方。'));
 }
 function renderGait(){
  body.append(text('p','arch-lead','先看左右相对对称的参考，再与本例的双侧差异对照。两者共用1.20秒周期与步速，只改变这次示例的步长和接触时序。'));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='archGaitDiagram';svg.setAttribute('viewBox','0 0 760 260');svg.setAttribute('role','img');svg.setAttribute('aria-label','对称教学参考与本病例双侧支撑摆动的同周期对照');body.append(svg);timeline(body);
  const table=document.createElement('table');table.className='arch-gait-table';const rows=[['本次设定','正常行走的对称教学参考','本病例'],['右 / 左步长','44 / 44 cm','48 / 40 cm'],['右 / 左支撑期','60% / 60%','56% / 64%'],['右 / 左摆动期','40% / 40%','44% / 36%'],['跨步长 · 步宽','88 cm · 14 cm','88 cm · 14 cm'],['步速 · 步频','0.73 m/s · 100步/分','0.73 m/s · 100步/分']];
  for(const [index,row]of rows.entries()){const tr=document.createElement('tr');for(const value of row)tr.append(text(index?'td':'th','',value));table.append(tr);}body.append(table);
  body.append(text('p','arch-coach-note','动小助：拖动同一时间点，查看左右足是在支撑还是摆动。观察到差异后，还要结合患者感受和其他检查。'));
  body.append(text('p','arch-boundary','参考数值是为了理解对称与差异而编写，不是正常值范围或慢性踝不稳的统一步态。此图不计算全身重心，也不表示低足弓必然产生本例的时间差。'));paint();
 }
 function drawGait(){
  const svg=body.querySelector('#archGaitDiagram');if(!svg)return;svg.replaceChildren();
  const add=(tag,attrs,value)=>{const e=document.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(value!=null)e.textContent=value;svg.append(e);return e;};
  for(const [group,profile]of [GAIT_REFERENCE,GAIT_CASE].entries()){
   const sample=sampleGait(phase,profile);add('text',{x:12,y:23+group*120,fill:'#244a61','font-size':14,'font-weight':700},group?'本病例 · 右患侧 / 左健侧':'正常行走 · 对称教学参考');
   for(const [i,side]of ['right','left'].entries()){
    const y=38+group*120+i*38,s=sample[side],initial=side==='right'?0:profile.leftContactPhase,end=initial+profile.stance[side];
    add('text',{x:12,y:y+16,fill:'#607d8b','font-size':12},(side==='right'?'右足':'左足')+' · '+s.label);add('rect',{x:125,y,width:600,height:20,rx:4,fill:'#e4ecf0'});
    const spans=end>1?[[0,end-1],[initial,1]]:[[initial,end]];for(const [from,to]of spans)add('rect',{x:125+600*from,y,width:600*(to-from),height:20,rx:4,fill:group?'#ae7f4f':'#367c9b'});
   }
  }
  add('line',{x1:125+600*phase,x2:125+600*phase,y1:31,y2:219,stroke:'#c69b3b','stroke-width':2});add('text',{x:125,y:247,'font-size':11,fill:'#58798a'},'深色：支撑期　浅色：摆动期　｜　同一时间轴 0—100%');
 }
 document.addEventListener('keydown',event=>{
  if(overlay.hidden)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
  if(event.key==='Tab'){const nodes=[...overlay.querySelectorAll('button,a,input,summary')].filter(e=>!e.disabled&&e.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 },true);
 return {open,close,isOpen:()=>!overlay.hidden};
}
