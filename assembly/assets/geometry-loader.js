/* On-demand verified loading of the rebuilt official static anatomy buffer. */
(function(){'use strict';
 const base=new URL('../',document.currentScript.src),d=window.DXX_ASSEMBLY_LOAD={state:'idle',bytes:0,sha256:null};let pending=null,buffer=null;
 const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
 async function digest(b){return globalThis.crypto?.subtle?hex(await crypto.subtle.digest('SHA-256',b)):null;}
 function notify(msg){const e=document.querySelector('#loading b');if(e)e.textContent=msg;}
 async function read(path,size,hash){
  const url=new URL(path,base);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw Error('不允许的资源路径。');
  let last;for(let i=0;i<2;i++){const c=new AbortController(),timer=setTimeout(()=>c.abort(),120000);
   try{const r=await fetch(url,{signal:c.signal,credentials:'same-origin',cache:'default'});if(!r.ok){const e=Error('模型文件未能读取（HTTP '+r.status+'）：'+path);e.noRetry=r.status===404;throw e;}const b=await r.arrayBuffer();if(size!=null&&b.byteLength!==size)throw Error('模型文件未完整上传：'+path);const h=hash?await digest(b):null;if(h&&h!==hash)throw Error('模型校验失败，请重新上传：'+path);return b;
   }catch(e){last=e;if(e.noRetry)break;if(i===0)await new Promise(r=>setTimeout(r,400));}finally{clearTimeout(timer);}
  }throw last;
 }
 async function load(){
  if(location.protocol==='file:')throw Error('分文件网站需在HTTP/HTTPS下打开。请部署后访问网站，或用根目录start_local.py本地预览。');
  d.state='loading';d.bytes=0;notify('正在读取模型目录…');
  const m=JSON.parse(new TextDecoder().decode(await read('assets/geometry-manifest.json')));if(m.format!=='dxx-assembly-split-v1')throw Error('拼接模型清单格式不匹配。');
  const all=new Uint8Array(m.bytes);let off=0,index=0,finished=0;
  for(const c of m.chunks){if(c.offset!==off||c.bytes<0||c.offset+c.bytes>m.bytes)throw Error('模型分片顺序不完整。');off+=c.bytes;}if(off!==m.bytes)throw Error('模型分片缺失。');
  async function work(){while(index<m.chunks.length){const c=m.chunks[index++],b=await read(c.path,c.bytes,c.sha256);all.set(new Uint8Array(b),c.offset);d.bytes+=b.byteLength;finished++;notify('正在准备完整骨肌：'+finished+' / '+m.chunks.length+'（'+(d.bytes/1048576).toFixed(1)+' MiB）');}}
  await Promise.all(Array.from({length:Math.min(3,m.chunks.length)},work));
  const h=await digest(all.buffer);if(h&&h!==m.sha256)throw Error('模型组合校验失败。');buffer=all.buffer;d.state='ready';d.sha256=h;d.byteLength=buffer.byteLength;d.integrity=h?'SHA-256 + byte lengths':'byte lengths only';return buffer;
 }
 window.loadAssemblyGeometry=function(){if(buffer)return Promise.resolve(buffer);if(!pending)pending=load().catch(e=>{d.state='error';d.error=e.message;pending=null;notify(e.message);throw e;});return pending;};
})();
