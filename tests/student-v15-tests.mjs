import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'../learning/learning-hub.js'),'utf8');
const bank=JSON.parse(fs.readFileSync(path.join(here,'../learning/objectives-v15.json'),'utf8'));
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.hidden=false;this.disabled=false;this.attributes={};this.listeners={};this.className='';this.textContent='';this.value='';this.style={};this.classList={contains:n=>this.className.split(' ').includes(n),toggle:(n,on)=>{this.className=this.className.split(' ').filter(x=>x!==n).join(' ')+(on?' '+n:'');}};}
 append(...es){for(const e of es){e.parentElement=this;this.children.push(e);if(this.tagName==='select'&&!this.value&&e.tagName==='option')this.value=e.value;}}
 replaceChildren(...es){this.children=[];this.append(...es);}
 addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
 async dispatch(type){for(const fn of this.listeners[type]||[])await fn({target:this,preventDefault(){},stopPropagation(){}});}
 async click(){if(!this.disabled)await this.dispatch('click');}
 setAttribute(k,v){this.attributes[k]=v;}
 focus(){document.activeElement=this;}
 getClientRects(){return this.hidden?[]:[{}];}
 querySelectorAll(s){return descendants(this).filter(e=>s.split(',').some(p=>p.startsWith('#')?e.id===p.slice(1):p.startsWith('.')?e.classList.contains(p.slice(1)):e.tagName===p));}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
