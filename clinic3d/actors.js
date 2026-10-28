import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sampleGait } from './gait-lesson.js';
import { applyActorAppearance } from './appearance.js';

// Authored visual transfers and gestures. These poses are not a gait dataset,
// patient registration, diagnostic result, or a clinically reviewed procedure.
const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const clamp = THREE.MathUtils.clamp;
const smooth = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const position = (x, y, z) => new THREE.Vector3(x, y, z);

function authoredShoes(root, bones, role) {
  const upper = new THREE.MeshStandardMaterial({color:role === 'therapist' ? 0x233246 : 0x303740,roughness:.86});
  const sole = new THREE.MeshStandardMaterial({color:0xb6bcb8,roughness:.96});
  const trim = new THREE.MeshStandardMaterial({color:0x798793,roughness:.9});
  const groups = [];
  for (const side of ['L','R']) {
    const bone = bones.get(`foot.${side}`);
    const ankle = root.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
    const group = new THREE.Group(); group.name = `Authored_unbranded_shoe.${side}`;
    group.position.x = ankle.x;
    const vertices = [], indices = [], n = 36;
    // Rounded original upper: full toe box, a low forefoot, and a higher heel.
    // Footwear is a display mesh attached to the source ankle, not an orthosis.
    const rings = [{scale:1,y:.016},{scale:1,y:.034},{scale:.89,y:.065},{scale:.54,y:.087}];
    for (const ring of rings) for (let i=0;i<n;i++) {
      const a = i/n*Math.PI*2, z=.073+Math.sin(a)*.153*ring.scale;
      const toeTaper = z>.15 ? 1-(z-.15)*.9 : 1;
      const x=Math.cos(a)*.063*ring.scale*toeTaper;
      const heelLift=(.10-Math.max(-.06,Math.min(.10,z)))*.11;
      vertices.push(x,ring.y+heelLift*(ring.y/.087),z);
    }
    for(let r=0;r<rings.length-1;r++) for(let i=0;i<n;i++) {
      const a=r*n+i,b=r*n+(i+1)%n,c=(r+1)*n+i,d=(r+1)*n+(i+1)%n;
      indices.push(a,c,b,b,c,d);
    }
    const center=vertices.length/3; vertices.push(0,.101,.06);
    for(let i=0;i<n;i++) indices.push((rings.length-1)*n+i,center,(rings.length-1)*n+(i+1)%n);
    const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const shell=new THREE.Mesh(geometry,upper);shell.name=`Shoe_upper.${side}`;group.add(shell);
    const outline=new THREE.Shape();
    for(let i=0;i<=n;i++) {
      const a=i/n*Math.PI*2, x=Math.cos(a)*.064,z=.073+Math.sin(a)*.155;
      if(i===0) outline.moveTo(x,z); else outline.lineTo(x,z);
    }
    const outsole=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.014,bevelEnabled:false,steps:1}),sole);
    outsole.rotation.x=Math.PI/2;outsole.position.y=.015;outsole.name=`Shoe_sole.${side}`;group.add(outsole);
    for(const z of [.015,.038,.061]) {
      const lace=new THREE.Mesh(new THREE.CylinderGeometry(.0016,.0016,.060,7),trim);
      lace.position.set(0,.096,z);lace.rotation.z=Math.PI/2;group.add(lace);
    }
    group.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
    root.add(group);root.updateMatrixWorld(true);bone.attach(group);groups.push(group);
  }
  // Groups remain attached to their individual foot bones; visibility alone
  // switches the footwear. No skin/rig data or paid media is generated.
  return groups;
}

function authoredSocks(root, skin) {
  if (!skin) return [];
  const source = skin.geometry, p = source.getAttribute('position'), normals = source.getAttribute('normal');
  const index = source.getIndex(), socks = [];
  const material = new THREE.MeshStandardMaterial({color:0xd6dfdf,roughness:.98,side:THREE.DoubleSide});
  for (const side of ['L','R']) {
    const kept = [], sign = side === 'L' ? 1 : -1;
    for (let i=0;i<(index?index.count:p.count);i+=3) {
      const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
      const y=ids.reduce((s,j)=>s+p.getY(j),0)/3, x=ids.reduce((s,j)=>s+p.getX(j),0)/3;
      if(y<.205 && x*sign>.018)kept.push(...ids);
    }
    const geometry=source.clone();geometry.setIndex(kept);geometry.clearGroups();geometry.deleteAttribute('color');
    const q=geometry.getAttribute('position');
    for(let i=0;i<q.count;i++) {
      // Keep the sole above the floor. The source surface is CC0; this fitted
      // garment retains its skin weights while it is worn.
      const ny=normals?normals.getY(i):0;
      q.setXYZ(i,p.getX(i)+(normals?normals.getX(i)*.002:0),
        p.getY(i)+Math.max(0,ny)*.002,p.getZ(i)+(normals?normals.getZ(i)*.002:0));
    }
    q.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const worn=new THREE.SkinnedMesh(geometry,material);worn.name=`Authored_worn_sock.${side}`;
    worn.position.copy(skin.position);worn.quaternion.copy(skin.quaternion);worn.scale.copy(skin.scale);
    worn.bind(skin.skeleton,skin.bindMatrix.clone());worn.frustumCulled=false;worn.castShadow=true;worn.receiveShadow=true;
    skin.parent.add(worn);
    const empty=new THREE.BufferGeometry();empty.setAttribute('position',new THREE.Float32BufferAttribute([],3));
    const loose=new THREE.Mesh(empty,material);loose.name=`Authored_removed_sock.${side}`;
    loose.visible=false;loose.castShadow=true;loose.receiveShadow=true;root.add(loose);
    socks.push({side,worn,loose,captured:false});
  }
  return socks;
}

