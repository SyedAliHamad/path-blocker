export interface Waiting {
  readonly playerId: string;
  readonly name: string | undefined;
  readonly send: (message: unknown) => void;
}

/** Called once two players are paired; returns the room they should go to. */
export type PairUp = (first: Waiting, second: Waiting) => string;

/**
 * The queue of players waiting for a random opponent.
 *
 * Kept apart from the socket layer so it can be tested without a network: the
 * failure modes here are all about bookkeeping — a stale entry matched against
 * nobody, a player paired with themselves, a disconnect deleting the wrong
 * row — and every one of them strands somebody in a search that never ends.
 */
export class Matchmaker {
  #queue: Waiting[] = [];
  #pair: PairUp;

  constructor(pair: PairUp) {
    this.#pair = pair;
  }

  get size(): number {
    return this.#queue.length;
  }

  get waiting(): readonly Waiting[] {
    return this.#queue;
  }

  /**
   * Add a player, pairing them immediately if anyone else is waiting.
   *
   * Two tabs belonging to the same person must not be matched together, so a
   * second entry replaces the first rather than becoming its opponent.
   */
  enter(entry: Waiting): void {
    this.#dropPlayer(entry.playerId);

    const opponent = this.#queue.find((waiting) => waiting.playerId !== entry.playerId);
    if (!opponent) {
      this.#queue.push(entry);
      entry.send({ type: 'queued', waiting: this.#queue.length });
      return;
    }

    this.drop(opponent);

    const gameId = this.#pair(opponent, entry);
    opponent.send({ type: 'matched', gameId, seat: 0 });
    entry.send({ type: 'matched', gameId, seat: 1 });
  }

  /**
   * Remove one specific entry, by identity rather than by player id.
   *
   * A reconnecting client queues again before its old socket finishes closing.
   * Removing by id would let the dying socket delete the live entry, leaving
   * somebody waiting forever for a match that can no longer reach them.
   */
  drop(entry: Waiting): void {
    const at = this.#queue.indexOf(entry);
    if (at !== -1) this.#queue.splice(at, 1);
  }

  #dropPlayer(playerId: string): void {
    for (let i = this.#queue.length - 1; i >= 0; i--) {
      if (this.#queue[i]!.playerId === playerId) this.#queue.splice(i, 1);
    }
  }
}
