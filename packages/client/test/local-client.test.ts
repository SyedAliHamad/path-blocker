import { describe, expect, it, vi } from 'vitest';
import { anonymousPlayer, type GameEvent } from '@pb/protocol';
import { LocalGameClient } from '../src/index';
import type { Agent } from '../src/index';

function hotseat(): { client: LocalGameClient; events: GameEvent[] } {
  const client = new LocalGameClient({
    seats: [0, 1],
    players: [anonymousPlayer(0), anonymousPlayer(1)],
  });
  const events: GameEvent[] = [];
  client.subscribe((event) => events.push(event));
  return { client, events };
}

describe('subscribing', () => {
  it('delivers the current position immediately', () => {
    const { events } = hotseat();
    expect(events[0]?.type).toBe('snapshot');
    if (events[0]?.type === 'snapshot') {
      expect(events[0].snapshot.position).toBe('classic|e1,e9|-|10,10|0|0');
    }
  });

  it('stops delivering after unsubscribe', () => {
    const client = new LocalGameClient({
      seats: [0, 1],
      players: [anonymousPlayer(0), anonymousPlayer(1)],
    });
    const seen: GameEvent[] = [];
    const off = client.subscribe((event) => seen.push(event));
    off();
    client.send({ type: 'move', move: 'e2' });
    expect(seen).toHaveLength(1);
  });
});

describe('moves', () => {
  it('applies a legal move and publishes the new snapshot', () => {
    const { client, events } = hotseat();
    client.send({ type: 'move', move: 'e2' });

    const move = events.find((event) => event.type === 'move');
    expect(move?.type).toBe('move');
    if (move?.type === 'move') {
      expect(move.by).toBe(0);
      expect(move.snapshot.turn).toBe(1);
      expect(move.snapshot.moves).toEqual(['e2']);
    }
    expect(client.getSnapshot().ply).toBe(1);
  });

  it('reports an illegal move without changing the position', () => {
    const { client, events } = hotseat();
    client.send({ type: 'move', move: 'e9' });

    const error = events.find((event) => event.type === 'error');
    expect(error?.type).toBe('error');
    if (error?.type === 'error') expect(error.code).toBe('illegal-move');
    expect(client.getSnapshot().ply).toBe(0);
  });

  it('reports unreadable notation as an illegal move', () => {
    const { client, events } = hotseat();
    client.send({ type: 'move', move: 'zz9q' });
    expect(events.some((event) => event.type === 'error')).toBe(true);
  });

  it('refuses a seat this client does not play', () => {
    const client = new LocalGameClient({
      seats: [1],
      players: [anonymousPlayer(0), anonymousPlayer(1)],
    });
    const events: GameEvent[] = [];
    client.subscribe((event) => events.push(event));

    // Seat 0 is to move but this client only holds seat 1.
    client.send({ type: 'move', move: 'e2' });
    const error = events.find((event) => event.type === 'error');
    expect(error?.type === 'error' && error.code).toBe('not-your-seat');
  });
});

describe('ending a game', () => {
  it('awards a resignation to the opponent', () => {
    const { client, events } = hotseat();
    client.send({ type: 'resign' });

    const over = events.find((event) => event.type === 'game-over');
    expect(over?.type === 'game-over' && over.snapshot.result).toEqual({
      winner: 1,
      reason: 'resign',
    });
    expect(client.getSnapshot().status).toBe('finished');
  });

  it('refuses moves once finished', () => {
    const { client, events } = hotseat();
    client.send({ type: 'resign' });
    client.send({ type: 'move', move: 'e2' });
    expect(events.some((event) => event.type === 'error' && event.code === 'game-over')).toBe(true);
  });

  it('starts over on a rematch', () => {
    const { client } = hotseat();
    client.send({ type: 'move', move: 'e2' });
    client.send({ type: 'resign' });
    client.send({ type: 'rematch' });

    const snapshot = client.getSnapshot();
    expect(snapshot.ply).toBe(0);
    expect(snapshot.result).toBeNull();
    expect(snapshot.moves).toEqual([]);
  });
});

describe('agents', () => {
  it('lets an agent play its seat automatically', async () => {
    const agent: Agent = {
      name: 'stub',
      chooseMove: vi.fn().mockResolvedValue('e8'),
    };

    const client = new LocalGameClient({
      seats: [0],
      players: [anonymousPlayer(0), anonymousPlayer(1)],
      agents: { 1: agent },
    });
    client.subscribe(() => {});

    client.send({ type: 'move', move: 'e2' });
    await vi.waitFor(() => expect(client.getSnapshot().moves).toEqual(['e2', 'e8']));
    expect(client.getSnapshot().turn).toBe(0);
  });

  it('drops an agent reply that arrives after the game ends', async () => {
    let release: (move: string) => void = () => {};
    const agent: Agent = {
      name: 'slow',
      chooseMove: () => new Promise<string>((resolve) => { release = resolve; }),
    };

    const client = new LocalGameClient({
      seats: [0],
      players: [anonymousPlayer(0), anonymousPlayer(1)],
      agents: { 1: agent },
    });
    client.subscribe(() => {});

    client.send({ type: 'move', move: 'e2' });
    client.send({ type: 'resign' });
    release('e8');

    await Promise.resolve();
    expect(client.getSnapshot().moves).toEqual(['e2']);
  });
});

