import {MUSCLES} from '../soap/explorers-data.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Licensed source geometry remains unedited. Motion is an original bounded
// teaching projection, with explicitly approximate pivots; muscles stay static.
const DEFAULT_PROVENANCE = new URL('./docs/anatomy-v10-provenance.json', import.meta.url);
const FOCUS = {
  ankle: { title: '踝关节怎样承接身体重量？', key: 'talus', target: [-.083, .015, .085], size: .23,
    explanation: '胫骨、腓骨围成踝穴，距骨位于其中。拖动滑块，观察踝关节背屈与跖屈。' },
  arch: { title: '足弓由哪些结构共同组成？', key: 'navicular', target: [-.092, -.032, .122], size: .235,
    explanation: '沿跟骨、距骨、舟骨、内侧楔骨到第1跖骨观察内侧纵弓。足弓还需要韧带、筋膜和肌肉共同维持。' },
  foot: { title: '从后足到前足，认识承重结构', key: 'mt1', target: [-.092, -.038, .137], size: .31,
    explanation: '足跟、中足和前足由多块骨相互衔接。观察它们的位置，有助于理解步行时负荷如何转移。' }
};
const HINTS = {
  tibia: '胫骨位于小腿内侧，远端形成内踝。',
  fibula: '腓骨位于小腿外侧，远端形成外踝。',
  talus: '距骨位于踝穴内，下方与跟骨相邻。',
  calcaneus: '跟骨构成足跟，是后足的重要承重骨。',
  navicular: '舟骨位于距骨前方，是观察内侧纵弓的骨性参照之一。',
  cuboid: '骰骨位于足外侧，连接跟骨与外侧跖骨。',
  cuneiformM: '内侧楔骨位于舟骨与第1跖骨之间。',
  cuneiformI: '中间楔骨位于舟骨与第2跖骨之间。',
  cuneiformL: '外侧楔骨位于舟骨与第3跖骨之间。',
  mt1: '第1跖骨位于足内侧，前端与大脚趾相接。',
  mt2: '第2跖骨位于中间楔骨前方。',
  mt3: '第3跖骨位于外侧楔骨前方。',
  mt4: '第4跖骨位于前足偏外侧。',
  mt5: '第5跖骨位于足外侧，骨底可见明显突起。'
};
const BUTTON_GROUPS = [
  ['tibia', '胫骨'], ['fibula', '腓骨'], ['talus', '距骨'], ['calcaneus', '跟骨'],
  ['navicular', '舟骨'], ['cuneiform', '楔骨'], ['metatarsal', '跖骨']
];
const GROUP_KEYS = { cuneiform: ['cuneiformM', 'cuneiformI', 'cuneiformL'],
  metatarsal: ['mt1', 'mt2', 'mt3', 'mt4', 'mt5'] };
