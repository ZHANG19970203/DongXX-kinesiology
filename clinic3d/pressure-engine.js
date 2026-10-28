// Original teaching illustration. No patient measurement, device calibration,
// diagnostic cutoff, clinical normal range, or reproduced manufacturer image.
import { GAIT_CASE, sampleGait } from './gait-lesson.js';

export const PRESSURE_DEFINITION = Object.freeze({
  sourceType: 'authored_synthetic_teaching_data', measured: false,
  cellSize: .005, area: .005 * .005, relativeScale: .012,
  coordinates: 'metres; lateral is the subject\'s right; forward is the walking direction',
  staticMeaning: '同一时刻的站立分布；小范围轨迹为足底压力中心COP，不是身体重心。',
  dynamicMeaning: '同一时刻的接触足分布；离地足无接触载荷，也没有COP。',
  maximumMeaning: '逐个位置取整个接触期的最大值；各处峰值可能来自不同时刻。',
  limitations: [
    '低足弓示例仅把内侧中足接触范围与载荷增加，不能用图像单独诊断扁平足。',
    '高足弓拓展为较少中足接触的一种假设；不能据此规定所有高足弓的COP方向、疼痛或踝不稳结果。',
    '相对颜色与合成载荷用于解释概念，不能当成kPa、实测体重百分比或设备报告。',
    '静态COP轨迹、行走足内COP轨迹和全身质心是不同的量。',
    '峰值合成图不计算COP；不能把来自不同时刻的峰值加权为某一时刻的COP。'
  ]
});

export const ARCH_PROFILES = Object.freeze([
  Object.freeze({ arch: 'typical', label: '正常足弓参考', note: '原创参考条件，不是正常值阈值' }),
  Object.freeze({ arch: 'low', label: '低足弓示例', note: '内侧中足接触较多的一种示例' }),
  Object.freeze({ arch: 'high', label: '高足弓拓展', note: '中足接触较少的一种示例' })
]);

const clamp = value => Math.max(0, Math.min(1, value));
const mod1 = value => { const p = value % 1; return p < 0 ? p + 1 : p; };
const gauss = (value, centre, width) => Math.exp(-.5 * ((value - centre) / width) ** 2);
const ellipse = (m, y, cm, cy, rx, ry) => ((m - cm) / rx) ** 2 + ((y - cy) / ry) ** 2;
const cache = new Map(), maximumCache = new Map(), traceCache = new Map();
const S = PRESSURE_DEFINITION.cellSize;

// An original cellular sole outline: heel, lateral border, arch, metatarsal pad,
// and five individually separated toes. Medial m is reflected for the two feet.
function sole(side, arch = 'low') {
  if (!ARCH_PROFILES.some(profile => profile.arch === arch)) throw new RangeError('arch must be typical, low or high');
  const key = side + ':' + arch;
  if (cache.has(key)) return cache.get(key);
  const result = [], mirror = side === 'right' ? -1 : 1;
  for (let row = 0; row < 57; row++) for (let col = 0; col < 21; col++) {
    const forward = -.060 + (row + .5) * S, medial = -.0525 + (col + .5) * S;
    const heel = ellipse(medial, forward, -.003, -.017, .027, .041);
    const lateral = ellipse(medial, forward, arch === 'high' ? -.032 : -.023, .066,
      arch === 'high' ? .010 : .020, arch === 'high' ? .064 : .066);
    const archArea = ellipse(medial, forward, arch === 'low' ? .004 : arch === 'high' ? -.035 : -.017, .076,
      arch === 'low' ? .033 : arch === 'high' ? .008 : .014, arch === 'high' ? .042 : .059);
    const fore = ellipse(medial, forward, 0, .141, .049, .035);
    const toes = [
      [.034, .198, .014, .022], [.012, .204, .0095, .016],
      [-.007, .195, .0085, .014], [-.024, .182, .0075, .013],
      [-.038, .167, .007, .011]
    ];
    const toe = Math.min(...toes.map(t => ellipse(medial, forward, ...t)));
    if (Math.min(heel, lateral, archArea, fore, toe) > 1) continue;
    result.push(Object.freeze({ key: row * 21 + col, row, col, medial,
      lateral: mirror * medial, forward, area: S * S,
      heel: gauss(medial, -.003, arch === 'high' ? .017 : .021) * gauss(forward, -.017, .028),
      mid: gauss(medial, arch === 'low' ? .005 : arch === 'high' ? -.033 : -.025,
        arch === 'low' ? .026 : arch === 'high' ? .009 : .015) * gauss(forward, .072, .043),
      fore: gauss(forward, .143, .021) * (arch === 'high' ?
        .85 * gauss(medial, .030, .013) + .92 * gauss(medial, .004, .014) + 1.18 * gauss(medial, -.029, .012) :
        1.0 * gauss(medial, .030, .016) + 1.2 * gauss(medial, .004, .016) + .65 * gauss(medial, -.026, .016)),
      toe: toes.reduce((sum, t, i) => sum + (i === 0 ? 1 : .27) *
        gauss(medial, t[0], t[2] * .7) * gauss(forward, t[1], t[3] * .7), 0)
    }));
  }
  cache.set(key, Object.freeze(result)); return result;
}

