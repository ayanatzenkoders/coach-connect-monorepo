import React from 'react';
import NewPassword from '@/src/screens/auth/newPassword/NewPassword';
import { authApi } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { allText, clearToast, lastToast, navigationMock, press, render, resetNavigationMock, screenProps, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/auth.api', () => ({ authApi: { resetPassword: jest.fn() } }));

const resetPassword = authApi.resetPassword as jest.Mock;

const setup = () => render(<NewPassword {...screenProps('NewPassword', { resetToken: 'reset-token-abc' })} />);

describe('NewPassword screen (forgot password, step 3 of 3)', () => {
  beforeEach(() => {
    clearToast();
    resetNavigationMock();
    resetPassword.mockReset().mockResolvedValue({ ok: true });
  });

  it('shows the four password rules', async () => {
    const tree = await setup();
    expect(allText(tree)).toEqual(expect.arrayContaining(['At least 8 characters', 'One lowercase letter', 'One uppercase letter', 'One number']));
  });

  it.each([
    ['no uppercase letter', 'alllowercase1'],
    ['no lowercase letter', 'ALLUPPERCASE1'],
    ['no number', 'NoNumbersHere'],
    ['too short', 'Ab1'],
  ])('does not submit a password with %s', async (_label, pw) => {
    const tree = await setup();
    await typeInto(tree, 'New password', pw);
    await press(tree, 'Reset password');
    expect(resetPassword).not.toHaveBeenCalled();
    expect(allText(tree)).toContain('Your password does not meet all the requirements below.');
  });

  it('saves a strong password with the token, then restarts the sign-in stack with a "Password updated" message', async () => {
    const tree = await setup();
    await typeInto(tree, 'New password', 'Brand-new-pass-9');
    await press(tree, 'Reset password');
    expect(resetPassword).toHaveBeenCalledWith({ resetToken: 'reset-token-abc', newPassword: 'Brand-new-pass-9' });
    const action = navigationMock.dispatch.mock.calls[0]![0];
    expect(action.payload).toMatchObject({ index: 0, routes: [{ name: 'SignIn', params: { passwordUpdated: true } }] });
  });

  it('an expired token: toast and back to step 1', async () => {
    const tree = await setup();
    resetPassword.mockRejectedValue(new ApiError(400, 'RESET_TOKEN_INVALID', 'This reset session has expired. Please start again.'));
    await typeInto(tree, 'New password', 'Brand-new-pass-9');
    await press(tree, 'Reset password');
    expect(lastToast()?.message).toBe('This reset session has expired. Please start again.');
    expect(navigationMock.navigate).toHaveBeenCalledWith('ForgotPassword');
    expect(navigationMock.dispatch).not.toHaveBeenCalled();
  });

  it('any other refusal is just a toast, and the user stays here', async () => {
    const tree = await setup();
    resetPassword.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    await typeInto(tree, 'New password', 'Brand-new-pass-9');
    await press(tree, 'Reset password');
    expect(lastToast()?.message).toBe('Cannot reach the server.');
    expect(navigationMock.navigate).not.toHaveBeenCalled();
  });

  it('the back arrow goes back', async () => {
    const tree = await setup();
    await press(tree, 'Back');
    expect(navigationMock.goBack).toHaveBeenCalled();
  });
});
