'use client';

import { useRouter } from 'next/navigation';
import { makeGameId } from '@pb/protocol';

/**
 * Starts an online game by inventing a room code and going there.
 *
 * No request is needed: the server creates the room when the first player
 * arrives, so a link works whether or not anybody has opened it yet.
 */
export function PlayWithFriends() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/play/${makeGameId()}`)}
      className="rounded-lg border border-edge bg-panel-raised px-4 py-3.5 text-left transition-colors hover:border-accent/40"
    >
      <span className="block text-sm font-medium">Play with friends</span>
      <span className="mt-0.5 block text-xs text-ink-faint">Online · share a link</span>
    </button>
  );
}