function rawCell(cell, stage, arch, standing = false, sway = { medial: 0, forward: 0 }) {
  if (standing) {
    const base = (arch === 'high' ? 1.15 : .95) * cell.heel + (arch === 'high' ? 1.02 : .78) * cell.fore + .13 * cell.toe +
      (arch === 'low' ? .43 : arch === 'high' ? .035 : .12) * cell.mid;
    // A bounded, smooth redistribution of current contact loads. Never a gait
    // heel-to-toe curve, and never an assumed whole-body centre of mass.
    return base * Math.exp(sway.medial * cell.medial / .04 + sway.forward * (cell.forward - .075) / .14);
  }
  return 1.5 * gauss(stage, .12, .16) * cell.heel +
    (arch === 'low' ? .65 : arch === 'high' ? .055 : .24) * gauss(stage, .43, .25) * cell.mid +
    1.7 * gauss(stage, .69, .24) * cell.fore +
    1.4 * gauss(stage, .91, .14) * cell.toe;
}

/** Force weighted COP of the CURRENT non-negative cells; null at zero load. */
export function pressureCOP(cells, world = false) {
  let force = 0, first = 0, second = 0;
  for (const cell of cells) {
    if (!Number.isFinite(cell.force) || cell.force < 0) throw new RangeError('Contact forces must be finite and non-negative');
    force += cell.force;
    first += cell.force * (world ? cell.world.x : cell.lateral);
    second += cell.force * (world ? cell.world.z : cell.forward);
  }
  if (force <= 1e-12) return null;
  return world ? { x: first / force, z: second / force } : { lateral: first / force, forward: second / force };
}

function frameFoot({ side, arch, contact, load, progress = 0, centre, standing = false, sway, footForward = 0 }) {
  const source = sole(side, arch), raw = source.map(cell => contact ? rawCell(cell, progress, arch, standing, sway) : 0);
  const total = raw.reduce((sum, value) => sum + value, 0), ratio = total > 0 ? load / total : 0;
  const cells = source.map((cell, i) => {
    const force = raw[i] * ratio;
    return { key: cell.key, lateral: cell.lateral, medial: cell.medial, forward: cell.forward,
      area: cell.area, force, pressure: force / PRESSURE_DEFINITION.relativeScale,
      world: { x: centre.x + cell.lateral, z: centre.z - cell.forward } };
  });
  return { side, arch, contact, load: total > 0 ? load : 0, stanceProgress: contact ? progress : null,
    centre: { ...centre }, footForward, cells, copLocal: pressureCOP(cells), copWorld: pressureCOP(cells, true) };
}

function completeFrame(kind, phase, feet, extra = {}) {
  const cells = feet.flatMap(foot => foot.cells);
  return { kind, sourceType: PRESSURE_DEFINITION.sourceType, measured: false, phase,
    feet, cells, totalForce: feet.reduce((sum, foot) => sum + foot.load, 0),
    combinedCop: pressureCOP(cells, true), ...extra };
}

/** Stationary bilateral stance; input 0..1 depicts an authored eight-second interval.
 * The feet stay still while the pressure-weighted COP makes a small bounded sway.
 */
