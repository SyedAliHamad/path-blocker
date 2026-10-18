import { CLASSIC, createGame } from '@pb/engine';
import { snapshotFromState } from '@pb/protocol';
import type {
  ClientMessage,
  GameClient,
  GameCommand,
  GameEvent,
  GameSnapshot,
  SeatIndex,
  ServerMessage,
  Unsubscribe,
} from '@pb/protocol';

export interface SocketGameOptions {
  readonly url: string;
  readonly gameId: string;
  /** Stable per-browser id, so a refresh returns you to your own seat. */
  readonly playerId: string;
  readonly name?: string;
}

const PING_EVERY = 25_000;
const BACKOFF_START = 500;
const BACKOFF_MAX = 8_000;

/**
 * A game running on the server, behind the same interface as a local one.
 *
 * It holds no rules and decides nothing: every move goes to the server and the
 * board only changes when the server says so. That is the whole point of the
 * split — the client cannot cheat by construction, because it has no authority
 * to misuse.
 */
export class SocketGameClient implements GameClient {
  readonly gameId: string;

  #seats: SeatIndex[] = [];
  #snapshot: GameSnapshot;
  #listeners = new Set<(event: GameEvent) => void>();
  #socket: WebSocket | null = null;
  #options: SocketGameOptions;
  #backoff = BACKOFF_START;
  #reconnect: ReturnType<typeof setTimeout> | null = null;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #disposed = false;

  constructor(options: SocketGameOptions) {
    this.#options = options;
    this.gameId = options.gameId;

    // An empty board to render while the socket is still opening. A client
    // always has a snapshot — callers read one as they mount, long before any
    // server can have answered — so "nothing yet" has to look like a game
    // waiting to start rather than an error.
    this.#snapshot = snapshotFromState(createGame(CLASSIC), {
      gameId: options.gameId,
      moves: [],
      players: [null, null],
      status: 'waiting',
    });

    this.#connect();
  }

  /** Empty until the server says which seat we got; empty means spectating. */
  get seats(): readonly SeatIndex[] {
    return this.#seats;
  }

  getSnapshot(): GameSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: (event: GameEvent) => void): Unsubscribe {
    this.#disposed = false;
    this.#listeners.add(listener);
    listener({ type: 'snapshot', snapshot: this.#snapshot });
    if (!this.#socket) this.#connect();
    return () => this.#listeners.delete(listener);
  }

  send(command: GameCommand): void {
    const socket = this.#socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.#emit({
        type: 'error',
        code: 'not-connected',
        message: 'still reconnecting — that move was not sent',
      });
      return;
    }
    this.#post({ type: 'command', command });
  }

  dispose(): void {
    this.#disposed = true;
    this.#listeners.clear();
    this.#clearTimers();
    this.#socket?.close();
    this.#socket = null;
  }

  // --- internals -----------------------------------------------------------

  #connect(): void {
    if (this.#disposed) return;

    const socket = new WebSocket(this.#options.url);
    this.#socket = socket;

    socket.addEventListener('open', () => {
      this.#backoff = BACKOFF_START;
      this.#post({
        type: 'join',
        gameId: this.#options.gameId,
        playerId: this.#options.playerId,
        ...(this.#options.name === undefined ? {} : { name: this.#options.name }),
      });

      this.#heartbeat = setInterval(() => this.#post({ type: 'ping' }), PING_EVERY);
    });

    socket.addEventListener('message', (raw) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(raw.data)) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === 'joined') {
        this.#seats = message.seat === null ? [] : [message.seat];
        this.#snapshot = message.snapshot;
        this.#emit({ type: 'snapshot', snapshot: message.snapshot });
        return;
      }

      if (message.type === 'event') {
        const { event } = message;
        if ('snapshot' in event) this.#snapshot = event.snapshot;
        this.#emit(event);
      }
    });

    socket.addEventListener('close', () => {
      this.#clearTimers();
      if (this.#disposed) return;

      this.#emit({
        type: 'error',
        code: 'not-connected',
        message: 'connection lost — reconnecting',
      });
      this.#scheduleReconnect();
    });

    // A failed connection also fires `close`, so recovery lives there alone.
    socket.addEventListener('error', () => socket.close());
  }

  /**
   * Back off before retrying, so a server restart does not get hammered by
   * every client that was connected to it.
   */
  #scheduleReconnect(): void {
    if (this.#reconnect) clearTimeout(this.#reconnect);
    const wait = this.#backoff;
    this.#backoff = Math.min(BACKOFF_MAX, this.#backoff * 2);

    this.#reconnect = setTimeout(() => {
      this.#reconnect = null;
      this.#connect();
    }, wait);
  }

  #clearTimers(): void {
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
  }

  #post(message: ClientMessage): void {
    this.#socket?.send(JSON.stringify(message));
  }

  #emit(event: GameEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}
