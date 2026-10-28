import ReactTestRenderer from 'react-test-renderer';
import Messages from '@/src/screens/home/messages/Messages';
import { fakeSocket } from '../../test-utils/socket';
import { chatApi, ChatSummary } from '@/src/service/api/chat.api';
import { useAuthStore } from '@/src/store/auth.store';
import { ApiError } from '@/src/service/setup/apiClient';
import { allText, clearToast, focusState, lastToast, navigationMock, press, render, resetNavigationMock } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { chats: jest.fn() } }));

const chats = chatApi.chats as jest.Mock;
const ME = 'me-id';
const conv = (over: Partial<ChatSummary> & { name: string }): ChatSummary => ({
  id: `c-${over.name}`,
  other: { id: `u-${over.name}`, name: over.name, role: 'COACH' },
  lastMessageSequenceNumber: 2,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  lastMessage: { senderId: `u-${over.name}`, body: 'Hello there', createdAt: new Date().toISOString() },
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
        conv({ name: 'Amara', unreadCount: 2, lastMessage: { senderId: 'u-Amara', body: 'Send it over', createdAt: new Date().toISOString() } }),
        conv({ name: 'Ben', lastMessage: { senderId: ME, body: 'Thanks!', createdAt: new Date().toISOString() } }),
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

  it('explains how to start when there are no chats', async () => {
    chats.mockResolvedValue({ items: [] });
    const tree = await setup();
    expect(allText(tree)).toContain('No messages yet');
  });

  it('reloads the list when the server pushes a new message or a read', async () => {
    chats.mockResolvedValue({ items: [] });
    await setup();
    expect(chats).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(async () => { fakeSocket.receive('message:new', { chatId: 'c1' }); });
    expect(chats).toHaveBeenCalledTimes(2);
    await ReactTestRenderer.act(async () => { fakeSocket.receive('chat:read', { chatId: 'c1' }); });
    expect(chats).toHaveBeenCalledTimes(3);
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(60_000); }); // and it does NOT poll on a timer any more
    expect(chats).toHaveBeenCalledTimes(3);
  });

  it('does not load while another screen (a chat) is on top', async () => {
    chats.mockResolvedValue({ items: [] });
    focusState.focused = false;
    await setup();
    await ReactTestRenderer.act(async () => { fakeSocket.receive('message:new', { chatId: 'c1' }); });
    expect(chats).not.toHaveBeenCalled();
  });

  it('shows a toast when the first load fails', async () => {
    chats.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    await setup();
    expect(lastToast()?.message).toBe('Cannot reach the server.');
  });
});