function makeTrousers(skin,role='therapist') {
  const source = skin.geometry;
  const p = source.getAttribute('position');
  const sourceIndex = source.getIndex();
  const kept = [];
  for (let i = 0, n = sourceIndex ? sourceIndex.count : p.count; i < n; i += 3) {
    const a = sourceIndex ? sourceIndex.getX(i) : i;
    const b = sourceIndex ? sourceIndex.getX(i + 1) : i + 1;
    const c = sourceIndex ? sourceIndex.getX(i + 2) : i + 2;
    const h = (p.getY(a) + p.getY(b) + p.getY(c)) / 3;
    // A small offset shell derived from the CC0 skin, with original weights.
    if (h > 0.085 && h < 0.73) kept.push(a, b, c);
  }
  const g = source.clone();
  g.setIndex(kept);
  g.clearGroups();
  const q = g.getAttribute('position'), normal = g.getAttribute('normal');
  if (normal) {
    for (let i = 0; i < q.count; i++) {
      q.setXYZ(i, q.getX(i) + normal.getX(i) * .0045,
        q.getY(i) + normal.getY(i) * .0045, q.getZ(i) + normal.getZ(i) * .0045);
    }
  }
  q.needsUpdate = true;
  g.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({
    color: role==='patient'?0x14181d:0x17304c, roughness: .9, side: THREE.DoubleSide
  }));
  mesh.name = 'Authored_clinician_trouser_shell';
  mesh.position.copy(skin.position); mesh.quaternion.copy(skin.quaternion); mesh.scale.copy(skin.scale);
  mesh.bind(skin.skeleton, skin.bindMatrix.clone());
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  skin.parent.add(mesh);
  return mesh;
}

