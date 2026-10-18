import {
  applyMove,
  autoStep,
  createGame,
  endGame,
  moveToString,
  parseMove,
  variantById,
  type GameEndReason,
  type GameState,
} from '@pb/engine';
import {
  createClock,
  pauseClock,
  remainingFor,
  resumeClock,
  snapshotFromState,
  switchClock,
  type ClockConfig,
  type ClockState,
  type GameClient,
  type GameCommand,
  type GameEvent,
  type GameSnapshot,
  type PlayerInfo,
  type SeatIndex,
  type Unsubscribe,
} from '@pb/protocol';
import type { Agent } from './agent';

export interface LocalGameOptions {
  gameId?: string;
  variantId?: string;
  /** Seats the person at this device controls. Hotseat passes every seat. */
  seats: readonly SeatIndex[];
  players: readonly (PlayerInfo | null)[];
  /** Seats played automatically, keyed by seat index. */
  agents?: Readonly<Record<number, Agent>>;
  clockConfig?: ClockConfig | null;
  now?: () => number;
}

let gameCounter = 0;

/**
 * Runs a game inside the current tab.
 *
 * It is the authority for local play in exactly the way a server will be for
 * online play: it owns the state, validates every command, and publishes
 * snapshots. The UI therefore cannot tell the two apart.
 */
export class LocalGameClient implements GameClient {
  readonly gameId: string;
  readonly seats: readonly SeatIndex[];

  #state: GameState;
  #moves: string[] = [];
  #players: readonly (PlayerInfo | null)[];
  #agents: Readonly<Record<number, Agent>>;
  #clockConfig: ClockConfig | null;
  #clock: ClockState | null;
  #listeners = new Set<(event: GameEvent) => void>();
  #now: () => number;
  #flagTimer: ReturnType<typeof setTimeout> | null = null;
  #agentRun: AbortController | null = null;
  #disposed = false;
  #paused = false;

  constructor(options: LocalGameOptions) {
    const variant = variantById(options.variantId ?? 'classic');

    this.gameId = options.gameId ?? `local-${++gameCounter}`;
    this.seats = [...options.seats];
    this.#state = createGame(variant);
    this.#players = options.players;
    this.#agents = options.agents ?? {};
    this.#clockConfig = options.clockConfig ?? null;
    this.#now = options.now ?? (() => Date.now());
    this.#clock = this.#clockConfig
      ? switchClock(
          createClock(this.#clockConfig, variant.playerCount, this.#now()),
          this.#clockConfig,
          null,
          0,
          this.#now(),
        )
      : null;
  }

  /**
   * Replace who is sitting in each seat.
   *
   * Online, players arrive and leave while the game exists, so occupancy is
   * not something the constructor can know.
   */
  setPlayers(players: readonly (PlayerInfo | null)[]): void {
    this.#players = players;
    this.#emit({ type: 'snapshot', snapshot: this.getSnapshot() });
  }

  getSnapshot(): GameSnapshot {
    return snapshotFromState(this.#state, {
      gameId: this.gameId,
      moves: this.#moves,
      players: this.#players,
      clockConfig: this.#clockConfig,
      clock: this.#clock,
    });
  }

  subscribe(listener: (event: GameEvent) => void): Unsubscribe {
    // A client is live exactly while something is watching it. React runs
    // effect cleanups speculatively in development, so a disposed client must
    // come back when the real subscription arrives rather than stay dead.
    this.#disposed = false;
    this.#listeners.add(listener);
    // New subscribers get the position immediately, so a component mounting
    // mid-game renders without waiting for the next move.
    listener({ type: 'snapshot', snapshot: this.getSnapshot() });
    this.#armFlagTimer();
    this.#scheduleAgentTurn();
    return () => this.#listeners.delete(listener);
  }

  send(command: GameCommand): void {
    if (this.#disposed) return;

    switch (command.type) {
      case 'move':
        this.#handleMove(command.move, this.#state.turn, true);
        break;
      case 'resign': {
        const quitter = command.seat ?? this.#state.turn;
        this.#finish(this.#opponentOf(quitter), 'resign');
        break;
      }
      case 'accept-draw':
        this.#finish(null, 'agreement');
        break;
      case 'offer-draw':
        this.#emit({ type: 'draw-offer', from: this.#state.turn });
        break;
      case 'decline-draw':
        break;
      case 'request-snapshot':
        this.#emit({ type: 'snapshot', snapshot: this.getSnapshot() });
        break;
      case 'rematch':
        this.#restart();
        break;
      case 'pause':
        this.#pause();
        break;
      case 'resume':
        this.#resume();
        break;
      default:
        this.#emit({ type: 'error', code: 'unsupported', message: 'unknown command' });
    }
  }

  /** Release timers and any running agent. A later `subscribe` revives it. */
  dispose(): void {
    this.#disposed = true;
    this.#listeners.clear();
    this.#cancelAgent();
    this.#clearFlagTimer();
  }

  // --- internals -----------------------------------------------------------

  #handleMove(text: string, seat: SeatIndex, enforceSeat: boolean, auto = false): void {
    if (this.#paused) return;
    if (this.#state.result) {
      this.#emit({ type: 'error', code: 'game-over', message: 'the game is already over' });
      return;
    }
    if (enforceSeat && !this.seats.includes(seat)) {
      this.#emit({ type: 'error', code: 'not-your-seat', message: 'you do not play that seat' });
      return;
    }

    let move;
    try {
      move = parseMove(text);
    } catch {
      this.#emit({ type: 'error', code: 'illegal-move', message: `cannot read move ${text}` });
      return;
    }

    const applied = applyMove(this.#state, move);
    if (!applied.ok) {
      this.#emit({ type: 'error', code: 'illegal-move', message: applied.reason });
      return;
    }

    const mover = this.#state.turn;
    this.#state = applied.state;
    this.#moves.push(moveToString(move));
    this.#advanceClock(mover);

    this.#emit({
      type: 'move',
      snapshot: this.getSnapshot(),
      move: moveToString(move),
      by: mover,
      auto,
    });

    if (this.#state.result) {
      this.#clock = this.#clock ? pauseClock(this.#clock, this.#now()) : null;
      this.#clearFlagTimer();
      this.#emit({ type: 'game-over', snapshot: this.getSnapshot() });
      return;
    }

    this.#scheduleAgentTurn();
  }

