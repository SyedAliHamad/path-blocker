import { describe, expect, it } from 'vitest';
import { createClock, hasFlagged, pauseClock, remainingFor, switchClock } from '../src/index';
import type { ClockConfig } from '../src/index';

const CHESS: ClockConfig = { initialMs: 300_000, incrementMs: 3_000, perMoveMs: null };
const PER_MOVE: ClockConfig = { initialMs: 10_000, incrementMs: 0, perMoveMs: 10_000 };

describe('reading a clock', () => {
  it('counts down only for the seat that is running', () => {
    const clock = switchClock(createClock(CHESS, 2, 0), CHESS, null, 0, 0);
    expect(remainingFor(clock, 0, 2_000)).toBe(298_000);
    expect(remainingFor(clock, 1, 2_000)).toBe(300_000);
  });

  it('never reads below zero, and flags there', () => {
    const clock = switchClock(createClock(CHESS, 2, 0), CHESS, null, 0, 0);
    expect(remainingFor(clock, 0, 400_000)).toBe(0);
    expect(hasFlagged(clock, 0, 400_000)).toBe(true);
    expect(hasFlagged(clock, 1, 400_000)).toBe(false);
  });

  it('settles the running seat when paused', () => {
    const running = switchClock(createClock(CHESS, 2, 0), CHESS, null, 0, 0);
    const paused = pauseClock(running, 5_000);
    expect(paused.runningSeat).toBeNull();
    expect(remainingFor(paused, 0, 60_000)).toBe(295_000);
  });
});

describe('chess clock', () => {
  it('charges the mover for their think time and adds the increment', () => {
    const started = switchClock(createClock(CHESS, 2, 0), CHESS, null, 0, 0);
    const handed = switchClock(started, CHESS, 0, 1, 4_000);

    expect(handed.remainingMs[0]).toBe(299_000);
    expect(handed.runningSeat).toBe(1);
  });
});

describe('per-move timer', () => {
  it('starts everyone on the per-move allowance', () => {
    expect(createClock(PER_MOVE, 2, 0).remainingMs).toEqual([10_000, 10_000]);
  });

  it('refills the next player rather than carrying time forward', () => {
    const started = switchClock(createClock(PER_MOVE, 2, 0), PER_MOVE, null, 0, 0);
    const handed = switchClock(started, PER_MOVE, 0, 1, 9_000);

    expect(handed.remainingMs[1]).toBe(10_000);
    expect(remainingFor(handed, 1, 9_000)).toBe(10_000);

    // And back again: seat 0 is topped up too, however long it dawdled before.
    const returned = switchClock(handed, PER_MOVE, 1, 0, 18_000);
    expect(remainingFor(returned, 0, 18_000)).toBe(10_000);
  });

  it('leaves nobody running once the game stops', () => {
    const started = switchClock(createClock(PER_MOVE, 2, 0), PER_MOVE, null, 0, 0);
    const ended = switchClock(started, PER_MOVE, 0, null, 3_000);
    expect(ended.runningSeat).toBeNull();
  });
});
