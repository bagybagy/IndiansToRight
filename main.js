import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfffdf6);

const camera = new THREE.OrthographicCamera(-7.2, 7.2, 4.6, -4.6, 0.1, 100);
camera.position.set(0, 6.0, -8.2);
camera.lookAt(0, 0.15, 0);

const C = {
  ink: 0x050505,
  paper: 0xfffdf6,
  bus: 0xffc20a,
  cyan: 0x13c4c7,
  pink: 0xf00658,
  orange: 0xff9f05,
  white: 0xffffff,
  glass: 0x061015,
  road: 0x303033,
  shadow: 0x171717
};

const mat = {
  ink: basic(C.ink),
  road: basic(C.road),
  shadow: basic(C.shadow, 0.55),
  bus: basic(C.bus),
  cyan: basic(C.cyan),
  pink: basic(C.pink),
  orange: basic(C.orange),
  white: basic(C.white),
  glass: basic(C.glass)
};

function basic(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
    toneMapped: false,
    side: THREE.DoubleSide
  });
}

function mesh(geo, material, parent, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  parent.add(m);
  return m;
}

function box(w, h, d, material, parent, pos, rot, scale) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, parent, pos, rot, scale);
}

function cyl(r1, r2, h, material, parent, pos, rot, segments = 24) {
  return mesh(new THREE.CylinderGeometry(r1, r2, h, segments), material, parent, pos, rot);
}

function sphere(r, material, parent, pos, scale = [1, 1, 1]) {
  return mesh(new THREE.SphereGeometry(r, 16, 10), material, parent, pos, [0, 0, 0], scale);
}

const world = new THREE.Group();
scene.add(world);

const roadRoot = new THREE.Group();
world.add(roadRoot);

const busRig = new THREE.Group();
world.add(busRig);

const bus = new THREE.Group();
busRig.add(bus);

const passengerRoot = new THREE.Group();
bus.add(passengerRoot);

const fxRoot = new THREE.Group();
world.add(fxRoot);

const maxPassengers = 150;
const passengers = [];
let roadMesh;
const laneMarks = [];
const arrows = [];
const notes = [];

let activeCount = 80;
let nextCurve = 1;
let currentCurve = 0;
let curvePhase = 0;
const curveDuration = 1.35;
let commandSide = 0;
let passengerCommand = 0;
let speedLevel = 1;
let danceMode = false;
let resultFlash = 0;
let roundTimer = 7.5;
let messageHold = 0;
let stampHold = 0;
let busRoll = 0;
let rollVelocity = 0;
let lateralDrift = 0;
let crashEnergy = 0;
let rolloverCooldown = 0;
let roadScroll = 0;
let last = performance.now();

const keys = new Set();

buildRoad();
buildBus();
buildPassengers();
buildEffects();
resetTargets(true);
resize();

const ui = {
  titleSide: document.querySelector('#titleSide'),
  curveCard: document.querySelector('#curveCard'),
  curveText: document.querySelector('#curveText'),
  passengerCount: document.querySelector('#passengerCount'),
  loadRate: document.querySelector('#loadRate'),
  speedText: document.querySelector('#speedText'),
  comNeedle: document.querySelector('#comNeedle'),
  targetNeedle: document.querySelector('#targetNeedle'),
  stabilityText: document.querySelector('#stabilityText'),
  message: document.querySelector('#message'),
  stamp: document.querySelector('#resultStamp')
};

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === 'Space') judgeCurve(true);
  if (event.code === 'KeyR') resetGame();
});

window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('resize', resize);
requestAnimationFrame(tick);

function buildRoad() {
  roadMesh = mesh(new THREE.BufferGeometry(), mat.road, roadRoot);
  roadMesh.position.y = -0.72;
  for (let i = 0; i < 26; i++) {
    const mark = box(0.11, 0.07, 0.5, mat.white, roadRoot, [0, -0.64, -7 + i * 0.8]);
    laneMarks.push(mark);
  }
  rebuildRoadGeometry();
}

