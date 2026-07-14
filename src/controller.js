import { Peer } from 'peerjs';
import {
  createClientId,
  normalizePlayerName,
  normalizeRoomCode,
  roomPeerId,
} from './room-protocol.js';

const params = new URLSearchParams(window.location.search);
const roomCode = normalizeRoomCode(params.get('room'));
const legacyHostPeerId = params.get('controller');
const hostPeerId = legacyHostPeerId || roomPeerId(roomCode);
const playerColors = ['#4bd7e7', '#ff7b70', '#f3c860', '#a78bfa', '#73e29a', '#f38fca'];

const statusLabel = document.querySelector('#controller-status');
const playerLabel = document.querySelector('#controller-player');
const tensionFill = document.querySelector('#controller-tension span');
const slotRoot = document.querySelector('#controller-slots');
const insertButton = document.querySelector('#controller-insert');
const barrelTarget = document.querySelector('#controller-barrel-target');
const containerPreview = document.querySelector('#controller-container-preview');
const containerNameLabel = document.querySelector('#controller-container-name');
const targetGuide = document.querySelector('#controller-target-guide');
const aimWeapon = document.querySelector('#controller-aim-weapon');
const weaponButtons = [...document.querySelectorAll('[data-remote-weapon]')];
const joinCard = document.querySelector('#controller-join-card');
const roomCodeLabel = document.querySelector('#controller-room-code');
const nameInput = document.querySelector('#controller-name');
const joinButton = document.querySelector('#controller-join-button');
const lobby = document.querySelector('#controller-lobby');
const lobbyCode = document.querySelector('#controller-lobby-code');
const seatLabel = document.querySelector('#controller-seat');
const lobbyPlayerList = document.querySelector('#controller-player-list');
const roomRules = document.querySelector('#controller-room-rules');
const readyButton = document.querySelector('#controller-ready-button');
const gamePanel = document.querySelector('#controller-game');
const controllerApp = document.querySelector('#controller-app');

const modeNames = {
  classic: '클래식',
  double: '더블 크라켄',
  speed: '7초 속전속결',
  reverse: '역전 모드',
};
const containerNames = {
  wood: '오크통',
  drum: '코발트 드럼통',
  powder: '저주받은 화약통',
};
const containerVisuals = {
  wood: '/assets/ui/icon-container-wood.png',
  drum: '/assets/ui/icon-container-drum.png',
  powder: '/assets/ui/icon-container-powder.png',
};
const weaponVisuals = {
  classic: '/assets/ui/icon-weapon-classic.png',
  cutlass: '/assets/ui/icon-weapon-cutlass.png',
  dagger: '/assets/ui/icon-weapon-dagger.png',
  fish: '/assets/ui/icon-weapon-fish.png',
  carrot: '/assets/ui/icon-weapon-carrot.png',
  umbrella: '/assets/ui/icon-weapon-umbrella.png',
};
const slotPositions = [
  [23, 31], [36.5, 27.5], [50, 26], [63.5, 27.5], [77, 31],
  [17, 49], [30.2, 45.5], [43.4, 44], [56.6, 44], [69.8, 45.5], [83, 49],
  [23, 67], [36.5, 70.5], [50, 72], [63.5, 70.5], [77, 67],
];

let peer = null;
let connection = null;
let selectedSlot = null;
let usedSlots = [];
let slotCount = 16;
let gameLocked = true;
let joined = false;
let roomStarted = false;
let yourPlayerIndex = null;
let ready = false;
let containerStyle = 'wood';
let selectedWeapon = 'classic';

function setGameView(active) {
  controllerApp.classList.toggle('is-game-active', active);
}

function readLocalValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing can disable storage; the room still works for this session.
  }
}

const clientId = readLocalValue('kraken-crew-id') || createClientId();
writeLocalValue('kraken-crew-id', clientId);
nameInput.value = readLocalValue('kraken-crew-name') || '';
roomCodeLabel.textContent = roomCode || '초대 링크';
lobbyCode.textContent = roomCode || '연결됨';
statusLabel.textContent = roomCode || legacyHostPeerId
  ? '이름을 입력하고 온라인 방에 참가하세요.'
  : '참가 코드가 없는 링크입니다. 방장에게 새 링크를 받아주세요.';
