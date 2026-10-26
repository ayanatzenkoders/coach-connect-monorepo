import { FlatList } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import Chat from '@/src/screens/home/chat/Chat';
import { CHAT_POLL_MS, mergeMessages } from '@/src/screens/home/chat/hook/useChat';
import { chatApi, ChatMessage, ConversationSummary, MessagesPage } from '@/src/service/api/chat.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, byLabel, clearToast, lastToast, navigationMock, press, render, resetNavigationMock, screenProps, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { messages: jest.fn(), send: jest.fn(), markRead: jest.fn() } }));

const api = chatApi as unknown as Record<'messages' | 'send' | 'markRead', jest.Mock>;
const ME = 'me-id';
const CONVERSATION: ConversationSummary = {
  id: 'conv-1',
  other: { id: 'amara-id', name: 'Amara Okafor', role: 'COACH' },
  lastSeq: 0,
  unreadCount: 0,
  lastMessageAt: null,
  lastMessage: null,
};
const msg = (seq: number, senderId: string, body: string, clientMsgId = `cm-${seq}-12345`): ChatMessage => ({
  id: `id-${seq}`,
  seq,
  senderId,
  body,
  clientMsgId,
  createdAt: new Date().toISOString(),
});
const page = (items: ChatMessage[], over: Partial<MessagesPage> = {}): MessagesPage => ({
  items,
  hasMore: false,
  lastSeq: items.length ? items[items.length - 1]!.seq : 0,
  otherReadSeq: 0,
  ...over,
});
const open = async (first: MessagesPage) => {
  api.messages.mockResolvedValueOnce(first);
  return render(<Chat {...screenProps('Chat', { conversation: CONVERSATION })} />);
};
const settle = () => ReactTestRenderer.act(async () => { jest.advanceTimersByTime(0); });
const poll = () => ReactTestRenderer.act(async () => { jest.advanceTimersByTime(CHAT_POLL_MS); });

beforeEach(() => {
  jest.useFakeTimers();
  resetNavigationMock();
  Object.values(api).forEach((f) => f.mockReset());
  api.markRead.mockResolvedValue({ readSeq: 1 });
  clearToast();
  useAuthStore.setState({ accessToken: 'token', user: { id: ME, email: 'me@x.com', name: 'Me', role: 'MEMBER', emailVerified: true } });
});
afterEach(() => jest.useRealTimers());

describe('mergeMessages', () => {
  it('keeps saved messages in order, unsent last, and never duplicates', () => {
    const sending = { clientMsgId: 'mine-1-12345', senderId: ME, body: 'hi', createdAt: '', status: 'sending' as const };
    const step1 = mergeMessages([], [msg(2, 'x', 'b'), msg(1, 'x', 'a')]);
    const step2 = mergeMessages([...step1, sending], [msg(3, ME, 'hi', 'mine-1-12345')]);
    expect(step2.map((m) => [m.seq, m.status])).toEqual([
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
    const tree = await open(page([msg(1, ME, 'Hello')], { otherReadSeq: 1 }));
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
    expect(sent.clientMsgId.length).toBeGreaterThanOrEqual(8);
    await ReactTestRenderer.act(async () => resolve({ message: msg(1, ME, 'hello coach', sent.clientMsgId), duplicate: false }));
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
    const firstId = api.send.mock.calls[0]![2].clientMsgId;

    api.send.mockResolvedValueOnce({ message: msg(1, ME, 'are you there', firstId), duplicate: false });
    await press(tree, 'Retry sending message');
    expect(api.send.mock.calls[1]![2].clientMsgId).toBe(firstId);
    expect(allText(tree)).not.toContain('Not sent. Tap to retry');
    expect(allText(tree).filter((x) => x === 'are you there')).toHaveLength(1);
  });

  it('fetches only newer messages every few seconds, and shows them once', async () => {
    const tree = await open(page([msg(1, 'amara-id', 'hi')]));
    api.messages.mockResolvedValue(page([msg(2, 'amara-id', 'new one')], { otherReadSeq: 0 }));
    await poll();
    expect(api.messages).toHaveBeenLastCalledWith('token', 'conv-1', { after: 1 });
    expect(allText(tree)).toContain('new one');
    expect(api.markRead).toHaveBeenLastCalledWith('token', 'conv-1', 2);
    api.messages.mockResolvedValue(page([msg(2, 'amara-id', 'new one')]));
    await poll();
    expect(allText(tree).filter((x) => x === 'new one')).toHaveLength(1);
  });

  it('turns "Sent" into "Seen" when a refresh says the other person read it', async () => {
    const tree = await open(page([msg(1, ME, 'hello')]));
    api.messages.mockResolvedValue(page([], { otherReadSeq: 1 }));
    await poll();
    expect(allText(tree)).toContain('Seen');
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
    const tree = await render(<Chat {...screenProps('Chat', { conversation: CONVERSATION })} />);
    await press(tree, 'Back to messages');
    expect(navigationMock.goBack).toHaveBeenCalled();
    await press(tree, 'Audio call');
    expect(lastToast()).toMatchObject({ message: 'Calling Amara Okafor is coming soon.', tone: 'info' });
  });
});