describe('lifecycle', () => {
  it('comes back to life when something subscribes after disposal', () => {
    // React cleans effects up speculatively in development, so a client is
    // disposed and resubscribed before the player has done anything.
    const client = new LocalGameClient({
      seats: [0, 1],
      players: [anonymousPlayer(0), anonymousPlayer(1)],
    });

    const off = client.subscribe(() => {});
    off();
    client.dispose();

    const events: GameEvent[] = [];
    client.subscribe((event) => events.push(event));
    client.send({ type: 'move', move: 'e2' });

    expect(client.getSnapshot().moves).toEqual(['e2']);
    expect(events.some((event) => event.type === 'move')).toBe(true);
  });
});

describe('timers', () => {
  const PER_MOVE = { initialMs: 10_000, incrementMs: 0, perMoveMs: 10_000 };
  const CHESS = { initialMs: 10_000, incrementMs: 0, perMoveMs: null };

  function timed(clockConfig: typeof PER_MOVE | typeof CHESS): LocalGameClient {
    const client = new LocalGameClient({
      seats: [0, 1],
      players: [anonymousPlayer(0), anonymousPlayer(1)],
      clockConfig,
    });
    client.subscribe(() => {});
    return client;
  }

  it('starts the first seat ticking', () => {
    vi.useFakeTimers();
    try {
      const snapshot = timed(PER_MOVE).getSnapshot();
      expect(snapshot.clock?.runningSeat).toBe(0);
      expect(snapshot.clock?.remainingMs).toEqual([10_000, 10_000]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refills the allowance each turn', () => {
    vi.useFakeTimers();
    try {
      const client = timed(PER_MOVE);
      vi.advanceTimersByTime(6_000);
      client.send({ type: 'move', move: 'e2' });

      const clock = client.getSnapshot().clock;
      expect(clock?.runningSeat).toBe(1);
      expect(clock?.remainingMs[1]).toBe(10_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('steps the pawn for a player who runs out, instead of ending the game', () => {
    vi.useFakeTimers();
    try {
      const client = timed(PER_MOVE);
      vi.advanceTimersByTime(10_001);

      const snapshot = client.getSnapshot();
      expect(snapshot.result).toBeNull();
      expect(snapshot.moves).toEqual(['e2']);
      expect(snapshot.turn).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('loses the game on a chess clock, where running out is final', () => {
    vi.useFakeTimers();
    try {
      const client = timed(CHESS);
      vi.advanceTimersByTime(10_001);

      expect(client.getSnapshot().result).toEqual({ winner: 1, reason: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops the clock once the game is over', () => {
    vi.useFakeTimers();
    try {
      const client = timed(PER_MOVE);
      client.send({ type: 'resign' });
      expect(client.getSnapshot().clock?.runningSeat).toBeNull();

      vi.advanceTimersByTime(30_000);
      expect(client.getSnapshot().moves).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pausing', () => {
  const PER_MOVE = { initialMs: 10_000, incrementMs: 0, perMoveMs: 10_000 };

  it('stops the clock and resumes it where it left off', () => {
    vi.useFakeTimers();
    try {
      const client = new LocalGameClient({
        seats: [0, 1],
        players: [anonymousPlayer(0), anonymousPlayer(1)],
        clockConfig: PER_MOVE,
      });
      client.subscribe(() => {});

      vi.advanceTimersByTime(3_000);
      client.send({ type: 'pause' });
      expect(client.getSnapshot().clock?.runningSeat).toBeNull();
      expect(client.getSnapshot().clock?.remainingMs[0]).toBe(7_000);

      // A long pause must not cost the player anything...
      vi.advanceTimersByTime(30_000);
      expect(client.getSnapshot().result).toBeNull();

      // ...nor hand them a fresh allowance when play restarts.
      client.send({ type: 'resume' });
      const clock = client.getSnapshot().clock;
      expect(clock?.runningSeat).toBe(0);
      expect(clock?.remainingMs[0]).toBe(7_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses moves while paused and accepts them again after', () => {
    const client = new LocalGameClient({
      seats: [0, 1],
      players: [anonymousPlayer(0), anonymousPlayer(1)],
    });
    client.subscribe(() => {});

    client.send({ type: 'pause' });
    client.send({ type: 'move', move: 'e2' });
    expect(client.getSnapshot().moves).toEqual([]);

    client.send({ type: 'resume' });
    client.send({ type: 'move', move: 'e2' });
    expect(client.getSnapshot().moves).toEqual(['e2']);
  });

  it('keeps a thinking bot from moving behind the pause', async () => {
    let release: (move: string) => void = () => {};
    const agent: Agent = {
      name: 'slow',
      chooseMove: () => new Promise<string>((resolve) => { release = resolve; }),
    };

    const client = new LocalGameClient({
      seats: [0],
      players: [anonymousPlayer(0), anonymousPlayer(1)],
      agents: { 1: agent },
    });
    client.subscribe(() => {});

    client.send({ type: 'move', move: 'e2' });
    client.send({ type: 'pause' });
    release('e8');

    await Promise.resolve();
    expect(client.getSnapshot().moves).toEqual(['e2']);
  });
});
