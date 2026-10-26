import React from 'react';
import { ApiError } from '../src/api/client';
import { ResetCodeScreen } from '../src/screens/ResetCodeScreen';
import { allText, byLabel, clearToast, has, lastToast, press, pressText, render, tick, typeInto } from '../test-utils';

async function setup(initialResendSeconds = 45) {
  const mocks = {
    onResend: jest.fn().mockResolvedValue({ resendAfterSeconds: 60 }),
    onVerify: jest.fn().mockResolvedValue(undefined),
    onBack: jest.fn(),
  };
  const tree = await render(<ResetCodeScreen email="sara@coachconnect.dev" initialResendSeconds={initialResendSeconds} {...mocks} />);
  return { tree, ...mocks };
}

describe('ResetCodeScreen (forgot password, screen 2 of 3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearToast();
  });
  afterEach(() => jest.useRealTimers());

  it('names the email and counts down from the time the server gave', async () => {
    const { tree, onResend } = await setup(45);
    expect(allText(tree).join(' ')).toContain('sara@coachconnect.dev');
    expect(allText(tree)).toContain('Resend in 0:45');
    expect(onResend).not.toHaveBeenCalled(); // the code was already sent on the previous screen
  });

  it('shows Verify only when six digits are typed, then sends the code', async () => {
    const { tree, onVerify } = await setup();
    expect(has(tree, 'Verify')).toBe(false);
    await typeInto(tree, 'Verification code', '123');
    expect(has(tree, 'Verify')).toBe(false);
    await typeInto(tree, 'Verification code', '482190');
    await press(tree, 'Verify');
    expect(onVerify).toHaveBeenCalledWith('482190');
  });

  it('a wrong code: toast, boxes cleared', async () => {
    const { tree, onVerify } = await setup();
    onVerify.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 4 }));
    await typeInto(tree, 'Verification code', '111111');
    await press(tree, 'Verify');
    expect(lastToast()?.message).toBe('That code is not correct. 4 tries left.');
    expect(byLabel(tree, 'Verification code').props.value).toBe('');
  });

  it('resend works after the countdown, asks for a new code and restarts the countdown', async () => {
    const { tree, onResend } = await setup(2);
    await tick(2);
    expect(allText(tree)).toContain('Resend code');
    await pressText(tree, 'Resend code');
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(allText(tree)).toContain('Resend in 1:00');
  });

  it('the back arrow goes back to the email screen', async () => {
    const { tree, onBack } = await setup();
    await press(tree, 'Back');
    expect(onBack).toHaveBeenCalled();
  });
});
