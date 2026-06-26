import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfffdf6);

const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, -40, 40);
camera.position.set(0, 2.0, 14);
camera.lookAt(0, 1.15, 0);

const COLORS = {
  ink: 0x050505,
  paper: 0xfffdf6,
  bus: 0xffc20a,
  cyan: 0x13c4c7,
  pink: 0xf00658,
  orange: 0xff9f05,
  white: 0xffffff,
  road: 0x111111
};

const mat = {
  ink: flat(COLORS.ink),
  bus: flat(COLORS.bus),
  cyan: flat(COLORS.cyan),
  pink: flat(COLORS.pink),
  orange: flat(COLORS.orange),
  white: flat(COLORS.white),
  road: flat(COLORS.road),
  glass: flat(0x061015)
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
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 24), material);
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

const posterMarks = new THREE.Group();
world.add(posterMarks);

const roadGroup = new THREE.Group();
world.add(roadGroup);

const busRig = new THREE.Group();
world.add(busRig);

const busGroup = new THREE.Group();
busRig.add(busGroup);

const passengerRoot = new THREE.Group();
busGroup.add(passengerRoot);

const fxRoot = new THREE.Group();
world.add(fxRoot);

const busWidth = 5.9;
const cabinWidth = 4.9;
const floorY = -0.15;
const cabinTop = 1.62;
const maxPassengers = 150;

let activeCount = 80;
let nextCurve = 1;
let commandSide = 0;
let speedLevel = 1;
let resultFlash = 0;
let danceMode = false;
let roundTimer = 7.5;
let messageHold = 0;

const keys = new Set();
const passengers = [];
const roadStripes = [];
const speedLines = [];
const arrows = [];

buildPosterMarks();
buildRoad();
buildBus();
buildPassengers();
buildEffects();
resize();
resetTargets(true);

const ui = {
  titleSide: document.querySelector('#titleSide'),
  curveCard: document.querySelector('#curveCard'),
  curveText: document.querySelector('#curveText'),
  passengerCount: document.querySelector('#passengerCount'),
  loadRate: document.querySelector('#loadRate'),
  speedText: document.querySelector('#speedText'),
  comNeedle: document.querySelector('#comNeedle'),
  stabilityText: document.querySelector('#stabilityText'),
  message: document.querySelector('#message')
};

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === 'Space') judgeCurve(true);
  if (event.code === 'KeyR') resetGame();
});

window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('resize', resize);

let last = performance.now();
requestAnimationFrame(tick);

function buildPosterMarks() {
  const slash = new THREE.Group();
  slash.position.set(4.1, 1.6, -8);
  slash.rotation.z = -0.12;
  posterMarks.add(slash);
  box(2.4, 0.65, 0.02, mat.pink, slash, 0, 0.75, 0);
  box(4.3, 0.65, 0.02, mat.pink, slash, 0.1, -0.1, 0);
  box(2.3, 0.65, 0.02, mat.pink,  slash, -0.15, -0.95, 0);

  for (let i = 0; i < 40; i++) {
    const spark = box(Math.random() * 0.06 + 0.018, Math.random() * 0.45 + 0.12, 0.02, mat.orange, posterMarks);
    spark.position.set(THREE.MathUtils.randFloat(2.0, 7.7), THREE.MathUtils.randFloat(-3.0, -1.15), -7.9);
    spark.rotation.z = THREE.MathUtils.randFloat(-1.1, 1.1);
  }
}

function buildRoad() {
  const road = new THREE.Group();
  road.position.set(0, -3.05, -4);
  road.rotation.z = -0.05;
  roadGroup.add(road);
  box(17, 1.25, 0.02, mat.road, road, 0, 0, 0);
  for (let i = 0; i < 18; i++) {
    const stripe = box(1.05, 0.08, 0.03, mat.white, road, i * 1.35 - 11, 0.28, 0.02);
    stripe.rotation.z = 0.12;
    roadStripes.push(stripe);
  }
}

