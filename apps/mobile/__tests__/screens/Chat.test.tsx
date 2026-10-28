import { FlatList } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import Chat from '@/src/screens/home/chat/Chat';
import { mergeMessages } from '@/src/screens/home/chat/hook/useChat';
import { chatMessage, chatSummary, groupSummary } from '../../test-utils/chat';
import { fakeSocket } from '../../test-utils/socket';
import { chatApi, ChatMessage, ChatSummary, MessagesPage } from '@/src/service/api/chat.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { useActiveChatStore } from '@/src/store/activeChat.store';
import { useAuthStore } from '@/src/store/auth.store';
import { useConnectionStore } from '@/src/store/connection.store';
import { allText, byLabel, clearToast, lastToast, navigationMock, press, render, resetNavigationMock, screenProps, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { messages: jest.fn(), send: jest.fn(), markRead: jest.fn() } }));

const api = chatApi as unknown as Record<'messages' | 'send' | 'markRead', jest.Mock>;
const ME = 'me-id';
const CHAT: ChatSummary = chatSummary({ id: 'conv-1', title: 'Amara Okafor', other: { id: 'amara-id', name: 'Amara Okafor', role: 'COACH' } });
const msg = (seq: number, senderId: string, body: string, clientMessageId = `cm-${seq}-12345`): ChatMessage => chatMessage(seq, senderId, body, { clientMessageId, senderName: senderId === ME ? 'Me' : 'Amara Okafor' });
const page = (items: ChatMessage[], over: Partial<MessagesPage> = {}): MessagesPage => ({
  items,
  hasMore: false,
  lastMessageSequenceNumber: items.length ? items[items.length - 1]!.sequenceNumber : 0,
  otherLastReadSequenceNumber: 0,
  canSend: true,
  ...over,
});
const open = async (first: MessagesPage) => {
  api.messages.mockResolvedValueOnce(first);
  return render(<Chat {...screenProps('Chat', { chat: CHAT })} />);
};
const settle = () => ReactTestRenderer.act(async () => { jest.advanceTimersByTime(0); });
/** Play the server: push an event to the open chat. */
const push = (event: string, payload: unknown) => ReactTestRenderer.act(async () => { fakeSocket.receive(event, payload); });

beforeEach(() => {
  jest.useFakeTimers();
  fakeSocket.reset();
  resetNavigationMock();
  Object.values(api).forEach((f) => f.mockReset());
  api.markRead.mockResolvedValue({ lastReadSequenceNumber: 1 });
  clearToast();
  useAuthStore.setState({ accessToken: 'token', user: { id: ME, email: 'me@x.com', name: 'Me', role: 'MEMBER', emailVerified: true } });
});
afterEach(() => jest.useRealTimers());

describe('mergeMessages', () => {
  it('keeps saved messages in order, unsent last, and never duplicates', () => {
    const sending = { clientMessageId: 'mine-1-12345', senderId: ME, body: 'hi', createdAt: '', status: 'sending' as const };
    const step1 = mergeMessages([], [msg(2, 'x', 'b'), msg(1, 'x', 'a')]);
    const step2 = mergeMessages([...step1, sending], [msg(3, ME, 'hi', 'mine-1-12345')]);
    expect(step2.map((m) => [m.sequenceNumber, m.status])).toEqual([
      [1, 'sent'],
      [2, 'sent'],
      [3, 'sent'], // my "sending" copy became the saved message
    ]);
    expect(mergeMessages(step2, [msg(2, 'x', 'b')])).toHaveLength(3);
  });
});

