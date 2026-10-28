import {SOAP_STAGES} from '../clinic3d/soap-route-v20.js';
import {groupCourses} from './guide-data.js';
const el=(tag,text,cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
for(const s of SOAP_STAGES){const row=el('div','','sub-row'),copy=el('div','');copy.append(el('b',s.title),el('small',s.goal+'；'+s.task));row.append(copy);document.getElementById('clinic-steps').append(row);}
const host=document.getElementById('course-list');
try{const r=await fetch('../lab/courses.json');if(!r.ok)throw Error();const data=(await r.json()).courses,all=groupCourses(data).flatMap(g=>g.courses);host.replaceChildren();for(const course of data){const m=all.find(c=>c.sourceId===course.sourceId),row=el('div','','sub-row'),copy=el('div',''),link=el('a','进入 →');copy.append(el('b',m.title),el('small',m.summary));link.href=m.href;link.setAttribute('aria-label','进入'+m.title);row.append(copy,link);host.append(row);}}
catch{host.replaceChildren(el('p','目录暂未载入，请点击“选择实验”查看。'));}
