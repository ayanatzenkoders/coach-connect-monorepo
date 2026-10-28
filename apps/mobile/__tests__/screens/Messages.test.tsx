import ReactTestRenderer from 'react-test-renderer';
import Messages from '@/src/screens/home/messages/Messages';
import { chatSummary, groupSummary } from '../../test-utils/chat';
import { fakeSocket } from '../../test-utils/socket';
import { chatApi, ChatSummary } from '@/src/service/api/chat.api';
import { useAuthStore } from '@/src/store/auth.store';
import { ApiError } from '@/src/service/setup/apiClient';
import { allText, clearToast, focusState, lastToast, navigationMock, press, render, resetNavigationMock } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { chats: jest.fn() } }));

const chats = chatApi.chats as jest.Mock;
const ME = 'me-id';
const conv = ({ name, ...over }: Partial<ChatSummary> & { name: string }): ChatSummary =>
  chatSummary({
    id: `c-${name}`,
    title: name,
    other: { id: `u-${name}`, name, role: 'COACH' },
    lastMessageSequenceNumber: 2,
    lastMessageAt: new Date().toISOString(),
    lastMessage: { senderId: `u-${name}`, senderName: name, body: 'Hello there', createdAt: new Date().toISOString() },
    ...over,
  });

beforeEach(() => {
  jest.useFakeTimers();
  chats.mockReset();
  fakeSocket.reset();
  resetNavigationMock();
  clearToast();
  useAuthStore.setState({ accessToken: 'token', user: { id: ME, email: 'me@x.com', name: 'Me', role: 'MEMBER', emailVerified: true } });
});
afterEach(() => jest.useRealTimers());

const setup = () => render(<Messages />);

describe('Messages screen', () => {
  it('lists chats with preview, unread badge and a "You:" prefix for my own last message', async () => {
    chats.mockResolvedValue({
      items: [
        conv({ name: 'Amara', unreadCount: 2, lastMessage: { senderId: 'u-Amara', senderName: 'Amara', body: 'Send it over', createdAt: new Date().toISOString() } }),
        conv({ name: 'Ben', lastMessage: { senderId: ME, senderName: 'Me', body: 'Thanks!', createdAt: new Date().toISOString() } }),
      ],
    });
    const tree = await setup();
    const t = allText(tree);
    expect(t).toEqual(expect.arrayContaining(['Amara', 'Send it over', 'Ben', 'You: Thanks!']));
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === '2 unread').length).toBeGreaterThan(0);
  });

  it('opens the Chat screen when a chat is tapped', async () => {
    const amara = conv({ name: 'Amara' });
    chats.mockResolvedValue({ items: [amara] });
    const tree = await setup();
    await press(tree, 'Open chat with Amara');
    expect(navigationMock.navigate).toHaveBeenCalledWith('Chat', { chat: amara });
  });

  describe('groups', () => {
    const group = (over = {}) => groupSummary({ id: 'g1', title: 'Team Alpha', lastMessageAt: new Date().toISOString(), ...over });

    it('a group row shows the group name, and the first name of who wrote last', async () => {
      chats.mockResolvedValue({ items: [group({ lastMessage: { senderId: 'u-amara', senderName: 'Amara Okafor', body: 'see you Friday', createdAt: new Date().toISOString() } })] });
      const t = allText(await setup());
      expect(t).toEqual(expect.arrayContaining(['Team Alpha', 'Amara: see you Friday']));
    });

    it('my own last message in a group says "You:"', async () => {
      chats.mockResolvedValue({ items: [group({ lastMessage: { senderId: ME, senderName: 'Me', body: 'hello', createdAt: new Date().toISOString() } })] });
      expect(allText(await setup())).toContain('You: hello');
    });

    it('a new group with no messages yet says so', async () => {
      chats.mockResolvedValue({ items: [group({ lastMessage: null })] });
      expect(allText(await setup())).toContain('No messages yet');
    });

    it('opening a group row opens that chat', async () => {
      const g = group();
      chats.mockResolvedValue({ items: [g] });
      const tree = await setup();
      await press(tree, 'Open group Team Alpha');
      expect(navigationMock.navigate).toHaveBeenCalledWith('Chat', { chat: g });
    });
  });

  it('the + button opens the New group screen', async () => {
    chats.mockResolvedValue({ items: [] });
    const tree = await setup();
    await press(tree, 'New group');
    expect(navigationMock.navigate).toHaveBeenCalledWith('NewGroup');
  });

  it('a chat with a banned person stays in the list (the history is still readable)', async () => {
    chats.mockResolvedValue({ items: [conv({ name: 'Banned Ben', canSend: false })] });
    expect(allText(await setup())).toContain('Banned Ben');
  });

  it('explains how to start when there are no chats', async () => {
    chats.mockResolvedValue({ items: [] });
    const tree = await setup();
    expect(allText(tree)).toContain('No messages yet');
  });

  it('does not poll on a timer and does not listen to the socket itself (the tab bar keeps the shared list live)', async () => {
    chats.mockResolvedValue({ items: [] });
    await setup();
    expect(chats).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(60_000); });
    expect(chats).toHaveBeenCalledTimes(1);
    expect(fakeSocket.listenerCount('message:new')).toBe(0);
  });

  it('does not load while another screen (a chat) is on top', async () => {
    chats.mockResolvedValue({ items: [] });
    focusState.focused = false;
    await setup();
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(60_000); });
    expect(chats).not.toHaveBeenCalled();
  });

  it('shows a toast when the first load fails', async () => {
    chats.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    await setup();
    expect(lastToast()?.message).toBe('Cannot reach the server.');
  });
});
