import { Alert, RefreshControl } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import Profile from '@/src/screens/home/profile/Profile';
import { authApi } from '@/src/service/api/auth.api';
import { coachApi } from '@/src/service/api/coach.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, clearToast, lastToast, press, render } from '@/test-utils';
import type { Me } from '@coach-connect/shared/types';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/auth.api', () => ({ authApi: { me: jest.fn() } }));
jest.mock('@/src/service/api/coach.api', () => ({ coachApi: { setAvailability: jest.fn() } }));

const me = authApi.me as jest.Mock;
const setAvailability = coachApi.setAvailability as jest.Mock;
const signOut = jest.fn();
const user = { id: 'u1', email: 'sara@coachconnect.dev', name: 'Sara Malik', role: 'MEMBER' as const, emailVerified: true };
const profile = (over: Partial<Me> = {}): Me => ({ ...user, subscription: { status: 'ACTIVE', expiresAt: '2026-11-27T10:00:00.000Z' }, canCall: true, isAvailable: null, ...over });
const flush = () => ReactTestRenderer.act(async () => {});
const open = async () => {
  const tree = await render(<Profile />);
  await flush();
  return tree;
};
type Tree = Awaited<ReturnType<typeof open>>;
const refresh = (tree: Tree) => tree.root.findByType(RefreshControl);

let alert: jest.SpyInstance;
beforeEach(() => {
  me.mockReset();
  setAvailability.mockReset();
  signOut.mockReset();
  clearToast();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useAuthStore.setState({ accessToken: 'token', user, signOut });
});
afterEach(() => alert.mockRestore());

