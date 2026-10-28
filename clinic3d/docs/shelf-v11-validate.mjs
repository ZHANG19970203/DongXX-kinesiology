import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const base=path.resolve(process.argv[2]||path.join(here,'..'));
const report=path.resolve(process.argv[3]||path.join(base,'..','..','shelf-v11-structure.json'));
const context=vm.createContext({console,AbortController,document:{createElement:()=>({width:0,height:0,
  getContext:()=>new Proxy({}, {get:(target,key)=>key in target?target[key]:()=>{}})})}});
const modules=new Map();
async function moduleAt(filename){
  filename=path.normalize(filename);
  if(modules.has(filename))return modules.get(filename);
  const module=new vm.SourceTextModule(await fs.readFile(filename,'utf8'),{identifier:filename,context});
  modules.set(filename,module);
  for(const specifier of module.dependencySpecifiers)await moduleAt(specifier==='three'
    ?path.join(base,'vendor/three/build/three.module.js'):path.resolve(path.dirname(filename),specifier));
  return module;
}
const module=await moduleAt(path.join(base,'scene-room.js'));
await module.link((specifier,parent)=>modules.get(path.normalize(specifier==='three'
  ?path.join(base,'vendor/three/build/three.module.js'):path.resolve(path.dirname(parent.identifier),specifier))));
await module.evaluate();
const THREE=modules.get(path.join(base,'vendor/three/build/three.module.js')).namespace;
const scene=new THREE.Scene(),room=module.namespace.createClinicRoom(scene);
scene.updateMatrixWorld(true);
let meshes=0,vertices=0,invalidCoordinates=0;
room.objects.root.traverse(object=>{
  if(!object.isMesh)return;
  meshes++;
  const positions=object.geometry.getAttribute('position');vertices+=positions.count;
  for(let i=0;i<positions.array.length;i++)if(!Number.isFinite(positions.array[i]))invalidCoordinates++;
});
const round=n=>Number(n.toFixed(6));
const bounds=object=>{
  const box=new THREE.Box3().setFromObject(object);
  return {min:box.min.toArray().map(round),max:box.max.toArray().map(round)};
};
const names=['TealKettlebell','GraphiteKettlebell','HexDumbbellA','HexDumbbellB','MassageBallTray','FlatLoopResistanceBands'];
const items=Object.fromEntries(names.map(name=>[name,bounds(scene.getObjectByName(name))]));
const checks={finiteCoordinates:invalidCoordinates===0,weightSupports:true,equipmentWithinShelfFootprint:true,
  separateWeightFootprints:true,separateMiddleShelfFootprints:true,monitorFacesTherapist:true};
const tolerance=1e-5,west=1.825-.275,east=1.825+.275,north=2-.8,south=2+.8;
for(const [name,box] of Object.entries(items)){
  if(![box.min[0]>=west,box.max[0]<=east,box.min[2]>=north,box.max[2]<=south].every(Boolean))checks.equipmentWithinShelfFootprint=false;
  if(/Kettlebell|Dumbbell/.test(name)&&Math.abs(box.min[1]-.2375)>tolerance)checks.weightSupports=false;
}
function intersectsXZ(a,b){return a.min[0]<b.max[0]&&a.max[0]>b.min[0]&&a.min[2]<b.max[2]&&a.max[2]>b.min[2];}
const weights=names.slice(0,4);
for(let i=0;i<weights.length;i++)for(let j=i+1;j<weights.length;j++)
  if(intersectsXZ(items[weights[i]],items[weights[j]]))checks.separateWeightFootprints=false;
checks.separateMiddleShelfFootprints=!intersectsXZ(items.MassageBallTray,items.FlatLoopResistanceBands);
const screenNormal=new THREE.Vector3(0,0,1).transformDirection(room.objects.monitor.matrixWorld);
checks.monitorFacesTherapist=screenNormal.z<-.999;
const result={release:'v11',scope:'Original equipment meshes and placement only; no clinical equipment specification or efficacy claim.',
  roomMeshes:meshes,roomVertices:vertices,invalidCoordinates,inventory:room.objects.rehabilitationEquipment.userData.inventory,
  roomShelfFootprint:{min:[west,0,north],max:[east,2.8,south]},items,
  equipmentView:room.anchors.equipmentView,monitorNormal:screenNormal.toArray(),checks,
  passed:Object.values(checks).every(Boolean)};
await fs.writeFile(report,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
room.dispose();
if(!result.passed)process.exitCode=1;
