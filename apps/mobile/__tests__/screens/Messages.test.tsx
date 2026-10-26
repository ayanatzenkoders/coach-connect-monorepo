import ReactTestRenderer from 'react-test-renderer';
import Messages from '@/src/screens/home/messages/Messages';
import { MESSAGES_POLL_MS } from '@/src/screens/home/messages/hook/useMessages';
import { chatApi, ConversationSummary } from '@/src/service/api/chat.api';
import { useAuthStore } from '@/src/store/auth.store';
import { ApiError } from '@/src/service/setup/apiClient';
import { allText, clearToast, focusState, lastToast, navigationMock, press, render, resetNavigationMock } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { conversations: jest.fn() } }));

const conversations = chatApi.conversations as jest.Mock;
const ME = 'me-id';
const conv = (over: Partial<ConversationSummary> & { name: string }): ConversationSummary => ({
  id: `c-${over.name}`,
  other: { id: `u-${over.name}`, name: over.name, role: 'COACH' },
  lastSeq: 2,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  lastMessage: { senderId: `u-${over.name}`, body: 'Hello there', createdAt: new Date().toISOString() },
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers();
  conversations.mockReset();
  resetNavigationMock();
  clearToast();
  useAuthStore.setState({ accessToken: 'token', user: { id: ME, email: 'me@x.com', name: 'Me', role: 'MEMBER', emailVerified: true } });
});
afterEach(() => jest.useRealTimers());

const setup = () => render(<Messages />);

describe('Messages screen', () => {
  it('lists conversations with preview, unread badge and a "You:" prefix for my own last message', async () => {
    conversations.mockResolvedValue({
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

  it('opens the Chat screen when a conversation is tapped', async () => {
    const amara = conv({ name: 'Amara' });
    conversations.mockResolvedValue({ items: [amara] });
    const tree = await setup();
    await press(tree, 'Open chat with Amara');
    expect(navigationMock.navigate).toHaveBeenCalledWith('Chat', { conversation: amara });
  });

  it('explains how to start when there are no conversations', async () => {
    conversations.mockResolvedValue({ items: [] });
    const tree = await setup();
    expect(allText(tree)).toContain('No messages yet');
  });

  it('refreshes every few seconds while it is the visible screen', async () => {
    conversations.mockResolvedValue({ items: [] });
    await setup();
    expect(conversations).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(MESSAGES_POLL_MS); });
    expect(conversations).toHaveBeenCalledTimes(2);
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(MESSAGES_POLL_MS); });
    expect(conversations).toHaveBeenCalledTimes(3);
  });

  it('does not load or poll while another screen (a chat) is on top', async () => {
    conversations.mockResolvedValue({ items: [] });
    focusState.focused = false;
    await setup();
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(MESSAGES_POLL_MS * 3); });
    expect(conversations).not.toHaveBeenCalled();
  });

  it('shows a toast when the first load fails', async () => {
    conversations.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    await setup();
    expect(lastToast()?.message).toBe('Cannot reach the server.');
  });
});