function buildBus() {
  bus.position.set(0, 0, 0);

  box(3.35, 0.14, 5.3, mat.shadow, bus, [0, -0.56, 0]);
  box(3.05, 0.2, 5.05, mat.cyan, bus, [0, -0.42, 0.02]);
  box(3.25, 0.14, 5.15, mat.ink, bus, [0, -0.02, 0]);
  box(2.96, 0.1, 4.86, mat.bus, bus, [0, 0.05, 0.02]);

  box(0.18, 1.0, 4.85, mat.ink, bus, [-1.62, 0.25, 0.04]);
  box(0.18, 1.0, 4.85, mat.ink, bus, [1.62, 0.25, 0.04]);
  box(0.12, 0.82, 4.55, mat.bus, bus, [-1.47, 0.27, 0.05]);
  box(0.12, 0.82, 4.55, mat.bus, bus, [1.47, 0.27, 0.05]);

  box(3.12, 0.85, 0.16, mat.ink, bus, [0, 0.18, -2.6]);
  box(3.12, 0.95, 0.16, mat.ink, bus, [0, 0.22, 2.6]);
  box(2.76, 0.58, 0.12, mat.bus, bus, [0, 0.18, -2.69]);
  box(2.76, 0.68, 0.12, mat.bus, bus, [0, 0.22, 2.69]);
  box(2.4, 0.58, 0.12, mat.glass, bus, [0, 0.28, 2.68]);
  box(2.15, 0.46, 0.13, mat.white, bus, [0, 0.3, 2.75]);

  box(2.92, 0.08, 0.1, mat.ink, bus, [0, 1.12, -2.45]);
  box(2.92, 0.08, 0.1, mat.ink, bus, [0, 1.12, 2.45]);
  box(0.1, 0.08, 4.9, mat.ink, bus, [-1.5, 1.12, 0]);
  box(0.1, 0.08, 4.9, mat.ink, bus, [1.5, 1.12, 0]);

  for (const z of [-1.65, 1.65]) {
    for (const x of [-1.78, 1.78]) {
      cyl(0.35, 0.35, 0.28, mat.ink, bus, [x, -0.55, z], [0, 0, Math.PI / 2], 28);
      cyl(0.17, 0.17, 0.3, mat.white, bus, [x, -0.55, z], [0, 0, Math.PI / 2], 20);
    }
  }

  box(2.1, 0.12, 0.42, mat.ink, bus, [0, -0.2, 2.72]);
  box(1.65, 0.08, 0.16, mat.white, bus, [0, -0.18, 2.95]);
}

function buildPassengers() {
  for (let i = 0; i < maxPassengers; i++) {
    const area = pickArea(i);
    const group = new THREE.Group();
    group.userData.parts = makePassenger(group, i);
    group.userData.home = {
      baseSide: makeBaseSide(i, area),
      row: i % 18,
      lane: Math.floor(i / 18),
      phase: Math.random() * Math.PI * 2,
      xSeed: Math.random(),
      ySeed: Math.random(),
      zSeed: Math.random(),
      scale: THREE.MathUtils.randFloat(0.78, 1.12)
    };
    passengerRoot.add(group);
    passengers.push({
      group,
      area,
      side: group.userData.home.baseSide + THREE.MathUtils.randFloatSpread(0.08),
      targetSide: 0,
      weight: THREE.MathUtils.randFloat(0.85, 1.2),
      active: i < activeCount
    });
  }
}

function makePassenger(parent, index) {
  const parts = {};
  const turbanMat = [mat.pink, mat.cyan, mat.orange, mat.white][index % 4];
  parts.body = cyl(0.11, 0.16, 0.42, mat.white, parent, [0, 0.22, 0], [0, 0, 0], 8);
  parts.head = sphere(0.12, mat.ink, parent, [0, 0.53, 0]);
  parts.turban = cyl(0.14, 0.14, 0.07, turbanMat, parent, [0, 0.64, 0], [Math.PI / 2, 0, 0], 16);
  parts.armL = cyl(0.035, 0.035, 0.34, mat.ink, parent, [-0.14, 0.26, 0], [0.4, 0, -0.6], 8);
  parts.armR = cyl(0.035, 0.035, 0.34, mat.ink, parent, [0.14, 0.26, 0], [0.4, 0, 0.6], 8);
  return parts;
}

