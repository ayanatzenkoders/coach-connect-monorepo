import { FlatList } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { peopleApi, PeoplePage } from '../src/api/peopleApi';
import { useAuthStore } from '../src/auth/authStore';
import { PeopleScreen } from '../src/screens/PeopleScreen';
import { allText, byLabel, clearToast, has, lastToast, press, render, typeInto } from '../test-utils';
import { ApiError } from '../src/api/client';

jest.mock('react-native-keychain', () => ({}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/api/peopleApi', () => ({ peopleApi: { list: jest.fn() } }));

const list = peopleApi.list as jest.Mock;
const coach = (id: string, name: string, specialties: string[], available = true) => ({ id, name, role: 'COACH' as const, specialties, available, bio: '' });
const member = (id: string, name: string) => ({ id, name, role: 'MEMBER' as const });
const page = (p: Partial<PeoplePage>): PeoplePage => ({ items: [], total: 0, nextCursor: null, ...p });

const AMARA = coach('c1', 'Amara Okafor', ['Career transitions', 'New managers', 'Burnout']);
const LENA = coach('c2', 'Lena Fischer', ['Burnout'], false);

const setup = async (first: PeoplePage = page({ items: [AMARA, LENA], total: 2, specialties: ['Burnout', 'Career transitions'] })) => {
  list.mockResolvedValueOnce(first);
  const onMessage = jest.fn();
  const onCall = jest.fn();
  const tree = await render(<PeopleScreen onMessage={onMessage} onCall={onCall} />);
  return { tree, onMessage, onCall };
};
const lastQuery = () => list.mock.calls[list.mock.calls.length - 1][1];
const wait = (ms: number) => ReactTestRenderer.act(async () => void jest.advanceTimersByTime(ms));

beforeEach(() => {
  jest.useFakeTimers();
  list.mockReset();
  clearToast();
  useAuthStore.setState({ accessToken: 'token' });
});
afterEach(() => jest.useRealTimers());

describe('PeopleScreen', () => {
  it('shows coaches with their specialty tags, availability and total', async () => {
    const { tree } = await setup();
    expect(list).toHaveBeenCalledWith('token', expect.objectContaining({ kind: 'coaches' }));
    const t = allText(tree);
    expect(t).toEqual(expect.arrayContaining(['Amara Okafor', 'Career transitions', 'New managers', '+1', 'Available now', 'Lena Fischer', 'Not available']));
    expect(t).toContain('2 coaches');
  });

  it('builds the filter chips from the specialties the server sent', async () => {
    const { tree } = await setup();
    for (const label of ['Filter: Available now', 'Filter: Burnout', 'Filter: Career transitions']) expect(has(tree, label)).toBe(true);
  });

  it('disables Call for a coach who is not available, and lets you call an available one', async () => {
    const { tree, onCall, onMessage } = await setup();
    expect(byLabel(tree, "Lena Fischer can't take calls right now").props.disabled).toBe(true);
    await press(tree, 'Call Amara Okafor');
    expect(onCall).toHaveBeenCalledWith(AMARA);
    await press(tree, 'Message Lena Fischer');
    expect(onMessage).toHaveBeenCalledWith(LENA);
  });

  it('switches to Members: asks for members, shows the one-to-one hint and no coach chips', async () => {
    const { tree } = await setup();
    list.mockResolvedValueOnce(page({ items: [member('m1', 'Bob Stone')], total: 1 }));
    await press(tree, 'Members');
    expect(lastQuery()).toMatchObject({ kind: 'members' });
    expect(allText(tree)).toEqual(expect.arrayContaining(['Bob Stone', 'Member', '1 member']));
    expect(allText(tree).some((x) => x.startsWith('Calls between members are one-to-one'))).toBe(true);
    expect(has(tree, 'Filter: Available now')).toBe(false);
  });

  it('searches 300 ms after typing stops, once', async () => {
    const { tree } = await setup();
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
    const { tree } = await setup();
    list.mockResolvedValue(page({ items: [AMARA], total: 1 }));
    await press(tree, 'Filter: Burnout');
    expect(lastQuery()).toMatchObject({ specialty: 'Burnout' });
    await press(tree, 'Filter: Available now');
    expect(lastQuery()).toMatchObject({ specialty: 'Burnout', available: true });
    await press(tree, 'Filter: Burnout');
    expect(lastQuery().specialty).toBeUndefined();
  });

  it('loads the next page with the cursor and appends it', async () => {
    const { tree } = await setup(page({ items: [AMARA], total: 2, nextCursor: 'CUR1' }));
    list.mockResolvedValueOnce(page({ items: [LENA], total: 2, nextCursor: null }));
    await ReactTestRenderer.act(async () => tree.root.findByType(FlatList).props.onEndReached());
    expect(lastQuery()).toMatchObject({ cursor: 'CUR1' });
    expect(allText(tree)).toEqual(expect.arrayContaining(['Amara Okafor', 'Lena Fischer']));
    // no more pages: reaching the end again asks for nothing
    await ReactTestRenderer.act(async () => tree.root.findByType(FlatList).props.onEndReached());
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('says so when nothing matches', async () => {
    const { tree } = await setup(page({ items: [], total: 0, specialties: ['Burnout'] }));
    expect(allText(tree)).toContain('No coaches yet');
    list.mockResolvedValue(page({}));
    await press(tree, 'Filter: Burnout');
    expect(allText(tree)).toContain('No coaches match that');
  });

  it('shows a toast when the server fails, and keeps what was on screen', async () => {
    const { tree } = await setup();
    list.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.'));
    await press(tree, 'Filter: Burnout');
    expect(lastToast()?.message).toContain('Cannot reach the server');
  });

  it('ignores a slow answer that arrives after a newer search', async () => {
    const { tree } = await setup();
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
