import * as THREE from 'three';

const surfaceGrids=new WeakMap();
function surfaceGrid(geometry){
 if(surfaceGrids.has(geometry))return surfaceGrids.get(geometry);
 const grid=new Map(),p=geometry.attributes.position,index=geometry.index,cell=.025;
 for(let t=0;t<(index?index.count:p.count);t+=3){const ids=[0,1,2].map(k=>index?index.getX(t+k):t+k),xs=ids.map(i=>p.getX(i)),ys=ids.map(i=>p.getY(i));
  for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(ids);}
 }
 surfaceGrids.set(geometry,grid);return grid;
}

// Half width of the real front opening, in the source model's metres.
export function jacketOpening(y){return y>1.36?.057+(1.475-y)*.10:y>1.10?.069+(1.36-y)*.04:.079+(1.10-y)*.15;}

function trimCuffs(g,skin){
 const frames={};for(const side of ['L','R']){
  const bone=name=>skin.skeleton.bones.find(b=>(b.userData.name||b.name)===name);
  const elbow=skin.worldToLocal(bone('lowerarm01.'+side).getWorldPosition(new THREE.Vector3())),wrist=skin.worldToLocal(bone('wrist.'+side).getWorldPosition(new THREE.Vector3()));
  const direction=wrist.clone().sub(elbow),length=direction.length();direction.normalize();frames[side]={elbow,direction,cut:length-.032};
 }
 const p=g.attributes.position,n=g.attributes.normal,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,out={p:[],n:[],i:[],w:[]};
 const vertex=i=>({p:new THREE.Vector3().fromBufferAttribute(p,i),n:new THREE.Vector3().fromBufferAttribute(n,i),i:Array.from(si.array.slice(i*4,i*4+4)),w:Array.from(sw.array.slice(i*4,i*4+4))});
 function mix(a,b,t){const sums=new Map();for(const [v,k] of [[a,1-t],[b,t]])v.i.forEach((bone,j)=>sums.set(bone,(sums.get(bone)||0)+v.w[j]*k));const arr=[...sums].sort((a,b)=>b[1]-a[1]).slice(0,4);while(arr.length<4)arr.push([0,0]);const sum=arr.reduce((s,v)=>s+v[1],0);return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),i:arr.map(v=>v[0]),w:arr.map(v=>v[1]/sum)};}
 for(let t=0;t<g.index.count;t+=3){const tri=[0,1,2].map(k=>vertex(g.index.getX(t+k))),f=frames[tri[0].p.x>0?'L':'R'],d=v=>f.cut-v.p.clone().sub(f.elbow).dot(f.direction),poly=[];
  for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],da=d(a),db=d(b);if(da>=0)poly.push(a);if((da>=0)!==(db>=0))poly.push(mix(a,b,da/(da-db)));}
  for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){out.p.push(...v.p.toArray());out.n.push(...v.n.toArray());out.i.push(...v.i);out.w.push(...v.w);}
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(out.p,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(out.n,3));result.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(out.i,4));result.setAttribute('skinWeight',new THREE.Float32BufferAttribute(out.w,4));result.computeBoundingSphere();return result;
}

