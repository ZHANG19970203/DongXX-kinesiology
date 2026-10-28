import {renderSOAPTask} from './soap-tasks-v20.js';
import { createLessonCoach } from './lesson-coach.js';
import { createArchComparison } from './arch-comparison.js';
import { createAnatomyViewer } from './anatomy-viewer.js';
import { GAIT_CASE, sampleGait, isGaitEventMatch } from './gait-lesson.js';
import { MUSCLE_ITEMS } from './case-muscle-v14.js';

// Teaching presentation only. Operation receipts are owned by app.js.
export function createLearningUI(ctx) {
  const {$,state,catalog,stepBook,getCurrent,record,nodeEl,button}=ctx;
  const coach=createLessonCoach({...ctx,eventMatches:isGaitEventMatch});
  const comparison=createArchComparison({nodeEl,button,record,clinic:$('clinic'),pauseTask(){ctx.pauseTask();paintTask();}});
  $('archExplore').addEventListener('click',()=>{$('settings').hidden=true;comparison.open();});
  let anatomy=null,anatomyLoading=null,lastFocus=null;
  const overlay=nodeEl('aside','anatomy-overlay');
  overlay.id='anatomyOverlay';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','anatomyTitle');
  const shell=nodeEl('section','anatomy-shell'),head=nodeEl('header','anatomy-heading'),title=nodeEl('h2','','足踝解剖观察窗');title.id='anatomyTitle';
  const close=button('返回接诊',closeAnatomy);head.append(title,close);
  const intro=nodeEl('p','anatomy-intro','转动骨骼，找一找小腿与足部如何相接。这里观察的是解剖结构。');
  const host=nodeEl('div','anatomy-host');host.id='anatomyHost';
  shell.append(head,intro,host);overlay.append(shell);document.body.append(overlay);
  const motionCue=nodeEl('div','scene-caption');motionCue.id='motionCue';motionCue.hidden=true;motionCue.setAttribute('role','status');$('clinic').append(motionCue);
  function text(id,value){if($(id))$(id).textContent=value||'';}
  function show(id,on){if($(id))$(id).hidden=!on;}
  function facts(){return getCurrent();}
  function addSource(wrap,textValue){wrap.append(nodeEl('p','task-source',textValue));}
  function anatomyButton(wrap,focus='ankle'){const b=button('踝足运动 · 轴面与肌肉',()=>openAnatomy(focus));b.className='anatomy-open';wrap.append(b);}
  async function openAnatomy(focus='ankle'){
    lastFocus=document.activeElement;ctx.pauseTask();paintTask();overlay.hidden=false;$('clinic').inert=true;close.focus();
    try {
      if(!anatomyLoading)anatomyLoading=createAnatomyViewer(host).then(v=>anatomy=v).catch(error=>{anatomyLoading=null;throw error;});
      const viewer=await anatomyLoading;
      if(overlay.hidden)return;
      viewer.setVisible?.(true);viewer.resize?.();viewer.setFocus?.(focus);
      record('clinic3d_anatomy_open',{focus,source:'BodyParts3D-Somakine-static-anatomy',notPatientMeasurement:true});
    } catch(error){host.replaceChildren(nodeEl('p','task-description','解剖资源暂未载入。请返回接诊，稍后再试；不会把这次载入算作完成检查。'));console.error('Anatomy viewer:',error);}
  }
  function closeAnatomy(){overlay.hidden=true;anatomy?.setVisible?.(false);$('clinic').inert=false;lastFocus?.focus();}
  document.addEventListener('keydown',event=>{
    if(overlay.hidden)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeAnatomy();}
    if(event.key==='Tab'){
      const all=[...overlay.querySelectorAll('button,a,input,select,canvas[tabindex]')].filter(e=>!e.disabled&&e.getClientRects().length);
      const first=all[0],last=all.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  },true);
  function presentNode(node){
    const edu=node.education||node.task?.education||{};
    const patient=/^(陈女士|患者)$/.test(node.speaker||'');
    const therapist=/^(林治疗师|治疗师)$/.test(node.speaker||'');
    $('conversation').dataset.speaker=patient?'patient':therapist?'therapist':'student';
    text('speakerAvatar',patient?'陈':therapist?'林':'你');
    text('dialogueKind',node.kind==='summary'?'共同复盘':patient?'听听患者怎么说':therapist?'治疗师的解释':'轮到你来回应');
    text('careCue',edu.care);show('careCue',false);
    show('taskDock',!!node.task&&!['history','evidence'].includes(node.task.type));
    const docked=!!node.task&&!['history','evidence'].includes(node.task.type),options=$('options');
    if(docked)$('taskDock').querySelector('.dock-content').append(options);
    else $('conversation').insertBefore(options,$('conversation').querySelector('.conversation-foot'));
    text('dockTitle',({gait:'步态对照',goniometer:'踝足活动',trial:'试次比较',muscle:'动作与肌群',arch:'静态足弓',pressure:'足底负荷',balance:'平衡准备',plan:'共同计划'})[node.task?.type]||'观察与操作');
    text('whyTitle','为什么要做这一步');text('whyText',edu.why||node.purpose);
    text('knowledgeText',[edu.concept,...(edu.knowledge||[]),edu.patientMeaning].filter(Boolean).join(' '));
    let narration=$('lessonTeacherNarration');if(!narration){narration=nodeEl('p','teacher-narration');narration.id='lessonTeacherNarration';$('learningGuide')?.querySelector('.guide-content')?.append(narration);}
    if(narration){const lines=Array.isArray(edu.teacherNarration)?edu.teacherNarration.join(' '):edu.teacherNarration||'';narration.textContent=lines;narration.hidden=!lines;}
    const steps=$('taskSteps');if(steps){steps.replaceChildren();for(const step of edu.steps||[])steps.append(nodeEl('li','',step));steps.hidden=!(edu.steps||[]).length;}
    const guide=$('learningGuide');if(guide){if(steps&&!guide.contains(steps))guide.querySelector('.guide-content')?.append(steps);guide.hidden=!(edu.why||edu.concept||node.purpose);guide.open=false;}
    text('actionPrompt',node.options?.length?(node.kind==='task'?'先观察和核对，再选择你的判断。':'你会怎样回应陈女士？请选择一句。'):'');show('actionPrompt',!!node.options?.length);
    show('taskStatus',!!node.task&&!['evidence','history'].includes(node.task.type));text('taskStatus','');
    motionCue.hidden=node.task?.type!=='gait';
  }
  function timeline(wrap){
    const tools=nodeEl('div','timeline-controls');
    const play=button('播放采集',()=>{ctx.toggleRun();paintTask();});play.id='taskPlay';play.className='play-observation';
    const previous=button('前一小步',()=>ctx.setPhase(Math.max(0,facts().phase-.01)));
    const next=button('后一小步',()=>ctx.setPhase(Math.min(1,facts().phase+.01)));
    const lab=nodeEl('label','','拖动回看');lab.htmlFor='taskPhase';
    const slider=document.createElement('input');Object.assign(slider,{type:'range',min:'0',max:'1',step:'.001',id:'taskPhase',value:String(facts().phase)});slider.setAttribute('aria-label','观察进度');
    slider.addEventListener('input',()=>ctx.setPhase(Number(slider.value)));
    slider.addEventListener('change',()=>record('clinic3d_task_scrub',{nodeId:facts().node.id,phase:facts().phase}));
    tools.append(play,previous,next,lab,slider);wrap.append(tools);
  }
  function presentTask(task){
    const wrap=$('taskSurface');wrap.replaceChildren();wrap.hidden=false;
    if(renderSOAPTask(task,{wrap,nodeEl,button,stepBook,record,refresh:()=>coach.update()}))return;
    if(task.type==='history'){wrap.hidden=true;return;}
    if(task.type==='evidence'){
      wrap.append(nodeEl('p','task-description','本次实际留下的资料与判断'));
      const list=nodeEl('div','evidence-preview');for(const id of state.evidence.slice(-4))list.append(nodeEl('span','',catalog[id]?.label||id));
      wrap.append(list,button('回看完整接诊记录',()=>ctx.openDrawer('notes')));return;
    }
    if(task.type==='gait'){
      const compare=button('与正常步态参考对照',()=>comparison.open({tab:'gait'}));compare.className='comparison-open';wrap.append(compare);
      const status=nodeEl('div','gait-status');status.id='gaitState';wrap.append(status);
      const views=nodeEl('div','task-views');views.append(button('侧面',()=>ctx.setView('first')),button('足部',()=>ctx.setView('feet')));wrap.append(views);
      timeline(wrap);
      const chart=document.createElementNS('http://www.w3.org/2000/svg','svg');chart.id='gaitComparison';chart.setAttribute('viewBox','0 0 300 126');chart.setAttribute('role','img');chart.setAttribute('aria-label','患侧和健侧的支撑期与摆动期比较');wrap.append(chart);
      const metrics=nodeEl('div','gait-metrics');
      for(const [label,value]of [['右步长','48 cm'],['左步长','40 cm'],['步宽','14 cm'],['步速','0.73 m/s']]){const card=nodeEl('div','');card.append(nodeEl('small','',label),nodeEl('b','',value));metrics.append(card);}wrap.append(metrics);
      const details=nodeEl('details','gait-explanation'),summary=nodeEl('summary','','步长、步宽、重心怎么看');
      const feet=document.createElementNS('http://www.w3.org/2000/svg','svg');feet.id='gaitFootprints';feet.setAttribute('viewBox','0 0 300 190');feet.setAttribute('role','img');feet.setAttribute('aria-label','连续足印上的步长和步宽');
      details.append(summary,feet,nodeEl('p','','步长：一足着地至另一足下一次着地的前进距离；步宽：两侧足印参考点的横向间距。'),nodeEl('p','','步速＝跨步长 ÷ 同侧步态周期。本例 0.88 m ÷ 1.20 s ≈ 0.73 m/s。'),nodeEl('p','','观察躯干随支撑转换移动。地面白圈为单足COP，黄圈为双足合成COP；足底压力中心不等于全身重心。'));wrap.append(details);
      const markers=nodeEl('div','gait-markers');
      for(const [id,title,meaning]of [['initial_contact','标记右足初始接触','摆动 → 支撑'],['toe_off','标记右足离地','支撑 → 摆动']]){
        const card=nodeEl('div','gait-marker');card.dataset.event=id;const mark=button(title,()=>{stepBook.set(id,facts().phase);record('clinic3d_gait_mark',{event:id,phase:facts().phase,source:'authored-character-timeline'});paintTask();});mark.dataset.event=id;
        const result=nodeEl('p','marker-result');result.id='result_'+id;card.append(mark,nodeEl('small','',meaning),result);markers.append(card);
      }
      wrap.append(markers);addSource(wrap,'虚构教学设定 · 右患侧 / 左健侧。数值与动画用于比较，不是实测或慢性踝不稳的统一模式。');
      anatomyButton(wrap,'ankle');
    } else if(task.type==='goniometer'){
      wrap.append(nodeEl('h3','task-card-title','先认结构，再谈角度'));
      anatomyButton(wrap,'ankle');
      wrap.append(nodeEl('p','task-description',task.stage==='tool'?'先选适合记录角度的工具。需要时可打开解剖窗，认识脚踝的位置。':'在解剖观察窗找到小腿外侧与外踝，再核对下面三个参考。'));if(task.stage==='tool'){addSource(wrap,'量角器记录方向的夹角；软尺记录长度。工具用途不同。');return;}
      const tools=nodeEl('div','landmark-cards');
      for(const [id,title,meaning]of [['axis','轴心 · 外踝','先找腓骨下端的外侧骨性标志。'],['fixed','固定臂 · 小腿参考线','沿腓骨外侧方向辨认小腿这一段。'],['moving','移动臂 · 足外侧参考线','沿第五跖骨外侧方向辨认足这一段。']]){
        const card=nodeEl('div','task-card');const b=button(title,()=>{stepBook.set(id,true);record('clinic3d_landmark_review',{landmark:id,source:'licensed-anatomy-reference',notPatientAngle:true});paintTask();});b.dataset.landmark=id;card.append(b,nodeEl('small','',meaning));tools.append(card);
      }
      wrap.append(tools);addSource(wrap,'解剖参考：辨认结构与方向；本步不读取患者关节角度。');
    } else if(task.type==='trial'){
      wrap.append(nodeEl('h3','task-card-title','为什么“碰得更远”不一定更好？'));
      const compare=nodeEl('div','trial-comparison');
      for(const [label,textValue]of [['同条件记录','双侧使用同一方法；足跟保持落地，记录患者感受。'],['条件已改变','足跟抬起或换了体位，结果不再与原试次直接比较。']]){const card=nodeEl('div','task-card');card.append(nodeEl('b','',label),nodeEl('p','',textValue));compare.append(card);}
      wrap.append(compare);anatomyButton(wrap,'ankle');addSource(wrap,'这里判断的是病例记录的方法条件；三维解剖窗用于理解结构关系。');
    } else if(task.type==='muscle'){
      wrap.append(nodeEl('p','task-description','为四种动作匹配主要肌群。这里练习判断依据，不给患者打肌力等级。'));
      for(const item of MUSCLE_ITEMS){
        const card=nodeEl('div','task-card'),label=nodeEl('label','',item.label),select=document.createElement('select');
        select.id='muscle_'+item.id;select.dataset.muscle=item.id;label.htmlFor=select.id;
        select.style.cssText='display:block;width:100%;margin-top:6px;padding:8px;border:1px solid #bdced4;border-radius:8px;background:#fff;color:#234553;font:inherit;font-size:13px;';
        const empty=document.createElement('option');empty.value='';empty.textContent='选择主要肌群';select.append(empty);
        for(const group of [...new Set(MUSCLE_ITEMS.map(x=>x.muscles.join('、')))]){const option=document.createElement('option');option.value=group;option.textContent=group;select.append(option);}
        select.value=stepBook.get('muscle_answer_'+item.id)||'';
        const result=nodeEl('small','');result.id='muscle_result_'+item.id;result.setAttribute('aria-live','polite');
        select.addEventListener('change',()=>{
          const correct=select.value===item.muscles.join('、');stepBook.set('muscle_answer_'+item.id,select.value);
          if(correct)stepBook.set('muscle_'+item.id,true);else stepBook.delete('muscle_'+item.id);
          record('clinic3d_muscle_match',{movement:item.id,answer:select.value,correct,scope:'movement-muscle-knowledge-only',patientStrengthGrade:null});paintTask();
        });
        card.append(label,select,result);wrap.append(card);
      }
      const details=nodeEl('details','gait-explanation');details.append(nodeEl('summary','','体位与判断边界'));
      for(const item of MUSCLE_ITEMS)details.append(nodeEl('p','',`${item.label}：${item.position} ${item.limits.join('；')}`));
      wrap.append(details);anatomyButton(wrap,'ankle');addSource(wrap,'本幕为动作—肌群知识匹配。未实施规范徒手施阻，不形成患者肌力测量结果。');
    } else if(task.type==='arch'){
      wrap.append(nodeEl('p','task-description','比较坐位与自然站立的内侧足弓外观。'));
      const modes=nodeEl('div','task-modes');
      for(const [mode,label]of [['seated','坐位 · 非负重'],['standing','站立 · 负重']]){
        const control=button(label,()=>{stepBook.set('arch_mode',mode);stepBook.set('arch_'+mode,true);record('clinic3d_arch_case_view',{mode,source:'original-fictional-side-foot-outline',notPatientMesh:true});paintTask();});
        control.dataset.archMode=mode;modes.append(control);
      }wrap.append(modes);
      for(const [mode,title,archPath]of [['seated','坐位病例示意','C 104 82 95 81 90 75 C 81 62 66 62 54 73 C 47 80 39 83 27 82'],['standing','站立病例示意','C 104 82 94 83 86 81 C 75 77 64 77 54 81 C 46 84 37 84 27 82']]){
        const figure=nodeEl('figure','task-card');figure.id='arch_case_'+mode;figure.style.margin='8px 0';
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 170 105');svg.setAttribute('role','img');svg.setAttribute('aria-label',title+'，原创轮廓，不代表人物网格实测');svg.style.cssText='display:block;width:100%;height:140px;';
        const put=(name,attrs)=>{const el=document.createElementNS(svg.namespaceURI,name);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));svg.append(el);};
        put('line',{x1:14,y1:87,x2:157,y2:87,stroke:'#a9bbc3','stroke-width':1});
        put('path',{d:'M 44 13 L 68 13 L 69 40 C 78 52 91 57 110 61 C 124 64 137 66 146 73 C 152 78 146 82 137 82 L 116 82 '+archPath+' C 17 81 17 69 24 59 C 31 49 39 41 41 32 Z',fill:mode==='seated'?'#dbece9':'#e4e8f1',stroke:'#4c7382','stroke-width':2,'stroke-linejoin':'round'});
        put('path',{d:mode==='seated'?'M 49 77 Q 72 52 94 77':'M 49 82 Q 72 72 94 82',fill:'none',stroke:'#bd8c3c','stroke-width':2,'stroke-dasharray':'4 3'});
        const caption=nodeEl('figcaption','',title+' · 内侧纵弓');caption.style.cssText='font-size:12px;color:#506f7b;text-align:center;';figure.append(svg,caption);wrap.append(figure);
      }
      const mode=stepBook.get('arch_mode')==='standing'?'standing':'seated';stepBook.set('arch_mode',mode);stepBook.set('arch_'+mode,true);
      wrap.append(button('正常、低足弓与高足弓对照',()=>comparison.open()));anatomyButton(wrap,'arch');
      const details=nodeEl('details','gait-explanation');details.append(nodeEl('summary','','怎样解释外观变化'),nodeEl('p','','这两张原创轮廓是虚构病例资料，不对应场景人物的足形，也不是压力图。外观随负重变化是观察线索，不能据此确认病因、组织损伤或肌力。'));wrap.append(details);
      addSource(wrap,'病例侧足轮廓示意 · 不对应场景人物网格；没有测量足弓高度。');
    } else if(task.type==='pressure'){
      const compare=button('正常足弓对照 · 高足弓拓展',()=>comparison.open());compare.className='comparison-open';wrap.append(compare);
      const modes=nodeEl('div','task-modes');for(const [id,label]of [['static','静态站立'],['dynamic','行走瞬时'],['maximum','最大压力复合图']]){const b=button(label,()=>{ctx.setPressureMode(id);stepBook.set('mode',true);record('clinic3d_pressure_mode',{mode:id});paintTask();});b.dataset.mode=id;modes.append(b);}wrap.append(modes);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 360 290');svg.setAttribute('role','img');svg.setAttribute('aria-label','足底压力分布及压力中心，原创合成教学数据');svg.id='taskDiagram';wrap.append(svg);timeline(wrap);
      if(task.stage==='regions'){const regions=nodeEl('div','task-regions');for(const region of ['足跟','中足','前足']){const b=button('观察'+region,()=>{stepBook.set('region',region);record('clinic3d_pressure_region',{region});paintTask();});b.dataset.region=region;regions.append(b);}wrap.append(regions);}
      addSource(wrap,'合成教学数据 · 静态与行走图显示同一时刻双足负荷。COP是压力中心，不是全身重心。');
      wrap.append(button('回看脱鞋袜准备',()=>ctx.replayPreparation()));
      const source=document.createElement('a');source.href='../pressure/index.html';source.target='_blank';source.rel='noopener';source.textContent='另看：已授权公开研究足压样例 ↗';source.className='research-link';wrap.append(source);anatomyButton(wrap,'arch');
    } else if(task.type==='balance'){
      wrap.append(nodeEl('h3','task-card-title','先让患者安心站稳'));
      const checklist=nodeEl('div','balance-checklist');for(const [i,label]of(task.checklist||[]).entries()){
        const row=nodeEl('label','task-check'),input=document.createElement('input');input.type='checkbox';input.dataset.condition=String(i);input.checked=!!stepBook.get('check'+i);input.addEventListener('change',()=>{stepBook.set('check'+i,input.checked);record('clinic3d_balance_condition',{condition:label,confirmed:input.checked});paintTask();});row.append(input,nodeEl('span','',label));checklist.append(row);
      }wrap.append(checklist);addSource(wrap,'从可保护的低难度起点讨论；患者可以暂停、降低难度或不做。');
    } else if(task.type==='plan'){
      const goal=nodeEl('div','task-card');goal.append(nodeEl('small','','陈女士最在意的事'),nodeEl('p','','先安心走不平的路，再逐步讨论恢复轻松跑步。'));wrap.append(goal);
      const list=nodeEl('div','evidence-preview');for(const id of state.evidence.filter(id=>['triggers','goal','local_record','arch_record','pressure_record','balance_record'].includes(id)))list.append(nodeEl('span','',catalog[id]?.label||id));wrap.append(list,button('对照完整证据记录',()=>ctx.openDrawer('notes')));
    } else {wrap.hidden=true;}
    paintTask();
  }
  function paintTask(){
    coach.update();
    const {node,phase,running,pressureMode}=facts();const task=node?.task;if(!task)return;
    if($('taskPlay'))$('taskPlay').textContent=running?'暂停采集':task.type==='gait'?'播放采集 ×0.25':'播放采集';
    if($('taskPhase'))$('taskPhase').value=String(phase);
    if(task.type==='gait'){
      const sample=sampleGait(phase);
      const current=`右患侧：${sample.right.contact?'支撑期':'摆动期'} · 左健侧：${sample.left.contact?'支撑期':'摆动期'}`;
      if($('gaitState'))$('gaitState').textContent=current;
      motionCue.textContent=current+'｜地面黄圈：合成COP';
      drawGaitCharts(phase);
      for(const event of task.events||[]){
        const value=stepBook.get(event.id),marked=stepBook.has(event.id),valid=marked&&isGaitEventMatch(value,event.targetPhase,event.tolerance);
        const result=$('result_'+event.id);if(result){result.textContent=!marked?'待标记':valid?'✓ 与事件相符':'请回看接地 / 离地前后';result.dataset.valid=String(valid);}
      }
      const count=(task.events||[]).filter(e=>stepBook.has(e.id)&&isGaitEventMatch(stepBook.get(e.id),e.targetPhase,e.tolerance)).length;text('taskStatus','事件核对 '+count+' / 2 · 可以回放后修改标记。');
    }
    if(task.type==='goniometer'){
      for(const b of document.querySelectorAll('[data-landmark]')){b.classList.toggle('selected',stepBook.has(b.dataset.landmark));b.setAttribute('aria-pressed',String(stepBook.has(b.dataset.landmark)));}
      text('taskStatus','参考标志已核对 '+['axis','fixed','moving'].filter(k=>stepBook.has(k)).length+' / 3');
    }
    if(task.type==='pressure'){
      for(const b of document.querySelectorAll('[data-mode]')){b.classList.toggle('selected',b.dataset.mode===pressureMode);b.setAttribute('aria-pressed',String(b.dataset.mode===pressureMode));}
      for(const b of document.querySelectorAll('[data-region]')){b.classList.toggle('selected',b.dataset.region===stepBook.get('region'));b.setAttribute('aria-pressed',String(b.dataset.region===stepBook.get('region')));}
      const svg=$('taskDiagram');if(svg){svg.replaceChildren();ctx.drawPressure(svg);}
      const timeline=$('taskPlay')?.closest('.timeline-controls');if(timeline)timeline.hidden=pressureMode==='maximum';
      text('taskStatus',pressureMode==='maximum'?'各格点峰值合成；不代表同一时刻，不显示COP。':task.stage==='conditions'?'静态看承重与小范围COP摆动；行走看接触转换。':`观察区域：${stepBook.get('region')||'待选择'}。切换行走瞬时并播放，观察压力转移。`);
    }
    if(task.type==='muscle'){
      for(const item of MUSCLE_ITEMS){const result=$('muscle_result_'+item.id),answer=stepBook.get('muscle_answer_'+item.id);if(result){result.textContent=stepBook.get('muscle_'+item.id)?'✓ 匹配相符':answer?'还不相符。先看动作方向，再核对肌群。':'待选择';result.style.color=stepBook.get('muscle_'+item.id)?'#276e58':'#7b6744';}}
      text('taskStatus','动作—肌群已匹配 '+MUSCLE_ITEMS.filter(item=>stepBook.get('muscle_'+item.id)).length+' / '+MUSCLE_ITEMS.length+' · 不是患者肌力成绩');
    }
    if(task.type==='arch'){
      const mode=stepBook.get('arch_mode')||'seated';
      for(const button of document.querySelectorAll('#taskSurface [data-arch-mode]')){button.classList.toggle('selected',button.dataset.archMode===mode);button.setAttribute('aria-pressed',String(button.dataset.archMode===mode));}
      for(const value of ['seated','standing'])if($('arch_case_'+value))$('arch_case_'+value).hidden=value!==mode;
      text('taskStatus','已查看 '+['seated','standing'].filter(value=>stepBook.get('arch_'+value)).length+' / 2 种条件；同一病例的外观比较。');
    }
    if(task.type==='balance')text('taskStatus','安全条件已核对 '+(task.checklist||[]).filter((_,i)=>stepBook.get('check'+i)).length+' / '+(task.checklist||[]).length);
  }
  function drawGaitCharts(phase){
    const svg=$('gaitComparison');if(!svg)return;svg.replaceChildren();
    const add=(tag,attrs,textValue)=>{const e=document.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(textValue!=null)e.textContent=textValue;svg.append(e);return e;};
    add('text',{x:8,y:14,'font-size':10,fill:'#687c8b'},'同一周期 1.20 s · 深色支撑 / 浅色摆动');
    for(const [i,label,segments,color]of [[0,'右患侧',[[0,.56]],'#2c6e96'],[1,'左健侧',[[0,.10],[.46,1]],'#9b7046']]){
      const y=27+i*42;add('text',{x:8,y:y+12,'font-size':11,fill:color},label);add('rect',{x:65,y,width:224,height:17,rx:4,fill:'#dfe8ec'});
      for(const [start,end]of segments)add('rect',{x:65+224*start,y,width:224*(end-start),height:17,rx:3,fill:color});
      add('text',{x:66,y:y+30,'font-size':9,fill:'#546d7d'},i===0?'支撑 56% / 0.672 s　摆动 44%':'支撑 64% / 0.768 s　摆动 36%');
    }
    const x=65+224*phase;add('line',{x1:x,x2:x,y1:23,y2:91,stroke:'#c89129','stroke-width':2});add('circle',{cx:289,cy:35.5,r:2.5,fill:'#2c6e96'});add('text',{x:65,y:121,'font-size':10,fill:'#5c7484'},phase===1?'100% · 下一周期初始接触':`当前 ${(phase*100).toFixed(0)}% · 病例时间 ${(phase*1.2).toFixed(2)} s`);
    const feet=$('gaitFootprints');if(!feet||feet.childElementCount)return;
    const put=(tag,attrs,textValue)=>{const e=document.createElementNS(feet.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(textValue)e.textContent=textValue;feet.append(e);};
    const px=metres=>150+98*metres,py=metres=>160-(metres+.48)*98;
    put('line',{x1:150,x2:150,y1:12,y2:178,stroke:'#c8d6dd','stroke-dasharray':'4 4'});
    for(const [side,distance]of [['L',-.48],['R',0],['L',.40],['R',.88]]){const x=px(side==='R'?.07:-.07),y=py(distance);put('ellipse',{cx:x,cy:y,rx:4.5,ry:12,fill:side==='R'?'#2c6e96':'#9b7046'});}
    const dimension=(x,from,to,label,color)=>{const y1=py(from),y2=py(to);put('line',{x1:x,x2:x,y1,y2,stroke:color});for(const y of [y1,y2])put('line',{x1:x-5,x2:x+5,y1:y,y2:y,stroke:color});put('text',{x:x+8,y:(y1+y2)/2+4,'font-size':10,fill:color},label);};
    dimension(190,-.48,0,'右步长48cm','#2c6e96');dimension(25,0,.40,'左步长40cm','#9b7046');
    put('line',{x1:px(-.07),x2:px(.07),y1:180,y2:180,stroke:'#657f90'});put('text',{x:115,y:175,'font-size':9,fill:'#415e73'},'步宽14cm');
    put('text',{x:6,y:16,'font-size':9,fill:'#607c8d'},'同尺度足印示意');

  }
  return {presentNode,presentTask,paintTask,openAnatomy,closeAnatomy,anatomyIsOpen:()=>!overlay.hidden||comparison.isOpen(),refreshCoach:()=>coach.update()};
}
