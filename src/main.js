import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import '../styles.css';

const canvas = document.querySelector('#game-canvas');
const loading = document.querySelector('#loading');
const loadingProgress = document.querySelector('#loading-progress');
const turnLabel = document.querySelector('#turn-label');
const playerBadge = document.querySelector('#player-badge');
const swordCount = document.querySelector('#sword-count');
const hintLabel = document.querySelector('#hint-label');
const resultCard = document.querySelector('#result-card');
const resultTitle = document.querySelector('#result-title');
const containerButtons = [...document.querySelectorAll('[data-container]')];
const swordButtons = [...document.querySelectorAll('[data-sword]')];

const CONTAINER_CONFIGS = {
  wood: {
    height: 3.4,
    rows: [0.84, 1.68, 2.52],
    openingRadius: 0.66,
    radiusAt(height) {
      const normalizedHeight = Math.abs(height - 1.7) / 1.7;
      return 1.5 - normalizedHeight * normalizedHeight * 0.2;
    },
  },
  drum: {
    height: 3.72,
    rows: [0.92, 1.84, 2.76],
    openingRadius: 0.61,
    radiusAt() {
      return 1.365;
    },
  },
};

let containerStyle = 'wood';
let swordStyle = 'classic';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x091726, 0.045);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(6.5, 4.2, 7.8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1.45, 0);
controls.minDistance = 5;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.52;

scene.add(new THREE.HemisphereLight(0x92dfff, 0x23120c, 2.5));

const keyLight = new THREE.DirectionalLight(0xffd18a, 5.5);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x17d7ff, 22, 12);
rimLight.position.set(-4, 3, -3);
scene.add(rimLight);

const table = new THREE.Mesh(
  new THREE.CylinderGeometry(4.7, 5.1, 0.55, 64),
  new THREE.MeshStandardMaterial({ color: 0x4f2515, roughness: 0.82, metalness: 0.05 }),
);
table.position.y = -0.33;
table.receiveShadow = true;
scene.add(table);

const tableRim = new THREE.Mesh(
  new THREE.TorusGeometry(4.72, 0.16, 12, 64),
  new THREE.MeshStandardMaterial({ color: 0x1b0d08, roughness: 0.7 }),
);
tableRim.rotation.x = Math.PI / 2;
tableRim.position.y = -0.08;
scene.add(tableRim);

const gameRoot = new THREE.Group();
scene.add(gameRoot);

const barrelRoot = new THREE.Group();
gameRoot.add(barrelRoot);

const drumRoot = createDrumContainer();
drumRoot.visible = false;
gameRoot.add(drumRoot);

const slotRoot = new THREE.Group();
gameRoot.add(slotRoot);

const swordRoot = new THREE.Group();
gameRoot.add(swordRoot);

const openingRoot = new THREE.Group();
const opening = new THREE.Mesh(
  new THREE.CylinderGeometry(0.57, 0.57, 0.035, 48),
  new THREE.MeshStandardMaterial({ color: 0x090606, roughness: 0.96 }),
);
opening.position.y = 2.91;
opening.receiveShadow = true;
openingRoot.add(opening);

const openingRim = new THREE.Mesh(
  new THREE.TorusGeometry(0.57, 0.045, 10, 48),
  new THREE.MeshStandardMaterial({ color: 0x171310, metalness: 0.82, roughness: 0.38 }),
);
openingRim.rotation.x = Math.PI / 2;
openingRim.position.y = 2.935;
openingRoot.add(openingRim);
gameRoot.add(openingRoot);

const pirate = createPiratePlaceholder();
pirate.position.set(0, 2.28, 0);
pirate.scale.setScalar(0.001);
gameRoot.add(pirate);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const slots = [];
const insertedSwords = [];
let triggerSlot = 0;
let currentPlayer = 0;
let gameOver = false;
let isAnimating = false;
let hoveredSlot = null;
let impactKick = 0;
let piratePop = 0;
let elapsed = 0;
let lastFrameTime = 0;

