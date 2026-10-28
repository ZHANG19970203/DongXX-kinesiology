/* Clean static-atlas classroom runtime. No imported joint hierarchy or motion data. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {static:'静态观察可用', limited:'有限机制示意', discussion:'课程研讨'};
  const D = window.ASSEMBLY_DATA;
  const H = window.DXXHub;
  const state = {courses:[], course:null, region:D?.chapters?.[0]?.id || '', selected:-1, entries:[], partEntries:[], viewer:null, raw:null, loading:false, desiredLoad:false, angle:60, saved:null};
  const identity = H?.profile() || null;
  const recordKey = H?.labKey() || 'dxx_clean_guest_lab_v1';
  const profile = identity || {name:'访客',studentId:null,teacher:null};
  const emptyRecords = () => ({format:'dxx-clean-lab-record-v1',profile,observations:[],explanations:[],events:[]});
  function readRecords() {
    let saved = H?.read(recordKey, null);
    if (!saved) {try {saved = JSON.parse(localStorage.getItem(recordKey) || 'null');} catch {saved = null;}}
    if (!saved || saved.profile?.studentId !== profile.studentId || saved.profile?.teacher !== profile.teacher) return emptyRecords();
    return {format:'dxx-clean-lab-record-v1',profile,observations:Array.isArray(saved.observations)?saved.observations:[],explanations:Array.isArray(saved.explanations)?saved.explanations:[],events:Array.isArray(saved.events)?saved.events:[]};
  }
  state.saved = readRecords();
  function status(text) {$('pageStatus').textContent = text; $('pageStatus').hidden = !text;}
  function renderNav() {
    const order = ['static','limited','discussion'];
    $('courseNav').innerHTML = order.map(group => `<section class="nav-group"><h3>${labels[group]}</h3>${state.courses.filter(c => c.availability === group).map(c => `<button class="course-link ${state.course?.sourceId === c.sourceId ? 'active' : ''}" data-course="${c.sourceId}" aria-current="${state.course?.sourceId === c.sourceId ? 'page' : 'false'}"><span class="nav-number">${E(c.sourceId === 101 ? '01B' : String(c.sourceId).padStart(2,'0'))}</span><span>${E(c.title)}</span></button>`).join('')}</section>`).join('');
  }
  function courseHash(id) {return '#course-' + id;}
  function selectCourse(id, updateHash = true) {
    const c = state.courses.find(x => x.sourceId === Number(id)) || state.courses[0];
    if (!c) return;
    state.course = c;
    if (updateHash) history.replaceState(null, '', location.pathname + location.search + courseHash(c.sourceId));
    renderNav();
    $('courseTitle').textContent = c.title;
    $('courseAvailability').textContent = labels[c.availability];
    $('courseSummary').textContent = c.summary;
    $('courseTasks').innerHTML = c.tasks.map((t,i) => `<article class="task"><h3>${i+1}. ${E(t.title)}</h3><p>${E(t.instruction)}</p><small>${E(t.note)}</small></article>`).join('');
    $('relatedLink').hidden = !c.related;
    if (c.related) {$('relatedLink').href = c.related.href; $('relatedLink').textContent = c.related.label + ' →';}
    $('clinicLink').hidden = !c.clinicRelated; if(c.clinicRelated){$('clinicLink').href=c.clinicRelated.href;$('clinicLink').textContent=c.clinicRelated.label+' →';}
    $('mechanism').hidden = c.availability !== 'limited';
    const prompts = {
      1:'先把灰杆作为参考，描述绿杆的相对方向；再改变角度，区分“角度变了”与“整个图形移动”。',
      101:'这里固定端点和灰杆，仅能比较参考段与相对转动。请另外用文字分析远端接触条件；本示意不构成完整闭链求解。',
      2:'这是几何支架。你可在纸上另画外力与距离，说明力臂；滑条不提供受力结果。',
      3:'这里没有肌肉组织。先比较两杆几何关系，再根据课程任务的外负荷讨论向心、离心或等长收缩。'
    };
    $('mechanismPrompt').textContent = prompts[c.sourceId] || '';
    const region = D.chapters.find(r => r.id === c.defaultRegion);
    if (region) {$('regionSelect').value = region.id; changeRegion();}
    document.title = c.title + ' · 动小学';
    renderRecent();
    window.dispatchEvent(new CustomEvent('dxx:guide', {detail:{area:'lab',page:'course',title:c.title,sourceId:c.sourceId}}));
  }
  function chapter() {return D.chapters.find(c => c.id === state.region) || D.chapters[0];}
  function entriesForChapter(c) {
    const rows = [];
    for (const [type, keys, table] of [['bone', [...new Set([...(c.context || []), ...(c.bones || [])])], D.bones || {}], ['muscle', c.muscles || [], D.muscles || {}]]) {
      for (const key of keys) {
        const item = table[key];
        if (!item) continue;
        for (const [side, ids] of Object.entries(item.sides || {})) for (const id of Array.isArray(ids) ? ids : []) {
          if (!D.assets[id]) continue;
          rows.push({id, key, type, side, name:item.name || key, data:item});
        }
      }
    }
    return rows;
  }
  function colorFor(entry) {
    if (entry.type !== 'muscle') return [.82,.79,.69];
    const h = entry.data.displayColor;
    if (/^#[\da-f]{6}$/i.test(h || '')) return [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255);
    return [.74,.35,.31];
  }
  function changeRegion() {
    state.region = $('regionSelect').value;
    state.selected = -1;
    state.entries = entriesForChapter(chapter());
    state.partEntries = [];
    const byId = new Map();
    for (const entry of state.entries) if (!byId.has(entry.id)) {byId.set(entry.id, entry); state.partEntries.push(entry);}
    $('selectionDetails').innerHTML = '<b>选择一个结构</b><p>在图谱或列表中选择，查看名称与课程说明。</p>';
    $('assemblyLink').href = '../assembly/index.html?chapter=' + encodeURIComponent(state.region) + '&task=' + ($('showMuscles').checked ? 'muscle' : 'bone');
    if (state.viewer && state.raw) mount();
    renderStructures();
  }
  function isVisible(entry) {
    const side = $('sideSelect').value;
    const sideAccepted = side === 'both' || !['R','L'].includes(entry.side) || side === entry.side;
    return sideAccepted && (entry.type === 'muscle' ? $('showMuscles').checked : $('showBones').checked);
  }
  function renderStructures() {
    const q = $('structureSearch').value.trim().toLowerCase();
    const rows = state.partEntries.map((e,index) => ({...e,index})).filter(e => isVisible(e) && (e.name + ' ' + e.id + ' ' + (D.assets[e.id].english || '')).toLowerCase().includes(q));
    $('structureCount').textContent = rows.length + '个可显示网格 · 仅当前部位';
    $('structureList').innerHTML = rows.length ? rows.map(e => `<button class="structure-item ${state.selected === e.index ? 'selected' : ''}" data-part="${e.index}"><span>${E(e.name)} · ${E(e.side === 'L' ? '左' : e.side === 'R' ? '右' : '中线')}</span><small>${E(e.id)} · ${e.type === 'muscle' ? '肌肉' : '骨性结构'}</small></button>`).join('') : '<p class="small">没有匹配的可显示结构。可调整侧别、组织类型或搜索词。</p>';
  }
  function mount() {
    const v = state.viewer;
    const name = state.region;
    if (!v.datasets[name]) {
      const parts = state.partEntries.map(e => ({...D.assets[e.id],type:e.type,color:colorFor(e)}));
      if (!parts.length) {$('loading').querySelector('b').textContent = '本部位目录无可显示网格，请选择其他部位。'; return;}
      v.addDataset(name, {parts}, state.raw);
    }
    v.use(name, v.datasets[name].model.parts.map(() => SM.ident()));
    v.orient(chapter().view || 'front');
    updateVisibility(true);
    $('loading').querySelector('b').textContent = chapter().name + ' · 静态图谱 · 拖动旋转，滚轮缩放';
    $('viewerPlaceholder').hidden = true;
  }
  function updateVisibility(fit = false) {
    const v = state.viewer;
    if (v?.model) {
      v.visible = state.partEntries.map(isVisible);
      if (state.selected >= 0 && !v.visible[state.selected]) selectPart(-1);
      if (fit) v.fit();
      v.invalidate();
    }
    renderStructures();
    $('assemblyLink').href = '../assembly/index.html?chapter=' + encodeURIComponent(state.region) + '&task=' + ($('showMuscles').checked ? 'muscle' : 'bone');
  }
  async function loadViewer() {
    if (state.loading) return;
    state.desiredLoad = true;
    state.loading = true;
    $('loadAtlas').disabled = true;
    $('loadAtlas').textContent = '正在读取…';
    try {
      if (!state.raw) state.raw = await window.loadAssemblyGeometry();
      if (!state.viewer) {
        const options = {pick:selectPart,background:[.93,.96,.98],error:message => {$('loading').querySelector('b').textContent = message;}};
        try {state.viewer = new BoneViewer($('scene'), options);} catch (webglError) {
          const old = $('scene'), fresh = old.cloneNode(false);
          old.replaceWith(fresh);
          state.viewer = new BoneSoftwareViewer(fresh, options);
        }
        state.viewer.bind();
      }
      mount();
      $('loadAtlas').textContent = '图谱已打开';
    } catch (err) {
      $('loading').querySelector('b').textContent = '图谱未能打开：' + err.message;
      $('loadAtlas').textContent = '重新打开图谱';
      $('viewerPlaceholder').hidden = false;
    } finally {state.loading = false; $('loadAtlas').disabled = false;}
  }
  function selectPart(index) {
    index = Number(index);
    const entry = state.partEntries[index];
    state.selected = entry ? index : -1;
    if (state.viewer?.model) {
      state.viewer.model.parts.forEach((part,i) => {part.color = i === state.selected ? [.12,.60,.64] : colorFor(state.partEntries[i]);});
      state.viewer.selected = state.selected;
      state.viewer.invalidate();
    }
    if (!entry) {$('selectionDetails').innerHTML = '<b>未选择结构</b><p>在图谱或列表中选择一个可见结构。</p>'; renderStructures(); return;}
    const asset = D.assets[entry.id];
    const item = entry.data;
    $('selectionDetails').innerHTML = `<b>${E(entry.name)} · ${E(entry.side === 'L' ? '左侧' : entry.side === 'R' ? '右侧' : '中线结构')}</b><p>${E(item.tip || '旋转图谱，比较此结构与邻近结构的位置。')}</p>${entry.type === 'muscle' ? `<dl><dt>起点</dt><dd>${E(item.origin || '参见课程资料')}</dd><dt>止点</dt><dd>${E(item.insertion || '参见课程资料')}</dd><dt>功能</dt><dd>${E(item.function || '参见课程资料')}</dd></dl>` : ''}<p class="source">来源标识：${E(entry.id)}${asset.sourceMirrored ? ' · 来源为镜像衍生网格' : ''}。${E(asset.source || 'BodyParts3D / Somakine 静态图谱')}。附着与功能为课程文字说明，不是当前网格的实测附着坐标。<a href="../teacher-review.html">教师审查记录</a></p>`;
    renderStructures();
  }
  function renderAngle() {
    const a = Number($('rodAngle').value);
    state.angle = a;
    $('movingRod').setAttribute('transform', `rotate(${-a} 240 185)`);
    const r = a * Math.PI / 180;
    const end = [240 + 55*Math.cos(r), 185 - 55*Math.sin(r)];
    $('angleArc').setAttribute('d', `M295 185 A55 55 0 0 0 ${end[0].toFixed(2)} ${end[1].toFixed(2)}`);
    $('angleLabel').textContent = a + '°';
    $('rodAngleOutput').textContent = a + '°';
  }
  function saveObservation() {
    const text = $('observationText').value.trim(), explanation = $('explanationText').value.trim();
    if (!text && !explanation) {$('recordStatus').textContent = '请先填写一条观察或解释。'; $('observationText').focus(); return;}
    if (!state.course) return;
    const now = new Date().toISOString();
    const selected = state.partEntries[state.selected];
    const observation = {title:state.course.title,sourceId:state.course.sourceId,at:now,kind:state.course.availability,region:chapter().name,selectedStructure:selected ? {name:selected.name,sourceId:selected.id,side:selected.side} : null,view:state.viewer ? {yaw:state.viewer.yaw,pitch:state.viewer.pitch,radius:state.viewer.radius} : null,text,scope:'静态形态观察、有限几何示意或文字研讨记录；不代表临床测量。'};
    if (state.course.availability === 'limited') observation.idealRodAngleDegrees = state.angle;
    state.saved.observations.push(observation);
    if (explanation) state.saved.explanations.push({title:state.course.title,sourceId:state.course.sourceId,at:now,text:explanation});
    state.saved.events.push({type:'save_observation',sourceId:state.course.sourceId,at:now});
    let persisted = true;
    try {localStorage.setItem(recordKey, JSON.stringify(state.saved));} catch {persisted = false;}
    $('recordStatus').textContent = persisted ? '已保存到此浏览器。可导出本页记录，或返回首页导出合并记录。' : '浏览器禁止本地保存。记录暂留本页，请立即导出后再离开。';
    $('observationText').value = ''; $('explanationText').value = '';
    renderRecent();
  }
  function renderRecent() {
    $('recordCount').textContent = state.saved.observations.length + '项观察';
    const rows = state.saved.observations.filter(r => r.sourceId === state.course?.sourceId).slice(-3).reverse();
    $('recentRecords').innerHTML = rows.map(r => `<article class="recent-row"><b>${E(r.title)} · ${E(r.region)}</b><small> ${E(new Date(r.at).toLocaleString('zh-CN'))}</small><p>${E(r.text || '已保存文字解释')}</p></article>`).join('');
  }
  function exportRecords() {
    const result = {...state.saved,exportedAt:new Date().toISOString()};
    const blob = new Blob([JSON.stringify(result,null,2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = '动小学_' + (identity?.studentId || '访客') + '_课程观察记录.json';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
  async function start() {
    $('identity').textContent = identity ? identity.name + '同学 · ' + identity.studentId : '访客浏览';
    $('entryNotice').hidden = !!identity;
    if (!D || !Array.isArray(D.chapters) || !D.assets) {status('静态图谱目录未能读取，请检查完整网站文件。'); return;}
    $('regionSelect').innerHTML = D.chapters.map(c => `<option value="${E(c.id)}">${E(c.name)}</option>`).join('');
    const params = new URLSearchParams(location.search);
    if (params.get('topic') === 'muscles') $('showMuscles').checked = true;
    try {
      const response = await fetch('courses.json');
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data.courses) || data.courses.length !== 13) throw Error('课程目录格式不完整');
      state.courses = data.courses;
      const hashId = location.hash.match(/^#course-(\d+)$/)?.[1];
      selectCourse(hashId || 1, false);
      if (params.get('topic') === 'muscles') {$('atlasTitle').textContent = '人体主要肌肉 · 静态图谱素材'; $('atlasTitle').scrollIntoView({block:'start'});}
      status('');
    } catch (err) {status('课程目录未能读取：' + err.message + '。请通过本地预览地址或部署网址打开完整网站。');}
    changeRegion(); renderAngle(); renderRecent();
  }
  $('courseNav').onclick = event => {const b = event.target.closest('[data-course]'); if (b) selectCourse(b.dataset.course);};
  $('regionSelect').onchange = changeRegion;
  ['showBones','showMuscles','sideSelect'].forEach(id => $(id).onchange = () => updateVisibility(true));
  $('structureSearch').oninput = renderStructures;
  $('structureList').onclick = event => {const b = event.target.closest('[data-part]'); if (b) {selectPart(b.dataset.part); if (!state.viewer) $('recordStatus').textContent = '已选择结构文字。打开三维图谱后可观察对应网格。';}};
  $('loadAtlas').onclick = loadViewer;
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => {if (state.viewer?.model) {state.viewer.orient(button.dataset.view);}});
  $('fitView').onclick = () => state.viewer?.model && state.viewer.fit();
  $('rodAngle').oninput = renderAngle;
  $('saveObservation').onclick = saveObservation;
  $('exportRecords').onclick = exportRecords;
  window.addEventListener('hashchange', () => {const id = location.hash.match(/^#course-(\d+)$/)?.[1]; if (id) selectCourse(id,false);});
  window.DXXCleanLab = {state,selectCourse,loadViewer,selectPart,saveObservation,records:() => JSON.parse(JSON.stringify(state.saved))};
  start().catch(err => status('页面未能准备完成：' + err.message));
})();
