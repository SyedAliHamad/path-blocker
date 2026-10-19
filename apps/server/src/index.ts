import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { isValidGameId, makeGameId, type ClientMessage, type ClockConfig } from '@pb/protocol';
import { EMPTY_ROOM_TTL_MS, Room, type Member } from './room';
import { Matchmaker, type Waiting } from './matchmaker';

const PORT = Number(process.env.PORT ?? 8787);

/**
 * Origins allowed to open a socket.
 *
 * Browsers do not apply CORS to WebSockets, so without this check any site
 * could open connections against this server using a visitor's browser.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const TEN_SECOND_TURNS: ClockConfig = {
  initialMs: 10_000,
  incrementMs: 0,
  perMoveMs: 10_000,
};

const rooms = new Map<string, Room>();

function roomFor(id: string): Room {
  let room = rooms.get(id);
  if (!room) {
    room = new Room(id, TEN_SECOND_TURNS);
    rooms.set(id, room);
  }
  return room;
}

/**
 * Pairing players who asked for a random opponent.
 *
 * Seats are reserved at match time rather than on arrival, so both players
 * keep the seats they were given even though neither has connected to the room
 * yet — and nobody who guesses the room id can take one.
 */
const matchmaker = new Matchmaker((first, second) => {
  let gameId = makeGameId();
  while (rooms.has(gameId)) gameId = makeGameId();

  const room = roomFor(gameId);
  room.reserve(first.playerId, 0);
  room.reserve(second.playerId, 1);
  return gameId;
});

function originAllowed(origin: string | undefined): boolean {
  // An empty allow-list means "anything", which is what local development
  // wants; production sets ALLOWED_ORIGINS.
  if (ALLOWED_ORIGINS.length === 0) return true;
  return origin !== undefined && ALLOWED_ORIGINS.includes(origin);
}

const http = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const sockets = new WebSocketServer({ server: http });

sockets.on('connection', (socket: WebSocket, request) => {
  if (!originAllowed(request.headers.origin)) {
    socket.close(1008, 'origin not allowed');
    return;
  }

  let room: Room | null = null;
  let member: Member | null = null;
  let queued: Waiting | null = null;

  const send = (message: unknown): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };

  socket.on('message', (raw) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(String(raw)) as ClientMessage;
    } catch {
      return;
    }

    if (message.type === 'ping') {
      send({ type: 'pong' });
      return;
    }

    if (message.type === 'queue') {
      if (typeof message.playerId !== 'string') {
        socket.close(1008, 'bad queue request');
        return;
      }
      const entry: Waiting = { playerId: message.playerId, name: message.name, send };
      queued = entry;
      matchmaker.enter(entry);
      return;
    }

    if (message.type === 'cancel-queue') {
      if (queued) matchmaker.drop(queued);
      queued = null;
      send({ type: 'queue-cancelled' });
      return;
    }

    if (message.type === 'join') {
      if (!isValidGameId(message.gameId) || typeof message.playerId !== 'string') {
        socket.close(1008, 'bad join');
        return;
      }
      if (room) return;

      room = roomFor(message.gameId);
      const seat = room.join({ playerId: message.playerId, send }, message.name);
      member = { playerId: message.playerId, seat, send };

      send({ type: 'joined', seat, snapshot: room.snapshot() });
      return;
    }

    if (message.type === 'command' && room && member) {
      const { command } = message;
      switch (command.type) {
        case 'move':
          room.move(member.seat, command.move);
          break;
        case 'resign':
          room.resign(member.seat);
          break;
        case 'rematch':
          room.rematch(member.seat);
          break;
        case 'request-snapshot':
          send({ type: 'event', event: { type: 'snapshot', snapshot: room.snapshot() } });
          break;
        default:
          // `pause` and `resume` are deliberately not forwarded: a client that
          // could pause would be able to freeze its opponent's clock forever.
          break;
      }
    }
  });

  socket.on('close', () => {
    // A dropped connection must not leave a ghost in the queue for the next
    // player to be matched against.
    if (queued) {
      matchmaker.drop(queued);
      queued = null;
    }
    if (room && member) {
      room.leave(member);
      room = null;
      member = null;
    }
  });
});

// Rooms live in memory, so abandoned ones have to be swept or the process
// grows without bound.
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.population === 0 && room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
      room.dispose();
      rooms.delete(id);
    }
  }
}, 60_000).unref();

http.listen(PORT, () => {
  console.log(`path-blocker game server listening on :${PORT}`);
});