function openJacket(base){
 const clamp=THREE.MathUtils.clamp,p=base.attributes.position,n=base.attributes.normal;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const torso=clamp((.245-Math.abs(x))/.065,0,1)*clamp((1.465-y)/.10,0,1),ease=Math.exp(-(((y-1.06)/.25)**2))*torso;
  x*=1+.23*ease;
  if(z>.025){const front=.183-.36*Math.max(0,y-1.29),envelope=front*Math.pow(Math.max(.12,1-(x/.223)**2),.23);z=THREE.MathUtils.lerp(z,Math.max(z+.012,envelope),.88*torso);}else if(z<.01)z-=.025*ease;
  const sleeve=clamp((Math.abs(x)-.19)/.07,0,1);x+=n.getX(i)*.011*sleeve;y+=n.getY(i)*.011*sleeve;z+=n.getZ(i)*.011*sleeve;p.setXYZ(i,x,y,z);
 }
 base.deleteAttribute('color');base.computeVertexNormals();base.computeBoundingSphere();
 const out={pos:[],normal:[],bones:[],weights:[]},idx=base.index;
 function vertex(i){return {pos:[p.getX(i),p.getY(i),p.getZ(i)],normal:[base.attributes.normal.getX(i),base.attributes.normal.getY(i),base.attributes.normal.getZ(i)],bones:Array.from(base.attributes.skinIndex.array.slice(i*4,i*4+4)),weights:Array.from(base.attributes.skinWeight.array.slice(i*4,i*4+4))};}
 function mix(a,b,t){const pairs=new Map();for(const [v,f] of [[a,1-t],[b,t]])v.bones.forEach((bone,k)=>pairs.set(bone,(pairs.get(bone)||0)+v.weights[k]*f));const list=[...pairs].sort((a,b)=>b[1]-a[1]).slice(0,4);while(list.length<4)list.push([0,0]);const sum=list.reduce((s,v)=>s+v[1],0);return {pos:a.pos.map((v,i)=>v+(b.pos[i]-v)*t),normal:a.normal.map((v,i)=>v+(b.normal[i]-v)*t),bones:list.map(v=>v[0]),weights:list.map(v=>v[1]/sum)};}
 function clip(poly,sign){const result=[],distance=v=>sign*v.pos[0]-jacketOpening(v.pos[1]);for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)result.push(a);if((da>=0)!==(db>=0))result.push(mix(a,b,da/(da-db)));}return result;}
 function emit(poly){for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){out.pos.push(...v.pos);out.normal.push(...v.normal);out.bones.push(...v.bones);out.weights.push(...v.weights);}}
 for(let i=0;i<(idx?idx.count:p.count);i+=3){const vs=[0,1,2].map(k=>vertex(idx?idx.getX(i+k):i+k));if(vs.reduce((s,v)=>s+v.pos[2],0)/3>.035){emit(clip(vs,-1));emit(clip(vs,1));}else emit(vs);}
 const outer=new THREE.BufferGeometry();outer.setAttribute('position',new THREE.Float32BufferAttribute(out.pos,3));outer.setAttribute('normal',new THREE.Float32BufferAttribute(out.normal,3));outer.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(out.bones,4));outer.setAttribute('skinWeight',new THREE.Float32BufferAttribute(out.weights,4));outer.normalizeNormals();outer.computeBoundingSphere();return outer;
}