describe('Profile screen', () => {
  it('shows who I am at once, from the sign-in, before the server has answered', async () => {
    me.mockImplementation(() => new Promise(() => {}));
    const tree = await open();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Profile', 'Sara Malik', 'sara@coachconnect.dev', 'Member']));
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Loading membership').length).toBeGreaterThan(0);
  });

  it('explains the membership and calls in plain words (no raw ACTIVE / true)', async () => {
    me.mockResolvedValue(profile());
    const t = allText(await open());
    expect(t).toEqual(expect.arrayContaining(['Active', 'Renews on Nov 27, 2026.', 'Allowed', 'You can start calls with coaches and members.', 'Verified']));
    expect(t).not.toContain('ACTIVE');
    expect(t).not.toContain('true');
  });

  it('a member without access is told how to get it', async () => {
    me.mockResolvedValue(profile({ subscription: { status: 'EXPIRED', expiresAt: null }, canCall: false }));
    const t = allText(await open());
    expect(t).toEqual(expect.arrayContaining(['Expired', 'Not yet', 'Subscribe to start calls.']));
  });

  it('a coach sees "Coach account", never a subscription', async () => {
    useAuthStore.setState({ user: { ...user, role: 'COACH' } });
    me.mockResolvedValue(profile({ role: 'COACH', subscription: null }));
    const t = allText(await open());
    expect(t).toEqual(expect.arrayContaining(['Coach', 'Coach account', 'Coaches never need a subscription.', 'You can make and receive calls.']));
    expect(t).not.toContain('No subscription');
  });

  it('shows "Not verified" when the email is not confirmed', async () => {
    useAuthStore.setState({ user: { ...user, emailVerified: false } });
    me.mockResolvedValue(profile({ emailVerified: false }));
    expect(allText(await open())).toEqual(expect.arrayContaining(['Not verified', 'Not confirmed yet. Check your inbox for the code.']));
  });

  it('when the details cannot be loaded: says so and offers Try again, which asks again', async () => {
    me.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    const tree = await open();
    expect(allText(tree)).toContain('We could not load your membership. Check your connection and try again.');
    expect(allText(tree)).toContain('Sara Malik'); // who I am is still shown
    me.mockResolvedValue(profile());
    await press(tree, 'Try again');
    await flush();
    expect(allText(tree)).toContain('Active');
  });

  it('Sign out asks first and does nothing until confirmed', async () => {
    me.mockResolvedValue(profile());
    const tree = await open();
    await press(tree, 'Sign out');
    expect(alert).toHaveBeenCalledWith('Sign out?', expect.stringContaining('sign in again'), expect.any(Array));
    expect(signOut).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]![2] as { text: string; style?: string; onPress?: () => void }[];
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Sign out']);
    expect(buttons[1]!.style).toBe('destructive');
    buttons[1]!.onPress!();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('Cancel in the dialog keeps me signed in', async () => {
    me.mockResolvedValue(profile());
    const tree = await open();
    await press(tree, 'Sign out');
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    expect(buttons[0]!.onPress).toBeUndefined(); // Cancel just closes the dialog
    expect(signOut).not.toHaveBeenCalled();
  });

  it('the pull-to-refresh spinner shows only for a real pull, not while the tab loads in the background', async () => {
    me.mockResolvedValue(profile());
    const tree = await open();
    expect(refresh(tree).props.refreshing).toBe(false);

    let answer!: (m: Me) => void;
    me.mockImplementationOnce(() => new Promise<Me>((r) => { answer = r; }));
    await ReactTestRenderer.act(async () => { refresh(tree).props.onRefresh(); });
    expect(refresh(tree).props.refreshing).toBe(true);
    await ReactTestRenderer.act(async () => answer(profile()));
    expect(refresh(tree).props.refreshing).toBe(false);
  });

  it('development only: the token-expiry button spoils the token and says what to do next', async () => {
    me.mockResolvedValue(profile());
    const tree = await open();
    await press(tree, 'Dev: expire my access token');
    expect(useAuthStore.getState().accessToken).toBe('expired-on-purpose');
    expect(lastToast()?.message).toContain('Pull down to reload');
  });
});

describe('Availability (coaches only)', () => {
  const coachUser = { ...user, name: 'Carl Coach', role: 'COACH' as const };
  const switchOf = (tree: Tree) => tree.root.find((n) => n.props.accessibilityLabel === 'Available now' && typeof n.props.onValueChange === 'function');
  const openAsCoach = async (isAvailable: boolean) => {
    useAuthStore.setState({ user: coachUser });
    me.mockResolvedValue(profile({ ...coachUser, subscription: null, isAvailable }));
    return open();
  };

  it('members see no availability section at all', async () => {
    me.mockResolvedValue(profile());
    const tree = await open();
    expect(allText(tree)).not.toContain('Availability');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Available now').length).toBe(0);
  });

  it('a coach sees the switch in the state the server has, with a matching explanation', async () => {
    const off = await openAsCoach(false);
    expect(switchOf(off).props.value).toBe(false);
    expect(allText(off).some((t) => t.startsWith('Members can message you but cannot call'))).toBe(true);
    const on = await openAsCoach(true);
    expect(switchOf(on).props.value).toBe(true);
    expect(allText(on).some((t) => t.startsWith('Members can call you'))).toBe(true);
  });

  it('turning it on moves the switch at once, saves it, and tells the People lists to reload', async () => {
    setAvailability.mockResolvedValue({ available: true });
    const tree = await openAsCoach(false);
    await ReactTestRenderer.act(async () => switchOf(tree).props.onValueChange(true));
    expect(setAvailability).toHaveBeenCalledWith('token', true);
    expect(switchOf(tree).props.value).toBe(true);
  });

  it('if the server refuses, the switch jumps back and the reason is shown', async () => {
    setAvailability.mockRejectedValue(new ApiError(403, 'COACH_PENDING_APPROVAL', 'Your application is waiting for approval.'));
    const tree = await openAsCoach(false);
    await ReactTestRenderer.act(async () => switchOf(tree).props.onValueChange(true));
    expect(switchOf(tree).props.value).toBe(false);
    expect(lastToast()?.message).toBe('Your application is waiting for approval.');
  });

  it('the switch is locked while the change is being saved (no double taps)', async () => {
    let finish: (v: { available: boolean }) => void = () => {};
    setAvailability.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const tree = await openAsCoach(false);
    await ReactTestRenderer.act(async () => {
      switchOf(tree).props.onValueChange(true);
    });
    expect(switchOf(tree).props.disabled).toBe(true);
    await ReactTestRenderer.act(async () => finish({ available: true }));
    expect(switchOf(tree).props.disabled).toBe(false);
  });
});
