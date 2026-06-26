import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfffdf6);

const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, -60, 60);
camera.position.set(0, 0, 14);
camera.lookAt(0, 0, 0);

const COLORS = {
  ink: 0x050505,
  paper: 0xfffdf6,
  bus: 0xffc20a,
  cyan: 0x13c4c7,
  pink: 0xf00658,
  orange: 0xff9f05,
  white: 0xffffff,
  glass: 0x061015
};

const mat = {
  ink: flat(COLORS.ink),
  bus: flat(COLORS.bus),
  cyan: flat(COLORS.cyan),
  pink: flat(COLORS.pink),
  orange: flat(COLORS.orange),
  white: flat(COLORS.white),
  glass: flat(COLORS.glass),
  paper: flat(COLORS.paper)
};

function flat(color) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function box(w, h, d, material, parent, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function circle(r, material, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 28), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, 1);
  parent.add(mesh);
  return mesh;
}

function capsule(material, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.set(sx, sy, 1);
  parent.add(group);
  box(0.16, 0.42, 0.02, material, group, 0, -0.02, 0);
  circle(0.08, material, group, 0, 0.19, 0);
  circle(0.08, material, group, 0, -0.23, 0);
  return group;
}

const world = new THREE.Group();
scene.add(world);

const roadRoot = new THREE.Group();
world.add(roadRoot);

const posterMarks = new THREE.Group();
world.add(posterMarks);

const busRig = new THREE.Group();
world.add(busRig);

const busGroup = new THREE.Group();
busRig.add(busGroup);

const cabinMass = new THREE.Group();
busGroup.add(cabinMass);

const passengerRoot = new THREE.Group();
busGroup.add(passengerRoot);

const fxRoot = new THREE.Group();
world.add(fxRoot);

const maxPassengers = 150;
const passengers = [];
const roadSegments = [];
const laneMarks = [];
const arrows = [];
const speedLines = [];
const massBlobs = [];
const musicNotes = [];

let activeCount = 80;
let nextCurve = 1;
let commandSide = 0;
let speedLevel = 1;
let danceMode = false;
let resultFlash = 0;
let roundTimer = 7.5;
let messageHold = 0;
let stampHold = 0;
let last = performance.now();

const keys = new Set();

buildPosterMarks();
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

function buildPosterMarks() {
  const slash = new THREE.Group();
  slash.position.set(4.45, 2.15, -4.5);
  slash.rotation.z = -0.12;
  posterMarks.add(slash);
  box(2.1, 0.55, 0.02, mat.pink, slash, 0, 0.7, 0);
  box(4.3, 0.55, 0.02, mat.pink, slash, 0.1, -0.05, 0);
  box(2.2, 0.55, 0.02, mat.pink, slash, -0.1, -0.78, 0);

  for (let i = 0; i < 34; i++) {
    const spark = box(Math.random() * 0.06 + 0.02, Math.random() * 0.42 + 0.1, 0.02, mat.orange, posterMarks);
    spark.position.set(THREE.MathUtils.randFloat(2.5, 7.7), THREE.MathUtils.randFloat(-3.35, -1.15), -4.3);
    spark.rotation.z = THREE.MathUtils.randFloat(-1.1, 1.1);
  }
}

function buildRoad() {
  roadRoot.position.y = 0;
  for (let i = 0; i < 22; i++) {
    const seg = box(9.8, 0.42, 0.02, mat.ink, roadRoot, 0, -3.25 + i * 0.16, -5);
    roadSegments.push(seg);
    const mark = box(0.9, 0.055, 0.03, mat.white, roadRoot, 0, -3.25 + i * 0.16, -4.96);
    laneMarks.push(mark);
  }
}