describe('Chat screen', () => {
  it('shows the other person, the messages, and "Sent" under my newest message', async () => {
    const tree = await open(page([msg(1, 'amara-id', 'How did it go?'), msg(2, ME, 'Better than expected')]));
    expect(allText(tree)).toEqual(expect.arrayContaining(['Amara Okafor', 'Coach', 'How did it go?', 'Better than expected', 'Sent']));
  });

  it('says "Seen" once the other person has read my message', async () => {
    const tree = await open(page([msg(1, ME, 'Hello')], { otherLastReadSequenceNumber: 1 }));
    expect(allText(tree)).toContain('Seen');
    expect(allText(tree)).not.toContain('Sent');
  });

  it('marks the other person\'s messages as read', async () => {
    await open(page([msg(1, 'amara-id', 'a'), msg(2, 'amara-id', 'b')]));
    expect(api.markRead).toHaveBeenCalledWith('token', 'conv-1', 2);
  });

  it('invites you to start when the chat is empty', async () => {
    const tree = await open(page([]));
    expect(allText(tree)).toContain('Say hello to Amara.');
  });

  it('sends trimmed text with a client id, shows it at once, and clears the box', async () => {
    const tree = await open(page([]));
    let resolve!: (v: unknown) => void;
    api.send.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    await typeInto(tree, 'Message', '  hello coach  ');
    await press(tree, 'Send message');
    expect(allText(tree)).toEqual(expect.arrayContaining(['hello coach', 'Sending…']));
    expect(byLabel(tree, 'Message').props.value).toBe('');
    const [, , sent] = api.send.mock.calls[0]!;
    expect(sent.body).toBe('hello coach');
    expect(sent.clientMessageId.length).toBeGreaterThanOrEqual(8);
    await ReactTestRenderer.act(async () => resolve({ message: msg(1, ME, 'hello coach', sent.clientMessageId), duplicate: false }));
    expect(allText(tree)).not.toContain('Sending…');
    expect(allText(tree).filter((x) => x === 'hello coach')).toHaveLength(1);
  });

  it('will not send an empty message', async () => {
    const tree = await open(page([]));
    await typeInto(tree, 'Message', '   ');
    expect(byLabel(tree, 'Send message').props.disabled).toBe(true);
  });

  it('keeps a failed message, shows a toast, and retries it with the SAME client id', async () => {
    const tree = await open(page([]));
    api.send.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.'));
    await typeInto(tree, 'Message', 'are you there');
    await press(tree, 'Send message');
    expect(allText(tree)).toContain('Not sent. Tap to retry');
    expect(lastToast()?.message).toContain('Cannot reach the server');
    const firstId = api.send.mock.calls[0]![2].clientMessageId;

    api.send.mockResolvedValueOnce({ message: msg(1, ME, 'are you there', firstId), duplicate: false });
    await press(tree, 'Retry sending message');
    expect(api.send.mock.calls[1]![2].clientMessageId).toBe(firstId);
    expect(allText(tree)).not.toContain('Not sent. Tap to retry');
    expect(allText(tree).filter((x) => x === 'are you there')).toHaveLength(1);
  });

  it('shows a message the server pushes, once, and tells the server it was read', async () => {
    const tree = await open(page([msg(1, 'amara-id', 'hi')]));
    await push('message:new', { chatId: 'conv-1', message: msg(2, 'amara-id', 'new one') });
    expect(allText(tree)).toContain('new one');
    expect(api.markRead).toHaveBeenLastCalledWith('token', 'conv-1', 2);
    await push('message:new', { chatId: 'conv-1', message: msg(2, 'amara-id', 'new one') }); // pushed twice
    expect(allText(tree).filter((x) => x === 'new one')).toHaveLength(1);
    expect(api.messages).toHaveBeenCalledTimes(1); // no polling, no extra fetch
  });

  it('shows my own sent message once even though it arrives twice (HTTP answer and socket push)', async () => {
    let resolveSend!: (v: { message: ChatMessage; duplicate: boolean }) => void;
    api.send.mockReturnValue(new Promise((r) => { resolveSend = r; }));
    const tree = await open(page([]));
    await typeInto(tree, 'Message', 'hello coach');
    await press(tree, 'Send message');
    const sent = api.send.mock.calls[0]![2];
    const saved = msg(1, ME, 'hello coach', sent.clientMessageId);

    await push('message:new', { chatId: 'conv-1', message: saved }); // 1) the socket push wins the race
    await ReactTestRenderer.act(async () => resolveSend({ message: saved, duplicate: false })); // 2) then the HTTP answer
    await push('message:new', { chatId: 'conv-1', message: saved }); // 3) and a repeat, to be sure

    expect(allText(tree).filter((x) => x === 'hello coach')).toHaveLength(1);
    expect(api.markRead).not.toHaveBeenCalled(); // my own message is never "read" by me
  });

  it('shows the connection banner when the live connection is down, and hides it when it is back', async () => {
    const tree = await open(page([msg(1, 'amara-id', 'hi')]));
    const banner = 'Connection lost. Reconnecting…';
    await ReactTestRenderer.act(async () => { useConnectionStore.getState().set('connected'); });
    expect(allText(tree)).not.toContain(banner);
    await ReactTestRenderer.act(async () => { useConnectionStore.getState().set('disconnected'); });
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(2001); }); // the banner waits 2 s before showing
    expect(allText(tree)).toContain(banner);
    await ReactTestRenderer.act(async () => { useConnectionStore.getState().set('connected'); });
    expect(allText(tree)).not.toContain(banner);
  });

  it('tells the app which chat is open (so its new messages are not counted as unread), and clears it on leaving', async () => {
    const tree = await open(page([msg(1, 'amara-id', 'hi')]));
    expect(useActiveChatStore.getState().chatId).toBe('conv-1');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
    expect(useActiveChatStore.getState().chatId).toBeNull();
  });

  describe('group chats', () => {
    const GROUP = groupSummary({ id: 'g1', title: 'Team Alpha', memberCount: 4 });
    const named = (seq: number, senderId: string, body: string, senderName: string) => msg(seq, senderId, body, `cm-${seq}-12345`) && chatMessage(seq, senderId, body, { senderName, clientMessageId: `cm-${seq}-12345` });
    const openGroup = async (first: MessagesPage) => {
      api.messages.mockResolvedValueOnce(first);
      return render(<Chat {...screenProps('Chat', { chat: GROUP })} />);
    };

    it('the header shows the group name and how many people are in it', async () => {
      const tree = await openGroup(page([]));
      expect(allText(tree)).toEqual(expect.arrayContaining(['Team Alpha', '4 people', 'Say hello to the group.']));
    });

    it('tapping the header opens the group info; a direct chat\'s header does nothing', async () => {
      const tree = await openGroup(page([]));
      await press(tree, 'Group info for Team Alpha');
      expect(navigationMock.navigate).toHaveBeenCalledWith('GroupInfo', { chatId: 'g1', title: 'Team Alpha' });
      const direct = await open(page([]));
      expect(direct.root.findAll((n) => n.props.accessibilityLabel?.startsWith?.('Group info') && typeof n.props.onPress === 'function' && !n.props.disabled)).toEqual([]);
    });

    it('shows the sender\'s name above other people\'s messages, once per run, and never above mine', async () => {
      const tree = await openGroup(
        page([named(1, 'ben-id', 'hello', 'Ben Stone'), named(2, 'ben-id', 'anyone there?', 'Ben Stone'), named(3, 'amara-id', 'yes!', 'Amara Okafor'), named(4, ME, 'hi all', 'Me')]),
      );
      const t = allText(tree);
      expect(t.filter((x) => x === 'Ben Stone')).toHaveLength(1); // two messages in a row, one name
      expect(t).toContain('Amara Okafor');
      expect(t.filter((x) => x === 'Me')).toHaveLength(0);
    });

    it('a direct chat never shows names above the bubbles', async () => {
      const tree = await open(page([msg(1, 'amara-id', 'hi')]));
      expect(allText(tree).filter((x) => x === 'Amara Okafor')).toHaveLength(1); // only the header
    });

    it('"Seen by all" once everybody still in the group has read my message', async () => {
      const tree = await openGroup(page([named(1, ME, 'hello team', 'Me')], { otherLastReadSequenceNumber: 0 }));
      expect(allText(tree)).toContain('Sent');
      await push('chat:read', { chatId: 'g1', userId: 'ben-id', lastReadSequenceNumber: 1 });
      expect(allText(tree)).toContain('Seen by all');
    });

    it('the Call button says group calls are coming soon', async () => {
      const tree = await openGroup(page([]));
      await press(tree, 'Audio call');
      expect(lastToast()?.message).toBe('Group calls are coming soon.');
    });
  });

  describe('after a ban the chat is read-only', () => {
    it('shows the history but no text box, with a notice instead', async () => {
      const tree = await open(page([msg(1, 'amara-id', 'last words')], { canSend: false }));
      expect(allText(tree)).toContain('last words');
      expect(allText(tree)).toContain('Amara Okafor is no longer available. You can read this chat but not reply.');
      expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Message' && typeof n.props.onChangeText === 'function')).toEqual([]);
    });

    it('when a send is refused (they were banned while the chat was open), the unsent text is dropped and the chat turns read-only', async () => {
      const tree = await open(page([msg(1, 'amara-id', 'hi')]));
      api.send.mockRejectedValue(new ApiError(403, 'CANNOT_MESSAGE', 'You cannot message this person.'));
      await typeInto(tree, 'Message', 'are you there?');
      await press(tree, 'Send message');
      expect(allText(tree)).not.toContain('are you there?'); // no "Tap to retry" left behind
      expect(allText(tree)).not.toContain('Not sent. Tap to retry');
      expect(allText(tree).some((x) => x.includes('no longer available'))).toBe(true);
      expect(lastToast()?.message).toBe('You cannot message this person.');
    });

    it('opens the text box again when the server says it is allowed (unbanned)', async () => {
      const tree = await open(page([msg(1, 'amara-id', 'hi')], { canSend: false }));
      expect(allText(tree).some((x) => x.includes('no longer available'))).toBe(true);
      api.messages.mockResolvedValue(page([], { canSend: true }));
      await push('connect', undefined); // the catch-up after a reconnect asks the server again
      expect(allText(tree).some((x) => x.includes('no longer available'))).toBe(false);
    });
  });

  it('ignores messages pushed for another chat', async () => {
    const tree = await open(page([msg(1, 'amara-id', 'hi')]));
    await push('message:new', { chatId: 'some-other-chat', message: msg(2, 'x', 'not for this chat') });
    expect(allText(tree)).not.toContain('not for this chat');
  });

  it('fetches what it missed when a pushed message skips a number', async () => {
    const tree = await open(page([msg(1, 'amara-id', 'hi')]));
    api.messages.mockResolvedValue(page([msg(2, 'amara-id', 'two'), msg(3, 'amara-id', 'three')]));
    await push('message:new', { chatId: 'conv-1', message: msg(3, 'amara-id', 'three') }); // number 2 never arrived
    expect(api.messages).toHaveBeenLastCalledWith('token', 'conv-1', { after: 1 });
    expect(allText(tree)).toEqual(expect.arrayContaining(['two', 'three']));
  });

  it('catches up when the connection comes back', async () => {
    await open(page([msg(1, 'amara-id', 'hi')]));
    api.messages.mockResolvedValue(page([msg(2, 'amara-id', 'while offline')]));
    await push('connect', undefined);
    expect(api.messages).toHaveBeenLastCalledWith('token', 'conv-1', { after: 1 });
  });

  it('turns "Sent" into "Seen" when the server says the other person read it', async () => {
    const tree = await open(page([msg(1, ME, 'hello')]));
    expect(allText(tree)).not.toContain('Seen');
    await push('chat:read', { chatId: 'conv-1', userId: 'amara-id', lastReadSequenceNumber: 1 });
    expect(allText(tree)).toContain('Seen');
  });

  it('does not treat my own read (from another device) as "Seen"', async () => {
    const tree = await open(page([msg(1, ME, 'hello')]));
    await push('chat:read', { chatId: 'conv-1', userId: ME, lastReadSequenceNumber: 1 });
    expect(allText(tree)).not.toContain('Seen');
  });

  it('stops listening when the chat closes', async () => {
    const tree = await open(page([msg(1, 'amara-id', 'hi')]));
    expect(fakeSocket.listenerCount('message:new')).toBe(1);
    await ReactTestRenderer.act(async () => { tree.unmount(); });
    expect(fakeSocket.listenerCount('message:new')).toBe(0);
  });

  it('loads older messages when you scroll to the top', async () => {
    const tree = await open(page([msg(3, 'amara-id', 'three'), msg(4, ME, 'four')], { hasMore: true }));
    api.messages.mockResolvedValueOnce(page([msg(1, 'amara-id', 'one'), msg(2, ME, 'two')]));
    await ReactTestRenderer.act(async () => tree.root.findByType(FlatList).props.onEndReached());
    expect(api.messages).toHaveBeenLastCalledWith('token', 'conv-1', { before: 3 });
    expect(allText(tree)).toEqual(expect.arrayContaining(['one', 'two', 'three', 'four']));
    // nothing older is left: reaching the top again asks for nothing
    const calls = api.messages.mock.calls.length;
    await ReactTestRenderer.act(async () => tree.root.findByType(FlatList).props.onEndReached());
    expect(api.messages.mock.calls.length).toBe(calls);
    await settle();
  });

  it('goes back, and the call button says calling is coming soon', async () => {
    api.messages.mockResolvedValueOnce(page([]));
    const tree = await render(<Chat {...screenProps('Chat', { chat: CHAT })} />);
    await press(tree, 'Back to messages');
    expect(navigationMock.goBack).toHaveBeenCalled();
    await press(tree, 'Audio call');
    expect(lastToast()).toMatchObject({ message: 'Calling Amara Okafor is coming soon.', tone: 'info' });
  });
});
