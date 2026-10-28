// The exported reference profile can be imported without calling DOM functions.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { GAIT_REFERENCE } from '../arch-comparison.js';
import { GAIT_CASE, sampleGait, gaitMetrics, gaitFootprints } from '../gait-lesson.js';
import { archComparisonSummary } from '../pressure-engine.js';
const tests = [], test = (name, fn) => { fn(); tests.push({ name, passed: true }); };
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const beforeCase = JSON.stringify(GAIT_CASE), reference = gaitMetrics(GAIT_REFERENCE), patient = gaitMetrics(GAIT_CASE);

test('Importing the reference requires no document or UI initialization', () => {
  assert.equal(typeof document, 'undefined');
  assert.ok(Object.isFrozen(GAIT_REFERENCE)); assert.ok(Object.isFrozen(GAIT_REFERENCE.stance));
  assert.ok(Object.isFrozen(GAIT_REFERENCE.stepLength));
  assert.equal(GAIT_REFERENCE.affectedSide, null);
  assert.equal(GAIT_REFERENCE.sourceType, 'authored_controlled_reference');
});
test('44 cm symmetric steps produce an 88 cm stride, common 1.20 s cycle and equal speed/cadence', () => {
  near(GAIT_REFERENCE.stepLength.right, .44); near(GAIT_REFERENCE.stepLength.left, .44);
  near(reference.strideLength, .88); near(reference.cycleSeconds, 1.2);
  near(GAIT_REFERENCE.stepLength.right + GAIT_REFERENCE.stepLength.left, reference.strideLength);
  near(reference.speed, .88 / 1.2); near(reference.speed, GAIT_REFERENCE.speed);
  near(reference.speed, patient.speed); near(reference.cadence, 100); near(reference.cadence, patient.cadence);
  near(reference.stepWidth, .14);
});
test('Reference stance and swing durations are symmetric 60/40 and contact occurs half a cycle apart', () => {
  for (const side of ['right', 'left']) { near(reference[side].stanceSeconds, .72); near(reference[side].swingSeconds, .48); near(reference[side].stepSeconds, .6); }
  near(GAIT_REFERENCE.leftContactPhase, .5); near(reference.doubleSupportFraction, .2); near(reference.doubleSupportSeconds, .24);
  let rightContactSamples = 0, leftContactSamples = 0;
  for (let i = 0; i < 1000; i++) {
    const phase = i / 1000, a = sampleGait(phase, GAIT_REFERENCE), b = sampleGait((phase + .5) % 1, GAIT_REFERENCE);
    rightContactSamples += Number(a.right.contact); leftContactSamples += Number(a.left.contact);
    assert.equal(a.right.contact, b.left.contact);
  }
  assert.equal(rightContactSamples, 600); assert.equal(leftContactSamples, 600);
});
test('At phase 58% the reference right foot is still in stance while the authored patient right foot swings', () => {
  const ref = sampleGait(.58, GAIT_REFERENCE), patient = sampleGait(.58, GAIT_CASE);
  assert.equal(ref.right.contact, true); assert.equal(patient.right.contact, false);
  assert.equal(ref.left.contact, true); assert.equal(patient.left.contact, true);
  near(ref.timeSeconds, patient.timeSeconds); near(ref.timeSeconds, .696);
});
test('Reference landing footprints agree with displayed 44/44 cm and fixed world stance anchors', () => {
  const footprints = gaitFootprints(2, GAIT_REFERENCE);
  for (let i = 1; i < footprints.length; i++) near(footprints[i].forward - footprints[i - 1].forward, .44);
  const worldForward = (phase, side) => phase * .88 + sampleGait(phase, GAIT_REFERENCE)[side].foot.forward;
  near(worldForward(.2, 'right'), worldForward(.4, 'right'));
  near(worldForward(.7, 'left'), worldForward(.9, 'left'));
});
test('Independent comparison samples do not mutate patient profile or change its contact clock', () => {
  for (const mode of ['static', 'dynamic', 'maximum']) for (const phase of [0, .28, .58, 1]) archComparisonSummary(mode, phase);
  assert.equal(JSON.stringify(GAIT_CASE), beforeCase);
  assert.equal(sampleGait(.58).right.contact, false);
  assert.equal(archComparisonSummary('dynamic', .58).profiles[0].foot.contact, false);
});

const result = { format: 'dxx-arch-independent-integration-tests-v13', passed: true, tests,
  referenceMetrics: reference, patientMetrics: patient, staticDOMFunctionsCalled: false,
  clinicalValidation: false, checkedAt: new Date().toISOString() };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ passed: result.passed, tests: result.tests, staticDOMFunctionsCalled: false }, null, 2));
