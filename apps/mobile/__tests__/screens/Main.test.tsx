import ReactTestRenderer from 'react-test-renderer';
import Main from '@/src/screens/home/main/Main';
import { chatApi, ChatSummary } from '@/src/service/api/chat.api';
import { peopleApi } from '@/src/service/api/people.api';
import { useActiveChatStore } from '@/src/store/activeChat.store';
import { useAuthStore } from '@/src/store/auth.store';
import { StackActions } from '@react-navigation/native';
import { clearToast, has, lastToast, navigationMock, press, render, resetNavigationMock, screenProps, Tree } from '@/test-utils';
import { chatSummary } from '../../test-utils/chat';
import { fakeSocket } from '../../test-utils/socket';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/people.api', () => ({ peopleApi: { list: jest.fn() } }));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { chats: jest.fn() } }));

const chats = chatApi.chats as jest.Mock;
const people = peopleApi.list as jest.Mock;
const ME = 'me-id';

const chat = (id: string, last: number, unread: number): ChatSummary =>
  chatSummary({ id, lastMessageSequenceNumber: last, unreadCount: unread, lastMessageAt: '2026-10-27T10:00:00.000Z', lastMessage: { senderId: `other-${id}`, senderName: `Person ${id}`, body: 'hi', createdAt: '2026-10-27T10:00:00.000Z' } });
const message = (chatId: string, sequenceNumber: number, senderId = `other-${chatId}`) => ({
  chatId,
  message: { id: `m-${chatId}-${sequenceNumber}`, sequenceNumber, senderId, senderName: 'Someone', body: 'new!', clientMessageId: `client-${chatId}-${sequenceNumber}`, createdAt: '2026-10-28T09:00:00.000Z' },
});

const open = async (items: ChatSummary[]) => {
  chats.mockResolvedValue({ items });
  return render(<Main {...screenProps('Main')} />);
};
/** The number inside the badge on the Messages tab, or null when there is no badge. */
const badge = (tree: Tree): string | null => {
  const node = tree.root.findAll((n) => n.props.testID === 'messages-unread-badge')[0];
  if (!node) return null;
  return node.findAll((n) => (n.type as unknown) === 'Text').map((t) => [t.props.children].flat().join(''))[0] ?? null;
};
const push = (event: string, payload: unknown) => ReactTestRenderer.act(async () => { fakeSocket.receive(event, payload); });

beforeEach(() => {
  jest.useFakeTimers();
  fakeSocket.reset();
  chats.mockReset();
  people.mockReset();
  people.mockResolvedValue({ items: [], total: 0, nextCursor: null, specialties: [] });
  resetNavigationMock();
  useActiveChatStore.setState({ chatId: null });
  useAuthStore.setState({ accessToken: 'token', user: { id: ME, email: 'me@x.com', name: 'Me', role: 'MEMBER', emailVerified: true } });
});
afterEach(() => jest.useRealTimers());