function createDrumContainer() {
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x075ca8,
    metalness: 0.82,
    roughness: 0.2,
    clearcoat: 0.72,
    clearcoatRoughness: 0.13,
  });
  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0870c5,
    metalness: 0.9,
    roughness: 0.16,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.34, 3.64, 96), bodyMaterial);
  body.position.y = 1.86;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.305, 1.305, 0.065, 96), bodyMaterial);
  lid.position.y = 3.675;
  lid.castShadow = true;
  lid.receiveShadow = true;
  root.add(lid);

  [0.075, 3.645].forEach((height) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.355, 0.06, 12, 96), edgeMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = height;
    rim.castShadow = true;
    root.add(rim);
  });

  [1.24, 2.48].forEach((height) => {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.045, 10, 96), edgeMaterial);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = height;
    rib.castShadow = true;
    root.add(rib);
  });

  const bung = new THREE.Group();
  bung.position.set(0.76, 3.73, 0.7);
  const bungBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.055, 24), edgeMaterial);
  bungBase.castShadow = true;
  bung.add(bungBase);
  const bungInset = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.06, 20),
    new THREE.MeshStandardMaterial({ color: 0x183e5f, metalness: 0.9, roughness: 0.3 }),
  );
  bungInset.position.y = 0.035;
  bungInset.castShadow = true;
  bung.add(bungInset);
  root.add(bung);
  return root;
}

function createPiratePlaceholder() {
  const root = new THREE.Group();
  const coat = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.45, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0xd83d4d, roughness: 0.65 }),
  );
  coat.position.y = 0.35;
  coat.castShadow = true;
  root.add(coat);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0xf2b47e, roughness: 0.7 }),
  );
  head.position.y = 0.9;
  head.castShadow = true;
  root.add(head);

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.42, 0.24, 3),
    new THREE.MeshStandardMaterial({ color: 0x182539, roughness: 0.5 }),
  );
  hat.position.y = 1.17;
  hat.rotation.y = Math.PI / 2;
  root.add(hat);
  return root;
}

