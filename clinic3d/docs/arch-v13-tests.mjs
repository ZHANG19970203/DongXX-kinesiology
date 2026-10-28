import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { ARCH_PROFILES, PRESSURE_DEFINITION, sampleStanding, sampleWalking, sampleMaximumPressure,
  archComparisonSummary, profileSummary, renderArchComparison, pressureColor } from '../pressure-engine.js';
const tests = [], test = (name, fn) => { fn(); tests.push({ name, passed: true }); };
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const mid = profile => profile.metrics.regions.find(region => region.id === 'midfoot');
const finiteCOP = cop => cop === null || Object.values(cop).every(Number.isFinite);

test('Three profiles preserve identical cell area, current total force and gait clock', () => {
  for (let i = 0; i <= 200; i++) {
    const phase = i / 100;
    const walking = ARCH_PROFILES.map(({ arch }) => sampleWalking(phase, { arch }));
    const standing = ARCH_PROFILES.map(({ arch }) => sampleStanding(phase, { arch }));
    for (const family of [walking, standing]) for (const frame of family) {
      near(frame.totalForce, family[0].totalForce);
      assert.ok(finiteCOP(frame.combinedCop));
      for (const foot of frame.feet) {
        const referenceFoot = family[0].feet.find(item => item.side === foot.side);
        near(foot.load, referenceFoot.load); near(foot.centre.x, referenceFoot.centre.x); near(foot.centre.z, referenceFoot.centre.z);
        assert.equal(foot.contact, referenceFoot.contact); assert.ok(finiteCOP(foot.copLocal));
        assert.ok(foot.cells.every(cell => cell.area === PRESSURE_DEFINITION.area && cell.force >= 0 && Number.isFinite(cell.pressure)));
        near(foot.cells.reduce((sum, cell) => sum + cell.force, 0), foot.load);
        if (!foot.contact) { near(foot.load, 0); assert.equal(foot.copLocal, null); }
      }
    }
  }
});
test('Low, reference and high arches have visible ordered midfoot contact under the same standing condition', () => {
  for (const phase of [0, .28, .5, .85, 1]) {
    const profiles = archComparisonSummary('static', phase).profiles;
    const typical = profiles[0], low = profiles[1], high = profiles[2];
    assert.ok(mid(low).contactAreaCm2 > mid(typical).contactAreaCm2 * 1.6);
    assert.ok(mid(high).contactAreaCm2 < mid(typical).contactAreaCm2 * .5);
    assert.ok(mid(low).loadFraction > mid(typical).loadFraction);
    assert.ok(mid(high).loadFraction < mid(typical).loadFraction);
    assert.ok(low.metrics.contactAreaCm2 > typical.metrics.contactAreaCm2);
    assert.ok(high.metrics.contactAreaCm2 < typical.metrics.contactAreaCm2);
  }
});
test('Dynamic comparison uses one specified foot at identical phase and does not fabricate swing COP', () => {
  for (const phase of [.02, .28, .54, .75, 1.1]) {
    const summary = archComparisonSummary('dynamic', phase);
    assert.equal(summary.side, 'right'); assert.equal(summary.relativeScale, .012);
    for (const profile of summary.profiles) {
      assert.equal(profile.foot.side, 'right'); assert.equal(profile.metrics.simultaneous, true);
      near(profile.metrics.totalForce, summary.profiles[0].metrics.totalForce);
      if (phase === .75) { assert.equal(profile.metrics.copLocal, null); near(profile.metrics.totalForce, 0); }
    }
  }
  const left = archComparisonSummary('dynamic', .28, { side: 'left' });
  assert.ok(left.profiles.every(profile => profile.foot.side === 'left'));
});
test('Area and instantaneous load percentages have explicit independent denominators and sum to one', () => {
  for (const mode of ['static', 'dynamic']) for (const profile of archComparisonSummary(mode, .28).profiles) {
    const metrics = profile.metrics;
    near(metrics.regions.reduce((sum, region) => sum + region.areaFraction, 0), 1);
    near(metrics.regions.reduce((sum, region) => sum + region.loadFraction, 0), 1);
    assert.ok(metrics.denominators.area.includes('同一时刻'));
    assert.ok(metrics.denominators.load.includes('该足全部格点'));
    assert.equal(metrics.contactThreshold, .012);
  }
  const fromFrame = profileSummary(sampleStanding(.28, { arch: 'high' }));
  near(fromFrame.totalForce, archComparisonSummary('static', .28).profiles[2].metrics.totalForce);
});
test('MPP remains non-simultaneous for all three arches: no current force fractions or COP', () => {
  const summary = archComparisonSummary('maximum', .28);
  for (const profile of summary.profiles) {
    const metrics = profile.metrics;
    assert.equal(profile.foot.simultaneous, false); assert.equal(metrics.simultaneous, false);
    assert.equal(metrics.totalForce, null); assert.equal(metrics.copLocal, null); assert.equal(metrics.denominators.load, null);
    assert.ok(metrics.regions.every(region => region.loadFraction === null));
    assert.equal(metrics.medialMidfoot.loadFraction, null);
    assert.ok(metrics.denominators.area.includes('非瞬时接触面积'));
    near(metrics.regions.reduce((sum, region) => sum + region.areaFraction, 0), 1);
    assert.ok(profile.foot.cells.every(cell => cell.force === undefined && cell.pressure >= 0));
  }
  assert.equal(sampleMaximumPressure({ arch: 'high' }).copWorld, null);
});
test('Comparison rendering shares one fixed colour legend and never plots COP on MPP', () => {
  const svg = { setAttribute() {}, innerHTML: '' };
  const staticSummary = renderArchComparison(svg, { mode: 'static', phase: .28 });
  assert.equal(staticSummary.profiles.length, 3);
  for (const label of ['正常足弓参考', '低足弓示例', '高足弓拓展', '同相位 / 同色标']) assert.ok(svg.innerHTML.includes(label));
  assert.equal((svg.innerHTML.match(/<circle /g) || []).length, 3);
  for (let i = 0; i < 32; i++) assert.ok(svg.innerHTML.includes(pressureColor(i / 31)));
  assert.ok((svg.innerHTML.match(/<path /g) || []).length <= 99);
  renderArchComparison(svg, { mode: 'maximum', phase: .28 });
  assert.ok(!svg.innerHTML.includes('<circle')); assert.ok(svg.innerHTML.includes('MPP不计算瞬时载荷或COP'));
  for (const phase of [0, 1]) {
    const boundary = renderArchComparison(svg, { mode: 'dynamic', phase });
    assert.ok(boundary.profiles.every(profile => profile.foot.contact && profile.metrics.totalForce === 0));
    assert.ok(svg.innerHTML.includes('刚接触 · 尚未承重/COP'));
    assert.ok(!svg.innerHTML.includes('离地 · 无接触载荷/COP'));
  }
  const swing = renderArchComparison(svg, { mode: 'dynamic', phase: .7 });
  assert.ok(swing.profiles.every(profile => !profile.foot.contact && profile.metrics.totalForce === 0));
  assert.ok(svg.innerHTML.includes('离地 · 无接触载荷/COP'));
  assert.ok(!svg.innerHTML.includes('刚接触 · 尚未承重/COP'));
});

const snapshots = ['static', 'dynamic', 'maximum'].map(mode => ({ mode, phase: .28,
  profiles: archComparisonSummary(mode, .28).profiles.map(profile => ({ arch: profile.arch, label: profile.label,
    currentTotalForce: profile.metrics.totalForce, contactAreaCm2: profile.metrics.contactAreaCm2,
    midfoot: mid(profile), medialMidfoot: profile.metrics.medialMidfoot })) }));
const result = { format: 'dxx-arch-comparison-v13-tests', passed: true, tests, snapshots,
  sourceType: PRESSURE_DEFINITION.sourceType, measured: false, clinicalValidation: false, checkedAt: new Date().toISOString() };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ passed: result.passed, tests: result.tests, measured: false, clinicalValidation: false }, null, 2));
