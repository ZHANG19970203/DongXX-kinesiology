import assert from 'node:assert/strict';
import {walkingPrinciples as sample,walkingVisualSample,WALKING_DEMO as cfg} from '../clinic3d/walking-principles-v26.js';
import {GAIT_CASE} from '../clinic3d/gait-lesson.js';
import {FLOW} from '../clinic3d/case-flow.js';
import {FILM_SEQUENCE} from '../clinic3d/film-sequence-data.js';
let n=0; const check=x=>{assert.ok(x);n++;};
let mean=0;
for(let i=0;i<1000;i++){
 const p=i/1000,d=sample(p),f=d.force;
 check(Object.values(f).every(x=>Number.isFinite(x)&&x>=0));
 check(Math.abs(f.rightBW+f.leftBW-f.totalBW)<1e-12);
 check(Math.abs(f.totalBW-1-d.acceleration/cfg.gravity)<1e-12);
 for(const side of ['right','left'])if(!d.pose[side].contact)check(f[side+'BW']<1e-10);
 const h=1e-5,acc=(sample(p+h).vertical-2*d.vertical+sample(p-h).vertical)/(h*cfg.cycleSeconds)**2;
 check(Math.abs(acc-d.acceleration)<1e-5);
 check(Math.abs(sample(p+1).vertical-d.vertical)<1e-12);
 check(Math.abs(walkingVisualSample(p,3).reference.vertical-3*d.vertical)<1e-12);
 mean+=f.totalBW/1000;
}
check(Math.abs(mean-1)<1e-12);
check(Math.abs(sample(.3).vertical-cfg.verticalAmplitudeM)<1e-12);
check(Math.abs(sample(.05).vertical+cfg.verticalAmplitudeM)<1e-12);
check(sample(.8).force.rightBW===0&&sample(.3).force.leftBW===0);
for(const p of [0,.1,.5,.6,1])check(Math.abs(sample(p-1e-8).force.rightBW-sample(p+1e-8).force.rightBW)<1e-5);
check(GAIT_CASE.stance.right===.56&&GAIT_CASE.leftContactPhase===.46);
assert.throws(()=>sample(NaN));
const forbidden=/直接加载|结束加载|继续加载|返场|请回稳/;
for(const node of Object.values(FLOW)){check(!forbidden.test(node.text));for(const o of node.options||[])check(!forbidden.test(o.shortLabel||o.label));}
for(const clip of FILM_SEQUENCE.clips)for(const lines of [clip.normal,...clip.alternative.map(a=>a.lines)])for(const line of lines)check(!forbidden.test(line.text));
console.log(JSON.stringify({passed:n,forceBalance:true,airborneForceZero:true,teachingOnly:true,naturalLanguage:true}));
