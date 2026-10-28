import {addPatientSuit} from './patient-suit.js';
import * as THREE from 'three';

// Project-authored display refinements to the CC0 source surface. These are
// fictional adult characters, not scanned people or anatomical calibration.
const clamp = THREE.MathUtils.clamp;
const blend = (a, b, v) => a + (b - a) * v;
const band = (v, a, b, fade) => clamp((v-a)/fade,0,1)*clamp((b-v)/fade,0,1);
const gaussian = (v, middle, width) => Math.exp(-(((v-middle)/width)**2));
const point = (x,y,z) => new THREE.Vector3(x,y,z);

function surfaceRefinement(mesh, female) {
  const geometry = mesh.geometry = mesh.geometry.clone();
  const p = geometry.attributes.position;
  for(let i=0;i<p.count;i++) {
    let x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    if(female) {
      // Preserve the feet, leg length, bones and weights. Small clothing/body
      // surface edits distinguish the adult female role without a sexual pose.
      const shoulder=band(y,1.16,1.51,.08)*clamp((Math.abs(x)-.08)/.16,0,1);
      x*=1-.065*shoulder;
      const waist=gaussian(y,1.035,.115)*clamp((.27-Math.abs(x))/.10,0,1);
      x*=1-.055*waist;
      if(z>.04) z+=.005*gaussian(y,1.26,.095)*gaussian(Math.abs(x),.075,.075);
    }
    if(y>1.515 && z>.015) {
      if(!female){x*=1+.045*gaussian(y,1.60,.065);z-=.004*gaussian(x,0,.025)*gaussian(y,1.60,.025);}
      const lowerFace=band(y,1.516,1.622,.025)*clamp((.095-Math.abs(x))/.035,0,1);
      x*=1-(female?.17:.027)*lowerFace;
      if(female) {
        x*=1-.045*gaussian(y,1.612,.035)*clamp((.09-Math.abs(x))/.03,0,1);
        // A modest reduction of the source nose and supraorbital projection.
        const nose=gaussian(y,1.594,.026)*gaussian(x,0,.025)*clamp((z-.14)/.035,0,1);
        x*=1-.085*nose;z-=.006*nose;
        z-=.0035*gaussian(y,1.65,.014)*gaussian(x,0,.065);
        z-=.0025*gaussian(y,1.542,.015)*gaussian(x,0,.04);
      }
    }
    p.setXYZ(i,x,y,z);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  if(!/Patient_Skin/.test(mesh.name)) return;
  const color=new THREE.Color(), skin=new THREE.Color(female?0xd9b49d:0xcaa88e);
  const cheek=new THREE.Color(female?0xc78579:0xb88776), lip=new THREE.Color(female?0xad7070:0xa3736a);
  const colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=clamp((z-.10)/.055,0,1);
    color.copy(skin);
    const blush=gaussian(Math.abs(x),.045,.022)*gaussian(y,1.598,.024)*front*(female?.20:.075);
    color.lerp(cheek,blush);
    const lipAmount=gaussian(x,0,.026)*gaussian(y,1.562,.0055)*clamp((z-.151)/.017,0,1);
    color.lerp(lip,lipAmount*(female?.79:.60));
    colors.set([color.r,color.g,color.b],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of materials) { material.color.setHex(0xffffff);material.vertexColors=true;material.roughness=.81; }
}

function addTube(group,name,points,radius,material,segments=24) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>point(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,segments,radius,7,false),material);
  mesh.name=name;group.add(mesh);return mesh;
}

