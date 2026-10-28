import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(process.argv[2] || path.join(here,'..'));
const reportDir=path.resolve(process.argv[3]||path.join(base,'..','..','actor-qa'));
await fs.mkdir(reportDir,{recursive:true});
const cache = new Map();
async function moduleAt(filename) {
  filename = path.normalize(filename);
  if (cache.has(filename)) return cache.get(filename);
  const source = await fs.readFile(filename, 'utf8');
  const value = new vm.SourceTextModule(source, { identifier: filename });
  cache.set(filename, value);
  for (const name of value.dependencySpecifiers) {
    const target = name === 'three' ? path.join(base,'vendor/three/build/three.module.js')
      : name.startsWith('three/addons/') ? path.join(base,'vendor/three/examples/jsm', name.slice(13))
      : path.resolve(path.dirname(filename), name);
    await moduleAt(target);
  }
  return value;
}
const actorModule = await moduleAt(path.join(base,'actors.js'));
await actorModule.link((name,parent)=>cache.get(path.normalize(name === 'three' ? path.join(base,'vendor/three/build/three.module.js')
      : name.startsWith('three/addons/') ? path.join(base,'vendor/three/examples/jsm', name.slice(13))
      : path.resolve(path.dirname(parent.identifier), name))));
await actorModule.evaluate();
const THREE = cache.get(path.join(base,'vendor/three/build/three.module.js')).namespace;
const loader = cache.get(path.join(base,'vendor/three/examples/jsm/loaders/GLTFLoader.js')).namespace;
loader.GLTFLoader.prototype.loadAsync = async function(url) {
  const b = await fs.readFile(path.join(base,url));
  return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength), '');
};
const scene = new THREE.Scene();
const actors = await actorModule.namespace.createActors(scene,{modelUrl:'assets/patient-motion.glb'});
actors.patient.setPosition([0,0,0]).face(0);
actors.therapist.setPosition([0,0,0]).face(0);
const rest = {};
for (const name of ['foot.L','foot.R','wrist.L','wrist.R','upperarm01.L','lowerarm01.L','root']) {
  const b = actors.patient.bones.get(name); rest[name] = b.getWorldPosition(new THREE.Vector3()).toArray();
}
const feet = { L:new THREE.Box3(), R:new THREE.Box3() };
actors.patient.model.traverse(o=>{
  if (!o.isSkinnedMesh || !o.name.includes('Patient_Skin')) return;
  for(let i=0;i<o.geometry.attributes.position.count;i++) {
    const p=o.getVertexPosition(i,new THREE.Vector3());
    if(p.y<.095) feet[p.x>0?'L':'R'].expandByPoint(p);
  }
});
const minGeometryY=actor=>{
  let skin=Infinity,shoe=Infinity,finite=true;
  actor.root.updateMatrixWorld(true);
  actor.root.traverse(o=>{
    if(!o.isMesh)return;
    const isSkin=o.isSkinnedMesh&&o.name.includes('Patient_Skin');
    const isShoe=/^Shoe_/.test(o.name);
    if(!isSkin&&!isShoe)return;
    for(let i=0;i<o.geometry.attributes.position.count;i++) {
      const p=o.isSkinnedMesh?o.getVertexPosition(i,new THREE.Vector3()):new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.position,i);
      p.applyMatrix4(o.matrixWorld);finite&&=[p.x,p.y,p.z].every(Number.isFinite);
      if(isSkin)skin=Math.min(skin,p.y);else shoe=Math.min(shoe,p.y);
    }
  });
  return{skin,shoe,finite};
};
const samples=[];let maxAnkleTargetError=0,maxErrorDetail;
const gait=cache.get(path.join(base,'gait-lesson.js')).namespace;
for(let i=0;i<=100;i++) {
  const p=i/100;actors.patient.setPosition([0,0,p*.88]).setGaitPhase(p);
  const sample=gait.sampleGait(p);
  for(const [side,key] of [['L','left'],['R','right']]) {
    const actual=actors.patient.bones.get(`foot.${side}`).getWorldPosition(new THREE.Vector3());
    const target=new THREE.Vector3(-sample[key].foot.lateral,rest[`foot.${side}`][1]+sample[key].foot.height,p*.88+sample[key].foot.forward);
    if(target.distanceTo(actual)>maxAnkleTargetError){maxAnkleTargetError=target.distanceTo(actual);maxErrorDetail={p,side,target:target.toArray(),actual:actual.toArray()};}
  }
  samples.push(minGeometryY(actors.patient));
}
actors.patient.setPosition([0,0,0]).setTalking(false);actors.patient.setPose('standing',true);actors.patient.setLocomotion(false);
for(let i=0;i<60;i++)actors.patient.update(.1);
const neutralWrist=actors.patient.bones.get('wrist.L').getWorldPosition(new THREE.Vector3());
actors.patient.setTalking(true);
for(let i=0;i<20;i++)actors.patient.update(.1);
const talkingWristDrift=neutralWrist.distanceTo(actors.patient.bones.get('wrist.L').getWorldPosition(new THREE.Vector3()));
actors.patient.setFootwear('barefoot');const patientBarefoot=actors.patient.getState().footwear==='barefoot'&&!actors.patient.bones.get('foot.L').children.find(o=>o.name==='Authored_unbranded_shoe.L').visible;
actors.therapist.setFootwear('barefoot');const therapistRemainsShod=actors.therapist.getState().footwear==='shoes';
actors.patient.setFootwear('shoes').setTalking(false).setPose('seated',true);const seated=minGeometryY(actors.patient);
const ordinary=[];actors.patient.setPose('standing',true);actors.patient.setLocomotion(true);
for(let i=0;i<50;i++){actors.patient.update(.08);ordinary.push(minGeometryY(actors.patient));}
actors.patient.setLocomotion(false);actors.patient.setPose('seated');
const transfers=[];for(let i=0;i<20;i++){actors.patient.update(.08);transfers.push(minGeometryY(actors.patient));}
const report={independentSkeletons:actors.details.independentSkeletons,gaitSamples:samples.length,
  minimumSkinY:Math.min(...samples.map(s=>s.skin)),minimumShoeY:Math.min(...samples.map(s=>s.shoe)),
  maximumAnkleTargetErrorMetres:maxAnkleTargetError,maxErrorDetail,allFinite:samples.every(s=>s.finite),seated,
  talkingWristDriftMetres:talkingWristDrift,patientBarefootToggle:patientBarefoot,therapistRemainsShod,
  ordinaryWalkingSamples:ordinary.length,ordinaryWalkingMinimumShoeY:Math.min(...ordinary.map(s=>s.shoe)),
  sitTransferSamples:transfers.length,sitTransferMinimumShoeY:Math.min(...transfers.map(s=>s.shoe)),
  scope:'CPU skin and original shoe mesh samples only; no renderer, continuous collision or clinical gait validation.'};
