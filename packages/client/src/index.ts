/**
 * @pb/client — the objects a UI talks to in order to play a game.
 *
 * Every mode is a `GameClient`. Today that means a game running in the current
 * tab, with or without a bot in one seat; an online client implementing the
 * same interface slots in without touching the UI.
 */
export * from './agent';
export * from './local-client';
export * from './socket-client';
export * from './factory';
