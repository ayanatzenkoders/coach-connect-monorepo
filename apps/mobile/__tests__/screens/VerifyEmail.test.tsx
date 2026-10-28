import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import VerifyEmail from '@/src/screens/auth/verifyEmail/VerifyEmail';
import { authApi } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, byLabel, clearToast, has, lastToast, press, render, resetNavigationMock, screenProps, tick, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));
jest.mock('@/src/service/api/auth.api', () => ({ authApi: { sendEmailCode: jest.fn(), verifyEmail: jest.fn() } }));

const sendEmailCode = authApi.sendEmailCode as jest.Mock;
const verifyEmail = authApi.verifyEmail as jest.Mock;
const signOut = jest.fn();
const markEmailVerified = jest.fn();

const setup = () => render(<VerifyEmail {...screenProps('VerifyEmail')} />);

describe('VerifyEmail screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearToast();
    resetNavigationMock();
    sendEmailCode.mockReset().mockResolvedValue({ expiresInSeconds: 600, resendAfterSeconds: 60 });
    verifyEmail.mockReset().mockResolvedValue({ emailVerified: true });
    signOut.mockReset();
    markEmailVerified.mockReset();
    useAuthStore.setState({
      accessToken: 'token',
      user: { id: 'u1', email: 'sara@coachconnect.dev', name: 'Sara', role: 'MEMBER', emailVerified: false },
      signOut,
      markEmailVerified,
    });
  });
  afterEach(() => jest.useRealTimers());

  it('shows the email address and asks for a code once when it opens', async () => {
    const tree = await setup();
    expect(allText(tree).join(' ')).toContain('sara@coachconnect.dev');
    expect(sendEmailCode).toHaveBeenCalledTimes(1);
    expect(sendEmailCode).toHaveBeenCalledWith('token');
  });

  it('has NO "Open mail app" button', async () => {
    const tree = await setup();
    expect(allText(tree)).not.toContain('Open mail app');
  });

  it('counts down before the code can be re-sent, then allows it', async () => {
    const tree = await setup();
    expect(allText(tree)).toContain('Resend in 1:00');
    await tick(3);
    expect(allText(tree)).toContain('Resend in 0:57');
    await tick(57);
    expect(allText(tree)).toContain('Resend code');
  });

  it('uses the server wait time when a code was sent a moment ago (and does not show an error)', async () => {
    sendEmailCode.mockRejectedValue(new ApiError(429, 'CODE_COOLDOWN', 'wait', { retryAfterSeconds: 42 }));
    const tree = await setup();
    expect(allText(tree)).toContain('Resend in 0:42');
    expect(lastToast()).toBeNull();
  });

  it('shows a toast if the code cannot be sent (e.g. the email service is down)', async () => {
    sendEmailCode.mockRejectedValue(new ApiError(503, 'EMAIL_SEND_FAILED', 'We could not send the email right now.'));
    await setup();
    expect(lastToast()?.message).toBe('We could not send the email right now.');
  });

  it('shows the Verify button ONLY once all six digits are typed, and does not submit by itself', async () => {
    const tree = await setup();
    expect(has(tree, 'Verify')).toBe(false);
    await typeInto(tree, 'Verification code', '4821');
    expect(has(tree, 'Verify')).toBe(false);
    await typeInto(tree, 'Verification code', '48 2-1 9 0');
    expect(has(tree, 'Verify')).toBe(true);
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('pressing Verify checks the code and lets the user in', async () => {
    const tree = await setup();
    await typeInto(tree, 'Verification code', '482190');
    await press(tree, 'Verify');
    expect(verifyEmail).toHaveBeenCalledWith('token', '482190');
    expect(markEmailVerified).toHaveBeenCalled();
  });

  it('a wrong code: toast with the tries left, boxes cleared, Verify hidden again, user NOT let in', async () => {
    const tree = await setup();
    verifyEmail.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 4 }));
    await typeInto(tree, 'Verification code', '111111');
    await press(tree, 'Verify');
    expect(lastToast()).toMatchObject({ message: 'That code is not correct. 4 tries left.', tone: 'error' });
    expect(byLabel(tree, 'Verification code').props.value).toBe('');
    expect(has(tree, 'Verify')).toBe(false);
    expect(markEmailVerified).not.toHaveBeenCalled();
  });

  it('puts the cursor back in the code field after a wrong code', async () => {
    const tree = await setup();
    verifyEmail.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 3 }));
    const input = tree.root.findByType(TextInput).instance as { focus: () => void };
    const focus = jest.fn();
    input.focus = focus;
    await typeInto(tree, 'Verification code', '333333');
    await press(tree, 'Verify');
    expect(focus).toHaveBeenCalled();
  });

  it('shows "expired" messages from the server as a toast', async () => {
    const tree = await setup();
    verifyEmail.mockRejectedValue(new ApiError(400, 'CODE_EXPIRED', 'That code has expired. Request a new one.'));
    await typeInto(tree, 'Verification code', '222222');
    await press(tree, 'Verify');
    expect(lastToast()?.message).toBe('That code has expired. Request a new one.');
  });

  it('the back arrow signs out (the account exists already; the user can verify later)', async () => {
    const tree = await setup();
    await ReactTestRenderer.act(async () => byLabel(tree, 'Back').props.onPress());
    expect(signOut).toHaveBeenCalled();
  });
});