function buildSlots() {
  slotRoot.clear();
  slots.length = 0;

  const rows = [0, 1, 2];
  const counts = [5, 6, 5];
  let index = 0;
  rows.forEach((_, rowIndex) => {
    for (let i = 0; i < counts[rowIndex]; i += 1) {
      const angle = (i / counts[rowIndex]) * Math.PI * 2 + rowIndex * 0.34;
      const group = new THREE.Group();
      group.userData = { slotIndex: index, rowIndex, angle, used: false };

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.021, 10, 28),
        new THREE.MeshStandardMaterial({
          color: 0x46372d,
          emissive: 0x1e1208,
          emissiveIntensity: 0.18,
          metalness: 0.76,
          roughness: 0.42,
        }),
      );
      ring.position.z = -0.025;
      ring.userData.slotGroup = group;
      group.add(ring);

      const target = new THREE.Mesh(
        new THREE.CircleGeometry(0.098, 24),
        new THREE.MeshStandardMaterial({
          color: 0x060303,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      );
      target.position.z = -0.021;
      target.userData.slotGroup = group;
      group.add(target);

      const hitArea = new THREE.Mesh(
        new THREE.CircleGeometry(0.19, 20),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      hitArea.position.z = -0.055;
      hitArea.userData.slotGroup = group;
      group.add(hitArea);

      group.userData.ring = ring;
      group.userData.target = target;

      slotRoot.add(group);
      slots.push(group);
      index += 1;
    }
  });
  updateContainerLayout();
}

function updateContainerLayout() {
  const config = CONTAINER_CONFIGS[containerStyle];
  barrelRoot.visible = containerStyle === 'wood';
  drumRoot.visible = containerStyle === 'drum';

  slots.forEach((slot) => {
    const { rowIndex, angle } = slot.userData;
    const height = config.rows[rowIndex];
    const radius = config.radiusAt(height);
    slot.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    slot.lookAt(0, height, 0);
  });

  const openingScale = config.openingRadius / 0.57;
  opening.scale.set(openingScale, 1, openingScale);
  opening.position.y = config.height + 0.01;
  openingRim.scale.setScalar(openingScale);
  openingRim.position.y = config.height + 0.035;
  controls.target.y = config.height * 0.5;
  controls.update();
}

function selectContainer(style) {
  if (!CONTAINER_CONFIGS[style] || style === containerStyle) return;
  containerStyle = style;
  containerButtons.forEach((button) => {
    const selected = button.dataset.container === style;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  updateContainerLayout();
  resetGame();
  hintLabel.textContent = style === 'wood'
    ? '더 커진 오크통에서 구멍을 선택하세요'
    : '금속 드럼통에서 구멍을 선택하세요';
}

function selectSword(style) {
  swordStyle = style;
  swordButtons.forEach((button) => {
    const selected = button.dataset.sword === style;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const names = { classic: '선장 해적검', cutlass: 'D가드 커틀러스', dagger: '크라켄 단검' };
  hintLabel.textContent = `${names[style]} 선택 — 다음 구멍을 노리세요`;
}

function createShapedBlade(style, material) {
  const shape = new THREE.Shape();
  if (style === 'cutlass') {
    shape.moveTo(-0.12, -0.2);
    shape.quadraticCurveTo(-0.2, 0.45, 0.08, 1.12);
    shape.quadraticCurveTo(0.18, 1.03, 0.2, 0.91);
    shape.quadraticCurveTo(0.02, 0.4, 0.06, -0.2);
  } else if (style === 'dagger') {
    shape.moveTo(-0.14, -0.2);
    shape.lineTo(-0.23, 0.2);
    shape.quadraticCurveTo(-0.22, 0.6, 0, 1.04);
    shape.quadraticCurveTo(0.22, 0.6, 0.23, 0.2);
    shape.lineTo(0.14, -0.2);
  } else {
    shape.moveTo(-0.115, -0.2);
    shape.lineTo(-0.14, 0.68);
    shape.lineTo(0, 1.12);
    shape.lineTo(0.14, 0.68);
    shape.lineTo(0.115, -0.2);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: style === 'dagger' ? 0.07 : 0.05,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.016,
    bevelThickness: 0.012,
  });
  geometry.rotateX(Math.PI / 2);
  const blade = new THREE.Mesh(geometry, material);
  blade.castShadow = true;
  return blade;
}

function createCurvedGuard(points, material, radius = 0.025) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const guard = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 7, false), material);
  guard.castShadow = true;
  return guard;
}

function createSword(slot, player) {
  const design = swordStyle;
  const sword = new THREE.Group();
  sword.position.copy(slot.position);
  sword.quaternion.copy(slot.quaternion);
  const designRoll = design === 'cutlass' ? 0.34 : design === 'dagger' ? 0.04 : 0.12;
  sword.rotateZ(player === 0 ? -designRoll : designRoll);
  sword.translateZ(-1.24);
  sword.userData.target = slot.position.clone();
  sword.userData.progress = 0;
  sword.userData.impacted = false;
  sword.userData.player = player;
  sword.userData.slot = slot;
  sword.userData.startedAt = elapsed;
  sword.userData.design = design;

  const bladeMaterial = new THREE.MeshPhysicalMaterial({
    color: design === 'dagger' ? 0xbfeaff : 0xe4f6f7,
    metalness: 0.94,
    roughness: 0.12,
    clearcoat: 0.55,
    clearcoatRoughness: 0.08,
  });
  sword.add(createShapedBlade(design, bladeMaterial));

  const guardMaterial = new THREE.MeshPhysicalMaterial({
    color: design === 'dagger' ? 0x8fd9ec : design === 'cutlass' ? 0xd89d2d : 0xe8b33f,
    metalness: 0.88,
    roughness: 0.22,
    clearcoat: 0.35,
  });
  if (design === 'classic') {
    sword.add(createCurvedGuard([
      [-0.34, 0, -0.22], [-0.2, 0.025, -0.26], [0, 0, -0.27],
      [0.2, -0.025, -0.26], [0.34, 0, -0.22],
    ], guardMaterial, 0.034));
    [-1, 1].forEach((side) => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), guardMaterial);
      cap.position.set(side * 0.34, 0, -0.22);
      sword.add(cap);
    });
  } else if (design === 'cutlass') {
    sword.add(createCurvedGuard([
      [-0.27, 0, -0.22], [-0.42, 0.02, -0.38], [-0.4, 0.01, -0.64],
      [-0.24, 0, -0.83], [-0.04, 0, -0.82],
    ], guardMaterial, 0.033));
    sword.add(createCurvedGuard([
      [-0.27, 0, -0.22], [-0.08, 0.035, -0.27], [0.18, 0, -0.25],
    ], guardMaterial, 0.038));
  } else {
    sword.add(createCurvedGuard([
      [0, 0, -0.26], [-0.2, 0.04, -0.3], [-0.35, -0.02, -0.22], [-0.3, -0.01, -0.1],
    ], guardMaterial, 0.032));
    sword.add(createCurvedGuard([
      [0, 0, -0.26], [0.2, -0.04, -0.3], [0.35, 0.02, -0.22], [0.3, 0.01, -0.1],
    ], guardMaterial, 0.032));
  }

  const gripColor = player === 0 ? 0x36cde2 : 0xff685f;
  const gripLength = design === 'cutlass' ? 0.48 : design === 'dagger' ? 0.38 : 0.42;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, gripLength, 12),
    new THREE.MeshStandardMaterial({ color: gripColor, roughness: 0.56, metalness: 0.08 }),
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = design === 'cutlass' ? -0.55 : design === 'dagger' ? -0.48 : -0.51;
  handle.castShadow = true;
  sword.add(handle);

  const wrapMaterial = new THREE.MeshStandardMaterial({
    color: player === 0 ? 0x0c6578 : 0x8c282d,
    metalness: 0.18,
    roughness: 0.48,
  });
  const wrapCenter = handle.position.z;
  for (let i = -2; i <= 2; i += 1) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.009, 6, 14), wrapMaterial);
    wrap.position.z = wrapCenter + i * (gripLength * 0.18);
    sword.add(wrap);
  }

  const pommel = new THREE.Mesh(
    design === 'dagger'
      ? new THREE.OctahedronGeometry(0.12)
      : new THREE.SphereGeometry(0.105, 14, 10),
    new THREE.MeshStandardMaterial({
      color: design === 'dagger' ? 0x37d9e6 : 0xe4ad32,
      emissive: design === 'dagger' ? 0x063e65 : 0x000000,
      emissiveIntensity: design === 'dagger' ? 0.7 : 0,
      metalness: 0.78,
      roughness: 0.28,
    }),
  );
  pommel.position.z = design === 'cutlass' ? -0.83 : design === 'dagger' ? -0.7 : -0.75;
  pommel.castShadow = true;
  sword.add(pommel);
  return sword;
}

