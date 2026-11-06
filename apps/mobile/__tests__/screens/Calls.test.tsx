import ReactTestRenderer from 'react-test-renderer';
import Call from '@/src/screens/call/Call';
import Messages from '@/src/screens/home/messages/Messages';
import { chatApi } from '@/src/service/api/chat.api';
import { CallBanner } from '@/src/screens/call/CallBanner';
import { CallLayer } from '@/src/screens/call/CallLayer';
import { callApi } from '@/src/service/api/call.api';
import { connectToRoom, leaveRoom, setCamera, setMicrophone, setSpeaker } from '@/src/service/call/callEngine';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { useCallStore } from '@/src/store/call.store';
import { allText, clearToast, lastToast, navigationMock, press, render, resetNavigationMock, screenProps } from '@/test-utils';
import { callInfo, chatSummary } from '../../test-utils/chat';
import { fakeSocket } from '../../test-utils/socket';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/call.api', () => ({ callApi: { start: jest.fn(), join: jest.fn(), decline: jest.fn(), cancel: jest.fn(), leave: jest.fn(), inChat: jest.fn() } }));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { chats: jest.fn() } }));
jest.mock('@/src/service/call/callEngine', () => ({ connectToRoom: jest.fn(), leaveRoom: jest.fn(), setCamera: jest.fn(), setMicrophone: jest.fn(), setSpeaker: jest.fn(), videoTiles: () => [] }));

const api = callApi as jest.Mocked<typeof callApi>;
const connect = connectToRoom as jest.Mock;
const leaveTheRoom = leaveRoom as jest.Mock;
const session = (call = callInfo()) => ({ call, livekit: { url: 'wss://lk.example', token: 'pass-token' } });
const push = (event: string, payload: unknown) => ReactTestRenderer.act(async () => { fakeSocket.receive(event, payload); });
const ringingForBen = callInfo(); // Ann is calling Ben
const active = (over = {}) => callInfo({ state: 'ACTIVE', answeredAt: '2026-10-30T10:00:20.000Z', participants: callInfo().participants.map((p) => ({ ...p, status: 'JOINED' as const, joinedAt: '2026-10-30T10:00:20.000Z' })), ...over });

beforeEach(() => {
  jest.clearAllMocks();
  fakeSocket.reset();
  resetNavigationMock();
  clearToast();
  useCallStore.getState().reset();
  api.join.mockResolvedValue(session(active()));
  api.decline.mockResolvedValue(callInfo({ state: 'ENDED', endReason: 'DECLINED' }));
  api.leave.mockResolvedValue(callInfo({ state: 'ENDED', endReason: 'COMPLETED' }));
  api.inChat.mockResolvedValue({ call: null });
  connect.mockResolvedValue(undefined);
  useAuthStore.setState({ accessToken: 'token', user: { id: 'ben', email: 'ben@x.com', name: 'Ben', role: 'MEMBER', emailVerified: true } });
});

