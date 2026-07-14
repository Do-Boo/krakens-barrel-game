import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Peer } from 'peerjs';
import QRCode from 'qrcode';
import {
  createRoomCode,
  MAX_ROOM_PLAYERS,
  normalizePlayerName,
  normalizeRoomCode,
  roomPeerId,
} from './room-protocol.js';
import { RoomDirectory } from './room-directory.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game-canvas');
const loading = $('#loading');
const loadingProgress = $('#loading-progress');
const turnLabel = $('#turn-label');
const roundLabel = $('#round-label');
const playerBadge = $('#player-badge');
const swordCount = $('#sword-count');
const turnTimer = $('#turn-timer');
const hintLabel = $('#hint-label');
const tensionFill = $('#tension-fill');
const tensionLabel = $('#tension-label');
const scoreboard = $('#scoreboard');
const resultCard = $('#result-card');
const resultEyebrow = $('#result-eyebrow');
const resultTitle = $('#result-title');
const resultCopy = $('#result-copy');
const resultScores = $('#result-scores');
const resultButton = $('#play-again-button');
const settingsDialog = $('#settings-dialog');
const settingsButton = $('#settings-button');
const playerCountSelect = $('#player-count');
const playerNameFields = $('#player-name-fields');
const startScreen = $('#start-screen');
const gameStage = $('#game-stage');
const startHomePanel = $('#start-home-panel');
const hostSetupPanel = $('#host-setup-panel');
const showHostSetupButton = $('#show-host-setup');
const backStartHomeButton = $('#back-start-home');
const startLocalGameButton = $('#start-local-game');
const roomCapacitySelect = $('#room-capacity');
const roomModeButtons = [...document.querySelectorAll('[data-room-mode]')];
const roomTargetButtons = [...document.querySelectorAll('[data-room-target]')];
const roomContainerButtons = [...document.querySelectorAll('[data-room-container]')];
const remoteQr = $('#remote-qr');
const remoteLoading = $('#remote-loading');
const remoteStatus = $('#remote-status');
const remoteCode = $('#remote-code');
const copyRemoteLinkButton = $('#copy-remote-link');
const roomHostPanel = $('#room-host-panel');
const createRoomButton = $('#create-room-button');
const joinRoomCodeInput = $('#join-room-code');
const joinRoomButton = $('#join-room-button');
const roomPlayerCount = $('#room-player-count');
const roomPlayerList = $('#room-player-list');
const roomSettingsSummary = $('#room-settings-summary');
const roomReadyGuide = $('#room-ready-guide');
const startRoomGameButton = $('#start-room-game');
const closeRoomButton = $('#close-room-button');
const roomTitleInput = $('#room-title');
const activeRoomTitle = $('#active-room-title');
const openRoomList = $('#open-room-list');
const roomDirectoryStatus = $('#room-directory-status');
const refreshRoomListButton = $('#refresh-room-list');
const randomRoomButton = $('#random-room-button');
const toast = $('#toast');
const containerButtons = [...document.querySelectorAll('[data-container]')];
const swordButtons = [...document.querySelectorAll('[data-sword]')];
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const targetButtons = [...document.querySelectorAll('[data-target-score]')];
const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPE[character]);

const PLAYER_COLORS = [
  { css: '#4bd7e7', three: 0x4bd7e7 },
  { css: '#ff7b70', three: 0xff7b70 },
  { css: '#f3c860', three: 0xf3c860 },
  { css: '#a78bfa', three: 0xa78bfa },
  { css: '#73e29a', three: 0x73e29a },
  { css: '#f38fca', three: 0xf38fca },
];

const MODE_CONFIGS = {
  classic: { name: '클래식', triggerCount: 1, timeLimit: 0 },
  double: { name: '더블 크라켄', triggerCount: 2, timeLimit: 0 },
  speed: { name: '7초 속전속결', triggerCount: 1, timeLimit: 7 },
  reverse: { name: '역전 모드', triggerCount: 1, timeLimit: 0 },
};

const WEAPON_NAMES = {
  classic: '선장 해적검',
  cutlass: 'D가드 커틀러스',
  dagger: '크라켄 단검',
  fish: '냉동 고등어',
  carrot: '전설의 당근',
  umbrella: '선장의 우산',
};

const MESHY_ASSETS = {
  wood: { file: 'oak_barrel.glb', kind: 'container' },
  drum: { file: 'blue_drum.glb', kind: 'container' },
  powder: { file: 'powder_barrel.glb', kind: 'container' },
  pirate: { file: 'pirate_captain_expressive.glb', kind: 'pirate' },
  classic: {
    file: 'captain_sword.glb',
    kind: 'weapon',
    axis: 'x',
    rotation: -Math.PI / 2,
    forward: [0.74835, 0.6407, 0.17168],
  },
  cutlass: {
    file: 'cutlass.glb',
    kind: 'weapon',
    axis: 'x',
    rotation: Math.PI / 2,
    forward: [-0.83008, -0.48776, -0.27029],
  },
  dagger: {
    file: 'kraken_dagger.glb',
    kind: 'weapon',
    axis: 'x',
    rotation: Math.PI / 2,
    forward: [-0.75071, -0.66063, -0.00018],
  },
  fish: { file: 'frozen_mackerel.glb', kind: 'weapon', axis: 'z', rotation: 0 },
  carrot: {
    file: 'legendary_carrot.glb',
    kind: 'weapon',
    axis: 'z',
    rotation: 0,
    forward: [-0.00103, 0.54763, 0.83672],
  },
  umbrella: { file: 'captain_umbrella.glb', kind: 'weapon', axis: 'y', rotation: -Math.PI / 2 },
};

const CONTAINER_CONFIGS = {
  wood: {
    name: '오크통',
    height: 3.4,
    rows: [0.84, 1.68, 2.52],
    openingRadius: 0.66,
    radiusAt(height) {
      const normalizedHeight = Math.abs(height - 1.7) / 1.7;
      return 1.5 - normalizedHeight * normalizedHeight * 0.2;
    },
  },
  drum: {
    name: '코발트 드럼통',
    height: 3.72,
    rows: [0.92, 1.84, 2.76],
    openingRadius: 0.61,
    radiusAt() {
      return 1.365;
    },
  },
  powder: {
    name: '저주받은 화약통',
    height: 3.48,
    rows: [0.86, 1.72, 2.58],
    openingRadius: 0.64,
    radiusAt(height) {
      const normalizedHeight = Math.abs(height - 1.74) / 1.74;
      return 1.47 - normalizedHeight * normalizedHeight * 0.16;
    },
  },
};

const CONTAINER_ICONS = {
  wood: '/assets/ui/icon-container-wood.png',
  drum: '/assets/ui/icon-container-drum.png',
  powder: '/assets/ui/icon-container-powder.png',
};

let players = [
  { name: '플레이어 1', score: 0, ...PLAYER_COLORS[0] },
  { name: '플레이어 2', score: 0, ...PLAYER_COLORS[1] },
];
let gameMode = 'classic';
let targetScore = 3;
let roundNumber = 1;
let roundStarter = 0;
let currentPlayer = 0;
let containerStyle = 'wood';
let swordStyle = 'classic';
let triggerSlots = new Set();
let gameOver = false;
let isAnimating = false;
let hoveredSlot = null;
let remoteSelectedSlot = null;
let impactKick = 0;
let fakeoutKick = 0;
let piratePop = 0;
let pirateAwake = false;
let pirateRevealCameraCaptured = false;
let elapsed = 0;
let lastFrameTime = 0;
let turnDeadline = 0;
let lastTimerSecond = null;
let matchFinished = false;
let toastTimeout = null;
let audioContext = null;
const firedFakeouts = new Set();

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2f7187, 0.026);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(6.5, 4.2, 7.8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.38;
renderer.localClippingEnabled = true;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1.45, 0);
controls.minDistance = 5;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.52;

scene.add(new THREE.HemisphereLight(0xc8f5ff, 0x5e3827, 3.25));

const keyLight = new THREE.DirectionalLight(0xffe1ad, 5.2);
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

const fillLight = new THREE.DirectionalLight(0xb7eaff, 2.4);
fillLight.position.set(-4, 4.5, 6);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x4de6ff, 15, 12);
rimLight.position.set(-4, 3, -3);
scene.add(rimLight);

const dangerLight = new THREE.PointLight(0xff3e2f, 0, 8);
dangerLight.position.set(0, 3.5, 2.5);
scene.add(dangerLight);

const table = new THREE.Mesh(
  new THREE.CylinderGeometry(4.7, 5.1, 0.55, 64),
  new THREE.MeshStandardMaterial({ color: 0x744127, roughness: 0.78, metalness: 0.04 }),
);
table.position.y = -0.33;
table.receiveShadow = true;
scene.add(table);

const tableRim = new THREE.Mesh(
  new THREE.TorusGeometry(4.72, 0.16, 12, 64),
  new THREE.MeshStandardMaterial({ color: 0x3b1d11, roughness: 0.68 }),
);
tableRim.rotation.x = Math.PI / 2;
tableRim.position.y = -0.08;
scene.add(tableRim);

const gameRoot = new THREE.Group();
scene.add(gameRoot);

const barrelRoot = new THREE.Group();
gameRoot.add(barrelRoot);

const drumRoot = new THREE.Group();
drumRoot.visible = false;
gameRoot.add(drumRoot);

const powderRoot = new THREE.Group();
powderRoot.visible = false;
gameRoot.add(powderRoot);

const containerRoots = { wood: barrelRoot, drum: drumRoot, powder: powderRoot };

const slotRoot = new THREE.Group();
gameRoot.add(slotRoot);

const weaponRoot = new THREE.Group();
gameRoot.add(weaponRoot);

const effectsRoot = new THREE.Group();
scene.add(effectsRoot);
const particles = [];

const openingRoot = new THREE.Group();
const opening = new THREE.Mesh(
  new THREE.CylinderGeometry(0.57, 0.57, 0.035, 48),
  new THREE.MeshStandardMaterial({ color: 0x060405, roughness: 0.96 }),
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

const pirate = new THREE.Group();
const PIRATE_SIZE_MULTIPLIER = 2.6;
const PIRATE_REST_SCALE = 0.94 * PIRATE_SIZE_MULTIPLIER;
const PIRATE_POP_SCALE = 1.02 * PIRATE_SIZE_MULTIPLIER;
const PIRATE_NECK_CLIP_Y = 1.27;
const PIRATE_REST_DEPTH = PIRATE_NECK_CLIP_Y * PIRATE_REST_SCALE;
const PIRATE_REST_FORWARD = 0.32;
const PIRATE_POP_FORWARD = 0.56;
const PIRATE_FORWARD_YAW = 0;
const pirateClipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const openingClipPoint = new THREE.Vector3();
const pirateRevealCameraStart = new THREE.Vector3();
const pirateRevealCameraEnd = new THREE.Vector3();
const pirateRevealTargetStart = new THREE.Vector3();
const pirateRevealTargetEnd = new THREE.Vector3();
const pirateRevealHorizontal = new THREE.Vector3();
const pirateMorphMeshes = [];
const pirateExpression = { blink: 0, worried: 0, surprised: 0 };
let pirateMixer = null;
let pirateIdleAction = null;
let pirateRevealAction = null;
pirate.scale.setScalar(PIRATE_REST_SCALE);
gameRoot.add(pirate);

const weaponTemplates = new Map();

const raycaster = new THREE.Raycaster();
const surfaceRaycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const slots = [];
const insertedWeapons = [];

let remotePeer = null;
let remoteLink = '';
let activeRoomCode = '';
let roomGameActive = false;
let roomCreationAttempt = 0;
let gameCanvasStream = null;
let roomCapacity = 4;
let activeRoomSettings = {
  title: '크라켄 사냥 원정대',
  mode: 'classic',
  targetScore: 3,
  container: 'wood',
};
const roomPlayers = new Map();
const roomDirectory = new RoomDirectory();
let directoryRooms = [];
let directoryStatus = 'connecting';

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
  bung.add(bungInset);
  root.add(bung);
  return root;
}

