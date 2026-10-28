import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createActor} from '../clinic3d/actors.js';
// Existing attributed CC0 actor; original posture teaching function remains in app.js.
export async function createPostureScene(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xf1f6f3);const camera=new THREE.PerspectiveCamera(38,1,.01,30);
 scene.add(new THREE.HemisphereLight(0xffffff,0x6b8074,2.2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(2,5,4);scene.add(light);
 const plate=new THREE.Mesh(new THREE.BoxGeometry(1.05,.025,1.05),new THREE.MeshStandardMaterial({color:0x689181,roughness:.8}));plate.position.set(0,-.025,.12);scene.add(plate);
 const actor=await createActor(scene,'therapist','../clinic3d/assets/patient-motion.glb');actor.setPose('standing',true);actor.setFootwear('barefoot');actor.root.position.set(0,0,0);
 const bones=actor.bones,rest=new Map([...bones].map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone()}]));
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,.9,.1);controls.enablePan=false;controls.minDistance=.8;controls.maxDistance=6;controls.enableDamping=false;
 const com=new THREE.Mesh(new THREE.SphereGeometry(.025,16,12),new THREE.MeshBasicMaterial({color:0x2a79bd}));scene.add(com);
 const cop=new THREE.Mesh(new THREE.SphereGeometry(.018,16,12),new THREE.MeshBasicMaterial({color:0xdc8c2f}));scene.add(cop);
 let last=null;const frame=()=>{camera.position.set(.45,1.2,3.4);controls.target.set(0,.9,.1);controls.update();render();};
 const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
 function render(){renderer.render(scene,camera);}
 function angle(name,axis,q){const b=bones.get(name),r=rest.get(name);if(b&&r)b.quaternion.copy(r.q).multiply(new THREE.Quaternion().setFromAxisAngle(axis,q));}
 const X=new THREE.Vector3(1,0,0),Z=new THREE.Vector3(0,0,1);
 const api={active:false,viewer:{yaw:.18,pitch:.07,invalidate(){const yaw=api.viewer.yaw;camera.position.set(Math.sin(yaw)*3.5,1.2,Math.cos(yaw)*3.5);camera.lookAt(0,.9,.1);render();}},frame,update(s){last=s;for(const[n,b]of bones){const r=rest.get(n);b.position.copy(r.p);b.quaternion.copy(r.q);}actor.root.position.set(s.com.x,0,s.com.z-.04);actor.root.rotation.z=s.pelvisTilt||0;
  for(const[side,letter]of [['left','L'],['right','R']]){const f=s[side];angle('upperleg01.'+letter,X,-Math.min(.65,f.y*3+Math.max(0,f.z)*.7));angle('lowerleg01.'+letter,X,Math.min(1.1,f.y*5));angle('foot.'+letter,X,-Math.min(.25,f.y));}angle('upperarm01.L',Z,.09);angle('upperarm01.R',Z,-.09);com.position.set(s.com.x,.97,s.com.z);cop.position.set(s.cop.x,.025,s.cop.z);actor.root.updateMatrixWorld(true);render();}};
 const ro=new ResizeObserver(resize);ro.observe(canvas);controls.addEventListener('change',render);resize();frame();return api;
}
