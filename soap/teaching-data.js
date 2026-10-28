export const STAGES=[
{id:'hypothesis',short:'导入 · 提出假设',tag:'START WITH A QUESTION',title:'反复崴脚，与足弓有关吗？',purpose:'从她的困扰出发，不急着把关联当成病因。'},
{id:'interview',short:'S · 与患者交流',tag:'SUBJECTIVE · 倾听',title:'让她把经历慢慢说出来。',purpose:'分层采集病史，了解生活目标、安全情况和检查意愿。'},
{id:'joint',short:'O · 关节与轴面',tag:'OBJECTIVE · 关节',title:'脚踝怎样运动？',purpose:'观察关节、运动轴和运动面，先统一测量方法。'},
{id:'muscle',short:'O · 肌群与控制',tag:'OBJECTIVE · 肌肉',title:'谁在产生动作，谁在控制？',purpose:'用解剖位置理解功能，不从外观直接推断肌力。'},
{id:'arch',short:'O · 足弓与扫描',tag:'OBJECTIVE · 足弓',title:'负重以后，足弓有什么变化？',purpose:'观察、计算、对照，分清足形、接触面积和压力。'},
{id:'balance',short:'O · 静态COP',tag:'OBJECTIVE · 姿势控制',title:'站着不动，压力中心仍在移动。',purpose:'计算轨迹和平均速度，理解多感觉共同参与的平衡。'},
{id:'gait',short:'O · 步态周期',tag:'OBJECTIVE · 动态观察',title:'从一次接触，到下一次接触。',purpose:'用同一时间轴理解支撑、摆动、步长与步速。'},
{id:'assessment',short:'A · 证据与机制',tag:'ASSESSMENT · 综合推理',title:'哪些已经知道，哪些仍是假设？',purpose:'用多因素证据解释不稳，给未知留出位置。'},
{id:'plan',short:'P · 共同计划',tag:'PLAN · 回到生活',title:'让训练回应她想做的事。',purpose:'目标、训练靶点和复评指标彼此对应。'},
{id:'post',short:'目标自测与拓展',tag:'CHECK & EXPLORE',title:'试着解释，再检验自己的理解。',purpose:'完成知识后测，也可以向动小助继续追问。'},
{id:'reflection',short:'三个问题 · 完成',tag:'REFLECT & CONTINUE',title:'带走发现，也留下问题。',purpose:'完成三个开放问题，提交本轮实训。'}];
export const GAIT={cycle:1.2,stride:.88,stance:.56,swing:.44};
export const archIndex=(rear,mid,fore)=>mid/(rear+mid+fore);
export function copSeries(scale=1){return Array.from({length:1501},(_,i)=>[i/50,scale*(3*Math.sin(i/50*1.7)+Math.sin(i/50*4.1)),scale*(5*Math.sin(i/50*1.1)+.7*Math.cos(i/50*3.2))]);}
export function copStats(p){let length=0;for(let i=1;i<p.length;i++)length+=Math.hypot(p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);const t=p.at(-1)[0]-p[0][0],xs=p.map(p=>p[1]),ys=p.map(p=>p[2]);return{durationSeconds:t,pathMM:length,meanVelocityMMs:length/t,boundingAreaMM2:(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))};}
