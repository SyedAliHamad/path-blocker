import { describe, expect, it, vi } from 'vitest';
import { Matchmaker, type Waiting } from '../src/matchmaker';

function waiting(playerId: string): Waiting & { sent: unknown[] } {
  const sent: unknown[] = [];
  return { playerId, name: playerId, send: (m) => sent.push(m), sent };
}

/** Pairs into a predictable room id so assertions read plainly. */
const roomFactory = () => {
  let n = 0;
  return vi.fn(() => `room-${++n}`);
};

describe('pairing', () => {
  it('holds the first player until somebody else arrives', () => {
    const pair = roomFactory();
    const queue = new Matchmaker(pair);
    const alice = waiting('alice');

    queue.enter(alice);

    expect(pair).not.toHaveBeenCalled();
    expect(queue.size).toBe(1);
    expect(alice.sent).toEqual([{ type: 'queued', waiting: 1 }]);
  });

  it('pairs the second arrival with the one already waiting', () => {
    const pair = roomFactory();
    const queue = new Matchmaker(pair);
    const alice = waiting('alice');
    const bob = waiting('bob');

    queue.enter(alice);
    queue.enter(bob);

    expect(queue.size).toBe(0);
    expect(alice.sent).toContainEqual({ type: 'matched', gameId: 'room-1', seat: 0 });
    expect(bob.sent).toContainEqual({ type: 'matched', gameId: 'room-1', seat: 1 });
  });

  it('gives the two players different seats in the same room', () => {
    const queue = new Matchmaker(roomFactory());
    const alice = waiting('alice');
    const bob = waiting('bob');

    queue.enter(alice);
    queue.enter(bob);

    const a = alice.sent.at(-1) as { gameId: string; seat: number };
    const b = bob.sent.at(-1) as { gameId: string; seat: number };
    expect(a.gameId).toBe(b.gameId);
    expect(a.seat).not.toBe(b.seat);
  });

  it('never matches somebody with themselves', () => {
    // Two tabs, one person. The second entry replaces the first rather than
    // becoming its opponent and starting a game against nobody.
    const pair = roomFactory();
    const queue = new Matchmaker(pair);

    queue.enter(waiting('alice'));
    queue.enter(waiting('alice'));

    expect(pair).not.toHaveBeenCalled();
    expect(queue.size).toBe(1);
  });

  it('keeps pairing as more players arrive', () => {
    const queue = new Matchmaker(roomFactory());
    const players = ['a', 'b', 'c', 'd'].map(waiting);
    for (const player of players) queue.enter(player);

    expect(queue.size).toBe(0);
    const rooms = players.map((p) => (p.sent.at(-1) as { gameId: string }).gameId);
    expect(new Set(rooms).size).toBe(2);
  });
});

describe('leaving the queue', () => {
  it('removes the player who cancelled', () => {
    const queue = new Matchmaker(roomFactory());
    const alice = waiting('alice');

    queue.enter(alice);
    queue.drop(alice);

    expect(queue.size).toBe(0);
  });

  it('leaves nobody behind to be matched against a dead socket', () => {
    const pair = roomFactory();
    const queue = new Matchmaker(pair);
    const alice = waiting('alice');

    queue.enter(alice);
    queue.drop(alice);
    queue.enter(waiting('bob'));

    expect(pair).not.toHaveBeenCalled();
    expect(queue.size).toBe(1);
  });

  it('does not let a stale entry evict the live one for the same player', () => {
    // A reconnecting client queues again before its old socket finishes
    // closing. Dropping by player id would delete the new entry and leave
    // them searching forever.
    const queue = new Matchmaker(roomFactory());
    const stale = waiting('alice');
    const fresh = waiting('alice');

    queue.enter(stale);
    queue.enter(fresh);
    queue.drop(stale);

    expect(queue.size).toBe(1);
    expect(queue.waiting[0]).toBe(fresh);
  });

  it('ignores a drop for somebody who already left', () => {
    const queue = new Matchmaker(roomFactory());
    const alice = waiting('alice');

    queue.enter(alice);
    queue.drop(alice);
    expect(() => queue.drop(alice)).not.toThrow();
    expect(queue.size).toBe(0);
  });
});