  /**
   * Hold the game still — for a cutscene, and later for anything else that
   * has to interrupt play.
   *
   * The clock stops and any thinking bot is called off, so a pause cannot cost
   * the player their turn or let the computer move behind the interruption.
   */
  #pause(): void {
    if (this.#paused || this.#state.result) return;
    this.#paused = true;
    this.#clearFlagTimer();
    this.#cancelAgent();

    if (this.#clock) {
      this.#clock = pauseClock(this.#clock, this.#now());
      this.#emit({ type: 'clock', clock: this.#clock });
    }
  }

  #resume(): void {
    if (!this.#paused) return;
    this.#paused = false;

    if (this.#clock && !this.#state.result) {
      this.#clock = resumeClock(this.#clock, this.#state.turn, this.#now());
      this.#emit({ type: 'clock', clock: this.#clock });
    }

    this.#armFlagTimer();
    this.#scheduleAgentTurn();
  }

  #advanceClock(mover: SeatIndex): void {
    if (!this.#clock || !this.#clockConfig) return;

    const next = this.#state.result ? null : this.#state.turn;
    this.#clock = switchClock(this.#clock, this.#clockConfig, mover, next, this.#now());
    this.#emit({ type: 'clock', clock: this.#clock });
    this.#armFlagTimer();
  }

  /**
   * Wake up exactly when the running seat would run out, rather than polling.
   * The UI still renders a smooth countdown by extrapolating from
   * `ClockState.asOf`.
   */
  #armFlagTimer(): void {
    this.#clearFlagTimer();
    const clock = this.#clock;
    if (!clock || clock.runningSeat === null || this.#state.result || this.#paused) return;

    const seat = clock.runningSeat;
    const left = remainingFor(clock, seat, this.#now());
    this.#flagTimer = setTimeout(() => this.#onFlag(seat), Math.max(0, left));
  }

  /**
   * What happens when the clock runs out.
   *
   * A chess clock loses the game. A per-move timer does not: the engine walks
   * the pawn one square along its own shortest route, the same way this game's
   * four-player rules handle a missed turn. Losing a whole game to a ten-second
   * lapse would make the timer a punishment rather than a pace.
   */
  #onFlag(seat: SeatIndex): void {
    if (this.#state.result || this.#state.turn !== seat) return;

    if (this.#clockConfig === null || this.#clockConfig.perMoveMs === null) {
      this.#finish(this.#opponentOf(seat), 'timeout');
      return;
    }

    const move = autoStep(this.#state, seat);
    if (!move) {
      this.#finish(this.#opponentOf(seat), 'timeout');
      return;
    }
    this.#handleMove(moveToString(move), seat, false, true);
  }

  #clearFlagTimer(): void {
    if (this.#flagTimer !== null) {
      clearTimeout(this.#flagTimer);
      this.#flagTimer = null;
    }
  }

  /** Only meaningful in a two-player game; four-player uses elimination. */
  #opponentOf(seat: SeatIndex): SeatIndex | null {
    return this.#state.variant.playerCount === 2 ? (seat + 1) % 2 : null;
  }

  #finish(winner: SeatIndex | null, reason: GameEndReason): void {
    if (this.#state.result) return;
    this.#state = endGame(this.#state, winner, reason);
    this.#clock = this.#clock ? pauseClock(this.#clock, this.#now()) : null;
    this.#cancelAgent();
    this.#clearFlagTimer();
    this.#emit({ type: 'game-over', snapshot: this.getSnapshot() });
  }

  #restart(): void {
    this.#cancelAgent();
    this.#clearFlagTimer();
    this.#state = createGame(this.#state.variant);
    this.#moves = [];
    this.#clock =
      this.#clockConfig === null
        ? null
        : switchClock(
            createClock(this.#clockConfig, this.#state.variant.playerCount, this.#now()),
            this.#clockConfig,
            null,
            0,
            this.#now(),
          );
    this.#emit({ type: 'snapshot', snapshot: this.getSnapshot() });
    this.#armFlagTimer();
    this.#scheduleAgentTurn();
  }

  /**
   * Hand the turn to a bot when one owns the seat.
   *
   * The abort controller matters: a resignation or rematch while the bot is
   * still thinking must not let a stale answer land on the new position.
   */
  #scheduleAgentTurn(): void {
    if (this.#disposed || this.#paused || this.#state.result || this.#agentRun) return;

    const seat = this.#state.turn;
    const agent = this.#agents[seat];
    if (!agent) return;

    const run = new AbortController();
    this.#agentRun = run;

    void agent
      .chooseMove(this.getSnapshot(), run.signal)
      .then((move) => {
        if (run.signal.aborted || this.#disposed) return;
        this.#agentRun = null;
        if (this.#state.turn === seat && !this.#state.result) {
          this.#handleMove(move, seat, false);
        }
      })
      .catch(() => {
        if (this.#agentRun === run) this.#agentRun = null;
      });
  }

  #cancelAgent(): void {
    this.#agentRun?.abort();
    this.#agentRun = null;
  }

  #emit(event: GameEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}
