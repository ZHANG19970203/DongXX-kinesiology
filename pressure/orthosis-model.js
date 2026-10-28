// Dimensionless educational contact model. NOT patient data or an orthosis prescription.
export const MODEL_VERSION='contact-teaching-v28.1';
const exp=Math.exp;
export function outline(y){const cap=y<.08?Math.sqrt(Math.max(0,1-((y-.08)/.08)**2)):y>.90?Math.sqrt(Math.max(0,1-((y-.90)/.10)**2)):1;const width=(.23+.08*exp(-(((y-.25)/.22)**2))-.065*exp(-(((y-.55)/.17)**2)))*cap;const center=.045*Math.sin(y*Math.PI);return [center-width,center+width];}
export function point(x,y){const [lo,hi]=outline(y);return y>=0&&y<=1&&x>=lo&&x<=hi;}
const bump=(x,y,cx,cy,sx,sy)=>exp(-.5*(((x-cx)/sx)**2+((y-cy)/sy)**2));
export function buildCells(){const cells=[];for(let j=0;j<=66;j++)for(let i=0;i<=44;i++){const x=-.35+i*.7/44,y=j/66;if(!point(x,y))continue;const medial=x<.04;cells.push({x,y,zone:y<.36?'fore':y>.73?'heel':medial?'medial':'lateral',gap:.05+.45*bump(x,y,-.13,.54,.13,.16)+.24*bump(x,y,.15,.53,.16,.16)});}return cells;}
export function fillAt(x,y,{height=0,target='arch',shape='broad',material='soft',mode='support'}={}){const c=target==='heel'?[-.10,.84]:target==='fore'?[-.12,.24]:[-.12,.54];const narrow=shape==='narrow';return height*.29*(mode==='relief'?-1:1)*bump(x,y,...c,narrow?.045:.13,narrow?.055:.17);}
export function solve(settings={}){const cells=buildCells(),stiffness=settings.material==='firm'?1.8:1;
 const f=c=>fillAt(c.x,c.y,settings);const k=c=>1+(stiffness-1)*Math.min(1,Math.abs(f(c))/.5);const totalAt=z=>cells.reduce((s,c)=>s+k(c)*Math.max(0,z+f(c)-c.gap),0);
 // Same total vertical load in every trial; all cells have equal area.
 const total=260;let lo=-5,hi=5;for(let n=0;n<70;n++){const z=(lo+hi)/2;if(totalAt(z)>total)hi=z;else lo=z;}const z=(lo+hi)/2;
 const values=cells.map(c=>k(c)*Math.max(0,z+f(c)-c.gap)),sum=values.reduce((a,b)=>a+b,0),peak=Math.max(...values),contact=values.filter(v=>v>.000001).length/cells.length;
 const zones={fore:0,medial:0,lateral:0,heel:0};cells.forEach((c,i)=>zones[c.zone]+=values[i]/sum);
 return {version:MODEL_VERSION,settings:{...settings},cells,values,sum,peak,contact,zones,cop:[cells.reduce((a,c,i)=>a+c.x*values[i],0)/sum,cells.reduce((a,c,i)=>a+c.y*values[i],0)/sum]};
}