export function sampleStanding(time01 = 0, options = {}) {
  if (!Number.isFinite(time01)) throw new TypeError('Standing time must be finite');
  const t = time01, arch = options.arch || 'low';
  const origin = options.origin || { x: -.1, z: 1.05 };
  const sway = { medial: .09 * Math.sin(2 * Math.PI * 1.3 * t) + .035 * Math.sin(2 * Math.PI * 3.1 * t),
    forward: .11 * Math.sin(2 * Math.PI * 1.7 * t + .2) + .025 * Math.sin(2 * Math.PI * 4.3 * t) };
  const rightLoad = .5 + .018 * Math.sin(2 * Math.PI * 1.1 * t);
  const feet = ['left', 'right'].map(side => {
    const lateral = (side === 'right' ? 1 : -1) * (options.stepWidth || .14) / 2;
    return frameFoot({ side, arch, contact: true, load: side === 'right' ? rightLoad : 1 - rightLoad,
      centre: options.centres?.[side] || { x: origin.x + lateral, z: origin.z }, standing: true,
      sway: { ...sway, medial: sway.medial * (side === 'right' ? -1 : 1) } });
  });
  return completeFrame('static_instantaneous', t, feet, { timeSeconds: 8 * t, copKind: 'standing_cop', origin });
}

/** Absolute cycles preserve forward progression over several walkway plates.
 * Root and actor must advance by absoluteCycle * profile.strideLength together.
 * Displayed pressure is synthetic; current swing feet always carry zero load.
 */
export function sampleWalking(absoluteCycle = 0, options = {}) {
  if (!Number.isFinite(absoluteCycle)) throw new TypeError('Walking cycle must be finite');
  const profile = options.profile || GAIT_CASE, gait = sampleGait(absoluteCycle, profile);
  const cycle = Math.floor(absoluteCycle), origin = options.origin || { x: -.1, z: 1.45 };
  const arch = options.arch || 'low';
  const weights = ['left', 'right'].map(side => gait[side].contact ? Math.sin(Math.PI * gait[side].stageProgress) ** .65 : 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  const feet = ['left', 'right'].map((side, i) => {
    const data = gait[side], forward = data.footprintForward + cycle * profile.strideLength;
    return frameFoot({ side, arch, contact: data.contact, load: sum > 1e-12 ? weights[i] / sum : 0,
      progress: data.stageProgress, footForward: forward,
      centre: { x: origin.x + data.foot.lateral, z: origin.z - forward } });
  });
  return completeFrame('walking_instantaneous', absoluteCycle, feet, { gait,
    timeSeconds: absoluteCycle * profile.cycleSeconds, copKind: 'walking_cop', origin });
}

/** Per-cell peak over one stance. There is intentionally NO COP: these peaks
 * were not simultaneous loads. The result must not enter instantaneous sums.
 */
export function sampleMaximumPressure(options = {}) {
  const arch = options.arch || 'low', side = options.side || 'right';
  const key = arch + ':' + side;
  if (maximumCache.has(key)) return maximumCache.get(key);
  const cells = sole(side, arch).map(cell => ({ key: cell.key, lateral: cell.lateral,
    medial: cell.medial, forward: cell.forward, area: cell.area, pressure: 0 }));
  for (let i = 0; i <= 100; i++) {
    const raw = sole(side, arch).map(cell => rawCell(cell, i / 100, arch));
    const sum = raw.reduce((a, b) => a + b, 0);
    for (let j = 0; j < cells.length; j++) cells[j].pressure = Math.max(cells[j].pressure,
      raw[j] / sum / PRESSURE_DEFINITION.relativeScale);
  }
  const result = Object.freeze({ kind: 'maximum_pressure_picture', arch, side, sourceType: PRESSURE_DEFINITION.sourceType,
    measured: false, cells: Object.freeze(cells.map(Object.freeze)), copLocal: null, copWorld: null, simultaneous: false });
  maximumCache.set(key, result); return result;
}

export function pressureColor(value) {
  if (!(value > .002)) return '#dbe5e8';
  const stops = [[25, 62, 166], [0, 153, 218], [0, 186, 145], [160, 213, 37], [255, 220, 26], [247, 117, 20], [211, 39, 39]];
  const p = clamp(value) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(p)), t = p - i;
  return 'rgb(' + stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * t)).join(',') + ')';
}

