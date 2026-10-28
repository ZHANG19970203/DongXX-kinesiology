import {staticCOPPanel} from './realistic-panels.js';
import {copSeries,copStats,archIndex} from '../soap/teaching-data.js';
export function renderSOAPTask(task,{wrap,nodeEl,button,stepBook,record,refresh}){
 if(!['archIndex','staticCOP'].includes(task.type))return false;
 wrap.replaceChildren();wrap.hidden=false;wrap.append(nodeEl('h3','',task.type==='archIndex'?'足弓指数 · 面积比':'静态COP · 同条件比较'));
 wrap.append(nodeEl('p','',task.type==='archIndex'?'后足 30、中足 40、前足 50 cm²（不含脚趾）。请输入足弓指数，保留三位小数。':'双脚、睁眼、稳定平面，50 Hz，30秒。先比较两组，再输入对照轨迹的平均速度。'));
 const feedback=nodeEl('p','task-status');feedback.setAttribute('role','status');let expected=archIndex(30,40,50),seen=new Set();
 if(task.type==='staticCOP'){
  wrap.append(staticCOPPanel({onObserve(){if(!stepBook.get('cop_compared')){stepBook.set('cop_compared',true);record('clinic3d_static_cop_observed',{bothSeries:true,minimumSeconds:15,synthetic:true});refresh();}}}));expected=copStats(copSeries(1)).meanVelocityMMs;
 }
 const label=nodeEl('label','',task.type==='archIndex'?'足弓指数':'对照平均速度（mm/s）'),input=document.createElement('input');input.type='number';input.step='0.001';input.id='soapNumericAnswer';input.setAttribute('aria-label',label.textContent);label.htmlFor=input.id;wrap.append(label,input);
 wrap.append(button('核对计算',()=>{const value=Number(input.value),ok=input.value!==''&&Number.isFinite(value)&&Math.abs(value-expected)<.002&&(task.type!=='staticCOP'||stepBook.get('cop_compared'));stepBook.set(task.type==='archIndex'?'arch_index_checked':'static_cop_checked',!!ok);feedback.textContent=ok?'计算正确。请保存这项记录。':task.type==='archIndex'?'再试试：40 ÷（30 + 40 + 50）。':'先比较两组；对照平均速度 = 169.299 ÷ 30。';record('clinic3d_soap_calculation',{type:task.type,value,correct:!!ok,synthetic:true});refresh();}),feedback,nodeEl('small','task-source','原创教学数据，不是视频提取或患者实测；不据此单独诊断病因。'));
 return true;
}