function createPowderContainer() {
  const root = new THREE.Group();
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x251c1a, roughness: 0.88, metalness: 0.03 });
  const charMaterial = new THREE.MeshStandardMaterial({ color: 0x0e0c0c, roughness: 0.94 });
  const bandMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xa52c28,
    metalness: 0.78,
    roughness: 0.28,
    clearcoat: 0.35,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.31, 1.31, 3.42, 24), woodMaterial);
  body.position.y = 1.73;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const stave = new THREE.Mesh(new THREE.BoxGeometry(0.17, 3.32, 0.07), charMaterial);
    stave.position.set(Math.sin(angle) * 1.31, 1.73, Math.cos(angle) * 1.31);
    stave.rotation.y = angle;
    stave.castShadow = true;
    root.add(stave);
  }

  [0.34, 1.72, 3.12].forEach((height) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.39, 0.075, 10, 64), bandMaterial);
    band.rotation.x = Math.PI / 2;
    band.position.y = height;
    band.castShadow = true;
    root.add(band);
  });

  const warning = new THREE.Group();
  warning.position.set(0, 1.73, 1.35);
  const skullMaterial = new THREE.MeshStandardMaterial({ color: 0xe6d5a8, roughness: 0.72 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skullMaterial);
  skull.scale.y = 0.85;
  warning.add(skull);
  [-0.08, 0.08].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), charMaterial);
    eye.position.set(x, 0.03, 0.2);
    warning.add(eye);
  });
  [-1, 1].forEach((side) => {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), skullMaterial);
    bone.position.set(side * 0.03, -0.18, -0.01);
    bone.rotation.z = side * 0.82;
    warning.add(bone);
  });
  root.add(warning);
  return root;
}

function createPirateCaptain() {
  const root = new THREE.Group();
  const coatMaterial = new THREE.MeshStandardMaterial({ color: 0xa92335, roughness: 0.64 });
  const goldMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe9b440, metalness: 0.76, roughness: 0.24 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xe8a16e, roughness: 0.72 });
  const beardMaterial = new THREE.MeshStandardMaterial({ color: 0x183d46, roughness: 0.88 });
  const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x101a2b, roughness: 0.48 });
  const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xf2e5c8, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.5, 8, 20), coatMaterial);
  body.position.y = 0.38;
  body.castShadow = true;
  root.add(body);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 28), hatMaterial);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.26;
  root.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.06), goldMaterial);
  buckle.position.set(0, 0.26, 0.34);
  root.add(buckle);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 20), skinMaterial);
  head.position.y = 1.0;
  head.castShadow = true;
  root.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 9), skinMaterial);
  nose.position.set(0, 0.99, 0.3);
  root.add(nose);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 12, 9),
    new THREE.MeshStandardMaterial({ color: 0xf7d55f, emissive: 0x7a3f00, emissiveIntensity: 0.8 }),
  );
  eye.position.set(-0.11, 1.08, 0.28);
  root.add(eye);

  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.083, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatMaterial);
  patch.rotation.x = Math.PI / 2;
  patch.position.set(0.11, 1.09, 0.27);
  root.add(patch);
  const patchBand = createCurvedGuard([
    [-0.25, 0.02, 0], [0, 0.08, 0.04], [0.25, -0.02, 0],
  ], hatMaterial, 0.014);
  patchBand.position.set(0, 1.11, 0.28);
  root.add(patchBand);

  const beard = new THREE.Group();
  beard.position.set(0, 0.84, 0.4);
  for (let index = -2; index <= 2; index += 1) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(index * 0.075, 0.02, 0),
      new THREE.Vector3(index * 0.08, -0.16, 0.02),
      new THREE.Vector3(index * 0.11 + Math.sin(index) * 0.03, -0.34, -0.01),
    ]);
    const tentacle = new THREE.Mesh(new THREE.TubeGeometry(curve, 15, 0.035, 7, false), beardMaterial);
    tentacle.castShadow = true;
    beard.add(tentacle);
  }
  root.add(beard);

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.48, 0.1, 3), hatMaterial);
  hatBrim.position.y = 1.27;
  hatBrim.rotation.y = Math.PI / 2;
  root.add(hatBrim);
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 0.3, 3), hatMaterial);
  hatCrown.position.y = 1.44;
  hatCrown.rotation.y = Math.PI / 2;
  root.add(hatCrown);
  const hatTrim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 7, 3), goldMaterial);
  hatTrim.rotation.x = Math.PI / 2;
  hatTrim.position.set(0, 1.34, 0.03);
  root.add(hatTrim);

  const emblem = new THREE.Group();
  emblem.position.set(0, 1.44, 0.29);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 9), whiteMaterial);
  emblem.add(skull);
  [-1, 1].forEach((side) => {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), whiteMaterial);
    bone.rotation.z = side * 0.8;
    emblem.add(bone);
  });
  root.add(emblem);

  const leftArm = new THREE.Group();
  const leftSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.35, 5, 10), coatMaterial);
  leftSleeve.rotation.z = -0.9;
  leftArm.add(leftSleeve);
  leftArm.position.set(-0.4, 0.62, 0);
  root.add(leftArm);

  const rightArm = new THREE.Group();
  const rightSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.35, 5, 10), coatMaterial);
  rightSleeve.rotation.z = 0.9;
  rightArm.add(rightSleeve);
  const hook = createCurvedGuard([
    [0, 0, 0], [0.12, -0.05, 0], [0.17, 0.07, 0], [0.08, 0.12, 0],
  ], goldMaterial, 0.025);
  hook.position.set(0.2, -0.18, 0);
  rightArm.add(hook);
  rightArm.position.set(0.4, 0.62, 0);
  root.add(rightArm);

  root.userData = { eye, leftArm, rightArm, beard, hatCrown };
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  return root;
}

function createNumberSprite(number) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 64;
  labelCanvas.height = 64;
  const context = labelCanvas.getContext('2d');
  context.fillStyle = 'rgba(5, 13, 20, .9)';
  context.beginPath();
  context.arc(32, 32, 25, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#f3c860';
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = '#fff6dd';
  context.font = '900 25px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(number), 32, 33);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.28, 0.28, 0.28);
  sprite.position.set(0, 0.22, -0.08);
  sprite.visible = false;
  sprite.renderOrder = 5;
  return sprite;
}

function buildSlots() {
  slotRoot.clear();
  slots.length = 0;
  const counts = [5, 6, 5];
  let index = 0;

  counts.forEach((count, rowIndex) => {
    for (let column = 0; column < count; column += 1) {
      const angle = (column / count) * Math.PI * 2 + rowIndex * 0.34;
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
      ring.position.z = -0.013;
      ring.userData.slotGroup = group;
      group.add(ring);

      const target = new THREE.Mesh(
        new THREE.CircleGeometry(0.098, 24),
        new THREE.MeshStandardMaterial({ color: 0x060303, roughness: 1, side: THREE.DoubleSide }),
      );
      target.position.z = -0.011;
      target.userData.slotGroup = group;
      group.add(target);

      const hitArea = new THREE.Mesh(
        new THREE.CircleGeometry(0.2, 20),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      );
      hitArea.position.z = -0.035;
      hitArea.userData.slotGroup = group;
      group.add(hitArea);

      const damage = new THREE.Group();
      damage.visible = false;
      group.add(damage);

      const label = createNumberSprite(index + 1);
      group.add(label);

      group.userData.ring = ring;
      group.userData.target = target;
      group.userData.damage = damage;
      group.userData.label = label;
      slotRoot.add(group);
      slots.push(group);
      index += 1;
    }
  });
  updateContainerLayout();
}

function updateContainerLayout() {
  const config = CONTAINER_CONFIGS[containerStyle];
  const containerRoot = containerRoots[containerStyle];
  barrelRoot.visible = containerStyle === 'wood';
  drumRoot.visible = containerStyle === 'drum';
  powderRoot.visible = containerStyle === 'powder';

  scene.updateMatrixWorld(true);

  slots.forEach((slot) => {
    const { rowIndex, angle } = slot.userData;
    const height = config.rows[rowIndex];
    const fallbackRadius = config.radiusAt(height);
    const outwardLocal = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const rayOriginLocal = outwardLocal.clone().multiplyScalar(fallbackRadius + 2);
    rayOriginLocal.y = height;
    const rayTargetLocal = new THREE.Vector3(0, height, 0);
    const rayOriginWorld = gameRoot.localToWorld(rayOriginLocal.clone());
    const rayTargetWorld = gameRoot.localToWorld(rayTargetLocal.clone());
    surfaceRaycaster.set(rayOriginWorld, rayTargetWorld.sub(rayOriginWorld).normalize());
    const surfaceHit = containerRoot.children.length
      ? surfaceRaycaster.intersectObject(containerRoot, true).find((hit) => hit.object.isMesh)
      : null;

    if (!surfaceHit) {
      slot.position.set(outwardLocal.x * fallbackRadius, height, outwardLocal.z * fallbackRadius);
      slot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outwardLocal.clone().negate());
      return;
    }

    const surfacePointLocal = slotRoot.worldToLocal(surfaceHit.point.clone());
    const surfaceNormalWorld = surfaceHit.face?.normal
      ? surfaceHit.face.normal.clone().transformDirection(surfaceHit.object.matrixWorld)
      : gameRoot.localToWorld(outwardLocal.clone()).sub(gameRoot.localToWorld(new THREE.Vector3())).normalize();
    const radialWorld = gameRoot.localToWorld(outwardLocal.clone()).sub(gameRoot.localToWorld(new THREE.Vector3())).normalize();
    if (surfaceNormalWorld.dot(radialWorld) < 0) surfaceNormalWorld.negate();
    const parentWorldQuaternion = slotRoot.getWorldQuaternion(new THREE.Quaternion()).invert();
    const measuredNormalLocal = surfaceNormalWorld.applyQuaternion(parentWorldQuaternion).normalize();
    const rowDirection = Math.sign(height - config.height * 0.5);
    const curveTilt = containerStyle === 'drum' || rowDirection === 0
      ? 0
      : rowDirection * THREE.MathUtils.clamp(Math.abs(measuredNormalLocal.y), 0.08, 0.28);
    const surfaceNormalLocal = new THREE.Vector3(outwardLocal.x, curveTilt, outwardLocal.z).normalize();

    slot.position.copy(surfacePointLocal).addScaledVector(surfaceNormalLocal, 0.006);
    slot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormalLocal.clone().negate());
  });

  const openingScale = config.openingRadius / 0.57;
  const openingOffset = containerStyle === 'powder' ? -0.24 : containerStyle === 'drum' ? -0.06 : 0;
  opening.scale.set(openingScale, 1, openingScale);
  opening.position.y = config.height + openingOffset + 0.01;
  openingRim.scale.setScalar(openingScale);
  openingRim.position.y = config.height + openingOffset + 0.035;
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
  resetRound();
  const hints = {
    wood: '나무 파편을 조심하며 오크통을 노리세요',
    drum: '코발트 드럼통의 금속 구멍을 선택하세요',
    powder: '화약통은 충격마다 불꽃과 연기를 뿜습니다',
  };
  hintLabel.textContent = hints[style];
}