const esc = value => String(value).replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
const text = (x, y, value, extra = '') => `<text x="${x}" y="${y}" ${extra.includes('fill=') ? '' : 'fill="#24464b"'} ${extra.includes('font-size=') ? '' : 'font-size="10"'} ${extra}>${esc(value)}</text>`;
function pathCells(cells, map) {
  const bins = Array.from({ length: 33 }, () => '');
  for (const cell of cells) {
    const bin = cell.pressure > .002 ? 1 + Math.min(31, Math.floor(clamp(cell.pressure) * 31)) : 0;
    const p = map(cell), size = S * map.scale * .94;
    bins[bin] += `M${(p.x - size / 2).toFixed(2)},${(p.y - size / 2).toFixed(2)}h${size.toFixed(2)}v${size.toFixed(2)}h-${size.toFixed(2)}z`;
  }
  return bins.map((d, i) => d ? `<path d="${d}" fill="${i ? pressureColor((i - .5) / 32) : '#e4ebed'}"/>` : '').join('');
}
function mark(point, map, radius = 3.6) {
  if (!point) return '';
  const p = map(point); return `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${radius}" fill="#18394e" stroke="#fff" stroke-width="1.5"/>`;
}
function trace(points, map, color = '#fff') {
  if (points.length < 2) return '';
  return `<polyline points="${points.map(point => { const p = map(point); return p.x.toFixed(2) + ',' + p.y.toFixed(2); }).join(' ')}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/>`;
}

function localStanceTrace(side, arch) {
  const key = 'walking:' + side + ':' + arch;
  if (!traceCache.has(key)) {
    const result = [];
    for (let i = 1; i < 41; i++) {
      const p = i / 40, frame = frameFoot({ side, arch, contact: true, load: 1, progress: p, centre: { x: 0, z: 0 } });
      if (frame.copLocal) result.push({ progress: p, ...frame.copLocal });
    }
    traceCache.set(key, result);
  }
  return traceCache.get(key);
}
function standingTrace(arch, options = {}) {
  const origin = options.origin || { x: -.1, z: 1.05 }, width = options.stepWidth || .14;
  const left = options.centres?.left || { x: origin.x - width / 2, z: origin.z };
  const right = options.centres?.right || { x: origin.x + width / 2, z: origin.z };
  const delta = { x: Number((right.x - left.x).toFixed(5)), z: Number((right.z - left.z).toFixed(5)) };
  const key = 'standing:' + arch + ':' + delta.x + ':' + delta.z;
  if (!traceCache.has(key)) {
    const sampleOptions = { arch, centres: { left: { x: 0, z: 0 }, right: delta } };
    const origin = sampleStanding(0, sampleOptions).combinedCop, result = [];
    for (let i = 0; i <= 80; i++) {
      const p = i / 80, point = sampleStanding(p, sampleOptions).combinedCop;
      result.push({ progress: p, lateral: point.x - origin.x, forward: origin.z - point.z });
    }
    traceCache.set(key, result);
  }
  return traceCache.get(key);
}

/** Original SVG pressure diagram. Batches cells into <=33 paths per foot, so
 * playback does not create thousands of live DOM elements every frame.
 * mode: static, dynamic, maximum (or mpp). It returns the same sampled frame.
 */
