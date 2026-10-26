import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import { ApiError } from '../src/api/client';
import { VerifyEmailScreen } from '../src/screens/VerifyEmailScreen';
import { allText, byLabel, clearToast, has, lastToast, press, render, tick, typeInto } from '../test-utils';

async function setup(overrides: Partial<React.ComponentProps<typeof VerifyEmailScreen>> = {}) {
  const mocks = {
    onSendCode: jest.fn().mockResolvedValue({ resendAfterSeconds: 60 }),
    onVerify: jest.fn().mockResolvedValue(undefined),
    onBack: jest.fn(),
  };
  const tree = await render(<VerifyEmailScreen email="sara@coachconnect.dev" {...mocks} {...overrides} />);
  return { tree, ...mocks };
}

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearToast();
  });
  afterEach(() => jest.useRealTimers());

  it('shows the email address and asks for a code once when it opens', async () => {
    const { tree, onSendCode } = await setup();
    expect(allText(tree).join(' ')).toContain('sara@coachconnect.dev');
    expect(onSendCode).toHaveBeenCalledTimes(1);
  });

  it('has NO "Open mail app" button', async () => {
    const { tree } = await setup();
    expect(allText(tree)).not.toContain('Open mail app');
  });

  it('counts down before the code can be re-sent, then allows it', async () => {
    const { tree } = await setup();
    expect(allText(tree)).toContain('Resend in 1:00');
    await tick(3);
    expect(allText(tree)).toContain('Resend in 0:57');
    await tick(57);
    expect(allText(tree)).toContain('Resend code');
  });

  it('uses the server wait time when a code was sent a moment ago (and does not show an error)', async () => {
    const { tree } = await setup({ onSendCode: jest.fn().mockRejectedValue(new ApiError(429, 'CODE_COOLDOWN', 'wait', { retryAfterSeconds: 42 })) });
    expect(allText(tree)).toContain('Resend in 0:42');
    expect(lastToast()).toBeNull();
  });

  it('shows a toast if the code cannot be sent (e.g. the email service is down)', async () => {
    await setup({ onSendCode: jest.fn().mockRejectedValue(new ApiError(503, 'EMAIL_SEND_FAILED', 'We could not send the email right now.')) });
    expect(lastToast()?.message).toBe('We could not send the email right now.');
  });

  it('shows the Verify button ONLY once all six digits are typed, and does not submit by itself', async () => {
    const { tree, onVerify } = await setup();
    expect(has(tree, 'Verify')).toBe(false);
    await typeInto(tree, 'Verification code', '4821');
    expect(has(tree, 'Verify')).toBe(false);
    await typeInto(tree, 'Verification code', '48 2-1 9 0');
    expect(has(tree, 'Verify')).toBe(true);
    expect(onVerify).not.toHaveBeenCalled();
  });

  it('pressing Verify sends the code', async () => {
    const { tree, onVerify } = await setup();
    await typeInto(tree, 'Verification code', '482190');
    await press(tree, 'Verify');
    expect(onVerify).toHaveBeenCalledWith('482190');
  });

  it('a wrong code: toast with the tries left, boxes cleared, Verify hidden again', async () => {
    const { tree, onVerify } = await setup();
    onVerify.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 4 }));
    await typeInto(tree, 'Verification code', '111111');
    await press(tree, 'Verify');
    expect(lastToast()).toMatchObject({ message: 'That code is not correct. 4 tries left.', tone: 'error' });
    expect(byLabel(tree, 'Verification code').props.value).toBe('');
    expect(has(tree, 'Verify')).toBe(false);
  });

  it('puts the cursor back in the code field after a wrong code', async () => {
    const { tree, onVerify } = await setup();
    onVerify.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 3 }));
    const input = tree.root.findByType(TextInput).instance as { focus: () => void };
    const focus = jest.fn();
    input.focus = focus;
    await typeInto(tree, 'Verification code', '333333');
    await press(tree, 'Verify');
    expect(focus).toHaveBeenCalled();
  });

  it('shows "expired" and "locked" messages from the server as a toast', async () => {
    const { tree, onVerify } = await setup();
    onVerify.mockRejectedValue(new ApiError(400, 'CODE_EXPIRED', 'That code has expired. Request a new one.'));
    await typeInto(tree, 'Verification code', '222222');
    await press(tree, 'Verify');
    expect(lastToast()?.message).toBe('That code has expired. Request a new one.');
  });

  it('the back arrow calls onBack', async () => {
    const { tree, onBack } = await setup();
    await ReactTestRenderer.act(async () => byLabel(tree, 'Back').props.onPress());
    expect(onBack).toHaveBeenCalled();
  });
});