function buildEffects() {
  for (let i = 0; i < 6; i++) {
    const arrow = new THREE.Group();
    arrow.position.set(-1.9 + i * 0.75, 2.35, -0.7);
    fxRoot.add(arrow);
    box(0.46, 0.12, 0.04, mat.pink, arrow, [0, 0, 0]);
    const head = mesh(new THREE.ConeGeometry(0.16, 0.3, 3), mat.pink, arrow, [0.32, 0, 0], [0, 0, -Math.PI / 2]);
    arrows.push(arrow);
  }

  for (let i = 0; i < 12; i++) {
    const note = new THREE.Group();
    const noteMat = i % 3 === 0 ? mat.pink : i % 3 === 1 ? mat.cyan : mat.orange;
    sphere(0.1, noteMat, note, [0, 0, 0], [1, 0.75, 1]);
    box(0.04, 0.42, 0.04, noteMat, note, [0.12, 0.22, 0]);
    box(0.25, 0.05, 0.04, noteMat, note, [0.23, 0.42, 0]);
    note.position.set(THREE.MathUtils.randFloat(-2.7, 2.7), THREE.MathUtils.randFloat(1.4, 3.1), THREE.MathUtils.randFloat(-1.8, 1.7));
    note.visible = false;
    fxRoot.add(note);
    notes.push(note);
  }
}

function makeBaseSide(index, area) {
  const row = index % 18;
  const lane = (row / 17) * 2 - 1;
  const stagger = (Math.floor(index / 18) % 2 ? 0.06 : -0.06) + THREE.MathUtils.randFloatSpread(0.05);
  const spread = area === 'cabin' ? 0.86 : area === 'window' ? 1.05 : area === 'roof' ? 0.9 : 1.0;
  return THREE.MathUtils.clamp((lane + stagger) * spread, -1, 1);
}

function pickArea(index) {
  if (index < 60) return 'cabin';
  if (index < 92) return 'window';
  if (index < 124) return 'roof';
  return 'side';
}

function resetGame() {
  activeCount = 80;
  nextCurve = 1;
  currentCurve = 0;
  curvePhase = 0;
  commandSide = 0;
  passengerCommand = 0;
  speedLevel = 1;
  danceMode = false;
  resultFlash = 0;
  roundTimer = 7.5;
  busRoll = 0;
  rollVelocity = 0;
  lateralDrift = 0;
  crashEnergy = 0;
  rolloverCooldown = 0;
  setMessage('右カーブだ。車内の右へ押し寄せろ！', 2);
  passengers.forEach((p, i) => {
    p.area = pickArea(i);
    p.side = p.group.userData.home.baseSide + THREE.MathUtils.randFloatSpread(0.08);
  });
  resetTargets(true);
}

