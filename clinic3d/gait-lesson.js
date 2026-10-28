// Original, authored teaching example. No subject measurements or diagnostic norms.
// Distances are metres; duration is seconds. Positive forward follows the walkway;
// positive lateral means the person's anatomical right (not the camera's right).
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const GAIT_CASE = freeze({
  id: 'cai-authored-asymmetry-v10',
  label: '右侧患侧 · 教学病例',
  sourceType: 'authored_teaching_case',
  measured: false,
  affectedSide: 'right',
  cycleSeconds: 1.2,
  stance: { right: .56, left: .64 },
  stepLength: { right: .48, left: .40 },
  stepWidth: .14,
  strideLength: .88,
  speed: .88 / 1.2,
  cadence: 2 * 60 / 1.2,
  leftContactPhase: .46,
  initialForward: .26,
  footClearance: .055,
  limitations: [
    '数值为便于比较而编写的单一教学病例，不来自患者测量，也不是慢性踝关节不稳的通用步态。',
    '右步长指左足接触后至右足接触的前后距离；单看步长不能判断哪一侧功能更好。',
    '骨盆参考点只帮助观察身体移动；未建立分段质量模型，不能称为全身重心测量。',
    '足底压力中心（COP）和身体质心（CoM）是不同的量，本模型不由骨盆位置推算COP。'
  ]
});

export const GAIT_DEFINITIONS = freeze({
  stepLength: '相邻左右足初始接触时，足跟沿前进方向的距离。步长以本次落地足命名。',
  strideLength: '同一足连续两次初始接触的前后距离。本例等于右步长加左步长。',
  stepWidth: '直线行走时，相邻左右足落点的横向距离。本例用足跟中心线定义。',
  speed: '行进距离除以时间。本例用一个跨步长除以一个步态周期。',
  cadence: '每分钟的步数；一个左右完整周期包含两步。',
  stance: '一足从初始接触到离地的时段。',
  swing: '同一足从离地到下一次初始接触的时段。',
  doubleSupport: '两足同时接触地面的时段。',
  bodyReference: '骨盆参考点为教学标记，帮助观察左右与上下移动；它不是经过分段质量加权计算的全身质心。',
  cop: '足底压力中心是足底接触力的作用位置；它不能与身体质心或其投影混为一谈。'
});

export const GAIT_EVENTS = freeze([
  { phase: 0, side: 'right', type: 'initial_contact', label: '右足初始接触' },
  { phase: .10, side: 'left', type: 'toe_off', label: '左足离地' },
  { phase: .46, side: 'left', type: 'initial_contact', label: '左足初始接触' },
  { phase: .56, side: 'right', type: 'toe_off', label: '右足离地' },
  { phase: 1, side: 'right', type: 'initial_contact', label: '右足再次初始接触' }
]);

/** A cycle's 100% endpoint is the next 0% initial contact. Keep this rule shared
 * by feedback and completion gates, so the same visible event cannot pass one
 * check and fail another. Invalid or out-of-range saved marks never pass.
 */
export function isGaitEventMatch(value, target, tolerance) {
  if (![value, target, tolerance].every(Number.isFinite) ||
    value < 0 || value > 1 || target < 0 || target > 1 || tolerance < 0 || tolerance > .5) return false;
  const distance = Math.abs(value - target);
  return Math.min(distance, 1 - distance) <= tolerance + 1e-12;
}

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * t * (10 + t * (-15 + 6 * t)); };
const mod1 = value => {
  const remainder = value % 1;
  const phase = remainder < 0 ? remainder + 1 : remainder;
  return Math.abs(phase) < 1e-12 || Math.abs(phase - 1) < 1e-12 ? 0 : phase;
};

function sideAt(phase, side, profile) {
  const right = side === 'right';
  const initial = right ? 0 : profile.leftContactPhase;
  const stanceFraction = profile.stance[side];
  let localPhase = mod1(phase - initial);
  if (Math.abs(localPhase - stanceFraction) < 1e-12) localPhase = stanceFraction;
  const contact = localPhase < stanceFraction;
  const lastCycle = Math.round(phase - initial - localPhase);
  const lastInitialContact = lastCycle + initial;
  const nextInitialContact = lastInitialContact + 1;
  const groundContact = profile.initialForward +
    (right ? 0 : profile.stepLength.left) + lastCycle * profile.strideLength;
  const swingProgress = contact ? 0 : (localPhase - stanceFraction) / (1 - stanceFraction);
  const footprintForward = groundContact + (contact ? 0 : profile.strideLength * smooth(swingProgress));
  return {
    side,
    contact,
    stage: contact ? 'stance' : 'swing',
    label: contact ? '支撑期' : '摆动期',
    localPhase,
    stanceFraction,
    swingFraction: 1 - stanceFraction,
    stageProgress: contact ? localPhase / stanceFraction : swingProgress,
    lastInitialContact,
    nextInitialContact,
    footprintForward,
    foot: {
      lateral: (right ? 1 : -1) * profile.stepWidth / 2,
      forward: footprintForward - phase * profile.strideLength,
      height: contact ? 0 : profile.footClearance * Math.sin(Math.PI * swingProgress) ** 2
    }
  };
}

