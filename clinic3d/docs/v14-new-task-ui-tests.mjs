import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),base=path.resolve(process.argv[2]||path.join(here,'..'));
const out=path.resolve(process.argv[3]||path.join(here,'v14-new-task-ui-tests.json'));
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.parentElement=null;this.hidden=false;this.disabled=false;this.dataset={};this.style={};this.listeners={};this.attributes={};this.className='';this.textContent='';this.value='';this.open=false;this.classList={add:n=>this.className+=' '+n,remove:n=>this.className=this.className.split(/\s+/).filter(x=>x!==n).join(' '),contains:n=>this.className.split(/\s+/).includes(n),toggle:(n,on)=>{this.classList.remove(n);if(on)this.classList.add(n);}};}
 append(...items){for(const item of items){if(item.parentElement)item.parentElement.children=item.parentElement.children.filter(x=>x!==item);this.children.push(item);item.parentElement=this;}}
 replaceChildren(...items){for(const item of this.children)item.parentElement=null;this.children=[];this.append(...items);}
 insertBefore(item,before){if(item.parentElement)item.parentElement.children=item.parentElement.children.filter(x=>x!==item);let index=this.children.indexOf(before);if(index<0)index=this.children.length;this.children.splice(index,0,item);item.parentElement=this;}
 addEventListener(type,callback){(this.listeners[type]||=[]).push(callback);}
 dispatch(type){for(const callback of this.listeners[type]||[])callback({target:this});}
 click(){if(!this.disabled)this.dispatch('click');}
 setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=value;}
 getClientRects(){return this.hidden||this.parentElement&&!this.parentElement.getClientRects().length?[]:[{}];}
 focus(){document.activeElement=this;}
 scrollIntoView(){}
 contains(other){return this===other||this.children.some(c=>c.contains(other));}
 querySelectorAll(selector){return query(this,selector);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){for(let e=this;e;e=e.parentElement)if(matches(e,selector))return e;return null;}
}
function descendants(root){return root.children.flatMap(child=>[child,...descendants(child)]);}
function matches(el,selector){if(selector.startsWith('#'))return el.id===selector.slice(1);if(selector.startsWith('.'))return el.classList.contains(selector.slice(1));const m=selector.match(/^([a-z]+)?\[data-([a-z-]+)(?:="([^"]*)")?\]$/);if(m){const key=m[2].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return(!m[1]||el.tagName===m[1])&&key in el.dataset&&(m[3]===undefined||el.dataset[key]===m[3]);}return el.tagName===selector;}
function query(root,selector){if(selector.includes(','))return selector.split(',').flatMap(s=>query(root,s.trim()));const at=selector.indexOf(' ');if(at>0){const parent=query(root,selector.slice(0,at))[0];return parent?query(parent,selector.slice(at+1)):[];}return descendants(root).filter(el=>matches(el,selector));}
const cache=new Map();
async function moduleAt(file){file=path.normalize(file);if(cache.has(file))return cache.get(file);let m;
 if(file.endsWith(path.normalize('/arch-comparison.js')))m=new vm.SyntheticModule(['createArchComparison'],function(){this.setExport('createArchComparison',()=>({open(){},isOpen:()=>false}));},{identifier:file});
 else if(file.endsWith(path.normalize('/anatomy-viewer.js')))m=new vm.SyntheticModule(['createAnatomyViewer'],function(){this.setExport('createAnatomyViewer',()=>{throw Error('Viewer must not open in DOM unit test');});},{identifier:file});
 else m=new vm.SourceTextModule(await fs.readFile(file,'utf8'),{identifier:file});cache.set(file,m);for(const name of m.dependencySpecifiers||[])await moduleAt(path.resolve(path.dirname(file),name));return m;}
const uiModule=await moduleAt(path.join(base,'learning-ui.js'));await uiModule.link((name,parent)=>cache.get(path.normalize(path.resolve(path.dirname(parent.identifier),name))));await uiModule.evaluate();
const items=cache.get(path.join(base,'case-muscle-v14.js')).namespace.MUSCLE_ITEMS;
function harness(savedSteps){
 const body=new Element('body');globalThis.document={body,activeElement:null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),querySelectorAll:s=>query(body,s),querySelector:s=>query(body,s)[0]||null,addEventListener(){}};
 const $=id=>descendants(body).find(el=>el.id===id)||null;
 for(const id of ['clinic','archExplore','settings','prepPause','pause','coach','coachText','coachAction','coachStage','coachToggle','conversation','speakerAvatar','dialogueKind','careCue','taskDock','options','dockTitle','whyTitle','whyText','knowledgeText','taskSteps','learningGuide','actionPrompt','taskStatus','taskSurface','taskPlayPlaceholder','dockToggle','next','begin']){const e=new Element('div');e.id=id;body.append(e);}
 for(const [id,cls]of [['taskDock','dock-content'],['learningGuide','guide-content'],['conversation','conversation-foot']]){const e=new Element('div');e.className=cls;$(id).append(e);}
 $('next').hidden=true;$('options').append(new Element('button'));
 const nodeEl=(tag,cls,value)=>{const el=new Element(tag);el.className=cls||'';el.textContent=value||'';return el;};
 const button=(label,action)=>{const el=nodeEl('button','',label);el.addEventListener('click',action);return el;};
 const stepBook=new Map(savedSteps||[]),events=[],state={view:'third',evidence:[],paused:false};
 let node={id:'muscle_match',act:'act3',kind:'task',speaker:'林治疗师',task:{type:'muscle'},options:[{id:'done'}],education:{teacherNarration:['教学旁白：运动由肌群共同完成。','先区分知识判断与患者测量。'],knowledge:['动作方向与测量结果分开。']}};
 const ctx={$,state,catalog:{},stepBook,nodeEl,button,record:(type,payload)=>events.push({type,payload}),getCurrent:()=>({node,phase:0,running:false,pressureMode:'static'}),getRemovalState:()=>null,pauseTask(){},setView(){},openDrawer(){},drawPressure(){}};
 const ui=uiModule.namespace.createLearningUI(ctx);
 return{$,ui,stepBook,events,node:()=>node,render(type){node={...node,id:type+'_test',task:{type},act:type==='arch'?'act4':'act3'};ui.presentNode(node);ui.presentTask(node.task);}};
}
const checks=[];function check(id,fn){try{checks.push({id,passed:!!fn()});}catch(e){checks.push({id,passed:false,error:e.message});}}
let h=harness();h.render('muscle');
check('four-real-selects-four-muscle-options',()=>document.querySelectorAll('select[data-muscle]').length===4&&document.querySelectorAll('select[data-muscle]').every(e=>e.children.length===5));
check('narration-remains-folded',()=>h.$('learningGuide').open===false&&h.$('lessonTeacherNarration').textContent==='教学旁白：运动由肌群共同完成。 先区分知识判断与患者测量。');
check('coach-locates-first-muscle-control',()=>{h.$('coachAction').click();return document.activeElement?.id==='muscle_'+items[0].id;});
const first=h.$('muscle_'+items[0].id);first.value=items[0].muscles.join('、');first.dispatch('change');
check('correct-match-grants-only-knowledge-flag',()=>h.stepBook.get('muscle_'+items[0].id)===true&&h.events.at(-1).payload.patientStrengthGrade===null);
first.value=items[1].muscles.join('、');first.dispatch('change');
check('changing-to-wrong-clears-gate',()=>!h.stepBook.has('muscle_'+items[0].id)&&h.$('muscle_result_'+items[0].id).textContent.includes('还不相符'));
for(const item of items){const e=h.$('muscle_'+item.id);e.value=item.muscles.join('、');e.dispatch('change');}
check('all-four-match-with-real-flags',()=>items.every(item=>h.stepBook.get('muscle_'+item.id)===true));
const saved=[...h.stepBook];h=harness(saved);h.render('muscle');
check('restores-matching-answer-and-gate',()=>items.every(item=>h.$('muscle_'+item.id).value===item.muscles.join('、')&&h.stepBook.get('muscle_'+item.id)));
h=harness();h.render('arch');
check('initial-seated-does-not-grant-standing',()=>h.stepBook.get('arch_seated')===true&&!h.stepBook.has('arch_standing')&&!h.$('arch_case_seated').hidden&&h.$('arch_case_standing').hidden);
check('coach-locates-unseen-standing',()=>{h.$('coachAction').click();return document.activeElement?.dataset.archMode==='standing';});
document.querySelector('[data-arch-mode="standing"]').click();
check('standing-switch-fulfills-second-view',()=>h.stepBook.get('arch_standing')===true&&h.stepBook.get('arch_seated')===true&&h.$('arch_case_seated').hidden&&!h.$('arch_case_standing').hidden);
h=harness([['arch_mode','standing'],['arch_standing',true]]);h.render('arch');
check('standing-only-restore-does-not-invent-seated',()=>!h.stepBook.has('arch_seated')&&h.stepBook.get('arch_standing')===true&&!h.$('arch_case_standing').hidden);
check('coach-uses-task-type-for-eight-act-stage',()=>h.$('coachStage').textContent==='第4步 · 静态足弓');
const report={schema:'dxx-v14-new-task-ui-tests',passed:checks.every(c=>c.passed),total:checks.length,passedCount:checks.filter(c=>c.passed).length,checks,scope:'Actual learning-ui.js and lesson-coach.js with actual MUSCLE_ITEMS; DOM stub only. Anatomy/comparison viewers are stubbed and not tested. No browser rendering, clinical strength assessment, patient foot deformation, network or paid generation.'};
await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
