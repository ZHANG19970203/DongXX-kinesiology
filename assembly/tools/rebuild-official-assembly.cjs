/* Rebuild static geometry from pinned official Somakine GLBs and verified
   BodyParts3D original OBJ entries. No geometry is copied from the old bins. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const audit=path.resolve(option('--audit')||__dirname),workspace=path.resolve(__dirname,'../..');
const original=path.join(workspace,'work/original/assembly');
const target=path.resolve(option('--output')||path.join(workspace,'work/migration-site/assembly'));
const sourceDir=path.join(audit,'upstream');
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const record=readJSON(path.join(audit,'download-record.json'));
const sourceManifest=readJSON(path.join(sourceDir,'source-manifest.json'));
const upstreamManifest=readJSON(path.join(sourceDir,'upstream-manifest.json'));
const template=option('--template');
const d=template?readJSON(path.resolve(template)):JSON.parse(fs.readFileSync(path.join(original,'assets/catalog.js'),'utf8').replace(/^window.ASSEMBLY_DATA=/,'').replace(/;\s*$/,''));
const oldAssets=d.assets;
const ident=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const c=new Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];return c;}
function localMatrix(n){
 if(n.matrix)return n.matrix;
 const [x,y,z,w]=n.rotation||[0,0,0,1],s=n.scale||[1,1,1],t=n.translation||[0,0,0];
 const xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
 return [(1-2*(yy+zz))*s[0],2*(xy+wz)*s[0],2*(xz-wy)*s[0],0,
  2*(xy-wz)*s[1],(1-2*(xx+zz))*s[1],2*(yz+wx)*s[1],0,
  2*(xz+wy)*s[2],2*(yz-wx)*s[2],(1-2*(xx+yy))*s[2],0,...t,1];
}
const point=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
function normalMatrix(m){
 const a=m[0],b=m[4],c=m[8],e=m[1],f=m[5],g=m[9],i=m[2],j=m[6],k=m[10];
 const det=a*(f*k-g*j)-b*(e*k-g*i)+c*(e*j-f*i);if(Math.abs(det)<1e-20)throw Error('Singular source transform');
 // Rows of inverse-transpose, followed by determinant.
 return [(f*k-g*j)/det,(g*i-e*k)/det,(e*j-f*i)/det,(c*j-b*k)/det,(a*k-c*i)/det,(b*i-a*j)/det,(b*g-c*f)/det,(c*e-a*g)/det,(a*f-b*e)/det,det];
}
function transformNormal(m,n){const p=[m[0]*n[0]+m[1]*n[1]+m[2]*n[2],m[3]*n[0]+m[4]*n[1]+m[5]*n[2],m[6]*n[0]+m[7]*n[1]+m[8]*n[2]],l=Math.hypot(...p)||1;return p.map(v=>v/l);}
function normalsFromTriangles(p,indices){const n=new Float32Array(p.length);let fallbackCount=0;for(let at=0;at<indices.length;at+=3){const a=indices[at]*3,b=indices[at+1]*3,c=indices[at+2]*3;const x=p[b]-p[a],y=p[b+1]-p[a+1],z=p[b+2]-p[a+2],u=p[c]-p[a],v=p[c+1]-p[a+1],w=p[c+2]-p[a+2];const cross=[y*w-z*v,z*u-x*w,x*v-y*u];for(const k of [a,b,c])for(let j=0;j<3;j++)n[k+j]+=cross[j];}for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2]);if(l<1e-20){n[i]=0;n[i+1]=1;n[i+2]=0;fallbackCount++;}else for(let j=0;j<3;j++)n[i+j]/=l;}n.zeroAreaShadingFallbackVertices=fallbackCount;return n;}
function accessor(j,bin,index){
 const a=j.accessors[index],v=j.bufferViews[a.bufferView];if(a.sparse)throw Error('Sparse accessor unsupported');
 const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
 const bytes=sizes[a.componentType],step=v.byteStride||width*bytes,offset=(v.byteOffset||0)+(a.byteOffset||0),out=[];
 const readers={5120:'readInt8',5121:'readUInt8',5122:'readInt16LE',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'};
 for(let i=0;i<a.count;i++)for(let c=0;c<width;c++)out.push(bin[readers[a.componentType]](offset+i*step+c*bytes));return out;
}
const expectedAssets=new Map();
function expectedWalk(o){if(!o||typeof o!=='object')return;if(o.file&&o.sha256)expectedAssets.set(path.basename(o.file),o);for(const v of Object.values(o))expectedWalk(v);}
expectedWalk(sourceManifest);expectedWalk(readJSON(path.join(sourceDir,'supplemental-manifest.json')));
const official=new Map(),sourceChecks=[];
for(const rec of record.files.filter(f=>f.path.endsWith('.glb'))){
 const file=path.basename(rec.path),b=fs.readFileSync(path.join(sourceDir,file)),hash=sha256(b),expected=expectedAssets.get(file);
 const gitBlobHash=crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
 if(hash!==rec.sha256||gitBlobHash!==rec.gitBlobSha||(expected&&(hash!==expected.sha256||b.length!==expected.bytes)))throw Error(`Official GLB digest mismatch: ${file}`);
 const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());let bin=null;for(let off=12;off<b.length;){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4);if(type===0x004e4942)bin=b.subarray(off+8,off+8+len);off+=8+len;}if(!bin)throw Error('GLB binary missing');
 const world=new Map();function visit(index,parent){const n=gltf.nodes[index],matrix=mul(parent,localMatrix(n));world.set(index,matrix);for(const c of n.children||[])visit(c,matrix);}for(const root of gltf.scenes[gltf.scene||0].nodes)visit(root,ident());
 for(let nodeIndex=0;nodeIndex<gltf.nodes.length;nodeIndex++){
  const node=gltf.nodes[nodeIndex];if(node.mesh==null)continue;const id=node.name?.match(/(?:^|:)(FJ\d+M?)$/)?.[1];if(!id||!oldAssets[id]||official.has(id))continue;
  const primitives=gltf.meshes[node.mesh].primitives;if(primitives.length!==1)throw Error('Multiple source primitives');const pr=primitives[0];if((pr.mode??4)!==4)throw Error('Nontriangle source');
  const m=world.get(nodeIndex),nm=normalMatrix(m),raw=accessor(gltf,bin,pr.attributes.POSITION),positions=new Float32Array(raw.length);
  for(let i=0;i<raw.length;i+=3)positions.set(point(m,raw.slice(i,i+3)),i);
  const indices=new Uint32Array(pr.indices==null?Array.from({length:raw.length/3},(_,i)=>i):accessor(gltf,bin,pr.indices));
  if(nm[9]<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  let normals;if(pr.attributes.NORMAL!=null){const ns=accessor(gltf,bin,pr.attributes.NORMAL);normals=new Float32Array(ns.length);for(let i=0;i<ns.length;i+=3)normals.set(transformNormal(nm,ns.slice(i,i+3)),i);}else normals=normalsFromTriangles(positions,indices);
  official.set(id,{positions,normals,indices,provenance:{kind:'Somakine official pinned GLB',elementId:id,url:rec.url,repository:'https://github.com/ivershuo/somakine',commit:record.commit,sourceFile:file,sourceFileBytes:b.length,sourceFileSha256:hash,nodeIndex,nodeName:node.name,worldMatrix:m,negativeDeterminantWindingReversed:nm[9]<0,modifications:['Extracted the named FJ mesh; baked the complete official GLB node hierarchy into Y-up metre coordinates.','Converted position/normal arrays to Float32 and triangle indices to Uint32; no extra decimation, no inferred mirror, no joint registration.']}});
 }
 sourceChecks.push({file,bytes:b.length,sha256:hash,pinnedGitBlobMatch:true,gitBlobSha:gitBlobHash,officialManifestMatch:expected?true:null,url:rec.url});
}
function parseOBJ(text){
 const vertices=[],faceVertices=[],out=[],indices=[],lookup=new Map();
 for(const line of text.split(/\r?\n/)){const p=line.trim().split(/\s+/);if(p[0]==='v')vertices.push(p.slice(1,4).map(Number));else if(p[0]==='f'){
  const face=p.slice(1).map(spec=>{let v=Number(spec.split('/')[0]);if(v<0)v=vertices.length+v+1;if(!vertices[v-1])throw Error('OBJ vertex invalid');if(!lookup.has(v)){lookup.set(v,out.length/3);const [x,y,z]=vertices[v-1];out.push(x*.001,z*.001,-y*.001);}return lookup.get(v);});
  for(let i=1;i+1<face.length;i++)indices.push(face[0],face[i],face[i+1]);
 }}
 const positions=new Float32Array(out),ix=new Uint32Array(indices);return {positions,normals:normalsFromTriangles(positions,ix),indices:ix};
}
const archivePath=path.join(audit,'bodyparts3d-official-isa.zip'),objDir=path.join(audit,'official-missing-obj');let objCount=0,archiveRecord=null;
if(fs.existsSync(objDir)){
 const expected=upstreamManifest.files.isa?.archive||upstreamManifest.files.archive;const entries=Object.values(upstreamManifest.files).find(v=>v?.archive?.name==='isa_BP3D_4.0_obj_99.zip');const ar=expected?.name==='isa_BP3D_4.0_obj_99.zip'?expected:entries?.archive;
 if(!ar)throw Error('Official source archive record unavailable');const b=fs.readFileSync(archivePath),hash=sha256(b);if(hash!==ar.sha256||b.length!==ar.bytes)throw Error('BodyParts3D official archive digest mismatch');archiveRecord={...ar,verifiedSha256:hash};
 const entryRecords=readJSON(path.join(audit,'obj-extraction-record.json'));
 for(const id of Object.keys(oldAssets).filter(id=>!official.has(id))){const obj=path.join(objDir,id+'.obj');if(!fs.existsSync(obj))continue;const b=fs.readFileSync(obj),entry=entryRecords.find(e=>e.elementId===id);if(!entry)throw Error('OBJ extraction record unavailable');official.set(id,{...parseOBJ(b.toString('utf8')),provenance:{kind:'BodyParts3D official archive OBJ',elementId:id,url:ar.url,archiveFile:ar.name,archiveBytes:ar.bytes,archiveSha256:hash,archiveEntry:entry.archiveEntry,sourceFileSha256:sha256(b),modifications:['Converted official source Z-up millimetres to Y-up metres: (x,y,z) -> (0.001x,0.001z,-0.001y).','Triangulated polygon faces in source order, indexed source vertex IDs, recomputed smooth vertex normals; no decimation, no inferred mirror, no joint registration.']}});objCount++;}
}
const arrays=[],assets={},assetRecords=[];let offset=0;
for(const id of Object.keys(oldAssets)){
 const a=official.get(id);if(!a)continue;if(a.normals.zeroAreaShadingFallbackVertices){a.provenance.zeroAreaShadingFallbackVertices=a.normals.zeroAreaShadingFallbackVertices;a.provenance.modifications.push('Used a deterministic unit Y normal solely for lighting at zero-area source vertices; source positions and triangle indices were unchanged.');}const p=Buffer.from(a.positions.buffer,a.positions.byteOffset,a.positions.byteLength),n=Buffer.from(a.normals.buffer,a.normals.byteOffset,a.normals.byteLength),ix=Buffer.from(a.indices.buffer,a.indices.byteOffset,a.indices.byteLength);
 if(a.positions.length!==a.normals.length||a.indices.length%3)throw Error(`Bad shape ${id}`);for(const v of a.positions)if(!Number.isFinite(v))throw Error(`Bad position ${id}`);for(const v of a.indices)if(v>=a.positions.length/3)throw Error(`Bad index ${id}`);
 const bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];let low=0,high=0,mid=0;for(let i=0;i<a.positions.length;i+=3){for(let k=0;k<3;k++){bounds[0][k]=Math.min(bounds[0][k],a.positions[i+k]);bounds[1][k]=Math.max(bounds[1][k],a.positions[i+k]);}if(a.positions[i+1]<a.positions[low+1])low=i;if(a.positions[i+1]>a.positions[high+1])high=i;}
 const center=bounds[0].map((v,k)=>(v+bounds[1][k])/2);let best=Infinity;for(let i=0;i<a.positions.length;i+=3){const dist=center.reduce((s,v,k)=>s+(v-a.positions[i+k])**2,0);if(dist<best){best=dist;mid=i;}}
 const samples=[low,high,mid].map(i=>Array.from(a.positions.subarray(i,i+3)));const localHash=sha256(Buffer.concat([p,n,ix]));
 assets[id]={id,english:oldAssets[id].english,positions:offset,normals:offset+p.length,indices:offset+p.length+n.length,vertexCount:a.positions.length/3,indexCount:a.indices.length,bounds,center,samples,source:a.provenance.kind,sourceIndex:a.provenance.nodeIndex??0,sourceMirrored:/M$/.test(id),sha256:localHash,license:'CC-BY-4.0',provenance:a.provenance};
 assetRecords.push({elementId:id,english:oldAssets[id].english,vertexCount:a.positions.length/3,indexCount:a.indices.length,localByteOffset:offset,localBytes:p.length+n.length+ix.length,localSha256:localHash,licenseId:'CC-BY-4.0',attribution:sourceManifest.source.attribution,...a.provenance});arrays.push(p,n,ix);offset+=p.length+n.length+ix.length;
}
const removedIds=Object.keys(oldAssets).filter(id=>!assets[id]),removedDefs={bones:[],muscles:[]};
for(const category of ['bones','muscles'])for(const [key,def] of Object.entries(d[category])){
 for(const [side,ids] of Object.entries(def.sides)){def.sides[side]=ids.filter(id=>assets[id]);if(!def.sides[side].length)delete def.sides[side];}
 if(!Object.keys(def.sides).length){removedDefs[category].push(key);delete d[category][key];}
}
for(const def of Object.values(d.muscles)){for(const key of ['originBones','insertionBones'])if(def[key])def[key]=def[key].filter(k=>d.bones[k]);}
for(const c of d.chapters){c.bones=c.bones.filter(k=>d.bones[k]);c.muscles=c.muscles.filter(k=>d.muscles[k]);c.context=c.context.filter(k=>d.bones[k]);if(c.muscleGroups)c.muscleGroups=c.muscleGroups.map(g=>({...g,keys:g.keys.filter(k=>d.muscles[k])})).filter(g=>g.keys.length);c.note='通过骨肌形态和相对位置进行辨认与拼接。颜色用于教学识别；本活动以静态解剖图谱为参照。';}
d.cartilage=d.cartilage.filter(id=>assets[id]);for(const k of Object.keys(d.teeth))d.teeth[k]=d.teeth[k].filter(id=>assets[id]);d.skullBoneKeys=d.skullBoneKeys.filter(k=>d.bones[k]);
d.assets=assets;d.version='3.0.0-ip-migration';d.title='动小学 · 骨肌拼接工坊';d.scope='Static anatomy identification and rigid placement against official source atlas coordinates. No measured joint registration, muscle dynamics, clinical force computation, or real gait inference.';
d.sources.models={title:'BodyParts3D 4.0 / official Somakine pinned geometry and verified official OBJ entries',url:'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html',license:'CC BY 4.0',somakineRepository:'https://github.com/ivershuo/somakine',somakineCommit:record.commit,notes:'Every old binary mesh was discarded. Geometry was freshly extracted from verified official sources. Complete scene transforms were baked to Y-up metres; no extra inferred mirrors or joint registration. See licenses/ASSET_PROVENANCE.json.'};
const all=Buffer.concat(arrays),chunkSize=4*1024*1024,chunks=[];
const assetsTarget=path.resolve(target,'assets');if(!assetsTarget.startsWith(target+path.sep)||target===path.resolve(original))throw Error('Unsafe output path');fs.mkdirSync(assetsTarget,{recursive:true});
// Delete only numbered geometry chunks in the verified new assembly output path.
for(const file of fs.readdirSync(assetsTarget).filter(f=>/^mesh-\d+\.bin$/.test(f)))fs.unlinkSync(path.join(assetsTarget,file));
for(let i=0; i*chunkSize<all.length;i++){const start=i*chunkSize,b=all.subarray(start,Math.min(start+chunkSize,all.length)),file=`mesh-${String(i).padStart(2,'0')}.bin`;fs.writeFileSync(path.join(assetsTarget,file),b);chunks.push({path:'assets/'+file,offset:start,bytes:b.length,sha256:sha256(b)});}
fs.writeFileSync(path.join(assetsTarget,'catalog.js'),'window.ASSEMBLY_DATA='+JSON.stringify(d)+';\n');
const manifest={format:'dxx-assembly-split-v1',sourceVersion:d.version,bytes:all.length,sha256:sha256(all),chunks};fs.writeFileSync(path.join(assetsTarget,'geometry-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const licenses=path.join(target,'licenses');fs.mkdirSync(licenses,{recursive:true});for(const file of ['LICENSE.bodyparts3d.txt','LICENSE.bodyparts3d-supplemental.txt','source-manifest.json','supplemental-manifest.json','upstream-manifest.json'])fs.copyFileSync(path.join(sourceDir,file),path.join(licenses,file));
const report={checkedAt:'2026-10-17',scope:'Source provenance and executable static mesh import; not legal certification or clinical validation.',somakineCommit:record.commit,originalMeshCount:Object.keys(oldAssets).length,discardedOldBinaryMeshes:Object.keys(oldAssets).length,glbMeshCount:assets?assetRecords.filter(a=>a.kind==='Somakine official pinned GLB').length:0,officialOBJMeshCount:objCount,newMeshCount:Object.keys(assets).length,removedMeshCount:removedIds.length,removedIds,removedDefs,chapters:d.chapters.map(c=>({id:c.id,name:c.name,boneTypes:c.bones.length,muscleTasks:c.muscles.length})),sourceChecks,archive:archiveRecord,geometry:manifest,assets:assetRecords};
fs.writeFileSync(path.join(licenses,'ASSET_PROVENANCE.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(audit,'rebuild-report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(licenses,'STATIC_GEOMETRY_MODIFICATIONS.txt'),`BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International\nLicense: https://creativecommons.org/licenses/by/4.0/\nOfficial license record: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html\nSomakine commit: ${record.commit}\n\nAll ${Object.keys(oldAssets).length} geometry entries from the supplied binary were discarded. This build freshly imports ${assetRecords.filter(a=>a.kind==='Somakine official pinned GLB').length} elements from the official pinned Somakine GLBs and ${objCount} from a digest-verified official BodyParts3D OBJ archive. Every element is mapped in ASSET_PROVENANCE.json.\nOfficial scene transforms were baked into Y-up metres. OBJ supplementation uses (x,y,z) -> (0.001x,0.001z,-0.001y), triangulation and recomputed normals. No new mirrored anatomy was inferred. No clinical joint registration, muscle force, tissue deformation, or gait validation is claimed.\nThe anatomy data and adaptations retain CC BY 4.0; framework MIT terms do not relicense third-party data. This provenance audit cannot certify rights in unrelated course text, branding, teacher materials, or other assets.\n`);
console.log(JSON.stringify({commit:record.commit,originalMeshCount:Object.keys(oldAssets).length,glbMeshCount:assetRecords.filter(a=>a.kind==='Somakine official pinned GLB').length,objMeshCount:objCount,newMeshCount:Object.keys(assets).length,removedMeshCount:removedIds.length,removedDefs,chapters:report.chapters,geometryBytes:all.length,geometrySha256:manifest.sha256,chunks:chunks.length},null,2));
