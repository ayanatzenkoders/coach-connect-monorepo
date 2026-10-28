import { Alert } from 'react-native';
import { StackActions } from '@react-navigation/native';
import GroupInfo from '@/src/screens/home/groupInfo/GroupInfo';
import { chatApi, ChatDetail } from '@/src/service/api/chat.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, clearToast, lastToast, navigationMock, press, render, resetNavigationMock, screenProps } from '@/test-utils';
import { ReactTestRendererFlush } from '../../test-utils/flush';
import { groupSummary } from '../../test-utils/chat';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/chat.api', () => ({ chatApi: { detail: jest.fn(), deleteGroup: jest.fn() } }));

const detail = chatApi.detail as jest.Mock;
const deleteGroup = chatApi.deleteGroup as jest.Mock;
const ME = 'me-id';
const DETAIL: ChatDetail = {
  ...groupSummary({ id: 'g1', title: 'Team Alpha', description: 'Weekly check-in', memberCount: 4 }),
  createdById: ME,
  canManage: false,
  members: [
    { id: 'm1', name: 'Ben Stone', role: 'MEMBER', isBanned: false },
    { id: ME, name: 'Me Myself', role: 'MEMBER', isBanned: false },
    { id: 'c1', name: 'Amara Okafor', role: 'COACH', isBanned: false },
    { id: 'm2', name: 'Cara Lee', role: 'MEMBER', isBanned: true },
  ],
};
const open = async () => {
  const tree = await render(<GroupInfo {...screenProps('GroupInfo', { chatId: 'g1', title: 'Team Alpha' })} />);
  await ReactTestRendererFlush();
  return tree;
};

beforeEach(() => {
  detail.mockReset();
  deleteGroup.mockReset();
  resetNavigationMock();
  clearToast();
  useAuthStore.setState({ accessToken: 'token', user: { id: ME, email: 'me@x.com', name: 'Me Myself', role: 'MEMBER', emailVerified: true } });
});

