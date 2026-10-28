import { StackActions } from '@react-navigation/native';
import ReactTestRenderer from 'react-test-renderer';
import NewGroup from '@/src/screens/home/newGroup/NewGroup';
import { chatApi } from '@/src/service/api/chat.api';
import { peopleApi, PeoplePage } from '@/src/service/api/people.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, byLabel, clearToast, has, lastToast, navigationMock, press, render, resetNavigationMock, screenProps, typeInto } from '@/test-utils';
import { groupSummary } from '../../test-utils/chat';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/people.api', () => ({ peopleApi: { list: jest.fn() } }));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { createGroup: jest.fn() } }));

const list = peopleApi.list as jest.Mock;
const createGroup = chatApi.createGroup as jest.Mock;
const member = (id: string, name: string) => ({ id, name, role: 'MEMBER' as const });
const coach = (id: string, name: string) => ({ id, name, role: 'COACH' as const, specialties: ['Burnout'], available: true, bio: '' });
const page = (items: PeoplePage['items']): PeoplePage => ({ items, total: items.length, nextCursor: null });

const MEMBERS = [member('m1', 'Ben Stone'), member('m2', 'Cara Lee'), member('m3', 'Dan Moss')];
const COACHES = [coach('c1', 'Amara Okafor'), coach('c2', 'Lena Fischer')];

/** The Members tab shows first; the Coaches tab shows the coaches. */
const answerPeople = () => list.mockImplementation((_t: string, query: { kind: string }) => Promise.resolve(page(query.kind === 'coaches' ? COACHES : MEMBERS)));
const open = async () => {
  answerPeople();
  return render(<NewGroup {...screenProps('NewGroup')} />);
};
const flush = () => ReactTestRenderer.act(async () => {});
const tap = async (tree: Awaited<ReturnType<typeof open>>, label: string) => {
  await press(tree, label);
  await flush();
};
const state = (tree: Awaited<ReturnType<typeof open>>, label: string) => tree.root.find((n) => n.props.accessibilityLabel === label && n.props.accessibilityRole === 'checkbox').props.accessibilityState;

beforeEach(() => {
  jest.useFakeTimers();
  list.mockReset();
  createGroup.mockReset();
  resetNavigationMock();
  clearToast();
  useAuthStore.setState({ accessToken: 'token', user: { id: 'me-id', email: 'me@x.com', name: 'Me', role: 'MEMBER', emailVerified: true } });
});
afterEach(() => jest.useRealTimers());

