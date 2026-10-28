// Run: node work/clinic-v8/test-flow.mjs
// Exercises the actual app control functions with an in-memory DOM and storage.
// It does not load WebGL, contact the teaching service, or submit paid generation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(root, 'app.js');
const flowPath = path.join(root, 'case-flow.js');
const reportPath = path.resolve(process.argv[2] || path.join(root, '..', '..', 'v14-flow-test.json'));
const appSource = fs.readFileSync(appPath, 'utf8');
const flowSource = fs.readFileSync(flowPath, 'utf8');
const gaitContent = await import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(root,'gait-lesson.js'),'utf8')).toString('base64'));
const content = await import(new URL('./case-flow.js',import.meta.url));
const {MUSCLE_ITEMS}=await import(new URL('./case-muscle-v14.js',import.meta.url));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const results = [];
let sequence = 0;

function assert(value, message) { if (!value) throw new Error(message); }
function test(id, label, fn) {
  try { const detail = fn(); results.push({ id, label, passed: true, detail }); }
  catch (error) { results.push({ id, label, passed: false, error: error.message }); }
}
function extractFunction(name) {
  const start = appSource.indexOf('function ' + name + '(');
  assert(start >= 0, 'Missing actual app function: ' + name);
  const tail = appSource.slice(start);
  const next = tail.search(/\n(?:async )?function /);
  return next < 0 ? tail : tail.slice(0, next);
}
const functionNames = ['record', 'persist', 'addEvidence', 'appendLine', 'currentAct', 'drawRail', 'goto', 'choose', 'taskComplete', 'complete'];
const actualFunctions = functionNames.map(extractFunction).join('\n');

