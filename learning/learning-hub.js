// Student learning space. Scores are returned by the local server; AI never grades.
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const btn=(text,action,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',action);return b;};
const stamp=()=>new Date().toISOString();
const uuid=()=>crypto.randomUUID();
const TOKEN_PREFIX='dxx_learning_capability_v15_';
const READONLY=new Set(['baseline','post']);
export function createLearningHub(options={}){
 const state={open:false,tab:'goals',curriculum:null,session:null,token:null,summary:null,discussions:[],feedback:[],objective:'O1',assessmentKind:'post',answers:{baseline:{},post:{}},conversation:null,busy:false,pendingDiscussion:null,pendingAssessment:null,pendingFeedback:null,lastFocus:null};
 const standalone=!!options.standalone;
 const root=el(standalone?'main':'aside','learning-hub'+(standalone?' standalone':''));root.id='learningHub';root.hidden=!standalone;
 if(!standalone){root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','足踝学习空间');}
 const shell=el('section','learning-shell'),header=el('header','learning-header'),heading=el('div','');
 heading.append(el('small','','动小助 · 把问题学明白'),el('h2','','足踝学习空间'));
 const close=standalone?el('a','learning-return','返回实验'):btn('返回实验',hide,'learning-return');if(standalone)close.href='../clinic3d/index.html?demo=1';
 header.append(heading,close);const scope=el('p','learning-scope','先看目标，再提问、练习和复盘。知识自测不代表临床操作能力。');
 const nav=el('nav','learning-nav');nav.setAttribute('aria-label','学习空间');
 const body=el('div','learning-body'),message=el('p','learning-message');message.setAttribute('role','status');
 const footer=el('footer','learning-footer','学习记录、讨论与反馈保存在本机教学后台，任课教师可查看。登记身份由本人填写。');
 shell.append(header,scope,nav,message,body,footer);root.append(shell);document.body.append(root);
 function notice(text,error=false){message.textContent=text;message.classList.toggle('error',error);message.hidden=!text;}
 function saveDraft(){if(!state.session)return;try{localStorage.setItem('dxx_learning_draft_v15_'+state.session.id,JSON.stringify(state.answers));}catch{}}
 function tokenFor(id){try{return localStorage.getItem(TOKEN_PREFIX+id);}catch{return null;}}
 async function request(path,data,auth=true){
  const headers={};if(data)headers['Content-Type']='application/json';if(auth&&state.token)headers['X-Learner-Token']=state.token;
  let response;try{response=await fetch(path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(path.endsWith('/discussion')?40000:12000)});}catch{throw Object.assign(Error('请求没有完成。保留输入后再试；重试同一次提交不会重复记分。'),{uncertain:true});}
  const result=await response.json().catch(()=>({error:'服务没有返回可读取的结果。'}));
  if(!response.ok||['pending','unknown'].includes(result.status))throw Object.assign(Error(result.error||'这次结果尚未确定。请保留输入；再次点击将查询同一次请求，不会另开付费请求。'),{status:response.status,data:result,uncertain:['pending','unknown'].includes(result.status)});return result;
 }
 function getSession(){
  const candidate=options.getSession?.();
  if(candidate)return {id:candidate.id||candidate.sessionId,caseId:candidate.caseId||'cai',startedAt:candidate.startedAt,student:candidate.student||null};
  const profile=window.DXXHub?.profile?.()||null,key='dxx_learning_standalone_v15_'+(profile?.studentId||'guest');
  try{const previous=JSON.parse(localStorage.getItem(key)||'null');if(previous?.id&&previous?.startedAt)return {...previous,student:profile};}catch{}
  const fresh={id:'learning.'+uuid(),caseId:'cai',startedAt:stamp(),student:profile};try{localStorage.setItem(key,JSON.stringify(fresh));}catch{}return fresh;
 }
 async function initialize(){
  notice('正在读取学习目标与本机记录…');body.replaceChildren();
  try{
   state.session=getSession();state.token=tokenFor(state.session.id);
   const [curriculum,started]=await Promise.all([request('/api/learning/curriculum',null,false),request('/api/learning/start',{session:state.session})]);
   state.curriculum=curriculum;
   if(started.accessToken){state.token=started.accessToken;try{localStorage.setItem(TOKEN_PREFIX+state.session.id,state.token);}catch{notice('浏览器未能保存学习令牌，离开后可能无法恢复，请先保留本页。',true);}}
   const saved=started.state||await request('/api/learning/state?sessionId='+encodeURIComponent(state.session.id));
   readState(saved);
   try{const draft=JSON.parse(localStorage.getItem('dxx_learning_draft_v15_'+state.session.id)||'null');if(draft)for(const kind of READONLY)if(draft[kind])state.answers[kind]=draft[kind];}catch{}
   const suggested=options.getObjective?.();if(curriculum.objectives.some(x=>x.id===suggested))state.objective=suggested;
   state.conversation=state.discussions.filter(c=>c.objectiveId===state.objective&&c.mode===(state.discussionMode||'extend')).at(-1)?.id||null;
   notice('');render();options.onReady?.();
  }catch(error){notice(error.message,true);body.append(el('p','','本机服务就绪后可重试。密钥由教师在后台配置；当前不会伪造模型回答。'),btn('重新读取',initialize));}
 }
 function readState(saved){state.summary=saved.assessmentSummary||null;state.discussions=saved.discussions||saved.conversations||[];state.feedback=saved.feedback||[];if(saved.ai&&state.curriculum)state.curriculum.ai=saved.ai;}
 function chooseTab(tab){if(tab==='discussion'&&window.DXXAssistant){hide();window.DXXAssistant.open({objective:state.objective});return;}state.tab=tab;notice('');render();}
 function render(){
  nav.replaceChildren();for(const [id,label]of [['goals','学习目标'],['discussion','问动小助'],['assessment','目标自测'],['feedback','使用反馈']]){const b=btn(label,()=>chooseTab(id));b.classList.toggle('active',state.tab===id);b.setAttribute('aria-current',state.tab===id?'page':'false');nav.append(b);}
  body.replaceChildren();if(!state.curriculum)return;
  if(state.tab==='goals')goals();else if(state.tab==='discussion')discussion();else if(state.tab==='assessment')assessment();else feedback();
 }
 function objectiveSelect(onChange){const label=el('label','learning-field','关注的学习目标'),select=el('select','');select.id='learningObjective';for(const o of state.curriculum.objectives){const option=el('option','',o.id+' · '+o.title);option.value=o.id;select.append(option);}select.value=state.objective;select.addEventListener('change',()=>{state.objective=select.value;onChange?.();});label.append(select);return label;}
 function goals(){
  body.append(el('h3','','这次实验学会什么'),el('p','learning-intro','从患者的问题出发，用观察与证据解释运动，再选择可复评的方案。每项目标配两道知识与推理题；两题均正确，记为本次知识目标达成。'));
  const list=el('div','objective-grid');
  for(const o of state.curriculum.objectives){const card=el('article','objective-card');card.append(el('small','',o.id+' · 第'+o.act.replace('act','')+'幕'),el('h4','',o.title),el('p','',o.criterion.split('关联两题')[0]));const actions=el('div','learning-actions');actions.append(btn('围绕它提问',()=>{state.objective=o.id;state.conversation=null;chooseTab('discussion');}),btn('做两题练习',()=>{state.objective=o.id;chooseTab('assessment');},'quiet'));card.append(actions);list.append(card);}body.append(list);
  const method=el('details','learning-details');method.append(el('summary','','目标达成怎样计算'),el('p','','每次完整自测共16题、8项目标。单个目标两题均正确才算达成，达成目标数÷8为本次知识目标达成率。未测和未完成单列，观看、点击、AI讨论次数均不算知识达成，也不代表临床操作合格。首次后测与最近后测分别保留；没有前测就不计算前后进步。'));body.append(method);
  if(state.curriculum.sources?.length){const refs=el('details','learning-details');refs.append(el('summary','','继续阅读课程来源'));for(const s of state.curriculum.sources){if(!/^https:\/\//.test(s.url||''))continue;const a=el('a','source-link',s.title);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';refs.append(a);}body.append(refs);}
 }
 function discussion(){
  body.append(el('h3','','从“知道”走向“解释得清楚”'),objectiveSelect(()=>{state.conversation=null;state.pendingDiscussion=null;render();}));
  const controls=el('div','learning-actions'),mode=el('select','');mode.id='learningMode';for(const [id,label]of [['extend','扩展：换情境看知识'],['deepen','深入：追问机制与证据']]){const o=el('option','',label);o.value=id;mode.append(o);}mode.value=state.discussionMode||'extend';mode.addEventListener('change',()=>{state.discussionMode=mode.value;state.conversation=null;state.pendingDiscussion=null;render();});controls.append(mode);body.append(controls);
  const ai=state.curriculum.ai||{},provider=ai.provider==='siliconflow'?'硅基流动（DeepSeek）':'DeepSeek官方';const status=el('p','ai-status',ai.configured?(ai.enabled===false?'教师暂时关闭了AI讨论。':provider+'已配置。每次点击发送才请求；回答仍需结合课程来源核对。'):provider+'尚未配置密钥。可以先完成目标自测与课程阅读，配置后再讨论。');body.append(status);
  const suggestions=el('div','learning-suggestions');for(const t of ['用一个生活例子解释这个目标，再问我一个问题。','这个结论需要什么证据？哪些推断目前不能做？','如果换成高足弓或疼痛加重，评估思路怎样调整？'])suggestions.append(btn(t,()=>{input.value=t;input.focus();}));body.append(suggestions);
  const transcript=el('div','learning-transcript');transcript.id='learningTranscript';transcript.setAttribute('aria-live','polite');
  const conversations=state.discussions.filter(c=>c.objectiveId===state.objective&&(!c.mode||c.mode===(state.discussionMode||'extend')));
  for(const c of conversations){const turns=c.turns||c.messages||[];for(const t of turns){if(t.role){const row=el('article','learning-turn '+(t.role==='assistant'?'assistant':'user'));row.append(el('small','',t.role==='assistant'?'DeepSeek · AI解释':'我的问题'),el('p','',t.content||t.text||''));transcript.append(row);}else{if(t.message)transcript.append(turn('我的问题',t.message,'user'));if(t.reply){transcript.append(turn('DeepSeek · AI解释',t.reply,'assistant'));const outcome=el('div','learning-actions');outcome.append(el('span','','这次问题：'));for(const [value,label]of [['resolved','已理解'],['partial','还需深入'],['unresolved','仍有疑问']])outcome.append(btn(label,async()=>{const savedKey='dxx.problem.'+c.id+'.'+(t.id||t.requestId||t.message);let event;try{event=JSON.parse(localStorage.getItem(savedKey)||'null');}catch{}if(!event||event.payload.outcome!==value){event={id:'outcome.'+uuid(),sessionId:state.session.id,type:'learning_problem_outcome',at:stamp(),payload:{conversationId:c.id,requestId:t.requestId||t.id||null,question:t.message||'',outcome:value,source:'student_self_report_not_grade'}};localStorage.setItem(savedKey,JSON.stringify(event));}try{await request('/api/learning/events',{session:state.session,events:[event]});notice('已保存你的问题解决自评。');}catch(error){notice('尚未同步，请再次点击同一选项重试。',true);}}));transcript.append(outcome);} if(t.status==='failed')transcript.append(turn('这次未获得AI回答',t.error||'服务未返回可用结果。失败记录已保留。','failed'));else if(['pending','unknown'].includes(t.status))transcript.append(turn('这次结果尚未确定','当前没有可用的AI回答；记录已保留。相同请求只查询原结果，系统不会自动重新发出付费请求。','failed'));}}}
  body.append(transcript);
  const input=el('textarea','');input.id='learningQuestion';input.rows=4;input.maxLength=1500;input.placeholder='围绕课程目标提问。请勿填写真实患者资料、姓名、学号或联系方式。';input.setAttribute('aria-label','向动小助提出学习问题');input.value=state.questionDraft||'';input.addEventListener('input',()=>{state.questionDraft=input.value;state.pendingDiscussion=null;});body.append(input);
  const consent=el('label','learning-check'),box=el('input','');box.type='checkbox';box.id='discussionConsent';box.checked=!!state.discussionConsent;box.addEventListener('change',()=>state.discussionConsent=box.checked);consent.append(box,el('span','','同意将本次问题和必要的课程讨论上下文发送至'+provider+'，并由教师查看讨论记录。系统不附带登记姓名和学号；请勿在问题中填写个人或患者信息。'));body.append(consent);
  const send=btn(state.busy?'正在等待回答…':'发送学习问题',async()=>{
   if(state.busy)return;if(!input.value.trim()){notice('先写一个想学明白的问题。',true);input.focus();return;}if(!box.checked){notice('发送前请阅读并勾选讨论说明。',true);return;}
   state.busy=true;send.disabled=true;send.textContent='正在等待回答…';notice('正在请求DeepSeek，请保留本页。');
   const payload=state.pendingDiscussion||{session:state.session,requestId:uuid(),objectiveId:state.objective,mode:state.discussionMode||'extend',provider:ai.provider||'deepseek',message:input.value.trim(),consent:true,...(state.conversation?{conversationId:state.conversation}:{})};state.pendingDiscussion=payload;
   try{const result=await request('/api/learning/discussion',payload);state.conversation=result.conversationId;state.pendingDiscussion=null;state.questionDraft='';await restore();notice('回答已保存。AI解释可能有误，请结合课程与来源核对。');render();}
   catch(error){if(error.data?.conversationId)state.conversation=error.data.conversationId;if(!error.uncertain)state.pendingDiscussion=null;try{await restore();}catch{}notice(error.message,true);render();}
   finally{state.busy=false;const b=root.querySelector('#discussionSend');if(b){b.disabled=!ai.configured||ai.enabled===false;b.textContent='发送学习问题';}}
  },'primary');send.id='discussionSend';send.disabled=state.busy||!ai.configured||ai.enabled===false;body.append(send,el('small','learning-note','AI只作学习助教，不替代教师审核、真实患者评估或个体治疗处方。讨论次数不直接增加目标达成率。'));
 }
 function turn(who,text,cls){const row=el('article','learning-turn '+cls);row.append(el('small','',who),el('p','',text));return row;}
 async function restore(){const saved=await request('/api/learning/state?sessionId='+encodeURIComponent(state.session.id));readState(saved);}
 function assessment(){
  body.append(el('h3','','用证据检查自己是否学会'),el('p','learning-intro','分8组作答，共16题。答完后由本机服务按固定课程标准核对；没有前测也可做后测，但不会显示虚构的进步值。'));
  const kinds=el('div','learning-actions');for(const [id,label]of [['baseline','学习前自测'],['post','学习后自测']]){const b=btn(label,()=>{state.assessmentKind=id;state.pendingAssessment=null;render();});b.classList.toggle('selected',state.assessmentKind===id);kinds.append(b);}body.append(kinds,objectiveSelect(render));
  const questions=state.curriculum.items,answers=state.answers[state.assessmentKind],o=state.curriculum.objectives.find(x=>x.id===state.objective);
  const answered=questions.filter(q=>answers[q.id]).length;body.append(el('p','assessment-progress','已作答 '+answered+' / '+questions.length+' · 当前 '+o.id+'，每组2题'));
  for(const q of questions.filter(q=>q.objectiveId===state.objective)){const field=el('fieldset','assessment-question'),legend=el('legend','',q.prompt);field.append(legend);for(const a of q.options){const row=el('label','assessment-option'),radio=el('input','');radio.type='radio';radio.name=q.id;radio.value=a.id;radio.checked=answers[q.id]===a.id;radio.addEventListener('change',()=>{answers[q.id]=a.id;state.pendingAssessment=null;saveDraft();const progress=root.querySelector('.assessment-progress');if(progress)progress.textContent='已作答 '+questions.filter(q=>answers[q.id]).length+' / '+questions.length+' · 当前 '+o.id+'，每组2题';});row.append(radio,el('span','',a.text));field.append(row);}body.append(field);}
  const index=state.curriculum.objectives.findIndex(x=>x.id===state.objective),actions=el('div','learning-actions');actions.append(btn('上一组',()=>{state.objective=state.curriculum.objectives[(index+7)%8].id;render();}),btn('下一组',()=>{state.objective=state.curriculum.objectives[(index+1)%8].id;render();}));
  const submit=btn(state.busy?'正在核对…':'提交本次16题',async()=>{
   if(state.busy)return;const missing=questions.filter(q=>!answers[q.id]);if(missing.length){state.objective=missing[0].objectiveId;render();notice('还有'+missing.length+'题未答。已定位第一组未完成目标。',true);return;}
   state.busy=true;submit.disabled=true;notice('正在按课程标准核对…');const payload=state.pendingAssessment||{session:state.session,requestId:uuid(),kind:state.assessmentKind,answers:{...answers}};state.pendingAssessment=payload;
   try{const result=await request('/api/learning/assessment',payload);state.summary=result.assessmentSummary;state.lastAssessment=result.assessment;state.pendingAssessment=null;notice('本次自测已保存。结果是知识与推理练习，不是临床技能成绩。');render();}
   catch(error){if(!error.uncertain)state.pendingAssessment=null;notice(error.message,true);}finally{state.busy=false;const actual=root.querySelector('#assessmentSubmit');if(actual){actual.disabled=false;actual.textContent='提交本次16题';}}
  },'primary');submit.id='assessmentSubmit';actions.append(submit);body.append(actions);
  const summary=state.summary||{};if(summary.baseline||summary.latestPost||state.lastAssessment){const results=el('section','assessment-results');results.append(el('h4','','已经记录的结果'));for(const [key,label]of [['baseline','首次前测'],['firstPost','首次后测'],['latestPost','最近后测']]){const a=summary[key];if(a){const achieved=(a.objectives||[]).filter(x=>x.achieved).length;results.append(el('p','',label+'：知识题 '+(a.score?.correct??'—')+' / '+(a.score?.total??16)+'；达成目标 '+achieved+' / 8。'));}}
   const latest=state.lastAssessment||summary.latestPost||summary.baseline;if(latest?.objectives){const grid=el('div','result-objectives');for(const x of latest.objectives)grid.append(el('span',x.achieved?'achieved':'pending',x.id+' · '+(x.achieved?'本次达成':x.answered===0?'未测':'继续学习')+' '+x.correct+'/'+x.total));results.append(grid);}if(latest?.items){const detail=el('details','learning-details');detail.append(el('summary','','查看本次核对与解释'));for(const item of latest.items){const q=questions.find(q=>q.id===item.id);detail.append(el('p','',q?.prompt||item.id),el('small','',item.correct?'本题相符':item.explanation||'回到该目标，再核对依据。'));}results.append(detail);}body.append(results);}
 }
 function feedback(){
  body.append(el('h3','','让下一次学习更顺畅'),el('p','learning-intro','哪里难理解、哪里不好操作，或希望增加什么内容，都可以告诉任课教师。反馈不影响知识成绩。'));
  const rating=el('select','');rating.id='feedbackRating';rating.setAttribute('aria-label','整体学习体验评分');const ratingBlank=el('option','','请选择整体体验');ratingBlank.value='';rating.append(ratingBlank);for(let i=5;i>=1;i--){const o=el('option','',i+'分 · '+({5:'很顺畅',4:'比较顺畅',3:'一般',2:'有些困难',1:'困难较多'}[i]));o.value=String(i);rating.append(o);}rating.value='';const category=el('select','');category.id='feedbackCategory';category.setAttribute('aria-label','反馈类别');const categoryBlank=el('option','','请选择反馈类别');categoryBlank.value='';category.append(categoryBlank);for(const [id,text]of [['usability','操作与界面'],['content','课程内容'],['ai','AI讨论'],['other','其它建议']]){const o=el('option','',text);o.value=id;category.append(o);}category.value='';const actions=el('div','learning-actions');actions.append(rating,category);body.append(actions);
  const input=el('textarea','');input.rows=5;input.maxLength=2000;input.id='learningFeedback';input.placeholder='例如：我在第几步找不到入口；哪项解释仍有疑问。请勿填写患者或他人的个人信息。';input.setAttribute('aria-label','反馈内容');body.append(input);
  const consent=el('label','learning-check'),check=el('input','');check.type='checkbox';check.id='feedbackConsent';consent.append(check,el('span','','同意将这条评价与学习会话一起保存在本机，供任课教师改进教学。'));body.append(consent);
  const submit=btn('提交反馈',async()=>{if(state.busy)return;if(!check.checked){notice('请先勾选反馈保存说明。',true);return;}if(!rating.value||!category.value){notice('请自主选择体验评分和反馈类别。',true);return;}state.busy=true;submit.disabled=true;const payload=state.pendingFeedback||{session:state.session,requestId:uuid(),rating:Number(rating.value),category:category.value,text:input.value.trim(),consent:true};state.pendingFeedback=payload;try{await request('/api/learning/feedback',payload);state.pendingFeedback=null;input.value='';check.checked=false;notice('谢谢，反馈已保存，教师可在后台查看。');}catch(error){if(!error.uncertain)state.pendingFeedback=null;notice(error.message,true);}finally{state.busy=false;submit.disabled=false;}},'primary');for(const e of [input,rating,category])e.addEventListener('input',()=>state.pendingFeedback=null);body.append(submit);
 }
 async function open(tab='goals'){
  if(state.open){chooseTab(tab);return;}
  state.open=true;state.tab=tab;state.lastFocus=document.activeElement;root.hidden=false;options.onOpen?.();if(options.inertTarget)options.inertTarget.inert=true;close.focus();await initialize();
 }
 function hide(){if(standalone)return;state.open=false;root.hidden=true;if(options.inertTarget)options.inertTarget.inert=false;options.onClose?.();state.lastFocus?.focus();}
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!standalone){event.preventDefault();event.stopPropagation();hide();}if(event.key==='Tab'&&!standalone){const all=[...root.querySelectorAll('button,a,input,select,textarea,summary')].filter(e=>!e.disabled&&e.getClientRects().length),first=all[0],last=all.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 return {open,close:hide,isOpen:()=>state.open};
}