function playTone(frequency, duration, type = 'sine') {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.08, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function insertSword(slot) {
  if (gameOver || isAnimating || slot.userData.used) return;
  isAnimating = true;
  slot.userData.used = true;
  hoveredSlot = null;
  canvas.classList.remove('is-aiming');
  hintLabel.textContent = '칼을 힘껏 꽂는 중…';

  const sword = createSword(slot, currentPlayer);
  swordRoot.add(sword);
  insertedSwords.push(sword);
  playTone(340, 0.09, 'triangle');
}

function resolveSwordImpact(sword) {
  const { slot, player } = sword.userData;
  impactKick = 1;
  slot.userData.ring.material.color.setHex(0x251a14);
  slot.userData.ring.material.emissive.setHex(0x080402);
  slot.userData.ring.material.emissiveIntensity = 0.05;
  slot.userData.target.material.color.setHex(0x020101);
  playTone(105, 0.22, 'square');
  window.setTimeout(() => playTone(62, 0.28, 'sine'), 55);
  updateHud();

  if (slot.userData.slotIndex === triggerSlot) {
    gameOver = true;
    currentPlayer = player;
    window.setTimeout(() => triggerPirate(), 190);
  } else {
    currentPlayer = (player + 1) % 2;
    window.setTimeout(() => {
      hintLabel.textContent = '다음 플레이어, 구멍을 선택하세요';
      updateHud();
    }, 170);
  }
}

function triggerPirate() {
  playTone(95, 0.7, 'sawtooth');
  resultTitle.textContent = `플레이어 ${currentPlayer + 1} 패배`;
  resultCard.hidden = false;
  hintLabel.textContent = '크라켄이 깨어났습니다!';
  document.body.classList.add('is-failed');
}

function resetGame() {
  gameOver = false;
  isAnimating = false;
  hoveredSlot = null;
  impactKick = 0;
  piratePop = 0;
  currentPlayer = 0;
  triggerSlot = Math.floor(Math.random() * slots.length);
  resultCard.hidden = true;
  document.body.classList.remove('is-failed');
  hintLabel.textContent = '어두운 칼 구멍을 눌러보세요';
  pirate.scale.setScalar(0.001);
  pirate.position.set(0, CONTAINER_CONFIGS[containerStyle].height - 0.63, 0);
  pirate.rotation.set(0, 0, 0);
  gameRoot.position.set(0, 0, 0);
  gameRoot.rotation.set(0, 0, 0);
  swordRoot.clear();
  insertedSwords.length = 0;
  slots.forEach((slot) => {
    slot.userData.used = false;
    slot.userData.ring.material.color.setHex(0x46372d);
    slot.userData.ring.material.emissive.setHex(0x1e1208);
    slot.userData.ring.material.emissiveIntensity = 0.18;
    slot.userData.target.material.color.setHex(0x060303);
  });
  updateHud();
}

function updateHud() {
  turnLabel.textContent = `플레이어 ${currentPlayer + 1}`;
  playerBadge.textContent = `P${currentPlayer + 1}`;
  playerBadge.dataset.player = String(currentPlayer + 1);
  swordCount.textContent = `${insertedSwords.length} / ${slots.length}`;
}

function findSlotAtPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(slotRoot.children, true);
  return intersections.find((hit) => !hit.object.userData.slotGroup?.userData.used)?.object.userData.slotGroup ?? null;
}

