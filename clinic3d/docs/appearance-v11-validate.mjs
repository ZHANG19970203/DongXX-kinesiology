import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const base=path.resolve(process.argv[2]||path.join(here,'..'));
const out=path.resolve(process.argv[3]||path.join(base,'..','..','appearance-structure-v11.json'));
const cache=new Map();
const resolve=(name,parent)=>path.normalize(name==='three'?path.join(base,'vendor/three/build/three.module.js'):name.startsWith('three/addons/')?path.join(base,'vendor/three/examples/jsm',name.slice(13)):path.resolve(path.dirname(parent),name));
async function moduleAt(file){file=path.normalize(file);if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(await fs.readFile(file,'utf8'),{identifier:file});cache.set(file,m);for(const name of m.dependencySpecifiers)await moduleAt(resolve(name,file));return m;}
const m=await moduleAt(path.join(base,'actors.js'));await m.link((name,parent)=>cache.get(resolve(name,parent.identifier)));await m.evaluate();
const THREE=cache.get(path.join(base,'vendor/three/build/three.module.js')).namespace;
const Loader=cache.get(path.join(base,'vendor/three/examples/jsm/loaders/GLTFLoader.js')).namespace.GLTFLoader;
Loader.prototype.loadAsync=async function(url){const b=await fs.readFile(path.join(base,url));return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const actors=await m.namespace.createActors(new THREE.Scene(),{modelUrl:'assets/patient-motion.glb'});
const stats={};
for(const actor of [actors.therapist,actors.patient]){
 actor.setPosition([0,0,0]).face(0).setPose('standing',true);actor.root.updateMatrixWorld(true);
 let invalid=0,meshes=0,vertices=0,hiddenSourceEyes=0;const labels=[];
 actor.root.traverse(o=>{if(!o.isMesh)return;meshes++;vertices+=o.geometry.attributes.position.count;if(/^Patient_eye\./.test(o.userData.name||o.name)&&!o.visible)hiddenSourceEyes++;if(o.name.includes('Original_'))labels.push(o.name);
 for(const attr of Object.values(o.geometry.attributes))for(const v of attr.array)if(!Number.isFinite(v))invalid++;
 });
 const skin=actor.model.getObjectByName('Patient_Skin');const p=skin.geometry.attributes.position;let minX=Infinity,maxX=-Infinity;
 for(let i=0;i<p.count;i++)if(p.getY(i)>1.535&&p.getY(i)<1.58&&p.getZ(i)>.09){minX=Math.min(minX,p.getX(i));maxX=Math.max(maxX,p.getX(i));}
 stats[actor.role]={character:actor.getState().appearance.character,bones:actor.bones.size,meshes,vertices,invalidAttributeNumbers:invalid,hiddenOriginalEyeMeshes:hiddenSourceEyes,lowerFaceWidthMetres:maxX-minX,details:labels,sourceSkinVertices:p.count};
}
const female=actors.patient.model.getObjectByName('Patient_Skin').geometry;
const male=actors.therapist.model.getObjectByName('Patient_Skin').geometry;
let differentFaceVertices=0,identicalLowerLegVertices=0,lowerLegVertexCount=0;
const f=female.attributes.position,a=male.attributes.position;
for(let i=0;i<f.count;i++){const d=Math.abs(f.getX(i)-a.getX(i))+Math.abs(f.getY(i)-a.getY(i))+Math.abs(f.getZ(i)-a.getZ(i));if(f.getY(i)>1.515&&d>1e-8)differentFaceVertices++;if(f.getY(i)<.60){lowerLegVertexCount++;if(d<1e-8)identicalLowerLegVertices++;}}
const report={schema:'dxx-appearance-check-v11',actors:stats,independentSkeletons:actors.details.independentSkeletons,differentFaceVertices,lowerLegVertexCount,identicalLowerLegVertices,originalGlbSha256:crypto.createHash('sha256').update(await fs.readFile(path.join(base,'assets/patient-motion.glb'))).digest('hex'),paidGenerationJobs:0,externalDownloads:0,scope:'Finite geometry, role distinction and unchanged lower-leg source surface only. Visual review remains separate; not photorealistic or clinically calibrated.'};
report.passed=Object.values(stats).every(s=>s.bones===163&&s.invalidAttributeNumbers===0&&s.hiddenOriginalEyeMeshes===6)&&differentFaceVertices>100&&lowerLegVertexCount===identicalLowerLegVertices&&report.independentSkeletons;
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
