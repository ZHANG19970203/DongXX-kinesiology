import * as THREE from 'three';

// Original procedural scene props. All coordinates are metres, Y up.
// Room coordinates: x = plan x - 2.25, z = plan y - 3; support surfaces Y = 0.
export function createClinicRoom(scene) {
  const room = new THREE.Group();
  room.name = 'FootAndAnkleTeachingRoom';
  scene.add(room);
  const objects = {};
  const textures = new Set();
  const materials = new Set();
  const geometries = new Set();
  const mats = {};

  function material(name, color, options = {}) {
    if (mats[name]) return mats[name];
    const value = new THREE.MeshStandardMaterial({ color, roughness: .76, ...options });
    mats[name] = value; materials.add(value); return value;
  }
  const white = material('warm-white', 0xf1eee7);
  const edge = material('cabinet-edge', 0xd8ddda);
  const steel = material('satin-steel', 0xa3afb0, { metalness: .6, roughness: .34 });
  const dark = material('graphite', 0x283b45, { roughness: .65 });
  const blue = material('clinical-blue', 0x5a94ad);
  const fabric = material('blue-fabric', 0x9fc2d1, { roughness: .96 });
  const blueDark = material('deep-blue', 0x235d76);
  const rubber = material('rubber', 0x263237, { roughness: .96 });
  const wood = material('pale-wood', 0xb5a389);
  const cream = material('anatomy-prop', 0xe4dac3);
  const teal = material('teal', 0x3f8e90);
  const red = material('red-accent', 0xca7667);
  const glass = material('frosted-glass', 0xcbdfe0, { transparent: true, opacity: .48, roughness: .2 });

  function mesh(geometry, mat, position, parent = room, name = '') {
    geometries.add(geometry);
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(...position);
    item.castShadow = true; item.receiveShadow = true;
    if (name) item.name = name;
    parent.add(item); return item;
  }
  function box(size, position, mat, parent = room, name = '') {
    return mesh(new THREE.BoxGeometry(...size), mat, position, parent, name);
  }
  function cyl(radius, height, position, mat, parent = room, segments = 24) {
    return mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat, position, parent);
  }
  function sphere(size, position, mat, parent = room) {
    const item = mesh(new THREE.SphereGeometry(1, 24, 14), mat, position, parent);
    item.scale.set(...size); return item;
  }
  function barBetween(a, b, radius, mat, parent = room) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    const delta = bv.clone().sub(av);
    const item = cyl(radius, delta.length(), av.clone().add(bv).multiplyScalar(.5).toArray(), mat, parent, 16);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return item;
  }
  function group(name, position = [0, 0, 0], parent = room) {
    const value = new THREE.Group(); value.name = name; value.position.set(...position);
    parent.add(value); return value;
  }
  function roundedSlab(w, d, h, radius, position, mat, parent = room) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -d / 2, r = Math.min(radius, w / 2, d / 2);
    shape.moveTo(x + r, y); shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + d - r); shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    shape.lineTo(x + r, y + d); shape.quadraticCurveTo(x, y + d, x, y + d - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 5 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -h / 2, 0);
    return mesh(geo, mat, position, parent);
  }
  function canvasTexture(draw, width = 1024, height = 768) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); draw(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4; textures.add(texture); return texture;
  }
  function panelTexture(title, subtitle, draw, w = 768, h = 1024) {
    return canvasTexture((ctx, width, height) => {
      ctx.fillStyle = '#f8faf8'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#316579'; ctx.fillRect(0, 0, width, 18);
      ctx.textAlign = 'center'; ctx.fillStyle = '#294b59';
      ctx.font = '600 46px "Microsoft YaHei",sans-serif'; ctx.fillText(title, width / 2, 92);
      ctx.font = '25px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#6c8389';
      ctx.fillText(subtitle, width / 2, 143);
      if (draw) draw(ctx, width, height);
      ctx.fillStyle = '#e5edeb'; ctx.fillRect(36, height - 92, width - 72, 2);
      ctx.fillStyle = '#70868a'; ctx.font = '22px "Microsoft YaHei",sans-serif';
      ctx.fillText('观察 · 比较 · 记录', width / 2, height - 42);
    }, w, h);
  }
  function picture(texture, w, h, position, yaw = 0, parent = room, frame = true) {
    const value = group('WallGraphic', position, parent); value.rotation.y = yaw;
    if (frame) box([w + .024, h + .024, .024], [0, 0, -.012], steel, value);
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, side: THREE.FrontSide });
    materials.add(mat);
    mesh(new THREE.PlaneGeometry(w, h), mat, [0, 0, .002], value);
    return value;
  }
  function label(text, w, h, position, yaw = 0, parent = room, background = '#f1f5f3', color = '#3a6474') {
    const texture = canvasTexture((ctx, cw, ch) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 42px "Microsoft YaHei",sans-serif';
      ctx.fillText(text, cw / 2, ch / 2, cw - 35);
    }, 768, 190);
    return picture(texture, w, h, position, yaw, parent, false);
  }

  // All five pressure teaching plates share the floor support plane (Y=0).
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-2.25, -3); floorShape.lineTo(2.25, -3);
  floorShape.lineTo(2.25, 3); floorShape.lineTo(-2.25, 3); floorShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-.5, -2.025); hole.lineTo(-.5, .725); hole.lineTo(.3, .725); hole.lineTo(.3, -2.025); hole.closePath();
  floorShape.holes.push(hole);
  const floorGeo = new THREE.ShapeGeometry(floorShape); floorGeo.rotateX(-Math.PI / 2);
  mesh(floorGeo, material('pvc-floor', 0xcbd2d0, { roughness: .93 }), [0, 0, 0], room, 'FloorY0');
  box([4.52, .10, 6.02], [0, -.06, 0], material('floor-plinth', 0xb5bfbd));
  const pressure = group('FlushPressureWalkway');
  objects.pressureWalkSurfaces = [];
  const pressureSurface = material('pressure-surface', 0x293d45, { roughness: .88 });
  [1.75, 1.20, .65, .10, -.45].forEach((z, index) => {
    box([.80, .018, .55], [-.1, -.009, z], steel, pressure, `PressurePlateFrame${index+1}`);
    // A horizontal plane can receive the host's pressure texture without a raised obstacle.
    const surfaceMat = pressureSurface.clone(); materials.add(surfaceMat);
    const surface = mesh(new THREE.PlaneGeometry(.784, .55), surfaceMat, [-.1, .00035, z], pressure, `PressureWalkSurface${index+1}`);
    surface.rotation.x = -Math.PI / 2; surface.castShadow = false;
    objects.pressureWalkSurfaces.push({mesh:surface, center:[-.1, .00035, z], width:.784, length:.55});
  });
  objects.pressurePlate = pressure;

  // Single interior-facing planes disappear from exterior viewpoints.
  const wallMat = material('clean-wall', 0xeeeae1, { side: THREE.FrontSide, roughness: .95 });
  function wall(w, h, position, yaw = 0) {
    const value = mesh(new THREE.PlaneGeometry(w, h), wallMat, position);
    value.rotation.y = yaw; value.castShadow = false; return value;
  }
  wall(.15, 2.8, [-2.175, 1.4, -3]);
  wall(3.45, 2.8, [.525, 1.4, -3]);
  wall(.9, .65, [-1.65, 2.475, -3]);
  wall(6, 2.8, [-2.25, 1.4, 0], Math.PI / 2);
  wall(6, 2.8, [2.25, 1.4, 0], -Math.PI / 2);
  box([.018, .08, 6], [-2.24, .04, 0], steel);
  box([.018, .08, 6], [2.24, .04, 0], steel);
  box([3.45, .08, .018], [.525, .04, -2.99], steel);
  box([.15, .08, .018], [-2.175, .04, -2.99], steel);
  // Minimal seams and high ventilation grilles keep walls calm.
  for (const x of [-.9, .55, 2]) box([.004, 2.65, .002], [x, 1.44, -2.994], material('seam', 0xe1e0d8));
  for (const z of [-1.7, .05, 1.8]) {
    const vent = group('VentilationGrille', [2.235, 2.52, z]);
    box([.012, .13, .48], [0, 0, 0], edge, vent);
    for (let i = 0; i < 5; i++) box([.015, .008, .42], [-.006, -.045 + i * .022, 0], steel, vent);
  }

  // Door leaf is held open inside the northwest corner; reference layout is fixed.
  const doorFrame = group('NorthDoor');
  for (const x of [-2.12, -1.18]) box([.045, 2.17, .07], [x, 1.085, -2.98], edge, doorFrame);
  box([.985, .055, .07], [-1.65, 2.16, -2.98], edge, doorFrame);
  const leaf = group('OpenDoorLeaf', [-2.10, 0, -2.965], doorFrame);
  leaf.rotation.y = -Math.PI * .43;
  box([.87, 2.10, .035], [.435, 1.05, 0], white, leaf);
  box([.29, 1.12, .039], [.25, 1.38, 0], glass, leaf);
  box([.13, .028, .06], [.75, .96, .035], steel, leaf);
  label('运动康复评估室', .70, .15, [-1.65, 2.32, -2.985]);
  objects.door = leaf;

  // Visible fixtures only; the host owns scene illumination and its settings.
  const led = material('led-diffuser', 0xf8fbf7, { emissive: 0xd6e1d7, emissiveIntensity: .35 });
  for (const x of [-1.05, 1.05]) for (const z of [-1.65, 1.05]) {
    box([.63, .022, .63], [x, 2.765, z], edge);
    box([.58, .009, .58], [x, 2.748, z], led);
  }
  for (const z of [-.25, 1.3]) {
    box([1.05, .022, .11], [-.1, 2.765, z], edge);
    box([.98, .009, .075], [-.1, 2.748, z], led);
  }

  const desk = group('ReceptionDesk', [1.30, 0, -1.80]);
  roundedSlab(1.6, .8, .055, .045, [0, .7225, 0], white, desk);
  box([1.43, .05, .69], [0, .665, 0], edge, desk);
  box([.40, .61, .67], [.53, .335, -.015], white, desk);
  for (let i = 0; i < 3; i++) {
    box([.385, .003, .003], [.53, .22 + i * .18, .323], edge, desk);
    barBetween([.44, .29 + i * .18, .343], [.62, .29 + i * .18, .343], .007, steel, desk);
  }
  for (const x of [-.70, .73]) for (const z of [-.30, .30]) {
    box([.035, .64, .035], [x, .335, z], steel, desk);
    box([.046, .022, .046], [x, .011, z], rubber, desk);
  }
  const monitor = group('AssessmentMonitor', [.48, .75, .05], desk);
  monitor.rotation.y = Math.PI;
  cyl(.09, .016, [0, .008, .015], dark, monitor);
  box([.037, .16, .035], [0, .09, -.012], steel, monitor);
  roundedSlab(.60, .36, .035, .015, [0, .30, 0], dark, monitor).rotation.x = Math.PI / 2;
  const normalScreen = panelTexture('足踝生物力学评估', '运动康复 · 教学病例', (ctx, w, h) => {
    const cards = ['接诊记录', '运动观察', '足压判读'];
    ctx.textAlign = 'left';
    cards.forEach((text, i) => {
      ctx.fillStyle = i ? '#edf2ef' : '#dcebe8'; ctx.fillRect(55, 210 + i * 115, w - 110, 82);
      ctx.fillStyle = '#4c727a'; ctx.font = '36px "Microsoft YaHei",sans-serif'; ctx.fillText(text, 98, 263 + i * 115);
    });
  }, 1024, 650);
  const screenMat = new THREE.MeshStandardMaterial({ map: normalScreen, roughness: .8, emissive: 0x36484b, emissiveIntensity: .15 });
  materials.add(screenMat);
  const screen = mesh(new THREE.PlaneGeometry(.557, .313), screenMat, [0, .30, .020], monitor);
  objects.monitor = screen;
  objects.monitorAssembly = monitor;
  const keyboard = group('ClinicianKeyboard',[.48,.76,-.24],desk);
  keyboard.rotation.y=Math.PI;
  roundedSlab(.30, .105, .009, .008, [0, 0, 0], dark, keyboard);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) box([.018, .002, .014], [-.12 + col * .021, .007, -.035 + row * .021], edge, keyboard);
  sphere([.025, .013, .042], [.23, .765, -.24], dark, desk);
  // A portable clinical note board and pen. They rest directly on the desk;
  // no documentation tray or duplicate stationery is created.
  const clinicalNotes=group('PortableClinicalNotes',[.04,.76,.04],desk);
  box([.20,.012,.28],[0,0,0],steel,clinicalNotes,'ClinicalNoteBacking');
  const casePaper = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#375c6a'; ctx.font = '600 40px "Microsoft YaHei",sans-serif'; ctx.fillText('足踝评估记录', 45, 80);
    ctx.strokeStyle = '#dce2df'; ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(45, 140 + i * 50); ctx.lineTo(w - 45, 140 + i * 50); ctx.stroke(); }
  }, 480, 650);
  const paperMat = new THREE.MeshStandardMaterial({ map: casePaper, roughness: 1 }); materials.add(paperMat);
  const paper = mesh(new THREE.PlaneGeometry(.18,.25),paperMat,[0,.007,0],clinicalNotes,'ClinicalNotePaper');paper.rotation.x=-Math.PI/2;
  box([.065,.012,.022],[0,.012,-.133],dark,clinicalNotes,'ClinicalNoteClip');
  const clinicalPen=group('PortableClinicalPen',[.18,.771,.045],desk);clinicalPen.rotation.x=Math.PI/2;clinicalPen.rotation.z=-.10;
  const penBody=cyl(.004,.135,[0,0,0],dark,clinicalPen,12);penBody.name='ClinicalPenBarrel';
  const penTip=mesh(new THREE.ConeGeometry(.0035,.012,12),steel,[0,-.0735,0],clinicalPen,'ClinicalPenTip');penTip.rotation.z=Math.PI;
  box([.002,.035,.003],[.004,.040,0],steel,clinicalPen,'ClinicalPenPocketClip');
  objects.clinicalNotes=clinicalNotes;objects.clinicalPen=clinicalPen;
  objects.documentationDeskParent=desk;
  const goniometerMat = material('clear-plastic', 0xc2e2e5, { transparent: true, opacity: .6, roughness: .3 });
  box([.26, .37, .28], [-.53, .195, -.09], dark, desk);
  box([.31, .18, .22], [.15, .10, -.10], white, desk);
  const wasteBin = group('CoveredPedalBin', [1.97, 0, -1.38]);
  cyl(.105, .31, [0, .17, 0], material('bin-gray', 0x9da9a8), wasteBin);
  cyl(.111, .023, [0, .337, 0], edge, wasteBin);
  box([.095, .012, .045], [0, .022, .105], dark, wasteBin);
  barBetween([0, .04, .082], [0, .30, .082], .006, steel, wasteBin);
  objects.desk = desk;

  function stool(name, x, z) {
    const value = group(name, [x, 0, z]);
    roundedSlab(.40, .40, .045, .065, [0, .4275, 0], blue, value);
    for (const dx of [-.15, .15]) for (const dz of [-.15, .15]) {
      barBetween([dx * 1.12, .022, dz * 1.12], [dx, .41, dz], .012, steel, value);
      box([.035, .025, .035], [dx * 1.12, .0125, dz * 1.12], rubber, value);
    }
    for (const dx of [-.15, .15]) barBetween([dx, .19, -.15], [dx, .19, .15], .009, steel, value);
    return value;
  }
  objects.patientStool = stool('PatientStool', .80, -.79);
  objects.spareStool = stool('SpareStoolAtEastWall', 1.87, -.50);
  objects.examStool = stool('BedsideExaminationStool', -1.03, .05);
  const chair = group('ClinicianChair', [1.30, 0, -2.72]);
  cyl(.036, .31, [0, .255, 0], steel, chair);
  roundedSlab(.46, .43, .075, .07, [0, .4125, 0], dark, chair);
  const back = box([.43, .45, .045], [0, .73, -.18], dark, chair); back.rotation.x = .10;
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * .4;
    const x = Math.cos(angle) * .245, z = Math.sin(angle) * .245;
    barBetween([0, .15, 0], [x, .07, z], .018, dark, chair);
    const wheel = cyl(.027, .035, [x, .027, z], rubber, chair, 12); wheel.rotation.z = Math.PI / 2;
  }
  for (const x of [-.27, .27]) {
    box([.025, .19, .025], [x, .58, .015], steel, chair);
    roundedSlab(.065, .27, .035, .025, [x, .685, .0], dark, chair);
  }
  objects.clinicianChair = chair;

  const bed = group('ExaminationBed', [-1.75, 0, .05]);
  roundedSlab(.70, 1.90, .11, .055, [0, .655, 0], fabric, bed);
  roundedSlab(.72, 1.92, .028, .04, [0, .584, 0], white, bed);
  box([.60, .045, 1.68], [0, .51, 0], steel, bed);
  for (const x of [-.25, .25]) for (const z of [-.74, .74]) {
    box([.045, .49, .045], [x, .265, z], steel, bed);
    box([.065, .025, .065], [x, .0125, z], rubber, bed);
  }
  roundedSlab(.48, .34, .085, .09, [0, .75, -.65], material('pillow-white', 0xe7eff0), bed);
  box([.68, .012, .25], [0, .716, .70], material('bed-runner', 0x709eb0), bed);
  box([.018, .21, .24], [-.35, .605, .70], mats['bed-runner'], bed);
  box([.018, .21, .24], [.35, .605, .70], mats['bed-runner'], bed);
  barBetween([-.20, .38, -.74], [.20, .38, -.74], .02, steel, bed);
  barBetween([-.20, .38, .74], [.20, .38, .74], .02, steel, bed);
  objects.examBed = bed;

  const lamp = group('WallExaminationLamp', [-2.20, 1.31, -.81]);
  lamp.visible = false;
  box([.055, .16, .12], [0, 0, 0], white, lamp);
  const lampCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, .05, 0), new THREE.Vector3(.16, .22, 0),
    new THREE.Vector3(.44, .24, .04), new THREE.Vector3(.51, .09, .08)
  ]);
  mesh(new THREE.TubeGeometry(lampCurve, 20, .013, 8, false), steel, [0, 0, 0], lamp);
  const lampShade = mesh(new THREE.ConeGeometry(.09, .09, 24, 1, true), white, [.51, .06, .08], lamp);
  lampShade.rotation.z = Math.PI;

  const trolley = group('BedsideTrolley', [-1.075, 0, 1.45]);
  for (const y of [.26, .76]) {
    roundedSlab(.45, .50, .024, .022, [0, y, 0], steel, trolley);
    for (const x of [-.215, .215]) box([.009, .045, .48], [x, y + .025, 0], steel, trolley);
    for (const z of [-.24, .24]) box([.42, .045, .009], [0, y + .025, z], steel, trolley);
  }
  for (const x of [-.195, .195]) for (const z of [-.22, .22]) {
    barBetween([x, .07, z], [x, .83, z], .012, steel, trolley);
    const wheel = cyl(.035, .023, [x, .038, z], rubber, trolley, 16); wheel.rotation.z = Math.PI / 2;
  }
  // Keep clinical tools here, without duplicate notebook/pen stand-ins.
  const gon = mesh(new THREE.CircleGeometry(.055,24,0,Math.PI),goniometerMat,[.10,.79,.12],trolley,'StoredGoniometer');gon.rotation.x=-Math.PI/2;
  cyl(.004,.004,[.10,.793,.12],steel,trolley);
  box([.08,.004,.10],[-.12,.79,.10],white,trolley,'SealedSwabPackets');
  roundedSlab(.18, .18, .035, .02, [.08, .30, .09], material('yoga-block', 0x7b8d94), trolley);
  roundedSlab(.18, .18, .035, .02, [-.10, .30, -.09], mats['yoga-block'], trolley);
  objects.trolley = trolley;

  // Original atlas renders of verified BodyParts3D/Somakine source meshes.
  // Data attribution and exact per-poster mesh IDs: docs/v12-anatomy-posters.json.
  const posterLoader = new THREE.TextureLoader();
  const atlasPosters = [
    ['human-skeleton.png', '人体骨与关节'],
    ['human-muscles.png', '骨骼肌解剖'],
    ['ankle-muscles.png', '小腿与足踝骨肌']
  ];
  objects.anatomyPosters = [];
  for (const [i, [file, title]] of atlasPosters.entries()) {
    const texture = posterLoader.load(new URL(`./assets/posters/${file}`, import.meta.url).href);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; textures.add(texture);
    const poster = picture(texture, .60, .90, [-2.239, 1.95, -.75+i*.69], Math.PI/2);
    poster.name = `LicensedAnatomyPoster${i+1}`; poster.userData.title = title;
    objects.anatomyPosters.push(poster);
  }

  // Short observation line: 2.5 m; the instrument occupies part of this line.
  const line = group('ShortObservationLine');
  const marking = material('guide-marking', 0x4e6368);
  box([.05,.0006,1.75],[-.1,.0003,.025],marking,line);
  const yellow = material('safety-marking',0xbfa65d);
  for(const x of [-.60,.40]) for(let i=0;i<12;i++) box([.022,.0006,.105],[x,.0003,-.79+i*.215],yellow,line);
  for(const z of [-.85,.40,1.65]) {
    const point=mesh(new THREE.CircleGeometry(.015,20),red,[-.1,.0007,z],line);point.rotation.x=-Math.PI/2;
  }
  objects.observationLine=line;
  const sign = group('NaturalWalkingPrompt',[1.00,0,1.74]);
  box([.22,.012,.17],[0,.006,0],steel,sign);barBetween([0,.014,0],[0,.88,0],.012,steel,sign);
  label('自然行走 · 不凑步踩板',.32,.20,[0,1.0,0],0,sign,'#f4f6f1');
  objects.pressurePrompt=sign;
  // Wall-mounted observation cameras do not obstruct the floor activity band.
  for(const side of [-1,1]) {
    const camera=group('WallObservationCamera',[side*2.20,1.40,.10]);
    barBetween([0,0,0],[-side*.11,0,0],.013,steel,camera);
    const cameraBody=box([.10,.075,.13],[-side*.15,0,0],white,camera);cameraBody.rotation.y=side*Math.PI/2;
    const lens=cyl(.023,.025,[-side*.21,0,0],dark,camera,20);lens.rotation.z=Math.PI/2;
  }

  const shelf=group('TeachingShelf',[1.825,0,2.0]);
  for(const y of [.22,.79,1.36,1.93]) roundedSlab(.55,1.60,.035,.02,[0,y,0],wood,shelf);
  for(const x of [-.25,.25]) for(const z of [-.76,.76]) box([.025,1.95,.025],[x,.985,z],dark,shelf);
  function footProp(position,scale=1,parent=shelf) {
    const foot=group('OriginalFootSilhouetteProp',position,parent);foot.scale.setScalar(scale);
    sphere([.055,.045,.125],[0,.05,.02],cream,foot);sphere([.045,.075,.055],[0,.09,-.055],cream,foot);
    box([.061,.14,.058],[0,.17,-.065],cream,foot);
    for(let i=0;i<5;i++) sphere([.012-i*.001,.015,.024-i*.002],[.042-i*.021,.036,.13-i*.004],cream,foot);
    roundedSlab(.16,.28,.018,.025,[0,.009,.035],dark,foot);
    return foot;
  }
  // Light anatomy props stay above the exercise equipment; heavy weights stay low.
  // Shelf boards are 35 mm thick, so these are their exact support surfaces.
  const shelfSurfaces=[.2375,.8075,1.3775,1.9475];
  footProp([0,shelfSurfaces[3],-.23],1.55);
  for(let i=0;i<3;i++) footProp([0,shelfSurfaces[2],-.54+i*.52],.73);
  ['力量器材','弹力与放松','足弓对照','足踝教具'].forEach((text,i)=>
    label(text,.34,.065,[-.285,[.22,.79,1.36,1.93][i]-.055,0],-Math.PI/2,shelf));

  const equipment=group('OriginalRehabilitationEquipment',[0,0,0],shelf);
  const weightIron=material('powder-coated-weight',0x2f424b,{metalness:.22,roughness:.78});
  const weightTeal=material('teal-kettlebell',0x417d7c,{metalness:.18,roughness:.72});
  const weightAccent=material('weight-collar',0x739898,{metalness:.35,roughness:.5});
  const gripMetal=material('dumbbell-grip',0x9aa6aa,{metalness:.75,roughness:.4});
  function kettlebell(name,z,scale,bodyMat) {
    const value=group(name,[0,shelfSurfaces[0],z],equipment);value.scale.setScalar(scale);
    const profile=[[0,0],[.053,0],[.074,.018],[.086,.065],[.082,.11],[.064,.145],[.035,.15],[0,.15]];
    mesh(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),28),bodyMat,[0,0,0],value,'FlatBaseKettlebellBody');
    const handle=mesh(new THREE.TorusGeometry(.056,.012,12,32),weightIron,[0,.18,0],value,'OpenKettlebellHandle');
    handle.rotation.y=Math.PI/2;
    // The circular ring is visible from the aisle, with its lower part seated in the bell.
    return value;
  }
  kettlebell('TealKettlebell',-.56,1,weightTeal);
  kettlebell('GraphiteKettlebell',-.29,.86,weightIron);
  function dumbbell(name,z) {
    const radius=.062,halfHeight=radius*Math.sqrt(3)/2;
    const value=group(name,[0,shelfSurfaces[0]+halfHeight,z],equipment);
    const shape=new THREE.Shape();
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3,x=radius*Math.cos(a),y=radius*Math.sin(a);
      if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
    shape.closePath();
    for(const end of [-1,1]) {
      const geo=new THREE.ExtrudeGeometry(shape,{depth:.060,bevelEnabled:false});geo.translate(0,0,-.030);
      mesh(geo,weightIron,[0,0,end*.095],value,'FlatHexDumbbellEnd');
      const collar=cyl(.023,.006,[0,0,end*.064],weightAccent,value,20);collar.rotation.x=Math.PI/2;
    }
    const handle=cyl(.014,.160,[0,0,0],gripMetal,value,20);handle.rotation.x=Math.PI/2;
    for(let i=0;i<9;i++) {
      const ring=mesh(new THREE.TorusGeometry(.0143,.0008,4,16),steel,[0,0,-.052+i*.013],value,'GripRing');
      ring.rotation.y=0;
    }
    return value;
  }
  dumbbell('HexDumbbellA',.20);dumbbell('HexDumbbellB',.55);

  const ballTray=group('MassageBallTray',[0,shelfSurfaces[1],-.51],equipment);
  roundedSlab(.32,.36,.012,.024,[0,.006,0],edge,ballTray);
  for(const z of [-.173,.173])box([.28,.016,.008],[0,.020,z],edge,ballTray);
  for(const x of [-.153,.153])box([.008,.016,.34],[x,.020,0],edge,ballTray);
  const ballOrange=material('massage-ball-coral',0xc17856,{roughness:.96});
  const ballBlue=material('massage-ball-blue',0x4f8299,{roughness:.96});
  const massageBall=group('SpikedMassageBall',[-.026,.012+.048,-.075],ballTray);
  sphere([.042,.042,.042],[0,0,0],ballOrange,massageBall);
  const spikeGeo=new THREE.ConeGeometry(.005,.010,5);
  const directions=[new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0)];
  for(let i=0;i<48;i++) {
    const y=1-2*(i+.5)/48,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y);
    directions.push(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));
  }
  for(const direction of directions) {
    const spike=mesh(spikeGeo,ballOrange,direction.clone().multiplyScalar(.043).toArray(),massageBall,'SoftMassageNub');
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
  }
  sphere([.045,.045,.045],[-.026,.012+.045,.072],ballBlue,ballTray).name='SmoothFasciaBall';

  // Flat rectangular band cross-sections, rather than tube-shaped torus substitutes.
  const bandGroup=group('FlatLoopResistanceBands',[0,shelfSurfaces[1],.045],equipment);
  const bandMats=[material('loop-band-teal',0x528d89,{roughness:.96}),
    material('loop-band-coral',0xc57e70,{roughness:.96}),
    material('loop-band-gold',0xb3a464,{roughness:.96})];
  bandMats.forEach((mat,i)=>{
    const outline=new THREE.Shape();outline.absellipse(0,0,.088,.123,0,Math.PI*2,false,0);
    const inside=new THREE.Path();inside.absellipse(0,0,.081,.116,0,Math.PI*2,true,0);outline.holes.push(inside);
    const geo=new THREE.ExtrudeGeometry(outline,{depth:.032,bevelEnabled:false,curveSegments:36});
    geo.rotateX(-Math.PI/2);
    mesh(geo,mat,[0,i*.033,0],bandGroup,'FlatElasticLoop');
  });
  const foldedBand=roundedSlab(.16,.042,.006,.009,[-.08,.004,.15],bandMats[0],bandGroup);
  foldedBand.rotation.y=-.16;foldedBand.name='FoldedBandTail';
  const slantSupport=.16*Math.sin(.12)+.0275*Math.cos(.12);
  const slant=box([.32,.055,.35],[0,shelfSurfaces[1]+slantSupport,.55],material('slant-board',0x879a93),shelf);slant.rotation.z=-.12;
  const padStored=roundedSlab(.43,.42,.055,.025,[0,shelfSurfaces[3]+.0275,.50],teal,shelf);
  equipment.userData={origin:'Original procedural geometry, no third-party asset',
    inventory:{kettlebells:2,hexDumbbells:2,spikedMassageBalls:1,smoothFasciaBalls:1,flatResistanceLoops:3},
    shelfSupportY:shelfSurfaces.slice(0,2)};
  objects.teachingShelf=shelf;
  objects.rehabilitationEquipment=equipment;

  const whiteboardTexture=panelTexture('足踝评估要点','从症状到功能', (ctx,w)=>{
    ctx.textAlign='left';ctx.fillStyle='#3c6e76';ctx.font='35px "Microsoft YaHei",sans-serif';
    ['足弓：观察负重变化','足压：分布与时间','稳定：结构与运动控制','判断：结合症状和功能'].forEach((t,i)=>ctx.fillText(t,65,290+i*128,w-110));
  },768,900);
  picture(whiteboardTexture,.64,.80,[2.237,1.83,1.12],-Math.PI/2);
  label('运动康复 · 足踝生物力学',1.50,.23,[.75,2.38,-2.987]);

  // Optional support props are only present in the selected activity.
  const balanceMat=group('OptionalBalanceMat',[-.1,0,-.20]);
  roundedSlab(.6,.6,.06,.025,[0,.03,0],teal,balanceMat);balanceMat.visible=false;
  objects.balanceMat=balanceMat;
  const supportRail=group('TemporarySupportedExerciseRail',[-.1,0,-.20]);
  barBetween([-.60,1.0,.35],[.60,1.0,.35],.028,wood,supportRail);
  for(const x of [-.57,.57]) {
    barBetween([x,.03,.35],[x,.98,.35],.019,steel,supportRail);
    box([.065,.026,.38],[x,.013,.35],rubber,supportRail);
  }
  supportRail.visible=false;objects.supportRail=supportRail;
  const wallMarker=group('WallLungeReference',[-.25,0,-2.987]);
  for(let i=0;i<6;i++) box([.01,.002,.012],[0,.002,.09+i*.1],teal,wallMarker);
  wallMarker.visible=false;objects.wallLungeMarker=wallMarker;

  function zoneMarker(name,x,z,w,d) {
    const value=group(name,[x,0,z]);const m=material('activity-marker',0x6ba5a5,{emissive:0x1f5659,emissiveIntensity:.12});
    const segment=.16;
    for(const sx of [-1,1]) for(const sz of [-1,1]) {
      box([segment,.0006,.012],[sx*(w/2-segment/2),.0008,sz*d/2],m,value);
      box([.012,.0006,segment],[sx*w/2,.0008,sz*(d/2-segment/2)],m,value);
    }
    value.visible=false;return value;
  }
  const markers={
    reception:zoneMarker('ReceptionActivity',.80,-.85,.54,.54),
    static:zoneMarker('ExaminationActivity',-1.03,.05,.63,1.62),
    gait:zoneMarker('ObservationActivity',-.1,.40,.83,2.60),
    pressure:zoneMarker('PressureActivity',-.1,.65,.83,2.75),
    balance:zoneMarker('BalanceActivity',-.1,-.20,.73,.73),
    teaching:zoneMarker('TeachingActivity',1.0,1.93,.72,.82),
    wall:zoneMarker('WallLungeActivity',-.25,-2.25,.65,.70)
  };
  objects.zoneMarkers=markers;
  objects.root=room;
  objects.storedBalancePad=padStored;

  const anchors={
    patientStand:[-.1,0,-.5],
    patientSeat:[.80,0,-.85],
    therapistSeat:[1.30,0,-2.66],
    entrance:[-1.65,0,-2.0],
    wallLunge:[-.25,0,-2.25],
    balance:[-.1,0,-.20],
    pressure:[-.1,0,1.1],
    pressureStand:[-.1,0,1.1],
    pressureWalkStart:[-.1,0,1.45],
    pressureWalkEnd:[-.1,0,-.31],
    staticExam:[-1.03,0,.05],
    examSeat:[-.97,0,.05],
    examTherapist:[.15,0,.05],
    teaching:[1.0,0,1.93],
    therapistProtection:[.65,0,-.025],
    documentationDesk:{notes:[1.34,.76,-1.76],pen:[1.48,.771,-1.755]},
    equipmentView:{position:[-1.25,1.53,1.92],target:[1.825,1.46,2.0]}
  };
  function setActivity(activity) {
    const config=typeof activity==='string'?{id:activity}:activity||{};
    const key=String(config.zone||config.id||config.activity||'').toLowerCase();
    for(const value of Object.values(markers)) value.visible=false;
    balanceMat.visible=false;supportRail.visible=false;wallMarker.visible=false;padStored.visible=true;
    let selected='';
    if(/reception|intake|interview|act1|幕1|接诊/.test(key)) selected='reception';
    else if(/lunge|wall|膝触/.test(key)) selected='wall';
    else if(/pressure|plantar|act4|幕4|足压/.test(key)) selected='pressure';
    else if(/balance|act5|幕5|平衡/.test(key)) selected='balance';
    else if(/gait|walk|act3|幕3|步态/.test(key)) selected='gait';
    else if(/plan|teach|act6|幕6|方案/.test(key)) selected='teaching';
    else if(/static|ankle|exam|act2|幕2|局部/.test(key)) selected='static';
    if(markers[selected]) markers[selected].visible=true;
    lamp.visible=selected==='static';
    wallMarker.visible=selected==='wall';
    balanceMat.visible=selected==='balance'&&(config.mat===true||/soft|foam|mat|软垫/.test(key));
    padStored.visible=!balanceMat.visible;
    supportRail.visible=/heel|提踵/.test(key)||config.supportRail===true;
    return {zone:selected,matVisible:balanceMat.visible,supportRailVisible:supportRail.visible};
  }
  function dispose() {
    scene.remove(room);
    for(const geometry of geometries) geometry.dispose();
    for(const mat of materials) mat.dispose();
    for(const texture of textures) texture.dispose();
  }
  return {anchors,objects,setActivity,dispose};
}
