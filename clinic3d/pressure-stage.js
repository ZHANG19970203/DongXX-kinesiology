import * as THREE from 'three';
import { pressureColor } from './pressure-engine.js';

// All floor textures are redrawn from the same current cells as the panel.
export function createPressureStage(scene,room){
 const surfaces=(room.objects.pressureWalkSurfaces||[]).map(item=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=352;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(item.width,item.length),material);
  const c=Array.isArray(item.center)?{x:item.center[0],y:item.center[1],z:item.center[2]}:item.center;
  mesh.rotation.x=-Math.PI/2;mesh.position.set(c.x,(c.y||.008)+.005,c.z);mesh.renderOrder=3;scene.add(mesh);
  return {...item,center:c,canvas,texture,mesh,context:canvas.getContext('2d')};
 });
 const markers=['left','right','combined'].map((side,index)=>{
  const mesh=new THREE.Mesh(new THREE.RingGeometry(index===2?.018:.011,index===2?.028:.018,28),new THREE.MeshBasicMaterial({color:index===2?0xe7b14c:0xffffff,side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.95}));
  mesh.rotation.x=-Math.PI/2;mesh.renderOrder=5;mesh.visible=false;scene.add(mesh);return {side,mesh};
 });
 let previousKey='';
 function update(frame,visible=true){
  for(const p of surfaces)p.mesh.visible=visible;
  for(const marker of markers)marker.mesh.visible=false;
  if(!visible||!frame){previousKey='';return;}
  const key=frame.kind+':'+Math.round(frame.phase*120)+':'+(frame.feet||[]).map(f=>f.centre.x.toFixed(4)+','+f.centre.z.toFixed(4)).join(';');if(key!==previousKey){
   previousKey=key;
   for(const p of surfaces){
    const {context:ctx,canvas,width,length,center}=p;ctx.clearRect(0,0,canvas.width,canvas.height);
    const minX=center.x-width/2,minZ=center.z-length/2;
    const px=x=>(x-minX)/width*canvas.width,py=z=>(z-minZ)/length*canvas.height;
    ctx.fillStyle='rgba(74,117,131,.12)';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const cell of frame.cells||[]){
     if(cell.force<=1e-9)continue;const {x,z}=cell.world;
     if(x<minX||x>=minX+width||z<minZ||z>=minZ+length)continue;
     ctx.fillStyle=pressureColor(cell.pressure);ctx.fillRect(px(x)-1.6,py(z)-1.6,.005/width*canvas.width+1,.005/length*canvas.height+1);
    }
    p.texture.needsUpdate=true;
   }
  }
  for(const marker of markers){const point=marker.side==='combined'?frame.combinedCop:frame.feet?.find(f=>f.side===marker.side)?.copWorld;if(point){marker.mesh.visible=true;marker.mesh.position.set(point.x,.030,point.z);}}
 }
 return {update,getState:()=>({plates:surfaces.length,source:'same-current-contact-cells-as-panel',combinedMarker:'COP, not whole-body COM'})};
}