export async function createActor(scene, role, url) {
  // Separate loader calls produce independent skins and mixers for both roles.
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = new THREE.Group(); root.name = role === 'patient' ? 'Patient' : 'Therapist';
  const model = gltf.scene; root.add(model); scene.add(root);
  const bones = new Map(), skins = [];
  model.traverse(object => {
    if (object.isBone) bones.set(object.userData.name || object.name, object);
    if (object.isSkinnedMesh) skins.push(object);
    if (object.isMesh) {
      object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
      const originals = Array.isArray(object.material) ? object.material : [object.material];
      const materials = originals.map(original => {
        const m = original.clone();
        if (m.name === 'Tshirt_grey') m.color.setHex(role === 'therapist' ? 0x17304c : 0x92959c);
        if (m.name === 'Shorts_charcoal') m.color.setHex(role === 'therapist' ? 0x17304c : 0x14181d);
        if (m.name === 'Skin_warm_neutral') m.color.setHex(role === 'therapist' ? 0xbb8d71 : 0xb18266);
        if (m.name === 'Hair_dark') m.color.setHex(role === 'therapist' ? 0x302c2b : 0x201b18);
        m.roughness = Math.max(m.roughness || .6, .48);
        return m;
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
    }
  });
  if (!skins.length || !bones.has('upperleg01.L') || !bones.has('jaw')) {
    root.removeFromParent(); throw new Error(`${role}: expected independent MPFB skin and bone map`);
  }
  skins[0].skeleton.pose();
  root.updateMatrixWorld(true);
  const appearance = applyActorAppearance({root,model,bones,skins,role});
  const inverseRoot = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const rest = new Map();
  for (const [name, bone] of bones) {
    rest.set(name, {
      position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(),
      point: root.worldToLocal(bone.getWorldPosition(new THREE.Vector3())),
      world: inverseRoot.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()))
    });
  }
  if (['therapist','patient'].includes(role)) {
    const body = skins.find(skin => /Patient_Skin/.test(skin.name));
    if (body) makeTrousers(body,role);
  }
  const shoes = authoredShoes(root, bones, role);
  const socks = role === 'patient' ? authoredSocks(root,skins.find(skin=>/Patient_Skin/.test(skin.name))) : [];
  const garmentDeposits=role==='patient'?new THREE.Group():null;
  if(garmentDeposits){garmentDeposits.name='Patient_world_stationary_removed_garments';scene.add(garmentDeposits);}
  const shoeHomes=shoes.map((shoe,index)=>({shoe,side:index===0?'L':'R',parent:shoe.parent,position:shoe.position.clone(),quaternion:shoe.quaternion.clone(),scale:shoe.scale.clone(),captured:false}));
  let footwear = 'shoes';
  const removal={active:false,completed:false,elapsed:0,duration:17.6,phase:'idle',side:null,progress:0};
  let documentation=null,documentationMode='desk',documentationCarryWeight=0,documentationWriteWeight=0,documentationTipGap=null;
  const mixer = new THREE.AnimationMixer(model);
  const heelClip = gltf.animations.find(clip => clip.name === 'heel_raise');
  let pose = 'standing', sitting = 0, sitFrom = 0, sitTo = 0, sitElapsed = 0;
  let walking = false, walkWeight = 0, talking = false, halted = false, time = 0;
  let manualGaitPhase = null;
  let gaitSampler = sampleGait;
  let emotion="neutral", emotionWeight=0;
  let heelAction = null, heelElapsed = 0, heelStart = null;
  const tempQuaternion = new THREE.Quaternion();
  const getPoint = name => root.worldToLocal(bones.get(name).getWorldPosition(new THREE.Vector3()));
  const restore = () => {
    for (const [name, b] of bones) {
      const r = rest.get(name); b.position.copy(r.position); b.quaternion.copy(r.quaternion); b.scale.copy(r.scale);
    }
    root.updateMatrixWorld(true);
  };
  const setWorldQuaternion = (name, actorQuaternion) => {
    const bone = bones.get(name); if (!bone) return;
    const desired = root.getWorldQuaternion(new THREE.Quaternion()).multiply(actorQuaternion);
    const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(parent.multiply(desired));
    bone.updateMatrixWorld(true);
  };
  const offset = (name, axis, angle) => {
    const r = rest.get(name); if (!r) return;
    setWorldQuaternion(name, tempQuaternion.setFromAxisAngle(axis, angle).clone().multiply(r.world));
  };
  const setRootShift = (amount, lateral = 0) => {
    const bone = bones.get('root');
    const reference = rest.get('root').point.clone().add(position(lateral, amount, 0));
    const world = root.localToWorld(reference); bone.parent.worldToLocal(world); bone.position.copy(world);
    bone.updateMatrixWorld(true);
  };
  function solveTwoLinks(upper, lower, endpoint, target, pole) {
    const start = getPoint(upper), a = rest.get(upper).point, b = rest.get(lower).point, c = rest.get(endpoint).point;
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), v = target.clone().sub(start);
    const distance = clamp(v.length(), Math.abs(l1 - l2) + .0001, l1 + l2 - .0001);
    const direction = v.normalize();
    const bend = pole.clone().sub(start); bend.addScaledVector(direction, -bend.dot(direction));
    if (bend.lengthSq() < .000001) bend.copy(position(0, 0, 1));
    bend.normalize();
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const elbow = start.clone().addScaledVector(direction, along).addScaledVector(bend, height);
    const upperDelta = new THREE.Quaternion().setFromUnitVectors(b.clone().sub(a).normalize(), elbow.clone().sub(start).normalize());
    setWorldQuaternion(upper, upperDelta.multiply(rest.get(upper).world));
    const actualJoint = getPoint(lower);
    const lowerDelta = new THREE.Quaternion().setFromUnitVectors(c.clone().sub(b).normalize(), target.clone().sub(actualJoint).normalize());
    setWorldQuaternion(lower, lowerDelta.multiply(rest.get(lower).world));
  }
  function resetFootwearObjects(value) {
    for(const home of shoeHomes) {
      home.parent.add(home.shoe);home.shoe.position.copy(home.position);home.shoe.quaternion.copy(home.quaternion);home.shoe.scale.copy(home.scale);
      home.shoe.visible=value==='shoes';home.captured=false;home.base=null;home.floor=null;
    }
    for(const sock of socks) {sock.worn.visible=value!=='barefoot';root.add(sock.loose);sock.loose.visible=false;sock.captured=false;}
  }
  function sockSnapshot(sock) {
    // Freeze the actually posed weighted sock when the hand starts pulling.
    // The following translation is an authored cloth approximation, not a
    // cloth/contact solver. The full sock passes beyond the toe before deposit.
    const source=sock.worn.geometry,indices=source.index,positions=[];
    sock.worn.updateWorldMatrix(true,false);
    for(let i=0;i<indices.count;i++) {
      const id=indices.getX(i),point=sock.worn.getVertexPosition(id,new THREE.Vector3());
      point.applyMatrix4(sock.worn.matrixWorld);root.worldToLocal(point);positions.push(point.x,point.y,point.z);
    }
    sock.loose.geometry.dispose();sock.loose.geometry=new THREE.BufferGeometry();
    sock.loose.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));sock.loose.geometry.computeVertexNormals();
    sock.loose.position.set(0,0,0);sock.loose.rotation.set(0,0,0);sock.loose.scale.set(1,1,1);
    sock.loose.geometry.computeBoundingBox();sock.floorY=.006-sock.loose.geometry.boundingBox.min.y;
    sock.captured=true;sock.worn.visible=false;sock.loose.visible=true;
  }
  function removalFrame() {
    const t=removal.elapsed;
    if(t<1.6) return {side:'L',time:-1.6+t,lift:0,lean:0,stage:'sit'};
    const n=Math.min(1,Math.floor((t-1.6)/8)),local=Math.min(8,t-1.6-n*8),side=n===0?'L':'R';
    const lift=local<.9?smooth(local/.9):local<6.05?1:1-smooth((local-6.05)/1.05);
    const lean=local<.9?smooth(local/.9):local<6.05?1:1-smooth((local-6.05)/1.05);
    const stage=local<.9?'lift':local<1.35?'shoe_reach':local<2.15?'shoe_pull':local<2.9?'shoe_deposit':local<3.45?'sock_reach':local<4.65?'sock_pull':local<5.65?'sock_deposit':local<6.05?'release':local<7.1?'lower':'rest';
    return {side,time:local,lift,lean,stage};
  }
  function removalHand(frame,side,normalTarget,activeFoot) {
    if(frame.side!==side || frame.time<.35 || frame.time>=7.1)return normalTarget;
    const sign=side==='L'?1:-1,t=frame.time;
    const reach=activeFoot.clone().add(position(sign*.025,.075,.055));
    let target=reach.clone(),amount=smooth((t-.35)/.9);
    if(t>=1.35&&t<2.15)target.add(position(0,.025,.29*smooth((t-1.35)/.8)));
    else if(t>=2.15&&t<2.9)target.add(position(0,.025,.29)).lerp(position(sign*.32,.48,.27),smooth((t-2.15)/.50));
    else if(t>=2.9&&t<3.45)target.lerp(position(sign*.32,.48,.27),1-smooth((t-2.9)/.55));
    else if(t>=3.45&&t<4.65)target.add(position(0,.035,.31*smooth((t-3.45)/1.2)));
    else if(t>=4.65&&t<5.65)target.add(position(0,.035,.31)).lerp(position(sign*.28,.48,.16),smooth((t-4.65)/.8));
    else if(t>=5.65)target=position(sign*.28,.48,.16).lerp(normalTarget,smooth((t-5.65)/1.4));
    return normalTarget.clone().lerp(target,amount);
  }
  function updateRemovalProps(frame) {
    const t=frame.time;if(t<0)return;
    const home=shoeHomes.find(h=>h.side===frame.side),sock=socks.find(s=>s.side===frame.side),sign=frame.side==='L'?1:-1;
    if(t>=1.35&&!home.captured) {root.attach(home.shoe);home.base=home.shoe.position.clone();home.captured=true;}
    if(home.captured) {
      const pulled=home.base.clone().add(position(0,.025,.29));
      home.shoe.position.copy(t<2.15?home.base.clone().lerp(pulled,smooth((t-1.35)/.8)):pulled);
      if(t>=2.15) {
        const destination=home.base.clone();destination.x=sign*.32;destination.z=.27;
        const bound=new THREE.Box3().setFromObject(home.shoe);const localMin=root.worldToLocal(position(0,bound.min.y,0)).y;
        destination.y=home.shoe.position.y-localMin+.005;
        // Recompute against the base, not the previous frame, to avoid drift.
        home.floor=home.floor||destination.clone();
        const carry=home.floor.clone().add(position(0,.38,0));
        home.shoe.position.copy(pulled).lerp(carry,smooth((t-2.15)/.5));
        if(t>=2.65)home.shoe.position.copy(carry).lerp(home.floor,smooth((t-2.65)/.25));
      }
    }
    if(t>=3.45&&!sock.captured)sockSnapshot(sock);
    if(sock.captured) {
      const pulled=position(0,.035,.31);
      sock.loose.position.copy(pulled.clone().multiplyScalar(smooth((t-3.45)/1.2)));
      if(t>=4.65) {
        const foot=rest.get(`foot.${frame.side}`).point;
        const destination=position(sign*.28-foot.x,sock.floorY,.16-(foot.z+.12));
        const carry=destination.clone().add(position(0,.28,0));
        sock.loose.position.copy(pulled).lerp(carry,smooth((t-4.65)/.8));
        if(t>=5.45)sock.loose.position.copy(carry).lerp(destination,smooth((t-5.45)/.2));
      }
    }
  }
  function restoreDocumentation() {
    if(!documentation)return;
    for(const item of documentation.items){item.parent.add(item.object);item.object.position.copy(item.position);item.object.quaternion.copy(item.quaternion);item.object.scale.copy(item.scale);}
    documentationTipGap=null;
  }
  function propInActorFrame(object,actorPoint,actorQuaternion) {
    const point=root.localToWorld(actorPoint.clone());object.parent.worldToLocal(point);object.position.copy(point);
    const quaternion=root.getWorldQuaternion(new THREE.Quaternion()).multiply(actorQuaternion);
    object.quaternion.copy(object.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(quaternion));
    object.updateMatrixWorld(true);
  }
  function updateDocumentationProps() {
    if(!documentation||documentationMode==='desk')return;
    const left=getPoint('wrist.L'),right=getPoint('wrist.R'),w=documentationWriteWeight;
    const noteOffset=position(-.06,-.09,.09).lerp(position(-.09,-.025,.025),w);
    const notePoint=left.clone().add(noteOffset);
    const noteQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));
    noteQuaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(1.0,0,0)),w);
    propInActorFrame(documentation.notes,notePoint,noteQuaternion);
    const penPoint=right.clone().add(position(.01,-.08,.035).lerp(position(.01,-.01,.01),w));
    const carryQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(.20,0,-.18));
    const tipTarget=position(.01+Math.sin(time*4.2)*.003,.008,-.015+Math.sin(time*6.3)*.002).applyQuaternion(noteQuaternion).add(notePoint);
    const tipDirection=tipTarget.clone().sub(penPoint).normalize();
    const writeQuaternion=new THREE.Quaternion().setFromUnitVectors(position(0,-1,0),tipDirection);
    penPoint.lerp(tipTarget.clone().addScaledVector(tipDirection,-.0795),w);
    propInActorFrame(documentation.pen,penPoint,carryQuaternion.slerp(writeQuaternion,w));
    documentationTipGap=documentationMode==='write'?Math.abs(penPoint.distanceTo(tipTarget)-.0795):null;
  }
  function procedural(dt) {
    restore();
    if (sitElapsed < 1.6) {
      sitElapsed += dt; sitting = THREE.MathUtils.lerp(sitFrom, sitTo, smooth(sitElapsed / 1.6));
    } else sitting = sitTo;
    walkWeight = manualGaitPhase !== null ? 1 : THREE.MathUtils.damp(walkWeight, walking && sitting < .05 ? 1 : 0, 7, dt);
    // Pelvis lowers while feet remain constrained to the floor. This is a
    // visual sit transfer, not a validated sit-to-stand biomechanics model.
    const gaitSample = manualGaitPhase === null ? null : gaitSampler(manualGaitPhase);
    const standardWalk=gaitSample?.visualGait==='heel-toe-v27';
    let walkShift=gaitSample ? -.060 + gaitSample.reference.vertical : -.022 + Math.sin(time * 7.6) * .003;
    if(standardWalk){
      walkShift=-.005+gaitSample.reference.vertical;
      // Keep both legs within their actual rig lengths. A fixed large
      // pelvis drop caused a crouch; unconstrained rise caused foot sliding.
      for(const side of ['L','R']){
        const limb=gaitSample[side==='R'?'right':'left'];
        const hip=rest.get('upperleg01.'+side).point,knee=rest.get('lowerleg01.'+side).point,ankle=rest.get('foot.'+side).point;
        const length=(hip.distanceTo(knee)+knee.distanceTo(ankle))*.998;
        const dx=-limb.foot.lateral-(hip.x-gaitSample.reference.lateral),dz=limb.foot.forward-hip.z;
        const maxShift=ankle.y+limb.foot.height+Math.sqrt(Math.max(.01,length*length-dx*dx-dz*dz))-hip.y;
        walkShift=Math.min(walkShift,maxShift);
      }
    }
    setRootShift(-.365 * sitting + walkShift * walkWeight,
      gaitSample ? -gaitSample.reference.lateral : 0);
    const removing=removal.active?removalFrame():null;
    documentationCarryWeight=THREE.MathUtils.damp(documentationCarryWeight,documentationMode==='desk'?0:1,8,dt);
    documentationWriteWeight=THREE.MathUtils.damp(documentationWriteWeight,documentationMode==='write'?1:0,8,dt);
    offset('spine03', X, -.012 * Math.sin(time * 1.4)+(removing?.lean||0)*.46);
    if(standardWalk)offset('spine03',UP,.025*Math.sin(manualGaitPhase*Math.PI*2));
    emotionWeight=THREE.MathUtils.damp(emotionWeight,emotion==='neutral'?0:1,5,dt);
    offset('head', X, -.016 + (talking ? .018 : .005) * Math.sin(time * (talking ? 2.4 : 1.1)) - .025*emotionWeight);
    if(emotionWeight>.001){const head=bones.get('head');head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP,emotionWeight*(emotion==='upset'?.035:.018)*Math.sin(time*1.6)));}
    offset('jaw', X, talking ? .034 * (.5 + .5 * Math.sin(time * 13.5)) : 0);
    for (const side of ['L', 'R']) {
      const sign = side === 'L' ? 1 : -1;
      const suffix = `.${side}`, restFoot = rest.get(`foot${suffix}`).point;
      const phase = manualGaitPhase === null ? time * 7.6 + (sign < 0 ? Math.PI : 0) : manualGaitPhase * Math.PI * 2 + (sign < 0 ? Math.PI : 0);
      let swing = Math.max(0, Math.sin(phase));
      const footTarget = restFoot.clone();
      if (manualGaitPhase !== null) {
        const foot = gaitSample[side === 'R' ? 'right' : 'left'].foot;
        swing = foot.height / .055;
        footTarget.set(-foot.lateral,restFoot.y + foot.height,foot.forward);
      } else {
        footTarget.z += .36 * sitting + Math.cos(phase) * .14 * walkWeight;
        footTarget.y += .045 * swing * walkWeight;
      }
      if(removing?.side===side) {
        footTarget.y+=.38*removing.lift;
        footTarget.z-=.24*removing.lift;
        footTarget.x+=sign*.025*removing.lift;
      }
      solveTwoLinks(`upperleg01${suffix}`, `lowerleg01${suffix}`, `foot${suffix}`,
        footTarget, position(sign * .17, .46, .65));
      offset(`foot${suffix}`, X, standardWalk ? -gaitSample[side==='R'?'right':'left'].foot.pitch : -.13 * swing * walkWeight);
      if(standardWalk){
        // Opposite arm / leg phasing. Mild elbow flexion stays in the sagittal
        // plane; no fixed waist-height wrist target or lateral elbow pole.
        const armAngle=(side==='R'?-1:1)*.27*Math.cos(manualGaitPhase*Math.PI*2);
        const a=rest.get(`upperarm01${suffix}`).point,b=rest.get(`lowerarm01${suffix}`).point,d=rest.get(`wrist${suffix}`).point;
        const upperDirection=position(sign*.045,-Math.cos(armAngle),Math.sin(armAngle)).normalize();
        const lowerDirection=position(sign*.03,-Math.cos(armAngle+.22),Math.sin(armAngle+.22)).normalize();
        const q1=new THREE.Quaternion().setFromUnitVectors(b.clone().sub(a).normalize(),upperDirection);
        const q2=new THREE.Quaternion().setFromUnitVectors(d.clone().sub(b).normalize(),lowerDirection);
        setWorldQuaternion(`upperarm01${suffix}`,q1.multiply(rest.get(`upperarm01${suffix}`).world));
        setWorldQuaternion(`lowerarm01${suffix}`,q2.multiply(rest.get(`lowerarm01${suffix}`).world));
        continue;
      }
      const standingWrist = position(sign * .245, .88, .035);
      const seatedWrist = position(sign * .18, .635, .285);
      let wristTarget = standingWrist.lerp(seatedWrist, sitting);
      wristTarget.z -= Math.cos(phase) * .045 * walkWeight;
      if(role==='therapist'&&documentation) {
        const carryTarget=side==='L'?position(.24,.96-.365*sitting,.13):wristTarget.clone();
        const writeTarget=side==='L'?position(.105,1.03-.365*sitting,.235):position(-.020+Math.sin(time*4.2)*.003,1.082-.365*sitting,.290+Math.sin(time*6.3)*.002);
        carryTarget.lerp(writeTarget,documentationWriteWeight);
        wristTarget.lerp(carryTarget,documentationCarryWeight);
      }
      if(removing)wristTarget=removalHand(removing,side,wristTarget,footTarget);
      solveTwoLinks(`upperarm01${suffix}`, `lowerarm01${suffix}`, `wrist${suffix}`,
        wristTarget, position(sign * .45, 1.0 - .27 * sitting, -.05));
      // Keep the rest LOCAL wrist rotation inherited from the forearm. The
      // previous world-rest reset made the hand bend independently of the arm.
      // Talking never adds arm, wrist, or finger tapping motions.
    }
    root.updateMatrixWorld(true);
    updateDocumentationProps();
    if(removing) {
      updateRemovalProps(removing);removal.phase=removing.stage;removal.side=removing.side;removal.progress=clamp(removal.elapsed/removal.duration,0,1);
      if(removal.elapsed>=removal.duration) {
        removal.active=false;removal.completed=true;removal.phase='completed';removal.progress=1;footwear='barefoot';
        // Leave removed garments in the room, rather than carrying them under
        // the patient root as she walks to the next examination zone.
        if(garmentDeposits) {
          for(const home of shoeHomes)garmentDeposits.attach(home.shoe);
          for(const sock of socks)garmentDeposits.attach(sock.loose);
        }
      }
    }
  }
  function setPose(next, immediate = false) {
    if (!['standing', 'seated', 'heel_raise', 'examine'].includes(next)) next = 'standing';
    halted = false;
    if (next === pose && !immediate && (next !== 'heel_raise' || heelAction?.isRunning())) return;
    manualGaitPhase = null;
    pose = next; mixer.stopAllAction(); heelAction = null;
    if (next === 'heel_raise' && heelClip) {
      walking = false; heelElapsed = 0;
      heelStart = new Map([...bones].map(([name, b]) => [name, { p: b.position.clone(), q: b.quaternion.clone() }]));
      heelAction = mixer.clipAction(heelClip).reset().setLoop(THREE.LoopOnce, 1);
      heelAction.clampWhenFinished = true; heelAction.play();
    } else {
      sitFrom = sitting; sitTo = next === 'seated' ? 1 : 0; sitElapsed = immediate ? 1.6 : 0;
      if (sitTo) walking = false;
      if (immediate) { sitting = sitTo; procedural(0); }
    }
  }
  const actor = {
    root, model, bones, role, ready: true,
    setEmotion(value){emotion=["questioning","concerned","upset"].includes(value)?value:"neutral";return actor;},
    setPose,
    bindDocumentation(props={}) {
      if(role!=='therapist')return actor;
      if(documentation)restoreDocumentation();
      if(!props.notes||!props.pen){documentation=null;documentationMode='desk';return actor;}
      const items=[props.notes,props.pen].map(object=>({object,parent:props.deskParent||object.parent,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()}));
      documentation={notes:props.notes,pen:props.pen,items};documentationMode='desk';restoreDocumentation();return actor;
    },
    setDocumentation(value) {
      if(role!=='therapist'||!documentation)return actor;
      const next=['desk','carry','write'].includes(value)?value:'desk';
      if(next===documentationMode)return actor;
      documentationMode=next;
      if(next==='desk')restoreDocumentation();
      else {bones.get('wrist.L').attach(documentation.notes);bones.get('wrist.R').attach(documentation.pen);updateDocumentationProps();}
      return actor;
    },
    setFootwear(value) {
      const next=role==='therapist'?'shoes':['shoes','socks','barefoot'].includes(value)?value:'shoes';
      if(next===footwear && !removal.active)return actor;
      removal.active=false;removal.completed=next==='barefoot';removal.elapsed=0;removal.progress=next==='barefoot'?1:0;removal.phase=next==='barefoot'?'restored_barefoot':'idle';removal.side=null;
      footwear=next;resetFootwearObjects(next);
      return actor;
    },
    startFootwearRemoval() {
      if(role!=='patient'||removal.active||removal.completed)return actor;
      resetFootwearObjects('shoes');footwear='removing';manualGaitPhase=null;walking=false;walkWeight=0;talking=false;halted=false;
      setPose('seated');removal.active=true;removal.completed=false;removal.elapsed=0;removal.progress=0;removal.phase='sit';removal.side='L';
      return actor;
    },
    getBodyReferencePosition() { return bones.get('root').getWorldPosition(new THREE.Vector3()); },
    setPosition(value) {
      if (Array.isArray(value)) root.position.fromArray(value);
      else root.position.set(value.x || 0, value.y || 0, value.z || 0);
      root.updateMatrixWorld(true); return actor;
    },
    face(angle) { root.rotation.y = Number(angle) || 0; root.updateMatrixWorld(true); return actor; },
    setLocomotion(value) { walking = Boolean(value); halted = false; if (walking && pose !== 'standing') setPose('standing'); return actor; },
    setGaitSampler(sampler) { gaitSampler=typeof sampler==='function'?sampler:sampleGait; return actor; },
    setGaitPhase(value) {
      if (value === null || value === undefined) { const wasManual=manualGaitPhase!==null;manualGaitPhase=null;if(wasManual){walking=false;walkWeight=0;procedural(0);}return actor; }
      if (pose !== 'standing' || sitting !== 0) setPose('standing', true);
      manualGaitPhase = clamp(Number(value) || 0, 0, 1);
      walking = true; walkWeight = 1; halted = false;
      procedural(0); return actor;
    },
    setHeelTeachingPhase(value) {
      if(pose!=='heel_raise'||!heelAction)setPose('heel_raise',true);
      if(!heelAction||!heelClip)return actor;
      heelAction.paused=false;mixer.setTime(heelClip.duration*.5*clamp(Number(value)||0,0,1));
      heelAction.paused=true;heelElapsed=1;halted=true;root.updateMatrixWorld(true);return actor;
    },
    setTalking(value) { talking = Boolean(value); return actor; },
    stop() { halted = true; walking = false; if (heelAction) heelAction.paused = true; return actor; },
    update(dt) {
      if (halted) return;
      dt = clamp(Number(dt) || 0, 0, .1); time += dt;
      if(removal.active)removal.elapsed=Math.min(removal.duration,removal.elapsed+dt);
      if (pose === 'heel_raise' && heelAction) {
        mixer.update(dt); heelElapsed += dt;
        const alpha = smooth(heelElapsed / .7);
        if (alpha < 1 && heelStart) for (const [name, b] of bones) {
          const from = heelStart.get(name); b.position.lerpVectors(from.p, b.position.clone(), alpha); b.quaternion.slerpQuaternions(from.q, b.quaternion.clone(), alpha);
        }
        root.updateMatrixWorld(true);
      } else procedural(dt);
    },
    getState() { return { role, pose, sitting, walking, talking, halted, boneCount: bones.size, heelElapsed, manualGaitPhase, footwear, footwearRemoval:{...removal},documentation:{mode:documentationMode,bound:!!documentation,carryWeight:documentationCarryWeight,writeWeight:documentationWriteWeight,penTipGapMetres:documentationTipGap},appearance }; }
  };
  procedural(0);
  return actor;
}

