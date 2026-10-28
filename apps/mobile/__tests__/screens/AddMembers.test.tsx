import ReactTestRenderer from 'react-test-renderer';
import AddMembers from '@/src/screens/home/addMembers/AddMembers';
import { chatApi } from '@/src/service/api/chat.api';
import { peopleApi, PeoplePage } from '@/src/service/api/people.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, clearToast, lastToast, navigationMock, press, render, resetNavigationMock, screenProps } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/people.api', () => ({ peopleApi: { list: jest.fn() } }));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { addMembers: jest.fn() } }));

const list = peopleApi.list as jest.Mock;
const addMembers = chatApi.addMembers as jest.Mock;
const member = (id: string, name: string) => ({ id, name, role: 'MEMBER' as const });
const coach = (id: string, name: string) => ({ id, name, role: 'COACH' as const, specialties: [], available: true, bio: '' });
const page = (items: PeoplePage['items']): PeoplePage => ({ items, total: items.length, nextCursor: null });

const MEMBERS = [member('in1', 'Already Here'), member('m1', 'Ben Stone'), member('m2', 'Cara Lee'), member('m3', 'Dan Moss')];
const COACHES = [coach('c1', 'Amara Okafor')];

// A group of 4 (including me) that has no coach yet, unless a test says otherwise.
const params = (over = {}) => ({ chatId: 'g1', memberIds: ['me-id', 'in1', 'x', 'y'], memberCount: 4, hasCoach: false, ...over });
const open = async (over = {}) => {
  list.mockImplementation((_t: string, query: { kind: string }) => Promise.resolve(page(query.kind === 'coaches' ? COACHES : MEMBERS)));
  return render(<AddMembers {...screenProps('AddMembers', params(over))} />);
};
const flush = () => ReactTestRenderer.act(async () => {});
const tap = async (tree: Awaited<ReturnType<typeof open>>, label: string) => {
  await press(tree, label);
  await flush();
};
const row = (tree: Awaited<ReturnType<typeof open>>, label: string) => tree.root.find((n) => n.props.accessibilityLabel === label && n.props.accessibilityRole === 'checkbox').props;
const addButton = (tree: Awaited<ReturnType<typeof open>>) => tree.root.find((n) => n.props.accessibilityLabel === 'Add to group' && typeof n.props.onPress === 'function');

beforeEach(() => {
  jest.useFakeTimers();
  list.mockReset();
  addMembers.mockReset();
  resetNavigationMock();
  clearToast();
  useAuthStore.setState({ accessToken: 'token', user: { id: 'me-id', email: 'me@x.com', name: 'Me', role: 'MEMBER', emailVerified: true } });
});
afterEach(() => jest.useRealTimers());

describe('Add people screen', () => {
  it('shows how full the group is, and the button stays off until someone is chosen', async () => {
    const tree = await open();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Add people', '4 of 6 people in the group. One coach at most.', 'Ben Stone']));
    expect(addButton(tree).props.disabled).toBe(true);
    await tap(tree, 'Add Ben Stone');
    expect(addButton(tree).props.disabled).toBe(false);
    expect(allText(tree)).toContain('5 of 6 people in the group. One coach at most.');
  });

  it('people already in the group are greyed out and say so', async () => {
    const tree = await open();
    expect(row(tree, 'Add Already Here').accessibilityState).toMatchObject({ disabled: true });
    expect(allText(tree)).toContain('Already in the group');
  });

  it('only the free places can be filled: with 2 left a third person is refused', async () => {
    const tree = await open();
    await tap(tree, 'Add Ben Stone');
    await tap(tree, 'Add Cara Lee');
    expect(row(tree, 'Add Dan Moss').accessibilityState).toMatchObject({ disabled: true });
    expect(allText(tree)).toContain('A group has at most 6 people');
  });

  it('a group that already has a coach has no Coaches tab', async () => {
    const tree = await open({ hasCoach: true });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Pick from coaches').length).toBe(0);
    const withoutCoach = await open();
    expect(withoutCoach.root.findAll((n) => n.props.accessibilityLabel === 'Pick from coaches').length).toBeGreaterThan(0);
  });

  it('Add sends the chosen people, goes back and says so', async () => {
    addMembers.mockResolvedValue({ id: 'g1' });
    const tree = await open();
    await tap(tree, 'Add Ben Stone');
    await tap(tree, 'Add Cara Lee');
    await tap(tree, 'Add to group');
    expect(addMembers).toHaveBeenCalledWith('token', 'g1', ['m1', 'm2']);
    expect(navigationMock.goBack).toHaveBeenCalled();
    expect(lastToast()?.message).toBe('2 people added.');
  });

  it('when the server refuses (the group filled up meanwhile) you stay, see the reason and can change your choice', async () => {
    addMembers.mockRejectedValue(new ApiError(400, 'GROUP_FULL', 'A group can have 6 people at most.'));
    const tree = await open();
    await tap(tree, 'Add Ben Stone');
    await tap(tree, 'Add to group');
    expect(navigationMock.goBack).not.toHaveBeenCalled();
    expect(lastToast()?.message).toBe('A group can have 6 people at most.');
    expect(addButton(tree).props.disabled).toBe(false);
  });

  it('Back goes back', async () => {
    const tree = await open();
    await press(tree, 'Back');
    expect(navigationMock.goBack).toHaveBeenCalled();
  });
});
