'use client';

const KEY = 'path-blocker.player-id';

/**
 * A stable id for this browser.
 *
 * It is what lets a refresh or a dropped connection put you back in your own
 * seat rather than demoting you to a spectator of your own game. It is not an
 * account and not a secret — when real accounts arrive, this is what they
 * replace.
 */
export function playerId(): string {
  if (typeof window === 'undefined') return 'server';

  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;

    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private windows and blocked storage: a per-tab id still plays fine, it
    // just will not survive a refresh.
    return `p-${Math.random().toString(36).slice(2)}`;
  }
}

const LOCAL_HOSTS = new Set(['localhost', '0.0.0.0', '127.0.0.1', '[::1]']);

/** True when this page is being served from a development machine. */
export function isLocal(): boolean {
  return typeof window !== 'undefined' && LOCAL_HOSTS.has(window.location.hostname);
}

/**
 * Whether online play can work at all here.
 *
 * A deployment without `NEXT_PUBLIC_GAME_SERVER_URL` would otherwise try to
 * reach the player’s own machine and look exactly like the server being down.
 */
export function isGameServerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GAME_SERVER_URL) || isLocal();
}

/** Where the game server lives. Falls back to localhost for development. */
export function gameServerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (!configured) return 'ws://localhost:8787';

  // A page served over https cannot open a ws:// socket — browsers block it as
  // mixed content, and the failure looks like the server being unreachable.
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const INSECURE = 'ws://';
  return secure && configured.startsWith(INSECURE)
    ? 'wss://' + configured.slice(INSECURE.length)
    : configured;
}