export function renderPressureDiagram(svg, options = {}) {
  if (!svg || typeof svg.setAttribute !== 'function') throw new TypeError('An SVG element is required');
  const width = options.width || 360, height = options.height || 290;
  const phase = Number.isFinite(options.phase) ? options.phase : 0;
  const mode = options.mode === 'mpp' ? 'maximum' : options.mode || 'static', arch = options.arch || 'low';
  const maximum = mode === 'maximum';
  const frame = maximum ? { kind: 'maximum_pressure_picture', sourceType: PRESSURE_DEFINITION.sourceType,
    measured: false, feet: ['left', 'right'].map(side => sampleMaximumPressure({ side, arch })), combinedCop: null } :
    mode === 'dynamic' ? sampleWalking(phase, options) : sampleStanding(phase, options);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', maximum ? '逐点峰值合成足底压力教学图，无瞬时COP' :
    mode === 'dynamic' ? '当前行走时刻的足底分布和压力中心' : '静态站立足底分布与小范围COP轨迹');
  const scale = Math.min(530, (height - 125) / .285), centreY = 65 + .22 * scale;
  let html = `<rect width="${width}" height="${height}" rx="10" fill="#f4f8f8"/>`;
  html += text(12, 19, maximum ? '逐点峰值合成图 · MPP' : mode === 'dynamic' ? '当前一帧 · 行走接触' : '静态站立 · 当前一帧', 'font-weight="700"');
  for (const [i, foot] of frame.feet.entries()) {
    const x = width * (i ? .70 : .30);
    const map = point => ({ x: x + point.lateral * scale, y: centreY - point.forward * scale }); map.scale = scale;
    html += text(x, 39, foot.side === 'left' ? '左足' : '右足', 'text-anchor="middle"');
    html += pathCells(foot.cells, map);
    if (!maximum && options.showTrace !== false && foot.copLocal) {
      const points = [];
      if (mode === 'dynamic') {
        const progress = foot.stanceProgress;
        if (progress !== null) points.push(...localStanceTrace(foot.side, arch).filter(point => point.progress < progress));
        points.push(foot.copLocal); html += trace(points, map);
      }
      html += mark(foot.copLocal, map);
    }
    if (!maximum && mode === 'dynamic') html += text(x, height - 66,
      foot.contact ? foot.load > .00001 ? '接触' : '刚接触 · 正在承重' : '离地 · 无COP', 'text-anchor="middle"');
  }
  if (mode === 'static') {
    // Bilateral COP stabilogram in local millimetres. This is a separate
    // standing view, not a curved heel-to-toe gait line superposed on the feet.
    const centre = sampleStanding(0, options).combinedCop;
    const points = standingTrace(arch, options).filter(point => point.progress <= clamp(phase));
    const cop = frame.combinedCop, marker = { lateral: cop.x - centre.x, forward: centre.z - cop.z };
    const map = p => ({ x: width / 2 + p.lateral * 1900, y: 103 - p.forward * 1900 });
    html += `<rect x="${width / 2 - 29}" y="73" width="58" height="60" rx="6" fill="#fff" stroke="#c7d8dc"/>`;
    html += `<path d="M${width / 2 - 24},84h48M${width / 2 - 24},103h48M${width / 2 - 24},122h48M${width / 2 - 19},78v50M${width / 2},78v50M${width / 2 + 19},78v50" stroke="#d2dfe2" stroke-width=".8"/>`;
    html += trace(points, map, '#0a8c92') + mark(marker, map, 2.8);
    html += text(width / 2, 145, 'COP微小摆动', 'text-anchor="middle" font-size="8"');
    html += text(width / 2, 157, '每格10 mm · 示意', 'text-anchor="middle" font-size="8"');
  }
  for (let i = 0; i < 32; i++) html += `<rect x="${width / 2 - 58 + i * 3.6}" y="${height - 48}" width="3.8" height="7" fill="${pressureColor(i / 31)}"/>`;
  html += text(width / 2 - 64, height - 42, '低', 'text-anchor="end"') + text(width / 2 + 64, height - 42, '高');
  html += text(width / 2, height - 24, maximum ? '各处峰值不同时出现 · 不计算COP' : mode === 'static' ?
    '看站立分布与COP摆动 · 不是重心曲线' : '深色圆点：当前COP · 白线：本次接触轨迹', 'text-anchor="middle" font-size="9"');
  html += text(width / 2, height - 9, '合成教学数据 · 颜色仅表示相对分布', 'text-anchor="middle" font-size="9" fill="#627e81"');
  svg.innerHTML = html; return frame;
}

