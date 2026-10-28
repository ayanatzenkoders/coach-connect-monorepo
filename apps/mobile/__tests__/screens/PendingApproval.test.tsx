import React from 'react';
import { AppState } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import PendingApproval from '@/src/screens/auth/pendingApproval/PendingApproval';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, clearToast, lastToast, press, render, resetNavigationMock, screenProps } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));

const refreshUser = jest.fn();
const signOut = jest.fn();
const coach = { id: 'c1', email: 'carl@x.com', name: 'Carl Coach', role: 'COACH' as const, emailVerified: true, pendingApproval: true };

const open = () => render(<PendingApproval {...screenProps('PendingApproval')} />);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  clearToast();
  resetNavigationMock();
  refreshUser.mockReset().mockResolvedValue(undefined);
  signOut.mockReset().mockResolvedValue(undefined);
  useAuthStore.setState({ user: coach, refreshUser, signOut });
});

describe('Waiting for approval screen', () => {
  it('says the application was received and which address gets the approval email', async () => {
    const t = allText(await open()).join(' ');
    expect(t).toContain('Application received');
    expect(t).toContain('Carl Coach');
    expect(t).toContain('carl@x.com');
  });

  it('"Check again" asks the server; still waiting says so', async () => {
    const tree = await open();
    await press(tree, 'Check again');
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(lastToast()?.message).toBe('Not approved yet. We will email you as soon as it is.');
  });

  it('once approved, "Check again" does not complain (the app swaps to the home screen)', async () => {
    refreshUser.mockImplementation(async () => useAuthStore.setState({ user: { ...coach, pendingApproval: false } }));
    const tree = await open();
    await press(tree, 'Check again');
    expect(lastToast()).toBeNull();
  });

  it('shows a network problem instead of failing silently', async () => {
    refreshUser.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    const tree = await open();
    await press(tree, 'Check again');
    expect(lastToast()?.message).toBe('Cannot reach the server.');
  });

  it('looks again by itself, quietly, when the app comes back to the front', async () => {
    let onChange: (state: string) => void = () => {};
    const sub = { remove: jest.fn() };
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, handler: (state: string) => void) => {
      onChange = handler;
      return sub;
    }) as never);
    await open();
    await ReactTestRenderer.act(async () => onChange('active'));
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(lastToast()).toBeNull(); // quiet: no "not approved yet" toast
  });

  it('Sign out signs out', async () => {
    const tree = await open();
    await press(tree, 'Sign out');
    expect(signOut).toHaveBeenCalled();
  });
});