/** Sample one cyclic authored stride. phase accepts any finite number; 1 wraps to 0.
 * Foot positions are relative to a root advancing phase * strideLength; stance feet
 * therefore remain fixed in world space when the root uses that same advance.
 * Body-reference lateral/vertical values are authored displacements, not measured CoM.
 */
export function sampleGait(inputPhase, profile = GAIT_CASE) {
  if (!Number.isFinite(inputPhase)) throw new TypeError('Gait phase must be finite');
  const phase = mod1(inputPhase);
  const right = sideAt(phase, 'right', profile);
  const left = sideAt(phase, 'left', profile);
  const doubleSupport = right.contact && left.contact;
  return {
    phase,
    timeSeconds: phase * profile.cycleSeconds,
    right,
    left,
    doubleSupport,
    supportLabel: doubleSupport ? '双足支撑' : right.contact ? '右足单足支撑' : left.contact ? '左足单足支撑' : '双足腾空',
    reference: {
      kind: 'pelvis_proxy',
      label: '骨盆参考点',
      measured: false,
      lateral: .020 * Math.sin(2 * Math.PI * (phase - .03)),
      vertical: .006 * (1 - Math.cos(4 * Math.PI * (phase - .03))),
      forward: phase * profile.strideLength
    }
  };
}

/** Ground contact markers, independent of frame rate, for a straight-line diagram.
 * Include one preceding left footprint so both step-length definitions can be shown.
 */
export function gaitFootprints(cycles = 2, profile = GAIT_CASE) {
  if (!Number.isInteger(cycles) || cycles < 1 || cycles > 20) throw new RangeError('cycles must be an integer from 1 to 20');
  const result = [{ side: 'left', phase: profile.leftContactPhase - 1,
    forward: profile.initialForward + profile.stepLength.left - profile.strideLength,
    lateral: -profile.stepWidth / 2, timeSeconds: (profile.leftContactPhase - 1) * profile.cycleSeconds }];
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const side of ['right', 'left']) {
      const phase = cycle + (side === 'right' ? 0 : profile.leftContactPhase);
      result.push({ side, phase, forward: profile.initialForward + cycle * profile.strideLength +
        (side === 'right' ? 0 : profile.stepLength.left),
      lateral: (side === 'right' ? 1 : -1) * profile.stepWidth / 2,
      timeSeconds: phase * profile.cycleSeconds });
    }
  }
  return result;
}

export function gaitMetrics(profile = GAIT_CASE) {
  const cycle = profile.cycleSeconds;
  const leftToeOff = mod1(profile.leftContactPhase + profile.stance.left);
  const doubleSupportFraction = leftToeOff + profile.stance.right - profile.leftContactPhase;
  return {
    right: { stepLength: profile.stepLength.right, stanceSeconds: profile.stance.right * cycle,
      swingSeconds: (1 - profile.stance.right) * cycle, stepSeconds: (1 - profile.leftContactPhase) * cycle,
      singleSupportSeconds: (profile.leftContactPhase - leftToeOff) * cycle },
    left: { stepLength: profile.stepLength.left, stanceSeconds: profile.stance.left * cycle,
      swingSeconds: (1 - profile.stance.left) * cycle, stepSeconds: profile.leftContactPhase * cycle,
      singleSupportSeconds: (1 - profile.stance.right) * cycle },
    cycleSeconds: cycle, strideLength: profile.strideLength, stepWidth: profile.stepWidth,
    speed: profile.strideLength / cycle, cadence: 120 / cycle,
    doubleSupportFraction, doubleSupportSeconds: doubleSupportFraction * cycle,
    meanStepLength: (profile.stepLength.right + profile.stepLength.left) / 2
  };
}
