/* Explicit bone topology for the attributed static atlas. Finite teaching motion.
 * Course membership controls visibility only; it NEVER selects moving bones.
 * Coordinates remain in the source atlas frame. No accumulated per-frame pose.
 */
(function(g){'use strict';
const handKeys=new Set(['scaphoid','lunate','triquetral','pisiform','trapezium','trapezoid','capitate','hamate',...Array.from({length:5},(_,i)=>'mc'+(i+1))]);
const footKeys=new Set(['talus','calcaneus','navicular','cuboid','cuneiformM','cuneiformI','cuneiformL',...Array.from({length:5},(_,i)=>'mt'+(i+1))]);
const isHand=p=>handKeys.has(p.key)||/^finger[1-5]_/.test(p.key);
const isFoot=p=>footKeys.has(p.key)||/^toe[1-5]_/.test(p.key);
class JointRig {
 constructor(parts){this.parts=parts;this.landmarks=g.DXXJointLandmarks;}
 mark(key,which='center',side='right'){
  const row=this.landmarks[side]?.[key]||this.landmarks.bilateral?.[key];
  if(!row?.[which])throw Error('Missing source landmark: '+side+'/'+key+'/'+which);
  return row[which].slice();
 }
 pose(action,time){
  const M=g.SM,I=()=>M.ident(),s=action.side==='left'?-1:1,side=s<0?'left':'right',t=M.clamp(Number(time)||0,0,1),m=action.motion;
  const span=(a,b)=>a+(b-a)*t,pt=(key,which='center',whichSide=side)=>this.mark(key,which,whichSide),mid=(a,b)=>M.mul(M.add(a,b),.5);
  const R=(axis,degrees,c)=>M.rotate(axis,degrees*Math.PI/180,c),matrices=this.parts.map(I),anchors=[];
  let center=pt('humerus','head'),axis=[1,0,0],angle=0;
  const apply=(pred,T,allSides=false)=>this.parts.forEach((p,i)=>{if(p.type==='bone'&&(allSides||p.side===side)&&pred(p))matrices[i]=T;});
  const arm=p=>['humerus','radius','ulna'].includes(p.key)||isHand(p),forearm=p=>['radius','ulna'].includes(p.key)||isHand(p),leg=p=>['femur','patella','tibia','fibula'].includes(p.key)||isFoot(p);
  const shoulder=pt('humerus','head'),elbow=mid(pt('humerus','yLow'),pt('ulna','yHigh'));
  // Use the distal humeral articular level, not the tip of the olecranon.
  elbow[1]=pt('humerus','yLow')[1]+.004;
  const wrist=mid(pt('scaphoid','yHigh'),pt('lunate','yHigh'));
  const hip=pt('femur','head'),knee=pt('femur','yLow');knee[1]+=.012;
  const longArm=M.norm(M.sub(shoulder,elbow)),longLeg=M.norm(M.sub(hip,knee));
  const anchor=(c,moving,fixed)=>anchors.push({point:c,moving,fixed});
  if(m==='shoulderFlex'||m==='shoulderAbd'||m==='shoulderRotate'){
   center=shoulder;axis=m==='shoulderRotate'?longArm:m==='shoulderAbd'?[0,0,1]:[1,0,0];
   angle=m==='shoulderFlex'?span(0,-70):m==='shoulderAbd'?s*span(0,-65):s*span(-25,25);
   const T=R(axis,angle,center);apply(arm,T);anchor(center,'humerus','scapula');
   if(m==='shoulderRotate'){
    const E=R([1,0,0],-90,elbow);apply(forearm,M.matmul(T,E));anchor(elbow,'radius','humerus');
   }
  }else if(m==='elbow'){
   center=elbow;angle=span(0,-85);apply(forearm,R(axis,angle,center));anchor(center,'ulna','humerus');
  }else if(m==='forearm'){
   // Radius rotates around radial-head to distal-ulnar-head axis. Elbow setup
   // is then applied to BOTH forearm bones and the hand in the same frame.
   const proximal=pt('radius','yHigh'),distal=pt('ulna','yLow');center=proximal;axis=M.norm(M.sub(proximal,distal));angle=s*span(0,120);
   const E=R([1,0,0],-90,elbow),P=R(axis,angle,center);
   apply(forearm,E);apply(p=>p.key==='radius'||isHand(p),M.matmul(E,P));
   anchor(center,'radius','ulna');center=M.point(E,center);axis=M.vec(E,axis);
  }else if(m==='wristFlex'||m==='wristDev'){
   center=wrist;axis=m==='wristDev'?[0,0,1]:[1,0,0];angle=(m==='wristDev'?s:1)*span(-25,25);
   apply(isHand,R(axis,angle,center));anchor(center,'scaphoid','radius');
  }else if(m==='fingerFlex'||m==='fingerSpread'||m==='thumb'){
   center=mid(pt('mc3','yLow'),pt('finger3_proximal','yHigh'));axis=m==='fingerSpread'?[0,0,1]:[1,0,0];angle=span(0,m==='fingerFlex'?-55:25);
   const digits=m==='thumb'?[1]:[2,3,4,5];
   for(const digit of digits){
    const prefix='finger'+digit+'_',mc='mc'+digit;
    const c=mid(pt(mc,'yLow'),pt(prefix+'proximal','yHigh'));
    if(m==='thumb'){
     const cmc=mid(pt('trapezium','yLow'),pt('mc1','yHigh'));
     const T=M.matmul(R([0,0,1],s*t*32,cmc),R(M.norm(M.sub(pt(mc,'yLow'),pt(mc,'yHigh'))),s*t*20,cmc));
     apply(p=>p.key==='mc1'||p.key.startsWith(prefix),T);anchor(cmc,'mc1','trapezium');
    }else if(m==='fingerSpread'){
     const spread={2:-12,3:0,4:7,5:14}[digit]*s*t;
     apply(p=>p.key.startsWith(prefix),R(axis,spread,c));anchor(c,prefix+'proximal',mc);
    }else{
     let parent=R(axis,angle,c);apply(p=>p.key===prefix+'proximal',parent);anchor(c,prefix+'proximal',mc);
     let prev=prefix+'proximal';
     for(const [segment,bend] of [['middle',-45],['distal',-25]]){
      const key=prefix+segment,j=mid(pt(prev,'yLow'),pt(key,'yHigh'));
      parent=M.matmul(parent,R(axis,t*bend,j));apply(p=>p.key===key,parent);anchor(j,key,prev);prev=key;
     }
    }
   }
   if(m==='thumb'){center=mid(pt('trapezium','yLow'),pt('mc1','yHigh'));axis=[0,0,1];}
  }else if(m?.startsWith('hip')){
   center=hip;axis=m==='hipRotate'?longLeg:m==='hipAbd'?[0,0,1]:[1,0,0];
   angle=m==='hipFlex'?span(10,-55):m==='hipAbd'?s*span(10,-25):s*span(-18,18);
   apply(leg,R(axis,angle,center));anchor(center,'femur','hip');
  }else if(m==='knee'){
   center=knee;angle=span(0,70);apply(p=>['tibia','fibula'].includes(p.key)||isFoot(p),R(axis,angle,center));
   // A bounded patellar teaching path; never rotate the reference femur.
   apply(p=>p.key==='patella',R(axis,angle*.5,center));anchor(center,'tibia','femur');
  }else if(m==='ankle'||m==='footTilt'){
   center=pt('talus');axis=m==='footTilt'?M.norm([s*.35,.45,.82]):M.norm(M.mul(M.sub(pt('tibia','yLow'),pt('fibula','yLow')),s));
   angle=m==='ankle'?(action.id==='10-1'?span(0,-15):action.id==='10-2'?span(0,25):span(25,-15)):s*span(-12,12);
   // Talus belongs to the ankle hinge, but remains the reference for hindfoot tilt.
   apply(p=>isFoot(p)&&(m!=='footTilt'||p.key!=='talus'),R(axis,angle,center));
   anchor(center,m==='ankle'?'talus':'calcaneus',m==='ankle'?'tibia':'talus');
  }else if(m==='toeFlex'){
   angle=span(-15,25);center=mid(pt('mt2','zHigh'),pt('toe2_proximal','zLow'));
   for(let digit=1;digit<=5;digit++){
    const prefix='toe'+digit+'_',c=mid(pt('mt'+digit,'zHigh'),pt(prefix+'proximal','zLow'));
    apply(p=>p.key.startsWith(prefix),R(axis,angle,c));anchor(c,prefix+'proximal','mt'+digit);
   }
  }else if(action.kind==='pelvis3d'){
   const support=action.supportSide==='left'?'left':'right';
   center=m==='pelvisSupport'?pt('femur','head',support):mid(pt('femur','head','right'),pt('femur','head','left'));
   axis=m==='pelvisSupport'?[0,0,1]:[1,0,0];angle=span(-8,8);
   apply(p=>['hip','sacrum'].includes(p.key),R(axis,angle,center),true);
  }else if(m?.startsWith('trunk')){
   axis=m==='trunkSide'?[0,0,1]:m==='trunkRotate'?[0,1,0]:[1,0,0];angle=span(-12,12);
   const chain=['L5','L4','L3','L2','L1',...Array.from({length:12},(_,i)=>'T'+(12-i))];
   let parent=I(),previous='sacrum';const poses={};center=mid(pt('sacrum','yHigh'),pt('L5','yLow'));
   for(const key of chain){const c=mid(pt(previous,'yHigh'),pt(key,'yLow'));parent=M.matmul(parent,R(axis,angle/chain.length,c));poses[key]=parent;apply(p=>p.key===key,parent,true);anchor(c,key,previous);previous=key;}
   const upper=poses.T1;apply(p=>/^C[1-7]$/.test(p.key)||['clavicle','scapula','humerus','radius','ulna','manubrium','sternum','xiphoid','occiput','temporal'].includes(p.key)||isHand(p),upper,true);
   for(let level=1;level<=12;level++)apply(p=>p.key==='rib'+level,poses['T'+level],true);
  }else if(action.kind==='fsu'){
   center=mid(pt('L4','yHigh'),pt('L3','yLow'));const q=(t-.5)*2;
   if(['ap','ml','axialT'].includes(m)){axis=m==='ap'?[0,0,1]:m==='ml'?[1,0,0]:[0,1,0];const T=I();for(let j=0;j<3;j++)T[12+j]=axis[j]*q*.002;apply(p=>p.key==='L3',T,true);}
   else{axis=m==='lateral'?[0,0,1]:m==='axial'?[0,1,0]:[1,0,0];angle=q*4;apply(p=>p.key==='L3',R(axis,angle,center),true);anchor(center,'L3','L4');}
  }
  return {matrices,center,axis,angle,anchors};
 }
}
g.DXXJointRig=JointRig;
})(window);
