import React from 'react';
import ForgotPassword from '@/src/screens/auth/forgotPassword/ForgotPassword';
import { authApi } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { allText, clearToast, has, lastToast, navigationMock, press, render, resetNavigationMock, screenProps, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/auth.api', () => ({ authApi: { forgotPassword: jest.fn() } }));

const forgotPassword = authApi.forgotPassword as jest.Mock;

const setup = () => render(<ForgotPassword {...screenProps('ForgotPassword')} />);

describe('ForgotPassword screen (step 1 of 3)', () => {
  beforeEach(() => {
    clearToast();
    resetNavigationMock();
    forgotPassword.mockReset().mockResolvedValue({ expiresInSeconds: 600, resendAfterSeconds: 45 });
  });

  it('explains what will happen', async () => {
    const tree = await setup();
    expect(allText(tree)).toContain('Forgot your password?');
  });

  it('does not contact the server for an invalid email', async () => {
    const tree = await setup();
    await typeInto(tree, 'Email', 'not-an-email');
    await press(tree, 'Send code');
    expect(forgotPassword).not.toHaveBeenCalled();
    expect(allText(tree)).toContain('Enter a valid email address.');
  });

  it('sends the trimmed email, then opens the "enter the code" screen with the server wait time', async () => {
    const tree = await setup();
    await typeInto(tree, 'Email', '  sara@coachconnect.dev ');
    await press(tree, 'Send code');
    expect(forgotPassword).toHaveBeenCalledWith('sara@coachconnect.dev');
    expect(navigationMock.navigate).toHaveBeenCalledWith('ResetCode', { email: 'sara@coachconnect.dev', resendSeconds: 45 });
  });

  it('when there is NO account: shows the server message as a toast and offers "Create an account"', async () => {
    const tree = await setup();
    forgotPassword.mockRejectedValue(new ApiError(404, 'ACCOUNT_NOT_FOUND', 'No account exists with this email. Create an account to get started.'));
    await typeInto(tree, 'Email', 'ghost@example.com');
    await press(tree, 'Send code');
    expect(lastToast()?.message).toMatch(/No account exists with this email/);
    const text = allText(tree).join(' ');
    expect(text).toContain('We could not find an account for');
    expect(text).toContain('ghost@example.com');
    expect(navigationMock.navigate).not.toHaveBeenCalled();
    await press(tree, 'Create an account');
    expect(navigationMock.navigate).toHaveBeenCalledWith('Register', { email: 'ghost@example.com' });
  });

  it('the "Create an account" offer disappears when the email is edited', async () => {
    const tree = await setup();
    forgotPassword.mockRejectedValue(new ApiError(404, 'ACCOUNT_NOT_FOUND', 'No account.'));
    await typeInto(tree, 'Email', 'ghost@example.com');
    await press(tree, 'Send code');
    expect(has(tree, 'Create an account')).toBe(true);
    await typeInto(tree, 'Email', 'ghost2@example.com');
    expect(has(tree, 'Create an account')).toBe(false);
  });

  it('other failures (e.g. email could not be sent) are just a toast, with no create-account offer', async () => {
    const tree = await setup();
    forgotPassword.mockRejectedValue(new ApiError(503, 'EMAIL_SEND_FAILED', 'We could not send the email right now. Please try again in a moment.'));
    await typeInto(tree, 'Email', 'sara@coachconnect.dev');
    await press(tree, 'Send code');
    expect(lastToast()?.message).toMatch(/could not send the email/);
    expect(has(tree, 'Create an account')).toBe(false);
  });

  it('goes back to sign in', async () => {
    const tree = await setup();
    await press(tree, 'Back to sign in');
    expect(navigationMock.goBack).toHaveBeenCalled();
  });
});