function onPointerMove(event) {
  if (gameOver || isAnimating) return;
  hoveredSlot = findSlotAtPointer(event);
  canvas.classList.toggle('is-aiming', Boolean(hoveredSlot));
  hintLabel.textContent = hoveredSlot
    ? '조준 완료 — 클릭해서 칼을 꽂으세요'
    : '어두운 칼 구멍을 선택하세요';
}

function onPointerDown(event) {
  if (resultCard.contains(event.target) || event.target.closest('button')) return;
  const slot = findSlotAtPointer(event);
  if (slot) insertSword(slot);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate(time) {
  const deltaTime = lastFrameTime ? Math.min(0.05, (time - lastFrameTime) * 0.001) : 0;
  lastFrameTime = time;
  elapsed = time * 0.001;
  controls.update();

  slots.forEach((slot, index) => {
    if (slot.userData.used) return;
    const ring = slot.userData.ring;
    const isHovered = slot === hoveredSlot;
    ring.material.color.setHex(isHovered ? 0xd7a43d : 0x46372d);
    ring.material.emissive.setHex(isHovered ? 0x8b4900 : 0x1e1208);
    ring.material.emissiveIntensity = isHovered
      ? 0.85
      : 0.16 + Math.sin(elapsed * 2.1 + index) * 0.06;
    const scale = isHovered ? 1.16 : 1;
    ring.scale.x += (scale - ring.scale.x) * 0.2;
    ring.scale.y += (scale - ring.scale.y) * 0.2;
    ring.scale.z += (scale - ring.scale.z) * 0.2;
  });

  insertedSwords.forEach((sword) => {
    if (sword.userData.progress < 1) {
      const progress = Math.min(1, (elapsed - sword.userData.startedAt) / 0.62);
      sword.userData.progress = progress;
      let offset;
      if (progress < 0.2) {
        const pullback = progress / 0.2;
        offset = THREE.MathUtils.lerp(-1.24, -1.42, 1 - (1 - pullback) ** 2);
      } else if (progress < 0.82) {
        const strike = (progress - 0.2) / 0.62;
        offset = THREE.MathUtils.lerp(-1.42, 0.075, strike ** 3);
      } else {
        const settle = (progress - 0.82) / 0.18;
        offset = THREE.MathUtils.lerp(0.075, 0, 1 - (1 - settle) ** 2);
      }
      sword.position.copy(sword.userData.target);
      sword.translateZ(offset);

      if (progress >= 0.82 && !sword.userData.impacted) {
        sword.userData.impacted = true;
        resolveSwordImpact(sword);
      }
      if (progress >= 1) isAnimating = false;
    }
  });

  impactKick = Math.max(0, impactKick - deltaTime * 4.8);
  if (impactKick > 0) {
    gameRoot.rotation.z = Math.sin(elapsed * 62) * impactKick * 0.022;
    gameRoot.position.y = Math.abs(Math.sin(elapsed * 48)) * impactKick * 0.035;
  } else {
    gameRoot.rotation.z *= 0.7;
    gameRoot.position.y *= 0.7;
  }

  if (gameOver) {
    piratePop = Math.min(1, piratePop + deltaTime * 3.1);
    const pop = 1 - (1 - piratePop) ** 3;
    const overshoot = piratePop < 0.7
      ? pop / 0.92
      : 1 + Math.sin((piratePop - 0.7) * Math.PI * 3.3) * (1 - piratePop) * 0.22;
    pirate.scale.setScalar(Math.max(0.001, overshoot));
    const pirateBaseY = CONTAINER_CONFIGS[containerStyle].height - 0.63;
    pirate.position.y = pirateBaseY + pop * 1.05 + Math.sin(piratePop * Math.PI) * 0.34;
    pirate.rotation.y = Math.sin(elapsed * 9) * 0.14;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

buildSlots();
resetGame();
resize();
window.addEventListener('resize', resize);
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerleave', () => {
  hoveredSlot = null;
  canvas.classList.remove('is-aiming');
});
containerButtons.forEach((button) => {
  button.addEventListener('click', () => selectContainer(button.dataset.container));
});
swordButtons.forEach((button) => {
  button.addEventListener('click', () => selectSword(button.dataset.sword));
});
document.querySelector('#reset-button').addEventListener('click', resetGame);
document.querySelector('#play-again-button').addEventListener('click', resetGame);
requestAnimationFrame(animate);

const loader = new GLTFLoader();
loader.load(
  `${import.meta.env.BASE_URL}assets/models/barrel.glb`,
  (gltf) => {
    const model = gltf.scene;
    model.traverse((object) => {
      if (!object.isMesh) return;
      if (!object.geometry.attributes.normal) object.geometry.computeVertexNormals();
      if (object.material) {
        object.material.envMapIntensity = 0.75;
        object.material.needsUpdate = true;
      }
      object.castShadow = true;
      object.receiveShadow = true;
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = CONTAINER_CONFIGS.wood.height / size.y;
    model.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;
    barrelRoot.add(model);
    loading.classList.add('loading--hidden');
  },
  (event) => {
    if (event.total) loadingProgress.textContent = `${Math.round((event.loaded / event.total) * 100)}%`;
  },
  (error) => {
    console.error(error);
    loading.querySelector('strong').textContent = '모델을 불러오지 못했습니다';
    loadingProgress.textContent = '새로고침해 주세요';
  },
);