function scalpShell(skin,female,material) {
  const source=skin.geometry,p=source.attributes.position,n=source.attributes.normal;
  const index=source.getIndex(),kept=[];
  for(let i=0;i<(index?index.count:p.count);i+=3) {
    const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
    const x=ids.reduce((a,j)=>a+p.getX(j),0)/3,y=ids.reduce((a,j)=>a+p.getY(j),0)/3,z=ids.reduce((a,j)=>a+p.getZ(j),0)/3;
    // A shaped hairline, temporal hair and back hair. Hair is a surface shell
    // of the licensed head, rather than an opaque primitive over the face.
    const frontLine=(female?1.682:1.689)+.011*gaussian(x,.025,.024);
    const outsideEar=!(Math.abs(x)>.082&&y<1.679);
    if(outsideEar&&(y>frontLine || (z<.03&&y>1.601) || (Math.abs(x)>.068&&z<.09&&y>1.648)))kept.push(...ids);
  }
  const geometry=source.clone();geometry.setIndex(kept);geometry.clearGroups();geometry.deleteAttribute('color');
  const positions=geometry.attributes.position;
  for(let i=0;i<p.count;i++) {
    const offset=(female?.012:.0065)+(female?.010:.007)*gaussian(p.getY(i),1.735,.075);
    positions.setXYZ(i,p.getX(i)+n.getX(i)*offset,p.getY(i)+n.getY(i)*offset,p.getZ(i)+n.getZ(i)*offset);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=female?'Original_female_fitted_hair':'Original_male_fitted_hair';
  mesh.position.copy(skin.position);mesh.quaternion.copy(skin.quaternion);mesh.scale.copy(skin.scale);mesh.bind(skin.skeleton,skin.bindMatrix.clone());
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;skin.parent.add(mesh);return mesh;
}

function oval(group,name,centre,scale,material) {
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),material);mesh.name=name;
  mesh.position.fromArray(centre);mesh.scale.fromArray(scale);group.add(mesh);return mesh;
}