function selectSword(style) {
  if (!WEAPON_NAMES[style]) return;
  swordStyle = style;
  swordButtons.forEach((button) => {
    const selected = button.dataset.sword === style;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  hintLabel.textContent = `${WEAPON_NAMES[style]} 선택 — 다음 구멍을 노리세요`;
  sendGameState();
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

function addComicWeapon(weapon, design) {
  if (design === 'fish') {
    const fishMaterial = new THREE.MeshPhysicalMaterial({ color: 0x62b9ca, metalness: 0.18, roughness: 0.35, clearcoat: 0.5 });
    const bellyMaterial = new THREE.MeshStandardMaterial({ color: 0xbce5df, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.19, 22, 14), fishMaterial);
    body.scale.set(0.78, 0.58, 2.45);
    body.position.z = -0.13;
    body.castShadow = true;
    weapon.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 12), bellyMaterial);
    belly.scale.set(0.72, 0.24, 2.1);
    belly.position.set(0, -0.12, -0.1);
    weapon.add(belly);
    [-1, 1].forEach((side) => {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 3), fishMaterial);
      tail.rotation.x = -Math.PI / 2;
      tail.rotation.z = side * 0.45;
      tail.position.set(side * 0.1, 0, -0.62);
      weapon.add(tail);
    });
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x07090a, roughness: 0.8 }),
    );
    eye.position.set(0.13, 0.055, 0.22);
    weapon.add(eye);
    return;
  }

  if (design === 'carrot') {
    const carrotMaterial = new THREE.MeshStandardMaterial({ color: 0xf07b27, roughness: 0.68 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x49a95d, roughness: 0.78 });
    const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.2, 18), carrotMaterial);
    carrot.rotation.x = Math.PI / 2;
    carrot.position.z = 0.37;
    carrot.castShadow = true;
    weapon.add(carrot);
    for (let index = -1; index <= 1; index += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.38, 9), leafMaterial);
      leaf.rotation.x = -Math.PI / 2 + index * 0.23;
      leaf.rotation.z = index * 0.35;
      leaf.position.set(index * 0.07, 0, -0.31);
      weapon.add(leaf);
    }
    return;
  }

  const shaftMaterial = new THREE.MeshPhysicalMaterial({ color: 0x9ad8e5, metalness: 0.82, roughness: 0.22 });
  const fabricMaterial = new THREE.MeshStandardMaterial({ color: 0x7d4cd6, roughness: 0.52, side: THREE.DoubleSide });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 10), shaftMaterial);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.22;
  weapon.add(shaft);
  const foldedCanopy = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.72, 12, 1, true), fabricMaterial);
  foldedCanopy.rotation.x = Math.PI / 2;
  foldedCanopy.position.z = 0.43;
  weapon.add(foldedCanopy);
  const hook = createCurvedGuard([
    [0, 0, -0.46], [0, 0, -0.7], [0.13, 0, -0.84], [0.24, 0, -0.72],
  ], shaftMaterial, 0.033);
  weapon.add(hook);
}

function addSwordWeapon(weapon, design, player) {
  const bladeMaterial = new THREE.MeshPhysicalMaterial({
    color: design === 'dagger' ? 0xbfeaff : 0xe4f6f7,
    metalness: 0.94,
    roughness: 0.12,
    clearcoat: 0.55,
    clearcoatRoughness: 0.08,
  });
  weapon.add(createShapedBlade(design, bladeMaterial));

  const guardMaterial = new THREE.MeshPhysicalMaterial({
    color: design === 'dagger' ? 0x8fd9ec : design === 'cutlass' ? 0xd89d2d : 0xe8b33f,
    metalness: 0.88,
    roughness: 0.22,
    clearcoat: 0.35,
  });
  if (design === 'classic') {
    weapon.add(createCurvedGuard([
      [-0.34, 0, -0.22], [-0.2, 0.025, -0.26], [0, 0, -0.27],
      [0.2, -0.025, -0.26], [0.34, 0, -0.22],
    ], guardMaterial, 0.034));
    [-1, 1].forEach((side) => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), guardMaterial);
      cap.position.set(side * 0.34, 0, -0.22);
      weapon.add(cap);
    });
  } else if (design === 'cutlass') {
    weapon.add(createCurvedGuard([
      [-0.27, 0, -0.22], [-0.42, 0.02, -0.38], [-0.4, 0.01, -0.64],
      [-0.24, 0, -0.83], [-0.04, 0, -0.82],
    ], guardMaterial, 0.033));
    weapon.add(createCurvedGuard([
      [-0.27, 0, -0.22], [-0.08, 0.035, -0.27], [0.18, 0, -0.25],
    ], guardMaterial, 0.038));
  } else {
    weapon.add(createCurvedGuard([
      [0, 0, -0.26], [-0.2, 0.04, -0.3], [-0.35, -0.02, -0.22], [-0.3, -0.01, -0.1],
    ], guardMaterial, 0.032));
    weapon.add(createCurvedGuard([
      [0, 0, -0.26], [0.2, -0.04, -0.3], [0.35, 0.02, -0.22], [0.3, 0.01, -0.1],
    ], guardMaterial, 0.032));
  }

  const gripLength = design === 'cutlass' ? 0.48 : design === 'dagger' ? 0.38 : 0.42;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, gripLength, 12),
    new THREE.MeshStandardMaterial({ color: players[player].three, roughness: 0.56, metalness: 0.08 }),
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = design === 'cutlass' ? -0.55 : design === 'dagger' ? -0.48 : -0.51;
  handle.castShadow = true;
  weapon.add(handle);

  const wrapMaterial = new THREE.MeshStandardMaterial({ color: 0x18333b, metalness: 0.18, roughness: 0.48 });
  for (let index = -2; index <= 2; index += 1) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.009, 6, 14), wrapMaterial);
    wrap.position.z = handle.position.z + index * (gripLength * 0.18);
    weapon.add(wrap);
  }

  const pommel = new THREE.Mesh(
    design === 'dagger' ? new THREE.OctahedronGeometry(0.12) : new THREE.SphereGeometry(0.105, 14, 10),
    new THREE.MeshStandardMaterial({
      color: design === 'dagger' ? 0x37d9e6 : 0xe4ad32,
      emissive: design === 'dagger' ? 0x063e65 : 0x000000,
      emissiveIntensity: design === 'dagger' ? 0.7 : 0,
      metalness: 0.78,
      roughness: 0.28,
    }),
  );
  pommel.position.z = design === 'cutlass' ? -0.83 : design === 'dagger' ? -0.7 : -0.75;
  weapon.add(pommel);
}

function createWeapon(slot, player) {
  const design = swordStyle;
  const weapon = new THREE.Group();
  const designRoll = design === 'cutlass' ? 0.34 : design === 'fish' ? -0.16 : design === 'umbrella' ? 0.28 : 0.1;
  const roll = player % 2 === 0 ? -designRoll : designRoll;
  const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
  const finalQuaternion = slot.quaternion.clone().multiply(rollQuaternion);
  const target = slot.position.clone();
  const inward = new THREE.Vector3(0, 0, 1).applyQuaternion(finalQuaternion).normalize();
  const outward = inward.clone().negate();
  const tangent = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), outward).normalize();
  const approachSide = player % 2 === 0 ? 1 : -1;
  const approachPosition = target.clone()
    .addScaledVector(outward, 1.72)
    .addScaledVector(tangent, approachSide * 0.78)
    .add(new THREE.Vector3(0, 0.18, 0));
  const aimPosition = target.clone().addScaledVector(outward, 1.68);
  const pullbackPosition = target.clone()
    .addScaledVector(outward, 1.96);
  const getAimQuaternion = (position) => new THREE.Quaternion()
    .setFromUnitVectors(new THREE.Vector3(0, 0, 1), target.clone().sub(position).normalize())
    .multiply(rollQuaternion);
  const approachQuaternion = getAimQuaternion(approachPosition);

  weapon.position.copy(approachPosition);
  weapon.quaternion.copy(approachQuaternion);
  weapon.userData = {
    target,
    progress: 0,
    impacted: false,
    player,
    slot,
    startedAt: elapsed,
    design,
    inward,
    outward,
    approachPosition,
    aimPosition,
    pullbackPosition,
    approachQuaternion,
    finalQuaternion,
  };

  const template = weaponTemplates.get(design);
  if (template) {
    weapon.add(template.clone(true));
  }

  weapon.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return weapon;
}

function ensureAudio() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioContext = new AudioContext();
  }
  if (audioContext?.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playTone(frequency, duration, type = 'sine', volume = 0.08, delay = 0) {
  const context = ensureAudio();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
  gain.gain.setValueAtTime(volume, context.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + delay + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(context.currentTime + delay);
  oscillator.stop(context.currentTime + delay + duration);
}

function playImpactSound() {
  const profiles = {
    wood: [[112, 0.2, 'square'], [68, 0.3, 'sine']],
    drum: [[410, 0.18, 'triangle'], [185, 0.42, 'sine']],
    powder: [[82, 0.35, 'sawtooth'], [46, 0.5, 'sine']],
  };
  profiles[containerStyle].forEach(([frequency, duration, type], index) => {
    playTone(frequency, duration, type, index ? 0.055 : 0.075, index * 0.045);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 2200);
}

function createDamageMark(slot) {
  const damage = slot.userData.damage;
  damage.clear();
  damage.visible = true;
  if (containerStyle === 'drum') {
    const dent = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.014, 7, 28),
      new THREE.MeshStandardMaterial({ color: 0x7ecdf1, metalness: 0.92, roughness: 0.18 }),
    );
    dent.scale.y = 0.8;
    dent.position.z = -0.035;
    damage.add(dent);
    return;
  }

  const crackMaterial = new THREE.MeshBasicMaterial({ color: containerStyle === 'powder' ? 0x030202 : 0x2b1208 });
  [0.1, 2.2, 4.25].forEach((angle, index) => {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.18 + index * 0.03, 0.01), crackMaterial);
    crack.rotation.z = angle;
    crack.position.set(Math.cos(angle) * 0.13, Math.sin(angle) * 0.13, -0.038);
    damage.add(crack);
  });
}