joinButton.disabled = !roomCode && !legacyHostPeerId;

function send(message) {
  if (connection?.open) connection.send(message);
}

function updateContainerVisual(style = 'wood') {
  if (!Object.hasOwn(containerVisuals, style)) return;
  containerStyle = style;
  barrelTarget.dataset.container = style;
  containerPreview.src = containerVisuals[style];
  containerPreview.alt = containerNames[style];
  containerNameLabel.textContent = containerNames[style];
}

function updateAimWeapon(style = 'classic') {
  if (!Object.hasOwn(weaponVisuals, style)) return;
  selectedWeapon = style;
  aimWeapon.src = weaponVisuals[style];
}

function updateAimPosition() {
  const position = slotPositions[selectedSlot];
  aimWeapon.hidden = !position;
  if (!position) return;
  barrelTarget.style.setProperty('--aim-x', `${position[0]}%`);
  barrelTarget.style.setProperty('--aim-y', `${position[1]}%`);
  targetGuide.textContent = `${String(selectedSlot + 1).padStart(2, '0')}번 구멍 조준 완료 · 아래의 칼 꽂기 버튼을 누르세요.`;
}

function renderSlots() {
  slotRoot.replaceChildren();
  for (let index = 0; index < slotCount; index += 1) {
    const position = slotPositions[index] || [50, 50];
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index + 1).padStart(2, '0');
    button.dataset.slotIndex = String(index);
    button.style.setProperty('--slot-x', `${position[0]}%`);
    button.style.setProperty('--slot-y', `${position[1]}%`);
    button.classList.toggle('is-used', usedSlots.includes(index));
    button.disabled = usedSlots.includes(index) || gameLocked;
    button.classList.toggle('is-selected', selectedSlot === index);
    button.setAttribute('aria-label', usedSlots.includes(index)
      ? `${index + 1}번 구멍, 이미 사용됨`
      : `${index + 1}번 구멍 조준`);
    button.addEventListener('click', () => {
      selectedSlot = index;
      renderSlots();
      insertButton.disabled = gameLocked;
      gamePanel.classList.remove('is-inserting');
      updateAimPosition();
      send({ type: 'select-slot', slotIndex: index });
      navigator.vibrate?.(20);
    });
    slotRoot.append(button);
  }
  updateAimPosition();
}

function renderRoomPlayers(players = [], capacity = players.length) {
  lobbyPlayerList.replaceChildren();
  const playersBySeat = new Map(players.map((player) => [player.playerIndex, player]));
  for (let playerIndex = 0; playerIndex < capacity; playerIndex += 1) {
    const player = playersBySeat.get(playerIndex);
    const row = document.createElement('div');
    row.className = player ? 'room-player' : 'room-player room-player--empty';
    if (player?.ready && player.connected) row.classList.add('is-ready');
    row.style.setProperty('--player-color', playerColors[playerIndex] || '#d7dee5');

    const badge = document.createElement('span');
    badge.className = 'room-player__badge';
    badge.textContent = `P${playerIndex + 1}`;

    const name = document.createElement('strong');
    name.textContent = player
      ? player.playerIndex === yourPlayerIndex ? `${player.name} (나)` : player.name
      : '빈 좌석';

    const state = document.createElement('i');
    state.textContent = player
      ? player.connected ? (player.ready ? '준비 완료' : '준비 대기') : '재접속 대기'
      : '참가 대기';
    row.append(badge, name, state);
    lobbyPlayerList.append(row);
  }
}

function updateReadyButton() {
  readyButton.textContent = ready ? '준비 취소' : '준비 완료';
  readyButton.classList.toggle('is-ready', ready);
  readyButton.setAttribute('aria-pressed', String(ready));
  readyButton.disabled = !joined || roomStarted;
}