function element(tag = 'div') {
  const classes = new Set();
  return {
    tag, hidden: false, disabled: false, textContent: '', value: '', dataset: {}, children: [], attributes: {},
    classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; }
  };
}
function createHarness(saved, reviewNode=null) {
  const state = saved || {
    sessionId: 'flow-test-' + (++sequence), caseId: 'cai', startedAt: '2026-10-18T00:00:00.000Z',
    student: null, node: null, history: [], evidence: [], events: [], visited: [], taskReceipts: {}, records: [],
    exitLock: false, reflection: '', completedAt: null, view: 'third', paused: false
  };
  // This harness starts after footwear preparation; preparation/consent handoff
  // is exercised independently by the v18 integration tests and browser checks.
  state.barefootPrepared = true;
  const elements = new Map();
  const storage = new Map();
  const notices = [];
  const actorCalls = [];
  const STORE = 'flow-test-store';
  let tick = 0;
  const $ = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  const d = {
    state, STORE, REVIEW_NODE:reviewNode, MUSCLE_ITEMS, isGaitEventMatch:gaitContent.isGaitEventMatch, profile: null, flow: content.FLOW,
    chapters: content.CASE_DATA.acts.map(act => [act.id, act.shortTitle]),
    $, localStorage,
    document: { body: { dataset: {} }, querySelectorAll: selector => selector === '#options button' ? $('options').children : [] },
    actors: { patient: { setGaitPhase: value => actorCalls.push(['gaitPhase', value]), setLocomotion: value => actorCalls.push(['locomotion', value]),getState:()=>({pose:'standing'}),setPose:()=>{} },therapist:{getState:()=>({pose:'standing'}),setPose:()=>{}} },
    button: (label, action) => Object.assign(element('button'), { label, action }),
    nodeEl: (tag, cls, text) => Object.assign(element(tag), { textContent: text ?? '', className: cls ?? '' }),
    toast: text => notices.push(text), openDrawer: id => notices.push('drawer:' + id),
    renderTask() {}, speak() {}, setVisual() {}, flush() {},
    uid: () => 'test-event-' + (++tick), now: () => new Date(Date.UTC(2026, 9, 18, 0, 0, 0, ++tick)).toISOString()
  };
  const factory = new Function('d', `
    const {state,STORE,REVIEW_NODE,MUSCLE_ITEMS,isGaitEventMatch,profile,flow,chapters,$,localStorage,document,actors,button,nodeEl,toast,openDrawer,renderTask,speak,setVisual,flush,uid,now}=d;const lessonUI={presentNode:()=>{}};const dialoguePlayer={load:()=>{}};const updateComposition=()=>{};
    let activeNode=null,selectedNext=null,taskRunning=false,taskPhase=.08,pressureMode='static',hasStarted=!REVIEW_NODE;
    let queue=[];const stepBook=new Map();
    ${actualFunctions}
    return {state,goto,choose,taskComplete,complete,persist,drawRail,
      node:()=>activeNode,next:()=>selectedNext,steps:stepBook,
      setPhaseMode:(phase,mode)=>{taskPhase=phase;pressureMode=mode;},
      pendingQueue:()=>queue};
  `);
  const api = factory(d);
  return { ...api, $, notices, storage, actorCalls,
    saved: () => JSON.parse(storage.get(STORE)),
    option: id => { const option = api.node()?.options.find(option => option.id === id); assert(option, 'Option unavailable: ' + id); return option; },
    pick(id) { const option = this.option(id); api.choose(option, $('options').children.find(button => button.dataset.option === id)); },
    advance() { assert(api.next() && api.next() !== '__complete', 'No ordinary next at ' + api.node()?.id); api.goto(api.next()); }
  };
}
function satisfyTask(harness) {
  const task = harness.node()?.task;
  if (!task) return;
  const steps = harness.steps;
  if (task.type === 'goniometer') for (const id of ['axis', 'fixed', 'moving']) steps.set(id, true);
  if (task.type === 'muscle') for(const x of MUSCLE_ITEMS) steps.set('muscle_'+x.id,true);
  if (task.type === 'arch') for(const x of ['arch_seated','arch_standing']) steps.set(x,true);
  if (task.type === 'gait') for (const event of task.events) steps.set(event.id, event.targetPhase);
  if (task.type === 'pressure' && task.stage === 'conditions') steps.set('mode', true);
  if (task.type === 'pressure' && task.stage === 'regions') {
    harness.setPhaseMode(.4, 'dynamic'); steps.set('region', '中足'); steps.set('dynamicMin', .2); steps.set('dynamicMax', .4);
  }
  if (task.type === 'balance') (task.checklist || []).forEach((_, index) => steps.set('check' + index, true));
}
function walk(harness, target, overrides = {}) {
  if (!harness.node()) harness.goto(content.START_NODE);
  let count = 0;
  while (harness.node().id !== target) {
    assert(++count < 70, 'Route did not reach ' + target);
    const node = harness.node();
    assert(!node.terminal, 'Reached terminal before ' + target);
    if (node.options.length) {
      satisfyTask(harness);
      const optionId = overrides[node.id] || node.options.find(option => option.good && !option.retry)?.id;
      harness.pick(optionId);
    }
    harness.advance();
  }
  return count;
}
function eventCount(harness, type) { return harness.state.events.filter(event => event.type === type).length; }

test('content-links', '内容节点与证据引用完整', () => {
  const nodes = Object.values(content.FLOW);
  for (const node of nodes) {
    for (const next of [node.next, ...node.options.map(option => option.next)].filter(Boolean)) assert(content.FLOW[next], 'Missing node: ' + next);
    for (const id of [...(node.evidence || []), ...node.options.flatMap(option => option.evidence || [])]) assert(content.EVIDENCE_CATALOG[id], 'Missing evidence: ' + id);
  }
  return { nodes: nodes.length };
});

test('eight-act-route', '八幕顺序及新增任务无跳过主线', () => {
  const h=createHarness();walk(h,'finish');
  const seen=h.state.visited.map(id=>content.FLOW[id].act).filter((id,i,a)=>i===0||id!==a[i-1]);
  assert(JSON.stringify(seen)===JSON.stringify(['act1','act2','act3','act4','act5','act6','act7','act8','debrief']),'Act order differs: '+seen);
  assert(h.state.evidence.includes('muscle_knowledge')&&h.state.evidence.includes('arch_record'),'New learning evidence missing');
  return {acts:seen,nodeCount:h.state.visited.length};
});

