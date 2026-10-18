import { MOMENT_IDS } from './types';
import type { MomentId, MomentRole } from './types';

/**
 * One piece of media.
 *
 * URLs rather than uploads: the library holds links to Giphy, Tenor or any
 * audio file, so there is nothing to host and the whole library is a small
 * JSON document you can export, edit and share.
 */
export interface MediaAsset {
  readonly id: string;
  readonly label: string;
  readonly gifUrl: string | null;
  readonly soundUrl: string | null;
  /** Relative likelihood within its category. */
  readonly weight: number;
}

/** A themed bundle of assets inside one scenario, e.g. "Anime" or "Classics". */
export interface MediaCategory {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly weight: number;
  readonly assets: readonly MediaAsset[];
}

export interface ScenarioMedia {
  readonly actor: readonly MediaCategory[];
  readonly target: readonly MediaCategory[];
}

export interface LibrarySettings {
  readonly muted: boolean;
  /** 0 to 1, applied to reaction sounds. */
  readonly volume: number;
  /** 0 to 1, applied to the background music. */
  readonly musicVolume: number;
  /** Reactions are dropped once this many have fired in one game. */
  readonly maxPerGame: number;
  /** Minimum gap between any two reactions. */
  readonly cooldownMs: number;
  /** Minimum gap between two firings of the same scenario. */
  readonly perScenarioCooldownMs: number;
  /** How long a corner reaction stays on screen. */
  readonly displayMs: number;
  /**
   * Longest a reaction sound may run before it is faded.
   *
   * Separate from `displayMs` on purpose: clip lengths are all over the place
   * — a ding is under a second, a slow clap fifteen — and tying the sound to
   * the gif meant a four-second victory fanfare was cut off halfway.
   */
  readonly maxSoundMs: number;
  /** How long the board stays paused and zoomed in for a big moment. */
  readonly cinematicMs: number;
}

export interface MediaLibrary {
  readonly version: number;
  /** Plays from the first click of a game; one is chosen at random. */
  readonly music: readonly MediaAsset[];
  readonly scenarios: Readonly<Record<MomentId, ScenarioMedia>>;
  readonly settings: LibrarySettings;
}

export const LIBRARY_VERSION = 1;

export const DEFAULT_SETTINGS: LibrarySettings = {
  muted: false,
  volume: 0.7,
  musicVolume: 0.35,
  // Loose on purpose: most moves that mean something should get a sound.
  // Measured against real play, `perScenarioCooldownMs` is the setting that
  // decides the rate — walls come in runs, so the same scenario fires again and
  // again — and a long gap there silences most of the game. Variety is handled
  // by never repeating a clip back to back instead, which is the thing that
  // actually grates.
  maxPerGame: 60,
  cooldownMs: 600,
  perScenarioCooldownMs: 1_200,
  displayMs: 2_600,
  maxSoundMs: 6_000,
  cinematicMs: 4_200,
};

/** A library with every scenario present and nothing in it yet. */
export function emptyLibrary(): MediaLibrary {
  const scenarios = {} as Record<MomentId, ScenarioMedia>;
  for (const id of MOMENT_IDS) scenarios[id] = { actor: [], target: [] };

  return {
    version: LIBRARY_VERSION,
    music: [],
    scenarios,
    settings: DEFAULT_SETTINGS,
  };
}

function weightedPick<T extends { weight: number }>(
  items: readonly T[],
  random: () => number,
): T | null {
  const usable = items.filter((item) => item.weight > 0);
  if (usable.length === 0) return null;

  const total = usable.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of usable) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return usable.at(-1) ?? null;
}

/**
 * Choose what to play for a scenario: a category first, then an asset inside
 * it, both by weight. Two steps rather than one flat pool so that a category
 * with fifty gifs does not drown out one with three.
 *
 * `avoidId` is the asset this scenario played last time. Hearing the same clip
 * twice in a row is what actually makes a reaction system feel cheap — far
 * more than hearing one often — so it is skipped whenever there is anything
 * else to play.
 */
export function pickAsset(
  library: MediaLibrary,
  moment: MomentId,
  role: MomentRole,
  random: () => number = Math.random,
  avoidId?: string,
): MediaAsset | null {
  const scenario = library.scenarios[moment];
  if (!scenario) return null;

  const categories = scenario[role].filter((category) => category.enabled);
  const category = weightedPick(categories, random);
  if (!category) return null;

  const fresh = category.assets.filter((asset) => asset.id !== avoidId);
  return weightedPick(fresh.length > 0 ? fresh : category.assets, random);
}

export function pickMusic(
  library: MediaLibrary,
  random: () => number = Math.random,
): MediaAsset | null {
  return weightedPick(library.music, random);
}

/**
 * Read a library back from JSON, tolerating anything missing.
 *
 * Imports come from a file somebody edited by hand, and scenarios get added to
 * the catalogue over time, so a strict parse would reject libraries that are
 * merely older. Unknown scenarios are dropped; missing ones come back empty.
 */
export function parseLibrary(input: unknown): MediaLibrary {
  const base = emptyLibrary();
  if (typeof input !== 'object' || input === null) return base;

  const raw = input as Partial<MediaLibrary>;
  const scenarios = {} as Record<MomentId, ScenarioMedia>;

  for (const id of MOMENT_IDS) {
    const found = raw.scenarios?.[id];
    scenarios[id] = {
      actor: Array.isArray(found?.actor) ? found.actor : [],
      target: Array.isArray(found?.target) ? found.target : [],
    };
  }

  return {
    version: LIBRARY_VERSION,
    music: Array.isArray(raw.music) ? raw.music : [],
    scenarios,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
  };
}

export interface LibraryStats {
  readonly categories: number;
  readonly assets: number;
  readonly scenariosCovered: number;
}

/** Totals for the admin panel's header. */
export function libraryStats(library: MediaLibrary): LibraryStats {
  let categories = 0;
  let assets = 0;
  let scenariosCovered = 0;

  for (const id of MOMENT_IDS) {
    const scenario = library.scenarios[id];
    const all = [...scenario.actor, ...scenario.target];
    const count = all.reduce((sum, category) => sum + category.assets.length, 0);

    categories += all.length;
    assets += count;
    if (count > 0) scenariosCovered += 1;
  }

  return { categories, assets, scenariosCovered };
}
