/* Original procedural data stage. No anatomical registration or imported scene assets.
 * Sensor positions are source drawing coordinates. Column height is a display map.
 */
(() => {
  'use strict';
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const colorStops = [
    [0,[.055,.16,.48]],[.18,[.025,.43,.83]],[.38,[.025,.85,.84]],
    [.57,[.28,.90,.34]],[.75,[.99,.86,.17]],[.9,[1,.36,.09]],[1,[.91,.08,.11]]
  ];
  function color(value) {
    const t=clamp(value,0,1);
    for(let i=1;i<colorStops.length;i++) if(t<=colorStops[i][0]) {
      const [a,ca]=colorStops[i-1],[b,cb]=colorStops[i],q=(t-a)/(b-a);
      return ca.map((v,k)=>v+(cb[k]-v)*q);
    }
    return colorStops.at(-1)[1].slice();
  }
  function identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
  function pose(x,y,z,sx=1,sy=1,sz=1){const m=identity();m[0]=sx;m[5]=sy;m[10]=sz;m[12]=x;m[13]=y;m[14]=z;return m;}
  function box() {
    const p=[],n=[],indices=[];
    const faces=[
      [[-.5,0,.5],[.5,0,.5],[.5,1,.5],[-.5,1,.5],[0,0,1]],
      [[.5,0,-.5],[-.5,0,-.5],[-.5,1,-.5],[.5,1,-.5],[0,0,-1]],
      [[.5,0,.5],[.5,0,-.5],[.5,1,-.5],[.5,1,.5],[1,0,0]],
      [[-.5,0,-.5],[-.5,0,.5],[-.5,1,.5],[-.5,1,-.5],[-1,0,0]],
      [[-.5,1,.5],[.5,1,.5],[.5,1,-.5],[-.5,1,-.5],[0,1,0]],
      [[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[0,-1,0]]
    ];
    for(const f of faces){const k=p.length/3;for(let i=0;i<4;i++){p.push(...f[i]);n.push(...f[4]);}indices.push(k,k+1,k+2,k,k+2,k+3);}
    return {p,n,i:indices,bounds:[[-.5,0,-.5],[.5,1,.5]]};
  }
  function cylinder(segments=14) {
    const p=[],n=[],indices=[];
    for(let j=0;j<segments;j++) {
      const a=j*Math.PI*2/segments,b=(j+1)*Math.PI*2/segments;
      const A=[Math.cos(a),Math.sin(a)],B=[Math.cos(b),Math.sin(b)],k=p.length/3;
      p.push(A[0],0,A[1],B[0],0,B[1],B[0],1,B[1],A[0],1,A[1]);
      n.push(A[0],0,A[1],B[0],0,B[1],B[0],0,B[1],A[0],0,A[1]);
      indices.push(k,k+1,k+2,k,k+2,k+3);
      const t=p.length/3;p.push(0,1,0,A[0],1,A[1],B[0],1,B[1]);n.push(0,1,0,0,1,0,0,1,0);indices.push(t,t+1,t+2);
      const d=p.length/3;p.push(0,0,0,B[0],0,B[1],A[0],0,A[1]);n.push(0,-1,0,0,-1,0,0,-1,0);indices.push(d,d+1,d+2);
    }
    return {p,n,i:indices,bounds:[[-1,0,-1],[1,1,1]]};
  }
  function sphere(rings=8,segments=12) {
    const p=[],n=[],indices=[];
    for(let i=0;i<=rings;i++) for(let j=0;j<=segments;j++) {
      const a=i*Math.PI/rings,b=j*Math.PI*2/segments,v=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];p.push(...v);n.push(...v);
    }
    for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const k=i*(segments+1)+j;indices.push(k,k+1,k+segments+2,k,k+segments+2,k+segments+1);}
    return {p,n,i:indices,bounds:[[-1,-1,-1],[1,1,1]]};
  }
  function convexHull(points) {
    const a=points.map(p=>[p[0],p[2]]).sort((p,q)=>p[0]-q[0]||p[1]-q[1]);
    const cross=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
    const lo=[],hi=[];
    for(const p of a){while(lo.length>=2&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
    for(const p of a.slice().reverse()){while(hi.length>=2&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}
    return lo.slice(0,-1).concat(hi.slice(0,-1));
  }
  function deck(hull) {
    const p=[],n=[],indices=[],low=.092,high=.144;
    const cx=hull.reduce((s,v)=>s+v[0],0)/hull.length,cz=hull.reduce((s,v)=>s+v[1],0)/hull.length;
    for(let j=0;j<hull.length;j++) {
      const a=hull[j],b=hull[(j+1)%hull.length],k=p.length/3;
      p.push(cx,high,cz,a[0],high,a[1],b[0],high,b[1]);n.push(0,1,0,0,1,0,0,1,0);indices.push(k,k+1,k+2);
      const v=p.length/3,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
      p.push(a[0],low,a[1],b[0],low,b[1],b[0],high,b[1],a[0],high,a[1]);
      for(let i=0;i<4;i++)n.push(dz/len,0,-dx/len);indices.push(v,v+1,v+2,v,v+2,v+3);
    }
    return {p,n,i:indices,bounds:[[Math.min(...hull.map(a=>a[0])),low,Math.min(...hull.map(a=>a[1]))],[Math.max(...hull.map(a=>a[0])),high,Math.max(...hull.map(a=>a[1]))]]};
  }
  function circle(x,y,z,r,count=36){return Array.from({length:count+1},(_,i)=>[x+Math.cos(i*Math.PI*2/count)*r,y,z+Math.sin(i*Math.PI*2/count)*r]);}

  window.PressureStage=class PressureStage {
    constructor(canvas,{onSelect=()=>{},onError=()=>{}}={}) {
      this.canvas=canvas;this.onSelect=onSelect;this.onError=onError;this._data=null;this._key='';this._parts=[];this._meshes=[];this._fixedPaths=[];this._sensorParts=[];this._columns=[];this._chips=[];this._heights=[];this.selected=-1;this.view='oblique';this.ready=false;this.mode='columns';this._lost=false;
      if(!canvas||typeof canvas.getContext!=='function'){this._error('三维实验台的显示区域不可用。');return;}
      canvas.style.touchAction='none';if(canvas.tabIndex<0)canvas.tabIndex=0;
      canvas.setAttribute('aria-label','三维数据实验台：拖动旋转，滚轮缩放，点击传感单元。柱高为原值的显示映射。');
      try {
        if(typeof window.BoneViewer!=='function')throw Error('三维显示组件尚未准备完成。');
        this.viewer=new BoneViewer(canvas,{background:[.014,.026,.049],pick:index=>this._picked(index),draw:()=>this._drawLabels(),error:message=>this._error(message)});
        this._lighting();
        this.viewer.bind();
        const originalPick=this.viewer.pick.bind(this.viewer);
        this.viewer.pick=(x,y)=>{const result=originalPick(x,y);if(result<0)this._pickNear(x,y);return result;};
        canvas.addEventListener('webglcontextlost',()=>{this._lost=true;this._error('三维显示暂时中断，可继续使用二维数值页。');});
        this.labelLayer=document.createElement('div');this.labelLayer.className='stage-sensor-labels';this.labelLayer.hidden=true;this.labelButtons=[];
        for(let i=0;i<32;i++){const button=document.createElement('button');button.type='button';button.textContent=String(i);button.setAttribute('aria-label','选中三维测点 '+i);button.addEventListener('click',event=>{event.stopPropagation();this._picked(this._columns[i]);});this.labelLayer.append(button);this.labelButtons.push(button);}
        canvas.parentElement.append(this.labelLayer);this.orientationLayer=document.createElement('div');this.orientationLayer.className='stage-orientation';this.orientationLabels=['趾端','跟端'].map(text=>{const span=document.createElement('span');span.textContent=text;this.orientationLayer.append(span);return span;});canvas.parentElement.append(this.orientationLayer);this.ready=true;
      } catch(error){this._error(error.message||'三维实验台未能打开，可继续使用二维数值页。');}
    }
    _error(message){try{this.onError(String(message));}catch{} }
    _lighting() {
      const v=this.viewer,g=v.gl;
      const vs='precision highp float;attribute vec3 aP,aN;uniform mat4 uVP,uM;varying vec3 N,W;void main(){vec4 p=uM*vec4(aP,1.);W=p.xyz;N=mat3(uM)*aN;gl_Position=uVP*p;gl_PointSize=7.;}';
      const fs=`precision highp float;varying vec3 N,W;uniform vec3 uColor,uEye,uPick;uniform float uSelected,uAlpha;uniform bool uPicking,uUnlit;
      void main(){if(uPicking){gl_FragColor=vec4(uPick,1.);return;}if(uUnlit){gl_FragColor=vec4(uColor,uAlpha);return;}
      vec3 n=normalize(N);if(!gl_FrontFacing)n=-n;vec3 eye=normalize(uEye-W);vec3 key=normalize(vec3(-2.,5.,2.)-W);vec3 fill=normalize(vec3(3.,2.,-3.)-W);
      float diffuse=max(0.,dot(n,key)),second=max(0.,dot(n,fill));float spec=pow(max(0.,dot(n,normalize(key+eye))),48.);float rim=pow(1.-abs(dot(n,eye)),3.);
      vec3 c=uColor*(.43+.54*diffuse+.16*second)+vec3(.35,.55,.65)*spec*.35+vec3(.015,.055,.075)*rim;
      c*=clamp((W.y+1.2)*.3+.65,.63,1.);c=mix(c,vec3(.018,.032,.058),clamp(length(W.xz)/12.,0.,.35));gl_FragColor=vec4(c,uAlpha);}`;
      const shader=(type,source)=>{const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};
      const vertex=shader(g.VERTEX_SHADER,vs),fragment=shader(g.FRAGMENT_SHADER,fs),program=g.createProgram();g.attachShader(program,vertex);g.attachShader(program,fragment);g.linkProgram(program);
      if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error('实验台灯光未能准备完成。');
      g.deleteProgram(v.prog);g.deleteShader(vertex);g.deleteShader(fragment);v.prog=program;v.at={p:g.getAttribLocation(program,'aP'),n:g.getAttribLocation(program,'aN')};
      for(const name of ['VP','M','Color','Eye','Pick','Selected','Alpha','Picking','Unlit'])v.u[name]=g.getUniformLocation(program,'u'+name);
    }
    _add(name,geometry,paint,transform=identity(),extra={}) {
      const index=this._parts.length;this._parts.push({name,label:name,type:'stage',color:paint.slice(),bounds:geometry.bounds,pickable:false,...extra});this._meshes.push(geometry);this._transforms.push(transform);return index;
    }
    _disposeScene() {
      const v=this.viewer;if(!v)return;
      for(const dataset of Object.values(v.datasets))for(const m of dataset.meshes||[])for(const key of ['p','n','i'])if(m[key])v.gl.deleteBuffer(m[key]);
      v.datasets={};
    }
    _build(points) {
      const v=this.viewer;this._disposeScene();this._parts=[];this._meshes=[];this._transforms=[];this._fixedPaths=[];this._sensorParts=[];this._columns=[];this._chips=[];
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y);this._center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];this._scale=2.64/Math.max(1,Math.max(...ys)-Math.min(...ys));
      this._world=points.map(p=>this._map(p.x,p.y,.16));
      const boxMesh=box(),cylinderMesh=cylinder(),sphereMesh=sphere();
      this._add('实验空间地面',boxMesh,[.021,.039,.062],pose(0,-1.13,0,9,.035,9));
      this._add('测量台底座',boxMesh,[.06,.09,.13],pose(0,-.11,0,1.76,.18,3.34));
      this._add('测量台上板',boxMesh,[.12,.17,.22],pose(0,.055,0,1.72,.03,3.30));
      for(const x of [-.70,.70])for(const z of [-1.36,1.36]){
        this._add('桌腿',boxMesh,[.07,.11,.15],pose(x,-1.08,z,.10,.98,.10));
        this._add('桌脚',cylinderMesh,[.09,.14,.18],pose(x,-1.09,z,.13,.045,.13));
      }
      for(const x of [-.84,.84]){
        this._add('测量台侧边框',boxMesh,[.24,.30,.35],pose(x,.075,0,.035,.045,3.32));
        this._add('侧边照明带',boxMesh,[.05,.57,.67],pose(x,.12,0,.012,.009,3.20));
      }
      for(const z of [-1.64,1.64])this._add('测量台端框',boxMesh,[.24,.30,.35],pose(0,.075,z,1.72,.045,.035));
      // Two original light columns give depth cues without representing equipment.
      for(const x of [-1.22,1.22]){
        this._add('环境灯座',cylinderMesh,[.06,.10,.15],pose(x,-1.08,-1.90,.17,.07,.17));
        this._add('环境灯柱',boxMesh,[.08,.13,.18],pose(x,-1.02,-1.90,.055,2.04,.055));
        this._add('环境灯光面',boxMesh,[.11,.62,.72],pose(x,-.87,-1.865,.022,1.76,.014));
      }
      const hull=convexHull(this._world);this._add('来源布局数据底板',deck(hull),[.065,.135,.18]);
      this._fixedPaths.push({points:[...hull,hull[0]].map(([x,z])=>[x,.15,z]),color:[.11,.39,.48]});
      for(let i=-4;i<=4;i++)this._fixedPaths.push({points:[[-4,-1.086,i],[4,-1.086,i]],color:[.045,.105,.145]},{points:[[i,-1.086,-4],[i,-1.086,4]],color:[.045,.105,.145]});
      for(let i=-7;i<=7;i++){
        const z=i*.20;this._fixedPaths.push({points:[[-.79,.09,z],[.79,.09,z]],color:[.09,.19,.24]});
      }
      for(let i=-3;i<=3;i++)this._fixedPaths.push({points:[[i*.20,.09,-1.52],[i*.20,.09,1.52]],color:[.09,.19,.24]});
      for(let i=0;i<points.length;i++) {
        const [x,,z]=this._world[i];
        const chip=this._add('传感单元 '+i,cylinderMesh,[.08,.23,.38],pose(x,.147,z,.054,.022,.054),{pickable:true,sensorIndex:i});
        const column=this._add('原值显示柱 '+i,cylinderMesh,color(0),pose(x,.17,z,.041,.01,.041),{pickable:true,sensorIndex:i});
        this._chips.push(chip);this._columns.push(column);this._sensorParts.push(chip,column);
        this._fixedPaths.push({points:circle(x,.17,z,.055,20),color:[.09,.31,.40]});
      }
      this._copOrb=this._add('当前CoP标记',sphereMesh,[1,.76,.25],pose(0,1.13,0,.047,.047,.047),{role:'ghost'});
      this._copBase=this._add('当前CoP定位点',cylinderMesh,[1,.71,.19],pose(0,.153,0,.027,.014,.027),{role:'ghost'});
      // Pack generated primitives once. Frames update only transforms and colours.
      const geometryOffsets=new Map();let bytes=0;
      for(const geometry of this._meshes)if(!geometryOffsets.has(geometry)){
        const offsets={positions:bytes,normals:bytes+geometry.p.length*4,indices:bytes+(geometry.p.length+geometry.n.length)*4};
        bytes+=(geometry.p.length+geometry.n.length+geometry.i.length)*4;geometryOffsets.set(geometry,offsets);
      }
      const buffer=new ArrayBuffer(bytes);
      for(const [geometry,offset]of geometryOffsets){new Float32Array(buffer,offset.positions,geometry.p.length).set(geometry.p);new Float32Array(buffer,offset.normals,geometry.n.length).set(geometry.n);new Uint32Array(buffer,offset.indices,geometry.i.length).set(geometry.i);}
      this._parts.forEach((part,i)=>{const geometry=this._meshes[i];Object.assign(part,geometryOffsets.get(geometry),{vertexCount:geometry.p.length/3,indexCount:geometry.i.length});});
      v.addDataset('pressure-stage',{parts:this._parts},buffer);v.use('pressure-stage',this._transforms);this.setView(this.view);this._traceCache=null;
    }
    _map(x,y,height=.16){return [(x-this._center[0])*this._scale,height,(y-this._center[1])*this._scale];}
    _valid(frame,threshold){return frame&&Number.isFinite(frame.sum)&&frame.sum>0&&frame.sum>=threshold&&Array.isArray(frame.cop)&&frame.cop.length===2&&frame.cop.every(Number.isFinite);}
    _traces(frames,threshold,endIndex) {
      if(this._traceCache?.frames===frames&&this._traceCache.threshold===threshold&&this._traceCache.endIndex===endIndex)return this._traceCache.paths;
      const paths=[];let run=[];
      const finish=()=>{if(run.length>1)paths.push({points:run,color:[.96,.65,.17]});run=[];};
      for(const frame of frames.slice(0,endIndex+1)){if(this._valid(frame,threshold))run.push(this._map(frame.cop[0],frame.cop[1],.177));else finish();}finish();
      this._traceCache={frames,threshold,endIndex,paths};return paths;
    }
    update(options={}) {
      if(!this.ready||this._lost)return false;
      const {points,frame,frames=[],threshold=0,maxValue,side='L',trace=true,revealCop=true,selected=this.selected}=options;
      if(!Array.isArray(points)||points.length!==32||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||!frame||!Array.isArray(frame.values)||frame.values.length!==32||frame.values.some(x=>!Number.isFinite(x)||x<0)){
        this._error('三维数据实验台没有收到完整的32通道帧。');return false;
      }
      this._data={...options,points,frame,frames,threshold:Number.isFinite(threshold)?Math.max(0,threshold):0,maxValue:Number.isFinite(maxValue)&&maxValue>0?maxValue:Math.max(1,...frame.values),side,trace:!!trace,revealCop:revealCop!==false};
      const key=side+'|'+points.map(p=>p.x+','+p.y).join(';');
      if(key!==this._key){this._key=key;this._build(points);}
      this.selected=Number.isInteger(selected)&&selected>=0&&selected<32?selected:-1;
      this._apply();return true;
    }
    _apply() {
      const d=this._data,v=this.viewer;if(!d||!v.model)return;
      this._heights=d.frame.values.map(value=>.008+.83*clamp(value/d.maxValue,0,1));
      for(let i=0;i<32;i++) {
        const [x,,z]=this._world[i],selected=i===this.selected,paint=color(d.frame.values[i]/d.maxValue);
        this._parts[this._columns[i]].color=selected?paint.map((c,j)=>Math.min(1,c*.72+[.34,.30,.22][j])):paint;
        this._parts[this._chips[i]].color=selected?[.95,.94,.70]:paint.map(c=>c*.46+.025);
        this._transforms[this._columns[i]]=pose(x,.17,z,this.mode==='points'?.047:.041,this.mode==='points'?.012:this._heights[i],this.mode==='points'?.047:.041);
      }
      v.transforms=this._transforms;
      const visible=d.revealCop&&this._valid(d.frame,d.threshold);
      v.visible[this._copOrb]=visible;v.visible[this._copBase]=visible;
      const paths=this._fixedPaths.slice();
      if(d.revealCop&&d.trace)paths.push(...this._traces(d.frames,d.threshold,d.frame.index));
      if(visible) {
        const [x,,z]=this._map(d.frame.cop[0],d.frame.cop[1]);
        this._transforms[this._copOrb]=pose(x,1.125,z,.047,.047,.047);this._transforms[this._copBase]=pose(x,.154,z,.028,.014,.028);
        paths.push({points:[[x,.18,z],[x,1.07,z]],color:[1,.76,.27]},{points:circle(x,.18,z,.09),color:[1,.79,.30]},{points:circle(x,1.125,z,.087),color:[.95,.73,.27]});
      }
      if(this.selected>=0) {
        const [x,,z]=this._world[this.selected],height=this.mode==='points'?.012:this._heights[this.selected];
        paths.push({points:circle(x,.17+height+.004,z,.060),color:[1,1,.91],overlay:true},{points:circle(x,.175,z,.079),color:[.65,.93,1],overlay:true});
      }
      v.paths=paths;v.axes=[];v.planes=[];v.invalidate();
      if(this.labelLayer)this.labelLayer.hidden=!d.labels;
    }
    _drawLabels(){
      if(!this._data||!this.viewer.vp)return;
      const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
      if(this.orientationLabels){const zs=this._world.map(p=>p[2]);[Math.min(...zs)-.19,Math.max(...zs)+.19].forEach((z,i)=>{const p=this.viewer.project([0,.16,z]),label=this.orientationLabels[i];label.hidden=!p[2]||p[0]<0||p[0]>width||p[1]<0||p[1]>height;label.style.left=p[0]+'px';label.style.top=p[1]+'px';});}
      if(!this.labelLayer||this.labelLayer.hidden)return;
      this.labelButtons.forEach((button,i)=>{const world=this._world[i],columnHeight=this.mode==='points'?.012:this._heights[i];const p=this.viewer.project([world[0],.205+columnHeight,world[2]]);button.hidden=!p[2]||p[0]<0||p[0]>width||p[1]<0||p[1]>height;button.style.left=p[0]+'px';button.style.top=p[1]+'px';button.title='测点 '+i+' · 原值 '+this._data.frame.values[i];button.setAttribute('aria-pressed',String(i===this.selected));});
    }
    _picked(partIndex) {
      const index=this._parts[partIndex]?.sensorIndex;
      if(!Number.isInteger(index))return;
      this.selected=index;this._apply();try{this.onSelect(index);}catch(error){this._error(error.message);}
    }
    _pickNear(clientX,clientY) {
      if(!this._data||!this.viewer.vp)return;
      const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;let best=null;
      for(let i=0;i<32;i++) {
        const world=this._world[i],height=this.mode==='points'?.012:this._heights[i];
        for(const p of [[world[0],.17+height,world[2]],[world[0],.17,world[2]]]) {
          const q=this.viewer.project(p);if(!q[2])continue;const distance=Math.hypot(q[0]-x,q[1]-y);
          if(distance<16&&(!best||distance<best.distance))best={index:i,distance};
        }
      }
      if(best)this._picked(this._columns[best.index]);
    }
    setView(name='oblique') {
      if(!['oblique','top','side'].includes(name))name='oblique';this.view=name;
      if(!this.viewer)return;
      const v=this.viewer;v.target=[0,.35,0];v.fov=.66;
      if(name==='top'){v.yaw=0;v.pitch=1.49;v.radius=5.15;}
      else if(name==='side'){v.yaw=-Math.PI/2;v.pitch=.16;v.radius=5.25;}
      else {v.yaw=-.64;v.pitch=.61;v.radius=5.30;}
      const aspect=Math.max(.3,this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight));
      if(aspect<.85)v.radius*=1.22;
      v.saveView();v.invalidate();
    }
    reset(){this.setView('oblique');}
    setMode(mode){this.mode=mode==='points'?'points':'columns';if(this.ready)this._apply();}
    destroy(){if(this.viewer){this.viewer.observer?.disconnect();this._disposeScene();this.viewer.dropFbo?.();this.viewer.gl.deleteProgram(this.viewer.prog);}this.labelLayer?.remove();this.orientationLayer?.remove();this.ready=false;}
  };
})();
