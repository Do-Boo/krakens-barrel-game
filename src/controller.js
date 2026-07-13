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
const weaponButtons = [...document.querySelectorAll('[data-remote-weapon]')];
const joinCard = document.querySelector('#controller-join-card');
const roomCodeLabel = document.querySelector('#controller-room-code');
const nameInput = document.querySelector('#controller-name');
const joinButton = document.querySelector('#controller-join-button');
const lobby = document.querySelector('#controller-lobby');
const lobbyCode = document.querySelector('#controller-lobby-code');
const seatLabel = document.querySelector('#controller-seat');
const lobbyPlayerList = document.querySelector('#controller-player-list');
const gamePanel = document.querySelector('#controller-game');

let peer = null;
let connection = null;
let selectedSlot = null;
let usedSlots = [];
let slotCount = 16;
let gameLocked = true;
let joined = false;
let roomStarted = false;
let yourPlayerIndex = null;

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

function renderSlots() {
  slotRoot.replaceChildren();
  for (let index = 0; index < slotCount; index += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index + 1).padStart(2, '0');
    button.disabled = usedSlots.includes(index) || gameLocked;
    button.classList.toggle('is-selected', selectedSlot === index);
    button.addEventListener('click', () => {
      selectedSlot = index;
      renderSlots();
      insertButton.disabled = gameLocked;
      send({ type: 'select-slot', slotIndex: index });
      navigator.vibrate?.(20);
    });
    slotRoot.append(button);
  }
}

function renderRoomPlayers(players = []) {
  lobbyPlayerList.replaceChildren();
  players.forEach((player) => {
    const row = document.createElement('div');
    row.className = 'room-player';
    row.style.setProperty('--player-color', playerColors[player.playerIndex] || '#d7dee5');

    const badge = document.createElement('span');
    badge.className = 'room-player__badge';
    badge.textContent = `P${player.playerIndex + 1}`;

    const name = document.createElement('strong');
    name.textContent = player.playerIndex === yourPlayerIndex ? `${player.name} (나)` : player.name;

    const state = document.createElement('i');
    state.textContent = player.connected ? '접속' : '재접속 대기';
    row.append(badge, name, state);
    lobbyPlayerList.append(row);
  });
}

function applyRoomState(state) {
  roomStarted = Boolean(state.started);
  yourPlayerIndex = state.yourPlayerIndex ?? yourPlayerIndex;
  seatLabel.textContent = yourPlayerIndex === null ? '선원 등록 중' : `플레이어 ${yourPlayerIndex + 1}`;
  lobbyCode.textContent = state.roomCode || roomCode || '연결됨';
  renderRoomPlayers(state.players);
  joinCard.hidden = joined;
  lobby.hidden = !joined || roomStarted;
  gamePanel.hidden = !roomStarted;
  if (joined && !roomStarted) statusLabel.textContent = '대기실 접속 완료 · 방장이 게임을 시작합니다.';
}

function applyGameState(state) {
  if (state.roomStarted === false) return;
  roomStarted = true;
  yourPlayerIndex = state.yourPlayerIndex ?? yourPlayerIndex;
  usedSlots = state.usedSlots ?? [];
  slotCount = state.slotCount ?? 16;
  gameLocked = !state.canAct;
  tensionFill.style.width = `${Math.round((state.tension ?? 0) * 100)}%`;
  playerLabel.textContent = state.isYourTurn
    ? `${state.currentPlayerName ?? '내'} 차례입니다!`
    : `${state.currentPlayerName ?? '다른 선원'}의 차례`;
  statusLabel.textContent = state.gameOver
    ? '라운드가 끝났습니다. 방장의 다음 명령을 기다리세요.'
    : state.isYourTurn
      ? '내 차례 · 무기와 구멍을 선택해 주세요.'
      : '다른 선원의 차례를 지켜보고 있습니다.';
  if (selectedSlot !== null && usedSlots.includes(selectedSlot)) selectedSlot = null;
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
  connection = null;
  renderSlots();
  insertButton.disabled = true;
  weaponButtons.forEach((button) => { button.disabled = true; });
  gamePanel.hidden = true;
  lobby.hidden = true;
  joinCard.hidden = false;
  joinButton.disabled = false;
  joinButton.textContent = '다시 연결하기';
  statusLabel.textContent = message;
}

function handleMessage(message) {
  if (!message?.type) return;
  if (message.type === 'room-joined') {
    joined = true;
    yourPlayerIndex = message.playerIndex;
    writeLocalValue('kraken-crew-name', message.name);
    joinButton.disabled = false;
    joinButton.textContent = '방에 참가하기';
    joinCard.hidden = true;
    lobby.hidden = false;
    seatLabel.textContent = `플레이어 ${yourPlayerIndex + 1}`;
    statusLabel.textContent = '방 참가 완료 · 대기실 정보를 불러오는 중…';
    send({ type: 'controller-ready' });
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

joinButton.addEventListener('click', connectToRoom);
nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !joinButton.disabled) connectToRoom();
});

weaponButtons.forEach((button) => {
  button.disabled = true;
  button.addEventListener('click', () => {
    if (gameLocked) return;
    weaponButtons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button));
    send({ type: 'select-weapon', style: button.dataset.remoteWeapon });
    navigator.vibrate?.(15);
  });
});

insertButton.addEventListener('click', () => {
  if (selectedSlot === null || gameLocked) return;
  send({ type: 'insert-slot', slotIndex: selectedSlot });
  insertButton.disabled = true;
  navigator.vibrate?.([35, 25, 70]);
});

window.addEventListener('beforeunload', () => peer?.destroy());
