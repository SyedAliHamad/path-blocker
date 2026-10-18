/**
 * @pb/engine — the rules of Path Blocker.
 *
 * Pure TypeScript with no runtime dependencies, so the identical code runs in
 * the browser, in the game server and inside the AI worker. The server is the
 * authority, but the client validates with the same functions for instant
 * feedback.
 */
export * from './types';
export * from './board';
export * from './path';
export * from './moves';
export * from './state';
export * from './notation';
export * from './variants';
