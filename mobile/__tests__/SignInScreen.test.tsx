import React from 'react';
import { SignInScreen } from '../src/screens/SignInScreen';
import { allText, byLabel, clearToast, has, lastToast, press, render, typeInto } from '../test-utils';

async function setup(props: Partial<React.ComponentProps<typeof SignInScreen>> = {}) {
  const onSignIn = jest.fn().mockResolvedValue(undefined);
  const onForgotPassword = jest.fn();
  const onCreateAccount = jest.fn();
  const tree = await render(<SignInScreen onSignIn={onSignIn} onCreateAccount={onCreateAccount} onForgotPassword={onForgotPassword} {...props} />);
  return { tree, onSignIn, onForgotPassword, onCreateAccount };
}

describe('SignInScreen', () => {
  beforeEach(clearToast);

  it('shows the welcome text, both fields and the sign in button', async () => {
    const { tree } = await setup();
    expect(allText(tree)).toContain('Welcome back');
    for (const label of ['Email', 'Password', 'Sign in']) expect(has(tree, label)).toBe(true);
  });

  it('puts "Forgot password?" BELOW the password field, and it works', async () => {
    const { tree, onForgotPassword } = await setup();
    // order in the form: Email field, Password field, then the link, then the button
    const order = tree.root
      .findAll((n) => ['Email', 'Password', 'Forgot password?', 'Sign in'].includes(n.props.accessibilityLabel) && (n.props.onChangeText || n.props.onPress))
      .map((n) => n.props.accessibilityLabel as string);
    expect(order.indexOf('Password')).toBeLessThan(order.indexOf('Forgot password?'));
    expect(order.indexOf('Forgot password?')).toBeLessThan(order.indexOf('Sign in'));
    await press(tree, 'Forgot password?');
    expect(onForgotPassword).toHaveBeenCalled();
  });

  it('does not call the server when fields are empty, and shows what is wrong', async () => {
    const { tree, onSignIn } = await setup();
    await press(tree, 'Sign in');
    expect(onSignIn).not.toHaveBeenCalled();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Enter a valid email address.', 'Enter your password.']));
  });

  it('rejects an email without a domain', async () => {
    const { tree, onSignIn } = await setup();
    await typeInto(tree, 'Email', 'sara@');
    await typeInto(tree, 'Password', 'x');
    await press(tree, 'Sign in');
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('removes an old error as soon as the user edits that field', async () => {
    const { tree } = await setup();
    await press(tree, 'Sign in');
    expect(allText(tree)).toContain('Enter a valid email address.');
    await typeInto(tree, 'Email', 'sara@coachconnect.dev');
    expect(allText(tree)).not.toContain('Enter a valid email address.');
    expect(allText(tree)).toContain('Enter your password.');
  });

  it('submits a trimmed email and the password', async () => {
    const { tree, onSignIn } = await setup();
    await typeInto(tree, 'Email', '  sara@coachconnect.dev ');
    await typeInto(tree, 'Password', 'Password123!');
    await press(tree, 'Sign in');
    expect(onSignIn).toHaveBeenCalledWith('sara@coachconnect.dev', 'Password123!');
    expect(lastToast()).toBeNull();
  });

  it('shows a server error as a TOAST (no red banner in the form)', async () => {
    const { tree, onSignIn } = await setup();
    onSignIn.mockRejectedValue(new Error('Email or password is incorrect.'));
    await typeInto(tree, 'Email', 'sara@coachconnect.dev');
    await typeInto(tree, 'Password', 'wrong');
    await press(tree, 'Sign in');
    expect(lastToast()).toMatchObject({ message: 'Email or password is incorrect.', tone: 'error' });
    expect(allText(tree)).not.toContain('Email or password is incorrect.'); // not inside the screen itself
  });

  it('hides Apple and Google buttons until social sign-in exists', async () => {
    const hidden = await setup();
    expect(allText(hidden.tree)).not.toContain('Continue with Apple');
    const shown = await setup({ showSocial: true });
    expect(allText(shown.tree)).toContain('Continue with Apple');
  });

  it('shows a notice above the form (e.g. "Password updated")', async () => {
    const { tree } = await setup({ notice: 'Password updated. Sign in with your new password.', noticeTone: 'success' });
    expect(allText(tree)).toContain('Password updated. Sign in with your new password.');
    expect(byLabel(tree, 'Sign in')).toBeTruthy();
  });
});
