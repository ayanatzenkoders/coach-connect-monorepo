import { AppState } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { useSessionLifecycle } from '@/src/navigations/hook/useSessionLifecycle';
import { leaveRoom } from '@/src/service/call/callEngine';
import { queryClient } from '@/src/service/setup/queryClient';
import { connectSocket, disconnectSocket } from '@/src/service/socket/socket';
import { useAuthStore } from '@/src/store/auth.store';
import { useCallStore } from '@/src/store/call.store';
import { render } from '@/test-utils';
import { callInfo } from '../../test-utils/chat';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/call/callEngine', () => ({ leaveRoom: jest.fn() }));

const connect = connectSocket as jest.Mock; // faked for every test by jest.setup.js
const disconnect = disconnectSocket as jest.Mock;
const user = { id: 'u1', email: 'u@x.com', name: 'U', role: 'MEMBER' as const, emailVerified: true };

function Probe() {
  useSessionLifecycle();
  return null;
}
const setAuth = (state: Partial<ReturnType<typeof useAuthStore.getState>>) => ReactTestRenderer.act(() => useAuthStore.setState(state));

let foreground: (state: string) => void;
let removeListener: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  useCallStore.getState().reset();
  removeListener = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: (state: string) => void) => {
    foreground = handler;
    return { remove: removeListener };
  }) as never);
  useAuthStore.setState({ status: 'signedOut', user: null });
});
afterEach(() => jest.restoreAllMocks());

describe('session lifecycle (socket, call, cache)', () => {
  it('opens the live connection when somebody is signed in, and only then', async () => {
    await render(<Probe />);
    expect(connect).not.toHaveBeenCalled();
    await setAuth({ status: 'signedIn', user });
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('knocks again when the app returns to the foreground (iOS closes sockets of apps in the background)', async () => {
    useAuthStore.setState({ status: 'signedIn', user });
    await render(<Probe />);
    connect.mockClear();
    ReactTestRenderer.act(() => foreground('background'));
    expect(connect).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => foreground('active'));
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('a coach who waits for approval gets no live connection (the server would refuse it)', async () => {
    useAuthStore.setState({ status: 'signedIn', user: { ...user, role: 'COACH', pendingApproval: true } });
    await render(<Probe />);
    expect(connect).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('signing out closes the connection, leaves the call room, forgets the call and stops listening for the foreground', async () => {
    useAuthStore.setState({ status: 'signedIn', user });
    await render(<Probe />);
    useCallStore.getState().setActive(callInfo());
    await setAuth({ status: 'signedOut', user: null });
    expect(removeListener).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(leaveRoom).toHaveBeenCalled();
    expect(useCallStore.getState().active).toBeNull();
  });

  it('signing out EMPTIES the React Query cache: the next person on this phone never sees the last one\'s data', async () => {
    useAuthStore.setState({ status: 'signedIn', user });
    await render(<Probe />);
    queryClient.setQueryData(['chats'], [{ id: 'sara-private-chat' }]);
    queryClient.setQueryData(['me'], { name: 'Sara' });
    await setAuth({ status: 'signedOut', user: null });
    expect(queryClient.getQueryData(['chats'])).toBeUndefined();
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('a ban or an ended session (the app signs out by itself) clears the cache the same way', async () => {
    useAuthStore.setState({ status: 'signedIn', user });
    await render(<Probe />);
    queryClient.setQueryData(['chats'], [{ id: 'x' }]);
    await setAuth({ status: 'signedOut', user: null, signedOutReason: 'banned' });
    expect(queryClient.getQueryData(['chats'])).toBeUndefined();
  });

  it('"offline" (saved login, no network) closes the connection but KEEPS the data for when the network is back', async () => {
    useAuthStore.setState({ status: 'signedIn', user });
    await render(<Probe />);
    queryClient.setQueryData(['chats'], [{ id: 'x' }]);
    await setAuth({ status: 'offline' });
    expect(disconnect).toHaveBeenCalled();
    expect(queryClient.getQueryData(['chats'])).toEqual([{ id: 'x' }]);
  });

  it('stops listening when the app unmounts', async () => {
    useAuthStore.setState({ status: 'signedIn', user });
    const tree = await render(<Probe />);
    ReactTestRenderer.act(() => tree.unmount());
    expect(removeListener).toHaveBeenCalled();
  });
});