const STYLE_ID = 'dxx-anatomy-v10-style';
const MOTION = {
  sagittal: { label: '背屈 / 跖屈', plane: '矢状面', axis: '横轴', min: -25, max: 20,
    positive: '踝关节背屈', negative: '踝关节跖屈', color: 0x3384a3,
    purpose: '背屈使足背靠近小腿；跖屈使足背远离小腿。', pivot: [-.075, -.014, .077] },
  frontal: { label: '内翻 / 外翻', plane: '额状面', axis: '前后轴', min: -12, max: 12,
    positive: '足内翻', negative: '足外翻', color: 0xb5812d,
    purpose: '内翻时足底朝内，外翻时足底朝外；主要涉及距下等多个关节。', pivot: [-.075, -.035, .075] }
};
const hex = buffer => Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, '0')).join('');
async function sha256(buffer) {
  if (!globalThis.crypto?.subtle) throw new Error('当前页面不能校验解剖资源，请使用本地服务器或HTTPS访问。');
  return hex(await crypto.subtle.digest('SHA-256', buffer));
}
function addStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style'); style.id = STYLE_ID;
  style.textContent = `.anatomy-v9{color:#213b42;background:#fafcfb;border:1px solid #dce8e4;border-radius:18px;overflow:hidden;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif}.anatomy-v9 *{box-sizing:border-box}.anatomy-v9-head{padding:18px 20px 12px;background:#fff}.anatomy-v9-kicker{font-size:11px;letter-spacing:.08em;color:#668079}.anatomy-v9 h3{margin:4px 0 8px;font-size:20px;font-weight:650;line-height:1.4}.anatomy-v9-desc{margin:0;color:#536f70;max-width:62em}.anatomy-v9-tabs,.anatomy-v9-bones{display:flex;flex-wrap:wrap;gap:7px}.anatomy-v9-tabs{margin-top:13px}.anatomy-v9 button{border:1px solid #ccddd6;border-radius:8px;color:#365851;background:#fff;padding:7px 11px;line-height:1.3;cursor:pointer;font:inherit;font-size:13px}.anatomy-v9 button:hover{background:#edf5f1}.anatomy-v9 button[aria-pressed=true]{background:#205f55;border-color:#205f55;color:#fff}.anatomy-v9 button:focus-visible{outline:3px solid #d5aa4d;outline-offset:3px}.anatomy-v9-stage{position:relative;min-height:300px;height:340px;max-height:48vh;background:radial-gradient(ellipse at 50% 58%,#fff,#e9f1ed);overflow:hidden;touch-action:none}.anatomy-v9-stage canvas{display:block;width:100%;height:100%;outline:none}.anatomy-v9-stage canvas:focus-visible{outline:3px solid #d5aa4d;outline-offset:-4px}.anatomy-v9-badge{position:absolute;top:12px;left:14px;font-size:11px;letter-spacing:.04em;background:#ffffffdb;padding:3px 8px;border-radius:6px;color:#557067;pointer-events:none}.anatomy-v9-label{position:absolute;pointer-events:none;transform:translate(-50%,-120%);background:#1f5d53;color:#fff;padding:4px 10px;border-radius:7px;font-size:12px;box-shadow:0 3px 12px #193f3324;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}.anatomy-v9-label:after{content:'';position:absolute;left:50%;bottom:-4px;border:4px solid transparent;border-top-color:#1f5d53;border-bottom:0}.anatomy-v9-gesture{position:absolute;right:12px;bottom:10px;color:#536f65;background:#ffffffca;padding:3px 8px;border-radius:6px;font-size:11px;pointer-events:none}.anatomy-v9-bottom{padding:13px 18px 16px;background:#fff;border-top:1px solid #e0e9e4}.anatomy-v9-selected{min-height:26px;margin:9px 0 0;color:#3b6259}.anatomy-v9-source{font-size:10px;color:#6c8079;padding-top:9px;line-height:1.5}.anatomy-v9-source a{color:#50736a;text-decoration:underline}.anatomy-v9-status{display:grid;place-items:center;position:absolute;inset:0;background:#f0f5f1e8;padding:25px;text-align:center;z-index:2}.anatomy-v9-status[hidden]{display:none}.anatomy-v9-reset{position:absolute;right:12px;top:10px;z-index:1}.anatomy-v9 .anatomy-v9-reset{font-size:11px;padding:5px 9px}@media(max-width:600px){.anatomy-v9-head{padding:15px}.anatomy-v9 h3{font-size:18px}.anatomy-v9-stage{height:310px;min-height:270px}.anatomy-v9-bottom{padding:12px}.anatomy-v9 button{padding:7px 9px}.anatomy-v9-label{font-size:11px}}`;
  style.textContent += `.anatomy-v10-motion{padding:12px 18px;background:#f5f8f8;border-top:1px solid #dce7e6}.anatomy-v10-row{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.anatomy-v10-row label{display:flex;align-items:center;gap:6px;font-size:12px;color:#466873}.anatomy-v10-range{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin-top:12px}.anatomy-v10-range input{min-width:70px;width:100%;accent-color:#286882}.anatomy-v10-range input:disabled{opacity:.35}.anatomy-v10-range span{font-size:11px;color:#56717b}.anatomy-v10-value{display:block;min-height:25px;font-size:17px;font-weight:650;line-height:1.5;color:#234f64;margin-top:5px}.anatomy-v10-caption{font-size:12px;line-height:1.5;color:#5e757e;margin:4px 0 8px}.anatomy-v10-legend{position:absolute;left:13px;bottom:10px;display:flex;align-items:center;gap:5px;font-size:11px;color:#275e73;background:#ffffffe8;padding:4px 8px;border-radius:6px;pointer-events:none}.anatomy-v10-legend:before{content:'';width:15px;height:3px;background:var(--axis-color,#3384a3)}.anatomy-v10-limit{font-size:10px;color:#75868d;margin:6px 0 0}.anatomy-v10-muscles{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.anatomy-v10-muscles[hidden]{display:none}.anatomy-v10-muscles button{font-size:11px;padding:5px 8px}.anatomy-v10-axis-pin{position:absolute;pointer-events:none;font-size:11px;color:#fff;background:#286d86e8;padding:2px 6px;border-radius:5px}.anatomy-v9-head{padding:12px 16px 10px}.anatomy-v9 h3{font-size:18px;margin:3px 0 5px}.anatomy-v9-desc{font-size:12px}.anatomy-v9-tabs{margin-top:9px}.anatomy-v9-stage{height:330px;max-height:45vh;min-height:270px}.anatomy-v9-bottom{padding:11px 16px}.anatomy-v9-selected{font-size:12px;margin-top:6px;min-height:20px}.anatomy-v9-source{font-size:9px;padding-top:5px}.anatomy-v9 button{font-size:12px;padding:6px 10px}@media(max-width:600px){.anatomy-v10-motion{padding:11px 13px}.anatomy-v10-range{gap:7px}.anatomy-v9-stage{height:290px;min-height:240px;max-height:42vh}.anatomy-v10-value{font-size:15px}}`;
  document.head.append(style);
}
function element(tag, className, text) {
  const el = document.createElement(tag); if (className) el.className = className;
  if (text !== undefined) el.textContent = text; return el;
}