function taperedLock(group,name,points,material) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>point(...p))),frames=curve.computeFrenetFrames(30,false);
  const positions=[],indices=[],segments=30,sides=12;
  for(let i=0;i<=segments;i++) {
    const t=i/segments,c=curve.getPointAt(t),width=.012*(1-.82*t*t),depth=.005*(1-.60*t);
    for(let j=0;j<sides;j++) {
      const angle=j/sides*Math.PI*2,v=c.clone().addScaledVector(frames.normals[i],Math.cos(angle)*width).addScaledVector(frames.binormals[i],Math.sin(angle)*depth);
      positions.push(v.x,v.y,v.z);
      if(i<segments){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;group.add(mesh);
}

function faceAndHair(root,head,skin,female) {
  const hair=new THREE.MeshStandardMaterial({color:female?0x251d1a:0x181918,roughness:.91,side:THREE.DoubleSide});
  const hairDetail=new THREE.MeshStandardMaterial({color:female?0x493a31:0x443b32,roughness:.94});
  const brow=new THREE.MeshStandardMaterial({color:female?0x514137:0x493d34,roughness:1});
  const white=new THREE.MeshStandardMaterial({color:0xd6d2c8,roughness:.58});
  const iris=new THREE.MeshStandardMaterial({color:female?0x4b3528:0x4e392b,roughness:.45});
  const pupil=new THREE.MeshStandardMaterial({color:0x151413,roughness:.48});
  const shine=new THREE.MeshBasicMaterial({color:0xf7f4e9});
  const lid=new THREE.MeshStandardMaterial({color:female?0x987364:0x957562,roughness:.9});
  scalpShell(skin,female,hair);
  const detail=new THREE.Group();detail.name=female?'Original_female_face_and_tied_hair':'Original_male_face_and_short_hair';
  for(const side of [-1,1]) {
    const x=side*.032907724,y=1.63123369,z=.138359025;
    oval(detail,`Refined_eye_white.${side}`,[x,y,z],[female?.0122:.0115,female?.0081:.0074,.0102],white);
    oval(detail,`Refined_eye_iris.${side}`,[x,y-.00015,z+.0099],[female?.0057:.0051,female?.0058:.00525,.0015],iris);
    oval(detail,`Refined_eye_pupil.${side}`,[x,y-.00015,z+.01115],[.00245,.0028,.00065],pupil);
    oval(detail,`Subtle_eye_highlight.${side}`,[x-.0016,y+.002,z+.01175],[.00075,.00085,.00035],shine);
    addTube(detail,`Upper_lid.${side}`,[[x-.011,y-.0002,z+.0055],[x-.006,y+.0059,z+.0092],[x+.001,y+.0069,z+.0098],[x+.007,y+.0044,z+.0088],[x+.011,y-.0002,z+.0055]],.0008,lid);
    const centre=side*.035;
    addTube(detail,`Natural_brow.${side}`,[[centre-side*.016,1.648,.1565],[centre-side*.006,1.650,.157],[centre+side*.007,1.6505,.1545],[centre+side*.018,1.648,.1495]],female?.0013:.0017,brow,22);
  }
  if(!female){
    const frame=new THREE.MeshStandardMaterial({color:0x565650,metalness:.65,roughness:.35});
    for(const side of [-1,1]){
      const x=side*.034;
      addTube(detail,'Reference_style_thin_spectacle_'+side,[[x-.024,1.642,.164],[x-.021,1.650,.166],[x+.020,1.650,.166],[x+.024,1.640,.164],[x+.019,1.621,.162],[x-.018,1.621,.162],[x-.024,1.642,.164]],.0012,frame,40);
      addTube(detail,'Spectacle_temple_'+side,[[side*.058,1.641,.164],[side*.080,1.645,.115],[side*.083,1.642,.045]],.0011,frame);
    }
    addTube(detail,'Spectacle_bridge',[[-.011,1.643,.165],[0,1.646,.170],[.011,1.643,.165]],.0011,frame);
  }
  // Restrained original sweep locks break up the source's straight scalp edge.
  const sweeps=female?[
    [[.022,1.744,.114],[.006,1.733,.144],[-.029,1.707,.158],[-.061,1.674,.136],[-.075,1.631,.099]],
    [[.036,1.739,.118],[.055,1.719,.135],[.069,1.684,.126],[.076,1.637,.092]]
  ]:[
    [[.035,1.750,.102],[.013,1.742,.131],[-.019,1.720,.151],[-.048,1.696,.150],[-.064,1.682,.129]],
    [[.042,1.741,.119],[.059,1.714,.143],[.071,1.689,.120]]
  ];
  sweeps.forEach((p,i)=>addTube(detail,`Hair_sweep_${i}`,p,female?.0065:.006,hair,32));
  // Full side layers and nape strands follow the supplied video's hairstyle.
  // Original meshes attach to the head; the face and ankle examination stay clear.
  if(female){
    for(const side of [-1,1])for(let i=0;i<7;i++){
      const f=i/6;
      taperedLock(detail,'Patient_layered_hair_'+side+'_'+i,[[side*(.060+.020*f),1.724-.014*f,.072-.060*f],[side*(.085+.011*f),1.665,.075-.075*f],[side*(.092+.009*f),1.595,.051-.096*f],[side*(.088+.011*f),1.528,.002-.070*f],[side*(.092+.012*f),1.469+.013*f,-.032-.047*f]],hair);
    }
    for(let i=0;i<7;i++){
      const x=(i-3)*.014;
      taperedLock(detail,'Patient_nape_layer_'+i,[[x,1.68,-.058],[x*1.2,1.60,-.078],[x*1.35,1.53,-.080],[x*1.4,1.475,-.070]],hair);
    }
    for(const side of [-1,1])for(let i=0;i<4;i++){
      const f=i/3;
      addTube(detail,'Patient_wispy_fringe_'+side+'_'+i,[[side*.012,1.748,.104],[side*(.020+.010*f),1.724,.147],[side*(.026+.020*f),1.693,.159],[side*(.033+.027*f),1.663+.015*f,.151]],.0017,hair,28);
    }
  }
  // A restrained half-tie sits behind the new shoulder-length layers.
  if(female) {
    taperedLock(detail,'Original_left_face_framing_lock',[[-.049,1.713,.154],[-.071,1.685,.141],[-.080,1.644,.119],[-.078,1.598,.095],[-.070,1.556,.064]],hair);
    taperedLock(detail,'Original_right_face_framing_lock',[[.048,1.724,.142],[.069,1.690,.139],[.079,1.647,.116],[.077,1.607,.086],[.072,1.568,.056]],hair);
    oval(detail,'Gathered_hair',[0,1.622,-.069],[.043,.050,.025],hair);
    const path=new THREE.CatmullRomCurve3([point(0,1.624,-.083),point(.011,1.565,-.103),point(.018,1.505,-.108),point(.013,1.454,-.095)]);
    const geometry=new THREE.TubeGeometry(path,28,.025,12,false);
    const pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++) { const t=clamp((1.624-pos.getY(i))/.17,0,1);pos.setX(i,.013*t+(pos.getX(i)-.013*t)*blend(1,.35,t)); }
    geometry.computeVertexNormals();const tail=new THREE.Mesh(geometry,hair);tail.name='Original_low_ponytail';detail.add(tail);
    const tie=new THREE.Mesh(new THREE.TorusGeometry(.023,.003,8,20),new THREE.MeshStandardMaterial({color:0x294b56,roughness:.9}));
    tie.name='Unbranded_hair_tie';tie.position.set(.005,1.592,-.092);tie.rotation.x=Math.PI/2;detail.add(tie);
  }
  // Faint strands stay inside the main silhouette and avoid plastic ridges.
  for(let i=0;i<3;i++) {
    const d=i*.014;addTube(detail,`Fine_hair_strand_${i}`,[[.028-d,1.752,.083],[.014-d,1.744,.119],[-.015-d,1.722,.143]],.0007,hairDetail,20);
  }
  detail.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  root.add(detail);root.updateMatrixWorld(true);head.attach(detail);
  return {hair: female?'original fuller layered shoulder-length hair with a restrained half-tie':'original fitted scalp and short side sweep',eyeDetails:'original restrained oval eyes, subtle highlights, upper lids and brows'};
}

export function applyActorAppearance({root,model,bones,skins,role}) {
  const female=role==='patient';
  model.traverse(o=>{
    if(/^Patient_eye\./.test(o.userData.name||o.name)||/Patient_ShortHair/.test(o.name))o.visible=false;
  });
  const sourceSkins=skins.filter(s=>/Patient_Skin|Patient_Tshirt|Patient_Shorts/.test(s.name));
  sourceSkins.forEach(s=>surfaceRefinement(s,female));
  if(female){const top=sourceSkins.find(s=>/Patient_Tshirt/.test(s.name));if(top){const p=top.geometry.attributes.position,c=new THREE.Color(),colors=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);c.setHex(0x92959c);const panel=clamp((.055-Math.abs(x))/.020,0,1)*clamp((z-.07)/.05,0,1)*clamp((y-1.05)/.06,0,1);colors.set([c.r,c.g,c.b],i*3);}top.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));for(const m of Array.isArray(top.material)?top.material:[top.material]){m.color.setHex(0xffffff);m.vertexColors=true;}}}
  const body=sourceSkins.find(s=>/Patient_Skin/.test(s.name));
  if(female)addPatientSuit(sourceSkins.find(s=>/Patient_Tshirt/.test(s.name)),body);
  const visual=body?faceAndHair(root,bones.get('head'),body,female):{};
  const contract={schema:'dxx-actor-appearance-v20',role,character:female?'fictional adult female patient':'fictional adult male therapist',
    source:'CC0 MPFB male base surface, independently loaded for each actor; role-specific original surface refinements and head-attached details',
    rigUnchanged:true,weightsUnchanged:true,boneCount:bones.size,externalDownloads:0,paidGenerationJobs:0,...visual,
    limits:['Runtime visual refinement of a shared source topology; not a separate scanned female body or photorealistic likeness.','No real person likeness, patient calibration or clinical motion accuracy is asserted.','Future replacement requires a licensed rigged 3D asset and adapter; a HeyGen video alone does not replace this mesh.']};
  root.userData.appearance=contract;return contract;
}