// The threshold below is an original display convention applied identically to
// all profiles. It is not a sensor calibration threshold or a diagnostic cutoff.
const COMPARISON_CONTACT_THRESHOLD = .012;
const REGION_LABELS = Object.freeze({ heel: '足跟', midfoot: '中足', forefoot: '前足', toes: '足趾' });
const regionOf = cell => cell.forward < .025 ? 'heel' : cell.forward < .110 ? 'midfoot' : cell.forward < .180 ? 'forefoot' : 'toes';

/** Percentages describe THIS synthetic diagram, not patient norms. Area uses a
 * fixed display threshold; load fractions use all current force, including
 * sub-threshold cells. MPP has area coverage, but no instantaneous load or COP.
 */
export function profileSummary(frameOrFoot, options = {}) {
  const foot = frameOrFoot.feet ? frameOrFoot.feet.find(item => item.side === (options.side || 'right')) : frameOrFoot;
  if (!foot?.cells) throw new TypeError('A pressure foot or frame is required');
  const maximum = foot.kind === 'maximum_pressure_picture' || frameOrFoot.kind === 'maximum_pressure_picture';
  const cells = foot.cells, active = cells.filter(cell => cell.pressure >= COMPARISON_CONTACT_THRESHOLD);
  const contactArea = active.reduce((sum, cell) => sum + cell.area, 0);
  const totalForce = maximum ? null : cells.reduce((sum, cell) => sum + cell.force, 0);
  const areaFraction = subset => contactArea > 0 ? subset.reduce((sum, cell) => sum + cell.area, 0) / contactArea : null;
  const loadFraction = subset => !maximum && totalForce > 1e-12 ? subset.reduce((sum, cell) => sum + cell.force, 0) / totalForce : null;
  const regions = Object.entries(REGION_LABELS).map(([id, label]) => ({ id, label,
    contactAreaCm2: active.filter(cell => regionOf(cell) === id).reduce((sum, cell) => sum + cell.area, 0) * 1e4,
    areaFraction: areaFraction(active.filter(cell => regionOf(cell) === id)),
    loadFraction: loadFraction(cells.filter(cell => regionOf(cell) === id)) }));
  const medial = cell => regionOf(cell) === 'midfoot' && cell.medial > 0;
  return { sourceType: PRESSURE_DEFINITION.sourceType, measured: false, side: foot.side,
    contactAreaCm2: contactArea * 1e4, totalForce, simultaneous: !maximum,
    regions, medialMidfoot: {
      contactAreaCm2: active.filter(medial).reduce((sum, cell) => sum + cell.area, 0) * 1e4,
      areaFraction: areaFraction(active.filter(medial)), loadFraction: loadFraction(cells.filter(medial)) },
    copLocal: maximum ? null : foot.copLocal, contactThreshold: COMPARISON_CONTACT_THRESHOLD,
    regionMethod: '统一教学纵向分区；不是设备自动解剖掩膜或患者标定',
    denominators: {
      area: maximum ? '该足逐点峰值图达到同一合成显示阈值的全部格点面积；非瞬时接触面积' :
        '同一时刻该足达到同一合成显示阈值的全部格点面积',
      load: maximum ? null : '同一时刻该足全部格点的合成接触载荷；包含显示阈值以下的格点贡献' },
    areaMeaning: maximum ? '逐点峰值有色覆盖面积' : '合成阈值以上的当前接触面积' };
}

/** Three independent hypothetical arch conditions under the SAME clock, foot,
 * total load, grid area and fixed colour scale. This changes no clinic evidence.
 */
export function archComparisonSummary(inputMode = 'static', phase = 0, options = {}) {
  const mode = inputMode === 'mpp' ? 'maximum' : inputMode;
  if (!['static', 'dynamic', 'maximum'].includes(mode)) throw new RangeError('Comparison mode must be static, dynamic or maximum');
  if (!Number.isFinite(phase)) throw new TypeError('Comparison phase must be finite');
  const side = options.side || 'right';
  const profiles = ARCH_PROFILES.map(profile => {
    const frame = mode === 'maximum' ? sampleMaximumPressure({ ...options, side, arch: profile.arch }) :
      mode === 'dynamic' ? sampleWalking(phase, { ...options, arch: profile.arch }) : sampleStanding(phase, { ...options, arch: profile.arch });
    const foot = frame.feet ? frame.feet.find(item => item.side === side) : frame;
    return { ...profile, foot, metrics: profileSummary(foot) };
  });
  return { sourceType: PRESSURE_DEFINITION.sourceType, measured: false, mode, phase, side,
    cellSize: S, area: S * S, relativeScale: PRESSURE_DEFINITION.relativeScale,
    profiles, matchedConditions: ['同一足', '同一相位', '同一总载荷时钟', '同一格点面积', '同一相对色标'],
    interpretation: '三种原创假设用于比较；正常参考不是临床正常值，足弓类型不能单凭足印或COP诊断。' };
}