function spawnImpactParticles(slot) {
  const origin = new THREE.Vector3();
  slot.getWorldPosition(origin);
  const outward = new THREE.Vector3(0, 0, -1).applyQuaternion(slot.getWorldQuaternion(new THREE.Quaternion()));
  const count = containerStyle === 'powder' ? 20 : 12;
  for (let index = 0; index < count; index += 1) {
    let geometry;
    let material;
    if (containerStyle === 'wood') {
      geometry = new THREE.BoxGeometry(0.025, 0.07, 0.025);
      material = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x9a5928 : 0x5d3016, roughness: 0.9 });
    } else if (containerStyle === 'drum') {
      geometry = new THREE.SphereGeometry(0.018, 7, 5);
      material = new THREE.MeshBasicMaterial({ color: index % 3 ? 0x8adfff : 0xffffff });
    } else {
      geometry = index % 3 === 0 ? new THREE.SphereGeometry(0.06, 8, 6) : new THREE.SphereGeometry(0.022, 7, 5);
      material = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? 0x3d3531 : index % 2 ? 0xffa126 : 0xffe078,
        transparent: index % 3 === 0,
        opacity: index % 3 === 0 ? 0.65 : 1,
      });
    }
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(origin).addScaledVector(outward, 0.08);
    particle.userData.velocity = outward.clone().multiplyScalar(0.55 + Math.random() * 0.8);
    particle.userData.velocity.x += (Math.random() - 0.5) * 0.7;
    particle.userData.velocity.y += (Math.random() - 0.15) * 0.7;
    particle.userData.velocity.z += (Math.random() - 0.5) * 0.7;
    particle.userData.life = 0.55 + Math.random() * 0.45;
    particle.userData.maxLife = particle.userData.life;
    effectsRoot.add(particle);
    particles.push(particle);
  }
}

function updateTension() {
  const tension = Math.min(1, insertedWeapons.length / Math.max(1, slots.length - triggerSlots.size));
  tensionFill.style.width = `${Math.round(tension * 100)}%`;
  tensionLabel.textContent = tension < 0.25 ? '잠잠함' : tension < 0.55 ? '꿈틀거림' : tension < 0.8 ? '위험' : '폭발 직전';
  dangerLight.intensity = tension * tension * 18;
  rimLight.intensity = 22 + tension * 12;
  sendGameState();
}

function insertWeapon(slot) {
  if (gameOver || isAnimating || slot.userData.used) return;
  ensureAudio();
  isAnimating = true;
  slot.userData.used = true;
  hoveredSlot = null;
  remoteSelectedSlot = null;
  canvas.classList.remove('is-aiming');
  hintLabel.textContent = `${WEAPON_NAMES[swordStyle]}을 힘껏 꽂는 중…`;
  const weapon = createWeapon(slot, currentPlayer);
  weaponRoot.add(weapon);
  insertedWeapons.push(weapon);
  playTone(340 + insertedWeapons.length * 8, 0.09, 'triangle', 0.06);
  sendGameState();
}

function triggerFakeout() {
  fakeoutKick = 1;
  document.body.classList.remove('is-fakeout');
  void document.body.offsetWidth;
  document.body.classList.add('is-fakeout');
  hintLabel.textContent = '잠깐… 통 안에서 무언가 움직였습니다!';
  playTone(74, 0.48, 'sawtooth', 0.07);
  playTone(132, 0.22, 'square', 0.04, 0.18);
  navigator.vibrate?.([70, 40, 100]);
  sendRemote({ type: 'fakeout' });
  window.setTimeout(() => {
    document.body.classList.remove('is-fakeout');
    if (!gameOver) hintLabel.textContent = `${players[currentPlayer].name}, 아직 안전합니다`;
  }, 720);
}

function maybeTriggerFakeout() {
  const count = insertedWeapons.length;
  if (![3, 6, 10, 13].includes(count) || firedFakeouts.has(count)) return;
  firedFakeouts.add(count);
  triggerFakeout();
}

function resolveWeaponImpact(weapon) {
  const { slot, player } = weapon.userData;
  impactKick = containerStyle === 'powder' ? 1.35 : 1;
  createDamageMark(slot);
  spawnImpactParticles(slot);
  slot.userData.ring.material.color.setHex(0x251a14);
  slot.userData.ring.material.emissive.setHex(0x080402);
  slot.userData.ring.material.emissiveIntensity = 0.05;
  slot.userData.target.material.color.setHex(0x020101);
  playImpactSound();
  navigator.vibrate?.([25, 20, containerStyle === 'powder' ? 100 : 55]);
  sendRemote({ type: 'impact' });
  updateTension();
  updateHud();

  if (triggerSlots.has(slot.userData.slotIndex)) {
    pirateAwake = true;
    if (gameMode === 'reverse') endRound({ winnerIndex: player, reason: '크라켄을 깨워 보물을 차지했습니다!' });
    else endRound({ loserIndex: player, reason: '저주받은 구멍에서 크라켄이 깨어났습니다.' });
    return;
  }

  currentPlayer = (player + 1) % players.length;
  startTurnTimer();
  maybeTriggerFakeout();
  window.setTimeout(() => {
    if (!gameOver && fakeoutKick <= 0.05) hintLabel.textContent = `${players[currentPlayer].name}, 구멍을 선택하세요`;
    updateHud();
    sendGameState();
  }, 220);
}

function awardRound({ winnerIndex, loserIndex }) {
  if (winnerIndex !== undefined) {
    players[winnerIndex].score += gameMode === 'reverse' ? 2 : 1;
    return;
  }
  players.forEach((player, index) => {
    if (index !== loserIndex) player.score += 1;
  });
}

function beginPirateReveal() {
  if (pirateRevealCameraCaptured) return;
  pirateRevealCameraCaptured = true;
  pirateRevealCameraStart.copy(camera.position);
  pirateRevealTargetStart.copy(controls.target);
  pirateRevealHorizontal
    .set(camera.position.x - controls.target.x, 0, camera.position.z - controls.target.z)
    .normalize();
  if (pirateRevealHorizontal.lengthSq() < 0.01) pirateRevealHorizontal.set(0, 0, 1);
  pirateRevealTargetEnd.set(0, opening.position.y + 0.72, 0.18);
  pirateRevealCameraEnd
    .copy(pirateRevealTargetEnd)
    .addScaledVector(pirateRevealHorizontal, 14.8);
  pirateRevealCameraEnd.y += 5.1;
  controls.enabled = false;
  document.body.classList.add('is-pirate-reveal');
  if (pirateRevealAction) {
    pirateRevealAction.reset();
    pirateRevealAction.setEffectiveTimeScale(1.45);
    pirateRevealAction.setEffectiveWeight(1);
    pirateRevealAction.play();
    if (pirateIdleAction?.isRunning()) pirateIdleAction.crossFadeTo(pirateRevealAction, 0.12, false);
  }
  playTone(92, 0.75, 'sawtooth', 0.09);
  playTone(185, 0.42, 'square', 0.05, 0.12);
  playTone(48, 0.9, 'sine', 0.08, 0.05);
  navigator.vibrate?.([140, 60, 200]);
  sendRemote({ type: 'kraken' });
}

function endRound({ winnerIndex, loserIndex, reason }) {
  if (gameOver) return;
  gameOver = true;
  isAnimating = false;
  turnDeadline = 0;
  awardRound({ winnerIndex, loserIndex });
  matchFinished = players.some((player) => player.score >= targetScore);
  resultEyebrow.textContent = winnerIndex !== undefined ? 'TREASURE!' : 'KRAKEN!';
  resultTitle.textContent = winnerIndex !== undefined
    ? `${players[winnerIndex].name} 승리`
    : `${players[loserIndex].name} 패배`;
  resultCopy.textContent = reason;
  resultScores.innerHTML = players.map((player) => `<span>${escapeHtml(player.name)} ${player.score}점</span>`).join('');
  resultButton.textContent = matchFinished ? '새 매치 시작' : '다음 라운드';
  if (pirateAwake) beginPirateReveal();
  window.setTimeout(triggerPirate, pirateAwake ? 1350 : 190);
  updateHud();
  sendGameState();
}

function triggerPirate() {
  resultCard.hidden = false;
  hintLabel.textContent = pirateAwake
    ? gameMode === 'reverse' ? '크라켄의 보물이 열렸습니다!' : '크라켄 선장이 깨어났습니다!'
    : '제한 시간이 끝났습니다!';
  document.body.classList.add('is-failed');
}

function chooseTriggerSlots() {
  triggerSlots = new Set();
  while (triggerSlots.size < MODE_CONFIGS[gameMode].triggerCount) {
    triggerSlots.add(Math.floor(Math.random() * slots.length));
  }
}

function startTurnTimer() {
  const limit = MODE_CONFIGS[gameMode].timeLimit;
  turnDeadline = limit ? performance.now() + limit * 1000 : 0;
  lastTimerSecond = null;
  turnTimer.hidden = !limit;
  turnTimer.classList.remove('is-urgent');
  if (limit) turnTimer.textContent = limit.toFixed(1);
}

function resetRound() {
  if (pirateRevealCameraCaptured) {
    camera.position.copy(pirateRevealCameraStart);
    controls.target.copy(pirateRevealTargetStart);
    camera.fov = 38;
    camera.updateProjectionMatrix();
  }
  pirateRevealCameraCaptured = false;
  controls.enabled = true;
  pirateRevealAction?.stop();
  if (pirateIdleAction) {
    pirateIdleAction.reset();
    pirateIdleAction.setEffectiveWeight(1);
    pirateIdleAction.play();
  }
  gameOver = false;
  isAnimating = false;
  hoveredSlot = null;
  remoteSelectedSlot = null;
  impactKick = 0;
  fakeoutKick = 0;
  piratePop = 0;
  pirateAwake = false;
  matchFinished = false;
  currentPlayer = roundStarter % players.length;
  firedFakeouts.clear();
  chooseTriggerSlots();
  resultCard.hidden = true;
  document.body.classList.remove('is-failed', 'is-fakeout', 'is-pirate-reveal');
  hintLabel.textContent = `${players[currentPlayer].name}, 어두운 구멍을 선택하세요`;
  pirate.scale.setScalar(PIRATE_REST_SCALE);
  pirate.position.set(0, opening.position.y - PIRATE_REST_DEPTH, 0);
  pirate.rotation.set(0, 0, 0);
  gameRoot.position.set(0, 0, 0);
  gameRoot.rotation.set(0, 0, 0);
  weaponRoot.clear();
  insertedWeapons.length = 0;
  particles.splice(0).forEach((particle) => effectsRoot.remove(particle));
  slots.forEach((slot) => {
    slot.userData.used = false;
    slot.userData.ring.material.color.setHex(0x46372d);
    slot.userData.ring.material.emissive.setHex(0x1e1208);
    slot.userData.ring.material.emissiveIntensity = 0.18;
    slot.userData.target.material.color.setHex(0x060303);
    slot.userData.damage.clear();
    slot.userData.damage.visible = false;
    slot.userData.label.visible = connectedRoomPlayers().length > 0;
  });
  startTurnTimer();
  updateTension();
  updateHud();
  sendGameState();
}

function nextRound() {
  if (matchFinished) {
    players.forEach((player) => { player.score = 0; });
    roundNumber = 1;
    roundStarter = 0;
  } else {
    roundNumber += 1;
    roundStarter = (roundStarter + 1) % players.length;
  }
  resetRound();
}

