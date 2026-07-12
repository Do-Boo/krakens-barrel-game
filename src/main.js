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

const barrelRoot = new THREE.Group();
scene.add(barrelRoot);

const slotRoot = new THREE.Group();
scene.add(slotRoot);

const swordRoot = new THREE.Group();
scene.add(swordRoot);

const pirate = createPiratePlaceholder();
pirate.position.set(0, 1.82, 0);
pirate.scale.setScalar(0.001);
scene.add(pirate);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const slots = [];
const insertedSwords = [];
let triggerSlot = 0;
let currentPlayer = 0;
let gameOver = false;
let elapsed = 0;

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

  const rows = [0.7, 1.35, 2.0];
  const counts = [5, 6, 5];
  let index = 0;
  rows.forEach((height, rowIndex) => {
    for (let i = 0; i < counts[rowIndex]; i += 1) {
      const angle = (i / counts[rowIndex]) * Math.PI * 2 + rowIndex * 0.34;
      const radius = 1.47 - Math.abs(height - 1.35) * 0.13;
      const group = new THREE.Group();
      group.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
      group.lookAt(0, height, 0);
      group.userData = { slotIndex: index, used: false };

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.045, 10, 24),
        new THREE.MeshStandardMaterial({
          color: 0xf4c95d,
          emissive: 0x8b4900,
          emissiveIntensity: 0.7,
          metalness: 0.72,
          roughness: 0.28,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.userData.slotGroup = group;
      group.add(ring);

      const target = new THREE.Mesh(
        new THREE.CircleGeometry(0.115, 20),
        new THREE.MeshBasicMaterial({ color: 0x120807, side: THREE.DoubleSide }),
      );
      target.position.z = 0.008;
      target.userData.slotGroup = group;
      group.add(target);

      slotRoot.add(group);
      slots.push(group);
      index += 1;
    }
  });
}

function createSword(slot) {
  const sword = new THREE.Group();
  sword.position.copy(slot.position);
  sword.quaternion.copy(slot.quaternion);
  sword.translateZ(1.15);
  sword.userData.target = slot.position.clone();
  sword.userData.progress = 0;

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.095, 0.055, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xcde7eb, metalness: 0.92, roughness: 0.18 }),
  );
  blade.position.z = 0.52;
  blade.castShadow = true;
  sword.add(blade);

  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.13, 0.13),
    new THREE.MeshStandardMaterial({ color: 0xf0b83d, metalness: 0.8, roughness: 0.25 }),
  );
  guard.position.z = 1.2;
  sword.add(guard);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12),
    new THREE.MeshStandardMaterial({ color: 0x3e1a13, roughness: 0.85 }),
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 1.45;
  sword.add(handle);
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
  if (gameOver || slot.userData.used) return;
  slot.userData.used = true;
  slot.children.forEach((child) => {
    if (child.material) child.material.opacity = 0.2;
  });

  const sword = createSword(slot);
  swordRoot.add(sword);
  insertedSwords.push(sword);
  playTone(170, 0.18, 'square');

  if (slot.userData.slotIndex === triggerSlot) {
    gameOver = true;
    window.setTimeout(() => triggerPirate(), 430);
  } else {
    currentPlayer = (currentPlayer + 1) % 2;
    updateHud();
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
  currentPlayer = 0;
  triggerSlot = Math.floor(Math.random() * slots.length);
  resultCard.hidden = true;
  document.body.classList.remove('is-failed');
  hintLabel.textContent = '빛나는 슬롯을 눌러 칼을 꽂으세요';
  pirate.scale.setScalar(0.001);
  pirate.position.y = 1.82;
  swordRoot.clear();
  insertedSwords.length = 0;
  slots.forEach((slot) => {
    slot.userData.used = false;
    slot.children.forEach((child) => {
      if (child.material) child.material.opacity = 1;
    });
  });
  updateHud();
}

function updateHud() {
  turnLabel.textContent = `플레이어 ${currentPlayer + 1}`;
  playerBadge.textContent = `P${currentPlayer + 1}`;
  playerBadge.dataset.player = String(currentPlayer + 1);
  swordCount.textContent = `${insertedSwords.length} / ${slots.length}`;
}

function onPointerDown(event) {
  if (resultCard.contains(event.target) || event.target.closest('button')) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(slotRoot.children, true);
  if (intersections.length) {
    const slot = intersections[0].object.userData.slotGroup;
    if (slot) insertSword(slot);
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate(time) {
  elapsed = time * 0.001;
  controls.update();

  slots.forEach((slot, index) => {
    if (slot.userData.used) return;
    const ring = slot.children[0];
    ring.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 2.4 + index) * 0.22;
  });

  insertedSwords.forEach((sword) => {
    if (sword.userData.progress < 1) {
      sword.userData.progress = Math.min(1, sword.userData.progress + 0.07);
      const eased = 1 - (1 - sword.userData.progress) ** 3;
      sword.position.copy(sword.userData.target);
      sword.translateZ(1.15 * (1 - eased));
    }
  });

  if (gameOver) {
    const pop = Math.min(1, pirate.scale.x + 0.075);
    const overshoot = pop < 0.75 ? pop / 0.75 : 1 + Math.sin((pop - 0.75) * Math.PI * 4) * 0.08;
    pirate.scale.setScalar(Math.max(0.001, overshoot));
    pirate.position.y = 1.82 + Math.sin(Math.min(1, pop) * Math.PI) * 1.15;
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
    const scale = 2.9 / size.y;
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