const descendants=e=>e.children.flatMap(c=>[c,...descendants(c)]);
const body=new Element('body');globalThis.document={body,activeElement:null,createElement:t=>new Element(t)};
globalThis.window={DXXHub:{profile:()=>null}};
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
let requests=[],discussionConfigured=false,discussionProvider='deepseek';
const session={id:'test.student-v15',caseId:'cai',startedAt:'2026-10-18T00:00:00Z',student:null};
const current={assessmentSummary:{},conversations:[],feedback:[]};
globalThis.fetch=async(url,options)=>{
 const payload=options.body?JSON.parse(options.body):null;requests.push({url,headers:options.headers,payload});
 let result={};let status=200;
 if(url.endsWith('curriculum'))result={version:bank.version,objectives:bank.objectives,items:bank.items.map(({correctOption,explanation,...x})=>x),sources:[],ai:{configured:discussionConfigured,enabled:true,provider:discussionProvider}};
 else if(url.endsWith('/start'))result={sessionId:session.id,accessToken:'fixture-capability',state:current};
 else if(url.includes('/state?'))result={...current,ai:{configured:discussionConfigured,enabled:true,provider:discussionProvider}};
 else if(url.endsWith('/assessment')){const a={kind:payload.kind,score:{correct:1,total:16},objectives:bank.objectives.map((o,i)=>({id:o.id,correct:i?0:2,total:2,answered:2,achieved:i===0})),items:[]};result={assessment:a,assessmentSummary:{latestPost:a,firstPost:a}};}
 else if(url.endsWith('/feedback'))result={feedback:{id:'fixture-feedback'},duplicate:false};
 else if(url.endsWith('/discussion')){status=503;result={error:'测试：上游未返回有效结果',status:'failed',conversationId:'fixture-conversation'};current.conversations=[{id:'fixture-conversation',objectiveId:payload.objectiveId,mode:'extend',turns:[{message:payload.message,reply:null,status:'failed'}]}];}
 return {ok:status<400,status,json:async()=>result};
};
const module=new vm.SourceTextModule(source);await module.link(()=>{});await module.evaluate();
const get=id=>descendants(body).find(e=>e.id===id),buttons=text=>descendants(body).filter(e=>e.tagName==='button'&&e.textContent===text),allText=()=>descendants(body).map(e=>e.textContent).join('\n');
let checks=[];function check(id,fn){try{if(!fn())throw Error('Assertion false');checks.push({id,passed:true});}catch(e){checks.push({id,passed:false,error:e.message});}}
const clinic=new Element('main');let paused=false;const hub=module.namespace.createLearningHub({getSession:()=>session,inertTarget:clinic,onOpen:()=>paused=true,onClose:()=>paused=false});
await hub.open();
check('eight-goals-rendered',()=>descendants(body).filter(e=>e.classList.contains('objective-card')).length===8);
check('modal-pauses-and-inerts',()=>clinic.inert&&paused&&hub.isOpen());
check('modal-has-accessible-name',()=>get('learningHub').attributes['aria-label']==='足踝学习空间');
check('capability-stays-local-header',()=>storage.get('dxx_learning_capability_v15_'+session.id)==='fixture-capability'&&!requests.some(x=>x.url.includes('fixture-capability')));
await buttons('目标自测')[0].click();await get('assessmentSubmit').click();
check('incomplete-answer-does-not-submit',()=>!requests.some(x=>x.url.endsWith('/assessment'))&&allText().includes('16题未答'));
for(let i=0;i<8;i++){
 for(const e of descendants(body).filter(e=>e.tagName==='input'&&e.type==='radio'&&e.value==='a')){e.checked=true;await e.dispatch('change');}
 if(i<7)await buttons('下一组')[0].click();
}
await get('assessmentSubmit').click();
check('complete-answers-server-graded',()=>requests.find(x=>x.url.endsWith('/assessment'))?.headers['X-Learner-Token']==='fixture-capability'&&Object.keys(requests.find(x=>x.url.endsWith('/assessment')).payload.answers).length===16);
check('server-result-not-client-recomputed',()=>allText().includes('知识题 1 / 16')&&allText().includes('达成目标 1 / 8'));
check('submit-restored-after-result-render',()=>get('assessmentSubmit').textContent==='提交本次16题'&&!get('assessmentSubmit').disabled);
await buttons('使用反馈')[0].click();await buttons('提交反馈')[0].click();
check('feedback-consent-required',()=>!requests.some(x=>x.url.endsWith('/feedback')));
check('feedback-not-biased-by-default-rating',()=>get('feedbackRating').value===''&&get('feedbackCategory').value==='');
get('feedbackConsent').checked=true;get('feedbackRating').value='4';get('feedbackCategory').value='usability';get('learningFeedback').value='测试反馈';await buttons('提交反馈')[0].click();
check('feedback-stored-by-endpoint',()=>requests.find(x=>x.url.endsWith('/feedback'))?.payload.text==='测试反馈'&&allText().includes('反馈已保存'));
await buttons('拓展讨论')[0].click();check('no-key-send-disabled',()=>get('discussionSend').disabled&&allText().includes('尚未配置密钥'));
hub.close();check('close-restores-clinic',()=>!clinic.inert&&!paused&&!hub.isOpen());
discussionConfigured=true;discussionProvider='siliconflow';await hub.open('discussion');check('actual-provider-in-consent',()=>allText().includes('发送至硅基流动（DeepSeek）'));get('learningQuestion').value='解释负荷';await get('learningQuestion').dispatch('input');await get('discussionSend').click();
check('ai-consent-required',()=>!requests.some(x=>x.url.endsWith('/discussion')));
get('discussionConsent').checked=true;await get('discussionSend').click();
check('request-binds-consented-provider',()=>requests.find(x=>x.url.endsWith('/discussion'))?.payload.provider==='siliconflow');
check('failed-request-keeps-question-and-no-assistant',()=>allText().includes('未获得AI回答')&&!descendants(body).some(e=>e.classList.contains('assistant'))&&get('learningQuestion').value==='解释负荷');
check('upstream-failure-resets-send',()=>!get('discussionSend').disabled&&get('discussionSend').textContent==='发送学习问题');
const report={schema:'dxx-v15-student-ui-tests',passed:checks.every(x=>x.passed),total:checks.length,checks,limits:'Actual student module with DOM and API response fixtures. Does not validate browser layout, backend scoring or external DeepSeek connection.'};
fs.writeFileSync(process.argv[2]||path.join(here,'student-v15-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