function buildBus() {
  busGroup.position.set(0, -0.1, 0);

  box(6.25, 2.75, 0.08, mat.ink, busGroup, 0, 0.18, 0);
  box(5.88, 2.42, 0.09, mat.bus, busGroup, 0, 0.25, 0.04);
  box(6.15, 0.34, 0.1, mat.cyan, busGroup, 0, -1.0, 0.1);
  box(5.25, 1.42, 0.1, mat.white, busGroup, 0, 0.25, 0.16);
  box(4.95, 1.18, 0.1, mat.glass, busGroup, 0, 0.25, 0.19);

  box(0.18, 2.42, 0.12, mat.ink, busGroup, -2.95, 0.25, 0.23);
  box(0.18, 2.42, 0.12, mat.ink, busGroup, 2.95, 0.25, 0.23);
  box(5.8, 0.16, 0.12, mat.ink, busGroup, 0, 1.46, 0.23);
  box(5.1, 0.12, 0.12, mat.ink, busGroup, 0, -0.48, 0.24);

  for (const x of [-1.85, -0.62, 0.62, 1.85]) {
    box(0.08, 1.22, 0.13, mat.white, busGroup, x, 0.25, 0.26);
  }

  box(1.55, 0.34, 0.12, mat.ink, busGroup, -1.2, -0.74, 0.25);
  box(1.55, 0.34, 0.12, mat.ink, busGroup, 1.2, -0.74, 0.25);
  box(1.2, 0.15, 0.13, mat.bus, busGroup, -1.2, -0.74, 0.28);
  box(1.2, 0.15, 0.13, mat.bus, busGroup, 1.2, -0.74, 0.28);

  for (const x of [-2.35, 2.35]) {
    circle(0.5, mat.ink, busGroup, x, -1.22, 0.32);
    circle(0.26, mat.white, busGroup, x, -1.22, 0.35);
  }
}

