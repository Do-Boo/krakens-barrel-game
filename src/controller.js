import { Peer } from 'peerjs';

const hostPeerId = new URLSearchParams(window.location.search).get('controller');
const statusLabel = document.querySelector('#controller-status');
const playerLabel = document.querySelector('#controller-player');
const tensionFill = document.querySelector('#controller-tension span');
const slotRoot = document.querySelector('#controller-slots');
const insertButton = document.querySelector('#controller-insert');
const weaponButtons = [...document.querySelectorAll('[data-remote-weapon]')];

let connection = null;
let selectedSlot = null;
let usedSlots = [];
let gameLocked = true;

function send(message) {
  if (connection?.open) connection.send(message);
}

function renderSlots() {
  slotRoot.replaceChildren();
  for (let index = 0; index < 16; index += 1) {
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

function applyState(state) {
  usedSlots = state.usedSlots ?? [];
  gameLocked = Boolean(state.gameOver || state.isAnimating);
  tensionFill.style.width = `${Math.round((state.tension ?? 0) * 100)}%`;
  playerLabel.textContent = state.currentPlayerName ?? '선장 대기 중';
  statusLabel.textContent = state.gameOver
    ? '라운드가 끝났습니다. 선장의 다음 명령을 기다리세요.'
    : '연결됨 · 구멍을 고르고 칼을 꽂으세요';
  if (selectedSlot !== null && usedSlots.includes(selectedSlot)) selectedSlot = null;
  insertButton.disabled = selectedSlot === null || gameLocked;
  renderSlots();
}

renderSlots();

weaponButtons.forEach((button) => {
  button.addEventListener('click', () => {
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

const peer = new Peer(undefined, { debug: 1 });

peer.on('open', () => {
  statusLabel.textContent = '게임 방에 접속하는 중…';
  connection = peer.connect(hostPeerId, { reliable: true, metadata: { role: 'controller' } });

  connection.on('open', () => {
    gameLocked = false;
    statusLabel.textContent = '연결됨 · 선장의 상태를 불러오는 중…';
    send({ type: 'controller-ready' });
  });

  connection.on('data', (message) => {
    if (message?.type === 'game-state') applyState(message.state);
    if (message?.type === 'impact') navigator.vibrate?.([45, 30, 90]);
    if (message?.type === 'fakeout') navigator.vibrate?.([80, 40, 80, 40, 130]);
    if (message?.type === 'kraken') navigator.vibrate?.([160, 70, 220]);
  });

  connection.on('close', () => {
    gameLocked = true;
    renderSlots();
    insertButton.disabled = true;
    statusLabel.textContent = '연결이 종료되었습니다. QR 코드를 다시 스캔해 주세요.';
  });
});

peer.on('error', (error) => {
  console.error(error);
  gameLocked = true;
  renderSlots();
  statusLabel.textContent = '연결에 실패했습니다. 게임 화면에서 새 QR 코드를 열어주세요.';
});
