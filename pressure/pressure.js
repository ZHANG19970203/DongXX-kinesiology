/* Original public-case teaching viewer. Source samples stay unchanged. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = (x, digits = 2) => Number.isFinite(x) ? x.toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeURL = value => { try { const u = new URL(String(value)); return u.protocol === 'https:' ? u.href : '#'; } catch { return '#'; } };
  const sideName = x => x === 'L' ? '左脚 L' : '右脚 R';
  const profile = window.DXXHub?.profile() || null;
  const storageKey = window.DXXHub?.pressureKey?.() || (profile ? 'dxx_pressure_case_v1_student_' + encodeURIComponent(profile.teacher + '|' + profile.studentId) : 'dxx_pressure_case_v1_guest');
  const state = { data: null, side: 'L', frame: 0, threshold: 0, thresholds: {}, a: null, b: null, playing: false, raf:0, lastTick: 0, carry: 0, records: [], storage: true, quizChecked: false, revealCop:true, selectedSensor:-1 };
  if (profile) $('studentBadge').textContent = profile.name + ' · ' + profile.studentId;
  try {
    const probe = storageKey + '_probe'; localStorage.setItem(probe, '1'); localStorage.removeItem(probe);
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(existing)) throw Error('记录格式无法读取');
    state.records = existing;
  } catch {
    state.storage = false;
    $('saveStatus').textContent = '当前浏览器无法读取或保存本机记录。可在此页临时记录并立即导出，关闭或刷新页面可能丢失内容。';
  }
  $('recordCount').textContent = state.records.length + '条记录';
  const sideData = () => state.data.sides[state.side];
  const current = () => sideData().frames[state.frame];
  const valid = (f, threshold = state.threshold) => Number.isFinite(f.sum) && f.sum > 0 && f.sum >= threshold && Array.isArray(f.cop) && f.cop.every(Number.isFinite);
  const defaultThreshold = side => Math.round(Math.max(...state.data.sides[side].frames.map(f => f.sum)) * 0.15 * 100) / 100;

  function checkData(data) {
    if (data.schemaVersion !== 'dxx-pressure-case-v1' || !data.dataset || data.dataset.nominalHz !== 64) throw Error('案例格式或标称采样信息不匹配。');
    for (const side of ['L', 'R']) {
      const d = data.sides?.[side];
      if (!d || d.points.length !== 32 || !d.frames.length || d.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw Error('测点坐标或记录缺失。');
      for (const [i, f] of d.frames.entries()) {
        if (f.index !== i || f.values.length !== 32 || f.values.some(x => !Number.isFinite(x) || x < 0) || !Number.isFinite(f.sum) || !Array.isArray(f.cop) || f.cop.length !== 2 || !f.cop.every(Number.isFinite)) throw Error('记录数值校验失败。');
        const sum = f.values.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - f.sum) > 1e-6) throw Error('原通道总和不匹配。');
        if (sum > 0) {
          const cop = ['x', 'y'].map(axis => d.points.reduce((s, p, k) => s + p[axis] * f.values[k], 0) / sum);
          if (Math.abs(cop[0] - f.cop[0]) > 0.02 || Math.abs(cop[1] - f.cop[1]) > 0.02) throw Error('通道加权中心与来源COP不一致。');
        }
      }
      d.displayMax = Math.max(...d.frames.flatMap(f => f.values));
    }
  }

  function color(value, max) {
    const stops = [[220, 236, 245], [57, 151, 204], [19, 185, 163], [232, 206, 81], [238, 99, 62]];
    const position = Math.max(0, Math.min(1, value / (max || 1))) * (stops.length - 1);
    const lower = Math.min(stops.length - 2, Math.floor(position)), ratio = position - lower;
    return 'rgb(' + stops[lower].map((v, i) => Math.round(v + (stops[lower + 1][i] - v) * ratio)).join(',') + ')';
  }

  function plot(ctx, d, frame, threshold, box, options = {}) {
    const xs = d.points.map(p => p.x), ys = d.points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min((box.w - 80) / (maxX - minX + 65), (box.h - 90) / (maxY - minY + 75));
    const midX = (minX + maxX) / 2;
    const map = (x, y) => [box.x + box.w / 2 + (x - midX) * scale, box.y + 45 + (y - minY + 23) * scale];
    const left = map(minX - 30, minY)[0], right = map(maxX + 30, minY)[0], top = map(midX, minY - 23)[1], bottom = map(midX, maxY + 25)[1];
    const cx = (left + right) / 2, w = right - left, h = bottom - top;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx - w * 0.13, top);
    ctx.bezierCurveTo(left - w * 0.03, top - h * 0.02, left - w * 0.08, top + h * 0.2, left + w * 0.06, top + h * 0.38);
    ctx.bezierCurveTo(left + w * 0.21, top + h * 0.61, left + w * 0.15, top + h * 0.69, left + w * 0.21, bottom - h * 0.08);
    ctx.bezierCurveTo(left + w * 0.25, bottom + h * 0.06, right - w * 0.2, bottom + h * 0.06, right - w * 0.18, bottom - h * 0.08);
    ctx.bezierCurveTo(right - w * 0.1, top + h * 0.72, right - w * 0.18, top + h * 0.53, right - w * 0.08, top + h * 0.3);
    ctx.bezierCurveTo(right + w * 0.01, top + h * 0.05, right - w * 0.16, top - h * 0.03, cx - w * 0.13, top);
    ctx.closePath(); ctx.fillStyle = '#f5f9fb'; ctx.fill(); ctx.strokeStyle = '#c9dce6'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#6c8998'; ctx.textAlign = 'center'; ctx.font = (options.small ? '15' : '18') + 'px system-ui';
    ctx.fillText('趾端 ↑', cx, box.y + 25); ctx.fillText('跟端', cx, box.y + box.h - 7);
    const radius = options.small ? 7.8 : 12;
    d.points.forEach((p, i) => {
      const [x, y] = map(p.x, p.y); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color(frame.values[i], d.displayMax); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'white'; ctx.stroke();
      if (options.labels) { ctx.font = '11px system-ui'; ctx.fillStyle = frame.values[i] > d.displayMax * 0.7 ? '#572d13' : '#163e57'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i), x, y); }
    });
    ctx.textBaseline = 'alphabetic';
    if (options.trace && state.revealCop) {
      ctx.strokeStyle = '#344d76'; ctx.lineWidth = 2.8; let active = false; ctx.beginPath();
      for (let i = 0; i <= frame.index; i++) {
        const f = d.frames[i];
        if (!valid(f, threshold)) { active = false; continue; }
        const [x, y] = map(...f.cop); if (active) ctx.lineTo(x, y); else ctx.moveTo(x, y); active = true;
      }
      ctx.stroke();
    }
    if (valid(frame, threshold) && state.revealCop) {
      const [x, y] = map(...frame.cop); ctx.beginPath(); ctx.arc(x, y, options.small ? 6 : 9, 0, Math.PI * 2); ctx.fillStyle = '#183454'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'white'; ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#183454'; ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.lineTo(x + 15, y); ctx.moveTo(x, y - 15); ctx.lineTo(x, y + 15); ctx.stroke();
    }
    ctx.restore();
  }

  function renderCanvas() {
    const c = $('pressureCanvas'), ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    plot(ctx, sideData(), current(), state.threshold, { x: 30, y: 35, w: 640, h: 710 }, { labels: $('showLabels').checked, trace: $('showTrace').checked });
    c.setAttribute('aria-label', sideName(state.side) + '，第' + state.frame + '帧，通道总和' + current().sum + '，' + (!state.revealCop?'COP暂隐藏，请先预测':valid(current()) ? 'COP原坐标' + current().cop.map(x => fmt(x)).join('，') : 'COP未纳入当前筛选') + '。原始通道数值见下方表格。');
  }

  function frameSummary(name, index) {
    if (index === null) return name + '：尚未选择';
    const f = sideData().frames[index];
    return name + '：帧' + index + '；总和' + fmt(f.sum) + '；COP ' + (!state.revealCop?'预测后揭示':valid(f) ? '(' + f.cop.map(x => fmt(x)).join(', ') + ')' : '未纳入筛选');
  }

  function renderComparison() {
    const box = $('compareSummary'); box.replaceChildren();
    for (const [name, i] of [['A', state.a], ['B', state.b]]) { const p = document.createElement('p'); p.textContent = frameSummary(name, i); box.append(p); }
    if (state.a !== null && state.b !== null) {
      const a = sideData().frames[state.a], b = sideData().frames[state.b], p = document.createElement('p');
      p.textContent = 'B − A：总和 ' + fmt(b.sum - a.sum) + (!state.revealCop?'；COP预测后揭示。':valid(a) && valid(b) ? '；Δx ' + fmt(b.cop[0] - a.cop[0]) + '，Δy ' + fmt(b.cop[1] - a.cop[1]) + '（原坐标）' : '；至少一帧未纳入COP比较。'); box.append(p);
    }
    const c = $('compareCanvas'), ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    for (const [label, index, x] of [['A', state.a, 0], ['B', state.b, 340]]) {
      ctx.font = 'bold 17px system-ui'; ctx.fillStyle = '#264c62'; ctx.textAlign = 'center'; ctx.fillText(label + (index === null ? ' · 未选择' : ' · 帧' + index), x + 170, 23);
      if (index !== null) plot(ctx, sideData(), sideData().frames[index], state.threshold, { x, y: 31, w: 340, h: 385 }, { small: true });
    }
  }

  function update() {
    if (!state.data) return;
    const f = current(), included = valid(f);
    $('viewTitle').textContent = sideName(state.side) + ' · 分布与轨迹';
    $('frameRange').value = String(state.frame); $('frameReadout').textContent = state.frame + ' / ' + (sideData().frames.length - 1) + '（从0起）';
    $('sumReadout').textContent = fmt(f.sum); $('copReadout').textContent = !state.revealCop?'先预测，再揭示':included ? f.cop.map(x => fmt(x)).join(', ') : '未纳入筛选';
    $('timeReadout').textContent = fmt(state.frame / state.data.dataset.nominalHz, 3) + ' s';
    $('copBadge').textContent = !state.revealCop?'预测阶段':included ? '纳入当前筛选' : '未纳入当前筛选'; $('copBadge').classList.toggle('filtered', !included);
    $('copExplanation').textContent = !state.revealCop?'先根据32点分布作预测，再用压力中心坐标检验。':included ? '此点表示32个通道值对应的加权中心，可与高值测点的位置进行比较。' : '源文件仍有COP数值；当前总和未通过教学筛选，因此图中隐藏该点。';
    $('scaleMax').textContent = fmt(sideData().displayMax, 0);
    $('prevFrame').disabled = state.frame === 0; $('nextFrame').disabled = state.frame === sideData().frames.length - 1;
    $('thresholdStatus').textContent = '当前阈值 ' + fmt(state.threshold) + '；本侧共 ' + sideData().frames.filter(f => valid(f)).length + ' / ' + sideData().frames.length + ' 帧纳入。';
    const tbody = $('channelTable'); tbody.replaceChildren();
    sideData().points.forEach((p, i) => { const row = document.createElement('tr'); const first=document.createElement('td'),button=document.createElement('button');button.type='button';button.dataset.sensor=String(i);button.textContent='测点 '+i;button.setAttribute('aria-label','选中测点 '+i);first.append(button);row.append(first);for (const val of [fmt(p.x, 4), fmt(p.y, 4), fmt(f.values[i], 4)]) { const cell = document.createElement('td'); cell.textContent = val; row.append(cell); } tbody.append(row); });
    const weighted = ['x', 'y'].map(axis => sideData().points.reduce((s, p, i) => s + p[axis] * f.values[i], 0) / f.sum);
    $('copCheck').textContent = !state.revealCop?'先观察分布并提交预测，再揭示来源COP。':'当前来源COP：(' + f.cop.map(x => fmt(x, 4)).join(', ') + ')；通道加权复核：(' + weighted.map(x => fmt(x, 4)).join(', ') + ')。该复核不构成压力或长度单位标定。';
    renderCanvas(); renderComparison();
    window.dispatchEvent(new CustomEvent('dxx:pressure-frame',{detail:sceneState()}));
  }

  function pause() { state.playing = false;cancelAnimationFrame(state.raf);state.raf=0; $('playPause').textContent = '播放'; $('playPause').setAttribute('aria-pressed', 'false'); }
  function seek(frame) { if(!state.data||!Number.isFinite(Number(frame)))return;pause(); state.frame = Math.max(0, Math.min(sideData().frames.length - 1, Math.round(Number(frame)))); update(); }
  function tick(t) {
    if (!state.playing) return;
    state.carry += Math.max(0, Math.min(250, t - state.lastTick)) * state.data.dataset.nominalHz * Number($('playbackRate').value) / 1000;
    state.lastTick = t;
    const step = Math.floor(state.carry);
    if (step > 0) { state.carry -= step; state.frame = Math.min(sideData().frames.length - 1, state.frame + step); update(); }
    if (state.frame >= sideData().frames.length - 1) { pause(); return; }
    state.raf=requestAnimationFrame(tick);
  }

  function quiz() {
    const answers = Object.fromEntries(['q1', 'q2', 'q3'].map(id => [id, $(id).value]));
    const answeredCount=Object.values(answers).filter(Boolean).length;
    return { answers, answeredCount,correctCount:answeredCount?Object.values(answers).filter(x => x === 'no').length:null, total: 3, explanationAutoGraded: false };
  }

  function snapshot(index) {
    if (index === null) return null;
    const f = sideData().frames[index];
    return { side: state.side, frameIndex: index, nominalTimeSeconds: index / state.data.dataset.nominalHz, threshold: state.threshold, sum: f.sum, cop: valid(f) ? [...f.cop] : null, sourceCop: [...f.cop], validCop: valid(f), values: [...f.values] };
  }

  function save(extra={}) {
    pause();
    const f = current(), snap = snapshot(state.frame);
    const record = { id: 'pressure-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), createdAt: new Date().toISOString(), profile, scope: 'public-research-teaching-case', dataset: state.data.dataset, sources: state.data.sources, ...snap, thresholdRule: 'sum >= threshold && sum > 0', comparison: { A: snapshot(state.a), B: snapshot(state.b) }, observation: typeof extra.observation==='string'?extra.observation.slice(0,5000):$('observation').value.trim(), explanation:typeof extra.explanation==='string'?extra.explanation.slice(0,5000): $('explanation').value.trim(), quiz: quiz(),experience:extra.experience?JSON.parse(JSON.stringify(extra.experience)):null };
    state.records.push(record);
    let saved = false;
    if (state.storage) { try { localStorage.setItem(storageKey, JSON.stringify(state.records)); saved = true; } catch { state.storage = false; } }
    $('recordCount').textContent = state.records.length + '条记录';
    $('saveStatus').textContent = saved ? '已保存：' + sideName(state.side) + '，帧' + f.index + '，阈值' + fmt(state.threshold) + '。' + (profile ? '可到首页本机记录查看，或在此导出。' : '这是访客独立记录，课堂登记后不会自动归入个人学号；请在此导出。') : '本机保存不可用，当前记录仅暂存在此页。请立即导出；刷新或关闭会丢失未持久保存的记录。';
    return {record:JSON.parse(JSON.stringify(record)),persisted:saved};
  }

  function download(content, type, extension) {
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([content], { type }));
    a.href = url; a.download = '足底压力学习记录_' + new Date().toISOString().slice(0, 10) + '.' + extension; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function canExport() { if (state.records.length) return true; $('saveStatus').textContent = '尚无已保存记录。请先保存当前观察，再导出。'; return false; }
  function exportJSON() { if (canExport()) download(JSON.stringify({ format: 'dxx-pressure-learning-records-v1', exportedAt: new Date().toISOString(), scope: '公开研究案例教学记录；不生成临床成绩或诊断。', records: state.records }, null, 2), 'application/json;charset=utf-8', 'json'); }
  const copText = s => s ? (s.validCop && s.cop ? s.cop.map(x => fmt(x, 4)).join(', ') : '未纳入筛选') : '未选择';
  function reportSnap(s, name) { return s ? '<tr><th>' + esc(name) + '</th><td>' + esc(sideName(s.side)) + '</td><td>' + esc(s.frameIndex) + '</td><td>' + esc(fmt(s.sum)) + '</td><td>' + esc(copText(s)) + '</td><td>' + esc(fmt(s.threshold)) + '</td></tr>' : ''; }
  function exportHTML() {
    if (!canExport()) return;
    const body = state.records.map((r, i) => {
      const source = r.dataset || {}, license = typeof source.license === 'object' ? source.license.id : source.license;
      const a = r.comparison?.A, b = r.comparison?.B;
      const answered=Object.values(r.quiz?.answers||{}).filter(Boolean).length;
      const quizSummary=answered===0?'附加原理核对未作答，不记为零分。':'附加原理核对已作答 '+answered+' / 3；已答题中正确 '+(r.quiz?.correctCount??0)+' 题。';
      const valuesTable = '<table><caption>原始通道值（不修改原值）</caption><thead><tr><th>通道</th><th>保存帧</th><th>A</th><th>B</th></tr></thead><tbody>' + (r.values || []).map((v, n) => '<tr><th>' + n + '</th><td>' + esc(fmt(v, 4)) + '</td><td>' + esc(a ? fmt(a.values[n], 4) : '未选择') + '</td><td>' + esc(b ? fmt(b.values[n], 4) : '未选择') + '</td></tr>').join('') + '</tbody></table>';
      const evidence = '<details><summary>来源文件与SHA-256</summary>' + (r.sources || []).map(s => '<p>' + esc(s.path) + '：' + esc(s.sha256) + '</p>').join('') + '</details>'+(r.experience?'<h3>交互探究任务</h3><p>保留预测、实际选点和两帧证据；开放解释由教师审阅。</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(JSON.stringify(r.experience,null,2))+'</pre>':'');
      return '<article><h2>记录 ' + (i + 1) + ' · ' + esc(sideName(r.side)) + ' / 帧' + esc(r.frameIndex) + '</h2><p>保存时间：' + esc(r.createdAt) + '；学生：' + esc(r.profile ? r.profile.name + ' / ' + r.profile.studentId : '演示访客') + '</p><p>来源：' + esc(source.title) + '；<a href="' + esc(safeURL(source.url)) + '">DOI ' + esc(source.doi) + '</a>；许可 <a href="' + esc(safeURL(source.license?.url || 'https://creativecommons.org/licenses/by/4.0/')) + '">' + esc(license) + '</a>。</p><p>作者：' + esc((source.creators || []).join('; ')) + '。案例：' + esc(source.caseId) + '。数据抽取与说明变化：' + esc((source.changes || []).join(' ')) + '</p><p><b>使用范围：</b>公开研究案例教学，非本校设备采集，非个体压力预测，不用于临床诊断。原始通道值单位未确认，非kPa；坐标长度单位未确认，非cm；通道总和非N。</p><p>名义时间：帧索引 / ' + esc(source.nominalHz) + ' Hz；本帧 ' + esc(fmt(r.nominalTimeSeconds, 3)) + ' s。CSV无逐帧时间戳，不主张左右脚绝对同步。阈值规则：总和 ≥ ' + esc(fmt(r.threshold)) + ' 且总和 > 0；这是教学筛选，不是真实离地或接触判定。筛选不修改原始数值。</p><table><thead><tr><th>选帧</th><th>侧别</th><th>帧索引</th><th>原通道总和</th><th>COP原坐标</th><th>分析阈值</th></tr></thead><tbody>' + reportSnap(r, '保存帧') + reportSnap(a, 'A') + reportSnap(b, 'B') + '</tbody></table><p>源COP（即使未纳入筛选也保留）：' + esc((r.sourceCop || []).map(x => fmt(x, 4)).join(', ')) + '</p><h3>观察</h3><p class="text">' + esc(r.observation || '未填写') + '</p><h3>解释</h3><p class="text">' + esc(r.explanation || '未填写') + '</p><p>' + esc(quizSummary) + ' 答案 ' + esc(JSON.stringify(r.quiz?.answers || {})) + '。开放解释未自动评分；规则题分数不代表临床能力。</p>' + valuesTable + evidence + '</article>';
    }).join('');
    download('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>足底压力学习记录</title><style>body{font:15px/1.8 system-ui;color:#20445d;max-width:980px;margin:35px auto;padding:0 20px}h1,h2{color:#126b92}article{border-top:2px solid #cbdfe8;padding:15px 0 30px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #cbdfe8;padding:8px;text-align:left}.text{white-space:pre-wrap;overflow-wrap:anywhere}p{overflow-wrap:anywhere}@media print{article{break-inside:avoid}details{display:block}}</style></head><body><h1>足底压力与COP轨迹 · 学习报告</h1><p>已保存 ' + state.records.length + ' 条研究案例学习记录。此报告用于教学观察与解释，不是临床评估报告。</p>' + body + '</body></html>', 'text/html;charset=utf-8', 'html');
    $('saveStatus').textContent = '已导出本模块学习报告。报告仅含已保存记录，当前未保存的文字不会自动加入。';
  }

  function sourceInfo() {
    const d = state.data.dataset, root = $('sourceInfo');
    const p = text => { const n = document.createElement('p'); n.textContent = text; root.append(n); };
    p(d.title); p('作者：' + (d.creators || []).join('; ') + '。案例 P1 / NP / 1，来源实验条件为自选通常步速；该条件名称不是临床正常值。');
    const link = document.createElement('a'); link.href = safeURL(d.url); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '数据记录与许可 · DOI ' + d.doi; root.append(link);
    p('数据许可：' + (typeof d.license === 'object' ? d.license.id : d.license) + '（署名4.0）。本模块保留所选32个原始通道值、来源COP与原总和；抽取左右脚各249帧，补充帧索引、测点坐标核对与教学筛选。');
    const licenseLink = document.createElement('a'); licenseLink.href = safeURL(d.license?.url || 'https://creativecommons.org/licenses/by/4.0/'); licenseLink.target = '_blank'; licenseLink.rel = 'noopener noreferrer'; licenseLink.textContent = 'CC BY 4.0 许可条款'; root.append(licenseLink);
    p('压力物理单位、传感器有效面积及坐标物理长度尺度未核定。这里不转换为kPa、牛顿或厘米，不做基线扣除或幅值归一化。颜色依原值呈现。');
    p('案例来自另一项仪器鞋垫研究，不是 LTM-ZDYL-200 输出。本地副本及来源哈希见教师审查记录和数据清单。');
  }

  $('playPause').addEventListener('click', () => {
    if (state.playing) { pause(); return; }
    if (state.frame === sideData().frames.length - 1) { state.frame = 0; update(); }
    state.playing = true; state.lastTick = performance.now(); state.carry = 0;
    $('playPause').textContent = '暂停'; $('playPause').setAttribute('aria-pressed', 'true'); state.raf=requestAnimationFrame(tick);
  });
  $('prevFrame').addEventListener('click', () => seek(state.frame - 1)); $('nextFrame').addEventListener('click', () => seek(state.frame + 1));
  $('frameRange').addEventListener('input', () => seek(Number($('frameRange').value)));
  function setSide(side) {
    if(!state.data||!['L','R'].includes(side))return;
    pause(); state.thresholds[state.side] = state.threshold; state.side = side; state.frame = 0; state.a = state.b = null;state.selectedSensor=-1;$('sideSelect').value=side;
    state.threshold = state.thresholds[state.side] ?? defaultThreshold(state.side); $('thresholdInput').value = String(state.threshold); $('frameRange').max = String(sideData().frames.length - 1); update();
  }
  $('sideSelect').addEventListener('change',()=>setSide($('sideSelect').value));
  $('thresholdInput').addEventListener('input', () => {
    const raw = $('thresholdInput').value, n = Number(raw);
    if (!raw.trim() || !Number.isFinite(n) || n < 0) { $('thresholdStatus').textContent = '请输入不小于0的有限数值；当前仍使用上次有效阈值。'; return; }
    state.threshold = n; state.thresholds[state.side] = n; update();
  });
  $('thresholdInput').addEventListener('change', () => {
    const n = Number($('thresholdInput').value);
    if ($('thresholdInput').value.trim() === '' || !Number.isFinite(n) || n < 0) { $('thresholdInput').value = String(state.threshold); $('thresholdStatus').textContent = '请输入不小于0的有限数值。'; return; }
    state.threshold = n; state.thresholds[state.side] = n; update();
  });
  $('resetThreshold').addEventListener('click', () => { state.threshold = defaultThreshold(state.side); $('thresholdInput').value = String(state.threshold); update(); });
  $('showTrace').addEventListener('change', update); $('showLabels').addEventListener('change', update);
  for (const [id, key] of [['pinA', 'a'], ['pinB', 'b']]) $(id).addEventListener('click', () => { pause(); state[key] = state.frame; renderComparison(); });
  $('checkQuiz').addEventListener('click', () => { const q = quiz(); state.quizChecked = true; $('quizFeedback').textContent = Object.values(q.answers).some(x => !x) ? '请先完成3道题。' : '规则题 ' + q.correctCount + ' / 3。COP是加权中心；单位需有标定依据；分析阈值不是离地标准。开放解释仍由教师审阅。'; });
  $('saveRecord').addEventListener('click', ()=>save()); $('exportJson').addEventListener('click', exportJSON); $('exportHtml').addEventListener('click', exportHTML);
  function sceneState(){if(!state.data)return null;return {points:sideData().points,frame:current(),frames:sideData().frames,threshold:state.threshold,maxValue:sideData().displayMax,side:state.side,trace:$('showTrace').checked,labels:$('showLabels').checked,revealCop:state.revealCop,selected:state.selectedSensor,nominalHz:state.data.dataset.nominalHz,validCop:valid(current()),playing:state.playing};}
  function selectSensor(index){if(!state.data||!Number.isInteger(index)||index<0||index>=32)return;pause();state.selectedSensor=index;window.dispatchEvent(new CustomEvent('dxx:pressure-sensor',{detail:{...snapshot(state.frame),channel:index,value:current().values[index],point:{...sideData().points[index]}}}));update();}
  $('channelTable').addEventListener('click',event=>{const b=event.target.closest('[data-sensor]');if(b)selectSensor(Number(b.dataset.sensor));});
  window.DXXPressure={scene:sceneState,seek,setSide,pause,selectSensor,snapshot:()=>snapshot(state.frame),pin:(slot,index)=>{if(!state.data||!['A','B'].includes(slot)||!Number.isInteger(index)||index<0||index>=sideData().frames.length)return;state[slot==='A'?'a':'b']=index;renderComparison();},setThreshold:value=>{if(!state.data||!Number.isFinite(value)||value<0)return;state.threshold=value;state.thresholds[state.side]=value;$('thresholdInput').value=String(value);update();},resetThreshold:()=>{state.threshold=defaultThreshold(state.side);$('thresholdInput').value=String(state.threshold);update();},revealCop:value=>{state.revealCop=!!value;update();},save,source:()=>state.data?.dataset||null};
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }); window.addEventListener('pagehide', pause);
  fetch('data/case-p1-np-1.json').then(r => { if (!r.ok) throw Error('本地数据文件未能读取（HTTP ' + r.status + '）。'); return r.json(); }).then(data => {
    checkData(data); state.data = data;state.frame=25; state.threshold = defaultThreshold(state.side); $('thresholdInput').value = String(state.threshold); $('frameRange').max = String(sideData().frames.length - 1);
    $('workspace').hidden = false; $('loadStatus').textContent = '案例 P1 / NP / 1 · 每侧249帧 · 已核对32通道总和与来源COP。' + (profile ? '' : ' 当前为访客，保存到独立本机记录。');
    sourceInfo(); update();
  }).catch(error => {
    $('loadStatus').classList.add('error'); $('loadStatus').textContent = '案例尚未载入：' + error.message + ' 请通过随包本地预览服务打开本页，避免直接以文件方式运行。';
  });
})();