function renderScoreboard() {
  scoreboard.innerHTML = players.map((player, index) => `
    <div class="score-chip ${index === currentPlayer ? 'is-current' : ''}" style="--player-color:${player.css}">
      <span class="score-chip__badge">P${index + 1}</span>
      <strong>${escapeHtml(player.name)}</strong>
      <strong>${player.score}</strong>
    </div>
  `).join('');
}

function updateHud() {
  const player = players[currentPlayer];
  turnLabel.textContent = player.name;
  playerBadge.textContent = `P${currentPlayer + 1}`;
  playerBadge.style.setProperty('--player-color', player.css);
  roundLabel.textContent = `라운드 ${roundNumber} · ${MODE_CONFIGS[gameMode].name} · ${targetScore}점 승리`;
  swordCount.textContent = `${insertedWeapons.length} / ${slots.length}`;
  renderScoreboard();
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
  if (roomGameActive || gameOver || isAnimating) return;
  hoveredSlot = findSlotAtPointer(event);
  canvas.classList.toggle('is-aiming', Boolean(hoveredSlot));
  hintLabel.textContent = hoveredSlot
    ? `구멍 ${hoveredSlot.userData.slotIndex + 1} 조준 완료 — 클릭해서 꽂으세요`
    : '어두운 칼 구멍을 선택하세요';
}

function onPointerDown(event) {
  if (roomGameActive) return;
  if (event.target.closest('button, dialog')) return;
  const slot = findSlotAtPointer(event);
  if (slot) insertWeapon(slot);
}

function renderPlayerNameFields() {
  const count = Number(playerCountSelect.value);
  const existingNames = [...playerNameFields.querySelectorAll('input')].map((input) => input.value);
  playerNameFields.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const wrapper = document.createElement('label');
    wrapper.className = 'player-name-field';
    wrapper.style.setProperty('--player-color', PLAYER_COLORS[index].css);
    const color = document.createElement('span');
    const input = document.createElement('input');
    input.maxLength = 12;
    input.setAttribute('aria-label', `플레이어 ${index + 1} 이름`);
    input.value = existingNames[index] || `플레이어 ${index + 1}`;
    wrapper.append(color, input);
    playerNameFields.append(wrapper);
  }
}

function startConfiguredGame() {
  const names = [...playerNameFields.querySelectorAll('input')].map((input, index) => input.value.trim() || `플레이어 ${index + 1}`);
  players = names.map((name, index) => ({ name, score: 0, ...PLAYER_COLORS[index] }));
  gameMode = modeButtons.find((button) => button.classList.contains('is-selected'))?.dataset.mode ?? 'classic';
  targetScore = Number(targetButtons.find((button) => button.classList.contains('is-selected'))?.dataset.targetScore ?? 3);
  roundNumber = 1;
  roundStarter = 0;
  settingsDialog.close();
  resetRound();
  showToast(`${players.length}명 · ${MODE_CONFIGS[gameMode].name} 시작!`);
}

function enterGameStage() {
  startScreen.hidden = true;
  gameStage.hidden = false;
  document.body.classList.add('is-in-game');
  resize();
}

function showStartHome() {
  startHomePanel.hidden = false;
  hostSetupPanel.hidden = true;
  roomHostPanel.hidden = true;
}

function showHostSetup() {
  startHomePanel.hidden = true;
  hostSetupPanel.hidden = false;
  roomHostPanel.hidden = true;
}

function normalizeRoomTitle(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 24) || '크라켄 사냥 원정대';
}

function navigateToRoom(roomCode) {
  const normalized = normalizeRoomCode(roomCode);
  if (normalized.length !== 6) return;
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('room', normalized);
  window.location.assign(url);
}

function availableDirectoryRooms() {
  return directoryRooms.filter((room) => !room.started && room.playerCount < room.capacity);
}

function renderOpenRooms() {
  const availableRooms = availableDirectoryRooms();
  randomRoomButton.disabled = availableRooms.length === 0;
  roomDirectoryStatus.textContent = directoryStatus === 'online'
    ? availableRooms.length
      ? `지금 ${availableRooms.length}개 선단이 새 선원을 기다리고 있습니다.`
      : '현재 모집 중인 공개 선단이 없습니다.'
    : directoryStatus === 'electing'
      ? '새 항구지기를 정하는 중…'
      : '열린 선단을 찾는 중…';

  if (!directoryRooms.length) {
    openRoomList.innerHTML = `
      <div class="open-room-empty">
        <strong>모집 중인 선단이 없습니다</strong>
        <span>첫 번째 공개 선단을 만들어 보세요.</span>
      </div>
    `;
    return;
  }

  openRoomList.innerHTML = directoryRooms.slice(0, 8).map((room) => {
    const isFull = room.playerCount >= room.capacity;
    const canJoin = !room.started && !isFull;
    const status = room.started ? '항해 중' : isFull ? '정원 마감' : '모집 중';
    return `
      <article class="open-room-card${canJoin ? '' : ' is-unavailable'}">
        <img src="${CONTAINER_ICONS[room.container] || CONTAINER_ICONS.wood}" alt="" />
        <div class="open-room-card__copy">
          <strong>${escapeHtml(room.title)}</strong>
          <div class="open-room-card__rules">
            <span>${escapeHtml(MODE_CONFIGS[room.mode]?.name ?? '클래식')}</span>
            <span>${room.targetScore}점 승리</span>
            <span>${escapeHtml(CONTAINER_CONFIGS[room.container]?.name ?? '오크통')}</span>
          </div>
        </div>
        <div class="open-room-card__state">
          <b>${room.playerCount}/${room.capacity}</b>
          <span>${status}</span>
        </div>
        <button class="secondary-button open-room-join" type="button" data-join-open-room="${room.roomCode}"${canJoin ? '' : ' disabled'}>${canJoin ? '승선' : status}</button>
      </article>
    `;
  }).join('');
}

function publishRoomListing() {
  if (!activeRoomCode || !remotePeer?.open) return;
  roomDirectory.publish({
    roomCode: activeRoomCode,
    title: activeRoomSettings.title,
    capacity: roomCapacity,
    playerCount: connectedRoomPlayers().length,
    mode: activeRoomSettings.mode,
    targetScore: activeRoomSettings.targetScore,
    container: activeRoomSettings.container,
    started: roomGameActive,
  });
}

function startLocalGameFromHome() {
  roomGameActive = false;
  settingsButton.hidden = false;
  containerButtons.forEach((button) => { button.disabled = false; });
  swordButtons.forEach((button) => { button.disabled = false; });
  players = [
    { name: '플레이어 1', score: 0, ...PLAYER_COLORS[0] },
    { name: '플레이어 2', score: 0, ...PLAYER_COLORS[1] },
  ];
  gameMode = 'classic';
  targetScore = 3;
  roundNumber = 1;
  roundStarter = 0;
  resetRound();
  enterGameStage();
  showToast('2인 로컬 클래식 게임을 시작합니다');
}

function captureRoomSettings() {
  roomCapacity = Math.min(MAX_ROOM_PLAYERS, Math.max(2, Number(roomCapacitySelect.value) || 4));
  const title = normalizeRoomTitle(roomTitleInput.value);
  roomTitleInput.value = title;
  try {
    localStorage.setItem('kraken-room-title', title);
  } catch {
    // Storage is optional; the title still applies to this room.
  }
  activeRoomSettings = {
    title,
    mode: roomModeButtons.find((button) => button.classList.contains('is-selected'))?.dataset.roomMode ?? 'classic',
    targetScore: Number(roomTargetButtons.find((button) => button.classList.contains('is-selected'))?.dataset.roomTarget ?? 3),
    container: roomContainerButtons.find((button) => button.classList.contains('is-selected'))?.dataset.roomContainer ?? 'wood',
  };
  gameMode = activeRoomSettings.mode;
  targetScore = activeRoomSettings.targetScore;
  if (containerStyle !== activeRoomSettings.container) selectContainer(activeRoomSettings.container);
}

function connectedRoomPlayers() {
  return [...roomPlayers.values()].filter((player) => player.connected && player.connection?.open);
}

function sortedRoomPlayers() {
  return [...roomPlayers.values()].sort((a, b) => a.playerIndex - b.playerIndex);
}

function sendToRoomPlayer(player, message) {
  if (player?.connected && player.connection?.open) player.connection.send(message);
}

function sendRemote(message) {
  connectedRoomPlayers().forEach((player) => sendToRoomPlayer(player, message));
}

function getGameCanvasStream() {
  if (gameCanvasStream?.active) return gameCanvasStream;
  if (typeof canvas.captureStream !== 'function') return null;
  try {
    gameCanvasStream = canvas.captureStream(18);
    const [videoTrack] = gameCanvasStream.getVideoTracks();
    if (videoTrack && 'contentHint' in videoTrack) videoTrack.contentHint = 'motion';
    return gameCanvasStream;
  } catch (error) {
    console.warn('The live 3D game view could not be captured.', error);
    return null;
  }
}

function closePlayerGameStream(player) {
  const mediaCall = player?.mediaCall;
  if (!mediaCall) return;
  player.mediaCall = null;
  mediaCall.close();
}

function streamGameToPlayer(player) {
  if (!player?.connected || !player.connection?.open || !remotePeer?.open) return;
  const stream = getGameCanvasStream();
  if (!stream) {
    sendToRoomPlayer(player, { type: 'game-stream-unavailable' });
    return;
  }
  closePlayerGameStream(player);
  const mediaCall = remotePeer.call(player.connection.peer, stream, {
    metadata: { role: 'game-view', roomCode: activeRoomCode },
  });
  player.mediaCall = mediaCall;
  mediaCall.on('close', () => {
    if (player.mediaCall === mediaCall) player.mediaCall = null;
  });
  mediaCall.on('error', (error) => {
    console.warn(`Live game view failed for ${player.name}.`, error);
    if (player.mediaCall === mediaCall) player.mediaCall = null;
  });
}

function roomState(player) {
  return {
    roomCode: activeRoomCode,
    started: roomGameActive,
    capacity: roomCapacity,
    settings: activeRoomSettings,
    yourPlayerIndex: player?.playerIndex ?? null,
    players: sortedRoomPlayers().map((candidate) => ({
      playerIndex: candidate.playerIndex,
      name: candidate.name,
      connected: candidate.connected,
      ready: candidate.ready,
    })),
  };
}

function gameState(player) {
  const isYourTurn = roomGameActive && player?.playerIndex === currentPlayer;
  return {
    roomStarted: roomGameActive,
    currentPlayerName: players[currentPlayer]?.name,
    currentPlayer,
    yourPlayerIndex: player?.playerIndex ?? null,
    isYourTurn,
    canAct: Boolean(isYourTurn && !gameOver && !isAnimating),
    usedSlots: slots.filter((slot) => slot.userData.used).map((slot) => slot.userData.slotIndex),
    slotCount: slots.length,
    tension: insertedWeapons.length / Math.max(1, slots.length),
    gameOver,
    isAnimating,
    container: activeRoomSettings.container || containerStyle,
    swordStyle,
    roundNumber,
    players: players.map((candidate, playerIndex) => ({
      playerIndex,
      name: candidate.name,
      score: candidate.score,
      connected: sortedRoomPlayers().find((entry) => entry.playerIndex === playerIndex)?.connected ?? true,
    })),
  };
}