function buildPassengers() {
  for (let i = 0; i < maxPassengers; i++) {
    const area = pickArea(i);
    const group = new THREE.Group();
    group.userData.parts = makePassengerShape(group, i);
    group.userData.home = {
      xSeed: Math.random(),
      ySeed: Math.random(),
      zSeed: Math.random(),
      phase: Math.random() * Math.PI * 2,
      scale: THREE.MathUtils.randFloat(0.78, 1.12),
      baseSide: makeBaseSide(i, area),
      row: i % 14,
      layer: Math.floor(i / 14)
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

function makePassengerShape(parent, index) {
  const parts = {};
  const turbanMats = [mat.pink, mat.cyan, mat.orange, mat.white];
  const turbanMat = turbanMats[index % turbanMats.length];
  parts.shadow = circle(0.18, mat.ink, parent, 0, -0.35, -0.02, 1.15, 0.22);
  parts.robe = capsule(mat.white, parent, 0, -0.03, 0.02, 1, 1.18);
  parts.head = circle(0.11, mat.ink, parent, 0, 0.31, 0.05, 0.9, 1.08);
  parts.turban = new THREE.Group();
  parent.add(parts.turban);
  parts.turban.position.set(0, 0.42, 0.06);
  circle(0.12, turbanMat, parts.turban, 0, 0, 0, 1.25, 0.56);
  box(0.21, 0.04, 0.01, mat.ink, parts.turban, 0.01, 0.01, 0.01).rotation.z = -0.25;
  parts.armL = capsule(mat.ink, parent, -0.15, 0.02, 0.06, 0.42, 0.7);
  parts.armR = capsule(mat.ink, parent, 0.15, 0.02, 0.06, 0.42, 0.7);
  return parts;
}

function buildEffects() {
  for (let i = 0; i < 6; i++) {
    const blob = circle(0.72, i % 2 ? mat.white : mat.ink, cabinMass, 0, 0.34, 0.98, 1, 0.75);
    blob.visible = false;
    massBlobs.push(blob);
  }

  for (let i = 0; i < 6; i++) {
    const arrow = new THREE.Group();
    arrow.position.set(-2.2 + i * 0.9, 2.28, -1.2);
    fxRoot.add(arrow);
    box(0.55, 0.15, 0.03, mat.pink, arrow, 0, 0, 0);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 3), mat.pink);
    head.position.set(0.36, 0, 0);
    head.rotation.z = -Math.PI / 2;
    arrow.add(head);
    arrows.push(arrow);
  }

  for (let i = 0; i < 10; i++) {
    const line = box(1.4 + Math.random(), 0.07, 0.02, i % 2 ? mat.cyan : mat.pink, fxRoot);
    line.position.set(THREE.MathUtils.randFloat(-8, 8), THREE.MathUtils.randFloat(-2.8, 2.6), -3.4);
    line.rotation.z = THREE.MathUtils.randFloat(-0.22, 0.22);
    speedLines.push(line);
  }

  for (let i = 0; i < 12; i++) {
    const note = new THREE.Group();
    const noteMat = i % 3 === 0 ? mat.pink : i % 3 === 1 ? mat.cyan : mat.orange;
    circle(0.12, noteMat, note, 0, 0, 0, 1, 0.72);
    box(0.05, 0.46, 0.02, noteMat, note, 0.12, 0.23, 0);
    box(0.26, 0.05, 0.02, noteMat, note, 0.23, 0.44, 0);
    note.position.set(THREE.MathUtils.randFloat(-3, 3), THREE.MathUtils.randFloat(1.2, 3.1), 2.7);
    note.rotation.z = THREE.MathUtils.randFloat(-0.4, 0.4);
    note.visible = false;
    fxRoot.add(note);
    musicNotes.push(note);
  }
}

function makeBaseSide(index, area) {
  const row = index % 14;
  const layer = Math.floor(index / 14);
  const lane = (row / 13) * 2 - 1;
  const stagger = (layer % 2 ? 0.08 : -0.08) + THREE.MathUtils.randFloatSpread(0.06);
  const spread = area === 'cabin' ? 0.9 : area === 'window' ? 1.04 : area === 'roof' ? 0.92 : 1.0;
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
  commandSide = 0;
  speedLevel = 1;
  danceMode = false;
  resultFlash = 0;
  roundTimer = 7.5;
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
    const push = p.area === 'cabin' ? 1.0 : p.area === 'window' ? 1.18 : p.area === 'roof' ? 1.35 : 1.48;
    const crush = 1 - Math.abs(commandSide) * (0.48 + crowd * 0.2);
    const disorder = THREE.MathUtils.mapLinear(crowd, 0.25, 1, 0.24, 0.09);
    p.targetSide = THREE.MathUtils.clamp(home.baseSide * crush + commandSide * push + THREE.MathUtils.randFloatSpread(disorder), -1.85, 1.85);
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
  const stability = calculateStability(com);
  updateBus(com, stability, t);
  updateRoad(t, dt);
  updateEffects(com, stability, t, dt);
  updateUI(com, stability, dt);

  roundTimer -= dt * (danceMode ? 1.45 : 1);
  if (roundTimer <= 0) judgeCurve(false);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function updateInput(dt) {
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const target = left && !right ? -1 : right && !left ? 1 : 0;
  commandSide = THREE.MathUtils.lerp(commandSide, target, 1 - Math.pow(0.018, dt));
  resetTargets(false);
}

function updatePassengers(dt, t) {
  const crowd = activeCount / maxPassengers;
  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    if (!p.active) continue;

    p.side = THREE.MathUtils.lerp(p.side, p.targetSide, 1 - Math.pow(0.035, dt));
    const home = p.group.userData.home;
    const sameSide = Math.max(0, Math.sign(commandSide) * p.side);
    const squeeze = Math.max(0, Math.abs(p.side) - 0.65) * crowd;
    const pile = sameSide * Math.abs(commandSide) * crowd;
    p.group.position.copy(passengerPosition(p, home, pile, squeeze, t));

    const movingLean = THREE.MathUtils.clamp((p.targetSide - p.side) * -0.52, -0.6, 0.6);
    const dance = danceMode ? Math.sin(t * 12 + home.phase) * 0.32 : 0;
    p.group.rotation.z = movingLean + Math.sin(t * 5 + home.phase) * 0.035 + dance;
    p.group.scale.set(
      home.scale * (1 - squeeze * 0.14),
      home.scale * (1 + squeeze * 0.25 + (danceMode ? Math.sin(t * 10 + home.phase) * 0.08 : 0)),
      home.scale
    );

    const parts = p.group.userData.parts;
    const armWave = Math.sin(t * (danceMode ? 13 : 8) + home.phase) * (danceMode ? 0.9 : 0.3);
    parts.armL.rotation.z = 0.65 + armWave + commandSide * 0.35;
    parts.armR.rotation.z = -0.65 - armWave + commandSide * 0.35;
    if (p.area === 'side' || Math.abs(p.side) > 1.35) {
      parts.armL.rotation.z = 1.55 + armWave * 0.45;
      parts.armR.rotation.z = -1.55 - armWave * 0.45;
    }
  }
}

function passengerPosition(p, home, pile, squeeze, t) {
  let x = p.side * 1.42 + (home.xSeed - 0.5) * 0.16;
  let y = -0.35 + (home.layer % 4) * 0.25 + (home.ySeed - 0.5) * 0.12;
  let z = 2.08 + (home.row % 5) * 0.015 + home.zSeed * 0.03;

  if (p.area === 'cabin') {
    y = THREE.MathUtils.clamp(y, -0.42, 0.9) + pile * 0.2;
  } else if (p.area === 'window') {
    x = p.side * 1.62 + (home.xSeed - 0.5) * 0.2;
    y = 0.08 + home.ySeed * 0.95 + pile * 0.33;
    z = 2.16 + squeeze * 0.08;
  } else if (p.area === 'roof') {
    x = p.side * 1.72 + (home.xSeed - 0.5) * 0.28;
    y = 1.45 + (home.layer % 5) * 0.22 + home.ySeed * 0.18 + pile * 0.48;
    z = 2.2 + home.zSeed * 0.08;
  } else {
    const sideSign = p.side === 0 ? Math.sign(commandSide || 1) : Math.sign(p.side);
    x = sideSign * (2.9 + home.xSeed * 0.45 + squeeze * 0.2);
    y = -0.35 + home.ySeed * 1.3 + pile * 0.18;
    z = 2.25 + home.zSeed * 0.08;
  }

  x += Math.sign(commandSide) * squeeze * 0.22;
  y += Math.sin(t * 8 + home.phase) * (danceMode ? 0.055 : 0.014);
  return new THREE.Vector3(x, y, z);
}

function calculateCOM() {
  let total = 66;
  let x = 0;
  let y = 0.16 * total;
  let roofCount = 0;
  for (const p of passengers) {
    if (!p.active) continue;
    const pos = p.group.position;
    total += p.weight;
    x += pos.x * p.weight;
    y += pos.y * p.weight;
    if (p.area === 'roof') roofCount += 1;
  }
  return { x: x / total, y: y / total, roofRatio: roofCount / Math.max(1, activeCount) };
}

function calculateStability(com) {
  const desired = nextCurve * 0.72;
  const horizontal = 1 - Math.min(1, Math.abs(desired - com.x) / 1.6);
  const highPenalty = Math.max(0, com.y - 0.88) * 0.34 + com.roofRatio * 0.17;
  const overloadPenalty = Math.max(0, activeCount - 130) / 260;
  return Math.round(THREE.MathUtils.clamp(horizontal - highPenalty - overloadPenalty, 0, 1) * 100);
}

function updateBus(com, stability, t) {
  const lean = -com.x * 0.24 + nextCurve * 0.04 + Math.sin(t * 8) * 0.006;
  const panicLift = stability < 36 ? (36 - stability) / 36 : 0;
  busRig.rotation.z = THREE.MathUtils.lerp(busRig.rotation.z, lean + nextCurve * panicLift * 0.12, 0.15);
  busRig.position.y = -Math.abs(com.x) * 0.12 + panicLift * 0.08 + Math.sin(t * 14) * 0.01;
  busRig.position.x = resultFlash * THREE.MathUtils.randFloatSpread(0.035);
}

function updateRoad(t, dt) {
  const speed = (2.4 + activeCount * 0.034) * speedLevel;
  for (let i = 0; i < roadSegments.length; i++) {
    const seg = roadSegments[i];
    const mark = laneMarks[i];
    seg.position.y += dt * speed * 0.13;
    mark.position.y = seg.position.y;
    if (seg.position.y > -0.05) seg.position.y -= roadSegments.length * 0.16;

    const depth = THREE.MathUtils.mapLinear(seg.position.y, -3.3, -0.05, 1, 0);
    const curve = nextCurve * Math.pow(Math.max(0, 1 - depth), 1.45) * 3.1;
    seg.position.x = curve;
    mark.position.x = curve;
    seg.scale.x = THREE.MathUtils.clamp(0.62 + depth * 0.42, 0.62, 1.08);
    mark.visible = i % 2 === 0;
  }
}

function updateEffects(com, stability, t, dt) {
  const crowd = activeCount / maxPassengers;
  const side = Math.sign(com.x || commandSide || nextCurve);
  const pressure = THREE.MathUtils.clamp(Math.abs(com.x) * 0.6 + Math.abs(commandSide) * 0.5, 0, 1.25);
  for (let i = 0; i < massBlobs.length; i++) {
    const blob = massBlobs[i];
    blob.visible = pressure > 0.18;
    blob.position.x = side * (0.45 + i * 0.19) + Math.sin(t * 5 + i) * 0.03;
    blob.position.y = 0.12 + (i % 3) * 0.28 + pressure * 0.22;
    blob.position.z = 1.96 + i * 0.012;
    blob.scale.set(1.2 + pressure * 1.25 - i * 0.08, 0.58 + pressure * 0.42, 1);
  }

  for (const arrow of arrows) {
    arrow.scale.x = nextCurve;
    arrow.position.x = nextCurve * (0.25 + Math.abs(arrow.position.x));
  }

  const showSpeed = speedLevel > 1.08 || resultFlash > 0 || danceMode;
  for (let i = 0; i < speedLines.length; i++) {
    const line = speedLines[i];
    line.visible = showSpeed;
    line.position.x -= dt * (4 + activeCount * 0.035);
    if (line.position.x < -9.5) {
      line.position.x = 9.4;
      line.position.y = THREE.MathUtils.randFloat(-2.5, 2.6);
    }
  }

  for (let i = 0; i < musicNotes.length; i++) {
    const note = musicNotes[i];
    note.visible = danceMode;
    if (!danceMode) continue;
    note.position.y += dt * (0.55 + i * 0.02);
    note.position.x += Math.sin(t * 2.3 + i) * dt * 0.5;
    note.rotation.z = Math.sin(t * 3 + i) * 0.45;
    if (note.position.y > 3.5) {
      note.position.y = THREE.MathUtils.randFloat(1.15, 1.8);
      note.position.x = THREE.MathUtils.randFloat(-3.2, 3.2);
    }
  }

  resultFlash = Math.max(0, resultFlash - dt * 1.8);
}

function updateUI(com, stability, dt) {
  const sideText = nextCurve > 0 ? '右' : '左';
  ui.titleSide.textContent = sideText;
  ui.curveText.textContent = sideText;
  ui.curveCard.classList.toggle('left', nextCurve < 0);
  ui.passengerCount.textContent = activeCount;
  ui.loadRate.textContent = Math.round(activeCount / 40 * 100);
  ui.speedText.textContent = speedLevel.toFixed(1);
  ui.stabilityText.textContent = `${stability}%`;
  ui.comNeedle.style.left = `${THREE.MathUtils.clamp(50 + com.x * 21, 5, 95)}%`;
  ui.targetNeedle.style.left = `${nextCurve > 0 ? 65 : 35}%`;

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
  } else {
    ui.message.textContent = `${sideText}カーブまで ${Math.max(0, Math.ceil(roundTimer))} 秒。車内の${sideText}へ押せ！`;
  }
}

function judgeCurve(manual) {
  const stability = calculateStability(calculateCOM());
  const success = stability >= 58;
  const sideText = nextCurve > 0 ? '右' : '左';
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
    setMessage(`重心が逆！危ないので ${loss}人 降車`, 2.4);
    showStamp('危険', true);
  }

  nextCurve *= -1;
  roundTimer = manual ? 7.5 : 6.5;
  resultFlash = 1;
  commandSide *= 0.25;
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
  const viewH = aspect < 1 ? 10.8 : 9.2;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.left = -viewH * aspect / 2;
  camera.right = viewH * aspect / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
