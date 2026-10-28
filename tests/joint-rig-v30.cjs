const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2]||require('node:path').resolve(__dirname,'..');
const ctx={window:null,console,requestAnimationFrame:()=>0};ctx.window=ctx;vm.createContext(ctx);
for(const name of ['joint-landmarks-v30.js','joint-rig-v30.js'])vm.runInContext(fs.readFileSync(root+'/lab/assets/'+name,'utf8'),ctx);
const app=fs.readFileSync(root+'/lab/assets/app.js','utf8');
vm.runInContext(app.slice(0,app.indexOf('})(window);',app.indexOf('g.ModelStage=ModelStage;'))+'})(window);'.length),ctx);
ctx.createLabViewer=()=>({addDataset(){},use(name,T){this.transforms=T;},invalidate(){},saveView(){},yaw:-.45,pitch:.08,fov:.61});
const data=JSON.parse(fs.readFileSync(root+'/lab/assets/app-data.json','utf8')),parts=data.anatomy.model.parts;
const rig=new ctx.DXXJointRig(parts),I=Array.from(ctx.SM.ident()),distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const idx=(key,side)=>parts.findIndex(p=>p.key===key&&(p.side===side||p.side==='bilateral'));
const actions=data.curriculum.modules.flatMap(c=>c.actions).filter(a=>['native','pelvis3d','fsu'].includes(a.kind));
let frames=0,anchorChecks=0,fixedChecks=0,maxAnchorError=0,cameraChecks=0;
for(const action of actions)for(const side of ['right','left']){
 const a={...action,side},stage=new ctx.ModelStage({clientWidth:1180,clientHeight:490},{anatomy:data.anatomy,motions:data.motions});
 stage.set(a,.5);
 for(let step=0;step<=20;step++){
  const t=step/20,p=rig.pose(a,t);frames++;
  assert.equal(p.matrices.length,parts.length);
  for(const T of p.matrices){assert.ok(Array.from(T).every(Number.isFinite));assert.ok(Math.abs(Math.hypot(T[0],T[1],T[2])-1)<1e-6);}
  for(const anchor of p.anchors){
   const moving=idx(anchor.moving,side),fixed=idx(anchor.fixed,side);assert.ok(moving>=0&&fixed>=0,JSON.stringify(anchor));
   const error=distance(ctx.SM.point(p.matrices[moving],anchor.point),ctx.SM.point(p.matrices[fixed],anchor.point));
   maxAnchorError=Math.max(error,maxAnchorError);assert.ok(error<1e-6,`${a.id}/${side}/${t} ${anchor.moving} separates from ${anchor.fixed}: ${error}`);anchorChecks++;
  }
  const fixedKeys=a.motion==='elbow'?['humerus','scapula','clavicle']:a.motion==='knee'?['femur','hip']:a.motion?.startsWith('wrist')||['fingerFlex','fingerSpread','thumb'].includes(a.motion)?['humerus','radius','ulna']:a.motion==='ankle'||a.motion==='footTilt'||a.motion==='toeFlex'?['femur','patella','tibia','fibula']:a.motion?.startsWith('hip')?['hip','sacrum']:a.motion?.startsWith('shoulder')?['scapula','clavicle']:[];
  for(const key of fixedKeys){assert.deepEqual(Array.from(p.matrices[idx(key,side)]),I,`${a.id} reference bone ${key} moved`);fixedChecks++;}
  if(a.kind!=='pelvis3d'&&!a.motion?.startsWith('trunk'))for(let i=0;i<parts.length;i++)if(parts[i].side===(side==='right'?'left':'right'))assert.deepEqual(Array.from(p.matrices[i]),I,'opposite side drifted');
  stage.update(t);
  // The same source pose produces identical output after arbitrary prior frames.
  stage.update(1-t);stage.update(t);
  assert.deepEqual(stage.viewer.transforms.map(x=>Array.from(x)),p.matrices.map(x=>Array.from(x)));
 }
 for(const yaw of [0,-Math.PI/2,Math.PI]){
  stage.viewer.yaw=yaw;stage.fitAll();const v=stage.viewer;
  for(let step=0;step<=20;step++){
   stage.update(step/20);const eye=ctx.SM.add(v.target,[v.radius*Math.cos(v.pitch)*Math.sin(yaw),v.radius*Math.sin(v.pitch),v.radius*Math.cos(v.pitch)*Math.cos(yaw)]);
   const vp=ctx.SM.matmul(ctx.SM.perspective(v.fov,1180/490,.0001,20),ctx.SM.lookAt(eye,v.target));
   parts.forEach((bone,i)=>{if(!v.visible[i])return;for(let k=0;k<8;k++){
    const point=ctx.SM.point(v.transforms[i],bone.bounds[0].map((_,j)=>bone.bounds[(k>>j)&1][j]));
    const clip=ctx.SM.point(vp,point),w=vp[3]*point[0]+vp[7]*point[1]+vp[11]*point[2]+vp[15];
    assert.ok(w>0&&Math.abs(clip[0]/w)<1.01&&Math.abs(clip[1]/w)<1.01,`${a.id}/${side} camera crops ${bone.key}`);cameraChecks++;
   }});
  }
 }
}
const result={passed:true,actions:actions.length,sides:2,frames,anchorChecks,maxAnchorErrorM:maxAnchorError,fixedBoneChecks:fixedChecks,cameraCornerChecks:cameraChecks,limits:['Finite teaching articulation; does not validate clinical joint contact, scapulohumeral rhythm or individual range of motion.']};
fs.writeFileSync(root+'/docs/joint-check-v30.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