function sendRoomState() {
  connectedRoomPlayers().forEach((player) => {
    sendToRoomPlayer(player, { type: 'room-state', state: roomState(player) });
  });
}

function sendGameState() {
  if (!roomGameActive) return;
  connectedRoomPlayers().forEach((player) => {
    sendToRoomPlayer(player, { type: 'game-state', state: gameState(player) });
  });
}

function renderRoomLobby() {
  const connectedPlayers = connectedRoomPlayers();
  const playersBySeat = new Map(sortedRoomPlayers().map((player) => [player.playerIndex, player]));
  const readyCount = connectedPlayers.filter((player) => player.ready).length;
  const roomFull = connectedPlayers.length === roomCapacity;
  const allReady = roomFull && connectedPlayers.every((player) => player.ready);
  activeRoomTitle.textContent = activeRoomSettings.title;
  roomPlayerCount.textContent = `${connectedPlayers.length} / ${roomCapacity}`;
  roomSettingsSummary.innerHTML = [
    `${roomCapacity}명`,
    MODE_CONFIGS[activeRoomSettings.mode]?.name ?? '클래식',
    `${activeRoomSettings.targetScore}점 승리`,
    CONTAINER_CONFIGS[activeRoomSettings.container]?.name ?? '오크통',
  ].map((label) => `<span>${escapeHtml(label)}</span>`).join('');
  roomPlayerList.innerHTML = Array.from({ length: roomCapacity }, (_, playerIndex) => {
    const player = playersBySeat.get(playerIndex);
    if (!player) {
      return `
        <div class="room-player room-player--empty">
          <span class="room-player__badge">P${playerIndex + 1}</span>
          <strong>빈 좌석</strong>
          <i>참가 대기</i>
        </div>
      `;
    }
    const stateLabel = player.connected ? (player.ready ? '준비 완료' : '준비 대기') : '재접속 대기';
    return `
      <div class="room-player${player.ready && player.connected ? ' is-ready' : ''}" style="--player-color:${PLAYER_COLORS[player.playerIndex]?.css ?? '#d7dee5'}">
        <span class="room-player__badge">P${player.playerIndex + 1}</span>
        <strong>${escapeHtml(player.name)}</strong>
        <i>${stateLabel}</i>
      </div>
    `;
  }).join('');

  startRoomGameButton.disabled = !allReady || roomGameActive;
  startRoomGameButton.textContent = roomGameActive
    ? '게임 진행 중'
    : !roomFull
      ? `선원 ${roomCapacity - connectedPlayers.length}명 더 필요`
      : !allReady
        ? `${readyCount} / ${roomCapacity} 준비 완료`
        : '전원 준비 완료 · 출항!';
  roomReadyGuide.textContent = roomGameActive
    ? '게임이 시작되었습니다. 참가자 휴대폰에서 자기 차례를 진행합니다.'
    : !roomFull
      ? `정원 ${roomCapacity}명이 모두 참가해야 준비를 완료할 수 있습니다.`
      : allReady
        ? '모든 선원이 준비되었습니다. 방장이 게임을 시작할 수 있습니다.'
        : `참가자 휴대폰에서 준비 버튼을 눌러 주세요. (${readyCount}/${roomCapacity})`;
  if (remotePeer?.open) {
    remoteStatus.textContent = connectedPlayers.length
      ? `모집소 열림 · 선원 ${connectedPlayers.length}/${roomCapacity}명`
      : '모집소 열림 · 선원 접속 대기';
  }
  publishRoomListing();
}

function rejectRoomAction(player, reason) {
  sendToRoomPlayer(player, { type: 'action-rejected', reason });
}

function handleRemoteMessage(message, player) {
  if (!message?.type) return;
  if (message.type === 'request-game-stream') {
    streamGameToPlayer(player);
    return;
  }
  if (message.type === 'controller-ready') {
    sendToRoomPlayer(player, { type: 'room-state', state: roomState(player) });
    if (roomGameActive) sendToRoomPlayer(player, { type: 'game-state', state: gameState(player) });
    return;
  }
  if (message.type === 'set-ready') {
    if (roomGameActive) return;
    player.ready = Boolean(message.ready);
    renderRoomLobby();
    sendRoomState();
    return;
  }
  if (!roomGameActive) {
    rejectRoomAction(player, '아직 방장이 게임을 시작하지 않았습니다.');
    return;
  }
  if (player.playerIndex !== currentPlayer) {
    rejectRoomAction(player, `${players[currentPlayer]?.name ?? '다음 선원'}의 차례입니다.`);
    return;
  }
  if (gameOver || isAnimating) {
    rejectRoomAction(player, gameOver ? '라운드가 끝났습니다.' : '칼을 꽂는 중입니다.');
    return;
  }
  if (message.type === 'select-weapon') {
    if (!Object.hasOwn(WEAPON_NAMES, message.style)) return;
    selectSword(message.style);
    showToast(`${player.name} 선원이 ${WEAPON_NAMES[message.style]} 선택`);
    return;
  }
  if (message.type === 'select-slot') {
    const slot = slots[Number(message.slotIndex)];
    if (!slot?.userData.used) {
      remoteSelectedSlot = slot;
      hintLabel.textContent = `${player.name} 선원이 ${slot.userData.slotIndex + 1}번 구멍을 조준했습니다`;
    }
    return;
  }
  if (message.type === 'insert-slot') {
    const slot = slots[Number(message.slotIndex)];
    if (slot && !slot.userData.used) insertWeapon(slot);
  }
}

function nextRoomPlayerIndex() {
  const occupied = new Set(sortedRoomPlayers().map((player) => player.playerIndex));
  for (let index = 0; index < roomCapacity; index += 1) {
    if (!occupied.has(index)) return index;
  }
  return -1;
}

function registerRoomPlayer(connection, message) {
  const clientId = String(message.clientId || connection.peer).slice(0, 80);
  let player = roomPlayers.get(clientId);

  if (roomGameActive && !player) {
    connection.send({ type: 'room-error', reason: '이미 게임이 시작되어 새 선원은 참가할 수 없습니다.' });
    window.setTimeout(() => connection.close(), 120);
    return null;
  }

  if (!player) {
    const playerIndex = nextRoomPlayerIndex();
    if (playerIndex < 0) {
      connection.send({ type: 'room-error', reason: `이 방은 정원 ${roomCapacity}명이 모두 찼습니다.` });
      window.setTimeout(() => connection.close(), 120);
      return null;
    }
    player = {
      clientId,
      name: normalizePlayerName(message.name, `선원 ${playerIndex + 1}`),
      playerIndex,
      connection,
      connected: true,
      ready: false,
      mediaCall: null,
    };
    roomPlayers.set(clientId, player);
  } else {
    closePlayerGameStream(player);
    if (player.connection?.open && player.connection !== connection) player.connection.close();
    player.name = normalizePlayerName(message.name, player.name);
    player.connection = connection;
    player.connected = true;
    if (!roomGameActive) player.ready = false;
    if (roomGameActive && players[player.playerIndex]) players[player.playerIndex].name = player.name;
  }

  connection.send({
    type: 'room-joined',
    roomCode: activeRoomCode,
    playerIndex: player.playerIndex,
    name: player.name,
  });
  slots.forEach((slot) => { slot.userData.label.visible = true; });
  renderRoomLobby();
  sendRoomState();
  if (roomGameActive) sendGameState();
  window.setTimeout(() => {
    if (player.connected && player.connection === connection) streamGameToPlayer(player);
  }, 120);
  showToast(`${player.name} 선원이 방에 참가했습니다`);
  return player;
}

function handleRoomConnection(connection) {
  let player = null;
  connection.on('data', (message) => {
    if (message?.type === 'join-room') {
      player = registerRoomPlayer(connection, message);
      return;
    }
    if (!player) {
      connection.send({ type: 'room-error', reason: '선원 이름을 등록한 뒤 참가해 주세요.' });
      return;
    }
    handleRemoteMessage(message, player);
  });

  connection.on('close', () => {
    if (!player || player.connection !== connection) return;
    player.connected = false;
    player.ready = false;
    closePlayerGameStream(player);
    remoteSelectedSlot = null;
    renderRoomLobby();
    sendRoomState();
    sendGameState();
    if (!roomGameActive) {
      window.setTimeout(() => {
        if (player.connected || player.connection !== connection) return;
        roomPlayers.delete(player.clientId);
        sortedRoomPlayers().forEach((candidate, index) => { candidate.playerIndex = index; });
        renderRoomLobby();
        sendRoomState();
      }, 5000);
    }
  });
}

async function createOnlineRoom() {
  if (remotePeer && !remotePeer.destroyed) return;
  captureRoomSettings();
  roomCreationAttempt += 1;
  startHomePanel.hidden = true;
  hostSetupPanel.hidden = true;
  roomHostPanel.hidden = false;
  remoteQr.hidden = true;
  remoteLoading.hidden = false;
  remoteLoading.textContent = '초대장을 만드는 중…';
  remoteStatus.textContent = '선원 모집소 연결 중';
  copyRemoteLinkButton.disabled = true;
  renderRoomLobby();
  activeRoomCode = createRoomCode();
  remoteCode.textContent = activeRoomCode;

  const peer = new Peer(roomPeerId(activeRoomCode), { debug: 1 });
  remotePeer = peer;

  peer.on('open', async () => {
    if (remotePeer !== peer) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('room', activeRoomCode);
    remoteLink = url.toString();
    remoteQr.src = await QRCode.toDataURL(remoteLink, {
      width: 420,
      margin: 1,
      color: { dark: '#07131fff', light: '#ffffffff' },
    });
    if (remotePeer !== peer || peer.destroyed) return;
    remoteQr.hidden = false;
    remoteLoading.hidden = true;
    copyRemoteLinkButton.disabled = false;
    roomCreationAttempt = 0;
    renderRoomLobby();
  });

  peer.on('connection', handleRoomConnection);
  peer.on('disconnected', () => {
    if (remotePeer !== peer || peer.destroyed) return;
    remoteStatus.textContent = '선원 모집소 재연결 중…';
    window.setTimeout(() => {
      if (remotePeer !== peer || peer.destroyed || !peer.disconnected) return;
      peer.reconnect();
    }, 600);
  });
  peer.on('error', (error) => {
    console.error(error);
    if (error.type === 'unavailable-id' && roomCreationAttempt < 5) {
      peer.destroy();
      if (remotePeer === peer) remotePeer = null;
      window.setTimeout(createOnlineRoom, 100);
      return;
    }
    remoteLoading.hidden = false;
    remoteLoading.textContent = '방 생성에 실패했습니다. 다시 시도해 주세요.';
    remoteStatus.textContent = '선원 모집소 연결 오류';
  });
}

