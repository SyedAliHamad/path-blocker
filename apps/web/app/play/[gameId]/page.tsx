'use client';

import { use, useEffect, useState } from 'react';
import { createGameClient } from '@pb/client';
import { GameView } from '@/components/GameView';
import { gameServerUrl, isGameServerConfigured, playerId } from '@/lib/identity';

export default function OnlineGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const [identity, setIdentity] = useState<string | null>(null);

  // The id lives in localStorage, which the server render cannot read, so the
  // client is built after mount rather than during the first paint.
  useEffect(() => setIdentity(playerId()), []);

  if (!isGameServerConfigured()) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-edge bg-panel p-5">
        <h1 className="text-sm font-medium">Online play is not set up here</h1>
        <p className="mt-2 text-sm text-ink-dim">
          This deployment has no game server configured. Set{' '}
          <code className="rounded bg-panel-raised px-1.5 py-0.5 text-xs">
            NEXT_PUBLIC_GAME_SERVER_URL
          </code>{' '}
          to the server’s <code className="text-xs">wss://</code> address and redeploy.
        </p>
      </div>
    );
  }

  if (!identity) {
    return <p className="text-sm text-ink-dim">Connecting…</p>;
  }

  return (
    <GameView
      key={gameId}
      create={() =>
        createGameClient({
          mode: 'online',
          gameId,
          url: `${gameServerUrl()}/?game=${encodeURIComponent(gameId)}`,
          playerId: identity,
        })
      }
      title="Online game"
      subtitle={`Room ${gameId}`}
      shareCode={gameId}
    />
  );
}
