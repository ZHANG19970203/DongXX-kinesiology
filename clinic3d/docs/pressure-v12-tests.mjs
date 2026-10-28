// Meaningful numerical invariants for the original synthetic pressure engine.
// Run: node docs/pressure-v12-tests.mjs [optional-result-json]
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { sampleStanding, sampleWalking, sampleMaximumPressure, pressureCOP, renderPressureDiagram } from '../pressure-engine.js';
import { sampleGait, GAIT_CASE } from '../gait-lesson.js';
const checks = [], check = (name, fn) => { fn(); checks.push({ name, passed: true }); };
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

check('COP is force weighted rather than an unweighted average; zero load is null', () => {
  const cop = pressureCOP([{ lateral: 0, forward: 0, force: 1 }, { lateral: .1, forward: .2, force: 3 }]);
  close(cop.lateral, .075); close(cop.forward, .15);
  assert.equal(pressureCOP([{ lateral: 50, forward: -50, force: 0 }]), null);
  assert.throws(() => pressureCOP([{ force: -1 }]), RangeError);
});
check('Across three walking cycles: forces non-negative, conserved; swing COP is null', () => {
  for (let i = 0; i <= 360; i++) {
    const frame = sampleWalking(i / 120);
    close(frame.totalForce, 1);
    for (const foot of frame.feet) {
      assert.ok(foot.cells.every(cell => Number.isFinite(cell.force) && cell.force >= 0 && cell.pressure >= 0));
      close(foot.cells.reduce((sum, cell) => sum + cell.force, 0), foot.load);
      if (!foot.contact) { close(foot.load, 0); assert.equal(foot.copLocal, null); assert.equal(foot.copWorld, null); }
    }
    const loaded = frame.feet.filter(foot => foot.load > 1e-12);
    const manualX = loaded.reduce((sum, foot) => sum + foot.copWorld.x * foot.load, 0) / frame.totalForce;
    const manualZ = loaded.reduce((sum, foot) => sum + foot.copWorld.z * foot.load, 0) / frame.totalForce;
    close(frame.combinedCop.x, manualX); close(frame.combinedCop.z, manualZ);
    assert.ok(frame.combinedCop.x >= Math.min(...loaded.map(f => f.copWorld.x)) - 1e-10);
    assert.ok(frame.combinedCop.x <= Math.max(...loaded.map(f => f.copWorld.x)) + 1e-10);
    assert.ok(frame.combinedCop.z >= Math.min(...loaded.map(f => f.copWorld.z)) - 1e-10);
    assert.ok(frame.combinedCop.z <= Math.max(...loaded.map(f => f.copWorld.z)) + 1e-10);
  }
});
check('Stance anchors fixed on walkway; absolute cycles advance one stride without teleporting support foot', () => {
  const a = sampleWalking(.13).feet.find(f => f.side === 'right'), b = sampleWalking(.37).feet.find(f => f.side === 'right');
  close(a.centre.x, b.centre.x); close(a.centre.z, b.centre.z);
  const c = sampleWalking(1.13).feet.find(f => f.side === 'right');
  close(a.centre.z - c.centre.z, .88);
  const before = sampleWalking(.999999).feet.find(f => f.side === 'left');
  const after = sampleWalking(1.000001).feet.find(f => f.side === 'left');
  close(before.centre.z, after.centre.z); close(before.centre.x, after.centre.x);
});
check('Pressure foot anchors match actor local targets rotated by root yaw pi, on the correct side', () => {
  const origin = { x: -.1, z: 1.45 };
  for (let i = 0; i <= 240; i++) {
    const cycle = i / 120, gait = sampleGait(cycle), frame = sampleWalking(cycle, { origin });
    for (const foot of frame.feet) {
      const local = { x: -gait[foot.side].foot.lateral, z: gait[foot.side].foot.forward };
      const actorX = origin.x + Math.cos(Math.PI) * local.x + Math.sin(Math.PI) * local.z;
      const actorZ = origin.z - cycle * GAIT_CASE.strideLength - Math.sin(Math.PI) * local.x + Math.cos(Math.PI) * local.z;
      close(foot.centre.x, actorX); close(foot.centre.z, actorZ);
      // Medial hallux must point toward the other foot after world rotation.
      const medialToe = foot.cells.find(cell => cell.medial > .025 && cell.forward > .19);
      assert.ok(foot.side === 'right' ? medialToe.world.x < foot.centre.x : medialToe.world.x > foot.centre.x);
    }
  }
});
check('During same foot contact COP moves from heel region toward forefoot; lifted foot has no trace point', () => {
  const heel = sampleWalking(.02).feet.find(f => f.side === 'right');
  const fore = sampleWalking(.54).feet.find(f => f.side === 'right');
  assert.ok(heel.copLocal.forward < .035);
  assert.ok(fore.copLocal.forward > .145);
  assert.ok(fore.copLocal.forward - heel.copLocal.forward > .11);
  assert.equal(sampleWalking(.7).feet.find(f => f.side === 'right').copLocal, null);
});
check('Static feet do not walk; COP stays in a small region instead of a heel-to-toe gait trajectory', () => {
  const start = sampleStanding(0), points = [];
  for (let i = 0; i <= 100; i++) {
    const frame = sampleStanding(i / 100); points.push(frame.combinedCop);
    close(frame.totalForce, 1);
    for (let j = 0; j < 2; j++) {
      close(frame.feet[j].centre.x, start.feet[j].centre.x); close(frame.feet[j].centre.z, start.feet[j].centre.z);
    }
  }
  const span = axis => Math.max(...points.map(p => p[axis])) - Math.min(...points.map(p => p[axis]));
  assert.ok(span('x') > .0001 && span('x') < .020);
  assert.ok(span('z') > .0001 && span('z') < .020);
});
check('Custom standing foot anchors align the map to actual actor foot bones', () => {
  const centres = { left: { x: .21, z: -.037 }, right: { x: -.19, z: .018 } };
  const frame = sampleStanding(.4, { centres });
  for (const foot of frame.feet) {
    close(foot.centre.x, centres[foot.side].x); close(foot.centre.z, centres[foot.side].z);
    const first = foot.cells[0];
    close(first.world.x, centres[foot.side].x + first.lateral);
    close(first.world.z, centres[foot.side].z - first.forward);
  }
});
check('Low arch illustration broadens midfoot contact; five toes and heel retain distinct original geometry', () => {
  const low = sampleStanding(.2, { arch: 'low' }).feet[1], typical = sampleStanding(.2, { arch: 'typical' }).feet[1];
  const medialMid = cells => cells.filter(cell => cell.medial > .005 && cell.forward > .035 && cell.forward < .115);
  assert.ok(medialMid(low.cells).length > medialMid(typical.cells).length * 1.5);
  const force = cells => cells.reduce((sum, cell) => sum + cell.force, 0);
  assert.ok(force(medialMid(low.cells)) > force(medialMid(typical.cells)));
  assert.ok(low.cells.some(c => c.forward < -.04)); assert.ok(low.cells.some(c => c.forward > .21));
  assert.ok(low.cells.some(c => c.medial > .025 && c.forward > .19));
  assert.ok(low.cells.some(c => c.medial < -.025 && c.forward > .17));
});
check('MPP explicitly non-simultaneous, no fake total force or COP; never confused with instantaneous frame', () => {
  const peak = sampleMaximumPressure({ side: 'right', arch: 'low' });
  assert.equal(peak.simultaneous, false); assert.equal(peak.copLocal, null); assert.equal(peak.copWorld, null);
  assert.equal(peak.totalForce, undefined); assert.ok(peak.cells.every(c => c.force === undefined));
  for (const cycle of [.02, .13, .3, .5]) {
    const foot = sampleWalking(cycle).feet.find(f => f.side === 'right');
    const max = new Map(peak.cells.map(c => [c.key, c.pressure]));
    assert.ok(foot.cells.every(c => c.pressure <= max.get(c.key) + .003));
  }
});
check('SVG mode labels separate stance/instantaneous/MPP; cellular fill batched into paths', () => {
  const svg = { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, innerHTML: '' };
  renderPressureDiagram(svg, { mode: 'static', phase: .8 });
  assert.ok(svg.innerHTML.includes('COP微小摆动')); assert.ok(!svg.innerHTML.includes('本次接触轨迹'));
  assert.ok((svg.innerHTML.match(/<path /g) || []).length < 70);
  renderPressureDiagram(svg, { mode: 'maximum', phase: .8 });
  assert.ok(svg.innerHTML.includes('不计算COP')); assert.ok(!svg.innerHTML.includes('<circle'));
  renderPressureDiagram(svg, { mode: 'dynamic', phase: .7 });
  assert.ok(svg.innerHTML.includes('离地 · 无COP')); assert.ok(svg.innerHTML.includes('本次接触轨迹'));
  assert.ok((svg.innerHTML.match(/<path /g) || []).length < 70);
});

const result = { suite: 'pressure-v12-numerical-invariants', passed: true, checks,
  syntheticData: true, clinicalValidation: false, checkedAt: new Date().toISOString() };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
