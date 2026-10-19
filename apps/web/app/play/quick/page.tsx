'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ClientMessage, ServerMessage } from '@pb/protocol';
import { gameServerUrl, isGameServerConfigured, playerId } from '@/lib/identity';

type Phase = 'connecting' | 'searching' | 'matched' | 'lost' | 'unconfigured';

/**
 * Waiting to be paired with a stranger.
 *
 * Matchmaking is kept apart from the game itself: this page does nothing but
 * hold a socket open until the server names a room, then sends you there. The
 * game that follows is the same online game a friend link produces, so there
 * is only one way to play and only one thing that can be wrong with it.
 */
export default function QuickMatchPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('connecting');
  const [waiting, setWaiting] = useState(1);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isGameServerConfigured()) {
      setPhase('unconfigured');
      return;
    }

    const me = playerId();
    const socket = new WebSocket(gameServerUrl());
    socketRef.current = socket;
    let matched = false;

    const post = (message: ClientMessage): void => socket.send(JSON.stringify(message));

    socket.addEventListener('open', () => post({ type: 'queue', playerId: me }));

    socket.addEventListener('message', (raw) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(raw.data)) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === 'queued') {
        setPhase('searching');
        setWaiting(message.waiting);
      }

      if (message.type === 'matched') {
        matched = true;
        setPhase('matched');
        // Close first: the room is already holding a seat, and a socket still
        // in the queue would be offered to the next player looking for a game.
        socket.close();
        router.replace(`/play/${message.gameId}`);
      }
    });

    socket.addEventListener('close', () => {
      if (!matched) setPhase('lost');
    });

    return () => socket.close();
  }, [router]);

  if (phase === 'unconfigured') {
    return (
      <Panel title="Online play is not set up here">
        This deployment has no game server configured, so there is nobody to match you with.
      </Panel>
    );
  }

  if (phase === 'lost') {
    return (
      <Panel title="Lost the connection">
        The game server went away while you were waiting.{' '}
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-accent underline underline-offset-2"
        >
          Try again
        </button>
        .
      </Panel>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md text-center">
      <div className="rounded-xl border border-edge bg-panel px-6 py-10">
        <div className="mx-auto mb-5 flex gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2.5 animate-pulse rounded-full bg-accent"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>

        <h1 className="text-lg font-semibold tracking-tight">
          {phase === 'matched' ? 'Opponent found' : 'Looking for an opponent'}
        </h1>
        <p className="mt-2 text-sm text-ink-dim">
          {phase === 'matched'
            ? 'Taking you to the board…'
            : waiting > 1
              ? `${waiting} players waiting — pairing you up.`
              : 'You are first in the queue. This holds until somebody else arrives.'}
        </p>

        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/"
            className="rounded-md border border-edge px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
          >
            Cancel
          </Link>
          <Link
            href="/play/computer"
            className="rounded-md border border-edge px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
          >
            Play the computer instead
          </Link>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-edge bg-panel p-5">
      <h1 className="text-sm font-medium">{title}</h1>
      <p className="mt-2 text-sm text-ink-dim">{children}</p>
    </div>
  );
}