function resetTargets(randomize = false) {
  const crowd = activeCount / maxPassengers;
  passengers.forEach((p, i) => {
    p.active = i < activeCount;
    p.group.visible = p.active;
    if (!p.active) return;

    const home = p.group.userData.home;
    const push = p.area === 'cabin' ? 1.02 : p.area === 'window' ? 1.18 : p.area === 'roof' ? 1.32 : 1.48;
    const crush = 1 - Math.abs(passengerCommand) * (0.45 + crowd * 0.2);
    const disorder = THREE.MathUtils.mapLinear(crowd, 0.25, 1, 0.24, 0.08);
    p.targetSide = THREE.MathUtils.clamp(home.baseSide * crush - passengerCommand * push + THREE.MathUtils.randFloatSpread(disorder), -1.85, 1.85);
    if (randomize) p.side = home.baseSide + THREE.MathUtils.randFloatSpread(0.08);
  });
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  updateInput(dt);
  updatePassengers(dt, t);
  const com = calculateCOM();
  const curveStrength = getCurveStrength();
  const stability = calculateStability(com, curvePhase > 0 ? currentCurve : nextCurve, curveStrength);
  updateBus(com, stability, t, dt);
  checkRollover(stability, dt);
  updateRoad(dt);
  updateEffects(com, stability, t, dt);
  updateUI(com, stability, dt);
  updateDebugState(com, stability);

  if (curvePhase > 0) {
    curvePhase = Math.max(0, curvePhase - dt);
    if (curvePhase === 0) currentCurve = 0;
  } else {
    roundTimer -= dt * (danceMode ? 1.45 : 1);
    if (roundTimer <= 0) judgeCurve(false);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function updateInput(dt) {
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const target = left && !right ? -1 : right && !left ? 1 : 0;
  commandSide = THREE.MathUtils.lerp(commandSide, target, 1 - Math.pow(0.018, dt));
  passengerCommand = THREE.MathUtils.lerp(passengerCommand, commandSide, 1 - Math.pow(0.22, dt));
  resetTargets(false);
}

function updatePassengers(dt, t) {
  const crowd = activeCount / maxPassengers;
  const curveSway = curvePhase > 0 ? -currentCurve * getCurveStrength() * 0.28 : 0;
  const sway = THREE.MathUtils.clamp(-rollVelocity * 0.42 - busRoll * 0.34 + curveSway, -0.88, 0.88);
  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    if (!p.active) continue;

    p.side = THREE.MathUtils.lerp(p.side, p.targetSide, 1 - Math.pow(0.035, dt));
    const home = p.group.userData.home;
    const sameSide = Math.max(0, Math.sign(passengerCommand) * p.side);
    const squeeze = Math.max(0, Math.abs(p.side) - 0.62) * crowd;
    const pile = sameSide * Math.abs(passengerCommand) * crowd;
    const pos = passengerPosition(p, home, pile, squeeze, t);
    const areaSway = p.area === 'roof' ? 1.25 : p.area === 'side' ? 1.45 : 1;
    pos.x += sway * areaSway;
    pos.y += Math.abs(sway) * 0.08;
    p.group.position.copy(pos);

    const slideLean = THREE.MathUtils.clamp((p.targetSide - p.side) * -0.5, -0.65, 0.65);
    const dance = danceMode ? Math.sin(t * 12 + home.phase) * 0.28 : 0;
    p.group.rotation.z = slideLean + dance - sway * 0.55;
    p.group.rotation.y = Math.sin(t * 3 + home.phase) * 0.08;
    p.group.scale.setScalar(home.scale * (1 + squeeze * 0.12));

    const parts = p.group.userData.parts;
    const wave = Math.sin(t * (danceMode ? 13 : 8) + home.phase) * (danceMode ? 0.9 : 0.25);
    parts.armL.rotation.z = -0.65 + wave + passengerCommand * 0.4;
    parts.armR.rotation.z = 0.65 - wave + passengerCommand * 0.4;
  }
}

function passengerPosition(p, home, pile, squeeze, t) {
  let x = p.side * 1.12 + (home.xSeed - 0.5) * 0.13;
  let y = -0.18 + (home.lane % 4) * 0.17 + (home.ySeed - 0.5) * 0.08;
  let z = -1.75 + (home.row % 9) * 0.42 + (home.zSeed - 0.5) * 0.14;

  if (p.area === 'window') {
    x = p.side * 1.35 + Math.sign(p.side || passengerCommand || 1) * 0.18;
    y = 0.08 + home.ySeed * 0.7 + pile * 0.22;
  } else if (p.area === 'roof') {
    x = p.side * 1.2 + (home.xSeed - 0.5) * 0.22;
    y = 1.02 + (home.lane % 5) * 0.13 + home.ySeed * 0.16 + pile * 0.42;
    z = -1.95 + (home.row % 10) * 0.42 + home.zSeed * 0.1;
  } else if (p.area === 'side') {
    const sideSign = p.side === 0 ? Math.sign(passengerCommand || 1) : Math.sign(p.side);
    x = sideSign * (1.78 + home.xSeed * 0.32 + squeeze * 0.16);
    y = -0.18 + home.ySeed * 0.95 + pile * 0.14;
    z = -1.95 + (home.row % 10) * 0.43 + home.zSeed * 0.12;
  }

  x += Math.sign(passengerCommand) * squeeze * 0.22;
  y += Math.sin(t * 8 + home.phase) * (danceMode ? 0.055 : 0.012);
  return new THREE.Vector3(x, y, z);
}

function calculateCOM() {
  let total = 68;
  let x = 0;
  let y = 0.1 * total;
  let roofCount = 0;
  for (const p of passengers) {
    if (!p.active) continue;
    const pos = p.group.position;
    total += p.weight;
    x += -pos.x * p.weight;
    y += pos.y * p.weight;
    if (p.area === 'roof') roofCount += 1;
  }
  return { x: x / total, y: y / total, roofRatio: roofCount / Math.max(1, activeCount) };
}

function calculateStability(com, curveDir = nextCurve, curveStrength = 0) {
  const desired = curveDir * (0.44 + curveStrength * 0.12);
  const alignmentError = Math.abs(desired - com.x);
  const horizontal = 1 - Math.min(1, alignmentError / 1.0);
  const overLeanPenalty = Math.max(0, Math.abs(com.x) - 0.46) * (1.55 + curveStrength * 1.25);
  const centrifugalPenalty = curveStrength * Math.max(0, -Math.sign(com.x || 1) * curveDir) * 0.28;
  const highPenalty = Math.max(0, com.y - 0.72) * 0.36 + com.roofRatio * 0.16;
  const overloadPenalty = Math.max(0, activeCount - 130) / 260;
  return Math.round(THREE.MathUtils.clamp(horizontal - highPenalty - overloadPenalty - overLeanPenalty - centrifugalPenalty, 0, 1) * 100);
}

function updateBus(com, stability, t, dt) {
  const curveStrength = getCurveStrength();
  const curveDir = curvePhase > 0 ? currentCurve : nextCurve;
  const desired = curveDir * (0.44 + curveStrength * 0.12);
  const overLean = Math.max(0, Math.abs(com.x) - 0.46);
  const wrongSide = curvePhase > 0 && Math.sign(com.x || 1) !== curveDir ? Math.min(1, Math.abs(com.x) * 1.2) : 0;
  const danger = Math.max(stability < 42 ? (42 - stability) / 42 : 0, overLean * 1.4, wrongSide * 0.65);
  const weightRoll = com.x * 0.98;
  const centrifugalRoll = -curveDir * curveStrength * 0.34;
  const targetRoll = THREE.MathUtils.clamp(weightRoll + centrifugalRoll, -1.18, 1.18);
  const previousRoll = busRoll;
  const response = 1 - Math.pow(danger > 0.25 ? 0.015 : 0.08, dt);
  busRoll = THREE.MathUtils.lerp(busRoll, targetRoll, response);
  rollVelocity = (busRoll - previousRoll) / Math.max(dt, 0.001);

  crashEnergy = THREE.MathUtils.clamp((Math.abs(busRoll) - 0.48) / 0.38 + Math.max(0, Math.abs(com.x) - 0.62) * 1.2, 0, 1);

  lateralDrift += (com.x - desired) * danger * curveStrength * dt * 2.0;
  lateralDrift *= Math.pow(0.62, dt);
  lateralDrift = THREE.MathUtils.clamp(lateralDrift, -1.35, 1.35);

  const pivotX = busRoll >= 0 ? -1.78 : 1.78;
  const pivotY = -0.55;
  bus.position.x = -pivotX;
  bus.position.y = -pivotY;

  busRig.rotation.z = busRoll;
  busRig.rotation.x = curveStrength * Math.sin(t * 11) * 0.014;
  busRig.position.x = lateralDrift + pivotX + resultFlash * THREE.MathUtils.randFloatSpread(0.03);
  busRig.position.y = pivotY - Math.abs(com.x) * 0.08 + danger * 0.09 + Math.sin(t * 14) * 0.01;
}

function checkRollover(stability, dt) {
  rolloverCooldown = Math.max(0, rolloverCooldown - dt);
  if (rolloverCooldown > 0) return;

  const rolloverAngle = 0.82;
  const unrecoverable = Math.abs(busRoll) > rolloverAngle || (stability < 10 && Math.abs(busRoll) > 0.62);
  if (!unrecoverable) return;

  const loss = Math.min(activeCount - 36, 14 + Math.floor(Math.abs(busRoll) * 22));
  if (loss <= 0) return;

  activeCount -= loss;
  danceMode = false;
  speedLevel = Math.max(1, speedLevel - 0.24);
  rolloverCooldown = 1.2;
  resultFlash = 1;
  commandSide = 0;
  passengerCommand *= -0.2;
  crashEnergy = 0.75;
  rollVelocity = 0;
  busRoll = Math.sign(busRoll) * 1.08;
  lateralDrift += Math.sign(busRoll) * 0.45;
  redistributeOverflow();
  resetTargets(false);
  setMessage(`横転しかけた！${loss}人が降車`, 2.6);
  showStamp('横転寸前', true);
}

function updateRoad(dt) {
  const speed = (2.6 + activeCount * 0.034) * speedLevel;
  roadScroll = (roadScroll + dt * speed) % 0.8;
  rebuildRoadGeometry();
  for (let i = 0; i < laneMarks.length; i++) {
    const mark = laneMarks[i];
    let z = -7 + i * 0.8 - roadScroll;
    if (z < -8) z += 24;
    mark.position.set(roadCurveX(z), -0.64, z);
    mark.visible = i % 2 === 0;
  }
}

function getCurveStrength() {
  if (curvePhase <= 0) return 0;
  const progress = 1 - curvePhase / curveDuration;
  return Math.sin(progress * Math.PI);
}

function rebuildRoadGeometry() {
  const verts = [];
  const indices = [];
  const segments = 42;
  const zMin = -8;
  const zMax = 16;
  for (let i = 0; i <= segments; i++) {
    const z = zMin + (zMax - zMin) * (i / segments);
    const x = roadCurveX(z - roadScroll * 0.25);
    const width = THREE.MathUtils.lerp(8.8, 5.3, Math.max(0, z - 2) / 14);
    verts.push(x - width / 2, 0, z, x + width / 2, 0, z);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  roadMesh.geometry.dispose();
  roadMesh.geometry = new THREE.BufferGeometry();
  roadMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  roadMesh.geometry.setIndex(indices);
  roadMesh.geometry.computeBoundingSphere();
}

function roadCurveX(z) {
  const strength = getCurveStrength();
  if (strength <= 0) return 0;
  const far = THREE.MathUtils.clamp((z - 1.8) / 10.5, 0, 1);
  return currentCurve * strength * far * far * (3 - 2 * far) * 5.2;
}

function updateEffects(com, stability, t, dt) {
  const displayCurve = curvePhase > 0 ? currentCurve : nextCurve;
  for (let i = 0; i < arrows.length; i++) {
    const arrow = arrows[i];
    arrow.scale.x = -displayCurve;
    arrow.position.x = displayCurve * (0.7 + i * 0.38);
    arrow.position.y = 2.35 + Math.sin(t * 8 + i) * 0.03;
  }

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    note.visible = danceMode;
    if (!danceMode) continue;
    note.position.y += dt * (0.55 + i * 0.02);
    note.position.x += Math.sin(t * 2.3 + i) * dt * 0.5;
    if (note.position.y > 3.4) {
      note.position.y = THREE.MathUtils.randFloat(1.2, 1.8);
      note.position.x = THREE.MathUtils.randFloat(-2.8, 2.8);
    }
  }

  resultFlash = Math.max(0, resultFlash - dt * 1.8);
}

function updateUI(com, stability, dt) {
  const displayCurve = curvePhase > 0 ? currentCurve : nextCurve;
  const sideText = displayCurve > 0 ? '右' : '左';
  ui.titleSide.textContent = sideText;
  ui.curveText.textContent = sideText;
  ui.curveCard.classList.toggle('left', displayCurve < 0);
  ui.passengerCount.textContent = activeCount;
  ui.loadRate.textContent = Math.round(activeCount / 40 * 100);
  ui.speedText.textContent = speedLevel.toFixed(1);
  ui.stabilityText.textContent = `${stability}%`;
  ui.comNeedle.style.left = `${THREE.MathUtils.clamp(50 + com.x * 28, 5, 95)}%`;
  ui.targetNeedle.style.left = `${displayCurve > 0 ? 66 : 34}%`;

  if (stampHold > 0) {
    stampHold -= dt;
    if (stampHold <= 0) ui.stamp.classList.remove('show');
  }

  if (messageHold > 0) {
    messageHold -= dt;
    return;
  }

  if (danceMode) {
    ui.message.textContent = '満員！屋根まで踊ってスピードアップ！';
  } else if (crashEnergy > 0.72 || stability < 25) {
    ui.message.textContent = '横転寸前！押しすぎを戻せ！';
  } else if (crashEnergy > 0.38 || stability < 45) {
    ui.message.textContent = '片輪走行！車体が流れている！';
  } else if (curvePhase > 0) {
    ui.message.textContent = `${sideText}カーブ突入！遠心力に耐えろ！`;
  } else {
    ui.message.textContent = `${sideText}カーブまで ${Math.max(0, Math.ceil(roundTimer))} 秒。車内の${sideText}へ押せ！`;
  }
}

function updateDebugState(com, stability) {
  window.__indiansToRight = {
    activeCount,
    busRoll,
    rollVelocity,
    lateralDrift,
    crashEnergy,
    curvePhase,
    currentCurve,
    nextCurve,
    passengerCommand,
    comX: com.x,
    comY: com.y,
    stability,
    message: ui.message.textContent
  };
}

function judgeCurve(manual) {
  const com = calculateCOM();
  if (curvePhase > 0) return;
  const curveDir = nextCurve;
  const stability = calculateStability(com, curveDir, 1);
  const success = stability >= 58;
  const sideText = curveDir > 0 ? '右' : '左';
  currentCurve = curveDir;
  curvePhase = curveDuration;
  if (success) {
    const gain = 7 + Math.floor(Math.random() * 10);
    activeCount = Math.min(maxPassengers, activeCount + gain);
    speedLevel = activeCount >= 135 ? Math.min(2.05, speedLevel + 0.18) : Math.min(1.55, speedLevel + 0.07);
    danceMode = activeCount >= 135;
    setMessage(`${sideText}へ重心が乗った！成功、乗客 +${gain}人`, 2.1);
    showStamp('成功', false);
  } else {
    const loss = 10 + Math.floor(Math.random() * 18);
    activeCount = Math.max(36, activeCount - loss);
    speedLevel = Math.max(1, speedLevel - 0.18);
    danceMode = false;
    const reason = Math.sign(com.x || 1) === curveDir ? '寄せすぎて片輪走行！' : '重心が逆！';
    setMessage(`${reason} 危ないので ${loss}人 降車`, 2.4);
    showStamp('危険', true);
  }

  nextCurve *= -1;
  roundTimer = manual ? 7.5 : 6.5;
  resultFlash = 1;
  commandSide *= 0.25;
  passengerCommand *= 0.35;
  redistributeOverflow();
  resetTargets(false);
}

function redistributeOverflow() {
  passengers.forEach((p, i) => {
    p.area = pickArea(i);
  });
}

function setMessage(text, hold) {
  ui.message.textContent = text;
  messageHold = hold;
}

function showStamp(text, danger) {
  ui.stamp.textContent = text;
  ui.stamp.classList.toggle('danger', danger);
  ui.stamp.classList.remove('show');
  void ui.stamp.offsetWidth;
  ui.stamp.classList.add('show');
  stampHold = 0.9;
}

function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewH = aspect < 1 ? 10.6 : 8.9;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.left = -viewH * aspect / 2;
  camera.right = viewH * aspect / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