// Original garment surfaces. Reuse the licensed mesh's skinning weights so
// the shirt, lapels and sleeves follow the same seated/standing skeleton.
export function addPatientSuit(top,skin){
 if(!top||!skin)return;
 const cloth=new THREE.MeshStandardMaterial({color:0x888b90,roughness:.94,side:THREE.DoubleSide});
 const lapel=new THREE.MeshStandardMaterial({color:0x9fa1a6,roughness:.92,side:THREE.DoubleSide});
 const shirt=new THREE.MeshStandardMaterial({color:0xf0ede4,roughness:.91,side:THREE.DoubleSide});
 const base=top.geometry.clone();top.geometry=openJacket(base);top.material=cloth;
 const copy=(geometry,material,name,source=top)=>{
  const m=new THREE.SkinnedMesh(geometry,material);m.name=name;
  m.position.copy(source.position);m.quaternion.copy(source.quaternion);m.scale.copy(source.scale);
  m.bind(source.skeleton,source.bindMatrix.clone());m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;source.parent.add(m);return m;
 };
 function patch(name,xy,material,offset=.009,baseGeometry=base,sourceMesh=top){
  const base=baseGeometry,p=base.attributes.position;
  const pos=[],weights=[],bones=[],indices=[],grid=surfaceGrid(base);
  function surface(x,y){
   let maxZ=-Infinity,chosen=null;
   for(const ids of grid.get(Math.floor(x/.025)+','+Math.floor(y/.025))||[]){
    const [a,b,c]=ids;
    const ax=p.getX(a),ay=p.getY(a),bx=p.getX(b),by=p.getY(b),cx=p.getX(c),cy=p.getY(c);
    const d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(d)<1e-12)continue;
    const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d,w=1-u-v;
    if(Math.min(u,v,w)<-.0001)continue;
    const z=u*p.getZ(a)+v*p.getZ(b)+w*p.getZ(c);
    if(z>maxZ){maxZ=z;chosen={ids,bary:[u,v,w]};}
   }
   if(!chosen){let best=Infinity,j=0;for(let i=0;i<p.count;i++){if(p.getZ(i)<0)continue;const d=(p.getX(i)-x)**2+(p.getY(i)-y)**2;if(d<best){best=d;j=i;}}maxZ=p.getZ(j);chosen={ids:[j],bary:[1]};}
   const mix=new Map();chosen.ids.forEach((id,n)=>{for(let k=0;k<4;k++){const bone=base.attributes.skinIndex.array[id*4+k],weight=base.attributes.skinWeight.array[id*4+k]*chosen.bary[n];mix.set(bone,(mix.get(bone)||0)+weight);}});
   const sorted=[...mix].sort((a,b)=>b[1]-a[1]).slice(0,4);while(sorted.length<4)sorted.push([0,0]);const total=sorted.reduce((sum,r)=>sum+r[1],0);
   pos.push(x,y,maxZ+(typeof offset==='function'?offset(x,y):offset));sorted.forEach(([bone,weight])=>{bones.push(bone);weights.push(weight/total);});return pos.length/3-1;
  }
  const triangles=THREE.ShapeUtils.triangulateShape(xy.map(([x,y])=>new THREE.Vector2(x,y)),[]);
  function subdivide(a,b,c,depth){if(!depth){indices.push(surface(...a),surface(...b),surface(...c));return;}const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);subdivide(a,ab,ca,depth-1);subdivide(ab,b,bc,depth-1);subdivide(ca,bc,c,depth-1);subdivide(ab,bc,ca,depth-1);}
  for(const [a,b,c] of triangles)subdivide(xy[a],xy[b],xy[c],3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(bones,4));g.setIndex(indices);g.computeVertexNormals();copy(g,material,name,sourceMesh);
 }
 // A separate white blouse extends to the waistband inside the open coat.
 patch('Patient_White_Shirt',[[-.060,1.468],[.060,1.468],[.105,1.36],[.132,.855],[-.132,.855],[-.105,1.36]],shirt,(x,y)=>.018+.027*THREE.MathUtils.clamp((.99-y)/.08,0,1),skin.geometry,skin);
 for(const side of [-1,1]){
  patch('Patient_Suit_Notched_Lapel_'+side,[[side*.061,1.475],[side*.119,1.429],[side*.099,1.401],[side*.137,1.373],[side*.078,1.205],[side*.066,1.342]],lapel,.009);
  patch('Patient_Shirt_Collar_'+side,[[0,1.451],[side*.049,1.482],[side*.061,1.434],[side*.024,1.403]],shirt,.022,skin.geometry,skin);
  patch('Patient_Suit_Pocket_'+side,[[side*.108,1.065],[side*.178,1.077],[side*.178,1.063],[side*.108,1.052]],cloth,.007);
 }
 // Relaxed sleeves leave the wrist and hand exposed.
 const g=skin.geometry.clone(),sp=g.attributes.position,n=g.attributes.normal,idx=g.index,keep=[];
 for(let i=0;i<(idx?idx.count:sp.count);i+=3){const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
  const x=ids.reduce((v,j)=>v+Math.abs(sp.getX(j)),0)/3,y=ids.reduce((v,j)=>v+sp.getY(j),0)/3;
  if(x>.19&&y>1.035&&y<1.47)keep.push(...ids);
 }
 g.setIndex(keep);g.clearGroups();g.deleteAttribute('color');
 for(let i=0;i<sp.count;i++){const ease=.014+.006*THREE.MathUtils.clamp((sp.getY(i)-1.04)/.25,0,1);sp.setXYZ(i,sp.getX(i)+n.getX(i)*ease,sp.getY(i)+n.getY(i)*ease,sp.getZ(i)+n.getZ(i)*ease);}
 g.computeVertexNormals();copy(trimCuffs(g,skin),cloth,'Patient_Gray_Suit_Sleeves',skin);
 top.userData.wardrobe='relaxed gray open-front jacket, separated front panels, full white collared blouse';
}