describe('unread badge on the Messages tab', () => {
  it('shows the sum of every chat\'s unread messages while another tab (People) is on screen', async () => {
    const tree = await open([chat('a', 5, 2), chat('b', 3, 1), chat('c', 9, 4)]);
    expect(badge(tree)).toBe('7');
    expect(has(tree, 'Messages, 7 unread')).toBe(true); // screen readers hear the count too
  });

  it('shows no badge when everything is read, and the tab keeps its plain name', async () => {
    const tree = await open([chat('a', 5, 0)]);
    expect(badge(tree)).toBeNull();
    expect(has(tree, 'Messages')).toBe(true);
  });

  it('caps a big number at 99+', async () => {
    const tree = await open([chat('a', 300, 150)]);
    expect(badge(tree)).toBe('99+');
  });

  it('goes up the moment a message is pushed, with no new request', async () => {
    const tree = await open([chat('a', 5, 0), chat('b', 3, 1)]);
    expect(badge(tree)).toBe('1');
    await push('message:new', message('a', 6));
    expect(badge(tree)).toBe('2');
    await push('message:new', message('b', 4));
    expect(badge(tree)).toBe('3');
    expect(chats).toHaveBeenCalledTimes(1);
  });

  it('counts a repeated push once', async () => {
    const tree = await open([chat('a', 5, 0)]);
    await push('message:new', message('a', 6));
    await push('message:new', message('a', 6));
    expect(badge(tree)).toBe('1');
  });

  it('does not count a message that arrives in the chat that is open on screen', async () => {
    const tree = await open([chat('a', 5, 0)]);
    useActiveChatStore.setState({ chatId: 'a' });
    await push('message:new', message('a', 6));
    expect(badge(tree)).toBeNull();
  });

  it('does not count my own messages (sent from another device)', async () => {
    const tree = await open([chat('a', 5, 0)]);
    await push('message:new', message('a', 6, ME));
    expect(badge(tree)).toBeNull();
  });

  it('goes down when I read a chat (here or on another device), and ignores the OTHER person reading', async () => {
    const tree = await open([chat('a', 10, 6), chat('b', 4, 1)]);
    expect(badge(tree)).toBe('7');
    await push('chat:read', { chatId: 'a', userId: 'other-a', lastReadSequenceNumber: 10 }); // not me: no change
    expect(badge(tree)).toBe('7');
    await push('chat:read', { chatId: 'a', userId: ME, lastReadSequenceNumber: 10 });
    expect(badge(tree)).toBe('1');
  });

  it('a new group I was added to shows up (and its unread) without opening anything', async () => {
    const tree = await open([chat('a', 5, 0)]);
    chats.mockResolvedValue({ items: [chat('a', 5, 0), chatSummary({ id: 'g1', type: 'GROUP', title: 'Team', other: null, unreadCount: 2, lastMessageSequenceNumber: 2, lastMessageAt: '2026-10-28T09:00:00.000Z' })] });
    await push('chat:created', { chatId: 'g1' });
    expect(chats).toHaveBeenCalledTimes(2);
    expect(badge(tree)).toBe('2');
  });

  it('"chat:updated" (someone was added to a group) reloads the list', async () => {
    await open([chat('a', 5, 0)]);
    await push('chat:updated', { chatId: 'a' });
    expect(chats).toHaveBeenCalledTimes(2);
  });

  it('"chat:deleted" removes the group from the list and its unread from the badge', async () => {
    const tree = await open([chat('a', 5, 2), chat('g', 3, 4)]);
    expect(badge(tree)).toBe('6');
    await push('chat:deleted', { chatId: 'g' });
    expect(badge(tree)).toBe('2');
    expect(chats).toHaveBeenCalledTimes(1); // patched from the event: no request
    expect(navigationMock.dispatch).not.toHaveBeenCalled(); // I was not inside it
  });

  it('"chat:deleted" while I am inside that group sends me back to the tab bar and says why', async () => {
    clearToast();
    await open([chat('g', 3, 0)]);
    useActiveChatStore.setState({ chatId: 'g' });
    await push('chat:deleted', { chatId: 'g' });
    expect(navigationMock.dispatch).toHaveBeenCalledWith(StackActions.popToTop());
    expect(lastToast()?.message).toBe('This group was deleted.');
  });

  it('"chat:deleted" for a chat that is already gone changes nothing (the creator cleaned up first)', async () => {
    clearToast();
    await open([chat('a', 5, 0)]);
    useActiveChatStore.setState({ chatId: 'g' });
    await push('chat:deleted', { chatId: 'g' });
    expect(navigationMock.dispatch).not.toHaveBeenCalled();
    expect(lastToast()).toBeNull();
  });

  it('reloads from the server when it cannot be sure: a missed message number, or a chat it has not seen', async () => {
    const tree = await open([chat('a', 5, 0)]);
    chats.mockResolvedValue({ items: [chat('a', 8, 3)] });
    await push('message:new', message('a', 8)); // numbers 6 and 7 never arrived
    expect(chats).toHaveBeenCalledTimes(2);
    expect(badge(tree)).toBe('3');
    chats.mockResolvedValue({ items: [chat('a', 8, 3), chat('new', 1, 1)] });
    await push('message:new', message('new', 1)); // a chat this phone has never listed
    expect(chats).toHaveBeenCalledTimes(3);
    expect(badge(tree)).toBe('4');
  });

  it('reloads when the connection comes back (events may have been missed while it was down)', async () => {
    const tree = await open([chat('a', 5, 0)]);
    chats.mockResolvedValue({ items: [chat('a', 7, 2)] });
    await push('connect', undefined);
    expect(badge(tree)).toBe('2');
  });

  it('is also visible on the Messages tab itself, and stops listening when the screen goes away', async () => {
    const tree = await open([chat('a', 5, 2)]);
    chats.mockResolvedValue({ items: [chat('a', 5, 2)] });
    await press(tree, 'Messages, 2 unread');
    expect(badge(tree)).toBe('2');
    await ReactTestRenderer.act(async () => { tree.unmount(); });
    expect(fakeSocket.listenerCount('message:new')).toBe(0);
  });
});