function closeOnlineRoom() {
  roomDirectory.clear(activeRoomCode);
  connectedRoomPlayers().forEach((player) => {
    sendToRoomPlayer(player, { type: 'room-closed', reason: '방장이 온라인 방을 닫았습니다.' });
    closePlayerGameStream(player);
    player.connection.close();
  });
  roomPlayers.clear();
  remotePeer?.destroy();
  remotePeer = null;
  activeRoomCode = '';
  remoteLink = '';
  roomGameActive = false;
  remoteSelectedSlot = null;
  roomCreationAttempt = 0;
  remoteQr.hidden = true;
  remoteCode.textContent = '------';
  copyRemoteLinkButton.disabled = true;
  roomHostPanel.hidden = true;
  hostSetupPanel.hidden = true;
  startHomePanel.hidden = false;
  slots.forEach((slot) => { slot.userData.label.visible = false; });
  renderRoomLobby();
}

function joinRoomByCode() {
  const roomCode = normalizeRoomCode(joinRoomCodeInput.value);
  if (roomCode.length !== 6) {
    showToast('6자리 참가 코드를 입력해 주세요');
    joinRoomCodeInput.focus();
    return;
  }
  navigateToRoom(roomCode);
}

function startOnlineRoomGame() {
  const connectedPlayers = connectedRoomPlayers().sort((a, b) => a.playerIndex - b.playerIndex);
  if (connectedPlayers.length !== roomCapacity || !connectedPlayers.every((player) => player.ready)) return;

  roomPlayers.forEach((player, clientId) => {
    if (!player.connected) roomPlayers.delete(clientId);
  });
  connectedPlayers.forEach((player, playerIndex) => { player.playerIndex = playerIndex; });
  players = connectedPlayers.map((player, playerIndex) => ({
    name: player.name,
    score: 0,
    ...PLAYER_COLORS[playerIndex],
  }));
  gameMode = activeRoomSettings.mode;
  targetScore = activeRoomSettings.targetScore;
  if (containerStyle !== activeRoomSettings.container) selectContainer(activeRoomSettings.container);
  roundNumber = 1;
  roundStarter = 0;
  roomGameActive = true;
  renderRoomLobby();
  settingsButton.hidden = true;
  containerButtons.forEach((button) => { button.disabled = true; });
  swordButtons.forEach((button) => { button.disabled = true; });
  resetRound();
  sendRoomState();
  sendGameState();
  enterGameStage();
  showToast(`${players.length}명의 선원과 함께 출항합니다!`);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function updateTimer(time) {
  if (!turnDeadline || gameOver) return;
  const remaining = Math.max(0, (turnDeadline - time) / 1000);
  turnTimer.textContent = remaining.toFixed(1);
  turnTimer.classList.toggle('is-urgent', remaining <= 2.5);
  const wholeSecond = Math.ceil(remaining);
  if (remaining <= 3 && wholeSecond !== lastTimerSecond) {
    lastTimerSecond = wholeSecond;
    playTone(remaining <= 1 ? 680 : 480, 0.08, 'square', 0.035);
  }
  if (remaining <= 0 && !isAnimating) {
    endRound({ loserIndex: currentPlayer, reason: '7초 안에 구멍을 고르지 못했습니다.' });
  }
}

function animate(time) {
  const deltaTime = lastFrameTime ? Math.min(0.05, (time - lastFrameTime) * 0.001) : 0;
  lastFrameTime = time;
  elapsed = time * 0.001;
  controls.update();
  updateTimer(time);

  const tension = insertedWeapons.length / slots.length;
  slots.forEach((slot, index) => {
    if (slot.userData.used) return;
    const ring = slot.userData.ring;
    const isHovered = slot === hoveredSlot;
    const isRemote = slot === remoteSelectedSlot;
    ring.material.color.setHex(isRemote ? 0x52e3a4 : isHovered ? 0xd7a43d : 0x46372d);
    ring.material.emissive.setHex(isRemote ? 0x0cae69 : isHovered ? 0x8b4900 : 0x1e1208);
    ring.material.emissiveIntensity = isRemote || isHovered
      ? 0.9
      : 0.16 + tension * 0.12 + Math.sin(elapsed * (2.1 + tension * 2) + index) * 0.06;
    const scale = isRemote || isHovered ? 1.17 : 1;
    ring.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.2);
  });

  insertedWeapons.forEach((weapon) => {
    if (weapon.userData.progress >= 1) return;
    const progress = Math.min(1, (elapsed - weapon.userData.startedAt) / 1.08);
    weapon.userData.progress = progress;
    const impactPosition = weapon.userData.target.clone().addScaledVector(weapon.userData.inward, 0.11);
    const reboundPosition = weapon.userData.target.clone().addScaledVector(weapon.userData.outward, 0.055);
    let position;
    if (progress < 0.24) {
      const align = progress / 0.24;
      const easedAlign = 1 - (1 - align) ** 3;
      position = weapon.userData.approachPosition.clone().lerp(weapon.userData.aimPosition, easedAlign);
      weapon.quaternion.slerpQuaternions(
        weapon.userData.approachQuaternion,
        weapon.userData.finalQuaternion,
        easedAlign,
      );
    } else if (progress < 0.38) {
      const drawBack = (progress - 0.24) / 0.14;
      position = weapon.userData.aimPosition.clone().lerp(
        weapon.userData.pullbackPosition,
        1 - (1 - drawBack) ** 2,
      );
      weapon.quaternion.copy(weapon.userData.finalQuaternion);
    } else if (progress < 0.78) {
      const strike = (progress - 0.38) / 0.4;
      const thrust = strike * strike * (3 - 2 * strike);
      position = weapon.userData.pullbackPosition.clone().lerp(impactPosition, thrust);
      weapon.quaternion.copy(weapon.userData.finalQuaternion);
    } else if (progress < 0.9) {
      const rebound = (progress - 0.78) / 0.12;
      position = impactPosition.lerp(reboundPosition, 1 - (1 - rebound) ** 2);
      weapon.quaternion.copy(weapon.userData.finalQuaternion);
    } else {
      const settle = (progress - 0.9) / 0.1;
      position = reboundPosition.lerp(weapon.userData.target, 1 - (1 - settle) ** 2);
      weapon.quaternion.copy(weapon.userData.finalQuaternion);
    }
    weapon.position.copy(position);
    if (progress >= 0.78 && !weapon.userData.impacted) {
      weapon.userData.impacted = true;
      resolveWeaponImpact(weapon);
    }
    if (progress >= 1 && !gameOver) {
      isAnimating = false;
      sendGameState();
    }
  });

  particles.forEach((particle, index) => {
    particle.userData.life -= deltaTime;
    particle.userData.velocity.y -= deltaTime * 0.8;
    particle.position.addScaledVector(particle.userData.velocity, deltaTime);
    particle.rotation.x += deltaTime * 8;
    particle.rotation.z += deltaTime * 5;
    if (particle.material.transparent) particle.material.opacity = Math.max(0, particle.userData.life / particle.userData.maxLife);
    if (particle.userData.life <= 0) {
      effectsRoot.remove(particle);
      particles.splice(index, 1);
    }
  });

  impactKick = Math.max(0, impactKick - deltaTime * 4.8);
  fakeoutKick = Math.max(0, fakeoutKick - deltaTime * 1.7);
  const totalKick = Math.max(impactKick, fakeoutKick * 0.72);
  const revealEase = pirateAwake
    ? THREE.MathUtils.smootherstep(piratePop, 0.02, 0.86)
    : 0;
  const baseFov = pirateAwake ? THREE.MathUtils.lerp(38, 47, revealEase) : 38;
  if (totalKick > 0) {
    gameRoot.rotation.z = Math.sin(elapsed * (impactKick > 0 ? 62 : 24)) * totalKick * 0.025;
    gameRoot.position.y = Math.abs(Math.sin(elapsed * 48)) * totalKick * 0.04;
    camera.fov += ((baseFov + totalKick * 0.9) - camera.fov) * 0.18;
    camera.updateProjectionMatrix();
  } else {
    gameRoot.rotation.z *= 0.7;
    gameRoot.position.y *= 0.7;
    camera.fov += (baseFov - camera.fov) * 0.12;
    camera.updateProjectionMatrix();
  }

  if (pirateAwake && pirateRevealCameraCaptured) {
    camera.position.lerpVectors(pirateRevealCameraStart, pirateRevealCameraEnd, revealEase);
    controls.target.lerpVectors(pirateRevealTargetStart, pirateRevealTargetEnd, revealEase);
  }

  const pirateBaseY = opening.position.y - PIRATE_REST_DEPTH;
  let currentPirateScale = PIRATE_REST_SCALE;
  if (pirateAwake) {
    piratePop = Math.min(1, piratePop + deltaTime * 0.82);
    const pop = THREE.MathUtils.smootherstep(piratePop, 0, 0.82);
    const launchArcProgress = Math.min(1, piratePop / 0.78);
    const jumpArc = Math.sin(launchArcProgress * Math.PI) * 1.38;
    const landingBounce = piratePop > 0.72
      ? Math.sin((piratePop - 0.72) * Math.PI * 8) * (1 - piratePop) * 0.3
      : 0;
    const scaleOvershoot = Math.sin(Math.min(1, piratePop / 0.72) * Math.PI) * 0.1;
    currentPirateScale = THREE.MathUtils.lerp(
      PIRATE_REST_SCALE,
      PIRATE_POP_SCALE,
      pop,
    ) * (1 + scaleOvershoot);
    const forwardOffset = THREE.MathUtils.lerp(PIRATE_REST_FORWARD, PIRATE_POP_FORWARD, pop);
    pirate.scale.setScalar(currentPirateScale);
    pirate.position.x = Math.sin(piratePop * Math.PI * 1.35) * (1 - pop) * 0.34;
    pirate.position.z = forwardOffset;
    pirate.position.y = THREE.MathUtils.lerp(pirateBaseY, opening.position.y + 0.42, pop)
      + jumpArc + landingBounce;
    pirate.rotation.x = -Math.sin(piratePop * Math.PI) * 0.09;
    pirate.rotation.y = PIRATE_FORWARD_YAW
      + Math.sin(piratePop * Math.PI * 1.18) * (1 - pop) * 0.52
      + Math.sin(elapsed * 2.6) * pop * 0.045;
    pirate.rotation.z = Math.sin(piratePop * Math.PI * 2.1) * (1 - pop) * 0.2
      + Math.sin(elapsed * 2.1) * pop * 0.025;
  } else if (fakeoutKick > 0) {
    const peek = Math.sin((1 - fakeoutKick) * Math.PI);
    currentPirateScale = PIRATE_REST_SCALE + peek * 0.035;
    pirate.scale.setScalar(currentPirateScale);
    pirate.position.x = 0;
    pirate.position.z = PIRATE_REST_FORWARD;
    pirate.position.y = pirateBaseY + peek * 0.16;
    pirate.rotation.y = PIRATE_FORWARD_YAW + Math.sin(elapsed * 8) * 0.22;
    pirate.rotation.z = Math.sin(elapsed * 10) * 0.035;
  } else {
    pirate.scale.setScalar(PIRATE_REST_SCALE);
    pirate.position.x = 0;
    pirate.position.z = PIRATE_REST_FORWARD;
    pirate.position.y = pirateBaseY + Math.sin(elapsed * 2.1) * 0.012;
    pirate.rotation.y = PIRATE_FORWARD_YAW + Math.sin(elapsed * 1.3) * 0.045;
    pirate.rotation.z = Math.sin(elapsed * 0.9) * 0.018;
  }

  const openingClipY = openingRim.localToWorld(openingClipPoint.set(0, 0.02, 0)).y;
  pirateClipPlane.constant = -openingClipY;
  pirateMixer?.update(deltaTime);
  updatePirateExpression(deltaTime);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

buildSlots();
renderPlayerNameFields();
resetRound();
resize();
try {
  roomTitleInput.value = normalizeRoomTitle(localStorage.getItem('kraken-room-title') || roomTitleInput.value);
} catch {
  roomTitleInput.value = normalizeRoomTitle(roomTitleInput.value);
}
renderOpenRooms();
roomDirectory.addEventListener('status', (event) => {
  directoryStatus = event.detail;
  renderOpenRooms();
});
roomDirectory.addEventListener('rooms', (event) => {
  directoryRooms = event.detail;
  renderOpenRooms();
});
roomDirectory.start();
window.addEventListener('resize', resize);
window.addEventListener('beforeunload', () => {
  roomDirectory.stop();
  remotePeer?.destroy();
});
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerleave', () => {
  hoveredSlot = null;
  canvas.classList.remove('is-aiming');
});

