import {ACT_GUIDE,groupCourses} from './guide-data.js';
const $=id=>document.getElementById(id);
const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
function showAct(id){
  const act=ACT_GUIDE.find(a=>a.id===id)||ACT_GUIDE[0];
  for(const button of $('act-list').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.act===act.id));
  $('act-objective').textContent='知识目标 '+act.objectiveId;
  for(const [field,target] of [['question','act-title'],['why','act-why'],['observe','act-observe'],['task','act-task'],['concept','act-concept']])$(target).textContent=act[field];
}
for(const [i,act] of ACT_GUIDE.entries()){
  const button=element('button',undefined,'act-button');button.type='button';button.dataset.act=act.id;button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls','act-detail');
  button.append(element('span','第'+(i+1)+'幕 · '+act.objectiveId),element('b',act.title));
  button.addEventListener('click',()=>showAct(act.id));$('act-list').append(button);
}
showAct(/^#act[1-8]$/.test(location.hash)?location.hash.slice(1):'act1');
try{
  const response=await fetch('../lab/courses.json',{cache:'no-cache'});if(!response.ok)throw Error('课程目录暂不可用。');
  const groups=groupCourses((await response.json()).courses);
  $('course-groups').replaceChildren();
  for(const group of groups){
    const section=element('section',undefined,'course-group'),head=element('header');section.dataset.group=group.id;
    head.append(element('span',group.tag),element('h3',group.title+' · '+group.courses.length+'项'),element('p',group.description));section.append(head);
    const list=element('ul');for(const course of group.courses){const li=element('li'),link=element('a');link.href=course.href;link.dataset.course=String(course.sourceId);
      const title=element('span');title.append(element('span',course.sourceId===101?'01B':String(course.sourceId).padStart(2,'0'),'course-number'),document.createTextNode(course.title));
      link.append(title,element('small',course.summary));li.append(link);list.append(li);
    }section.append(list);$('course-groups').append(section);
  }
}catch{
  $('course-groups').replaceChildren(element('p','课程目录暂未载入。请打开课程实验查看现有目录。'));
  const link=element('a','打开13项课程实验 →');link.href='../lab/index.html';$('course-groups').append(link);
}
