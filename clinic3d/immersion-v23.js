import {anatomicalPanel,staticCOPPanel,gaitExplorer,archCOPPanel,actorPreview} from './realistic-panels.js';
import {evidencePanel,referencePanel,contractionPanel,ligamentPanel} from '../soap/explorers.js';
import {CASE_EVIDENCE,caseConclusion} from '../soap/explorers-data.js';
import {SOAP_STAGES} from './soap-route-v20.js';
const el=(t,c='',v)=>{const n=document.createElement(t);n.className=c;if(v!==undefined)n.textContent=v;return n;};
const btn=(t,f)=>{const b=el('button','',t);b.type='button';b.onclick=f;return b;};
const concepts={act1:['倾听与SOAP','把患者感受与客观观察分开记录。'],act2:['关节与轴面','背屈、跖屈和内外翻分别涉及哪些关节？'],act3:['肌肉与收缩','起止点怎样决定动作？向心与离心怎样配合？'],act4:['三条足弓','先认识内侧纵弓、外侧纵弓和横弓。'],act5:['步态周期','接地、离地、支撑与摆动怎样衔接？'],act6:['足底负荷','足印、压力图与COP分别回答什么问题？'],act7:['静态COP','站着不动时，轨迹为什么仍在变化？'],act8:['从证据到计划','先核对已知和未知，再选择下一步。']};
export function installImmersion(ctx){
 const dialog=el('dialog','clinic-study'),head=el('header'),title=el('h2'),body=el('div','study-content'),close=btn('回到诊室',()=>dialog.close());head.append(title,close);dialog.append(head,body);document.body.append(dialog);
 let resume=null,afterPaper=null;dialog.addEventListener('close',()=>{body.replaceChildren();resume?.();resume=null;const fn=afterPaper;afterPaper=null;fn?.();});
 function show(name,content){title.textContent=name;body.replaceChildren(content);resume=ctx.pause();dialog.showModal();close.focus();}
 const prompt=el('div','concept-prompt'),label=el('span'),open=btn('了解这个概念',()=>openConcept());prompt.hidden=true;prompt.append(label,open);document.getElementById('coach').append(prompt);
 const face=document.querySelector('.coach-face');face.textContent='';face.classList.add('therapist-avatar');actorPreview(face,{role:'therapist',closeup:true}).then(v=>{face.dataset.animated='true';}).catch(()=>{const i=el('img');i.src='../soap/media/portrait-therapist.jpg';i.alt='林治疗师';face.append(i);});
 function openConcept(requestedAct){const act=typeof requestedAct==='string'?requestedAct:ctx.getNode()?.act||'act1',d=el('div');const [name,desc]=concepts[act]||concepts.act1;d.append(el('p','study-intro',desc));
  if(['act2','act3','act4'].includes(act))d.append(anatomicalPanel({act2:'joint',act3:'muscle',act4:'arch'}[act]));
  if(act==='act3'){const detail=el('details'),sum=el('summary','','训练时怎样收缩？');detail.append(sum);detail.ontoggle=()=>{if(detail.open&&!detail.dataset.loaded){detail.dataset.loaded='true';detail.append(contractionPanel());}};d.append(detail);}
  if(act==='act2'){const detail=el('details'),sum=el('summary','','韧带与跟腱');detail.append(sum);detail.ontoggle=()=>{if(detail.open&&!detail.dataset.loaded){detail.dataset.loaded='true';detail.append(ligamentPanel());}};d.append(detail);}
  if(act==='act5')d.append(gaitExplorer());if(act==='act6')d.append(archCOPPanel());if(act==='act7')d.append(staticCOPPanel());
  if(['act2','act3','act4'].includes(act)){const stage={act2:'joint',act3:'muscle',act4:'arch'}[act];d.append(evidencePanel(stage,{reviewed:ctx.state.reviewedEvidence||[],onReview:id=>{ctx.state.reviewedEvidence||=[];if(!ctx.state.reviewedEvidence.includes(id))ctx.state.reviewedEvidence.push(id);ctx.record('clinic3d_case_evidence_read',{id,title:CASE_EVIDENCE.find(e=>e.id===id)?.title,sourceKind:'fictional_case_handout',notExaminationPerformed:true});ctx.persist();}}));}
  if(act==='act1')d.append(el('p','','S：患者的经历、症状、目标。O：观察与测量。A：综合解释。P：共同商量的方案与复评。'));
  if(act==='act8')d.append(btn('打开本次证据病历',()=>{dialog.close();paper();}));
  show(name,d);ctx.record('clinic3d_concept_open',{act,concept:name,notAssessmentCredit:true});
 }
 const menu=document.getElementById('settings');const evidenceButton=btn('本次病历与记录',()=>{menu.hidden=true;paper();});evidenceButton.id='evidenceMenu';menu.insertBefore(evidenceButton,document.getElementById('voice'));
 function paper(next){const s=ctx.state,doc=el('article','evidence-paper'),top=el('div','paper-top');top.append(el('span','','运动康复 · 足踝评估'),el('small','','教学病例 / 本轮记录'));doc.append(top,el('h2','','接诊证据核对单'),el('p','paper-meta',`学生：${s.student?.name||'未登记'}　患者：陈女士　右侧反复扭伤与不稳`));
  const table=el('table'),tr=el('tr');['已到访环节','本轮记录状态'].forEach(t=>tr.append(el('th','',t)));table.append(tr);
  for(const stage of SOAP_STAGES.filter(x=>x.act!=='act8')){const visited=(s.visited||[]).filter(id=>ctx.flow[id]?.act===stage.act),tasks=Object.keys(s.taskReceipts||{}).filter(id=>ctx.flow[id]?.act===stage.act),r=el('tr');r.append(el('td','',stage.title),el('td','',tasks.length?`完成 ${tasks.length} 项教学操作`:visited.length?'到访/交流过，尚无完成操作记录':'本轮未到访'));table.append(r);}doc.append(table,el('h3','','已收集的线索'));
  if(!s.evidence.length)doc.append(el('p','','尚未收集证据。可以先补问诊和观察，再形成判断。'));
  for(const id of s.evidence){const item=ctx.catalog[id];doc.append(el('p','paper-evidence',(item?.text||item?.label||id)+'　〔'+({patient_report:'患者报告',synthetic_teaching_data:'合成教学数据',fictional_case_record:'虚构病例',authored_demonstration:'教学操作',reasoning:'学习判断'}[item?.status]||'本轮过程记录')+'〕'));}
  doc.append(el('h3','','查阅过的病例资料（不等于完成检查）'));const reviewed=s.reviewedEvidence||[];if(!reviewed.length)doc.append(el('p','','尚未查阅补充查体卡。'));
  for(const e of CASE_EVIDENCE.filter(e=>reviewed.includes(e.id)))doc.append(el('p','',e.title+'：'+e.result));
  doc.append(el('h3','','当前能够形成的工作判断'),el('p','','主诉提示反复扭伤后持续不稳的评估方向。低足弓是需要结合功能检查的线索，不能直接认定为所有症状的病因。未做项目保留为待补。'));
  if(reviewed.length)caseConclusion(reviewed).forEach(t=>doc.append(el('p','',t)));
  const actions=el('div','paper-actions');actions.append(btn('回看对话',()=>{dialog.close();document.getElementById('notesOpen').click();}),btn('导出本次记录',()=>document.getElementById('export').click()),btn('参考文献',()=>{dialog.close();show('参考文献与制作依据',referencePanel());}));doc.append(actions);
  const ack=btn(next?'已核对，进入分析与计划':'已核对，返回诊室',()=>{ctx.record('clinic3d_evidence_review',{evidenceIds:[...s.evidence],reviewedHandouts:[...reviewed],completedTasks:Object.keys(s.taskReceipts||{}),destination:next?.id||'review',notClinicalDiagnosis:true});ctx.persist();afterPaper=next?.go||null;dialog.close();});ack.className='paper-continue';doc.append(ack);show('先核对证据，再作判断',doc);
 }
 let bypass=null;return{enterNode(node){const concept=concepts[node.act];prompt.hidden=!concept;label.textContent=concept?'动小助 · '+concept[0]:'';},beforeNode(id,go){if(!['plan_intro','plan'].includes(id)||bypass===id){bypass=null;return false;}paper({id,go:()=>{bypass=id;go();}});return true;},openConcept,paper};
}