test('muscle-arch-gates', '新增肌群与足弓任务需实际核对且不造测量', () => {
  const h=createHarness();h.goto('muscle_match');h.pick('muscle_match_done');
  assert(!h.next()&&!h.state.evidence.includes('muscle_knowledge'),'Empty muscle task accepted');
  satisfyTask(h);h.pick('muscle_match_done');assert(h.state.evidence.includes('muscle_knowledge'),'Matched muscle task rejected');
  const a=createHarness();a.goto('arch_compare');a.steps.set('arch_seated',true);a.pick('arch_observed');
  assert(!a.next()&&!a.state.evidence.includes('arch_record'),'Single-view arch accepted');
  a.steps.set('arch_standing',true);a.pick('arch_observed');assert(a.state.evidence.includes('arch_record'),'Both-view arch rejected');
  assert(!JSON.stringify(h.state.taskReceipts).includes('muscleGrade'),'Patient grade invented');
  return {emptyMuscleBlocked:true,singleArchBlocked:true,receiptScope:h.state.taskReceipts.muscle_match.scope};
});

test('teacher-preview-isolated', '教师单项预览不保存、不发事件、不推进病例', () => {
  const h=createHarness(undefined,'muscle_match');h.goto('muscle_match');satisfyTask(h);h.pick('muscle_match_done');h.advance();
  assert(h.node().id==='muscle_match','Preview advanced into case');assert(h.storage.size===0,'Preview persisted');assert(h.state.events.length===0,'Preview sent learning events');
  return {saved:false,events:0,clinicalMeasurement:false,restrictedNode:h.node().id};
});

test('same-screen-choice-lock', '同屏改选与重复点击被阻止', () => {
  const h = createHarness(); walk(h, 'consent_reply');
  h.pick('respect_decline'); h.pick('reassure_without_guarantee'); h.pick('respect_decline');
  assert(h.next() === 'decline_stop', 'Choice route changed');
  assert(h.state.evidence.includes('declined') && !h.state.evidence.includes('consent'), 'Mutually exclusive evidence mixed');
  const choices = h.state.events.filter(event => event.type === 'clinic3d_choice' && event.payload.nodeId === 'consent_reply');
  assert(choices.length === 1, 'Duplicate choice event');
  return { choiceEventsAtNode: choices.length, next: h.next() };
});

test('persisted-choice-lock', '待继续的选择在真实保存与恢复后仍锁定', () => {
  const h = createHarness(); walk(h, 'consent_reply'); h.pick('respect_decline');
  const saved = h.saved();
  assert(saved.choiceLock?.optionId === 'respect_decline' && saved.exitLock, 'Actual persist omitted lock');
  const restored = createHarness(saved); const priorEvents = restored.state.events.length;
  restored.goto(saved.node, { restoring: true }); restored.pick('reassure_without_guarantee');
  assert(restored.next() === 'decline_stop', 'Restored next changed');
  assert(restored.$('options').children.every(button => button.disabled), 'Restored options unlocked');
  assert(!restored.state.evidence.includes('consent'), 'Restored choice injected evidence');
  assert(restored.state.events.length === priorEvents, 'Restoration wrote a second node or choice event');
  return { persistedNext: saved.choiceLock.nextId, restoredNext: restored.next() };
});

test('immediate-safety-lock', '选中安全分支立即锁路线且可继续到安全结局', () => {
  const h = createHarness(); walk(h, 'safety'); h.pick('alternate_alert');
  assert(h.state.exitLock && h.state.exitReason === 'medical_stop', 'Safety lock delayed');
  const current = h.state.node; h.goto('local_intro'); assert(h.state.node === current, 'Physical task entered after alert');
  h.advance(); h.pick('medical_evaluation'); h.advance();
  assert(h.node().id === 'safe_finish', 'Medical route did not terminate safely');
  assert(!h.state.visited.some(id => ['alignment', 'gait_events', 'balance_trial'].includes(id)), 'Safety route performed physical tasks');
  return { exitReason: h.state.exitReason, terminal: h.node().id };
});

