import assert from 'node:assert/strict';
import {footRocker} from '../clinic3d/walking-pose-v27.js';
import {walkingVisualSample,walkingPrinciples} from '../clinic3d/walking-principles-v26.js';
let checks=0;const check=x=>{assert(x);checks++;};
for(let i=0;i<=1000;i++){
 const p=i/1000,r=footRocker(p),d=walkingVisualSample(p);
 const heelY=r.ankleHeight-.0678*Math.cos(r.pitch)-.065*Math.sin(r.pitch);
 const toeY=r.ankleHeight-.0678*Math.cos(r.pitch)+.180*Math.sin(r.pitch);
 check(heelY>=-1e-10&&toeY>=-1e-10);
 if(r.contact)check(Math.abs(Math.min(heelY,toeY))<1e-10);
 check(d.visualGait==='heel-toe-v27');
 check(d.right.contact===walkingPrinciples(p).pose.right.contact);
 check(Object.values(d.right.foot).every(Number.isFinite));
}
check(footRocker(0).pitch>0);check(footRocker(.5).pitch<0);check(footRocker(.7).clearance>0);
check(Math.abs(footRocker(0).ankleHeight-footRocker(1).ankleHeight)<1e-12);
console.log(JSON.stringify({checks,passed:true,scope:'authored contact geometry and phase consistency, not clinical validation'}));