/** Horizontal one-foot comparison; no automatic per-profile colour rescaling. */
export function renderArchComparison(svg, options = {}) {
  if (!svg || typeof svg.setAttribute !== 'function') throw new TypeError('An SVG element is required');
  const width = options.width || 720, height = options.height || 360;
  const summary = archComparisonSummary(options.mode || 'static', options.phase ?? 0, options);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '同条件正常足弓参考、低足弓和高足弓合成足压对照');
  const gap = 12, colWidth = (width - gap * 4) / 3, scale = Math.min((height - 157) / .285, (colWidth - 40) / .105);
  const centreY = 71 + .22 * scale, maximum = summary.mode === 'maximum';
  const percent = value => value === null ? '—' : Math.round(value * 100) + '%';
  let html = `<rect width="${width}" height="${height}" rx="12" fill="#f3f8f8"/>`;
  const modeLabel = maximum ? '逐点峰值合成' : summary.mode === 'dynamic' ? '行走当前帧' : '静态站立';
  html += text(14, 20, `${modeLabel} · 同一${summary.side === 'right' ? '右' : '左'}足 · 同相位 / 同色标`, 'font-size="12" font-weight="700"');
  summary.profiles.forEach((profile, index) => {
    const x = gap + index * (colWidth + gap), centreX = x + colWidth / 2;
    html += `<rect x="${x}" y="32" width="${colWidth}" height="${height - 88}" rx="9" fill="#fff" stroke="#d9e4e6"/>`;
    html += text(centreX, 53, profile.label, 'text-anchor="middle" font-size="12" font-weight="700"');
    const map = point => ({ x: centreX + point.lateral * scale, y: centreY - point.forward * scale }); map.scale = scale;
    html += pathCells(profile.foot.cells.map(cell => cell.pressure < COMPARISON_CONTACT_THRESHOLD ? { ...cell, pressure: 0 } : cell), map);
    if (!maximum && profile.foot.copLocal) html += mark(profile.foot.copLocal, map, 4);
    const midfoot = profile.metrics.regions.find(region => region.id === 'midfoot');
    html += text(centreX, height - 73, `${maximum ? '中足峰值覆盖' : '中足接触面积'} ${percent(midfoot.areaFraction)}`, 'text-anchor="middle" font-size="11"');
    html += text(centreX, height - 59, maximum ? 'MPP不计算瞬时载荷或COP' :
      profile.metrics.totalForce > 1e-12 ? `中足载荷占该足 ${percent(midfoot.loadFraction)}` :
        profile.foot.contact ? '刚接触 · 尚未承重/COP' : '离地 · 无接触载荷/COP',
      'text-anchor="middle" font-size="10" fill="#607d82"');
  });
  for (let i = 0; i < 32; i++) html += `<rect x="${width / 2 - 70 + i * 4.4}" y="${height - 43}" width="4.6" height="7" fill="${pressureColor(i / 31)}"/>`;
  html += text(width / 2 - 78, height - 37, '相对低', 'text-anchor="end"') + text(width / 2 + 80, height - 37, '相对高');
  html += text(width / 2, height - 21, maximum ?
    '峰值覆盖比例以该图全足有色格点面积为分母；各处峰值不同时出现。' :
    '面积百分比以该图全足有色接触面积为分母；载荷百分比以该足当前总载荷为分母。', 'text-anchor="middle" font-size="9"');
  html += text(width / 2, height - 7, '原创合成对照 · 不代表人人相同，不用于足弓分型诊断或预测踝不稳。', 'text-anchor="middle" font-size="9"');
  svg.innerHTML = html; return summary;
}
