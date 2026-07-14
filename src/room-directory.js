import { Peer } from 'peerjs';

const DIRECTORY_PEER_ID = 'krakens-barrel-directory-v1';
const ROOM_TTL = 30000;
const HEARTBEAT_INTERVAL = 7000;
const RECONNECT_DELAY = 450;
const MODES = new Set(['classic', 'double', 'speed', 'reverse']);
const CONTAINERS = new Set(['wood', 'drum', 'powder']);
const TARGET_SCORES = new Set([1, 3, 5]);

function normalizeRoom(room) {
  const roomCode = String(room?.roomCode ?? '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 6);
  if (roomCode.length !== 6) return null;

  const capacity = Math.min(6, Math.max(2, Number(room.capacity) || 4));
  return {
    roomCode,
    title: String(room.title ?? '').trim().replace(/\s+/g, ' ').slice(0, 24) || `${roomCode} 선단`,
    capacity,
    playerCount: Math.min(capacity, Math.max(0, Number(room.playerCount) || 0)),
    mode: MODES.has(room.mode) ? room.mode : 'classic',
    targetScore: TARGET_SCORES.has(Number(room.targetScore)) ? Number(room.targetScore) : 3,
    container: CONTAINERS.has(room.container) ? room.container : 'wood',
    started: Boolean(room.started),
  };
}

function publicRoom(room) {
  const { ownerPeer: _ownerPeer, lastSeen: _lastSeen, ...summary } = room;
  return summary;
}

export class RoomDirectory extends EventTarget {
  constructor() {
    super();
    this.peer = null;
    this.connection = null;
    this.connections = new Set();
    this.rooms = new Map();
    this.ownRoom = null;
    this.previousOwnRoomCode = '';
    this.heartbeatTimer = 0;
    this.reconnectTimer = 0;
    this.generation = 0;
    this.started = false;
    this.isLeader = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.connectAsClient();
  }

  stop() {
    this.started = false;
    this.unregisterOwnRoom();
    this.cleanupTransport();
  }

  publish(room) {
    const normalized = normalizeRoom(room);
    if (!normalized) return;
    if (this.ownRoom?.roomCode && this.ownRoom.roomCode !== normalized.roomCode) {
      this.unregisterOwnRoom(this.ownRoom.roomCode);
    }
    this.ownRoom = normalized;
    this.previousOwnRoomCode = normalized.roomCode;
    this.sendRegistration();
  }

  clear(roomCode = this.ownRoom?.roomCode || this.previousOwnRoomCode) {
    this.unregisterOwnRoom(roomCode);
    this.ownRoom = null;
    this.previousOwnRoomCode = '';
  }

  refresh() {
    if (this.isLeader) {
      this.pruneRooms();
      this.emitRooms();
      return;
    }
    if (this.connection?.open) this.connection.send({ type: 'directory-list' });
  }

  setStatus(status) {
    this.dispatchEvent(new CustomEvent('status', { detail: status }));
  }

  cleanupTransport() {
    window.clearInterval(this.heartbeatTimer);
    window.clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = 0;
    this.reconnectTimer = 0;
    this.connections.forEach((connection) => connection.close());
    this.connections.clear();
    this.connection?.close();
    this.connection = null;
    this.peer?.destroy();
    this.peer = null;
    this.isLeader = false;
  }

  scheduleReconnect() {
    if (!this.started || this.reconnectTimer) return;
    this.cleanupTransport();
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = 0;
      this.connectAsClient();
    }, RECONNECT_DELAY + Math.random() * 500);
  }

  connectAsClient() {
    if (!this.started) return;
    const generation = ++this.generation;
    this.cleanupTransport();
    this.setStatus('connecting');
    const peer = new Peer(undefined, { debug: 0 });
    this.peer = peer;
    let directoryConnected = false;

    const tryLeadership = () => {
      if (!this.started || generation !== this.generation || directoryConnected) return;
      this.becomeLeader();
    };

    peer.on('open', () => {
      if (!this.started || generation !== this.generation) return;
      const connection = peer.connect(DIRECTORY_PEER_ID, {
        reliable: true,
        metadata: { role: 'directory-client' },
      });
      this.connection = connection;
      const connectTimeout = window.setTimeout(tryLeadership, 1800);

      connection.on('open', () => {
        if (generation !== this.generation) return;
        directoryConnected = true;
        window.clearTimeout(connectTimeout);
        this.setStatus('online');
        connection.send({ type: 'directory-list' });
        this.sendRegistration();
        this.startHeartbeat();
      });
      connection.on('data', (message) => this.handleDirectoryMessage(message));
      connection.on('close', () => {
        if (directoryConnected) this.scheduleReconnect();
      });
      connection.on('error', tryLeadership);
    });

    peer.on('error', (error) => {
      if (generation !== this.generation) return;
      if (error.type === 'peer-unavailable' && !directoryConnected) {
        tryLeadership();
        return;
      }
      this.scheduleReconnect();
    });
    peer.on('disconnected', () => {
      if (directoryConnected) this.scheduleReconnect();
    });
  }

  becomeLeader() {
    if (!this.started) return;
    const generation = ++this.generation;
    this.cleanupTransport();
    this.setStatus('electing');
    const peer = new Peer(DIRECTORY_PEER_ID, { debug: 0 });
    this.peer = peer;

    peer.on('open', () => {
      if (!this.started || generation !== this.generation) return;
      this.isLeader = true;
      this.setStatus('online');
      this.sendRegistration();
      this.emitRooms();
      this.startHeartbeat();
    });
    peer.on('connection', (connection) => this.acceptDirectoryConnection(connection));
    peer.on('error', (error) => {
      if (generation !== this.generation) return;
      if (error.type === 'unavailable-id') {
        this.scheduleReconnect();
        return;
      }
      this.scheduleReconnect();
    });
    peer.on('disconnected', () => this.scheduleReconnect());
  }

  acceptDirectoryConnection(connection) {
    this.connections.add(connection);
    connection.on('open', () => this.sendRoomState(connection));
    connection.on('data', (message) => this.handleLeaderMessage(message, connection));
    connection.on('close', () => {
      this.connections.delete(connection);
      let changed = false;
      this.rooms.forEach((room, roomCode) => {
        if (room.ownerPeer !== connection.peer) return;
        this.rooms.delete(roomCode);
        changed = true;
      });
      if (changed) this.broadcastRooms();
    });
  }

  handleLeaderMessage(message, connection) {
    if (!message?.type) return;
    if (message.type === 'directory-register') {
      const room = normalizeRoom(message.room);
      if (!room) return;
      this.rooms.set(room.roomCode, {
        ...room,
        ownerPeer: connection.peer,
        lastSeen: Date.now(),
      });
      this.broadcastRooms();
      return;
    }
    if (message.type === 'directory-unregister') {
      const roomCode = String(message.roomCode ?? '').toUpperCase();
      const room = this.rooms.get(roomCode);
      if (room?.ownerPeer === connection.peer) {
        this.rooms.delete(roomCode);
        this.broadcastRooms();
      }
      return;
    }
    if (message.type === 'directory-list') this.sendRoomState(connection);
  }

  handleDirectoryMessage(message) {
    if (message?.type !== 'directory-state' || !Array.isArray(message.rooms)) return;
    const rooms = message.rooms.map(normalizeRoom).filter(Boolean);
    this.dispatchEvent(new CustomEvent('rooms', { detail: rooms }));
  }

  startHeartbeat() {
    window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      if (this.isLeader) {
        this.pruneRooms();
        this.sendRegistration();
        this.broadcastRooms();
        return;
      }
      this.sendRegistration();
      this.refresh();
    }, HEARTBEAT_INTERVAL);
  }

  sendRegistration() {
    if (!this.ownRoom) return;
    if (this.isLeader) {
      this.rooms.set(this.ownRoom.roomCode, {
        ...this.ownRoom,
        ownerPeer: DIRECTORY_PEER_ID,
        lastSeen: Date.now(),
      });
      this.broadcastRooms();
      return;
    }
    if (this.connection?.open) {
      this.connection.send({ type: 'directory-register', room: this.ownRoom });
    }
  }

  unregisterOwnRoom(roomCode = this.previousOwnRoomCode) {
    if (!roomCode) return;
    if (this.isLeader) {
      const room = this.rooms.get(roomCode);
      if (room?.ownerPeer === DIRECTORY_PEER_ID) {
        this.rooms.delete(roomCode);
        this.broadcastRooms();
      }
      return;
    }
    if (this.connection?.open) {
      this.connection.send({ type: 'directory-unregister', roomCode });
    }
  }

  pruneRooms() {
    const cutoff = Date.now() - ROOM_TTL;
    this.rooms.forEach((room, roomCode) => {
      if (room.lastSeen < cutoff) this.rooms.delete(roomCode);
    });
  }

  roomList() {
    return [...this.rooms.values()]
      .sort((a, b) => Number(a.started) - Number(b.started)
        || (b.capacity - b.playerCount) - (a.capacity - a.playerCount)
        || b.lastSeen - a.lastSeen)
      .map(publicRoom);
  }

  sendRoomState(connection) {
    if (connection?.open) connection.send({ type: 'directory-state', rooms: this.roomList() });
  }

  emitRooms() {
    this.dispatchEvent(new CustomEvent('rooms', { detail: this.roomList() }));
  }

  broadcastRooms() {
    if (!this.isLeader) return;
    this.pruneRooms();
    const message = { type: 'directory-state', rooms: this.roomList() };
    this.connections.forEach((connection) => {
      if (connection.open) connection.send(message);
    });
    this.emitRooms();
  }
}
