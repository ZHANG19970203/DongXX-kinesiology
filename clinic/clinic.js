(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const SESSION_KEY = 'dxx_encounter_session_v1', PENDING_KEY = 'dxx_encounter_pending_v1', COMPLETED_KEY = 'dxx_encounter_completed_v1', DRAFTS_KEY = 'dxx_encounter_drafts_v1';
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const student = demo ? null : (window.DXXHub?.profile?.() || null);
  const allowed = demo || !!student;
  const categories = { symptoms: '症状体验', history: '既往经过', function: '活动与功能', goals: '目标与顾虑', safety: '安全筛查' };
  const stages = [['interview', '了解患者'], ['exams', '检查配合'], ['evidence', '标记证据'], ['reasoning', '解释计划'], ['summary', '接诊总结']];
  let data = null, selected = null, current = null, session = null, savedSession = null;
  let stage = 'interview', category = 'symptoms', selectedExam = null, explained = new Set();
  let state = emptyState(), flushing = false, storageWorks = true, voiceOn = false, speakingTimer = null, toastTimer = null;
  const externalEmit = window.DXXEncounter?.emit;
  const storedPending = read(PENDING_KEY, []), memoryPending = Array.isArray(storedPending) ? storedPending.filter(x => x?.session && Array.isArray(x.events)) : [];
  const uid = prefix => prefix + '.' + Date.now().toString(36) + '.' + Math.random().toString(36).slice(2, 10);
  function emptyState() { return { interviewed: [], exams: [], evidence: [], explanations: [], plan: [], reflection: '', messages: [], stage: 'interview', category: 'symptoms', explained: [] }; }
  function publicCopy(value) {
    const copy = JSON.parse(JSON.stringify(value));
    function freeze(item) { if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); } return item; }
    return freeze(copy);
  }
  function getPublicState() {
    return publicCopy({ selectedCase: selected?.id || null, currentCase: current || selected, active: !!session && !!current, stage, selectedExam, summarySaved: !!session?.summary, interviewed: state.interviewed, exams: state.exams, evidence: state.evidence, explanations: state.explanations, plan: state.plan, latestMessage: state.messages[state.messages.length - 1] || null });
  }
  function sceneEvent(type, extra = {}) {
    window.dispatchEvent(new CustomEvent('dxx:clinic-scene', { detail: publicCopy({ type, caseId: current?.id || selected?.id || null, stage, active: !!session && !!current, ...extra }) }));
  }
  window.DXXClinicScene = Object.freeze({
    start: () => start(false), resume: () => start(true), newCase: () => { if (data) newCase(); },
    selectCase: id => { const c = data?.cases.find(item => item.id === id); if (c) selectCase(c); },
    stage: id => { if (session && stages.some(item => item[0] === id)) showStage(id); },
    ask: id => { const q = session && current?.questions.find(item => item.id === id); if (q) askQuestion(q); },
    exam: id => selectExam(id), getPublicState
  });
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { storageWorks = false; return false; } }
  function sameStudent(a, b) { return a === null && b === null || !!a && !!b && a.studentId === b.studentId && a.teacher === b.teacher; }
  function patientName(c = current) { return c.patient.name.replace(/\s*[（(]原创虚构[）)]/g, ''); }
  function sessionHeader(s = session) { return { id: s.id, caseId: s.caseId, startedAt: s.startedAt, student: s.student || null }; }
  function persist() {
    if (!session) return;
    state.stage = stage; state.category = category; state.explained = [...explained]; session.state = state;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { storageWorks = false; }
    const stored = read(DRAFTS_KEY, []), drafts = Array.isArray(stored) ? stored : [];
    const index = drafts.findIndex(s => s.id === session.id), snapshot = { ...session, updatedAt: new Date().toISOString() };
    if (index >= 0) drafts[index] = snapshot; else drafts.push(snapshot);
    write(DRAFTS_KEY, drafts);
    updateSync();
  }
  function emit(type, payload = {}) {
    if (!session) return null;
    const event = { id: uid('evt'), sessionId: session.id, type, at: new Date().toISOString(), payload };
    session.events.push(event);
    memoryPending.push({ session: sessionHeader(), events: [event] });
    write(PENDING_KEY, memoryPending); persist();
    if (typeof externalEmit === 'function') { try { externalEmit(type, payload); } catch {} }
    flush(); return event;
  }
  window.DXXEncounter = { ...(window.DXXEncounter || {}), emit, retry: flush, export: exportRecord, getSession: () => session ? JSON.parse(JSON.stringify(session)) : null };
  async function flush() {
    if (flushing || !memoryPending.length) { updateSync(); return; }
    flushing = true; updateSync('uploading');
    try {
      while (true) {
        const item = memoryPending.find(x => sameStudent(x.session?.student || null, student));
        if (!item) break;
        const response = await fetch('/api/learning/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item), signal: AbortSignal.timeout(9000) });
        if (!response.ok) throw new Error('服务器暂未接收');
        const receipt = await response.json();
        if (receipt.sessionId !== item.session.id || receipt.accepted + receipt.duplicates !== item.events.length) throw new Error('未收到完整同步确认');
        const index = memoryPending.indexOf(item); if (index >= 0) memoryPending.splice(index, 1);
        write(PENDING_KEY, memoryPending);
      }
      flushing = false; updateSync();
    } catch { flushing = false; updateSync('offline'); }
  }
  function updateSync(mode) {
    const count = memoryPending.filter(x => sameStudent(x.session?.student || null, student)).reduce((n, x) => n + (x.events?.length || 0), 0);
    const status = $('syncStatus'), dot = $('syncDot'); if (!status) return;
    dot.className = 'sync-dot';
    if (!storageWorks) { status.textContent = '存储受限，请导出 JSON · ' + (mode === 'uploading' || flushing ? '正在同步课堂记录…' : count ? count + ' 条待上传' : session?.events.length ? '课堂记录已同步' : '尚无上传记录'); dot.classList.add('error'); }
    else if (mode === 'uploading' || flushing) { status.textContent = '本机已保存 · 正在同步课堂记录…'; dot.classList.add('pending'); }
    else if (count) { status.textContent = '本机已保存 · ' + count + ' 条记录待上传'; dot.classList.add('pending'); }
    else if (session?.events.length) status.textContent = '本机已保存 · 课堂记录已同步';
    else status.textContent = '记录在本机保存 · 有服务连接时同步';
    $('retryUpload').hidden = !count || flushing;
  }
  function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 3500); }
  function el(tag, cls, text) { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; }
  function button(text, cls, action) { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', action); return b; }
  function mark(list, id, checked = true) { if (checked && !state[list].includes(id)) state[list].push(id); else if (!checked) state[list] = state[list].filter(x => x !== id); }
  function dirty() { if (session?.summary) { $('completionBox').hidden = true; $('completeButton').textContent = '更新接诊记录 ✓'; } }
  function footIcon(index) {
    const wrap = el('span', 'case-icon');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', '25'); svg.setAttribute('height', '25'); svg.setAttribute('viewBox', '0 0 30 30'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', ['M15 4c-3 1-5 7-5 12s-4 6-4 9c0 2 4 3 8 2s3-5 6-7c3-3 5-11 2-14-1-2-4-3-7-2Zm-4 15 8-1M11 12l10 2', 'M15 4c-4 1-4 6-4 10 0 6-6 7-5 10 1 4 9 4 12 0 3-3 2-7 5-12 2-6-3-10-8-8ZM8 23q6-8 13-8M7 25h13', 'M16 4c-3-1-6 4-6 9s-6 8-4 12c1 4 8 3 10-1 1-3 2-6 5-9 4-6 1-11-5-11ZM8 23q4-11 10-5M9 26h8', 'M14 3v10l-4 6-4 5c-1 3 6 4 10 2l7-8M20 4v9l3 5M12 14l9 5M13 11l8 4M6 24l10 2'][index % 4]);
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.3'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); svg.append(path); wrap.append(svg); return wrap;
  }
  function selectCase(c) {
    selected = c; updatePatient(c, false);
    document.querySelectorAll('.case-card').forEach(b => { const on = b.dataset.case === c.id; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
    $('casePreview').hidden = false; $('previewChief').textContent = c.patient.chief; $('previewGoal').textContent = c.patient.goal;
    $('startButton').disabled = !allowed;
    sceneEvent('case_selected');
  }
  function updatePatient(c, active) {
    $('patientName').textContent = patientName(c); $('patientInitial').textContent = patientName(c).slice(0, 1);
    $('patientMeta').textContent = c.patient.age + '岁 · ' + c.patient.occupation;
    $('concernText').textContent = c.patient.concern;
    $('sceneMood').textContent = active ? '正在听你说话' : '等待你的问候';
  }
  function renderCases() {
    $('caseGrid').replaceChildren();
    const order = ['cai', 'flatfoot', 'cavus', 'sprain'];
    const cases = [...data.cases].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    cases.forEach((c, i) => {
      const b = button('', 'case-card', () => selectCase(c)); b.dataset.case = c.id; b.setAttribute('aria-pressed', 'false');
      const top = el('div', 'case-top'); top.append(footIcon(i), el('span', 'case-number', 'CASE 0' + (i + 1)));
      b.append(top, el('h3', '', c.title), el('p', '', c.subtitle), el('span', 'case-tick', '✓')); $('caseGrid').append(b);
    });
    const requested = new URLSearchParams(location.search).get('case'); selectCase(data.cases.find(c => c.id === requested) || data.cases.find(c => c.id === 'cai') || data.cases[0]);
    sceneEvent('cases_rendered');
  }
  function start(resume = false) {
    if (!allowed || !selected) return;
    if (resume && savedSession) {
      session = savedSession; current = data.cases.find(c => c.id === session.caseId);
      if (!current) return toast('这份旧记录的病例在当前版本中不可用，请重新开始。');
      state = { ...emptyState(), ...(session.state || {}) }; state.messages = state.messages || [];
      stage = stages.some(s => s[0] === state.stage) ? state.stage : 'interview'; category = categories[state.category] ? state.category : 'symptoms'; explained = new Set(state.explained || []);
    } else {
      current = selected; state = emptyState(); stage = 'interview'; category = 'symptoms'; explained = new Set();
      session = { id: uid('enc'), caseId: current.id, startedAt: new Date().toISOString(), student, events: [], summary: null, state };
    }
    selectedExam = null; updatePatient(current, true); $('caseLobby').hidden = true; $('encounter').hidden = false; document.body.dataset.encounterActive = 'true';
    $('sessionLabel').textContent = current.title + ' · ' + (session.summary ? session.localPersistence === 'saved' ? '已保存，可继续修订' : '临时留存，请导出 JSON' : '接诊进行中');
    renderMessages(); $('reflection').value = state.reflection; $('reflectionCount').textContent = state.reflection.length + ' / 5000';
    renderAll(); showStage(stage, false);
    if (!resume) { emit('encounter_start', { caseId: current.id }); const opening = current.opening.match(/^治疗师[：:]([\s\S]*?)患者[：:]([\s\S]*)$/); if (current.therapistOpening) { addMessage('student', current.therapistOpening, { source: 'opening' }); addMessage('patient', current.opening, { mode: 'fixed_case' }); } else if (opening) { addMessage('student', opening[1].trim(), { source: 'opening' }); addMessage('patient', opening[2].trim(), { mode: 'fixed_case' }); } else addMessage('patient', current.opening.replace(/^患者[：:]\s*/, ''), { mode: 'fixed_case' }); }
    else toast('已恢复本次接诊，所有问诊与选择都已保留。');
    persist(); $('completionBox').hidden = !session.summary; if (session.summary) renderCompletion();
    sceneEvent('encounter_started', { resumed: !!resume });
  }
  function newCase() {
    if (session) { persist(); savedSession = session; $('resumeBar').hidden = false; }
    session = null; current = null; document.body.dataset.encounterActive = 'false'; $('caseLobby').hidden = false; $('encounter').hidden = true; $('messages').replaceChildren();
    const w = el('div', 'welcome-message'); w.append(el('span', 'welcome-icon', '“'), el('p', '', '选择新病例会开启一份独立的接诊记录。'), el('small', '', '上一份记录可继续，已完成的记录保留在学习报告中。')); $('messages').append(w);
    if (selected) updatePatient(selected, false); $('messageCount').textContent = '逐步了解'; renderSavedSessions(); updateSync();
    sceneEvent('case_reset');
  }
  function renderSavedSessions() {
    const stored = read(DRAFTS_KEY, []), drafts = (Array.isArray(stored) ? stored : []).filter(s => sameStudent(s.student || null, student) && data.cases.some(c => c.id === s.caseId)).sort((a, b) => String(b.updatedAt || b.startedAt).localeCompare(String(a.updatedAt || a.startedAt)));
    $('savedSessions').hidden = !drafts.length || !allowed; $('savedSessionList').replaceChildren();
    drafts.forEach(s => { const row = el('div', 'saved-session'), info = el('div'); info.append(el('b', '', data.cases.find(c => c.id === s.caseId).title), el('small', '', new Date(s.startedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + (s.summary ? ' · 已保存总结' : ' · 接诊未完成'))); row.append(info, button('继续', '', () => { savedSession = s; start(true); }), button('导出', '', () => download(s))); $('savedSessionList').append(row); });
  }
  function addMessage(role, text, meta = {}, record = true) {
    const msg = { id: uid('msg'), role, text: String(text), at: new Date().toISOString(), ...meta }; state.messages.push(msg); appendMessage(msg); $('messageCount').textContent = state.messages.filter(m => m.role !== 'system').length + ' 条对话';
    if (record) {
      if (role === 'student') emit('student_message', { text: msg.text, questionId: meta.questionId || null, source: meta.source || 'card', ...(meta.examId ? { examId: meta.examId } : {}) });
      else if (role === 'patient') emit('patient_message', { text: msg.text, questionId: meta.questionId || null, mode: meta.mode || 'fixed_case', ...(meta.examId ? { examId: meta.examId } : {}) });
      else emit('interaction_feedback', { text: msg.text, ...meta });
    }
    if (role === 'patient') { $('sceneMood').textContent = '患者正在回应'; $('scene').classList.add('speaking'); clearTimeout(speakingTimer); speakingTimer = setTimeout(() => { $('scene').classList.remove('speaking'); $('sceneMood').textContent = '正在听你说话'; }, 2200); speak(msg.text); }
    persist(); sceneEvent('message_added', { message: msg }); return msg;
  }
  function appendMessage(msg) {
    const row = el('div', 'message ' + msg.role); row.dataset.messageId = msg.id;
    if (msg.role !== 'system') row.append(el('span', 'msg-avatar', msg.role === 'patient' ? patientName().slice(0, 1) : '我'));
    const content = el('div', 'msg-content'); if (msg.role !== 'system') content.append(el('div', 'msg-name', msg.role === 'patient' ? patientName() : (student?.name || '访客学习者')));
    content.append(el('div', 'msg-bubble', msg.text));
    if (msg.mode && msg.mode !== 'fixed_case') content.append(el('div', 'msg-source', msg.mode === 'deepseek' ? '大模型语义匹配 · 回答来自固定病例资料' : '固定病例问答'));
    row.append(content); $('messages').append(row); $('messages').scrollTop = $('messages').scrollHeight;
  }
  function renderMessages() { $('messages').replaceChildren(); state.messages.forEach(appendMessage); $('messageCount').textContent = state.messages.filter(m => m.role !== 'system').length + ' 条对话'; }
  function renderAll() { renderStepper(); renderQuestions(); renderExams(); renderEvidence(); renderChoices(); renderDrawer(); renderReview(); renderCounts(); renderTeachingPoints(); }
  function renderStepper() {
    $('stepper').replaceChildren();
    stages.forEach(([id, label], i) => {
      const b = button('', 'step-button', () => showStage(id)); b.dataset.stage = id;
      const done = id === 'interview' ? state.interviewed.length > 0 : id === 'exams' ? state.exams.length > 0 : id === 'evidence' ? state.evidence.length > 0 : id === 'reasoning' ? state.explanations.length > 0 && state.plan.length > 0 : !!session.summary;
      if (done) b.classList.add('done'); if (stage === id) { b.classList.add('active'); b.setAttribute('aria-current', 'step'); }
      b.append(el('span', 'step-number', done && stage !== id ? '✓' : '0' + (i + 1)), el('span', '', label)); $('stepper').append(b);
    });
  }
  function showStage(id, record = true) {
    stage = id; stages.forEach(([key]) => $('stage' + key.slice(0, 1).toUpperCase() + key.slice(1)).hidden = key !== id);
    renderStepper(); if (id === 'summary') renderReview(); if (record) emit('stage_viewed', { stage: id }); persist();
    sceneEvent('stage_changed');
  }
  function renderCounts() { $('interviewCount').textContent = '已问 ' + state.interviewed.length + ' 项'; $('examCount').textContent = '已记录 ' + state.exams.length + ' 项'; $('evidenceCount').textContent = '已标记 ' + state.evidence.length + ' 条'; }
  function renderQuestions() {
    const present = [...new Set(current.questions.map(q => q.category))]; if (!present.includes(category)) category = present[0];
    $('questionTabs').replaceChildren(); present.forEach(key => {
      const count = current.questions.filter(q => q.category === key && state.interviewed.includes(q.id)).length;
      const b = button(categories[key] + (count ? ' · ' + count : ''), key === category ? 'active' : '', () => { category = key; renderQuestions(); persist(); }); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(key === category)); b.dataset.category = key; $('questionTabs').append(b);
    });
    $('questionList').replaceChildren(); current.questions.filter(q => q.category === category).forEach(q => {
      const asked = state.interviewed.includes(q.id), b = button('', 'question-button' + (asked ? ' asked' : ''), () => askQuestion(q)); b.dataset.question = q.id;
      b.append(el('span', 'question-mark', asked ? '✓' : '?'), el('span', '', q.label), el('span', asked ? 'asked-tag' : 'question-arrow', asked ? '已问 · 可再确认' : '↗')); $('questionList').append(b);
    });
  }
  function askQuestion(q) {
    const repeated = state.interviewed.includes(q.id); dirty(); mark('interviewed', q.id); addMessage('student', q.label, { questionId: q.id, source: 'card' });
    emit('question_asked', { questionId: q.id, repeated, category: q.category }); addMessage('patient', q.answer, { questionId: q.id, mode: 'fixed_case' });
    renderQuestions(); renderDrawer(); renderCounts(); renderStepper();
    const why = el('div', 'question-why', q.why || '把这条信息与患者目标和其他证据联系起来。'); $('questionList').append(why);
  }
  async function askFree() {
    const input = $('freeQuestion'), question = input.value.trim(); if (!question) return toast('先写下你想追问的问题。'); if (!session) return;
    const activeId = session.id; $('askFree').disabled = true; $('askFree').textContent = '等待患者回应…'; $('freeMode').textContent = '正在匹配当前病例资料…';
    try {
      const response = await fetch('/api/encounter/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: current.id, question }), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('追问服务暂不可用'); const answer = await response.json();
      if (!session || session.id !== activeId) return;
      if (typeof answer.answer !== 'string' || !answer.answer.trim()) throw new Error('回答暂不可用');
      const matched = current.questions.find(q => q.id === answer.questionId); dirty();
      addMessage('student', question, { questionId: matched?.id || null, source: 'free' });
      if (matched) { const repeated = state.interviewed.includes(matched.id); mark('interviewed', matched.id); emit('question_asked', { questionId: matched.id, repeated, category: matched.category, source: 'free' }); }
      addMessage('patient', answer.answer, { questionId: matched?.id || null, mode: answer.mode === 'deepseek' ? 'deepseek' : 'local_rules' });
      if (answer.notice) addMessage('system', String(answer.notice));
      $('freeMode').textContent = (answer.mode === 'deepseek' ? '大模型语义匹配' : '固定病例问答') + (matched ? ' · 已计入对应问诊项' : ' · 未匹配问诊项，不增加覆盖');
      input.value = ''; renderQuestions(); renderCounts(); renderDrawer(); renderStepper(); persist();
    } catch { if (session?.id === activeId) { $('freeMode').textContent = '服务暂不可用，输入已保留；可选择上方问题卡继续。'; toast('追问暂未发送，已保留你的输入。'); } }
    finally { $('askFree').disabled = false; $('askFree').textContent = '向患者提问 ↗'; }
  }
  const modalityNames = { observation: '形态观察', movement: '动作检查', balance: '平衡任务', pressure: '压力观察' };
  function selectExam(id) {
    const exam = session && current?.exams.find(item => item.id === id); if (!exam) return;
    selectedExam = exam.id; emit('exam_selected', { examId: exam.id }); renderExams(); renderExamDetail(exam);
    sceneEvent('exam_selected', { exam });
  }
  function renderExams() {
    $('examGrid').replaceChildren(); current.exams.forEach(exam => {
      const done = state.exams.includes(exam.id), b = button('', 'exam-card' + (selectedExam === exam.id ? ' selected' : ''), () => selectExam(exam.id)); b.dataset.exam = exam.id;
      b.append(el('span', 'exam-icon', exam.modality === 'balance' ? '◎' : exam.modality === 'movement' ? '↝' : exam.modality === 'pressure' ? '◉' : '◌'), el('span', 'exam-status', done ? exam.appropriate === false ? '已复核 · 未执行' : '虚构记录 ✓' : modalityNames[exam.modality] || '检查'), el('h3', '', exam.label), el('p', '', exam.purpose)); $('examGrid').append(b);
    });
    if (selectedExam) renderExamDetail(current.exams.find(e => e.id === selectedExam)); else $('examDetail').hidden = true;
  }
  function renderExamDetail(exam) {
    if (!exam) return; const box = $('examDetail'); box.hidden = false; box.replaceChildren(); box.append(el('h3', '', exam.label), el('p', '', exam.purpose));
    if (!state.exams.includes(exam.id)) {
      box.append(el('span', 'small-label', '先听患者的顾虑'), el('div', 'patient-worry', '“' + exam.patientConcern + '”'));
      if (!explained.has(exam.id)) {
        box.append(el('p', '', exam.consentPrompt), button(exam.appropriate === false ? '向患者说明为什么不执行' : '向患者解释检查目的与安全边界', 'button', () => {
          explained.add(exam.id); addMessage('student', exam.consentPrompt, { examId: exam.id, source: 'exam_explanation' }); addMessage('patient', exam.patientConcern, { examId: exam.id }); addMessage('student', exam.explanation, { examId: exam.id, source: 'exam_explanation' }); emit('exam_explained', { examId: exam.id, text: exam.explanation }); renderExamDetail(exam); persist();
        }));
      } else {
        box.append(el('div', 'consent-explanation', exam.explanation), button(exam.appropriate === false ? '记录不执行与原因 →' : '确认配合，查看虚构检查记录 →', 'button primary', () => performExam(exam)));
      }
    } else {
      const result = el('div', 'result-card'); result.append(el('span', 'result-label', '原创虚构检查记录'), el('p', '', exam.result)); box.append(result, el('div', 'feedback' + (exam.appropriate === false ? ' caution' : ''), exam.interpretation + (exam.reason ? ' ' + exam.reason : '')));
    }
  }
  function performExam(exam) {
    if (!explained.has(exam.id)) return; dirty(); mark('exams', exam.id); addMessage('patient', exam.appropriate === false ? '我明白了，我们先不做这项检查。我希望在安全、能接受的范围里继续了解问题。' : '我明白了。我愿意配合，如果不舒服会及时告诉你。', { examId: exam.id });
    emit('exam_completed', { examId: exam.id, appropriate: exam.appropriate, result: exam.result }); addMessage('system', exam.label + '：' + exam.result, { examId: exam.id });
    renderExams(); renderDrawer(); renderCounts(); renderStepper(); persist();
    sceneEvent('exam_result', { exam });
  }
  function renderEvidence() {
    $('evidenceList').replaceChildren(); const kinds = { fictional: '教学虚构病例资料', literature: '文献依据', 'public-practice': '公开检查方法' };
    current.evidence.forEach(ev => {
      const chosen = state.evidence.includes(ev.id), card = el('article', 'evidence-card' + (chosen ? ' selected' : '')); card.dataset.evidence = ev.id;
      const top = el('div', 'evidence-card-top'); top.append(el('span', 'kind-label', kinds[ev.kind] || '参考证据'), el('span', 'kind-label', chosen ? '已纳入判断 ✓' : '待你核对'));
      card.append(top, el('h3', '', ev.title), el('p', '', ev.body));
      if (ev.sourceIds?.length) { const sources = el('div', 'source-links'); ev.sourceIds.forEach(id => { const source = data.sources.find(s => s.id === id); if (!source || !/^https?:\/\//i.test(source.url)) return; const a = el('a', '', source.title + ' ↗'); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; sources.append(a); }); card.append(sources); }
      card.append(button(chosen ? '✓ 已标记 · 点击取消' : '＋ 标记为我使用的证据', 'evidence-mark', () => { dirty(); mark('evidence', ev.id, !chosen); emit('evidence_toggled', { evidenceId: ev.id, selected: !chosen }); renderEvidence(); renderDrawer(); renderCounts(); renderStepper(); persist(); })); $('evidenceList').append(card);
    });
  }
  function renderChoices() {
    $('explanationPrompt').textContent = current.explanation.prompt; $('planPrompt').textContent = current.plan.prompt;
    [['explanations', current.explanation.points, 'explanationOptions', 'explanation_toggled', 'explanationId'], ['plan', current.plan.options, 'planOptions', 'plan_toggled', 'planId']].forEach(([list, options, target, eventType, idKey]) => {
      $(target).replaceChildren(); options.forEach(option => {
        const label = el('label', 'choice-option'), input = el('input'); input.type = 'checkbox'; input.checked = state[list].includes(option.id); input.dataset.choice = option.id; input.setAttribute('aria-label', option.label);
        label.append(input, el('span', '', option.label));
        if (input.checked) label.append(el('div', 'option-feedback' + (option.appropriate === false ? ' caution' : ''), option.feedback));
        input.addEventListener('change', () => { dirty(); mark(list, option.id, input.checked); emit(eventType, { [idKey]: option.id, selected: input.checked }); renderChoices(); renderStepper(); persist(); }); $(target).append(label);
      });
    });
  }
  function renderDrawer() {
    const box = $('drawerBody'); box.replaceChildren(); let count = 0;
    current.questions.filter(q => state.interviewed.includes(q.id)).forEach(q => { const item = el('div', 'drawer-item'); item.append(el('b', '', '问诊 · ' + q.label), el('p', '', q.answer)); box.append(item); count++; });
    current.exams.filter(e => state.exams.includes(e.id)).forEach(e => { const item = el('div', 'drawer-item'); item.append(el('b', '', (e.appropriate === false ? '未执行 · ' : '检查 · ') + e.label), el('p', '', e.result)); box.append(item); count++; });
    current.evidence.filter(e => state.evidence.includes(e.id)).forEach(e => { const item = el('div', 'drawer-item'); item.append(el('b', '', '已标记 · ' + e.title), el('p', '', e.body)); box.append(item); count++; });
    if (!count) box.append(el('p', 'muted', '问诊和检查后，已获取的信息会收纳在这里。')); $('drawerCount').textContent = count;
  }
  function coverage() { const essential = current.questions.filter(q => q.essential); return { asked: state.interviewed.length, essentialAsked: essential.filter(q => state.interviewed.includes(q.id)).length, essentialTotal: essential.length }; }
  function renderReview() {
    if (!current) return; const box = $('coverageReview'); box.replaceChildren(); const cov = coverage();
    [[cov.asked + ' 项', '已了解的问诊信息'], [cov.essentialAsked + ' / ' + cov.essentialTotal, '关键问诊覆盖（去重）'], [state.exams.length + ' 项', '已说明并记录的检查路径'], [state.evidence.length + ' 条', '主动标记的证据']].forEach(([value, title]) => { const item = el('div', 'review-metric'); item.append(el('b', '', value), el('span', '', title)); box.append(item); });
    const missingSafety = current.questions.filter(q => q.category === 'safety' && q.essential && !state.interviewed.includes(q.id));
    const missingKey = current.questions.filter(q => q.essential && !state.interviewed.includes(q.id));
    const unsafe = current.exams.filter(e => e.appropriate === false && state.exams.includes(e.id));
    const unsuitableChoices = [...current.explanation.points.filter(p => p.appropriate === false && state.explanations.includes(p.id)), ...current.plan.options.filter(p => p.appropriate === false && state.plan.includes(p.id))];
    const observations = [];
    if (missingSafety.length) observations.push({ caution: true, text: '安全信息仍不足：你尚未确认“' + missingSafety.map(q => q.label).join('”“') + '”。这会限制继续检查或给出计划的把握，建议先补问。' });
    else observations.push({ text: '已覆盖病例设定中的关键安全问题。仍应把症状变化与真实查体结果作为下一步决策依据。' });
    if (missingKey.length) observations.push({ caution: true, text: '还有 ' + missingKey.length + ' 项关键问诊待确认。覆盖数用于提示信息缺口；提问先后与重复次数不会额外加分。' });
    if (!state.exams.length || !state.evidence.length) observations.push({ caution: true, text: '证据链还未形成：' + (!state.exams.length ? '尚未获取检查结果。' : '') + (!state.evidence.length ? '尚未标记支持判断的证据。' : '') + '请在总结中说明判断依据和不确定性。' });
    if (unsafe.length) observations.push({ text: '已记录以下路径不执行及其局限：' + unsafe.map(e => e.label + '——' + e.reason).join('；') });
    if (unsuitableChoices.length) observations.push({ caution: true, text: '当前解释或计划有需要修订的地方：' + unsuitableChoices.map(p => p.feedback).join(' ') });
    if (!state.explanations.length || !state.plan.length) observations.push({ caution: true, text: '解释与共同计划尚未完整。请把你愿意向患者说明的内容及下一步方案留下来。' });
    else if (!unsuitableChoices.length) observations.push({ text: '你已留下解释与计划。请检查它们是否回应了患者的目标：“' + current.patient.goal + '”。' });
    observations.forEach(o => box.append(el('div', 'review-observation' + (o.caution ? ' caution' : ''), o.text)));
  }
  function renderTeachingPoints() { const box = $('reviewPoints'); box.replaceChildren(); [['教学要点', current.review?.keyPoints || []], ['资料边界', current.review?.limitations || []]].forEach(([title, points]) => { box.append(el('p', 'small-label', title)); const ul = el('ul'); points.forEach(text => ul.append(el('li', '', text))); box.append(ul); }); }
  function saveProgress() { if (!session) return; state.reflection = $('reflection').value; emit('encounter_saved', { caseId: current.id }); persist(); toast(storageWorks ? '接诊进度已保存在本机，可稍后继续。' : '浏览器无法持久保存，请导出 JSON 留存。'); }
  function complete() {
    if (!session) return; const reflection = $('reflection').value.trim(); if (reflection.length < 20) { toast('请用至少 20 字写下判断依据、不确定性或后续计划。'); $('reflection').focus(); return; }
    state.reflection = reflection;
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000));
    const summary = { caseId: current.id, interviewed: [...state.interviewed], exams: [...state.exams], evidence: [...state.evidence], explanations: [...state.explanations], plan: [...state.plan], reflection, coverage: coverage(), durationSeconds: Math.min(604800, elapsedSeconds), durationCapped: elapsedSeconds > 604800 };
    session.summary = summary; session.completedAt = new Date().toISOString(); emit('encounter_complete', summary); persist();
    const stored = read(COMPLETED_KEY, []), completed = Array.isArray(stored) ? stored : []; const index = completed.findIndex(s => s.id === session.id); session.localPersistence = 'saved'; const copy = JSON.parse(JSON.stringify(session)); if (index >= 0) completed[index] = copy; else completed.push(copy); const durable = write(COMPLETED_KEY, completed); if (!durable) session.localPersistence = 'temporary'; persist();
    renderCompletion(); renderStepper(); $('completionBox').hidden = false; $('sessionLabel').textContent = current.title + (durable ? ' · 已保存，可继续修订' : ' · 临时留存，请导出 JSON'); $('completeButton').textContent = durable ? '更新接诊记录 ✓' : '重新尝试保存接诊记录'; toast(durable ? '接诊记录已保存，上传状态见页面下方。' : '临时留存，请导出 JSON；服务器状态见下方。');
  }
  function renderCompletion() {
    const box = $('completionBox'), durable = session.localPersistence === 'saved'; box.replaceChildren(); box.append(el('h3', '', durable ? '本次接诊已留存 ✓' : '临时留存，请导出 JSON'), el('p', '', durable ? '问诊、患者回应、检查配合、证据选择与开放总结已保存。你可以返回任一步修订后再次保存；教师通过课堂服务查看已同步的记录。' : '当前会话仍保留完整记录。浏览器持久写入未成功，请及时导出 JSON；服务器接收状态见页面下方。'));
    box.append(el('p', '', durationNotice(session.summary)));
    const a = el('a', '', '打开教师审查入口 ↗'); a.href = '../teacher/index.html'; box.append(a);
  }
  function durationNotice(summary) { return (summary?.durationCapped ? '打开至提交间隔超过7天，统计按7天封顶。' : '') + '记录时长为打开至提交间隔，不等同活跃学习时长。'; }
  function exportRecord() {
    if (!session) { if (savedSession && sameStudent(savedSession.student || null, student)) download(savedSession); else toast('开始接诊后即可导出完整记录。'); return; }
    state.reflection = $('reflection').value; persist(); download(session);
  }
  function download(s) { const blob = new Blob([JSON.stringify({ format: 'dxx-encounter-v1', exportedAt: new Date().toISOString(), notice: data?.notice || '教学虚构病例', durationNotice: durationNotice(s.summary), caseVersion: data?.version || null, case: data?.cases.find(c => c.id === s.caseId) || null, sources: data?.sources || [], session: s }, null, 2)], { type: 'application/json;charset=utf-8' }); const a = el('a'); const url = URL.createObjectURL(blob); a.href = url; a.download = '足踝接诊_' + s.caseId + '_' + (s.student?.studentId || '访客') + '_' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('完整 JSON 记录已导出。'); }
  function speak(text) {
    if (!voiceOn) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { voiceOn = false; renderVoice('当前浏览器没有可用朗读服务，请阅读对话文字。'); return; }
    const voices = speechSynthesis.getVoices(), chinese = voices.find(v => /^zh/i.test(v.lang));
    if (!chinese) { renderVoice('未检测到中文语音，当前使用文字对话；可在设备安装中文语音后重试。'); return; }
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; utterance.voice = chinese; utterance.rate = .96; utterance.onerror = () => renderVoice('朗读暂不可用，完整回答已显示在对话区。'); speechSynthesis.speak(utterance);
  }
  function renderVoice(message) { $('voiceToggle').setAttribute('aria-pressed', String(voiceOn)); $('voiceToggle').textContent = voiceOn ? '◖ 朗读开启' : '◖ 朗读关闭'; $('voiceNote').hidden = !message; $('voiceNote').textContent = message || ''; }
  $('scene').append(el('span', 'scene-disclaimer', '场景示意 · 非病例本人'));
  $('identity').textContent = student ? student.name + ' · ' + student.studentId : demo ? '访客演示 · 本机留存' : '尚未登记';
  $('accessNote').hidden = allowed;
  $('startButton').addEventListener('click', () => start()); $('resumeButton').addEventListener('click', () => start(true));
  $('saveButton').addEventListener('click', saveProgress); $('restartButton').addEventListener('click', newCase); $('askFree').addEventListener('click', askFree);
  $('completeButton').addEventListener('click', complete); $('exportButton').addEventListener('click', exportRecord); $('exportTop').addEventListener('click', exportRecord); $('retryUpload').addEventListener('click', flush);
  $('reflection').addEventListener('input', () => { state.reflection = $('reflection').value; $('reflectionCount').textContent = state.reflection.length + ' / 5000'; dirty(); persist(); });
  $('voiceToggle').addEventListener('click', () => { voiceOn = !voiceOn; if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel(); renderVoice(voiceOn ? '仅朗读之后出现的患者回应；声音由你的浏览器提供。' : ''); if (voiceOn && !('speechSynthesis' in window)) { voiceOn = false; renderVoice('当前浏览器没有可用朗读服务，请阅读对话文字。'); } });
  document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => showStage(b.dataset.next)));
  window.addEventListener('online', flush); window.addEventListener('beforeunload', persist);
  async function init() {
    try {
      const response = await fetch('cases.json', { cache: 'no-cache' }); if (!response.ok) throw new Error('未能读取病例资料'); data = await response.json(); if (!Array.isArray(data.cases) || !data.cases.length) throw new Error('病例资料暂不可用'); data.sources = data.sources || [];
      renderCases();
      try { const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); if (saved?.id && sameStudent(saved.student || null, student) && data.cases.some(c => c.id === saved.caseId)) savedSession = saved; } catch {}
      if (!savedSession) { const drafts = read(DRAFTS_KEY, []); if (Array.isArray(drafts)) savedSession = drafts.filter(s => sameStudent(s.student || null, student) && data.cases.some(c => c.id === s.caseId)).sort((a, b) => String(b.updatedAt || b.startedAt).localeCompare(String(a.updatedAt || a.startedAt)))[0] || null; }
      $('resumeBar').hidden = !savedSession || !allowed; renderSavedSessions();
      updateSync(); flush();
    } catch {
      $('caseGrid').replaceChildren(); const error = el('div', 'error-message', '病例资料尚未加载。请通过本地课堂服务打开本页，并检查 cases.json 是否可用。'); error.append(button('重新加载病例', 'button small', init)); $('caseGrid').append(error); $('startButton').disabled = true;
    } finally { sceneEvent('init'); }
  }
  init();
})();
