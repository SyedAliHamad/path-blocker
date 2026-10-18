import type { ClockConfig, ClockState, SeatIndex } from './types';

/**
 * Clock arithmetic, shared by client and server.
 *
 * The rule everywhere is the same: a `ClockState` is a reading taken at
 * `asOf`, and the running seat's time is whatever was left then, minus the
 * time elapsed since. Keeping that in one place is what stops the displayed
 * clock and the authoritative clock from disagreeing.
 */
export function createClock(config: ClockConfig, seats: number, now: number): ClockState {
  const start = config.perMoveMs ?? config.initialMs;
  return {
    remainingMs: Array.from({ length: seats }, () => start),
    runningSeat: null,
    asOf: now,
  };
}

/** Time left for `seat` right now, without mutating the clock. */
export function remainingFor(clock: ClockState, seat: SeatIndex, now: number): number {
  const base = clock.remainingMs[seat] ?? 0;
  if (clock.runningSeat !== seat) return base;
  return Math.max(0, base - (now - clock.asOf));
}

export function hasFlagged(clock: ClockState, seat: SeatIndex, now: number): boolean {
  return remainingFor(clock, seat, now) <= 0;
}

/** Settle the running seat's time without starting anyone else's. */
export function pauseClock(clock: ClockState, now: number): ClockState {
  if (clock.runningSeat === null) return { ...clock, asOf: now };
  const remainingMs = clock.remainingMs.slice();
  remainingMs[clock.runningSeat] = remainingFor(clock, clock.runningSeat, now);
  return { remainingMs, runningSeat: null, asOf: now };
}

/**
 * Start `seat`'s clock again after a pause, without touching anybody's
 * balance.
 *
 * Deliberately not `switchClock`: with a per-move timer that would hand the
 * player a fresh allowance, so every pause would top their clock back up.
 */
export function resumeClock(clock: ClockState, seat: SeatIndex, now: number): ClockState {
  return { ...clock, runningSeat: seat, asOf: now };
}

/**
 * Hand the clock to `nextSeat`: charge the mover for their think time, add the
 * increment, then start the next seat ticking.
 */
export function switchClock(
  clock: ClockState,
  config: ClockConfig,
  mover: SeatIndex | null,
  nextSeat: SeatIndex | null,
  now: number,
): ClockState {
  const remainingMs = clock.remainingMs.slice();

  if (mover !== null && clock.runningSeat === mover) {
    remainingMs[mover] = remainingFor(clock, mover, now) + config.incrementMs;
  }

  // A per-move timer gives the next player a fresh allowance rather than
  // carrying their own balance forward.
  if (config.perMoveMs !== null && nextSeat !== null) {
    remainingMs[nextSeat] = config.perMoveMs;
  }

  return { remainingMs, runningSeat: nextSeat, asOf: now };
}
