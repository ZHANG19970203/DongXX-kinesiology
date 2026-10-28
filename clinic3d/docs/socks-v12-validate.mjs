import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const base=path.resolve(process.argv[2]||path.join(here,'..'));
const out=path.resolve(process.argv[3]||path.join(here,'socks-v12-check.json'));
const cache=new Map();
const resolve=(name,parent)=>path.normalize(name==='three'?path.join(base,'vendor/three/build/three.module.js'):name.startsWith('three/addons/')?path.join(base,'vendor/three/examples/jsm',name.slice(13)):path.resolve(path.dirname(parent),name));
async function moduleAt(file){file=path.normalize(file);if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(await fs.readFile(file,'utf8'),{identifier:file});cache.set(file,m);for(const name of m.dependencySpecifiers)await moduleAt(resolve(name,file));return m;}
const m=await moduleAt(path.join(base,'actors.js'));await m.link((name,parent)=>cache.get(resolve(name,parent.identifier)));await m.evaluate();
const THREE=cache.get(path.join(base,'vendor/three/build/three.module.js')).namespace;
const Loader=cache.get(path.join(base,'vendor/three/examples/jsm/loaders/GLTFLoader.js')).namespace.GLTFLoader;
Loader.prototype.loadAsync=async function(url){const b=await fs.readFile(path.join(base,url));return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const scene=new THREE.Scene();
const actors=await m.namespace.createActors(scene,{modelUrl:'assets/patient-motion.glb'});
const patient=actors.patient;patient.setPosition([0,0,0]).face(0).setPose('standing',true);
const initialStaticFeet=['L','R'].map(s=>patient.bones.get(`foot.${s}`).getWorldPosition(new THREE.Vector3()));
patient.setPose('seated',true);
const depositsGroup=scene.getObjectByName('Patient_world_stationary_removed_garments');
const garment=name=>patient.root.getObjectByName(name)||depositsGroup.getObjectByName(name);
const check={schema:'dxx-socks-action-v12',durationSeconds:17.6,states:[],allFinite:true,minimumVisiblePropY:Infinity,maximumSampledWristStepMetres:0};
const worn=['L','R'].map(s=>patient.root.getObjectByName(`Authored_worn_sock.${s}`));
check.initialSocksWorn=worn.every(o=>o.visible&&o.isSkinnedMesh&&o.geometry.index.count>0);
check.initialShoesWorn=['L','R'].every(s=>patient.root.getObjectByName(`Authored_unbranded_shoe.${s}`).visible);
patient.startFootwearRemoval();
let previousWrist=null,last='';
for(let i=0;i<=178;i++) {
 patient.update(.1);patient.root.updateMatrixWorld(true);
 const state=patient.getState().footwearRemoval;
 const label=`${state.side}:${state.phase}`;
 if(label!==last){check.states.push({t:Number(state.elapsed.toFixed(2)),side:state.side,phase:state.phase});last=label;}
 const wrist=patient.bones.get(`wrist.${state.side||'R'}`).getWorldPosition(new THREE.Vector3());
 if(previousWrist&&previousWrist.side===state.side)check.maximumSampledWristStepMetres=Math.max(check.maximumSampledWristStepMetres,wrist.distanceTo(previousWrist.point));
 previousWrist={side:state.side,point:wrist};
 patient.root.traverse(o=>{
   if(!o.isMesh)return;
   for(const attr of Object.values(o.geometry.attributes))for(const x of attr.array)if(!Number.isFinite(x))check.allFinite=false;
   if(!o.visible||!/^Shoe_|^Authored_removed_sock/.test(o.name))return;
   const p=o.geometry.attributes.position,index=o.geometry.index;
   for(let j=0;j<(index?index.count:p.count);j++){
     const id=index?index.getX(j):j,point=new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(o.matrixWorld);
     check.allFinite&&=[point.x,point.y,point.z].every(Number.isFinite);check.minimumVisiblePropY=Math.min(check.minimumVisiblePropY,point.y);
   }
 });
}
check.completed=patient.getState().footwearRemoval.completed&&patient.getState().footwear==='barefoot';
check.bothSocksDeposited=['L','R'].every(s=>garment(`Authored_removed_sock.${s}`).visible&&!garment(`Authored_worn_sock.${s}`).visible);
const deposited=['Authored_removed_sock.L','Authored_removed_sock.R','Authored_unbranded_shoe.L','Authored_unbranded_shoe.R'].map(name=>garment(name));
const depositPoints=deposited.map(o=>o.getWorldPosition(new THREE.Vector3()));
patient.update(.1);check.depositsStable=deposited.every((o,i)=>o.getWorldPosition(new THREE.Vector3()).distanceTo(depositPoints[i])<1e-10);
patient.setPosition([1.3,0,-.7]).face(Math.PI/2).setPose('standing',true);patient.setGaitPhase(.33);patient.root.updateMatrixWorld(true);
check.removedGarmentsStayInRoom=deposited.every((o,i)=>o.parent===depositsGroup&&o.getWorldPosition(new THREE.Vector3()).distanceTo(depositPoints[i])<1e-10);
patient.setFootwear('shoes');
check.rewearResets=patient.getState().footwear==='shoes'&&!patient.getState().footwearRemoval.completed&&worn.every(o=>o.visible)&&['L','R'].every(s=>patient.root.getObjectByName(`Authored_unbranded_shoe.${s}`).parent===patient.bones.get(`foot.${s}`));
patient.setPosition([0,0,0]).face(0).setPose('standing',true);
patient.setGaitPhase(.33);patient.setGaitPhase(null);
check.manualToStaticFootMaxErrorMetres=Math.max(...['L','R'].map((s,i)=>patient.bones.get(`foot.${s}`).getWorldPosition(new THREE.Vector3()).distanceTo(initialStaticFeet[i])));
check.manualToStaticImmediate=patient.getState().manualGaitPhase===null&&!patient.getState().walking&&check.manualToStaticFootMaxErrorMetres<1e-6;
patient.startFootwearRemoval();patient.update(.1);patient.stop();const paused=patient.getState().footwearRemoval.elapsed;patient.update(.1);check.stopPausesRemoval=patient.getState().footwearRemoval.elapsed===paused;
actors.therapist.startFootwearRemoval();actors.therapist.setFootwear('barefoot');check.therapistRemainsShod=actors.therapist.getState().footwear==='shoes'&&!actors.therapist.getState().footwearRemoval.active;
check.originalPaidJobs=0;check.externalDownloads=0;
check.scope='CPU finite transforms, sequential visible garment states and prop floor clearance only; visual review and clinical dressing/contact review remain separate.';
check.passed=check.allFinite&&check.minimumVisiblePropY>-.001&&check.maximumSampledWristStepMetres<.15&&check.initialSocksWorn&&check.initialShoesWorn&&check.completed&&check.bothSocksDeposited&&check.depositsStable&&check.removedGarmentsStayInRoom&&check.rewearResets&&check.manualToStaticImmediate&&check.stopPausesRemoval&&check.therapistRemainsShod;
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(check,null,2));console.log(JSON.stringify(check,null,2));if(!check.passed)process.exitCode=1;
