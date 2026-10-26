import React from 'react';
import { ApiError } from '../src/api/client';
import { ForgotPasswordScreen } from '../src/screens/ForgotPasswordScreen';
import { allText, clearToast, has, lastToast, press, render, typeInto } from '../test-utils';

async function setup() {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const onBack = jest.fn();
  const onCreateAccount = jest.fn();
  const tree = await render(<ForgotPasswordScreen onSubmit={onSubmit} onBack={onBack} onCreateAccount={onCreateAccount} />);
  return { tree, onSubmit, onBack, onCreateAccount };
}

describe('ForgotPasswordScreen', () => {
  beforeEach(clearToast);

  it('explains what will happen', async () => {
    const { tree } = await setup();
    expect(allText(tree)).toContain('Forgot your password?');
  });

  it('does not contact the server for an invalid email', async () => {
    const { tree, onSubmit } = await setup();
    await typeInto(tree, 'Email', 'not-an-email');
    await press(tree, 'Send code');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(allText(tree)).toContain('Enter a valid email address.');
  });

  it('sends the trimmed email', async () => {
    const { tree, onSubmit } = await setup();
    await typeInto(tree, 'Email', '  sara@coachconnect.dev ');
    await press(tree, 'Send code');
    expect(onSubmit).toHaveBeenCalledWith('sara@coachconnect.dev');
  });

  it('when there is NO account: shows the server message as a toast and offers "Create an account"', async () => {
    const { tree, onSubmit, onCreateAccount } = await setup();
    onSubmit.mockRejectedValue(new ApiError(404, 'ACCOUNT_NOT_FOUND', 'No account exists with this email. Create an account to get started.'));
    await typeInto(tree, 'Email', 'ghost@example.com');
    await press(tree, 'Send code');
    expect(lastToast()?.message).toMatch(/No account exists with this email/);
    const text = allText(tree).join(' ');
    expect(text).toContain('We could not find an account for');
    expect(text).toContain('ghost@example.com');
    await press(tree, 'Create an account');
    expect(onCreateAccount).toHaveBeenCalledWith('ghost@example.com');
  });

  it('the "Create an account" offer disappears when the email is edited', async () => {
    const { tree, onSubmit } = await setup();
    onSubmit.mockRejectedValue(new ApiError(404, 'ACCOUNT_NOT_FOUND', 'No account.'));
    await typeInto(tree, 'Email', 'ghost@example.com');
    await press(tree, 'Send code');
    expect(has(tree, 'Create an account')).toBe(true);
    await typeInto(tree, 'Email', 'ghost2@example.com');
    expect(has(tree, 'Create an account')).toBe(false);
  });

  it('other failures (e.g. email could not be sent) are just a toast, with no create-account offer', async () => {
    const { tree, onSubmit } = await setup();
    onSubmit.mockRejectedValue(new ApiError(503, 'EMAIL_SEND_FAILED', 'We could not send the email right now. Please try again in a moment.'));
    await typeInto(tree, 'Email', 'sara@coachconnect.dev');
    await press(tree, 'Send code');
    expect(lastToast()?.message).toMatch(/could not send the email/);
    expect(has(tree, 'Create an account')).toBe(false);
  });

  it('goes back to sign in', async () => {
    const { tree, onBack } = await setup();
    await press(tree, 'Back to sign in');
    expect(onBack).toHaveBeenCalled();
  });
});