test('symptom-stop-route', '加载中不适分支退出剩余体能任务', () => {
  const h = createHarness(); walk(h, 'trial'); h.pick('pain_stop'); h.advance(); h.advance();
  assert(h.node().id === 'safe_finish' && h.state.exitLock, 'Symptom route did not stop');
  h.goto('gait_events'); assert(h.node().id === 'safe_finish', 'Stopped session resumed gait');
  assert(!h.state.evidence.includes('balance_record'), 'Unperformed balance was added');
  return { terminal: h.node().id, physicalContinuationBlocked: true };
});

test('normal-finish', '正常主线完成八幕与复盘后才到终结', () => {
  const h = createHarness(); const steps = walk(h, 'debrief');
  assert(!h.state.completedAt && h.next() === 'uncertainty', 'Debrief completed too early');
  const remaining = walk(h, 'finish');
  assert(!h.state.completedAt && h.node().terminal, 'Finish was pre-saved');
  h.complete();
  assert(h.state.completedAt && eventCount(h, 'clinic3d_learning_complete') === 1, 'Normal completion missing');
  assert(h.state.evidence.includes('local_record') && h.state.evidence.includes('uncertainty'), 'Expected actual-route evidence missing');
  return { terminal: h.node().id, transitions: steps + remaining, completeEvents: 1 };
});

test('completion-idempotent', '终结保存幂等，非终结不能保存为完成', () => {
  const h = createHarness(); h.goto('welcome'); h.complete();
  assert(!h.state.completedAt && !eventCount(h, 'clinic3d_learning_complete'), 'Non-terminal completed');
  walk(h, 'finish'); h.complete(); const time = h.state.completedAt; h.complete();
  assert(eventCount(h, 'clinic3d_learning_complete') === 1 && h.state.completedAt === time, 'Completion duplicated');
  const summaries = JSON.parse(h.storage.get('dxx_encounter_completed_v1') || '[]');
  assert(summaries.length === 1, 'Completion index duplicated');
  return { completeEvents: 1, summaryEntries: summaries.length };
});

test('completed-readonly-restore', '已完成记录恢复为终结并禁止改写证据', () => {
  const h = createHarness(); walk(h, 'finish'); h.complete(); const saved = h.saved();
  saved.node = 'history'; // Also tests normalization of an older inconsistent bookmark.
  const restored = createHarness(saved); restored.goto(saved.node, { restoring: true });
  assert(restored.node().id === 'finish', 'Completed bookmark not normalized');
  const evidence = JSON.stringify(restored.state.evidence); restored.goto('history'); restored.choose(content.FLOW.history.options[0], {});
  assert(restored.node().id === 'finish' && JSON.stringify(restored.state.evidence) === evidence, 'Completed evidence mutable');
  return { normalizedNode: restored.node().id, readOnly: true };
});

test('safe-completion-restore', '安全结局保存后保持安全终结与原停止原因', () => {
  const h = createHarness(); walk(h, 'consent_reply'); h.pick('respect_decline'); h.advance(); h.advance(); h.complete();
  const saved = h.saved(); saved.node = 'finish';
  const restored = createHarness(saved); restored.goto(saved.node, { restoring: true });
  assert(restored.node().id === 'safe_finish' && restored.state.exitReason === 'decline_stop', 'Safe outcome normalized into ordinary completion');
  assert(!restored.state.records.some(record => record.completion === 'teaching_route'), 'Safety case acquired ordinary route record');
  return { terminal: restored.node().id, exitReason: restored.state.exitReason };
});

