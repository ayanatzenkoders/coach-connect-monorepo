import { FlatList } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import People from '@/src/screens/home/people/People';
import { chatApi, ConversationSummary } from '@/src/service/api/chat.api';
import { peopleApi, PeoplePage } from '@/src/service/api/people.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, byLabel, clearToast, has, lastToast, navigationMock, press, render, resetNavigationMock, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/people.api', () => ({ peopleApi: { list: jest.fn() } }));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { open: jest.fn() } }));

const list = peopleApi.list as jest.Mock;
const open = chatApi.open as jest.Mock;
const coach = (id: string, name: string, specialties: string[], available = true) => ({ id, name, role: 'COACH' as const, specialties, available, bio: '' });
const member = (id: string, name: string) => ({ id, name, role: 'MEMBER' as const });
const page = (p: Partial<PeoplePage>): PeoplePage => ({ items: [], total: 0, nextCursor: null, ...p });

const AMARA = coach('c1', 'Amara Okafor', ['Career transitions', 'New managers', 'Burnout']);
const LENA = coach('c2', 'Lena Fischer', ['Burnout'], false);

const setup = async (first: PeoplePage = page({ items: [AMARA, LENA], total: 2, specialties: ['Burnout', 'Career transitions'] })) => {
  list.mockResolvedValueOnce(first);
  return render(<People />);
};
const lastQuery = () => list.mock.calls[list.mock.calls.length - 1][1];
const wait = (ms: number) => ReactTestRenderer.act(async () => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  list.mockReset();
  open.mockReset();
  clearToast();
  resetNavigationMock();
  useAuthStore.setState({ accessToken: 'token' });
});
afterEach(() => jest.useRealTimers());