describe('New group screen', () => {
  it('shows the form and the members to choose from', async () => {
    const tree = await open();
    expect(allText(tree)).toEqual(expect.arrayContaining(['New group', 'Group name', 'Description (optional)', 'Add people', 'Ben Stone', 'Cara Lee', 'Dan Moss']));
    expect(allText(tree).some((t) => t.startsWith('1 of 6 people, including you'))).toBe(true); // just me so far
  });

  it('Create stays off until there is a name and at least two other people', async () => {
    const tree = await open();
    const create = () => tree.root.find((n) => n.props.accessibilityLabel === 'Create group' && typeof n.props.onPress === 'function');
    expect(create().props.disabled).toBe(true);
    await typeInto(tree, 'Group name', 'Team Alpha');
    await tap(tree, 'Add Ben Stone');
    expect(create().props.disabled).toBe(true); // only 2 people with me
    await tap(tree, 'Add Cara Lee');
    expect(create().props.disabled).toBe(false); // 3 people: enough
    await typeInto(tree, 'Group name', '   ');
    expect(create().props.disabled).toBe(true);
  });

  it('choosing and unchoosing: the row, the counter and the chips follow', async () => {
    const tree = await open();
    await tap(tree, 'Add Ben Stone');
    expect(state(tree, 'Remove Ben Stone')).toMatchObject({ checked: true });
    expect(allText(tree).some((t) => t.startsWith('2 of 6 people'))).toBe(true);
    expect(has(tree, 'Remove Ben Stone')).toBe(true); // the chip and the row share the label
    await tap(tree, 'Remove Ben Stone');
    expect(allText(tree).some((t) => t.startsWith('1 of 6 people'))).toBe(true);
  });

  describe('ONE coach per group', () => {
    it('once a coach is chosen, the other coaches are greyed out and say why', async () => {
      const tree = await open();
      await tap(tree, 'Pick from coaches');
      await tap(tree, 'Add Amara Okafor');
      expect(state(tree, 'Add Lena Fischer')).toMatchObject({ disabled: true });
      expect(allText(tree)).toContain('Only one coach per group');
      expect(state(tree, 'Remove Amara Okafor')).toMatchObject({ checked: true, disabled: false }); // can still be removed
    });

    it('tapping a greyed-out coach changes nothing', async () => {
      const tree = await open();
      await tap(tree, 'Pick from coaches');
      await tap(tree, 'Add Amara Okafor');
      const lena = tree.root.find((n) => n.props.accessibilityLabel === 'Add Lena Fischer' && n.props.accessibilityRole === 'checkbox');
      expect(lena.props.disabled).toBe(true); // a disabled row cannot be pressed at all
      expect(allText(tree).some((t) => t.startsWith('2 of 6 people'))).toBe(true);
    });

    it('removing the coach frees the other coach again', async () => {
      const tree = await open();
      await tap(tree, 'Pick from coaches');
      await tap(tree, 'Add Amara Okafor');
      await tap(tree, 'Remove Amara Okafor');
      expect(state(tree, 'Add Lena Fischer')).toMatchObject({ disabled: false });
    });

    it('members can still be added after the coach', async () => {
      const tree = await open();
      await tap(tree, 'Pick from coaches');
      await tap(tree, 'Add Amara Okafor');
      await tap(tree, 'Pick from members');
      await tap(tree, 'Add Ben Stone');
      expect(allText(tree).some((t) => t.startsWith('3 of 6 people'))).toBe(true);
    });

    it('if I am a coach, I am the group\'s coach: there is no Coaches tab to pick from', async () => {
      useAuthStore.setState({ user: { id: 'me-id', email: 'me@x.com', name: 'Me', role: 'COACH', emailVerified: true } });
      const tree = await open();
      expect(has(tree, 'Pick from coaches')).toBe(false);
      expect(list).toHaveBeenCalledWith('token', expect.objectContaining({ kind: 'members' }));
    });
  });

  it('6 people at most: after 5 are chosen everyone else is greyed out', async () => {
    list.mockResolvedValue(page(['a', 'b', 'c', 'd', 'e', 'f'].map((x) => member(x, `Person ${x.toUpperCase()}`))));
    const tree = await render(<NewGroup {...screenProps('NewGroup')} />);
    for (const x of ['A', 'B', 'C', 'D', 'E']) await tap(tree, `Add Person ${x}`);
    expect(state(tree, 'Add Person F')).toMatchObject({ disabled: true });
    expect(allText(tree)).toContain('A group has at most 6 people');
  });

  describe('creating', () => {
    const fill = async (tree: Awaited<ReturnType<typeof open>>) => {
      await typeInto(tree, 'Group name', '  Team Alpha ');
      await typeInto(tree, 'Description (optional)', '  Weekly check-in ');
      await tap(tree, 'Add Ben Stone');
      await tap(tree, 'Add Cara Lee');
    };

    it('sends the trimmed name and description with the chosen people, then opens the new chat in place of this screen', async () => {
      const created = groupSummary({ id: 'g-new', title: 'Team Alpha' });
      createGroup.mockResolvedValue(created);
      const tree = await open();
      await fill(tree);
      await tap(tree, 'Create group');
      expect(createGroup).toHaveBeenCalledWith('token', { title: 'Team Alpha', description: 'Weekly check-in', memberIds: ['m1', 'm2'] });
      expect(navigationMock.dispatch).toHaveBeenCalledWith(StackActions.replace('Chat', { chat: created }));
    });

    it('leaves the description out when it is empty', async () => {
      createGroup.mockResolvedValue(groupSummary());
      const tree = await open();
      await typeInto(tree, 'Group name', 'Team');
      await tap(tree, 'Add Ben Stone');
      await tap(tree, 'Add Cara Lee');
      await tap(tree, 'Create group');
      expect(createGroup.mock.calls[0]![1]).toEqual({ title: 'Team', memberIds: ['m1', 'm2'] });
    });

    it('shows the server\'s reason and stays on the screen when it refuses', async () => {
      createGroup.mockRejectedValue(new ApiError(400, 'GROUP_ONE_COACH_ONLY', 'A group can have only one coach.'));
      const tree = await open();
      await fill(tree);
      await tap(tree, 'Create group');
      expect(lastToast()?.message).toBe('A group can have only one coach.');
      expect(navigationMock.dispatch).not.toHaveBeenCalled();
      expect(allText(tree)).toContain('Ben Stone'); // the form is still there
    });

    it('cannot be sent twice while it is being created', async () => {
      let resolve!: (v: unknown) => void;
      createGroup.mockReturnValue(new Promise((r) => { resolve = r; }));
      const tree = await open();
      await fill(tree);
      // Fire the taps without waiting for the (never-ending here) request: `press` would wait for it.
      const tapCreate = () => ReactTestRenderer.act(() => { byLabel(tree, 'Create group').props.onPress(); }); // a plain (sync) act: it does not wait for the returned promise
      await tapCreate();
      await tapCreate();
      expect(createGroup).toHaveBeenCalledTimes(1);
      await ReactTestRenderer.act(async () => resolve(groupSummary()));
    });
  });

  it('searching asks the server for matching people', async () => {
    const tree = await open();
    await typeInto(tree, 'Search people to add', 'ben');
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(301); });
    expect(list).toHaveBeenLastCalledWith('token', expect.objectContaining({ kind: 'members', q: 'ben' }));
  });

  it('Back goes back', async () => {
    const tree = await open();
    await press(tree, 'Back');
    expect(navigationMock.goBack).toHaveBeenCalled();
    expect(byLabel(tree, 'Create group')).toBeTruthy();
  });
});
