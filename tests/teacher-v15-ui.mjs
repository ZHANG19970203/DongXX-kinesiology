import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.argv[2]||path.join(root,'..','..','teacher-v15-ui-tests.json'));
const html=await fs.readFile(path.join(root,'teacher/index.html'),'utf8'),source=await fs.readFile(path.join(root,'teacher/teacher.js'),'utf8');
const bank=JSON.parse(await fs.readFile(path.join(root,'learning/objectives-v15.json'),'utf8'));
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.parentElement=null;this.listeners={};this.dataset={};this.attributes={};this.style={};this.value='';this.hidden=false;this.disabled=false;this._text='';this.className='';this.classList={toggle:(name,on)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));on?set.add(name):set.delete(name);this.className=[...set].join(' ');},add:name=>this.classList.toggle(name,true),remove:name=>this.classList.toggle(name,false)};}
 set textContent(value){this._text=String(value??'');this.children=[];}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 set innerHTML(_){throw Error('Unsafe innerHTML use detected');}
 append(...children){for(const child of children){if(child.parentElement)child.parentElement.children=child.parentElement.children.filter(x=>x!==child);child.parentElement=this;this.children.push(child);}}
 appendChild(child){this.append(child);return child;}
 replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...children);}
 addEventListener(type,listener){(this.listeners[type]||=[]).push(listener);}
 async fire(type){if(this.disabled)return;await Promise.all((this.listeners[type]||[]).map(fn=>fn({preventDefault(){},target:this,key:'Enter'})));}
 click(){return this.fire('click');}
 setAttribute(key,value){this.attributes[key]=String(value);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
 get selectedOptions(){return this.children.filter(c=>c.value===this.value);}
}
const body=new Element('body'),elements=new Map();
for(const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Element(match[1]);node.id=match[2];node.hidden=/\bhidden\b/.test(match[0]);node.disabled=/\bdisabled\b/.test(match[0]);elements.set(node.id,node);body.append(node);}
elements.get('scopeFilter').value='classroom';elements.get('aiModelInput').value='deepseek-flash';
const storage=new Map(),calls=[],downloads=[],historyChanges=[];
const fixtureToken='fixture-teacher-token-not-real',fixtureKey='sk-fixture-only-not-a-real-key-000';
const providers=[{id:'deepseek',label:'DeepSeek 官方',endpoint:'https://api.deepseek.com/chat/completions',allowedModels:['deepseek-flash','deepseek-v4-pro'],credentialEnvironment:'DEEPSEEK_API_KEY'},{id:'siliconflow',label:'硅基流动 SiliconFlow',endpoint:'https://api.siliconflow.cn/v1/chat/completions',allowedModels:['deepseek-ai/DeepSeek-V4.1-Flash'],credentialEnvironment:'SILICONFLOW_API_KEY'}];
let config={provider:'deepseek',endpoint:providers[0].endpoint,model:'deepseek-flash',allowedModels:providers[0].allowedModels,allowedProviders:['deepseek','siliconflow'],providers,enabled:false,configured:false,keySource:'none',lastTest:null,liveVerified:false};
const complete=(kind,correct)=>({id:'attempt-'+kind+'-'+correct,kind,complete:true,receivedAt:'2026-10-18T01:00:00Z',score:{correct,total:16,answered:16,rate:correct/16},objectives:bank.objectives.map((o,i)=>({id:o.id,total:2,correct:i<Math.floor(correct/2)?2:0,achieved:i<Math.floor(correct/2),status:i<Math.floor(correct/2)?'achieved':'not_achieved'})),items:[]});
const partial={id:'partial',kind:'post',complete:false,score:{correct:1,total:16,answered:1},objectives:[{id:'O1',status:'partial',answered:1,total:2}],items:[]};
const rows=[{session:{id:'registered-1',caseId:'cai',startedAt:'2026-10-18T01:00:00Z',student:{name:'=SUM(1,2)<img src=x onerror=evil()>',studentId:'S1',teacher:'teacher'}},identityKind:'registered',dataKind:'classroom',learningEnabled:true,assessmentSummary:{baseline:complete('baseline',8),firstPost:complete('post',12),latestPost:complete('post',14),latestAttempt:complete('post',14),postAttempts:2},usage:{attempted:2,succeeded:1,failed:1,pending:0,promptTokens:4,completionTokens:3,unknownUsageCount:1},feedbackCount:1},{session:{id:'guest-1',caseId:'cai',startedAt:'2026-10-18T01:00:00Z',student:null},identityKind:'guest',dataKind:'classroom',learningEnabled:true,assessmentSummary:{latestAttempt:partial,partialAttempts:1},usage:{attempted:0},feedbackCount:0},{session:{id:'test-1',caseId:'cai',startedAt:'2026-10-18T01:00:00Z',student:null},identityKind:'guest',dataKind:'test',learningEnabled:true,assessmentSummary:{latestPost:complete('post',16)},usage:{attempted:0}},{session:{id:'legacy-1',caseId:'cai',startedAt:'2026-10-18T01:00:00Z',student:null},identityKind:'guest',dataKind:'classroom',learningEnabled:false,assessmentSummary:{},usage:{attempted:0}}];
rows[0].activity={eventCount:14,learningCompleteCount:1,firstReceivedAt:'2026-10-18T01:00:00Z',lastReceivedAt:'2026-10-18T01:30:00Z'};
const detail=id=>({session:rows.find(r=>r.session.id===id)?.session||{id},identityKind:id.startsWith('registered')?'registered':'guest',dataKind:'classroom',assessments:id==='registered-1'?[complete('baseline',8),complete('post',14)]:[],assessmentSummary:{},conversations:[{id:'conversation-fixture',objectiveId:'O1',mode:'discussion',createdAt:'2026-10-18T01:00:00Z',messages:[{id:'m1',role:'user',text:'<img src=x onerror=evil()> 为什么会这样？',receivedAt:'2026-10-18T01:00:00Z'}],requests:[{id:'request-fixture',status:'failed',model:'deepseek-flash',errorCode:'fixture_failure'}]}],feedback:[{id:'feedback-fixture',rating:4,category:'clarity',text:'课堂反馈原文',receivedAt:'2026-10-18T01:00:00Z'}],usage:{}});
const response=data=>({ok:true,status:200,json:async()=>structuredClone(data)});
async function fetchStub(url,options={}){calls.push({url:String(url),options});if(String(url).startsWith('/api/teacher/ai-config')){if(options.method==='POST'){const posted=JSON.parse(options.body);if(posted.provider&&posted.provider!==config.provider){const provider=providers.find(p=>p.id===posted.provider);config={...config,provider:provider.id,endpoint:provider.endpoint,allowedModels:provider.allowedModels,configured:false,keySource:'none',liveVerified:false,lastTest:null};}if(posted.apiKey)config={...config,configured:true,keySource:'config_file'};if(posted.clearKey)config={...config,configured:false,keySource:'none'};if(posted.model)config.model=posted.model;if(typeof posted.enabled==='boolean')config.enabled=posted.enabled;}return response(config);}if(url==='/api/teacher/ai-test')return response({status:'succeeded',model:'deepseek-flash',message:'fixture only',usage:{prompt_tokens:1,completion_tokens:1}});if(url==='/api/learning/status')return response({collectorEnabled:true});if(url==='/api/learning/curriculum')return response(bank);if(String(url).includes('cases.json'))return response({cases:[{id:'cai',title:'足踝病例'}]});if(url==='/api/teacher/learning')return response({sessions:rows,localOnly:true});if(String(url).startsWith('/api/teacher/learning?'))return response(detail(new URL('http://localhost'+url).searchParams.get('sessionId')));if(String(url).startsWith('/api/learning/sessions/'))return response({events:[{id:'event-fixture',type:'clinic3d_dialogue_segment',at:'2026-10-18T01:00:00Z',payload:{text:'<script>fixture</script>',apiKey:'must-not-export'}}]});throw Error('Unmocked URL: '+url);}
class TestURL extends URL{}TestURL.createObjectURL=blob=>{downloads.push(blob);return'blob:fixture';};TestURL.revokeObjectURL=()=>{};
const document={body,getElementById:id=>elements.get(id)||null,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector==='tr[data-id]'?elements.get('sessionRows').children:[]};
const sandbox={document,location:{href:'http://localhost:8774/teacher/?token=discard-query#token='+fixtureToken},history:{replaceState:(_,__,url)=>historyChanges.push(url)},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},fetch:fetchStub,URL:TestURL,URLSearchParams,Blob,crypto:{randomUUID:()=> 'fixture-request-uuid'},setTimeout:fn=>{fn();return 1;},console,Date,Map,Set};sandbox.window=sandbox;
vm.runInNewContext(source,sandbox,{filename:'teacher.js'});const flush=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};await flush();
const tests=[];function check(id,value){tests.push({id,passed:!!value});}
check('token-removed-from-address',historyChanges.length===1&&!historyChanges[0].includes('token'));
check('teacher-token-header-only',calls.filter(c=>c.url.startsWith('/api/teacher/')).every(c=>c.options.headers['X-Teacher-Token']===fixtureToken&&!c.url.includes(fixtureToken)));
check('no-auto-paid-live-test',!calls.some(c=>c.url==='/api/teacher/ai-test'));
check('unconfigured-honest-state',elements.get('aiState').textContent.includes('尚未配置')&&elements.get('modelStatus').textContent.includes('未实际连通'));
check('default-excludes-test-data',elements.get('sessionCount').textContent==='3'&&!elements.get('sessionRows').children.some(c=>c.dataset.id==='test-1'));
check('partial-and-legacy-not-completed',elements.get('postCount').textContent==='1'&&elements.get('assessmentCount').textContent.includes('部分后测 1')&&elements.get('assessmentCount').textContent.includes('未参加新版测评 1'));
const helpers=sandbox.DXXTeacherV15,sum=helpers.summarizeRows(rows.slice(0,2),['O1']);
check('objective-denominator-tested-sessions-only',sum.achievementRate===1&&sum.untested===1&&sum.eligible===2&&sum.objectives[0].partial===1);
check('first-and-latest-post-separated',sum.firstPair.post===.75&&sum.latestPair.post===.875&&sum.firstPair.baseline===.5);
const duplicate=structuredClone(rows[0]);duplicate.session.id='registered-2';duplicate.assessmentSummary.latestPost=complete('post',16);duplicate.assessmentSummary.latestPost.receivedAt='2026-10-18T02:00:00Z';
const dedup=helpers.summarizeRows([rows[0],duplicate],['O8']);
check('registered-student-rate-deduplicates-latest-post',dedup.registeredKnowledge.learners===1&&dedup.registeredKnowledge.tested===1&&dedup.registeredKnowledge.achieved===1&&dedup.registeredKnowledge.denominator===1);
const testTwin=structuredClone(duplicate);testTwin.dataKind='test';
check('classroom-test-identities-not-merged',helpers.summarizeRows([rows[0],testTwin],['O1']).registeredKnowledge.learners===2);
check('real-event-submit-count-and-received-range-labelled',elements.get('usageSummary').textContent.includes('接诊事件 14 条')&&elements.get('usageSummary').textContent.includes('实际完成提交 1 次')&&elements.get('usageSummary').textContent.includes('不是活跃学习时长'));
check('csv-formula-escaping',['=SUM(1,2)',' +2','-4','@command','\tformula','\rformula'].every(value=>helpers.csvCell(value).startsWith('"\'')));
check('json-recursive-credentials-redacted',!JSON.stringify(helpers.cleanData({apiKey:'x',nested:{authorization:'secret',promptTokens:3,teacher_token:'x'}})).includes('secret')&&helpers.cleanData({nested:{promptTokens:3}}).nested.promptTokens===3);
await elements.get('sessionRows').children.find(c=>c.dataset.id==='registered-1').fire('click');await flush();
check('full-discussion-failure-feedback-shown',elements.get('detailPanel').textContent.includes('fixture_failure')&&elements.get('detailPanel').textContent.includes('课堂反馈原文')&&elements.get('detailPanel').textContent.includes('<img src=x onerror=evil()>'));
check('all-dynamic-records-textcontent-no-innerhtml',!source.includes('.innerHTML')&&elements.get('detailPanel').children.every(c=>c.tagName!=='img'&&c.tagName!=='script'));
elements.get('aiKeyInput').value=fixtureKey;await elements.get('aiConfigForm').fire('submit');await flush();
const posted=calls.filter(c=>c.url==='/api/teacher/ai-config'&&c.options.method==='POST').at(-1);
check('config-secret-posted-to-local-only-and-cleared',JSON.parse(posted.options.body).apiKey===fixtureKey&&elements.get('aiKeyInput').value===''&&posted.url==='/api/teacher/ai-config');
check('saved-key-not-rendered-or-live-tested',!body.textContent.includes(fixtureKey)&&!calls.some(c=>c.url==='/api/teacher/ai-test')&&elements.get('modelStatus').textContent.includes('未实际验证'));
const beforeProviderChange=calls.length;elements.get('aiProviderInput').value='siliconflow';await elements.get('aiProviderInput').fire('change');
check('provider-selector-preserves-exact-siliconflow-model',elements.get('aiModelInput').value==='deepseek-ai/DeepSeek-V4.1-Flash'&&elements.get('aiEndpointNote').textContent.includes('https://api.siliconflow.cn/v1/chat/completions'));
check('changing-provider-does-not-send-or-test',calls.length===beforeProviderChange);
await elements.get('aiConfigForm').fire('submit');await flush();
check('provider-change-without-key-not-assumed-configured',config.provider==='siliconflow'&&!config.configured&&elements.get('modelStatus').textContent.includes('SiliconFlow')&&elements.get('aiTest').disabled);
const sfFixtureKey='sk-siliconflow-fixture-not-real-000';elements.get('aiKeyInput').value=sfFixtureKey;await elements.get('aiConfigForm').fire('submit');await flush();
const sfPosted=JSON.parse(calls.filter(c=>c.url==='/api/teacher/ai-config'&&c.options.method==='POST').at(-1).options.body);
check('siliconflow-save-exact-no-substitution-or-endpoint-input',sfPosted.provider==='siliconflow'&&sfPosted.model==='deepseek-ai/DeepSeek-V4.1-Flash'&&!('endpoint' in sfPosted)&&elements.get('aiKeyInput').value===''&&!body.textContent.includes(sfFixtureKey));
check('saved-provider-display-honest-unverified',elements.get('aiState').textContent.includes('SiliconFlow')&&elements.get('aiState').textContent.includes('deepseek-ai/DeepSeek-V4.1-Flash')&&elements.get('modelStatus').textContent.includes('未实际验证'));
elements.get('aiProviderInput').value='deepseek';await elements.get('aiProviderInput').fire('change');
check('official-model-options-preserved',elements.get('aiModelInput').children.some(o=>o.value==='deepseek-flash')&&elements.get('aiModelInput').children.some(o=>o.value==='deepseek-v4-pro'));
check('provider-upgrade-still-zero-auto-live-tests',!calls.some(c=>c.url==='/api/teacher/ai-test'));
await elements.get('exportJson').fire('click');await flush();const exported=JSON.parse(await downloads.at(-1).text());
check('export-preserves-discussion-removes-secret-fields',exported.records.length===3&&exported.records[0].conversations.length===1&&!JSON.stringify(exported).includes('must-not-export')&&!JSON.stringify(exported).includes(fixtureToken)&&!JSON.stringify(exported).includes(fixtureKey));
const report={schema:'dxx-teacher-v15-ui-tests',passed:tests.every(t=>t.passed),total:tests.length,passedCount:tests.filter(t=>t.passed).length,tests,scope:'Actual teacher.js with DOM and local API fixtures only. All identities, attempts, requests, failures and keys are marked test fixtures. No actual external AI request, backend mutation, classroom data or paid media.'};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
