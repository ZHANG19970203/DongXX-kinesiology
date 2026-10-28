import assert from 'node:assert/strict';
import { GAIT_CASE, GAIT_EVENTS, sampleGait, gaitMetrics, gaitFootprints, isGaitEventMatch } from '../gait-lesson.js';

const close = (actual, expected, message, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);
const metrics = gaitMetrics();
let checks = 0;
const check = (name, fn) => { fn(); checks++; return name; };
const passed = [
  check('cyclic event marks include the next initial contact', () => {
    assert.equal(isGaitEventMatch(0, 0, .035), true);
    assert.equal(isGaitEventMatch(1, 0, .035), true);
    assert.equal(isGaitEventMatch(0, 1, 0), true);
    assert.equal(isGaitEventMatch(.99, 0, .035), true);
    assert.equal(isGaitEventMatch(.04, 0, .035), false);
    assert.equal(isGaitEventMatch(.56, .56, .035), true);
    assert.equal(isGaitEventMatch(.525, .56, .035), true);
    assert.equal(isGaitEventMatch(.524, .56, .035), false);
    assert.equal(isGaitEventMatch(0, .56, .035), false);
    for (const invalid of [NaN, Infinity, -Infinity, -1, 1.01, '0', undefined, null]) {
      assert.equal(isGaitEventMatch(invalid, 0, .035), false);
    }
    assert.equal(isGaitEventMatch(0, -1, .035), false);
    assert.equal(isGaitEventMatch(0, 0, -.035), false);
    assert.equal(isGaitEventMatch(0, 0, Infinity), false);
  }),
  check('spatial and temporal calculations', () => {
    close(GAIT_CASE.stepLength.right + GAIT_CASE.stepLength.left, GAIT_CASE.strideLength, 'step sum');
    close(metrics.speed, .7333333333333334, 'walking speed');
    close(metrics.cadence, 100, 'cadence');
    close(metrics.meanStepLength * metrics.cadence / 60, metrics.speed, 'speed relation');
    close(metrics.right.stanceSeconds, .672, 'right stance');
    close(metrics.left.stanceSeconds, .768, 'left stance');
    close(metrics.right.swingSeconds, .528, 'right swing');
    close(metrics.left.swingSeconds, .432, 'left swing');
    close(metrics.right.stepSeconds + metrics.left.stepSeconds, 1.2, 'two step times');
    close(metrics.doubleSupportSeconds, .24, 'double support');
  }),
  check('contact events and periods', () => {
    assert.equal(sampleGait(0).right.contact, true);
    assert.equal(sampleGait(.46).left.contact, true);
    assert.equal(sampleGait(.56).right.contact, false);
    assert.equal(sampleGait(.10).left.contact, false);
    assert.equal(sampleGait(.459).left.contact, false);
    assert.equal(sampleGait(.461).left.contact, true);
    assert.equal(sampleGait(.559).right.contact, true);
    assert.equal(sampleGait(.561).right.contact, false);
    assert.equal(sampleGait(.099).left.contact, true);
    assert.equal(sampleGait(.101).left.contact, false);
    assert.equal(sampleGait(.05).doubleSupport, true);
    assert.equal(sampleGait(.50).doubleSupport, true);
    assert.equal(sampleGait(.30).supportLabel, '右足单足支撑');
    assert.equal(sampleGait(.80).supportLabel, '左足单足支撑');
    for (const p of [0, .10, .46, .56, .99]) {
      for (const side of ['right', 'left']) {
        assert.equal(sampleGait(p)[side].contact, sampleGait(p + 1)[side].contact, `${side} contact +period`);
        assert.equal(sampleGait(p)[side].contact, sampleGait(p - 1)[side].contact, `${side} contact -period`);
      }
    }
    close(GAIT_EVENTS.find(e => e.side === 'right' && e.type === 'toe_off').phase, GAIT_CASE.stance.right, 'event metadata');
  }),
  check('full cycle has no flight and correct contact durations', () => {
    let right = 0, left = 0, both = 0;
    const count = 10000;
    for (let i = 0; i < count; i++) {
      const sample = sampleGait((i + .5) / count);
      assert.ok(sample.right.contact || sample.left.contact, `flight at ${i}`);
      right += Number(sample.right.contact); left += Number(sample.left.contact); both += Number(sample.doubleSupport);
    }
    close(right / count, .56, 'right stance fraction');
    close(left / count, .64, 'left stance fraction');
    close(both / count, .20, 'double support fraction');
  }),
  check('cyclic foot and body-reference positions', () => {
    for (const p of [0, .04, .22, .46, .61, .97]) {
      const a = sampleGait(p), b = sampleGait(p + 1), c = sampleGait(p - 1);
      for (const side of ['right', 'left']) {
        for (const axis of ['forward', 'lateral', 'height']) {
          close(a[side].foot[axis], b[side].foot[axis], `+period ${side}/${axis}`);
          close(a[side].foot[axis], c[side].foot[axis], `-period ${side}/${axis}`);
        }
      }
      close(a.reference.lateral, b.reference.lateral, 'reference lateral period');
      close(a.reference.vertical, b.reference.vertical, 'reference vertical period');
      assert.equal(a.reference.kind, 'pelvis_proxy');
      assert.equal(a.reference.measured, false);
    }
  }),
  check('stationary stance footprints and continuous swing', () => {
    for (const [side, phases] of [['right', [.01, .2, .55]], ['left', [.47, .7, .99]]]) {
      const target = sampleGait(phases[0])[side].footprintForward;
      for (const p of phases) {
        const sample = sampleGait(p);
        close(sample[side].foot.forward + sample.reference.forward, target, `${side} no slide`);
        close(sample[side].foot.height, 0, `${side} stance on floor`);
      }
    }
    const e = 1e-7;
    for (const [side, event] of [['right', .56], ['left', .10], ['left', .46]]) {
      close(sampleGait(event - e)[side].foot.forward, sampleGait(event + e)[side].foot.forward, `${side} continuity`, 1e-5);
      close(sampleGait(event - e)[side].foot.height, sampleGait(event + e)[side].foot.height, `${side} floor transition`, 1e-5);
    }
    close(sampleGait(1 - e).right.foot.forward, sampleGait(e).right.foot.forward, 'right wrap continuity', 1e-5);
  }),
  check('footprint distances and step times match labels', () => {
    const prints = gaitFootprints(3);
    for (let i = 1; i < prints.length; i++) {
      const previous = prints[i - 1], current = prints[i];
      close(current.forward - previous.forward, GAIT_CASE.stepLength[current.side], `${current.side} named step`);
      close(Math.abs(current.lateral - previous.lateral), GAIT_CASE.stepWidth, 'step width');
      close(current.timeSeconds - previous.timeSeconds, metrics[current.side].stepSeconds, `${current.side} step time`);
      if (i >= 2) close(current.forward - prints[i - 2].forward, GAIT_CASE.strideLength, 'same foot stride');
    }
  }),
  check('invalid input rejected', () => {
    assert.throws(() => sampleGait(NaN), TypeError);
    assert.throws(() => sampleGait(Infinity), TypeError);
    assert.throws(() => gaitFootprints(0), RangeError);
  })
];
process.stdout.write(JSON.stringify({ passed: true, checks, tests: passed, metrics, sourceType: GAIT_CASE.sourceType }, null, 2) + '\n');
