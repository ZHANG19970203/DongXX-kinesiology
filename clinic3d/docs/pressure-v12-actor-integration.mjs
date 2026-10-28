// Actual source rig/IK versus pressure anchors, without a browser or GPU.
// node --experimental-vm-modules docs/pressure-v12-actor-integration.mjs [result.json]
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), base = path.resolve(here, '..');
const cache = new Map();
const resolve = (name, parent) => path.normalize(name === 'three' ? path.join(base, 'vendor/three/build/three.module.js') :
  name.startsWith('three/addons/') ? path.join(base, 'vendor/three/examples/jsm', name.slice(13)) : path.resolve(path.dirname(parent), name));
async function moduleAt(file) {
  file = path.normalize(file); if (cache.has(file)) return cache.get(file);
  const mod = new vm.SourceTextModule(await fs.readFile(file, 'utf8'), { identifier: file }); cache.set(file, mod);
  for (const name of mod.dependencySpecifiers) await moduleAt(resolve(name, file)); return mod;
}
const actorsModule = await moduleAt(path.join(base, 'actors.js')), pressureModule = await moduleAt(path.join(base, 'pressure-engine.js'));
await actorsModule.link((name, parent) => cache.get(resolve(name, parent.identifier)));
await pressureModule.link((name, parent) => cache.get(resolve(name, parent.identifier)));
await actorsModule.evaluate(); await pressureModule.evaluate();
const THREE = cache.get(path.join(base, 'vendor/three/build/three.module.js')).namespace;
const Loader = cache.get(path.join(base, 'vendor/three/examples/jsm/loaders/GLTFLoader.js')).namespace.GLTFLoader;
Loader.prototype.loadAsync = async function (url) {
  const bytes = await fs.readFile(path.join(base, url));
  return this.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
};
const { sampleWalking } = pressureModule.namespace;
const actors = await actorsModule.namespace.createActors(new THREE.Scene(), { modelUrl: 'assets/patient-motion.glb' });
const patient = actors.patient, origin = { x: -.1, z: 1.45 };
patient.setPose('standing', true); patient.setFootwear('barefoot').face(Math.PI);
let maxPlanarError = 0, maxXError = 0, maxZError = 0, maxErrorSample = null, samples = 0;
const stanceAnchors = new Map(); let maximumStanceDrift = 0;
const extremes = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
let outsideCells = 0, maximumUncapturedForce = 0;
const plates = [1.75, 1.2, .65, .1, -.45].map(z => ({ x: -.1, z, width: .784, length: .55 }));
for (let i = 0; i <= 400; i++) {
  const cycle = i / 200, frame = sampleWalking(cycle), rootZ = origin.z - .88 * cycle;
  patient.setGaitPhase(cycle % 1).setPosition([origin.x, 0, rootZ]); patient.root.updateMatrixWorld(true);
  for (const foot of frame.feet) {
    const bone = patient.bones.get(foot.side === 'right' ? 'foot.R' : 'foot.L');
    const actual = bone.getWorldPosition(new THREE.Vector3());
    const dx = Math.abs(actual.x - foot.centre.x), dz = Math.abs(actual.z - foot.centre.z), error = Math.hypot(dx, dz);
    if (error > maxPlanarError) { maxPlanarError = error; maxErrorSample = { cycle, side: foot.side, actual: actual.toArray(), expected: foot.centre }; }
    maxXError = Math.max(maxXError, dx); maxZError = Math.max(maxZError, dz); samples++;
    if (foot.contact) {
      const key = foot.side + ':' + frame.gait[foot.side].lastInitialContact + ':' + Math.floor(cycle);
      if (stanceAnchors.has(key)) maximumStanceDrift = Math.max(maximumStanceDrift, actual.distanceTo(stanceAnchors.get(key)));
      else stanceAnchors.set(key, actual);
    }
  }
  let uncaptured = 0;
  for (const cell of frame.cells) {
    if (cell.force <= 1e-12) continue;
    const { x, z } = cell.world;
    extremes.minX = Math.min(extremes.minX, x); extremes.maxX = Math.max(extremes.maxX, x);
    extremes.minZ = Math.min(extremes.minZ, z); extremes.maxZ = Math.max(extremes.maxZ, z);
    if (!plates.some(p => Math.abs(x - p.x) <= p.width / 2 + 1e-12 && Math.abs(z - p.z) <= p.length / 2 + 1e-12)) {
      outsideCells++; uncaptured += cell.force;
    }
  }
  maximumUncapturedForce = Math.max(maximumUncapturedForce, uncaptured);
}
const result = { schema: 'dxx-pressure-actor-integration-v12', frames: 401, actorFootSamples: samples,
  maximumPlanarFootAnchorErrorMetres: maxPlanarError, maximumXErrorMetres: maxXError, maximumZErrorMetres: maxZError,
  maximumStanceBoneDriftMetres: maximumStanceDrift, maximumErrorSample: maxErrorSample,
  plateProposal: plates, positiveCellWorldExtremesMetres: extremes, outsidePositiveCells: outsideCells, maximumUncapturedForce,
  scope: 'Actual independent GLB skeleton, project IK and five continuous proposed pressure surfaces; CPU transform and support coverage checks only, no clinical validation.' };
result.passed = maxPlanarError < .001 && maximumStanceDrift < .001 && outsideCells === 0 && maximumUncapturedForce < 1e-10;
if (process.argv[2]) await fs.writeFile(path.resolve(process.argv[2]), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1;
