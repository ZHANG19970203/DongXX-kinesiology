import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Exercises the actual driver's setAngle function with real Three.js matrices.
// It checks source integrity, neutral preservation, fixed bones, motion signs,
// clamping, static muscle mode and finite transformed coordinates, not anatomy.
const here = path.dirname(fileURLToPath(import.meta.url));
const clinic = path.resolve(here, '..');
const assembly = [path.resolve(clinic, '../assembly'), path.resolve(clinic, '../migration-site/assembly')].find(candidate => fs.existsSync(path.join(candidate, 'assets/geometry-manifest.json')));
if (!assembly) throw new Error('The complete website assembly assets are required.');
const source = fs.readFileSync(path.join(clinic, 'anatomy-viewer.js'), 'utf8');
const provenance = JSON.parse(fs.readFileSync(path.join(here, 'anatomy-v10-provenance.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(assembly, 'assets/geometry-manifest.json')));
const THREE = await import(pathToFileURL(path.join(clinic, 'vendor/three/build/three.module.js')));
const digest = data => createHash('sha256').update(data).digest('hex');
const buffers = new Map();
for (const index of [...provenance.requiredChunkIndices, ...provenance.optionalMuscleChunkIndices]) {
  const chunk = manifest.chunks[index];
  const buffer = fs.readFileSync(path.join(assembly, chunk.path));
  if (buffer.length !== chunk.bytes || digest(buffer) !== chunk.sha256) throw new Error(`Bad chunk ${index}`);
  buffers.set(index, buffer);
}
function getRange(offset, size) {
  const out = Buffer.alloc(size); let written = 0;
  for (const [index, buffer] of buffers) {
    const c = manifest.chunks[index], first = Math.max(offset, c.offset), end = Math.min(offset + size, c.offset + c.bytes);
    if (end > first) { buffer.copy(out, first - offset, first - c.offset, end - c.offset); written += end - first; }
  }
  if (written !== size) throw new Error('Missing geometry bytes'); return out;
}
function functionText(name) {
  const start = source.indexOf(`  function ${name}(`); if (start < 0) throw new Error(`Missing ${name}`);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end);
}
const motionText = source.slice(source.indexOf('const MOTION ='), source.indexOf('\nconst hex ='));
const atlas = new THREE.Group(), sagittalPivot = new THREE.Group(), frontalPivot = new THREE.Group();
sagittalPivot.position.fromArray(provenance.teachingDriver.dorsiflexion.pivot); atlas.add(sagittalPivot);
frontalPivot.position.fromArray(provenance.teachingDriver.inversion.pivot).sub(sagittalPivot.position); sagittalPivot.add(frontalPivot);
const loaded = [];
let vertices = 0, triangles = 0;
for (const row of provenance.assets) {
  const p = getRange(row.positions, row.vertexCount * 12), n = getRange(row.normals, row.vertexCount * 12), idx = getRange(row.indices, row.indexCount * 4);
  if (digest(Buffer.concat([p, n, idx])) !== row.sha256) throw new Error(`Bad asset ${row.id}`);
  const positions = new Float32Array(p.buffer, p.byteOffset, row.vertexCount * 3);
  if ([...positions].some(value => !Number.isFinite(value))) throw new Error(`Nonfinite source ${row.id}`);
  const indices = new Uint32Array(idx.buffer, idx.byteOffset, row.indexCount);
  if ([...indices].some(value => value >= row.vertexCount)) throw new Error(`Bad triangle ${row.id}`);
  vertices += row.vertexCount; triangles += row.indexCount / 3;
  const mesh = new THREE.Object3D();
  if (row.kind === 'muscle' || ['tibia', 'fibula'].includes(row.key)) atlas.add(mesh);
  else if (row.key === 'talus') { sagittalPivot.add(mesh); mesh.position.fromArray(provenance.teachingDriver.dorsiflexion.pivot).negate(); }
  else { frontalPivot.add(mesh); mesh.position.fromArray(provenance.teachingDriver.inversion.pivot).negate(); }
  loaded.push({ row, mesh, positions });
}
const context = vm.createContext({ THREE, atlas, sagittalPivot, frontalPivot, range: {}, motionValue: {}, badge: {}, render() {}, options: {} });
vm.runInContext(`${motionText}\nlet disposed=false, motionKey='sagittal', motionAngle=0, muscleMode=false;\n${functionText('setAngle')}\nthis.drive=(key, angle, muscle=false)=>{motionKey=key;muscleMode=muscle;setAngle(angle);return motionAngle;};`, context);
const checks = [];
function assert(condition, message) { if (!condition) throw new Error(message); checks.push(message); }
const epsilon = 1e-12; let transformedPoints = 0, maxNeutralError = 0;
for (const mode of ['sagittal', 'frontal']) {
  const limits = mode === 'sagittal' ? [-25, -10, 0, 10, 20] : [-12, -6, 0, 6, 12];
  for (const degrees of limits) {
    context.drive(mode, degrees);
    for (const { row, mesh, positions } of loaded) {
      for (let i = 0; i < positions.length; i += 3) {
        const rest = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        const point = mesh.localToWorld(rest.clone()); transformedPoints++;
        if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error(`Nonfinite transformed ${row.id}`);
        if (degrees === 0) maxNeutralError = Math.max(maxNeutralError, point.distanceTo(rest));
        if (row.kind === 'muscle' || ['tibia', 'fibula'].includes(row.key) || (mode === 'frontal' && row.key === 'talus')) {
          if (point.distanceTo(rest) > epsilon) throw new Error(`A fixed structure moved: ${row.id} ${mode}`);
        }
      }
    }
  }
}
assert(maxNeutralError < epsilon, 'All source vertices retain neutral atlas coordinates');
assert(true, 'Tibia/fibula fixed in both modes; talus fixed in frontal mode; muscle meshes fixed');
context.drive('sagittal', 15);
const p = new THREE.Vector3(...provenance.teachingDriver.dorsiflexion.pivot);
const anterior = new THREE.Vector3(p.x, p.y, p.z + .1);
const foot = loaded.find(x => x.row.key === 'mt1').mesh;
assert(foot.localToWorld(anterior.clone()).y > anterior.y, 'Positive dorsiflexion raises anterior foot');
context.drive('frontal', 10);
const q = new THREE.Vector3(...provenance.teachingDriver.inversion.pivot);
const medial = new THREE.Vector3(q.x + .02, q.y, q.z + .06);
assert(foot.localToWorld(medial.clone()).y > medial.y, 'Positive inversion raises medial edge of right foot');
assert(context.drive('sagittal', 200) === 20 && context.drive('frontal', -200) === -12, 'Driver clamps teaching angles');
assert(context.drive('sagittal', NaN) === 0, 'Nonfinite control input resets to neutral');
assert(context.drive('frontal', 10, true) === 0, 'Muscle mode forces neutral bone geometry');
const report = { schema: 'dxx-anatomy-v10-driver-check', passed: true, assets: loaded.length, bones: loaded.filter(x => x.row.kind === 'bone').length, muscles: loaded.filter(x => x.row.kind === 'muscle').length, vertices, triangles, transformedPoints, maxNeutralError, chunkIntegrity: 'SHA-256 for chunks 0 and 12', assetIntegrity: 'SHA-256 of source positions + normals + indices for all 35 assets', checks, limitation: 'Numerical/structural verification only; no clinical registration, anatomical contact/axis validation, muscle dynamics or professional teaching sign-off.' };
const output = process.argv[2]; if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
