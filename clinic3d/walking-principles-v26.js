import {sampleGait,GAIT_CASE} from './gait-lesson.js';
import {applyWalkingPose} from './walking-pose-v27.js';
// Original analytic teaching model, NOT digitized literature or patient data.
// Vertical force is derived from the same COM motion, not an unrelated curve.
export const WALKING_DEMO=Object.freeze({cycleSeconds:1.2,verticalAmplitudeM:.018,lateralAmplitudeM:.020,gravity:9.81,stance:.6,leftContact:.5});
export const WALKING_PROFILE={...GAIT_CASE,id:'symmetric-principle-demo-v26',stance:{right:.6,left:.6},stepLength:{right:.44,left:.44},leftContactPhase:.5};
const wrap=p=>((p%1)+1)%1;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
export function walkingPrinciples(input){
 if(!Number.isFinite(input))throw new TypeError('Finite cycle phase required');
 const p=wrap(input),{cycleSeconds:T,verticalAmplitudeM:A,lateralAmplitudeM:B,gravity:g}=WALKING_DEMO,w=4*Math.PI/T;
 const a=4*Math.PI*(p-.05),vertical=-A*Math.cos(a),velocity=A*w*Math.sin(a),acceleration=A*w*w*Math.cos(a);
 const lateral=B*Math.cos(2*Math.PI*(p-.30)),totalBW=1+acceleration/g;
 let rightShare=p<.1?smooth(p/.1):p<.5?1:p<.6?1-smooth((p-.5)/.1):0;
 const force={rightBW:rightShare*totalBW,leftBW:(1-rightShare)*totalBW,totalBW};
 const pose=sampleGait(p,WALKING_PROFILE);
 const phaseName=p<.1?'双足支撑 · 右足逐渐承重':p<.3?'右足单支撑 · 身体向前越过右脚':p<.5?'右足单支撑 · 接近下一步':p<.6?'双足支撑 · 重量转向左脚':'右足摆动 · 左足继续支撑';
 return {phase:p,phaseName,vertical,lateral,velocity,acceleration,force,pose,measured:false};
}
export function walkingVisualSample(p,gain=1){const d=walkingPrinciples(p);return applyWalkingPose({...d.pose,reference:{...d.pose.reference,vertical:d.vertical*gain,lateral:d.lateral*gain,kind:'analytic_teaching_com'}});}
export const WALKING_SOURCES=[
 {title:'Fukuchi等，2018：健康成人步行运动学与动力学公开数据',url:'https://doi.org/10.7717/peerj.4640',supports:'步速、年龄与行走条件影响曲线；本页没有复制其数值作为本患者结果。'},
 {title:'Cavagna与Legramandi，2020：步行质心的能量和相位关系',url:'https://journals.biologists.com/jeb/article/223/21/jeb232645/226159/The-phase-shift-between-potential-and-kinetic',supports:'人体质心在步行中上下移动，受力、速度和位置存在相位关系。'},
 {title:'OpenStax《大学物理》9.6：质心与系统运动',url:'https://openstax.org/books/university-physics-volume-1/pages/9-6-center-of-mass',supports:'质心为质量加权位置；合外力决定质心加速度。'}
];
