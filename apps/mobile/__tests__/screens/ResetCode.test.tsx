import React from 'react';
import ResetCode from '@/src/screens/auth/resetCode/ResetCode';
import { authApi } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { allText, byLabel, clearToast, has, lastToast, navigationMock, press, pressText, render, resetNavigationMock, screenProps, tick, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/auth.api', () => ({ authApi: { forgotPassword: jest.fn(), verifyResetCode: jest.fn() } }));

const forgotPassword = authApi.forgotPassword as jest.Mock;
const verifyResetCode = authApi.verifyResetCode as jest.Mock;

const setup = (resendSeconds = 45) => render(<ResetCode {...screenProps('ResetCode', { email: 'sara@coachconnect.dev', resendSeconds })} />);

describe('ResetCode screen (forgot password, step 2 of 3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearToast();
    resetNavigationMock();
    forgotPassword.mockReset().mockResolvedValue({ expiresInSeconds: 600, resendAfterSeconds: 60 });
    verifyResetCode.mockReset().mockResolvedValue({ resetToken: 'reset-token-abc', expiresInSeconds: 600 });
  });
  afterEach(() => jest.useRealTimers());

  it('names the email and counts down from the time the server gave', async () => {
    const tree = await setup(45);
    expect(allText(tree).join(' ')).toContain('sara@coachconnect.dev');
    expect(allText(tree)).toContain('Resend in 0:45');
    expect(forgotPassword).not.toHaveBeenCalled(); // the code was already sent on the previous screen
  });

  it('shows Verify only when six digits are typed, then checks the code and opens "new password" with the token', async () => {
    const tree = await setup();
    expect(has(tree, 'Verify')).toBe(false);
    await typeInto(tree, 'Verification code', '123');
    expect(has(tree, 'Verify')).toBe(false);
    await typeInto(tree, 'Verification code', '482190');
    await press(tree, 'Verify');
    expect(verifyResetCode).toHaveBeenCalledWith({ email: 'sara@coachconnect.dev', code: '482190' });
    expect(navigationMock.navigate).toHaveBeenCalledWith('NewPassword', { resetToken: 'reset-token-abc' });
  });

  it('a wrong code: toast, boxes cleared, stays on this screen', async () => {
    const tree = await setup();
    verifyResetCode.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 4 }));
    await typeInto(tree, 'Verification code', '111111');
    await press(tree, 'Verify');
    expect(lastToast()?.message).toBe('That code is not correct. 4 tries left.');
    expect(byLabel(tree, 'Verification code').props.value).toBe('');
    expect(navigationMock.navigate).not.toHaveBeenCalled();
  });

  it('resend works after the countdown, asks for a new code and restarts the countdown', async () => {
    const tree = await setup(2);
    await tick(2);
    expect(allText(tree)).toContain('Resend code');
    await pressText(tree, 'Resend code');
    expect(forgotPassword).toHaveBeenCalledWith('sara@coachconnect.dev');
    expect(allText(tree)).toContain('Resend in 1:00');
  });

  it('the back arrow goes back to the email screen', async () => {
    const tree = await setup();
    await press(tree, 'Back');
    expect(navigationMock.goBack).toHaveBeenCalled();
  });
});
