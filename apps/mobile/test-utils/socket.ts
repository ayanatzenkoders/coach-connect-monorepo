/* eslint-env jest */
/**
 * A stand-in for the real Socket.IO connection in tests. jest.setup.js makes `getSocket()` return this object.
 * A test plays the SERVER by calling `receive`:
 *
 *    fakeSocket.receive('message:new', { chatId, message });   // the screen reacts as if the server pushed it
 */
type Handler = (...args: unknown[]) => void;
const handlers = new Map<string, Set<Handler>>();

export const fakeSocket = {
  on(event: string, handler: Handler) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
    return fakeSocket;
  },
  off(event: string, handler: Handler) {
    handlers.get(event)?.delete(handler);
    return fakeSocket;
  },
  /** Test helper: deliver an event to every listener, like the server pushing it. */
  receive(event: string, ...args: unknown[]) {
    [...(handlers.get(event) ?? [])].forEach((handler) => handler(...args));
  },
  listenerCount: (event: string) => handlers.get(event)?.size ?? 0,
  reset() {
    handlers.clear();
  },
};