test('pressure-gating', '足压静态与不足区间被拒，动态有效区间可通过', () => {
  const h = createHarness(); h.goto('pressure_compare');
  h.steps.set('region', '中足'); h.steps.set('observed', true); h.setPhaseMode(.4, 'static');
  assert(h.taskComplete() === false, 'Static pressure completed dynamic task');
  h.steps.set('dynamicMin', .2); h.steps.set('dynamicMax', .3); h.setPhaseMode(.3, 'dynamic');
  assert(h.taskComplete() === false, 'Too-short dynamic interval accepted');
  h.steps.set('dynamicMax', .4);
  assert(h.taskComplete() === true, 'Valid dynamic interval rejected');
  assert(h.state.taskReceipts.pressure_compare?.scope === 'teaching-operation-only', 'Task receipt claims clinical measurement');
  return { staticAccepted: false, shortDynamicAccepted: false, validDynamicAccepted: true };
});

test('task-guard', '量角器与步态任务未核对前不能取得对应操作证据', () => {
  const h = createHarness(); h.goto('alignment'); h.pick('alignment_checked');
  assert(!h.next() && !h.state.evidence.includes('alignment'), 'Goniometer task bypassed');
  satisfyTask(h); h.pick('alignment_checked'); assert(h.state.evidence.includes('alignment'), 'Completed landmark task blocked');
  const g = createHarness(); g.goto('gait_events'); g.steps.set('initial_contact', .9); g.steps.set('toe_off', .1); g.pick('events_done');
  assert(!g.next() && !g.state.evidence.includes('gait_events'), 'Incorrect event marks accepted');
  satisfyTask(g); g.pick('events_done'); assert(g.state.evidence.includes('gait_events'), 'Valid authored event marks blocked');
  return { incompleteLandmarksBlocked: true, incorrectEventMarksBlocked: true };
});

test('skip-local-plan-guard', '跳过局部检查不补写活动结果且不能据此选活动度方案', () => {
  const h = createHarness(); walk(h, 'plan', { tool: 'skip_contact' });
  assert(!h.state.evidence.includes('local_record') && !h.state.evidence.includes('alignment'), 'Skipped local test produced evidence');
  assert(h.state.records.some(record => record.localCheck === 'not_performed'), 'Skipped test not recorded');
  const before = eventCount(h, 'clinic3d_choice'); h.pick('mobility_recheck');
  assert(!h.next() && eventCount(h, 'clinic3d_choice') === before, 'Unsupported mobility plan committed');
  h.pick('complete_missing'); assert(h.next() === 'plan_patient', 'Reasonable missing-assessment alternative blocked');
  return { missingLocalEvidence: true, unsupportedPlanBlocked: true, alternativeAccepted: true };
});

test('progress-only-rail', '章节栏仅显示进度，不能重开互斥分支', () => {
  const h = createHarness(); h.goto('consent_reply'); h.drawRail();
  const buttons = h.$('chapterRail').children;
  assert(buttons.length === 9 && buttons.every(button => button.disabled), 'Progress rail contains enabled navigation');
  assert(buttons.filter(button => button.attributes['aria-current'] === 'step').length === 1, 'Current chapter not exposed accessibly');
  return { chapters: buttons.length, navigationEnabled: false };
});

const report = {
  schema: 'dxx-clinic-v14-flow-function-tests', generatedAt: new Date().toISOString(),
  passed: results.every(result => result.passed), total: results.length,
  passedCount: results.filter(result => result.passed).length,
  testedFiles: [
    { path: 'app.js', sha256: sha256(appSource) },
    { path: 'case-flow.js', sha256: sha256(flowSource) }
  ],
  actualFunctions: functionNames,
  testMethod: 'Extracted unchanged app control functions; in-memory DOM, localStorage and scene stubs. Exact content graph imported from case-flow.js. No browser, network, backend mutation or paid generation.',
  limits: ['Does not validate visual quality, collision, anatomy, motion accuracy, clinical validity, actual browser storage or backend delivery.', 'Task fixtures supply authored operation receipts; browser interaction requires separate verification.'],
  results
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ passed: report.passed, tests: report.total, passedCount: report.passedCount, reportPath, failures: results.filter(result => !result.passed) }, null, 2));
if (!report.passed) process.exitCode = 1;