/**
 * Create once and retain across dialogue nodes. Initially loads one verified
 * 4 MiB bone chunk; another verified chunk is lazy-loaded for static muscles.
 * Call setVisible(false) while the containing drawer is closed; dispose once.
 */
export async function createAnatomyViewer(host, options = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('Anatomy viewer needs an HTML container.');
  addStyles();
  const shell = element('section', 'anatomy-v9'); shell.setAttribute('aria-label', '足踝结构与运动教学窗');
  const head = element('div', 'anatomy-v9-head');
  head.append(element('div', 'anatomy-v9-kicker', '认识结构 · 理解运动'));
  const title = element('h3'), description = element('p', 'anatomy-v9-desc');
  const tabs = element('div', 'anatomy-v9-tabs'); tabs.setAttribute('aria-label', '观察部位');
  head.append(title, description, tabs);
  const stage = element('div', 'anatomy-v9-stage');
  const badge = element('div', 'anatomy-v9-badge', '右足 · 运动教具');
  const label = element('div', 'anatomy-v9-label'); label.hidden = true;
  const gesture = element('div', 'anatomy-v9-gesture', '拖动旋转 · 滚轮缩放');
  const reset = element('button', 'anatomy-v9-reset', '复位'); reset.type = 'button';
  const status = element('div', 'anatomy-v9-status', '正在准备足踝骨骼…'); status.setAttribute('role', 'status');
  const axisPin = element('div', 'anatomy-v10-axis-pin'); axisPin.hidden = true;
  const legend = element('div', 'anatomy-v10-legend');
  stage.append(badge, label, gesture, reset, status, axisPin, legend);
  const motionPanel = element('div', 'anatomy-v10-motion');
  const motionRow = element('div', 'anatomy-v10-row');
  const motionButtons = new Map();
  for (const [key, config] of Object.entries(MOTION)) {
    const button = element('button', '', config.label); button.type = 'button';
    button.addEventListener('click', () => setMotion(key)); motionRow.append(button); motionButtons.set(key, button);
  }
  const muscleToggle = element('button', '', '添加肌肉'); muscleToggle.type = 'button'; muscleToggle.setAttribute('aria-pressed', 'false');
  const axisLabel = element('label'); const axisToggle = element('input'); axisToggle.type = 'checkbox'; axisToggle.checked = true;
  axisLabel.append(axisToggle, document.createTextNode('轴与运动面')); motionRow.append(muscleToggle, axisLabel);
  const rangeRow = element('div', 'anatomy-v10-range');
  const rangeLeft = element('span'), rangeRight = element('span'); const range = element('input');
  range.type = 'range'; range.step = '1'; range.value = '0'; range.setAttribute('aria-label', '踝关节背屈与跖屈教学角度');
  rangeRow.append(rangeLeft, range, rangeRight);
  const motionValue = element('output', 'anatomy-v10-value', '中立位 · 0°'); motionValue.setAttribute('aria-live', 'off');
  const motionPurpose = element('p', 'anatomy-v10-caption');
  const neutralButton = element('button', '', '回到中立位'); neutralButton.type = 'button';
  const motionHint = element('p', 'anatomy-v10-limit', '教学角度；轴与平面为简化投影，实际足踝运动具有斜轴与耦合。');
  const muscleButtons = element('div', 'anatomy-v10-muscles'); muscleButtons.hidden = true; muscleButtons.setAttribute('aria-label', '选择肌肉');
  motionPanel.append(motionRow, rangeRow, motionValue, motionPurpose, neutralButton, muscleButtons, motionHint);
  const bottom = element('div', 'anatomy-v9-bottom');
  const buttons = element('div', 'anatomy-v9-bones'); buttons.setAttribute('aria-label', '选择骨骼');
  const selectedText = element('p', 'anatomy-v9-selected'); selectedText.setAttribute('aria-live', 'polite');
  const source = element('div', 'anatomy-v9-source');
  source.append(document.createTextNode('BodyParts3D, © The Database Center for Life Science · '));
  const sourceLink = element('a', '', 'CC BY 4.0'); sourceLink.href = 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html'; sourceLink.target = '_blank'; sourceLink.rel = 'noopener';
  source.append(sourceLink, document.createTextNode(' · 经 Somakine 复用。肌肉仅显示中立位结构，运动驱动为本项目教学制作。'));
  bottom.append(buttons, selectedText, source); shell.append(head, stage, motionPanel, bottom); host.append(shell);

  let disposed = false, visible = true, focusKey = 'ankle', selectedKeys = [], pinKey = null;
  let motionKey = 'sagittal', motionAngle = 0, muscleMode = false, musclesReady = false, musclesLoading = null;
  let renderer, controls, resizeObserver, intersectionObserver;
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(36, 1, .005, 5);
  const atlas = new THREE.Group(); scene.add(atlas); const meshes = new Map(), muscleMeshes = new Map();
  const sagittalPivot = new THREE.Group(); sagittalPivot.position.fromArray(MOTION.sagittal.pivot); atlas.add(sagittalPivot);
  const frontalPivot = new THREE.Group(); frontalPivot.position.fromArray(MOTION.frontal.pivot).sub(sagittalPivot.position); sagittalPivot.add(frontalPivot);
  const muscleGroup = new THREE.Group(); atlas.add(muscleGroup); muscleGroup.visible = false;
  const axisGroup = new THREE.Group(); scene.add(axisGroup);
  const focusButtons = new Map(), boneButtons = new Map();
  const fetchController = new AbortController();
  const resources = [], chunks = new Map();
  const clipping = new THREE.Plane(new THREE.Vector3(0, -1, 0), .13);
  let provenance, manifest, geometryBase, byteCount = 0;
  function clearAxes() {
    for (const object of [...axisGroup.children]) {
      object.geometry?.dispose(); object.material?.dispose(); axisGroup.remove(object);
    }
  }
  function rebuildAxes() {
    clearAxes();
    const config = MOTION[motionKey], pivot = new THREE.Vector3(...config.pivot);
    const vector = new THREE.Vector3(...(motionKey === 'sagittal' ? [1, 0, 0] : [0, 0, 1]));
    const points = [pivot.clone().addScaledVector(vector, -.105), pivot.clone().addScaledVector(vector, .105)];
    const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: config.color, depthTest: false }));
    axis.renderOrder = 4; axisGroup.add(axis);
    for (const sign of [-1, 1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(.0045, .013, 12), new THREE.MeshBasicMaterial({ color: config.color, depthTest: false }));
      cone.position.copy(pivot).addScaledVector(vector, sign * .105);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.clone().multiplyScalar(sign));
      cone.renderOrder = 4; axisGroup.add(cone);
    }
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(motionKey === 'sagittal' ? .25 : .20, .25), new THREE.MeshBasicMaterial({ color: config.color, side: THREE.DoubleSide, transparent: true, opacity: .10, depthWrite: false }));
    plane.position.copy(pivot); if (motionKey === 'sagittal') { plane.rotation.y = Math.PI / 2; plane.position.z += .035; }
    axisGroup.add(plane);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(plane.geometry), new THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: .36 }));
    outline.position.copy(plane.position); outline.quaternion.copy(plane.quaternion); axisGroup.add(outline);
    axisPin.textContent = config.axis; axisPin.style.background = `#${new THREE.Color(config.color).getHexString()}e8`;
    legend.style.setProperty('--axis-color', `#${new THREE.Color(config.color).getHexString()}`);
    legend.textContent = `${config.axis} · ${config.plane}投影`;
    axisGroup.visible = axisToggle.checked && !muscleMode;
  }
  function setAngle(value = 0) {
    const config = MOTION[motionKey]; const numeric = Number(value);
    motionAngle = Number.isFinite(numeric) ? THREE.MathUtils.clamp(numeric, config.min, config.max) : 0;
    if (muscleMode) motionAngle = 0;
    sagittalPivot.rotation.x = motionKey === 'sagittal' ? -THREE.MathUtils.degToRad(motionAngle) : 0;
    frontalPivot.rotation.z = motionKey === 'frontal' ? THREE.MathUtils.degToRad(motionAngle) : 0;
    range.value = String(motionAngle);
    motionValue.textContent = muscleMode ? '肌肉结构 · 中立位' : motionAngle === 0 ? '中立位 · 0°' : `${motionAngle > 0 ? config.positive : config.negative} · ${Math.abs(motionAngle)}°`;
    badge.textContent = muscleMode ? '右侧 · 肌肉解剖' : '右足 · 运动教具';
    atlas.updateMatrixWorld(true); render();
    options.onMotion?.({ mode: motionKey, angleDegrees: motionAngle, muscleMode, approximateTeachingProjection: true });
  }
  function frameMuscles() {
    title.textContent = '肌肉怎样参与足踝运动？'; description.textContent = '点选肌肉，比较它与关节的位置；肌肉在中立位观察。';
    if (!controls) return;
    const target = new THREE.Vector3(-.078, .17, .10); controls.target.copy(target);
    camera.position.copy(target).add(new THREE.Vector3(.44, .18, .70)); camera.lookAt(target); controls.update();
  }
  function setMotion(key = 'sagittal') {
    if (disposed) return;
    if (!MOTION[key]) key = 'sagittal'; motionKey = key; muscleMode = false;
    muscleGroup.visible = false; muscleToggle.textContent = '添加肌肉'; muscleToggle.setAttribute('aria-pressed', 'false');
    muscleButtons.hidden = true; range.disabled = false; neutralButton.disabled = false; axisToggle.disabled = false;
    clipping.constant = .13;
    for (const [id, button] of motionButtons) button.setAttribute('aria-pressed', String(id === key));
    const config = MOTION[key]; range.min = String(config.min); range.max = String(config.max);
    range.setAttribute('aria-label', `${config.label}教学角度`); rangeLeft.textContent = config.negative; rangeRight.textContent = config.positive;
    motionPurpose.textContent = config.purpose; legend.hidden = !axisToggle.checked;
    for (const mesh of meshes.values()) { mesh.material.transparent = false; mesh.material.opacity = 1; mesh.material.needsUpdate = true; }
    rebuildAxes(); setAngle(0); setFocus(focusKey);
  }
  async function setMusclesVisible(value = true) {
    if (disposed) return false;
    if (!value) { setMotion(motionKey); return true; }
    muscleMode = true; setAngle(0); range.disabled = true; neutralButton.disabled = true; axisToggle.disabled = true;
    axisGroup.visible = false; axisPin.hidden = true; legend.hidden = true; muscleToggle.textContent = '收起肌肉'; muscleToggle.setAttribute('aria-pressed', 'true');
    motionPurpose.textContent = '肌肉识别色表示结构，不表示激活或肌力。'; clipping.constant = .46;
    if (!musclesReady) {
      status.hidden = false; status.textContent = '正在准备已授权肌肉…';
      try {
        musclesLoading ||= (async () => {
          for (const chunkIndex of provenance.optionalMuscleChunkIndices || []) await ensureChunk(chunkIndex);
          for (const row of provenance.assets.filter(row => row.kind === 'muscle')) await addMesh(row);
          musclesReady = true;
        })();
        await musclesLoading;
      } catch (error) {
        musclesLoading = null; muscleMode = false; setMotion(motionKey);
        selectedText.textContent = error.message || '肌肉资源未能载入，仍可观察骨骼运动。'; status.hidden = true; return false;
      }
    }
    if (disposed || !muscleMode) { if (!disposed) status.hidden = true; return false; }
    status.hidden = true; muscleGroup.visible = true; muscleButtons.hidden = false;
    for (const mesh of meshes.values()) { mesh.material.transparent = true; mesh.material.opacity = .62; mesh.material.needsUpdate = true; }
    frameMuscles(); highlight('tibialisAnterior'); resize(); return true;
  }
  function render() {
    if (disposed || !renderer || !visible || !stage.clientWidth || !stage.clientHeight) return;
    renderer.render(scene, camera);
    const axisPoint = new THREE.Vector3(...MOTION[motionKey].pivot);
    axisPoint[motionKey === 'sagittal' ? 'x' : 'z'] += .11; axisPoint.project(camera);
    axisPin.hidden = !axisGroup.visible || Math.abs(axisPoint.x) > .9 || Math.abs(axisPoint.y) > .9 || Math.abs(axisPoint.z) > 1;
    if (!axisPin.hidden) { axisPin.style.left = `${(axisPoint.x * .5 + .5) * stage.clientWidth}px`; axisPin.style.top = `${(-axisPoint.y * .5 + .5) * stage.clientHeight}px`; }
    const mesh = meshes.get(pinKey) || (muscleMode ? muscleMeshes.get(pinKey) : null);
    if (!mesh) { label.hidden = true; return; }
    const p = mesh.localToWorld(new THREE.Vector3(...mesh.userData.labelPoint)).project(camera);
    const inFrame = p.z > -1 && p.z < 1 && Math.abs(p.x) < .94 && Math.abs(p.y) < .9;
    label.hidden = !inFrame;
    if (inFrame) { label.style.left = `${(p.x * .5 + .5) * stage.clientWidth}px`; label.style.top = `${(-p.y * .5 + .5) * stage.clientHeight}px`; }
  }
  function resize() {
    if (disposed || !renderer) return;
    const w = Math.max(stage.clientWidth, 300), h = Math.max(stage.clientHeight, 270);
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); render();
  }
  function setFocus(key = 'ankle') {
    if (disposed) return;
    if (!FOCUS[key]) key = 'ankle'; focusKey = key;
    const preset = FOCUS[key]; title.textContent = preset.title; description.textContent = preset.explanation;
    for (const [id, button] of focusButtons) button.setAttribute('aria-pressed', String(id === key));
    if (muscleMode) { frameMuscles(); render(); return; }
    if (controls) {
      const target = new THREE.Vector3(...preset.target);
      controls.target.copy(target);
      const direction = key === 'arch' ? new THREE.Vector3(.95, .42, .45) : new THREE.Vector3(.85, .55, 1.05);
      direction.normalize().multiplyScalar(preset.size / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * .64);
      camera.position.copy(target).add(direction); camera.lookAt(target); controls.update();
      controls.minDistance = .10; controls.maxDistance = .9;
    }
    highlight(preset.key); render();
  }
  function highlight(value) {
    if (disposed) return false;
    let keys = Array.isArray(value) ? value : [value];
    const aliases = { 胫骨: 'tibia', 腓骨: 'fibula', 距骨: 'talus', 跟骨: 'calcaneus', 舟骨: 'navicular', 足舟骨: 'navicular', 骰骨: 'cuboid', 楔骨: 'cuneiform', 跖骨: 'metatarsal' };
    keys = keys.flatMap(key => { const canonical = aliases[key] || provenance?.assets.find(row => row.label === key)?.key || key; return GROUP_KEYS[canonical] || [canonical]; });
    const available = new Map([...meshes, ...(muscleMode ? muscleMeshes : [])]);
    keys = keys.filter(key => available.has(key)); selectedKeys = keys; pinKey = keys[0] || null;
    for (const [key, mesh] of meshes) {
      const active = keys.includes(key); mesh.material.color.setHex(active ? 0xd9a85d : 0xe6dfce);
      mesh.material.emissive.setHex(active ? 0x3b220d : 0); mesh.material.emissiveIntensity = active ? .24 : 0;
      mesh.material.roughness = active ? .6 : .75;
    }
    for (const [key, button] of boneButtons) {
      const group = GROUP_KEYS[key] || [key]; button.setAttribute('aria-pressed', String(group.some(k => keys.includes(k))));
    }
    for (const [key, mesh] of muscleMeshes) {
      const active = keys.includes(key); mesh.material.color.setHex(active ? 0xba7c3c : 0xb87570);
      mesh.material.emissive.setHex(active ? 0x492a09 : 0); mesh.material.emissiveIntensity = active ? .18 : 0;
      muscleButtons.querySelector(`[data-muscle="${key}"]`)?.setAttribute('aria-pressed', String(active));
    }
    if (pinKey) {
      const row = available.get(pinKey).userData; label.textContent = keys.length > 1 ? (Array.isArray(value)?'所选骨群':value === 'metatarsal' || value === '跖骨' ? '第1—5跖骨' : '3块楔骨') : row.label;
      selectedText.textContent = keys.length > 1 ? (Array.isArray(value)?keys.map(k=>available.get(k).userData.label).join('、'):keys.includes('mt1') ? '跖骨连接跗骨与足趾。请旋转模型，比较内外侧的位置。' : '内侧、中间、外侧楔骨分别位于舟骨前方。') : (row.function || HINTS[pinKey] || `${row.label}，观察其与相邻骨的关系。`);
    } else { label.hidden = true; selectedText.textContent = '点选骨名，或直接点击模型中的骨骼。'; }
    const muscleInfo=MUSCLES.find(m=>m.id===pinKey);
    if(muscleInfo) selectedText.textContent=`${muscleInfo.name}｜起点：${muscleInfo.origin}。止点：${muscleInfo.insertion}。作用：${muscleInfo.action}`;
    options.onSelection?.({ keys: [...keys], labels: keys.map(k => available.get(k).userData.label), focus: focusKey });
    render(); return keys.length > 0;
  }
  function dispose() {
    if (disposed) return; disposed = true; fetchController.abort();
    resizeObserver?.disconnect(); intersectionObserver?.disconnect(); controls?.dispose();
    clearAxes(); for (const r of resources) r.dispose(); renderer?.dispose(); chunks.clear(); shell.remove();
  }
  async function fetchJson(url) {
    const response = await fetch(url, { signal: fetchController.signal, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`解剖目录读取失败（${response.status}）。`); return response.json();
  }
  async function ensureChunk(chunkIndex) {
    if (chunks.has(chunkIndex)) return;
    const chunk = manifest.chunks[chunkIndex]; if (!chunk) throw new Error('解剖模型缺少分片。');
    const url = new URL(chunk.path, geometryBase);
    if (url.origin !== geometryBase.origin || !url.pathname.startsWith(geometryBase.pathname)) throw new Error('解剖资源路径不正确。');
    const response = await fetch(url, { signal: fetchController.signal, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`解剖文件读取失败（${response.status}）。`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== chunk.bytes || await sha256(buffer) !== chunk.sha256) throw new Error('解剖文件校验未通过，请重新加载。');
    if (disposed) throw new Error('观察窗已关闭。');
    chunks.set(chunkIndex, buffer); byteCount += buffer.byteLength;
  }
  function getRange(offset, bytes) {
    const out = new Uint8Array(bytes); let written = 0;
    for (const [i, buffer] of chunks) {
      const c = manifest.chunks[i]; const first = Math.max(offset, c.offset), end = Math.min(offset + bytes, c.offset + c.bytes);
      if (end > first) { out.set(new Uint8Array(buffer, first - c.offset, end - first), first - offset); written += end - first; }
    }
    if (written !== bytes) throw new Error('解剖片段不完整。'); return out;
  }
  async function addMesh(row) {
    if (disposed) throw new Error('观察窗已关闭。');
    if (meshes.has(row.key) || muscleMeshes.has(row.key)) return;
    const p = getRange(row.positions, row.vertexCount * 12), n = getRange(row.normals, row.vertexCount * 12), idx = getRange(row.indices, row.indexCount * 4);
    const payload = new Uint8Array(p.length + n.length + idx.length); payload.set(p); payload.set(n, p.length); payload.set(idx, p.length + n.length);
    if (await sha256(payload.buffer) !== row.sha256) throw new Error(`${row.label}的资源校验未通过。`);
    if (disposed) throw new Error('观察窗已关闭。');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.buffer), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n.buffer), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(idx.buffer), 1)); geometry.computeBoundingSphere();
    const isMuscle = row.kind === 'muscle';
    const material = new THREE.MeshStandardMaterial({ color: isMuscle ? 0xb87570 : 0xe6dfce, roughness: .75, metalness: 0, side: THREE.DoubleSide, clippingPlanes: [clipping] });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = row.id;
    const labelPoint = [...row.center]; if (row.key === 'tibia') labelPoint[1] = .075; if (row.key === 'fibula') labelPoint[1] = .055;
    mesh.userData = { key: row.key, id: row.id, label: row.label, labelPoint, function: row.function, kind: row.kind || 'bone' };
    if (isMuscle) {
      muscleGroup.add(mesh); muscleMeshes.set(row.key, mesh);
      const button = element('button', '', row.label); button.type = 'button'; button.dataset.muscle = row.key;
      button.setAttribute('aria-pressed', 'false'); button.addEventListener('click', () => highlight(row.key)); muscleButtons.append(button);
    } else {
      if (['tibia', 'fibula'].includes(row.key)) atlas.add(mesh);
      else if (row.key === 'talus') { sagittalPivot.add(mesh); mesh.position.fromArray(MOTION.sagittal.pivot).negate(); }
      else { frontalPivot.add(mesh); mesh.position.fromArray(MOTION.frontal.pivot).negate(); }
      meshes.set(row.key, mesh);
    }
    resources.push(geometry, material);
  }
  try {
    provenance = await fetchJson(options.provenanceUrl || DEFAULT_PROVENANCE);
    if (disposed) throw new Error('观察窗已关闭。');
    if (!['dxx-clinic-anatomy-v9', 'dxx-clinic-anatomy-v10'].includes(provenance.schema) || provenance.side !== 'R') throw new Error('解剖目录版本不匹配。');
    const geometryUrl = new URL(provenance.geometryManifestUrl, import.meta.url);
    geometryBase = new URL(provenance.geometryBaseUrl, import.meta.url);
    manifest = await fetchJson(geometryUrl);
    if (manifest.format !== 'dxx-assembly-split-v1') throw new Error('解剖分片版本不匹配。');
    for (const chunkIndex of provenance.requiredChunkIndices) await ensureChunk(chunkIndex);
    for (const row of provenance.assets.filter(row => row.kind !== 'muscle')) await addMesh(row);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0, 0);
    renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('role', 'img'); renderer.domElement.setAttribute('aria-label', '可旋转的右侧足踝骨性解剖模型。使用下方骨名按钮高亮结构。');
    stage.prepend(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc0cab7, 2.2));
    const keyLight = new THREE.DirectionalLight(0xfff9e8, 2.6); keyLight.position.set(.5, .6, .7); scene.add(keyLight);
    const fill = new THREE.DirectionalLight(0xdeedf0, 1.6); fill.position.set(-.6, .1, -.4); scene.add(fill);
    controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.enablePan = false; controls.rotateSpeed = .65; controls.zoomSpeed = .7;
    controls.addEventListener('change', render);
    for (const [key, text] of [['ankle', '看踝关节'], ['arch', '看内侧足弓'], ['foot', '看全足']]) {
      const button = element('button', '', text); button.type = 'button'; button.addEventListener('click', () => setFocus(key)); tabs.append(button); focusButtons.set(key, button);
    }
    for (const [key, text] of BUTTON_GROUPS) {
      const button = element('button', '', text); button.type = 'button'; button.addEventListener('click', () => highlight(key)); buttons.append(button); boneButtons.set(key, button);
    }
    reset.addEventListener('click', () => { setAngle(0); setFocus(focusKey); });
    range.addEventListener('input', () => setAngle(range.value));
    neutralButton.addEventListener('click', () => setAngle(0));
    muscleToggle.addEventListener('click', () => setMusclesVisible(!muscleMode));
    axisToggle.addEventListener('change', () => { axisGroup.visible = axisToggle.checked && !muscleMode; legend.hidden = !axisGroup.visible; render(); });
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let downPoint = null;
    renderer.domElement.addEventListener('pointerdown', event => { downPoint = [event.clientX, event.clientY]; });
    renderer.domElement.addEventListener('pointerup', event => {
      if (!downPoint || Math.hypot(event.clientX - downPoint[0], event.clientY - downPoint[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects([...meshes.values(), ...(muscleMode ? muscleMeshes.values() : [])]).find(h => clipping.distanceToPoint(h.point) >= 0);
      if (hit) highlight(hit.object.userData.key);
    });
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
    intersectionObserver = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) resize(); }); intersectionObserver.observe(stage);
    status.hidden = true; focusKey = options.focus || 'ankle'; setMotion('sagittal'); resize();
    return { setFocus, highlight, setMotion, setAngle, setMusclesVisible, resize, setZoom(value){camera.zoom=Math.max(.8,Math.min(2,value));camera.updateProjectionMatrix();render();}, setAxesVisible(value){axisToggle.checked=!!value;axisGroup.visible=!!value&&!muscleMode;legend.hidden=!axisGroup.visible;render();}, setVisible(value) { visible = Boolean(value); if (visible) resize(); }, dispose,
      getState() { return { ready: !disposed, focus: focusKey, selectedKeys: [...selectedKeys], assetCount: meshes.size, muscleAssetCount: muscleMeshes.size, motionMode: motionKey, motionAngleDegrees: motionAngle, muscleMode, approximateTeachingProjection: true, fetchedChunkCount: chunks.size, fetchedBytes: byteCount, integrity: 'SHA-256: selected chunks + each mesh', side: 'R', staticAtlas: muscleMode || motionAngle === 0 }; }, provenance };
  } catch (error) {
    status.textContent = error.message || '解剖模型暂时未能读取。';
    status.setAttribute('role', 'alert');
    clearAxes(); for (const r of resources) r.dispose(); renderer?.dispose(); chunks.clear();
    options.onError?.(error); throw error;
  }
}