const context=new Proxy({measureText:()=>({width:60}),createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({width:1024,height:768,getContext:()=>context})};
const roomModule=await moduleAt(path.join(base,'scene-room.js'));
await roomModule.link((name,parent)=>cache.get(path.normalize(name==='three'?path.join(base,'vendor/three/build/three.module.js'):path.resolve(path.dirname(parent.identifier),name))));
await roomModule.evaluate();
const roomScene=new THREE.Scene();const room=roomModule.namespace.createClinicRoom(roomScene);roomScene.updateMatrixWorld(true);
let roomMeshes=0,roomVertices=0,invalidVertices=0;
roomScene.traverse(o=>{if(!o.isMesh)return;roomMeshes++;const p=o.geometry.attributes.position;roomVertices+=p.count;for(let i=0;i<p.count;i++)if(![p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite))invalidVertices++;});
const normal=room.objects.monitor.getWorldDirection(new THREE.Vector3());
const roomReport={roomMeshes,roomVertices,invalidVertices,monitorNormal:normal.toArray(),
  monitorFacesTherapist:normal.z<-.999,monitorAssemblyYaw:room.objects.monitorAssembly.rotation.y,
  keyboardWorldPosition:room.objects.root.getObjectByName('ClinicianKeyboard').getWorldPosition(new THREE.Vector3()).toArray(),
  scope:'Geometry and orientation only; scene composition and clinical process require visual/professional review.'};
console.log(JSON.stringify(report,null,2));
await fs.writeFile(path.join(reportDir,'actor-structure-v10.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(roomReport,null,2));
await fs.writeFile(path.join(reportDir,'room-structure-v10.json'),JSON.stringify(roomReport,null,2));
if(!report.allFinite||report.minimumShoeY<-.001||maxAnkleTargetError>.002||!patientBarefoot||!therapistRemainsShod)process.exitCode=1;