describe('ringing overlay and live pushes (CallLayer)', () => {
  it('a push that somebody is calling shows the ringing screen; nothing shows before', async () => {
    const tree = await render(<CallLayer />);
    expect(allText(tree)).not.toContain('Accept');
    await push('call:incoming', { call: ringingForBen });
    expect(allText(tree)).toEqual(expect.arrayContaining(['Ann', 'Voice call · ringing…', 'Accept', 'Decline']));
  });

  it('says "Video call" and "Group" when it is one', async () => {
    const tree = await render(<CallLayer />);
    const group = callInfo({ video: true, participants: [...ringingForBen.participants, { userId: 'cara', name: 'Cara', status: 'INVITED', joinedAt: null, leftAt: null }] });
    await push('call:incoming', { call: group });
    expect(allText(tree)).toContain('Group video call · ringing…');
  });

  it('ignores my own call (started on another phone of mine), and ignores a ring while I am already in a call', async () => {
    const tree = await render(<CallLayer />);
    await push('call:incoming', { call: callInfo({ startedById: 'ben' }) });
    expect(allText(tree)).not.toContain('Accept');
    useCallStore.getState().setActive(active());
    await push('call:incoming', { call: ringingForBen });
    expect(allText(tree)).not.toContain('Accept');
  });

  it('Accept joins the call, connects the audio with the pass the server gave, and opens the call screen', async () => {
    const tree = await render(<CallLayer />);
    await push('call:incoming', { call: ringingForBen });
    await press(tree, 'Accept call');
    expect(api.join).toHaveBeenCalledWith('token', 'call-1');
    expect(connect).toHaveBeenCalledWith('wss://lk.example', 'pass-token', { video: false });
    expect(navigationMock.navigate).toHaveBeenCalledWith('Call');
    expect(useCallStore.getState().incoming).toBeNull();
    expect(useCallStore.getState().active?.id).toBe('call-1');
    expect(allText(tree)).not.toContain('Accept');
  });

  it('Decline closes the screen at once and tells the server', async () => {
    const tree = await render(<CallLayer />);
    await push('call:incoming', { call: ringingForBen });
    await press(tree, 'Decline call');
    expect(api.decline).toHaveBeenCalledWith('token', 'call-1');
    expect(useCallStore.getState().incoming).toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('if the call is already over when I tap Accept, I see why and the screen closes', async () => {
    api.join.mockRejectedValue(new ApiError(409, 'CALL_ENDED', 'This call has ended.'));
    const tree = await render(<CallLayer />);
    await push('call:incoming', { call: ringingForBen });
    await press(tree, 'Accept call');
    expect(lastToast()?.message).toBe('This call has ended.');
    expect(useCallStore.getState().incoming).toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('if the audio cannot connect (no permission, no network) I step out of the call again, no ghost call is left', async () => {
    connect.mockRejectedValue(new Error('PERMISSION_DENIED'));
    const tree = await render(<CallLayer />);
    await push('call:incoming', { call: ringingForBen });
    await press(tree, 'Accept call');
    expect(lastToast()?.message).toContain('Allow the microphone');
    expect(useCallStore.getState().active).toBeNull();
    expect(api.leave).toHaveBeenCalledWith('token', 'call-1');
    expect(leaveTheRoom).toHaveBeenCalled();
  });

  it('a microphone that never starts says so (not "check your connection") and leaves no ghost call', async () => {
    connect.mockRejectedValue(new Error('MIC_FAILED'));
    const tree = await render(<CallLayer />);
    await push('call:incoming', { call: ringingForBen });
    await press(tree, 'Accept call');
    expect(lastToast()?.message).toContain('microphone');
    expect(lastToast()?.message).not.toContain('connection');
    expect(useCallStore.getState().active).toBeNull();
    expect(api.leave).toHaveBeenCalledWith('token', 'call-1');
  });

  it('the ringing screen closes by itself when the caller gives up, and says why', async () => {
    const tree = await render(<CallLayer />);
    await push('call:incoming', { call: ringingForBen });
    await push('call:updated', { call: callInfo({ state: 'ENDED', endReason: 'CANCELED', endedAt: 'x' }) });
    expect(allText(tree)).not.toContain('Accept');
    expect(lastToast()?.message).toBe('Call canceled.');
  });

  it('it also closes when I answered on another phone (I am no longer "being rung")', async () => {
    const tree = await render(<CallLayer />);
    await push('call:incoming', { call: ringingForBen });
    await push('call:updated', { call: active() });
    expect(allText(tree)).not.toContain('Accept');
  });

  it('a call that ended for the call I am IN closes it: audio off, call cleared', async () => {
    await render(<CallLayer />);
    useCallStore.getState().setActive(active());
    await push('call:updated', { call: active({ state: 'ENDED', endReason: 'COMPLETED', endedAt: 'x' }) });
    expect(useCallStore.getState().active).toBeNull();
    expect(leaveTheRoom).toHaveBeenCalled();
    expect(lastToast()?.message).toBe('Call ended.');
  });

  it('a change in a call I am in (somebody joined) refreshes it', async () => {
    await render(<CallLayer />);
    useCallStore.getState().setActive(callInfo());
    await push('call:updated', { call: active() });
    expect(useCallStore.getState().active?.state).toBe('ACTIVE');
    expect(leaveTheRoom).not.toHaveBeenCalled();
  });

  it('stops listening when it goes away', async () => {
    const tree = await render(<CallLayer />);
    expect(fakeSocket.listenerCount('call:incoming')).toBe(1);
    ReactTestRenderer.act(() => tree.unmount());
    expect(fakeSocket.listenerCount('call:incoming')).toBe(0);
    expect(fakeSocket.listenerCount('call:updated')).toBe(0);
  });
});

describe('"Call in progress" banner in a chat', () => {
  const open = () => render(<CallBanner chatId="chat-1" />);

  it('shows nothing when the chat has no live call', async () => {
    const tree = await open();
    expect(allText(tree)).toEqual([]);
  });

  it('shows who is in it and a Join button; Join joins the call', async () => {
    api.inChat.mockResolvedValue({ call: active({ video: true }) });
    const tree = await open();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Video call in progress', '2 in call', 'Join']));
    await press(tree, 'Join call');
    expect(api.join).toHaveBeenCalledWith('token', 'call-1');
    expect(navigationMock.navigate).toHaveBeenCalledWith('Call');
  });

  it('if I am the one in the call (I minimized it) it says Return, and Return does not join again', async () => {
    api.inChat.mockResolvedValue({ call: active() });
    useCallStore.getState().setActive(active());
    const tree = await open();
    expect(allText(tree)).toContain('Return');
    await press(tree, 'Return to call');
    expect(api.join).not.toHaveBeenCalled();
    expect(navigationMock.navigate).toHaveBeenCalledWith('Call');
  });

  it('while it is still ringing it says so', async () => {
    api.inChat.mockResolvedValue({ call: ringingForBen });
    expect(allText(await open())).toContain('Ringing…');
  });

  it('appears and disappears live, from the server pushes', async () => {
    const tree = await render(
      <>
        <CallLayer />
        <CallBanner chatId="chat-1" />
      </>,
    );
    expect(allText(tree)).not.toContain('Join');
    await push('call:updated', { call: active() });
    expect(allText(tree)).toContain('Join');
    await push('call:updated', { call: active({ state: 'ENDED', endReason: 'COMPLETED', endedAt: 'x' }) });
    expect(allText(tree)).not.toContain('Join');
  });
});

describe('the Messages list follows the call pushes', () => {
  it('marks the chat when a call starts in it and clears the mark when the call ends', async () => {
    (chatApi.chats as jest.Mock).mockResolvedValue({ items: [chatSummary({ id: 'chat-1', title: 'Ann', lastMessageAt: '2026-10-30T10:00:00.000Z' })] });
    const tree = await render(
      <>
        <CallLayer />
        <Messages />
      </>,
    );
    expect(allText(tree)).not.toContain('Call in progress');
    await push('call:updated', { call: active() });
    expect(allText(tree)).toContain('Call in progress');
    await push('call:updated', { call: active({ state: 'ENDED', endReason: 'COMPLETED', endedAt: 'x' }) });
    expect(allText(tree)).not.toContain('Call in progress');
  });
});

describe('the call screen', () => {
  const openCall = (call = active(), meId = 'ann') => {
    useAuthStore.setState({ user: { id: meId, email: 'x@x.com', name: 'Me', role: 'MEMBER', emailVerified: true } });
    useCallStore.getState().setActive(call);
    useCallStore.getState().setConnection('connected');
    return render(<Call {...screenProps('Call')} />);
  };

  it('shows who I am talking to, how long, and everybody in the call', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T10:01:35.000Z')); // 75 s after the call was answered
    const tree = await openCall();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Ben', '1:15', 'Ann (you)', 'Ben', 'In call']));
    jest.useRealTimers();
  });

  it('says "Ringing…" before anybody answers, and shows each person\'s state', async () => {
    const tree = await openCall(ringingForBen);
    expect(allText(tree)).toEqual(expect.arrayContaining(['Ringing…', 'Ann (you)', 'In call']));
  });

  it('says what the connection is doing', async () => {
    const tree = await openCall();
    ReactTestRenderer.act(() => useCallStore.getState().setConnection('reconnecting'));
    expect(allText(tree)).toContain('Reconnecting…');
    ReactTestRenderer.act(() => useCallStore.getState().setConnection('lost'));
    expect(allText(tree)).toEqual(expect.arrayContaining(['Connection lost', 'Rejoin']));
  });

  it('Rejoin asks for a new pass and connects again', async () => {
    const tree = await openCall();
    ReactTestRenderer.act(() => useCallStore.getState().setConnection('lost'));
    await press(tree, 'Rejoin');
    expect(api.join).toHaveBeenCalledWith('token', 'call-1');
    expect(connect).toHaveBeenCalledWith('wss://lk.example', 'pass-token', { video: false });
  });

  it('the buttons switch the microphone, speaker and camera', async () => {
    const tree = await openCall();
    await press(tree, 'Mute');
    expect(setMicrophone).toHaveBeenCalledWith(false); // muted = false now, so "enable microphone" = false
    await press(tree, 'Speaker on');
    expect(setSpeaker).toHaveBeenCalledWith(true);
    await press(tree, 'Camera on');
    expect(setCamera).toHaveBeenCalledWith(true);
  });

  it('Hang up leaves the room, tells the server, forgets the call and goes back', async () => {
    const tree = await openCall();
    await press(tree, 'Hang up');
    expect(leaveTheRoom).toHaveBeenCalled();
    expect(api.leave).toHaveBeenCalledWith('token', 'call-1');
    expect(useCallStore.getState().active).toBeNull();
    expect(navigationMock.goBack).toHaveBeenCalled();
  });

  it('Minimize goes back to the chat and keeps the call going', async () => {
    const tree = await openCall();
    await press(tree, 'Minimize call');
    expect(navigationMock.goBack).toHaveBeenCalled();
    expect(useCallStore.getState().active?.id).toBe('call-1');
    expect(api.leave).not.toHaveBeenCalled();
  });

  it('when the call ends (the other person hung up) the screen closes by itself', async () => {
    await openCall();
    ReactTestRenderer.act(() => useCallStore.getState().setActive(null));
    expect(navigationMock.goBack).toHaveBeenCalled();
  });

  it('the call state is forgotten on sign out (reset)', () => {
    useCallStore.getState().setActive(active());
    useCallStore.getState().setIncoming(ringingForBen);
    useCallStore.getState().reset();
    expect(useCallStore.getState()).toMatchObject({ active: null, incoming: null, connection: 'idle', muted: false });
  });
});