function buildBus() {
  busGroup.position.y = -0.55;

  box(6.35, 2.15, 0.52, mat.ink, busGroup, 0, 0.52, -0.04);
  box(6.08, 1.92, 0.58, mat.bus, busGroup, 0, 0.62, 0);
  box(5.15, 1.05, 0.62, mat.white, busGroup, 0, 0.84, 0.03);
  box(4.88, 0.86, 0.66, mat.glass, busGroup, 0, 0.89, 0.06);
  box(6.3, 0.24, 0.65, mat.ink, busGroup, 0, 1.73, 0.02);
  box(6.1, 0.17, 0.68, mat.bus, busGroup, 0, 1.78, 0.04);
  box(6.4, 0.42, 0.66, mat.cyan, busGroup, 0, -0.42, 0.05);
  box(2.0, 0.35, 0.7, mat.ink, busGroup, 0, -0.15, 0.08);
  box(1.55, 0.18, 0.72, mat.bus, busGroup, 0, -0.14, 0.11);

  for (const x of [-2.25, 2.25]) {
    circle(0.53, mat.ink, busGroup, x, -0.74, 0.38);
    circle(0.28, mat.white, busGroup, x, -0.74, 0.4);
  }

  for (const x of [-1.9, -0.65, 0.65, 1.9]) {
    box(0.08, 0.95, 0.7, mat.white, busGroup, x, 0.9, 0.12);
  }

  box(0.65, 0.16, 0.74, mat.ink, busGroup, -2.35, -0.02, 0.13);
  box(0.65, 0.16, 0.74, mat.ink, busGroup, 2.35, -0.02, 0.13);
  box(0.42, 0.11, 0.74, mat.white, busGroup, -2.35, -0.02, 0.15);
  box(0.42, 0.11, 0.74, mat.white, busGroup, 2.35, -0.02, 0.15);
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
      scale: THREE.MathUtils.randFloat(0.82, 1.18),
      baseSide: makeBaseSide(i, area)
    };
    passengerRoot.add(group);
    passengers.push({
      group,
      area,
      side: group.userData.home.baseSide + THREE.MathUtils.randFloatSpread(0.12),
      targetSide: 0,
      weight: THREE.MathUtils.randFloat(0.85, 1.25),
      panic: Math.random(),
      active: i < activeCount
    });
  }
}

function makePassengerShape(parent, i) {
  const parts = {};
  const turbanMats = [mat.pink, mat.cyan, mat.orange, mat.white];
  const turbanMat = turbanMats[i % turbanMats.length];

  parts.shadow = circle(0.2, mat.ink, parent, 0, -0.36, -0.01, 1.15, 0.22);
  parts.robe = capsule(mat.white, parent, 0, -0.03, 0.02, 1.0, 1.25);
  parts.head = circle(0.115, mat.ink, parent, 0, 0.32, 0.05, 0.9, 1.08);
  parts.turban = new THREE.Group();
  parent.add(parts.turban);
  parts.turban.position.set(0, 0.43, 0.06);
  circle(0.12, turbanMat, parts.turban, 0, 0, 0, 1.25, 0.56);
  box(0.21, 0.045, 0.01, mat.ink, parts.turban, 0.01, 0.01, 0.01).rotation.z = -0.25;
  parts.armL = capsule(mat.ink, parent, -0.16, 0.02, 0.06, 0.42, 0.72);
  parts.armR = capsule(mat.ink, parent, 0.16, 0.02, 0.06, 0.42, 0.72);
  return parts;
}

function makeBaseSide(index, area) {
  const row = index % 20;
  const layer = Math.floor(index / 20);
  const lane = (row / 19) * 2 - 1;
  const stagger = (layer % 2 ? 0.07 : -0.07) + THREE.MathUtils.randFloatSpread(0.08);
  const areaSpread = area === 'cabin' ? 0.86 : area === 'window' ? 1.02 : area === 'roof' ? 0.92 : 1.0;
  return THREE.MathUtils.clamp((lane + stagger) * areaSpread, -1, 1);
}

function buildEffects() {
  for (let i = 0; i < 9; i++) {
    const line = box(1.7 + Math.random() * 1.1, 0.08, 0.02, i % 2 ? mat.cyan : mat.pink, fxRoot);
    line.position.set(THREE.MathUtils.randFloat(-8, 8), THREE.MathUtils.randFloat(-2.5, 3), -6);
    line.rotation.z = THREE.MathUtils.randFloat(-0.18, 0.18);
    speedLines.push(line);
  }

  for (let i = 0; i < 5; i++) {
    const arrow = new THREE.Group();
    arrow.position.set(-5.6 + i * 0.75, 2.45, -2);
    fxRoot.add(arrow);
    box(0.55, 0.16, 0.03, mat.pink, arrow, 0, 0, 0);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 3), mat.pink);
    head.position.set(0.36, 0, 0);
    head.rotation.z = -Math.PI / 2;
    arrow.add(head);
    arrows.push(arrow);
  }
}

function pickArea(index) {
  if (index < 72) return 'cabin';
  if (index < 100) return 'window';
  if (index < 132) return 'roof';
  return 'side';
}

