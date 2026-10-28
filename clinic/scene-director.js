(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const api = () => window.DXXClinicScene;
  const drawers = ['workflowDrawer', 'notebookDrawer', 'transcriptDrawer', 'caseDrawer'];
  const triggers = { workflowDrawer: 'openWorkflow', notebookDrawer: 'openNotebook', transcriptDrawer: 'openTranscript', caseDrawer: 'openCases' };
  let camera = 'third', openId = null, returnFocus = null, examPhase = 0, latest = null, queued = false;
  const overlay = document.createElement('div'); overlay.className = 'scene-hotspots'; $('sceneOverlay').append(overlay);
  const visualLabel = document.createElement('span'); visualLabel.className = 'visual-step-label'; $('sceneOverlay').append(visualLabel);
  document.querySelector('.stage-signature').textContent = '病例讨论 · 共用虚构患者形象';
  const short = (text, limit = 94) => {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) return text;
    const part = text.slice(0, limit), stop = Math.max(part.lastIndexOf('。'), part.lastIndexOf('；'));
    return (stop > 30 ? part.slice(0, stop + 1) : part + '…');
  };
  function subtitle(role, text) {
    const c = api()?.getPublicState().currentCase;
    $('speakerName').textContent = role === 'patient' ? (c?.patient.name || '患者').replace(/[（(]原创虚构[）)]/g, '') : role === 'student' ? '你 · 治疗师' : '诊室';
    $('subtitleText').textContent = short(text);
    $('subtitleText').title = String(text || '');
  }
  function closeDrawer(restore = true) {
    const focusInside = openId && $(openId).contains(document.activeElement);
    drawers.forEach(id => { $(id).hidden = true; $(triggers[id]).setAttribute('aria-expanded', 'false'); });
    $('sceneStage').inert = false;
    openId = null;
    if (restore && returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus({ preventScroll: true });
    else if (focusInside) $(api()?.getPublicState().active ? 'openWorkflow' : 'openCases').focus({ preventScroll: true });
  }
  function openDrawer(id) {
    if (openId === id) { closeDrawer(); return; }
    closeDrawer(false); returnFocus = document.activeElement; openId = id;
    $(id).hidden = false; $(triggers[id]).setAttribute('aria-expanded', 'true');
    $('sceneStage').inert = true;
    if (id === 'notebookDrawer') $('evidenceDrawer').open = true;
    $(id).querySelector('.close-drawer').focus({ preventScroll: true });
    if (id === 'transcriptDrawer') $('messages').scrollTop = $('messages').scrollHeight;
  }
  function action(label, fn, primary = false) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    if (primary) b.className = 'primary'; b.addEventListener('click', fn); $('sceneActionBar').append(b); return b;
  }
  function hotspot(label, x, y, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'scene-hotspot'; b.style.left = x + '%'; b.style.top = y + '%';
    const dot = document.createElement('i'); dot.className = 'hotspot-dot'; dot.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.textContent = label; b.append(dot, text); b.addEventListener('click', fn); overlay.append(b);
  }
  function goStage(id) { closeDrawer(false); camera = 'first'; examPhase = 0; api()?.stage(id); }
  function chooseExam(id) { closeDrawer(false); camera = 'first'; examPhase = 0; api()?.exam(id); }
  function examButton() { return $('examDetail').querySelector('button'); }
  function advanceExam(exam) {
    const button = examButton(); if (!button) { openDrawer('workflowDrawer'); return; }
    if (button.textContent.includes('解释') || button.textContent.includes('为什么不执行')) {
      button.click(); examPhase = 1;
    } else if (examPhase < 2 && exam.appropriate !== false && exam.modality !== 'pressure') {
      examPhase = 2;
      subtitle('system', '先核对检查条件和患者是否愿意配合，再查看病例记录。我们会把检查目的、感受和发现一起讨论。');
    } else { button.click(); examPhase = 3; }
    schedule();
  }
  function render() {
    queued = false;
    const s = api()?.getPublicState(); if (!s) return;
    const c = s.currentCase;
    ['openWorkflow', 'openNotebook', 'openTranscript', 'subtitleExpand'].forEach(id => { $(id).disabled = !s.active; });
    $('sceneActionBar').replaceChildren(); overlay.replaceChildren();
    $('enterConsultation').disabled = $('startButton').disabled;
    const image = 'conversation', label = '患者资料 · 病例讨论';
    let title = s.active ? '听患者讲述他的经历' : '先了解这次来访';
    let hint = s.active ? '病例讨论：先倾听，再说明检查目的与如何配合。' : '从患者资料了解这次来访，再共同讨论下一步。';
    visualLabel.hidden = true;
    if (!s.active) {
      $('sessionLabel').textContent = '初次接诊';
      if (c) subtitle('system', c.patient.chief + '。' + c.patient.goal);
      action('选择来访者', () => openDrawer('caseDrawer'));
      if (!$('resumeBar').hidden) action('继续上次接诊', () => { closeDrawer(false); camera = 'first'; api().resume(); }, true);
    } else if (s.stage === 'interview') {
      const unasked = c.questions.filter(q => !s.interviewed.includes(q.id));
      unasked.slice(0, 2).forEach(q => action(q.label, () => { closeDrawer(false); camera = 'first'; api().ask(q.id); }, true));
      action('安排检查 →', () => goStage('exams'));
      hotspot('查看问诊问题', 77, 50, () => openDrawer('workflowDrawer'));
      if (!unasked.length) action('自由追问', () => openDrawer('workflowDrawer'));
    } else if (s.stage === 'exams') {
      const exam = c.exams.find(e => e.id === s.selectedExam);
      title = exam ? exam.label : '向患者说明，接下来为什么检查'; hint = '围绕病例资料讨论，先解释检查目的并取得配合。';
      if (!exam) {
        action('观察足踝', () => chooseExam('observe'), true);
        action('活动与配合', () => chooseExam('movement'));
        action('其他检查', () => openDrawer('workflowDrawer'));
        hotspot('足踝观察', 60, 70, () => chooseExam('observe'));
      } else {
        const neutral = exam.appropriate === false || exam.modality === 'pressure';
        const standing = exam.modality === 'balance' || exam.modality === 'movement' && c.id !== 'cavus';
        const done = s.exams.includes(exam.id);
        const currentButton = examButton();
        const explained = currentButton && !/解释检查|为什么不执行/.test(currentButton.textContent);
        if (!done) {
          const next = !explained ? (exam.appropriate === false ? '说明为何不做' : '向患者说明检查') : exam.appropriate === false ? '记录不执行' : exam.modality === 'pressure' ? '确认资料边界' : examPhase < 2 ? '核对检查条件 →' : '确认配合，查看虚构记录';
          action(next, () => advanceExam(exam), true);
          if (!neutral) hotspot('检查说明与记录', standing ? 66 : 69, standing ? 65 : 58, () => openDrawer('workflowDrawer'));
        } else {
          hint = exam.appropriate === false ? '已记录不执行的理由。' : '已获取原创虚构检查记录。';
          action('查看检查记录', () => openDrawer('workflowDrawer'), true);
        }
        action('换一项检查', () => openDrawer('workflowDrawer'));
        action('整理证据 →', () => goStage('evidence'));
      }
    } else {
      const next = { evidence: ['把线索连成依据', '标记证据', 'reasoning', '向患者解释 →'], reasoning: ['与患者商量下一步', '解释与共同计划', 'summary', '接诊总结 →'], summary: ['把本次思考留下来', '写下接诊总结', null, ''] }[s.stage];
      if (next) { title = next[0]; hint = '画面保留给交流，记录按需展开。'; action(next[1], () => openDrawer('workflowDrawer'), true); if (next[2]) action(next[3], () => goStage(next[2])); }
    }
    // Keep at most three choices on the image; the full workflow remains in the drawer.
    while ($('sceneActionBar').children.length > 3) $('sceneActionBar').lastElementChild.remove();
    const path = 'assets/consultation.png';
    if ($('sceneBackdrop').getAttribute('src') !== path) { $('sceneBackdrop').removeAttribute('data-fallback'); $('sceneBackdrop').src = path; }
    $('sceneBackdrop').alt = '虚构教学患者资料画面，用于病例讨论；检查条件与发现请查看病例记录';
    const firstPerson = false;
    $('cameraThird').setAttribute('aria-pressed', String(!firstPerson)); $('cameraFirst').setAttribute('aria-pressed', String(firstPerson));
    $('cameraThird').classList.toggle('active', !firstPerson); $('cameraFirst').classList.toggle('active', firstPerson);
    $('cameraFirst').disabled = true;
    $('cameraFirst').title = '当前为患者资料画面';
    document.body.dataset.sceneMode = image;
    $('cameraLabel').textContent = label; $('sceneTitle').textContent = title; $('sceneHint').textContent = hint;
  }
  function schedule() { if (!queued) { queued = true; queueMicrotask(render); } }
  window.addEventListener('dxx:clinic-scene', event => {
    const d = event.detail;
    if (d.type === 'message_added' && d.message.role !== 'system') {
      latest = d.message; subtitle(d.message.role, d.message.text);
      if (d.message.role === 'patient') closeDrawer(false);
    }
    if (d.type === 'encounter_started') { closeDrawer(false); camera = 'first'; latest = api().getPublicState().latestMessage; if (latest) subtitle(latest.role, latest.text); }
    if (d.type === 'exam_selected') { examPhase = 0; closeDrawer(false); const done = api().getPublicState().exams.includes(d.exam.id); subtitle(done ? 'system' : 'patient', done ? '原创虚构检查记录：' + d.exam.result : d.exam.patientConcern); }
    if (d.type === 'exam_result') { subtitle('system', d.exam.appropriate === false ? '已记录不执行。' + d.exam.reason : '原创虚构检查记录：' + d.exam.result); }
    if (d.type === 'stage_changed') { closeDrawer(false); if (d.stage !== 'interview') subtitle('system', ({ exams: '先解释检查目的，听患者的顾虑，再决定如何继续。', evidence: '结合问诊与检查，选择支持判断的证据。', reasoning: '把你的理解和下一步计划告诉患者，也听取他的意见。', summary: '记录你关注的问题、依据和仍然不确定的部分。' })[d.stage]); }
    if (d.type === 'case_reset') { camera = 'third'; examPhase = 0; latest = null; }
    schedule();
  });
  Object.entries(triggers).forEach(([id, trigger]) => $(trigger).addEventListener('click', () => {
    if (id === 'caseDrawer' && api()?.getPublicState().active) api().newCase();
    openDrawer(id);
  }));
  [['closeWorkflow','workflowDrawer'],['closeNotebook','notebookDrawer'],['closeTranscript','transcriptDrawer'],['closeCases','caseDrawer']].forEach(([id]) => $(id).addEventListener('click', () => closeDrawer()));
  $('subtitleExpand').addEventListener('click', () => openDrawer('transcriptDrawer'));
  $('cameraThird').addEventListener('click', () => { camera = 'third'; schedule(); });
  $('cameraFirst').addEventListener('click', () => { camera = 'first'; schedule(); });
  $('enterConsultation').addEventListener('click', () => { closeDrawer(false); camera = 'first'; api()?.start(); });
  document.addEventListener('keydown', event => {
    if (!openId) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); return; }
    if (event.key !== 'Tab') return;
    const list = [...$(openId).querySelectorAll('button:not(:disabled),a[href],textarea,input,summary,[tabindex="0"]')].filter(n => n.getClientRects().length);
    if (!list.length) { event.preventDefault(); $(openId).focus(); return; }
    const first = list[0], last = list[list.length - 1];
    if (event.shiftKey && (document.activeElement === first || !$(openId).contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  $('restartButton').addEventListener('click', () => { document.querySelector('.action-menu').open = false; openDrawer('caseDrawer'); });
  schedule();
})();