describe('People screen', () => {
  it('shows coaches with their specialty tags, availability and total', async () => {
    const tree = await setup();
    expect(list).toHaveBeenCalledWith('token', expect.objectContaining({ kind: 'coaches' }));
    const t = allText(tree);
    expect(t).toEqual(expect.arrayContaining(['Amara Okafor', 'Career transitions', 'New managers', '+1', 'Available now', 'Lena Fischer', 'Not available']));
    expect(t).toContain('2 coaches');
  });

  it('builds the filter chips from the specialties the server sent', async () => {
    const tree = await setup();
    for (const label of ['Filter: Available now', 'Filter: Burnout', 'Filter: Career transitions']) expect(has(tree, label)).toBe(true);
  });

  it('disables Call for a coach who is not available; Call for an available one says "coming soon"', async () => {
    const tree = await setup();
    expect(byLabel(tree, "Lena Fischer can't take calls right now").props.disabled).toBe(true);
    await press(tree, 'Call Amara Okafor');
    expect(lastToast()).toMatchObject({ message: 'Calling Amara Okafor is coming soon.', tone: 'info' });
  });

  it('the chat button opens (or creates) the conversation and shows the Chat screen', async () => {
    const tree = await setup();
    const conversation: ConversationSummary = { id: 'conv-1', other: { id: 'c2', name: 'Lena Fischer', role: 'COACH' }, lastSeq: 0, unreadCount: 0, lastMessageAt: null, lastMessage: null };
    open.mockResolvedValue(conversation);
    await press(tree, 'Message Lena Fischer');
    expect(open).toHaveBeenCalledWith('token', 'c2');
    expect(navigationMock.navigate).toHaveBeenCalledWith('Chat', { conversation });
  });

  it('shows a toast, and does not navigate, when the chat cannot be opened', async () => {
    const tree = await setup();
    open.mockRejectedValue(new ApiError(404, 'USER_NOT_FOUND', 'That person is not available.'));
    await press(tree, 'Message Lena Fischer');
    expect(lastToast()?.message).toBe('That person is not available.');
    expect(navigationMock.navigate).not.toHaveBeenCalled();
  });

  it('switches to Members: asks for members, shows the one-to-one hint and no coach chips', async () => {
    const tree = await setup();
    list.mockResolvedValueOnce(page({ items: [member('m1', 'Bob Stone')], total: 1 }));
    await press(tree, 'Members');
    expect(lastQuery()).toMatchObject({ kind: 'members' });
    expect(allText(tree)).toEqual(expect.arrayContaining(['Bob Stone', 'Member', '1 member']));
    expect(allText(tree).some((x) => x.startsWith('Calls between members are one-to-one'))).toBe(true);
    expect(has(tree, 'Filter: Available now')).toBe(false);
  });

  it('never shows the Coaches list under the Members tab while members load', async () => {
    const tree = await setup();
    list.mockImplementationOnce(() => new Promise(() => {})); // members never arrive
    await press(tree, 'Members');
    expect(allText(tree)).not.toContain('Amara Okafor');
  });

  it('searches 300 ms after typing stops, once', async () => {
    const tree = await setup();
    list.mockResolvedValue(page({ items: [AMARA], total: 1 }));
    await typeInto(tree, 'Search people', 'a');
    await typeInto(tree, 'Search people', 'ama');
    await wait(299);
    expect(list).toHaveBeenCalledTimes(1);
    await wait(2);
    expect(list).toHaveBeenCalledTimes(2);
    expect(lastQuery()).toMatchObject({ kind: 'coaches', q: 'ama' });
    expect(allText(tree)).toContain('1 coach');
  });

  it('sends the specialty and "available now" filters, and clears them when tapped again', async () => {
    const tree = await setup();
    list.mockResolvedValue(page({ items: [AMARA], total: 1 }));
    await press(tree, 'Filter: Burnout');
    expect(lastQuery()).toMatchObject({ specialty: 'Burnout' });
    await press(tree, 'Filter: Available now');
    expect(lastQuery()).toMatchObject({ specialty: 'Burnout', available: true });
    await press(tree, 'Filter: Burnout');
    expect(lastQuery().specialty).toBeUndefined();
  });

  it('loads the next page with the cursor and appends it', async () => {
    const tree = await setup(page({ items: [AMARA], total: 2, nextCursor: 'CUR1' }));
    list.mockResolvedValueOnce(page({ items: [LENA], total: 2, nextCursor: null }));
    await ReactTestRenderer.act(async () => tree.root.findByType(FlatList).props.onEndReached());
    expect(lastQuery()).toMatchObject({ cursor: 'CUR1' });
    expect(allText(tree)).toEqual(expect.arrayContaining(['Amara Okafor', 'Lena Fischer']));
    // no more pages: reaching the end again asks for nothing
    await ReactTestRenderer.act(async () => tree.root.findByType(FlatList).props.onEndReached());
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('says so when nothing matches', async () => {
    const tree = await setup(page({ items: [], total: 0, specialties: ['Burnout'] }));
    expect(allText(tree)).toContain('No coaches yet');
    list.mockResolvedValue(page({}));
    await press(tree, 'Filter: Burnout');
    expect(allText(tree)).toContain('No coaches match that');
  });

  it('shows a toast when the server fails', async () => {
    const tree = await setup();
    list.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.'));
    await press(tree, 'Filter: Burnout');
    expect(lastToast()?.message).toContain('Cannot reach the server');
  });

  it('ignores a slow answer that arrives after a newer search', async () => {
    const tree = await setup();
    let slow!: (p: PeoplePage) => void;
    list.mockImplementationOnce(() => new Promise<PeoplePage>((r) => (slow = r)));
    await press(tree, 'Filter: Burnout'); // request A (slow)
    list.mockResolvedValueOnce(page({ items: [LENA], total: 1 }));
    await press(tree, 'Filter: Available now'); // request B (fast, newer)
    await ReactTestRenderer.act(async () => slow(page({ items: [AMARA], total: 1 })));
    const t = allText(tree);
    expect(t).toContain('Lena Fischer');
    expect(t).not.toContain('Amara Okafor');
  });
});
