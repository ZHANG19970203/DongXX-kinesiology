import {createAnatomyViewer} from './anatomy-viewer.js';
import {MUSCLES,ARCHES,JOINTS} from '../soap/explorers-data.js';
import {copSeries,copStats} from '../soap/teaching-data.js';
import {renderPressureDiagram} from './pressure-engine.js';
const el=(t,c='',v)=>{const n=document.createElement(t);n.className=c;if(v!==undefined)n.textContent=v;return n;};
const btn=(t,f)=>{const b=el('button','',t);b.type='button';b.onclick=f;return b;};
function panel(t,p){const c=el('section','card explorer realistic-panel');c.append(el('h3','',t),el('p','note',p));return c;}
function whenVisible(host,init){let stop;const ob=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;ob.disconnect();if(host.isConnected)Promise.resolve(init()).then(fn=>{stop=fn;if(!host.isConnected)stop?.();});});ob.observe(host);const mo=new MutationObserver(()=>{if(!host.isConnected){ob.disconnect();stop?.();mo.disconnect();}});queueMicrotask(()=>mo.observe(document.body,{childList:true,subtree:true}));}
export function anatomicalPanel(kind='arch'){
 const titles={arch:'在真实骨骼上辨认三条足弓',muscle:'认识肌肉，再观察它能产生的动作',joint:'在足踝骨骼上理解关节类型'};
 const c=panel(titles[kind],'拖动旋转、滚轮缩放。选择结构后，在授权解剖模型上观察位置。'),tabs=el('div','explorer-tabs'),description=el('div','knowledge-detail'),host=el('div','atlas-host');c.append(tabs,host,description);
 let viewer=null,selection=0;
 const archKeys=[['calcaneus','talus','navicular','cuneiformM','cuneiformI','cuneiformL','mt1','mt2','mt3'],['calcaneus','cuboid','mt4','mt5'],['cuneiformM','cuneiformI','cuneiformL','cuboid','mt1','mt2','mt3','mt4','mt5']];
 function select(i){selection=i;[...tabs.children].forEach((b,j)=>b.setAttribute('aria-pressed',i===j));description.replaceChildren();
  if(kind==='arch'){const a=ARCHES[i];description.append(el('h4','',a.name),el('p','',a.bones),el('p','',a.text));viewer?.setFocus('foot');viewer?.highlight(archKeys[i]);viewer?.setZoom(1.4);viewer?.setAxesVisible(false);}
  if(kind==='joint'){const a=JOINTS[i];description.append(el('h4','',a[1]),el('p','',a[2]));viewer?.setFocus(i<4?'ankle':'foot');viewer?.highlight([['tibia','fibula','talus'],['talus','calcaneus'],['talus','calcaneus','navicular'],['calcaneus','cuboid'],['cuneiformM','cuneiformI','cuneiformL','mt1','mt2','mt3'],['mt1','mt2','mt3','mt4','mt5'],['mt1'],['tibia','fibula']][i]);}
  if(kind==='muscle'){const a=MUSCLES[i];description.append(el('h4','',a.name));for(const[k,v]of [['起点',a.origin],['止点',a.insertion],['作用',a.action]])description.append(el('p','',k+'：'+v));viewer?.setMusclesVisible(true).then(()=>viewer.highlight(a.id));}
 }
 const items=kind==='arch'?ARCHES:kind==='muscle'?MUSCLES:JOINTS;items.forEach((a,i)=>tabs.append(btn(a.name||a[0],()=>select(i))));select(0);
 whenVisible(host,async()=>{try{viewer=await createAnatomyViewer(host);select(selection);return()=>viewer.dispose();}catch{host.append(el('p','','模型加载未完成，请稍后重新打开。'));}});
 c.selectMuscle=id=>select(Math.max(0,MUSCLES.findIndex(m=>m.id===id)));
 if(kind==='muscle'){const motion=btn('看骨骼运动与轴面',()=>{viewer?.setMusclesVisible(false);viewer?.setMotion(['invert','evert'].includes(MUSCLES[selection].motion)?'frontal':'sagittal');viewer?.setAngle(0);});c.append(motion,el('p','note','肌肉观察保留原始静态网格；运动窗展示有限骨骼运动，不伪造肌肉变形或力矩。'));}
 return c;
}
// Same licensed skinned actor as the clinic, never a line-drawing substitute.
export async function actorPreview(host,{role='patient',closeup=false}={}){
 const THREE=await import('three'),{createActor}=await import('./actors.js');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(closeup?28:32,1,.01,30);
 scene.background=new THREE.Color('#e8efee');scene.add(new THREE.HemisphereLight(0xffffff,0x6b8693,2.6));const light=new THREE.DirectionalLight(0xfff2e2,3);light.position.set(2,4,3);scene.add(light);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.3));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.domElement.setAttribute('aria-label',closeup?'林治疗师三维助教':'三维人物与测量平台');host.append(renderer.domElement);
 const actor=await createActor(scene,role,new URL('./assets/patient-motion.glb',import.meta.url).href);actor.setPosition([0,0,0]);actor.setPose('standing',true);actor.face(.12);if(role==='patient')actor.setFootwear('barefoot');
 const plate=new THREE.Mesh(new THREE.BoxGeometry(.72,.035,.8),new THREE.MeshStandardMaterial({color:0x3a5b68,roughness:.5}));plate.position.set(0,-.023,.04);scene.add(plate);
 camera.position.set(closeup?.08:2,closeup?1.55:1.5,closeup?.95:3);camera.lookAt(0,closeup?1.5:.85,0);
 let phase=null,raf=0,last=performance.now(),live=true,visible=true;const resize=()=>{const w=host.clientWidth,h=host.clientHeight||260;if(!w)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(host);resize();
 const io=new IntersectionObserver(e=>visible=e.some(x=>x.isIntersecting));io.observe(host);
 function tick(t){if(!live)return;raf=requestAnimationFrame(tick);const dt=Math.min(.04,(t-last)/1000);last=t;if(document.hidden||!visible)return;actor.update(dt);if(phase!==null)actor.setGaitPhase(phase);renderer.render(scene,camera);}raf=requestAnimationFrame(tick);
 return{actor,phase(p){phase=p;},dispose(){live=false;cancelAnimationFrame(raf);ro.disconnect();io.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});renderer.dispose();renderer.domElement.remove();}};
}
function clock(c,duration,draw){let t=0,run=false,last=0,raf;const row=el('div','timeline-controls'),range=el('input'),out=el('output');Object.assign(range,{type:'range',min:0,max:duration,step:duration/1500,value:0});range.setAttribute('aria-label','教学采集时间');const paint=()=>{range.value=t;out.textContent=t.toFixed(1)+' / '+duration+' s';draw(t/duration);};const stop=()=>{run=false;cancelAnimationFrame(raf);play.textContent='播放采集';};const loop=n=>{if(!c.isConnected||document.hidden){stop();return;}t=Math.min(duration,t+Math.min(.08,(n-last)/1000));last=n;paint();if(t===duration)stop();else raf=requestAnimationFrame(loop);};const play=btn('播放采集',()=>{if(run){stop();return;}if(t===duration)t=0;run=true;play.textContent='暂停';last=performance.now();raf=requestAnimationFrame(loop);});range.oninput=()=>{stop();t=+range.value;paint();};row.append(play,btn('重置',()=>{stop();t=0;paint();}),range,out);c.append(row);paint();}
export function staticCOPPanel({onObserve=()=>{}}={}){
 const c=panel('同条件站立 · 看轨迹逐渐形成','双足睁眼、硬地面、30秒、50Hz；左右图用相同毫米坐标。'),host=el('div','real-actor-view'),canvas=el('canvas'),text=el('p','metric-readout');canvas.width=900;canvas.height=300;canvas.className='scientific-chart';c.classList.add('cop-live-panel');c.append(host,canvas,text);let preview;whenVisible(host,async()=>{preview=await actorPreview(host);return()=>preview.dispose();});
 const sets=[copSeries(1),copSeries(1.6)];clock(c,30,p=>{const g=canvas.getContext('2d'),count=Math.round(1500*p)+1;g.clearRect(0,0,900,300);g.font='14px sans-serif';const stats=[];sets.forEach((all,i)=>{const ox=225+i*450,oy=157,points=all.slice(0,count);g.fillStyle='#f7faf9';g.fillRect(i*450+4,0,442,300);g.strokeStyle='#d2e0e1';g.lineWidth=1;for(let v=-15;v<=15;v+=5){g.beginPath();g.moveTo(ox+v*10,35);g.lineTo(ox+v*10,277);g.stroke();}for(let v=-10;v<=10;v+=5){g.beginPath();g.moveTo(ox-170,oy-v*10);g.lineTo(ox+170,oy-v*10);g.stroke();}g.fillStyle='#244d5d';g.fillText(i?'摆动较大示例':'较稳定示例',ox-165,22);g.fillText('左右 −15 mm',ox-165,293);g.fillText('+15 mm',ox+102,293);g.fillText('前 +10',ox+175,60);g.fillText('后 −10',ox+175,260);g.strokeStyle=i?'#bd7648':'#198b85';g.lineWidth=2;g.beginPath();points.forEach((q,j)=>j?g.lineTo(ox+q[1]*10,oy-q[2]*10):g.moveTo(ox+q[1]*10,oy-q[2]*10));g.stroke();const q=points.at(-1);g.fillStyle=g.strokeStyle;g.beginPath();g.arc(ox+q[1]*10,oy-q[2]*10,4,0,Math.PI*2);g.fill();stats.push(count>1?copStats(points).pathMM:0);});text.textContent=`已描绘 ${(p*30).toFixed(1)} 秒 · 路径 ${stats[0].toFixed(2)} / ${stats[1].toFixed(2)} mm`;if(p>=.5)onObserve();});
 c.append(el('p','note','两组为合成教学对照，不是患者实测或诊断阈值。人物提供站立情境，COP不能直接重建身体质心。'));return c;
}
export {walkingPanel as gaitExplorer} from './walking-panel-v26.js';
export function archCOPPanel(){const c=panel('足形与足底负荷 · 比较条件再解释','足弓类型不能单独预测COP必然向内或向外。比较同一行走时刻的压力分布，并核对色标。'),s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 300 360');s.classList.add('pressure-real');c.append(s);clock(c,2.4,p=>renderPressureDiagram(s,{mode:'dynamic',phase:p}));c.append(el('p','note','图为诊室共享的合成压力场；它显示时相与接触关系，不是扫描得到的真实病例。文献并不支持把所有低足弓、高足弓固定为一种COP方向。'));return c;}
export const musclePanel=()=>anatomicalPanel('muscle');
export const archPanel=()=>anatomicalPanel('arch');
export const jointPanel=()=>anatomicalPanel('joint');
export function contractionPanel(){
 const c=panel('在提踵中理解收缩方式','观察上升、保持和下降；三维人物动作仅作定性示教。'),host=el('div','real-actor-view'),tabs=el('div','explorer-tabs'),description=el('p','knowledge-detail');let preview,mode='concentric';
 const defs={concentric:['向心 · 上升','提踵上升时，小腿三头肌主动缩短、产生跖屈。'],eccentric:['离心 · 下降','缓慢落踵时，小腿三头肌在出力时被拉长，控制下降；不是放松。'],isometric:['等长 · 保持','保持位置时仍有张力，整体长度近似不变；肌束和肌腱内部仍可能变化。'],isotonic:['等张 · 概念','严格等张指张力近似恒定而长度改变。普通提踵或弹力带训练不等于严格恒张力。'],isokinetic:['等速 · 概念','专用设备控制有效区间的角速度并调整阻力；人物动作匀速不能证明等速测力。']};
 function select(id){mode=id;description.textContent=defs[id][1];[...tabs.children].forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===id));}
 for(const [id,[name]]of Object.entries(defs)){const b=btn(name,()=>select(id));b.dataset.mode=id;tabs.append(b);}c.append(tabs,host,description);select(mode);
 whenVisible(host,async()=>{preview=await actorPreview(host);preview.actor.setHeelTeachingPhase(0);return()=>preview.dispose();});
 clock(c,4,p=>{if(!preview)return;const v=mode==='eccentric'?1-p:mode==='isometric'?.65:p;preview.actor.setHeelTeachingPhase?.(v);});
 c.append(el('p','note','肌肉网格不按此动画变形，也不计算肌力、肌电或肌腱行程；等张和等速用定义区分，不冒充设备测试。'));return c;
}
