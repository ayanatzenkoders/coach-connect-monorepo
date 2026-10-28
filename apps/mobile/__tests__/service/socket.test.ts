// The shared setup replaces the socket module with a fake; here we test the REAL one, with a fake Socket.IO underneath.
jest.unmock('@/src/service/socket/socket');

type Handler = (...args: unknown[]) => void;
const handlers = new Map<string, Handler>();
const fake = {
  on: jest.fn((event: string, handler: Handler) => handlers.set(event, handler)),
  connect: jest.fn(),
  disconnect: jest.fn(),
};
const mockIo = jest.fn((..._args: unknown[]) => fake);
jest.mock('socket.io-client', () => ({ io: (...args: unknown[]) => mockIo(...args) }));

/** Play the server: make the fake socket report an event. */
const emit = async (event: string, ...args: unknown[]) => {
  await handlers.get(event)!(...args);
};

let expireSession: jest.Mock;
let refreshSession: jest.Mock;

beforeEach(() => {
  jest.resetModules(); // a fresh module, so the socket is created again
  handlers.clear();
  fake.on.mockClear();
  fake.connect.mockClear();
  expireSession = jest.fn().mockResolvedValue(undefined);
  refreshSession = jest.fn().mockResolvedValue('new-token');
});

/**
 * Load a fresh socket module. After resetModules it also gets its OWN copy of the auth store, so the fakes
 * (expireSession, refreshSession, the token) are put on that same copy.
 */
const load = () => {
  const { useAuthStore } = require('@/src/store/auth.store') as typeof import('@/src/store/auth.store');
  useAuthStore.setState({ status: 'signedIn', signingOut: false, accessToken: 'token-1', expireSession, refreshSession } as never);
  return { ...(require('@/src/service/socket/socket') as typeof import('@/src/service/socket/socket')), store: useAuthStore };
};

describe('socket connection', () => {
  it('is created once, does not connect by itself, and sends the CURRENT token on every (re)connect', () => {
    const { getSocket, store } = load();
    expect(getSocket()).toBe(getSocket());
    expect(mockIo).toHaveBeenCalledTimes(1);
    const options = mockIo.mock.calls[0]![1] as { autoConnect: boolean; auth: (send: (a: unknown) => void) => void };
    expect(options.autoConnect).toBe(false);

    const send = jest.fn();
    options.auth(send);
    expect(send).toHaveBeenLastCalledWith({ token: 'token-1' });
    store.setState({ accessToken: 'token-2' });
    options.auth(send); // after a token refresh the NEW token is used, no new socket needed
    expect(send).toHaveBeenLastCalledWith({ token: 'token-2' });
  });

  it('connectSocket opens it and disconnectSocket closes it', () => {
    const { connectSocket, disconnectSocket } = load();
    connectSocket();
    expect(fake.connect).toHaveBeenCalledTimes(1);
    disconnectSocket();
    expect(fake.disconnect).toHaveBeenCalledTimes(1);
  });

  it('an expired access token (INVALID_TOKEN): refreshes the token, then connects again', async () => {
    load().getSocket();
    await emit('connect_error', new Error('INVALID_TOKEN'));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fake.connect).toHaveBeenCalledTimes(1);
    expect(expireSession).not.toHaveBeenCalled();
  });

  it('if the refresh fails (offline), it stays quiet instead of crashing or signing out', async () => {
    refreshSession.mockRejectedValue(new Error('offline'));
    load().getSocket();
    await emit('connect_error', new Error('INVALID_TOKEN'));
    expect(fake.connect).not.toHaveBeenCalled();
    expect(expireSession).not.toHaveBeenCalled();
  });

  it.each([
    ['ACCOUNT_BANNED', 'banned'],
    ['SESSION_REVOKED', 'expired'],
    ['SESSION_EXPIRED', 'expired'],
  ])('%s while the app is running: ends the login here too (reason "%s")', async (code, reason) => {
    load().getSocket();
    await emit('connect_error', new Error(code));
    expect(expireSession).toHaveBeenCalledWith(reason);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('does NOT report "session ended" when the user is signing out themselves (server closes the socket on logout)', async () => {
    const { store, getSocket } = load();
    getSocket();
    store.setState({ signingOut: true });
    await emit('disconnect', 'io server disconnect');
    await emit('connect_error', new Error('SESSION_REVOKED'));
    expect(fake.connect).not.toHaveBeenCalled(); // no knocking again
    expect(expireSession).not.toHaveBeenCalled(); // and no "your session ended" banner
  });

  it('ignores socket errors once the user is already signed out', async () => {
    const { store, getSocket } = load();
    getSocket();
    store.setState({ status: 'signedOut' });
    await emit('connect_error', new Error('ACCOUNT_BANNED'));
    expect(expireSession).not.toHaveBeenCalled();
  });

  it('a network error is left to Socket.IO to retry (no sign-out, no refresh)', async () => {
    load().getSocket();
    await emit('connect_error', new Error('websocket error'));
    expect(expireSession).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('after the SERVER hangs up (ban, logout elsewhere) it knocks again, so the handshake can say why', async () => {
    load().getSocket();
    await emit('disconnect', 'io server disconnect');
    expect(fake.connect).toHaveBeenCalledTimes(1);
    fake.connect.mockClear();
    await emit('disconnect', 'transport close'); // a normal network drop: Socket.IO reconnects by itself
    expect(fake.connect).not.toHaveBeenCalled();
  });
});
