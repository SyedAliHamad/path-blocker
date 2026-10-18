/** Tuning for one difficulty setting. */
export interface Level {
  readonly id: number;
  readonly name: string;
  /** Plies of lookahead. 1 is greedy. */
  readonly depth: number;
  /**
   * Probability of ignoring the search and playing a plausible-but-worse move.
   * This is what makes the easy bots beatable without crippling their search.
   */
  readonly blunderRate: number;
  /** Walls considered per position; the search only ever sees the best few. */
  readonly wallCandidates: number;
  /**
   * Skip walls entirely while this far ahead in the race. A low number keeps
   * easy bots passive; `Infinity` would mean never bothering with walls, so
   * the strongest level uses a value no lead can reach.
   */
  readonly wallThreshold: number;
  /** Rough think time, so moves do not land instantly. */
  readonly thinkMs: number;
}

export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: 'Beginner',
    depth: 1,
    blunderRate: 0.35,
    wallCandidates: 4,
    wallThreshold: 1,
    thinkMs: 350,
  },
  {
    id: 2,
    name: 'Casual',
    depth: 2,
    blunderRate: 0.15,
    wallCandidates: 8,
    wallThreshold: 3,
    thinkMs: 450,
  },
  {
    id: 3,
    name: 'Strong',
    depth: 3,
    blunderRate: 0.03,
    wallCandidates: 12,
    wallThreshold: 6,
    thinkMs: 550,
  },
  {
    id: 4,
    name: 'Expert',
    depth: 4,
    blunderRate: 0,
    wallCandidates: 16,
    wallThreshold: Number.POSITIVE_INFINITY,
    thinkMs: 700,
  },
];

export function levelById(id: number): Level {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[1]!;
}
