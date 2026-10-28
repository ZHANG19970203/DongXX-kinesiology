import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const base=path.resolve(process.argv[2]||path.join(here,'..'));
const report=path.resolve(process.argv[3]||path.join(base,'..','..','v13-room-structure.json'));
const context=vm.createContext({console,AbortController,URL,document:{createElementNS:()=>({addEventListener:()=>{},removeEventListener:()=>{}}),createElement:()=>({width:0,height:0,
  getContext:()=>new Proxy({}, {get:(target,key)=>key in target?target[key]:()=>{}})})}});
const modules=new Map();
async function moduleAt(filename){
  filename=path.normalize(filename);
  if(modules.has(filename))return modules.get(filename);
  const module=new vm.SourceTextModule(await fs.readFile(filename,'utf8'),{identifier:filename,context,initializeImportMeta:meta=>{meta.url=pathToFileURL(filename).href;}});
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
checks.fiveFlushPressurePlates=room.objects.pressureWalkSurfaces.length===5;
checks.plateSurfaceOrder=room.objects.pressureWalkSurfaces.every((item,i)=>Math.abs(item.center[2]-[1.75,1.2,.65,.1,-.45][i])<1e-6);
checks.platesHaveNoRaisedObstacle=room.objects.pressureWalkSurfaces.every(item=>Math.abs(item.center[1])<.001);
checks.noLengthwisePressureGaps=room.objects.pressureWalkSurfaces.every((item,i,array)=>!i||Math.abs(array[i-1].center[2]-item.center[2]-(array[i-1].length+item.length)/2)<1e-8);
checks.threeLicensedPosters=room.objects.anatomyPosters.length===3;
const {sampleWalking}=await import(pathToFileURL(path.join(base,'pressure-engine.js')).href);
const pressureCoverage={samples:401,cycleInterval:[0,2],positiveCells:0,uncoveredPositiveCells:0,
  minimumWorld:[Infinity,Infinity],maximumWorld:[-Infinity,-Infinity]};
for(let i=0;i<401;i++) for(const cell of sampleWalking(i/200).cells){
  if(!(cell.force>1e-12))continue;
  pressureCoverage.positiveCells++;
  const {x,z}=cell.world;
  pressureCoverage.minimumWorld[0]=Math.min(pressureCoverage.minimumWorld[0],x);
  pressureCoverage.minimumWorld[1]=Math.min(pressureCoverage.minimumWorld[1],z);
  pressureCoverage.maximumWorld[0]=Math.max(pressureCoverage.maximumWorld[0],x);
  pressureCoverage.maximumWorld[1]=Math.max(pressureCoverage.maximumWorld[1],z);
  const covered=room.objects.pressureWalkSurfaces.some(({center,width,length})=>
    Math.abs(x-center[0])<=width/2+1e-9&&Math.abs(z-center[2])<=length/2+1e-9);
  if(!covered)pressureCoverage.uncoveredPositiveCells++;
}
checks.allPositivePressureCellsCovered=pressureCoverage.positiveCells>0&&pressureCoverage.uncoveredPositiveCells===0;
const result={release:'v13',scope:'Finite original room/equipment geometry, five contiguous floor plates, three atlas posters, and monitor direction; no clinical approval.',
  roomMeshes:meshes,roomVertices:vertices,invalidCoordinates,inventory:room.objects.rehabilitationEquipment.userData.inventory,
  roomShelfFootprint:{min:[west,0,north],max:[east,2.8,south]},items,
  pressureCoverage,pressureWalkSurfaces:room.objects.pressureWalkSurfaces.map(({center,width,length})=>({center,width,length})),anatomyPosters:room.objects.anatomyPosters.map(poster=>poster.userData.title),equipmentView:room.anchors.equipmentView,monitorNormal:screenNormal.toArray(),checks,
  passed:Object.values(checks).every(Boolean)};
await fs.writeFile(report,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
room.dispose();
if(!result.passed)process.exitCode=1;