export async function createActors(scene, options = {}) {
  const url = options.modelUrl || './assets/patient-motion.glb';
  const [patient, therapist] = await Promise.all([
    createActor(scene, 'patient', url), createActor(scene, 'therapist', url)
  ]);
  patient.setPosition(options.patientPosition || [0, 0, -.85]).face(Math.PI);
  therapist.setPosition(options.therapistPosition || [0, 0, -2.72]);
  const details = {
    schema: 'dxx-clinic-actors-v13', independentSkeletons: patient.bones.get('root') !== therapist.bones.get('root'),
    source: 'MPFB CC0 adult skin/rig and project-authored clothing and motion',
    bonesPerActor: [patient.bones.size, therapist.bones.size],
    clinicalReview: 'pending', paidGenerationJobs: 0,
    appearance: {therapist:therapist.getState().appearance,patient:patient.getState().appearance},
    manualGaitSchedule: {
      api: 'actor.setGaitPhase(p in [0,1]); null restores ordinary time-driven locomotion',
      interpretation: 'Hypothetical asymmetric teaching case shared with gait-lesson.js; not a measured patient cycle or typical CAI pattern',
      sharedSampler:'sampleGait from gait-lesson.js',
      rightInitialContact: 0, rightToeOff: .56, leftInitialContact: .46, leftStanceFraction:.64,
      strideMetres:.88, rightStepLengthMetres:.48, leftStepLengthMetres:.40, stepWidthMetres:.14,
      swingLiftMetres: .055,pelvisDesignLoweringMetres:.060,
      directorTravel:'Root translates 0.88*p metres along local +Z; stance ankle anchors then remain fixed in world space.',
      reference:'getBodyReferencePosition returns actual source rig root/pelvis reference; it is not whole-body centre of mass.'
    },
    footwear:{default:'shoes for both roles; patient fitted light-grey ankle socks under shoes',api:'patient.startFootwearRemoval(); setFootwear(shoes|socks|barefoot) for stage restoration; getState().footwearRemoval tracks action; therapist remains shod',source:'Original unbranded procedural shoe meshes; fitted sock shells derived from CC0 skin with original weights, then captured as posed meshes for visible off-foot pull',sequenceSeconds:17.6},
    documentation:{api:'therapist.bindDocumentation({notes,pen,deskParent}); setDocumentation(desk|carry|write)',source:'Original scene note board and pen; no separate tray. Wrist-bone attached while carried; original desk transform restored when unused.',scope:'Finite visual carry and small writing strokes; no validated grip or handwriting assessment. Use desk mode before balance protection or hands-on assessment.'},
    limitations: ['Simplified visual sit transfer and walking; no validated gait kinematics.',
      'Jaw cycle is a speaking gesture draft without phoneme synchronization.',
      'The two roles share a CC0 male source topology, with original male/female display refinements; they are not separate scans or photorealistic people.',
      'Seated shoe and sock removal is an authored finite animation with simplified cloth and hand contact; no validated dressing assessment or collision simulation.',
      'Heel-raise clip is an authored teacher-review action; no pressure or clinical result is computed.']
  };
  return {
    patient, therapist, ready: true, details,
    update(dt) { patient.update(dt); therapist.update(dt); },
    setTalking(role) { patient.setTalking(role === 'patient'); therapist.setTalking(role === 'therapist'); },
    setMode(mode) {
      if (mode === 'consult' || mode === 'seated') { patient.setPose('seated'); therapist.setPose('seated'); }
      else if (mode === 'heel_raise') { patient.setPose('heel_raise'); therapist.setPose('standing'); }
      else if (mode === 'examine') { patient.setPose('standing'); therapist.setPose('examine'); }
      else { patient.setPose('standing'); therapist.setPose('standing'); }
    }
  };
}