describe('Group info screen', () => {
  it('shows the name, the description, who created it and everybody in the group', async () => {
    detail.mockResolvedValue(DETAIL);
    const t = allText(await open());
    expect(t).toEqual(expect.arrayContaining(['Group info', 'Team Alpha', '4 people · created by Me Myself', 'Weekly check-in', 'Amara Okafor', 'Ben Stone', 'Cara Lee']));
    expect(detail).toHaveBeenCalledWith('token', 'g1');
  });

  it('lists the coach first, then the others by name, and marks me', async () => {
    detail.mockResolvedValue(DETAIL);
    const names = allText(await open()).filter((t) => ['Amara Okafor', 'Ben Stone', 'Cara Lee', 'Me Myself (you)'].includes(t));
    expect(names).toEqual(['Amara Okafor', 'Ben Stone', 'Cara Lee', 'Me Myself (you)']);
  });

  it('says a banned person is no longer available (they stay in the list)', async () => {
    detail.mockResolvedValue(DETAIL);
    expect(allText(await open())).toContain('No longer available');
  });

  it('no description: says so instead of showing an empty box', async () => {
    detail.mockResolvedValue({ ...DETAIL, description: null });
    expect(allText(await open())).toContain('No description.');
  });

  it('shows the title it was opened with while the details load', async () => {
    detail.mockImplementation(() => new Promise(() => {}));
    const tree = await open();
    expect(allText(tree)).toContain('Team Alpha');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Loading group').length).toBeGreaterThan(0);
  });

  it('when it cannot load: says so and Try again asks again', async () => {
    detail.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    const tree = await open();
    expect(allText(tree)).toContain('We could not load this group.');
    detail.mockResolvedValue(DETAIL);
    await press(tree, 'Try again');
    await ReactTestRendererFlush();
    expect(allText(tree)).toContain('Weekly check-in');
  });

  it('the Group call button says calls are coming soon; Back goes back', async () => {
    detail.mockResolvedValue(DETAIL);
    const tree = await open();
    await press(tree, 'Group call');
    expect(lastToast()?.message).toBe('Group calls are coming soon.');
    await press(tree, 'Back');
    expect(navigationMock.goBack).toHaveBeenCalled();
  });

  describe('managing the group (creator only)', () => {
    const labels = (tree: Awaited<ReturnType<typeof open>>) => allText(tree);

    it('a member sees neither "Add people" nor "Delete group"', async () => {
      detail.mockResolvedValue({ ...DETAIL, canManage: false });
      const t = labels(await open());
      expect(t).not.toContain('Add people');
      expect(t).not.toContain('Delete group');
    });

    it('the creator sees both', async () => {
      detail.mockResolvedValue({ ...DETAIL, canManage: true });
      expect(labels(await open())).toEqual(expect.arrayContaining(['Add people', 'Delete group']));
    });

    it('a full group (6 people) cannot take more: "Add people" is hidden, "Delete group" stays', async () => {
      detail.mockResolvedValue({ ...DETAIL, canManage: true, memberCount: 6 });
      const t = labels(await open());
      expect(t).not.toContain('Add people');
      expect(t).toContain('Delete group');
    });

    it('"Add people" opens the picker with who is in, how many, and whether there is a coach', async () => {
      detail.mockResolvedValue({ ...DETAIL, canManage: true });
      const tree = await open();
      await press(tree, 'Add people');
      expect(navigationMock.navigate).toHaveBeenCalledWith('AddMembers', { chatId: 'g1', memberIds: ['m1', ME, 'c1', 'm2'], memberCount: 4, hasCoach: true });
    });

    it('"Delete group" asks first, and Cancel deletes nothing', async () => {
      detail.mockResolvedValue({ ...DETAIL, canManage: true });
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const tree = await open();
      await press(tree, 'Delete group');
      expect(alert).toHaveBeenCalledWith('Delete this group?', expect.any(String), expect.any(Array));
      expect(deleteGroup).not.toHaveBeenCalled();
      alert.mockRestore();
    });

    it('confirming deletes it, returns to the tab bar and says so', async () => {
      detail.mockResolvedValue({ ...DETAIL, canManage: true });
      deleteGroup.mockResolvedValue({ deleted: true });
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const tree = await open();
      await press(tree, 'Delete group');
      const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
      await ReactTestRendererFlush();
      await require('react-test-renderer').act(async () => buttons.find((b) => b.text === 'Delete group')!.onPress!());
      expect(deleteGroup).toHaveBeenCalledWith('token', 'g1');
      expect(navigationMock.dispatch).toHaveBeenCalledWith(StackActions.popToTop());
      expect(lastToast()?.message).toBe('Group deleted.');
      alert.mockRestore();
    });

    it('if the delete push already took me back to the tab bar, it does not try to go back a second time', async () => {
      detail.mockResolvedValue({ ...DETAIL, canManage: true });
      deleteGroup.mockResolvedValue({ deleted: true });
      navigationMock.isFocused.mockReturnValue(false); // this screen is already closed
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const tree = await open();
      await press(tree, 'Delete group');
      const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
      await require('react-test-renderer').act(async () => buttons.find((b) => b.text === 'Delete group')!.onPress!());
      expect(navigationMock.dispatch).not.toHaveBeenCalled();
      expect(lastToast()?.message).toBe('Group deleted.');
      alert.mockRestore();
    });

    it('when the server refuses, you stay on the screen and see the error', async () => {
      detail.mockResolvedValue({ ...DETAIL, canManage: true });
      deleteGroup.mockRejectedValue(new ApiError(403, 'NOT_GROUP_CREATOR', 'Only the person who created this group can do that.'));
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const tree = await open();
      await press(tree, 'Delete group');
      const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
      await require('react-test-renderer').act(async () => buttons.find((b) => b.text === 'Delete group')!.onPress!());
      expect(navigationMock.dispatch).not.toHaveBeenCalled();
      expect(lastToast()?.message).toBe('Only the person who created this group can do that.');
      alert.mockRestore();
    });
  });
});