function applyRoomState(state) {
  roomStarted = Boolean(state.started);
  setGameView(roomStarted);
  yourPlayerIndex = state.yourPlayerIndex ?? yourPlayerIndex;
  const capacity = Number(state.capacity) || state.players.length;
  const me = state.players.find((player) => player.playerIndex === yourPlayerIndex);
  ready = Boolean(me?.ready);
  seatLabel.textContent = yourPlayerIndex === null ? '선원 등록 중' : `플레이어 ${yourPlayerIndex + 1}`;
  lobbyCode.textContent = state.roomCode || roomCode || '연결됨';
  renderRoomPlayers(state.players, capacity);
  roomRules.textContent = [
    `${capacity}명`,
    modeNames[state.settings?.mode] || '클래식',
    `${state.settings?.targetScore || 3}점 승리`,
    containerNames[state.settings?.container] || '오크통',
  ].join(' · ');
  updateContainerVisual(state.settings?.container || containerStyle);
  joinCard.hidden = joined;
  lobby.hidden = !joined || roomStarted;
  gamePanel.hidden = !roomStarted;
  updateReadyButton();
  if (joined && !roomStarted) {
    statusLabel.textContent = ready
      ? '준비 완료 · 다른 선원들을 기다리고 있습니다.'
      : '대기실 접속 완료 · 준비 버튼을 눌러 주세요.';
  }
}

function applyGameState(state) {
  if (state.roomStarted === false) return;
  roomStarted = true;
  setGameView(true);
  yourPlayerIndex = state.yourPlayerIndex ?? yourPlayerIndex;
  usedSlots = state.usedSlots ?? [];
  slotCount = state.slotCount ?? 16;
  gameLocked = !state.canAct;
  updateContainerVisual(state.container || containerStyle);
  updateAimWeapon(state.swordStyle || selectedWeapon);
  gamePanel.classList.toggle('is-inserting', Boolean(state.isAnimating));
  tensionFill.style.width = `${Math.round((state.tension ?? 0) * 100)}%`;
  playerLabel.textContent = state.isYourTurn
    ? `${state.currentPlayerName ?? '내'} 차례입니다!`
    : `${state.currentPlayerName ?? '다른 선원'}의 차례`;
  statusLabel.textContent = state.gameOver
    ? '라운드가 끝났습니다. 방장의 다음 명령을 기다리세요.'
    : state.isYourTurn
      ? '내 차례 · 무기와 구멍을 선택해 주세요.'
      : '다른 선원의 차례를 지켜보고 있습니다.';
  if (selectedSlot !== null && usedSlots.includes(selectedSlot)) {
    selectedSlot = null;
    targetGuide.textContent = state.gameOver
      ? '라운드가 끝났습니다.'
      : '칼이 꽂혔습니다. 다음 차례를 기다려 주세요.';
  } else if (selectedSlot === null) {
    targetGuide.textContent = state.gameOver
      ? '라운드가 끝났습니다.'
      : state.isYourTurn
        ? '통 위의 구멍을 누르면 칼끝이 해당 위치를 조준합니다.'
        : '다른 선원이 고르는 구멍을 지켜보세요.';
  }
  insertButton.disabled = selectedSlot === null || gameLocked;
  weaponButtons.forEach((button) => {
    button.disabled = gameLocked;
    button.classList.toggle('is-selected', button.dataset.remoteWeapon === state.swordStyle);
  });
  joinCard.hidden = true;
  lobby.hidden = true;
  gamePanel.hidden = false;
  renderSlots();
}

function handleDisconnect(message = '방장과 연결이 끊어졌습니다. 다시 참가해 주세요.') {
  gameLocked = true;
  joined = false;
  roomStarted = false;
  ready = false;
  selectedSlot = null;
  connection = null;
  setGameView(false);
  renderSlots();
  insertButton.disabled = true;
  weaponButtons.forEach((button) => { button.disabled = true; });
  gamePanel.hidden = true;
  lobby.hidden = true;
  joinCard.hidden = false;
  joinButton.disabled = false;
  joinButton.textContent = '다시 연결하기';
  statusLabel.textContent = message;
  updateReadyButton();
}