containerButtons.forEach((button) => button.addEventListener('click', () => selectContainer(button.dataset.container)));
swordButtons.forEach((button) => button.addEventListener('click', () => selectSword(button.dataset.sword)));
modeButtons.forEach((button) => button.addEventListener('click', () => {
  modeButtons.forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle('is-selected', selected);
    candidate.setAttribute('aria-pressed', String(selected));
  });
}));
targetButtons.forEach((button) => button.addEventListener('click', () => {
  targetButtons.forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle('is-selected', selected);
    candidate.setAttribute('aria-pressed', String(selected));
  });
}));
playerCountSelect.addEventListener('change', renderPlayerNameFields);
$('#start-game-button').addEventListener('click', startConfiguredGame);
settingsButton.addEventListener('click', () => {
  turnDeadline = 0;
  settingsDialog.showModal();
});
showHostSetupButton.addEventListener('click', showHostSetup);
backStartHomeButton.addEventListener('click', showStartHome);
startLocalGameButton.addEventListener('click', startLocalGameFromHome);
refreshRoomListButton.addEventListener('click', () => roomDirectory.refresh());
randomRoomButton.addEventListener('click', () => {
  const rooms = availableDirectoryRooms();
  const room = rooms[Math.floor(Math.random() * rooms.length)];
  if (room) navigateToRoom(room.roomCode);
});
openRoomList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-join-open-room]');
  if (button && !button.disabled) navigateToRoom(button.dataset.joinOpenRoom);
});
roomModeButtons.forEach((button) => button.addEventListener('click', () => {
  roomModeButtons.forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle('is-selected', selected);
    candidate.setAttribute('aria-pressed', String(selected));
  });
}));
roomTargetButtons.forEach((button) => button.addEventListener('click', () => {
  roomTargetButtons.forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle('is-selected', selected);
    candidate.setAttribute('aria-pressed', String(selected));
  });
}));
roomContainerButtons.forEach((button) => button.addEventListener('click', () => {
  roomContainerButtons.forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle('is-selected', selected);
    candidate.setAttribute('aria-pressed', String(selected));
  });
}));
createRoomButton.addEventListener('click', createOnlineRoom);
joinRoomButton.addEventListener('click', joinRoomByCode);
joinRoomCodeInput.addEventListener('input', () => {
  joinRoomCodeInput.value = normalizeRoomCode(joinRoomCodeInput.value);
});
joinRoomCodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') joinRoomByCode();
});
startRoomGameButton.addEventListener('click', startOnlineRoomGame);
closeRoomButton.addEventListener('click', closeOnlineRoom);
resultButton.addEventListener('click', nextRound);
document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => {
  document.getElementById(button.dataset.closeDialog)?.close();
}));
copyRemoteLinkButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(remoteLink);
  showToast('휴대폰 연결 링크를 복사했습니다');
});
settingsDialog.addEventListener('close', () => {
  if (gameMode === 'speed' && !gameOver && !turnDeadline) startTurnTimer();
});
requestAnimationFrame(animate);

const loader = new GLTFLoader();

function prepareMeshyModel(model) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (!object.geometry.attributes.normal) object.geometry.computeVertexNormals();
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      material.envMapIntensity = 0.9;
      material.needsUpdate = true;
    });
  });
}

function clipPirateToHead(model) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const clippedMaterials = materials.map((material) => {
      const clippedMaterial = material.clone();
      clippedMaterial.clippingPlanes = [pirateClipPlane];
      clippedMaterial.clipShadows = true;
      clippedMaterial.needsUpdate = true;
      return clippedMaterial;
    });
    object.material = Array.isArray(object.material) ? clippedMaterials : clippedMaterials[0];
  });
}

function registerPirateExpressions(model) {
  pirateMorphMeshes.length = 0;
  model.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary || !object.morphTargetInfluences) return;
    pirateMorphMeshes.push(object);
  });
}

function registerPirateAnimations(model, clips) {
  pirateMixer = new THREE.AnimationMixer(model);
  const idleClip = THREE.AnimationClip.findByName(clips, 'PirateIdle');
  const revealClip = THREE.AnimationClip.findByName(clips, 'PirateReveal');
  pirateIdleAction = idleClip ? pirateMixer.clipAction(idleClip) : null;
  pirateRevealAction = revealClip ? pirateMixer.clipAction(revealClip) : null;
  if (pirateIdleAction) {
    pirateIdleAction.setLoop(THREE.LoopRepeat, Infinity);
    pirateIdleAction.play();
  }
  if (pirateRevealAction) {
    pirateRevealAction.setLoop(THREE.LoopOnce, 1);
    pirateRevealAction.clampWhenFinished = true;
  }
}

function updatePirateExpression(deltaTime) {
  if (!pirateMorphMeshes.length) return;

  const safeSlotCount = Math.max(1, slots.length - triggerSlots.size);
  const tension = Math.min(1, insertedWeapons.length / safeSlotCount);
  const blinkCycle = elapsed % 4.8;
  const blinkTarget = !pirateAwake && blinkCycle > 4.5
    ? Math.sin(((blinkCycle - 4.5) / 0.3) * Math.PI)
    : 0;
  const worriedTarget = pirateAwake
    ? 0
    : Math.min(1, tension * 0.82 + fakeoutKick * 0.58);
  const surprisedTarget = pirateAwake
    ? Math.min(1, piratePop * 1.7)
    : Math.sin((1 - fakeoutKick) * Math.PI) * Math.min(0.28, fakeoutKick);

  const follow = (current, target, speed) => (
    THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * deltaTime))
  );
  pirateExpression.blink = follow(pirateExpression.blink, blinkTarget, 30);
  pirateExpression.worried = follow(pirateExpression.worried, worriedTarget, 7);
  pirateExpression.surprised = follow(pirateExpression.surprised, surprisedTarget, 13);

  pirateMorphMeshes.forEach((mesh) => {
    const { morphTargetDictionary: dictionary, morphTargetInfluences: influences } = mesh;
    if (dictionary.Blink !== undefined) influences[dictionary.Blink] = pirateExpression.blink;
    if (dictionary.Worried !== undefined) influences[dictionary.Worried] = pirateExpression.worried;
    if (dictionary.Surprised !== undefined) influences[dictionary.Surprised] = pirateExpression.surprised;
  });
}

function fitUprightModel(model, targetHeight, targetDiameter = 0) {
  const initialBox = new THREE.Box3().setFromObject(model);
  const scale = targetHeight / initialBox.getSize(new THREE.Vector3()).y;
  model.scale.setScalar(scale);
  if (targetDiameter) {
    const heightScaledBox = new THREE.Box3().setFromObject(model);
    const heightScaledSize = heightScaledBox.getSize(new THREE.Vector3());
    const diameterScale = targetDiameter / Math.max(heightScaledSize.x, heightScaledSize.z);
    model.scale.x *= diameterScale;
    model.scale.z *= diameterScale;
  }
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  return model;
}

function makeWeaponTemplate(model, config) {
  const template = new THREE.Group();
  const visual = new THREE.Group();
  visual.add(model);
  template.add(visual);

  if (config.axis === 'x') visual.rotation.y = config.rotation;
  if (config.axis === 'y') visual.rotation.x = config.rotation;
  if (config.forward) {
    const measuredForward = new THREE.Vector3(...config.forward).normalize().applyQuaternion(visual.quaternion);
    const alignment = new THREE.Quaternion().setFromUnitVectors(measuredForward, new THREE.Vector3(0, 0, 1));
    visual.quaternion.premultiply(alignment);
  }

  let box = new THREE.Box3().setFromObject(visual);
  const size = box.getSize(new THREE.Vector3());
  const length = Math.max(size.x, size.y, size.z);
  visual.scale.setScalar(1.9 / length);
  box = new THREE.Box3().setFromObject(visual);
  const scaledSize = box.getSize(new THREE.Vector3());
  const tipBandStart = box.max.z - scaledSize.z * 0.055;
  const tipCenter = new THREE.Vector3();
  let tipVertexCount = 0;
  template.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!object.isMesh || !object.geometry.attributes.position) return;
    const positions = object.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
      if (vertex.z < tipBandStart) continue;
      tipCenter.add(vertex);
      tipVertexCount += 1;
    }
  });
  if (tipVertexCount) tipCenter.multiplyScalar(1 / tipVertexCount);
  else box.getCenter(tipCenter);
  visual.position.x -= tipCenter.x;
  visual.position.y -= tipCenter.y;
  visual.position.z -= box.min.z + scaledSize.z * 0.42;
  return template;
}

async function loadMeshyAssets() {
  const entries = Object.entries(MESHY_ASSETS);
  let completed = 0;
  loading.querySelector('strong').textContent = 'Meshy 에셋 10종을 불러오는 중';

  const results = await Promise.allSettled(entries.map(async ([key, config]) => {
    const url = `${import.meta.env.BASE_URL}assets/models/meshy/${config.file}`;
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    prepareMeshyModel(model);

    if (config.kind === 'container') {
      const containerConfig = CONTAINER_CONFIGS[key];
      const targetDiameter = containerConfig.radiusAt(containerConfig.height * 0.5) * 2;
      fitUprightModel(model, containerConfig.height, targetDiameter);
      containerRoots[key].add(model);
    } else if (config.kind === 'pirate') {
      fitUprightModel(model, 1.8);
      registerPirateExpressions(model);
      registerPirateAnimations(model, gltf.animations);
      clipPirateToHead(model);
      pirate.add(model);
    } else {
      weaponTemplates.set(key, makeWeaponTemplate(model, config));
    }

    completed += 1;
    loadingProgress.textContent = `${completed} / ${entries.length}`;
  }));

  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length) {
    failures.forEach((failure) => console.error('Meshy asset load failed', failure.reason));
    loading.querySelector('strong').textContent = `${failures.length}개 에셋을 불러오지 못했습니다`;
    loadingProgress.textContent = '새로고침해 주세요';
    return;
  }

  updateContainerLayout();
  resetRound();
  loadingProgress.textContent = '100%';
  window.setTimeout(() => loading.classList.add('loading--hidden'), 180);
}

loadMeshyAssets();
