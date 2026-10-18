/**
 * @pb/protocol — the contract between a game UI and whatever is running the
 * game: an object in the same tab today, a websocket server tomorrow.
 *
 * Nothing here imports a transport. The types are plain JSON so the same
 * payloads can be sent over a socket, stored in a database or replayed in a
 * test.
 */
export * from './types';
export * from './snapshot';
export * from './clock';
export * from './wire';