function handleMessage(message) {
  if (!message?.type) return;
  if (message.type === 'room-joined') {
    joined = true;
    ready = false;
    yourPlayerIndex = message.playerIndex;
    writeLocalValue('kraken-crew-name', message.name);
    joinButton.disabled = false;
    joinButton.textContent = '방에 참가하기';
    joinCard.hidden = true;
    lobby.hidden = false;
    seatLabel.textContent = `플레이어 ${yourPlayerIndex + 1}`;
    statusLabel.textContent = '방 참가 완료 · 대기실 정보를 불러오는 중…';
    send({ type: 'controller-ready' });
    updateReadyButton();
    return;
  }
  if (message.type === 'room-state') applyRoomState(message.state);
  if (message.type === 'game-state') applyGameState(message.state);
  if (message.type === 'action-rejected') statusLabel.textContent = message.reason;
  if (message.type === 'room-error') handleDisconnect(message.reason);
  if (message.type === 'room-closed') handleDisconnect(message.reason);
  if (message.type === 'impact') navigator.vibrate?.([45, 30, 90]);
  if (message.type === 'fakeout') navigator.vibrate?.([80, 40, 80, 40, 130]);
  if (message.type === 'kraken') navigator.vibrate?.([160, 70, 220]);
}

function connectToRoom() {
  if (!hostPeerId) return;
  const playerName = normalizePlayerName(nameInput.value, '이름 없는 선원');
  nameInput.value = playerName;
  joinButton.disabled = true;
  joinButton.textContent = '연결 중…';
  statusLabel.textContent = '게임 서버에 연결하는 중…';

  connection?.close();
  peer?.destroy();
  peer = new Peer(undefined, { debug: 1 });

  peer.on('open', () => {
    statusLabel.textContent = '온라인 방을 찾는 중…';
    connection = peer.connect(hostPeerId, {
      reliable: true,
      metadata: { role: 'player', clientId },
    });

    connection.on('open', () => {
      statusLabel.textContent = '선원 명단에 등록하는 중…';
      send({ type: 'join-room', clientId, name: playerName });
    });
    connection.on('data', handleMessage);
    connection.on('close', () => handleDisconnect());
    connection.on('error', () => handleDisconnect('방에 연결하지 못했습니다. 참가 코드를 확인해 주세요.'));
  });

  peer.on('error', (error) => {
    console.error(error);
    const message = error.type === 'peer-unavailable'
      ? '방을 찾을 수 없습니다. 방장이 화면을 열어두었는지 확인해 주세요.'
      : '게임 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    handleDisconnect(message);
  });
}

renderSlots();
updateReadyButton();

joinButton.addEventListener('click', connectToRoom);
nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !joinButton.disabled) connectToRoom();
});

readyButton.addEventListener('click', () => {
  if (!joined || roomStarted) return;
  ready = !ready;
  updateReadyButton();
  statusLabel.textContent = ready
    ? '준비 완료 · 다른 선원들을 기다리고 있습니다.'
    : '준비가 취소되었습니다.';
  send({ type: 'set-ready', ready });
  navigator.vibrate?.(ready ? [35, 20, 70] : 20);
});

weaponButtons.forEach((button) => {
  button.disabled = true;
  button.addEventListener('click', () => {
    if (gameLocked) return;
    weaponButtons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button));
    updateAimWeapon(button.dataset.remoteWeapon);
    send({ type: 'select-weapon', style: button.dataset.remoteWeapon });
    navigator.vibrate?.(15);
  });
});

insertButton.addEventListener('click', () => {
  if (selectedSlot === null || gameLocked) return;
  gamePanel.classList.add('is-inserting');
  targetGuide.textContent = `${String(selectedSlot + 1).padStart(2, '0')}번 구멍에 칼을 꽂는 중…`;
  send({ type: 'insert-slot', slotIndex: selectedSlot });
  insertButton.disabled = true;
  navigator.vibrate?.([35, 25, 70]);
});

window.addEventListener('beforeunload', () => peer?.destroy());