function resetGame() {
  activeCount = 80;
  nextCurve = 1;
  commandSide = 0;
  speedLevel = 1;
  resultFlash = 0;
  danceMode = false;
  roundTimer = 7.5;
  setMessage('右カーブだ。インド人を右に！', 2);
  passengers.forEach((p, i) => {
    p.area = pickArea(i);
    p.side = p.group.userData.home.baseSide + THREE.MathUtils.randFloatSpread(0.12);
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
    const areaPush = p.area === 'cabin' ? 1.08 : p.area === 'window' ? 1.28 : p.area === 'roof' ? 1.42 : 1.62;
    const disorder = THREE.MathUtils.mapLinear(crowd, 0.25, 1, 0.36, 0.14);
    const crush = 1 - Math.abs(commandSide) * (0.42 + crowd * 0.18);
    const avalanche = commandSide * areaPush;
    p.targetSide = THREE.MathUtils.clamp(home.baseSide * crush + avalanche + THREE.MathUtils.randFloatSpread(disorder), -1.9, 1.9);
    if (randomize) p.side = home.baseSide + THREE.MathUtils.randFloatSpread(0.12);
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
  updateBus(com, t, dt);
  updateWorld(t, dt);
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
  const sidePressure = Math.abs(commandSide) * crowd;
  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    if (!p.active) continue;

    p.side = THREE.MathUtils.lerp(p.side, p.targetSide, 1 - Math.pow(0.035, dt));
    const home = p.group.userData.home;
    const pile = Math.max(0, Math.sign(commandSide) * p.side) * sidePressure;
    const squeeze = Math.max(0, Math.abs(p.side) - 0.65) * crowd;
    const pos = passengerPosition(p, i, home, pile, squeeze, t);
    p.group.position.copy(pos);

    const falling = THREE.MathUtils.clamp((p.targetSide - p.side) * -0.55, -0.65, 0.65);
    const dance = danceMode ? Math.sin(t * 12 + home.phase) * 0.32 : 0;
    p.group.rotation.z = falling + Math.sin(t * 5 + home.phase) * 0.04 + dance;
    p.group.scale.set(
      home.scale * (1 - squeeze * 0.18),
      home.scale * (1 + squeeze * 0.28 + (danceMode ? Math.sin(t * 10 + home.phase) * 0.08 : 0)),
      1
    );

    const parts = p.group.userData.parts;
    const armWave = Math.sin(t * (danceMode ? 13 : 8) + home.phase) * (danceMode ? 0.9 : 0.32);
    parts.armL.rotation.z = 0.65 + armWave + commandSide * 0.35;
    parts.armR.rotation.z = -0.65 - armWave + commandSide * 0.35;
    if (p.area === 'side' || Math.abs(p.side) > 1.35) {
      parts.armL.rotation.z = 1.55 + armWave * 0.45;
      parts.armR.rotation.z = -1.55 - armWave * 0.45;
    }
  }
}

function passengerPosition(p, index, home, pile, squeeze, t) {
  const row = index % 18;
  const layer = Math.floor(index / 18);
  let x = p.side * 1.45 + (home.xSeed - 0.5) * 0.18;
  let y = floorY + 0.3 + (layer % 4) * 0.25 + (home.ySeed - 0.5) * 0.11;
  let z = 0.52 + (row % 5) * 0.035 + home.zSeed * 0.06;

  if (p.area === 'cabin') {
    x += (row - 8.5) * 0.006 * (1 - Math.abs(commandSide));
    y = THREE.MathUtils.clamp(y, 0.0, cabinTop - 0.05) + pile * 0.22;
  } else if (p.area === 'window') {
    x = p.side * 1.65 + (home.xSeed - 0.5) * 0.28;
    y = 0.78 + home.ySeed * 0.82 + pile * 0.34;
    z = 0.72 + squeeze * 0.15;
  } else if (p.area === 'roof') {
    x = p.side * 1.78 + (home.xSeed - 0.5) * 0.35;
    y = 1.82 + (layer % 5) * 0.24 + home.ySeed * 0.2 + pile * 0.55;
    z = 0.62 + home.zSeed * 0.11;
  } else {
    const sideSign = p.side === 0 ? Math.sign(commandSide || 1) : Math.sign(p.side);
    x = sideSign * (2.72 + home.xSeed * 0.45 + squeeze * 0.24);
    y = -0.08 + home.ySeed * 1.45 + pile * 0.18;
    z = 0.78 + home.zSeed * 0.1;
  }

  x += Math.sign(commandSide) * squeeze * 0.26;
  y += Math.sin(t * 8 + home.phase) * (danceMode ? 0.055 : 0.015);
  return new THREE.Vector3(x, y, z);
}

function calculateCOM() {
  let total = 64;
  let x = 0;
  let y = 0.25 * total;
  let roofCount = 0;

  for (const p of passengers) {
    if (!p.active) continue;
    const pos = p.group.position;
    total += p.weight;
    x += pos.x * p.weight;
    y += pos.y * p.weight;
    if (p.area === 'roof') roofCount += 1;
  }

  return {
    x: x / total,
    y: y / total,
    roofRatio: roofCount / Math.max(1, activeCount)
  };
}

function calculateStability(com) {
  const desired = nextCurve * 0.72;
  const horizontal = 1 - Math.min(1, Math.abs(desired - com.x) / 1.65);
  const highCenterPenalty = Math.max(0, com.y - 0.98) * 0.32 + com.roofRatio * 0.15;
  const overloadPenalty = Math.max(0, activeCount - 128) / 260;
  return Math.round(THREE.MathUtils.clamp(horizontal - highCenterPenalty - overloadPenalty, 0, 1) * 100);
}

function updateBus(com, t) {
  const lean = -com.x * 0.23 + nextCurve * 0.055 + Math.sin(t * 8) * 0.008;
  busRig.rotation.z = THREE.MathUtils.lerp(busRig.rotation.z, lean, 0.14);
  busRig.position.y = -Math.abs(com.x) * 0.16 + Math.sin(t * 16) * 0.012;
  busRig.position.x = Math.sin(t * 3.2) * 0.035 + resultFlash * THREE.MathUtils.randFloatSpread(0.035);
}

function updateWorld(t, dt) {
  const roadSpeed = (2.5 + activeCount * 0.035) * speedLevel;
  for (const stripe of roadStripes) {
    stripe.position.x -= dt * roadSpeed;
    if (stripe.position.x < -11.5) stripe.position.x += 23;
  }

  for (let i = 0; i < speedLines.length; i++) {
    const line = speedLines[i];
    line.position.x -= dt * roadSpeed * (1.2 + i * 0.03);
    if (line.position.x < -9.5) {
      line.position.x = 9.4;
      line.position.y = THREE.MathUtils.randFloat(-2.2, 3.0);
    }
    line.visible = speedLevel > 1.05 || resultFlash > 0;
  }

  for (const arrow of arrows) {
    arrow.scale.x = nextCurve;
    arrow.position.x += Math.sin(t * 8 + arrow.position.y) * 0.002;
  }
  fxRoot.position.x = nextCurve * 0.25;
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

  if (messageHold > 0) {
    messageHold -= dt;
    return;
  }

  if (danceMode) {
    ui.message.textContent = '満員！乗って、踊って、傾いて！スピードアップ！';
  } else {
    const seconds = Math.max(0, Math.ceil(roundTimer));
    ui.message.textContent = `${sideText}カーブまで ${seconds} 秒。インド人を${sideText}に！`;
  }
}

function judgeCurve(manual) {
  const com = calculateCOM();
  const stability = calculateStability(com);
  const success = stability >= 58;
  const sideText = nextCurve > 0 ? '右' : '左';

  if (success) {
    const gain = 7 + Math.floor(Math.random() * 10);
    activeCount = Math.min(maxPassengers, activeCount + gain);
    speedLevel = activeCount >= 135 ? Math.min(2.0, speedLevel + 0.18) : Math.min(1.55, speedLevel + 0.07);
    danceMode = activeCount >= 135;
    setMessage(`${sideText}に寄った！カーブ成功、乗客 +${gain}人`, 2.1);
  } else {
    const loss = 10 + Math.floor(Math.random() * 18);
    activeCount = Math.max(36, activeCount - loss);
    speedLevel = Math.max(1, speedLevel - 0.18);
    danceMode = false;
    setMessage(`逆に重い！危ないので ${loss}人 降車`, 2.4);
  }

  nextCurve *= -1;
  roundTimer = manual ? 7.5 : 6.4;
  resultFlash = 1;
  commandSide *= 0.25;
  redistributeOverflow();
  resetTargets(false);
}

function redistributeOverflow() {
  passengers.forEach((p, i) => {
    if (i < 72) p.area = 'cabin';
    else if (i < Math.min(activeCount, 100)) p.area = 'window';
    else if (i < Math.min(activeCount, 132)) p.area = 'roof';
    else p.area = 'side';
  });
}

function setMessage(text, hold) {
  ui.message.textContent = text;
  messageHold = hold;
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
