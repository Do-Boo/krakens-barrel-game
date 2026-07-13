const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const MAX_ROOM_PLAYERS = 6;
export const MIN_ROOM_PLAYERS = 2;

export function createRoomCode(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('');
}

export function normalizeRoomCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 6);
}

export function roomPeerId(roomCode) {
  return `krakens-barrel-${normalizeRoomCode(roomCode).toLowerCase()}`;
}

export function normalizePlayerName(value, fallback = '이름 없는 선원') {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 12);
  return name || fallback;
}

export function createClientId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `crew-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
