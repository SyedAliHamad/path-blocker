import { LocalGameClient } from '@pb/client';
import { parseMove, type GameState } from '@pb/engine';
import { detectMoments } from '@pb/moments';
import { stateFromSnapshot, type ClockConfig, type GameEvent, type GameSnapshot, type PlayerInfo, type SeatIndex } from '@pb/protocol';

/** How long the board holds still for a big moment, mirrored from the client. */
const CINEMATIC_MS = 4_200;

/** A room with nobody in it is swept up after this long. */
export const EMPTY_ROOM_TTL_MS = 10 * 60_000;

export interface Member {
  readonly playerId: string;
  readonly seat: SeatIndex | null;
  send(message: unknown): void;
}

/**
 * One online game.
 *
 * The authority is a `LocalGameClient` — the same object the single-device
 * game runs on. It already owns the rules, the clock, the flag timer, the
 * rematch and the auto-step on timeout, all of it tested, so the server adds
 * only what is genuinely new: who is allowed to act, and who to tell.
 */
export class Room {
  readonly id: string;

  #game: LocalGameClient;
  #members = new Set<Member>();
  #seats = new Map<string, SeatIndex>();
  #names = new Map<SeatIndex, string>();
  #previous: GameState | null = null;
  #cinematic: ReturnType<typeof setTimeout> | null = null;

  emptySince: number | null = Date.now();

  constructor(id: string, clockConfig: ClockConfig | null) {
    this.id = id;
    this.#game = new LocalGameClient({
      gameId: id,
      // The room holds both seats; the socket layer decides who may use them.
      seats: [0, 1],
      players: [null, null],
      clockConfig,
    });

    this.#game.subscribe((event) => this.#onEvent(event));
    this.#previous = stateFromSnapshot(this.#game.getSnapshot());

    // Held until both players are present. Otherwise the per-move timer starts
    // the moment the room is created and auto-steps both pawns down the board
    // while the first player is still waiting for the invite to be opened.
    this.#game.send({ type: 'pause' });
  }

  get population(): number {
    return this.#members.size;
  }

  snapshot(): GameSnapshot {
    return this.#game.getSnapshot();
  }

  /**
   * Seat a connection.
   *
   * Seats are remembered by `playerId`, so a refresh or a dropped connection
   * returns the player to their own seat instead of demoting them to a
   * spectator and leaving their game unplayable.
   */
  join(member: Omit<Member, 'seat'>, name: string | undefined): SeatIndex | null {
    this.emptySince = null;

    let seat = this.#seats.get(member.playerId) ?? null;
    if (seat === null) {
      const taken = new Set(this.#seats.values());
      if (!taken.has(0)) seat = 0;
      else if (!taken.has(1)) seat = 1;
      if (seat !== null) this.#seats.set(member.playerId, seat);
    }

    if (seat !== null && name) this.#names.set(seat, name);

    const seated: Member = { ...member, seat, send: member.send };
    this.#members.add(seated);
    this.#publishPlayers();
    this.#syncRunning();

    return seat;
  }

  leave(member: Member): void {
    this.#members.delete(member);
    if (this.#members.size === 0) this.emptySince = Date.now();
    this.#publishPlayers();
    this.#syncRunning();
  }

  memberFor(playerId: string): SeatIndex | null {
    return this.#seats.get(playerId) ?? null;
  }

  /** Apply a move on behalf of `seat`, if it is really their turn. */
  move(seat: SeatIndex | null, move: string): void {
    if (seat === null) return;
    const snapshot = this.#game.getSnapshot();
    if (snapshot.turn !== seat || snapshot.result) return;

    try {
      parseMove(move);
    } catch {
      return;
    }

    this.#game.send({ type: 'move', move });
  }

  resign(seat: SeatIndex | null): void {
    if (seat === null) return;
    this.#game.send({ type: 'resign', seat });
  }

  rematch(seat: SeatIndex | null): void {
    if (seat === null) return;
    this.#game.send({ type: 'rematch' });
  }

  dispose(): void {
    if (this.#cinematic) clearTimeout(this.#cinematic);
    this.#game.dispose();
    this.#members.clear();
  }

  // --- internals -----------------------------------------------------------

  #onEvent(event: GameEvent): void {
    if (event.type === 'move') {
      const after = stateFromSnapshot(event.snapshot);
      this.#runCinematic(after, event);
      this.#previous = after;
    } else if (event.type === 'snapshot' || event.type === 'game-over') {
      this.#previous = stateFromSnapshot(event.snapshot);
    }

    this.#broadcast({ type: 'event', event });
  }

  /**
   * Stop the clock for a big moment, exactly as the single-device game does.
   *
   * The server drives this, never the client: `pause` is a command, and a
   * client allowed to send it could freeze its opponent's clock indefinitely.
   */
  #runCinematic(after: GameState, event: Extract<GameEvent, { type: 'move' }>): void {
    const before = this.#previous;
    if (!before || after.result) return;

    const moments = detectMoments({
      before,
      after,
      move: parseMove(event.move),
      mover: event.by,
      auto: event.auto ?? false,
    });
    if (!moments.some((moment) => moment.scale === 'takeover')) return;

    this.#game.send({ type: 'pause' });
    if (this.#cinematic) clearTimeout(this.#cinematic);
    this.#cinematic = setTimeout(() => {
      this.#cinematic = null;
      this.#game.send({ type: 'resume' });
    }, CINEMATIC_MS);
  }

  /** Seats with somebody actually connected to them right now. */
  #connectedSeats(): Set<SeatIndex> {
    const seats = new Set<SeatIndex>();
    for (const member of this.#members) {
      if (member.seat !== null) seats.add(member.seat);
    }
    return seats;
  }

  /** Tell everyone which seats are occupied, so the UI can wait for a second player. */
  #publishPlayers(): void {
    const connected = this.#connectedSeats();
    this.#game.setPlayers([0, 1].map((seat) => (connected.has(seat) ? this.nameFor(seat) : null)));
  }

  /**
   * Run the clock only while both players are here.
   *
   * It also stops when somebody drops, so a disconnection cannot flag the
   * player who is still sitting there waiting for them to come back.
   */
  #syncRunning(): void {
    this.#game.send(this.#connectedSeats().size >= 2 ? { type: 'resume' } : { type: 'pause' });
  }

  #broadcast(message: unknown): void {
    for (const member of this.#members) member.send(message);
  }

  nameFor(seat: SeatIndex): PlayerInfo {
    return {
      id: `seat-${seat}`,
      name: this.#names.get(seat) ?? `Player ${seat + 1}`,
      rating: null,
      country: null,
      isBot: false,
      botLevel: null,
    };
  }
}
