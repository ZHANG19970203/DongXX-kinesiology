/* Original geometric teaching illustrations. No anatomical mesh, motion capture, joint chain or physiological solver. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TAU = 2 * Math.PI;
  const modules = {
    gait: {title: '步态节律观察', short: '步态节律', subtitle: '通过两条抽象相位曲线，观察交替与相位偏移。', scope: '节律示意，无实测步态数据', seconds: 5},
    muscle: {title: '收缩机制观察', short: '收缩机制', subtitle: '通过抽象肌束，区分长度变化与作用方向。', scope: '机制示意，不计算肌力', seconds: 6},
    breath: {title: '呼吸方向观察', short: '呼吸方向', subtitle: '比较胸廓、膈肌与腹壁的轮廓方向。', scope: '轮廓方向示意，不计算容量', seconds: 7},
    tread: {title: '跑台参数观察', short: '跑台调节', subtitle: '一次改变一个条件，比较抽象速度与坡度档位。', scope: '参数关系示意，无运动处方', seconds: 8}
  };
  const state = Object.fromEntries(Object.keys(modules).map((key) => [key, {phase: 0, playing: false, speed: 1}]));
  const modeNames = {shorten: '缩短', lengthen: '延长', hold: '长度保持'};
  let topic = 'gait';
  let previousFrame = 0;
  let reference = {speed: 2, slope: 0};
  let memoryRecords = [];
  let useMemoryRecords = false;
  const profile = window.DXXHub?.profile?.();
  const recordKey = profile
    ? 'dxx_topics_clean_v1_' + profile.teacher + '|' + profile.studentId
    : 'dxx_topics_clean_v1_演示访客|preview';

  function text(c, value, x, y, size = 16, color = '#49758c', align = 'left') {
    c.font = size + 'px system-ui, "Microsoft YaHei", sans-serif';
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(value, x, y);
  }
  function stroke(c, points, color, width = 2, dash = []) {
    c.save(); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.setLineDash(dash);
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); c.restore();
  }
  function dot(c, x, y, radius, color) {
    c.beginPath(); c.arc(x, y, radius, 0, TAU); c.fillStyle = color; c.fill();
  }
  function arrow(c, x1, y1, x2, y2, color = '#078c97', width = 3) {
    stroke(c, [[x1, y1], [x2, y2]], color, width);
    const a = Math.atan2(y2 - y1, x2 - x1);
    stroke(c, [[x2 - 10 * Math.cos(a - .45), y2 - 10 * Math.sin(a - .45)], [x2, y2], [x2 - 10 * Math.cos(a + .45), y2 - 10 * Math.sin(a + .45)]], color, width);
  }
  function canvas(id) {
    const el = $(id), c = el.getContext('2d');
    c.clearRect(0, 0, el.width, el.height); return c;
  }
  function gaitChart(id, p, offset) {
    const c = canvas(id), l = 60, r = 589, top = 62, bottom = 279;
    for (let i = 0; i <= 4; i++) {
      const x = l + (r - l) * i / 4;
      stroke(c, [[x, top], [x, bottom]], '#dcebf2', 1);
      text(c, i * 25 + '%', x, 307, 14, '#7492a5', 'center');
    }
    for (const y of [91, 170, 249]) stroke(c, [[l, y], [r, y]], '#dcebf2', 1);
    text(c, '抽象相位', l, 30, 14); text(c, '周期', r, 332, 13, '#7492a5', 'right');
    const f = (x, right) => .72 * Math.sin(TAU * (x + (right ? .5 + offset : 0)));
    for (const [right, color] of [[false, '#126fb2'], [true, '#078c97']]) {
      const points = [];
      for (let i = 0; i <= 180; i++) points.push([l + (r - l) * i / 180, 170 - f(i / 180, right) * 100]);
      stroke(c, points, color, 3.5); dot(c, l + (r - l) * p, 170 - f(p, right) * 100, 7, color);
    }
    stroke(c, [[l + (r - l) * p, top - 10], [l + (r - l) * p, bottom]], '#758c9f', 1.6, [5, 5]);
    text(c, '相位 ' + Math.round(p * 100) + '%', l + 10, top - 22, 13, '#647e91');
  }
  function muscleDiagram(id, p, mode) {
    const c = canvas(id), baseLength = 270;
    const extent = mode === 'hold' ? 0 : mode === 'shorten' ? 65 * (1 - 2 * p) : 65 * (2 * p - 1);
    const length = baseLength + extent, x1 = 310 - length / 2, x2 = 310 + length / 2;
    const bulge = 48 + (baseLength - length) * .09;
    stroke(c, [[175, 85], [445, 85]], '#c0d8e4', 1.5, [5, 5]);
    stroke(c, [[175, 76], [175, 94]], '#b3cedc', 2); stroke(c, [[445, 76], [445, 94]], '#b3cedc', 2);
    text(c, '固定长度参考', 310, 57, 14, '#7692a4', 'center');
    for (const x of [x1, x2]) {stroke(c, [[x, 124], [x, 235]], '#7c9db0', 5); dot(c, x, 181, 6, '#366f91');}
    c.beginPath(); c.moveTo(x1, 181); c.bezierCurveTo(x1 + 40, 181 - bulge, x2 - 40, 181 - bulge, x2, 181);
    c.bezierCurveTo(x2 - 40, 181 + bulge, x1 + 40, 181 + bulge, x1, 181);
    c.fillStyle = '#aadce2'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#078c97'; c.stroke();
    for (let i = -2; i <= 2; i++) {
      c.beginPath(); c.moveTo(x1 + 17, 181 + i * 3); c.quadraticCurveTo(310, 181 + i * 15, x2 - 17, 181 + i * 3); c.strokeStyle = '#399fac'; c.lineWidth = 1.4; c.stroke();
    }
    arrow(c, x1 - 65, 181, x1 - 12, 181, '#126fb2'); arrow(c, x2 + 65, 181, x2 + 12, 181, '#126fb2');
    stroke(c, [[x1, 263], [x2, 263]], '#418bab', 2); stroke(c, [[x1, 255], [x1, 271]], '#418bab', 2); stroke(c, [[x2, 255], [x2, 271]], '#418bab', 2);
    text(c, modeNames[mode], 310, 300, 19, '#236c8e', 'center');
    text(c, '两端距离 · 无具体解剖单位', 310, 330, 13, '#7390a3', 'center');
  }
  function breathOutline(c, amount, emphasis, dashed) {
    const cx = 276, chest = amount * (emphasis === 'chest' ? 34 : 15), belly = amount * (emphasis === 'abdomen' ? 27 : 10);
    c.save(); c.setLineDash(dashed ? [7, 7] : []); c.lineWidth = dashed ? 2 : 3;
    c.strokeStyle = dashed ? '#afcbd8' : '#248aa4'; c.fillStyle = '#d9eef1b3';
    c.beginPath(); c.moveTo(cx - 70, 85);
    c.bezierCurveTo(cx - 128 - chest, 105, cx - 117 - chest, 201, cx - 94 - belly, 269);
    c.bezierCurveTo(cx - 87 - belly, 307, cx - 76, 341, cx - 67, 345);
    c.lineTo(cx + 67, 345);
    c.bezierCurveTo(cx + 76, 341, cx + 87 + belly, 307, cx + 94 + belly, 269);
    c.bezierCurveTo(cx + 117 + chest, 201, cx + 128 + chest, 105, cx + 70, 85);
    c.quadraticCurveTo(cx, 53, cx - 70, 85); if (!dashed) c.fill(); c.stroke(); c.restore();
    return {cx, chest, belly};
  }
  function breathDiagram(id, p, emphasis) {
    const c = canvas(id), inhale = .5 - .5 * Math.cos(TAU * p), diaphragm = inhale * (emphasis === 'abdomen' ? 32 : 16);
    breathOutline(c, 0, emphasis, true); const s = breathOutline(c, inhale, emphasis, false);
    c.save(); c.setLineDash([6, 6]); c.beginPath(); c.moveTo(184, 260); c.quadraticCurveTo(276, 215, 368, 260); c.lineWidth = 2; c.strokeStyle = '#c2aab4'; c.stroke(); c.restore();
    c.beginPath(); c.moveTo(184, 260 + diaphragm); c.quadraticCurveTo(276, 215 + diaphragm * 1.6, 368, 260 + diaphragm); c.lineWidth = 4; c.strokeStyle = '#bf7b79'; c.stroke();
    const direction = p <= .5 ? 1 : -1;
    if (direction === 1) {arrow(c, 143 - s.chest, 162, 116 - s.chest, 162); arrow(c, 409 + s.chest, 162, 437 + s.chest, 162); arrow(c, 276, 274 + diaphragm, 276, 305 + diaphragm, '#bf7b79');}
    else {arrow(c, 116 - s.chest, 162, 143 - s.chest, 162); arrow(c, 437 + s.chest, 162, 409 + s.chest, 162); arrow(c, 276, 305 + diaphragm, 276, 274 + diaphragm, '#bf7b79');}
    text(c, '胸廓', 480, 161, 15, '#168b9d'); stroke(c, [[450, 161], [463, 161]], '#82afbe', 1);
    text(c, '膈肌', 480, 271, 15, '#ad7776'); stroke(c, [[375, 265 + diaphragm], [464, 271]], '#c3a7a8', 1);
    text(c, '腹壁', 480, 329, 15); stroke(c, [[388 + s.belly, 312], [464, 329]], '#82afbe', 1);
    text(c, p < .005 || p > .995 ? '呼气末方向' : Math.abs(p - .5) < .005 ? '吸气末方向' : p < .5 ? '吸气方向' : '呼气方向', 276, 389, 18, '#306e88', 'center');
  }
  function treadDiagram(id, p, settings) {
    const c = canvas(id), left = [90, 242], right = [524, 242 - settings.slope * 13];
    stroke(c, [[90, 273], [530, 273]], '#c5dce7', 2, [5, 6]);
    stroke(c, [left, right], '#3d839e', 26); stroke(c, [left, right], '#bbdfe8', 17);
    for (let i = 0; i < 11; i++) {
      const t = ((i / 11 - p * settings.speed * 2 / 5) % 1 + 1) % 1;
      const x = left[0] + (right[0] - left[0]) * t, y = left[1] + (right[1] - left[1]) * t;
      dot(c, x, y, 4, '#126fb2');
    }
    stroke(c, [[left[0] + 25, left[1] + 15], [left[0] + 25, 273]], '#82acbe', 8);
    stroke(c, [[right[0] - 25, right[1] + 15], [right[0] - 25, 273]], '#82acbe', 8);
    arrow(c, 340, 128, 230, 128, '#078c97'); text(c, '标记移动方向', 285, 98, 15, '#237d90', 'center');
    text(c, '速度档位 ' + settings.speed, 112, 319, 17, '#286c8b'); text(c, '坡度档位 ' + settings.slope, 500, 319, 17, '#286c8b', 'right');
    text(c, '示意平台 · 无真实设备单位', 310, 41, 15, '#7492a5', 'center');
  }
  function currentTread() {return {speed: Number($('treadSpeed').value), slope: Number($('treadSlope').value)};}
  function draw(key) {
    const p = state[key].phase;
    if (key === 'gait') {gaitChart('gaitA', p, 0); gaitChart('gaitB', p, Number($('gaitOffset').value));}
    if (key === 'muscle') {muscleDiagram('muscleA', p, 'hold'); muscleDiagram('muscleB', p, $('muscleMode').value); $('muscleBTitle').textContent = 'B · ' + modeNames[$('muscleMode').value];}
    if (key === 'breath') {breathDiagram('breathA', p, 'chest'); breathDiagram('breathB', p, 'abdomen');}
    if (key === 'tread') {const settings = currentTread(); treadDiagram('treadA', p, reference); treadDiagram('treadB', p, settings); $('speedValue').textContent = settings.speed; $('slopeValue').textContent = settings.slope; $('treadATitle').textContent = 'A · 参考条件：速度 ' + reference.speed + ' / 坡度 ' + reference.slope; $('treadBTitle').textContent = 'B · 当前条件：速度 ' + settings.speed + ' / 坡度 ' + settings.slope;}
    const controls = document.querySelector('[data-controls="' + key + '"]');
    controls.querySelector('input').value = Math.round(p * 1000);
    controls.querySelector('output').textContent = Math.round(p * 100) + '%';
    const play = controls.querySelector('[data-play]'); play.textContent = state[key].playing ? 'Ⅱ 暂停' : '▶ 播放'; play.setAttribute('aria-pressed', String(state[key].playing));
  }
  function selectTopic() {
    const candidate = location.hash.slice(1); topic = Object.hasOwn(modules, candidate) ? candidate : 'gait';
    for (const key of Object.keys(modules)) {$(key).hidden = key !== topic; if (key !== topic) state[key].playing = false;}
    for (const link of document.querySelectorAll('[data-topic]')) {const active = link.dataset.topic === topic; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');}
    $('mainTitle').textContent = modules[topic].title; $('mainSubtitle').textContent = modules[topic].subtitle; $('noteTopic').textContent = modules[topic].short;
    draw(topic);
  }
  function readRecords() {
    if (useMemoryRecords) return memoryRecords;
    try {const parsed = JSON.parse(localStorage.getItem(recordKey) || '[]'); if (Array.isArray(parsed)) return parsed.filter((r) => r && typeof r === 'object' && Object.hasOwn(modules, r.module) && typeof r.timestamp === 'string' && typeof r.scope === 'string').slice(-500);}
    catch (_) { /* The in-memory copy still supports export when browser storage is unavailable. */ }
    return memoryRecords;
  }
  function recordTitle() {
    if (topic === 'gait') return modules[topic].short + ' / 相位偏移 ' + $('gaitOffset').value + ' / ' + $('gaitTempo').selectedOptions[0].textContent + '节律';
    if (topic === 'muscle') return modules[topic].short + ' / ' + modeNames[$('muscleMode').value];
    if (topic === 'tread') {const s = currentTread(); return modules[topic].short + ' / A 速度' + reference.speed + ' 坡度' + reference.slope + ' / B 速度' + s.speed + ' 坡度' + s.slope;}
    return '胸廓、膈肌与腹壁方向比较';
  }
  function saveRecord() {
    const records = readRecords(), entry = {timestamp: new Date().toISOString(), module: topic, title: recordTitle(), phase: Math.round(state[topic].phase * 100) + '%', text: $('userNote').value.trim(), scope: modules[topic].scope};
    records.push(entry); memoryRecords = records.slice(-500);
    let persisted = false;
    try {localStorage.setItem(recordKey, JSON.stringify(memoryRecords)); persisted = true; useMemoryRecords = false;} catch (_) {useMemoryRecords = true;}
    $('feedback').textContent = persisted ? '已保存到当前浏览器' : '当前浏览器限制本地保存；本次记录可用导出按钮保存';
    renderRecords();
  }
  function renderRecords() {
    const records = readRecords(); $('recordCount').textContent = records.length; $('recordEmpty').hidden = records.length > 0; $('recordList').replaceChildren();
    for (const record of records.slice(-6).reverse()) {
      const li = document.createElement('li'), title = document.createElement('strong'), body = document.createElement('p'), meta = document.createElement('small');
      title.textContent = String(record.title || '') + ' · ' + String(record.phase || ''); body.textContent = record.text ? String(record.text) : '已记录该时刻的观察条件。'; meta.textContent = new Date(record.timestamp).toLocaleString('zh-CN') + ' · ' + record.scope;
      li.append(title, body, meta); $('recordList').append(li);
    }
    $('exportJSON').disabled = !records.length; $('exportCSV').disabled = !records.length;
  }
  function exportRecords(format) {
    const records = readRecords().map((r) => ({timestamp:r.timestamp,module:r.module,title:String(r.title || ''),phase:String(r.phase || ''),text:String(r.text || ''),scope:r.scope}));
    if (!records.length) return;
    let data, mime;
    if (format === 'json') {data = JSON.stringify({format:'dxx-limited-observation-v1', note:'有限示意学习记录，非临床测量。', records}, null, 2); mime = 'application/json;charset=utf-8';}
    else {const fields = ['timestamp','module','title','phase','text','scope']; const escape = (value) => {let v = String(value ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replaceAll('"', '""') + '"';}; data = '\ufeff' + fields.map(escape).join(',') + '\r\n' + records.map((r) => fields.map((f) => escape(r[f])).join(',')).join('\r\n'); mime = 'text/csv;charset=utf-8';}
    const url = URL.createObjectURL(new Blob([data], {type:mime})), link = document.createElement('a'); link.href = url; link.download = 'dongxiaoxue-observations-' + new Date().toISOString().slice(0, 10) + '.' + format; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); $('feedback').textContent = '已导出当前身份的观察记录';
  }
  function initControls() {
    for (const key of Object.keys(modules)) {
      const el = document.querySelector('[data-controls="' + key + '"]');
      el.innerHTML = '<button type="button" class="primary" data-play aria-pressed="false">▶ 播放</button><button type="button" data-step="-1" aria-label="后退一个示意步长">− 步</button><button type="button" data-step="1" aria-label="前进一个示意步长">＋ 步</button><button type="button" data-reset>复位</button><label>播放速度<select aria-label="' + modules[key].short + '播放速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><input type="range" min="0" max="1000" value="0" aria-label="' + modules[key].short + '示意周期进度"><output aria-label="当前进度">0%</output>';
      el.querySelector('[data-play]').addEventListener('click', () => {state[key].playing = !state[key].playing; draw(key);});
      for (const b of el.querySelectorAll('[data-step]')) b.addEventListener('click', () => {state[key].playing = false; state[key].phase = Math.min(1, Math.max(0, state[key].phase + Number(b.dataset.step) * .02)); draw(key);});
      el.querySelector('[data-reset]').addEventListener('click', () => {state[key].playing = false; state[key].phase = 0; draw(key);});
      el.querySelector('input').addEventListener('input', (event) => {state[key].playing = false; state[key].phase = Number(event.target.value) / 1000; draw(key);});
      el.querySelector('select').addEventListener('change', (event) => {state[key].speed = Number(event.target.value);});
    }
  }
  function tick(ms) {
    const dt = previousFrame ? Math.min((ms - previousFrame) / 1000, .08) : 0; previousFrame = ms;
    if (!document.hidden && state[topic].playing) {const tempo = topic === 'gait' ? Number($('gaitTempo').value) : 1; state[topic].phase = (state[topic].phase + dt * state[topic].speed * tempo / modules[topic].seconds) % 1; draw(topic);}
    requestAnimationFrame(tick);
  }
  initControls();
  $('studentBadge').textContent = profile ? '学生学习 · 本地记录' : '演示访客 · 独立记录';
  for (const id of ['gaitOffset','gaitTempo','muscleMode','treadSpeed','treadSlope']) $(id).addEventListener('input', () => draw(topic));
  $('pinTread').addEventListener('click', () => {reference = currentTread(); draw('tread');});
  for (const b of document.querySelectorAll('[data-save]')) b.addEventListener('click', saveRecord);
  $('saveNote').addEventListener('click', saveRecord); $('exportJSON').addEventListener('click', () => exportRecords('json')); $('exportCSV').addEventListener('click', () => exportRecords('csv'));
  window.addEventListener('hashchange', selectTopic); window.addEventListener('storage', (event) => {if (event.key === recordKey) renderRecords();});
  document.addEventListener('visibilitychange', () => {previousFrame = 0;});
  selectTopic(); renderRecords(); requestAnimationFrame(tick);
})();
