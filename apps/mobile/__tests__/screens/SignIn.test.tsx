import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import SignIn from '@/src/screens/auth/signIn/SignIn';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, byLabel, clearToast, has, lastToast, navigationMock, press, pressText, render, resetNavigationMock, screenProps, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));

const signIn = jest.fn();

async function setup(params?: { passwordUpdated?: boolean }) {
  return render(<SignIn {...screenProps('SignIn', params)} />);
}

describe('SignIn screen', () => {
  beforeEach(() => {
    clearToast();
    resetNavigationMock();
    signIn.mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({ signIn, signedOutReason: null });
  });

  it('shows the welcome text, both fields and the sign in button', async () => {
    const tree = await setup();
    expect(allText(tree)).toContain('Welcome back');
    for (const label of ['Email', 'Password', 'Sign in']) expect(has(tree, label)).toBe(true);
  });

  it('puts "Forgot password?" BELOW the password field, and it opens the Forgot password screen', async () => {
    const tree = await setup();
    // order in the form: Email field, Password field, then the link, then the button
    const order = tree.root
      .findAll((n) => ['Email', 'Password', 'Forgot password?', 'Sign in'].includes(n.props.accessibilityLabel) && (n.props.onChangeText || n.props.onPress))
      .map((n) => n.props.accessibilityLabel as string);
    expect(order.indexOf('Password')).toBeLessThan(order.indexOf('Forgot password?'));
    expect(order.indexOf('Forgot password?')).toBeLessThan(order.indexOf('Sign in'));
    await press(tree, 'Forgot password?');
    expect(navigationMock.navigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('opens Create account from the footer link', async () => {
    const tree = await setup();
    await pressText(tree, 'Create an account');
    expect(navigationMock.navigate).toHaveBeenCalledWith('Register');
  });

  it('does not call the server when fields are empty, and shows what is wrong', async () => {
    const tree = await setup();
    await press(tree, 'Sign in');
    expect(signIn).not.toHaveBeenCalled();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Enter a valid email address.', 'Enter your password.']));
  });

  it('rejects an email without a domain', async () => {
    const tree = await setup();
    await typeInto(tree, 'Email', 'sara@');
    await typeInto(tree, 'Password', 'x');
    await press(tree, 'Sign in');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('removes an old error as soon as the user edits that field', async () => {
    const tree = await setup();
    await press(tree, 'Sign in');
    expect(allText(tree)).toContain('Enter a valid email address.');
    await typeInto(tree, 'Email', 'sara@coachconnect.dev');
    expect(allText(tree)).not.toContain('Enter a valid email address.');
    expect(allText(tree)).toContain('Enter your password.');
  });

  it('submits a trimmed email and the password', async () => {
    const tree = await setup();
    await typeInto(tree, 'Email', '  sara@coachconnect.dev ');
    await typeInto(tree, 'Password', 'Password123!');
    await press(tree, 'Sign in');
    expect(signIn).toHaveBeenCalledWith('sara@coachconnect.dev', 'Password123!');
    expect(lastToast()).toBeNull();
  });

  it('shows a server error as a TOAST (no red banner in the form)', async () => {
    const tree = await setup();
    signIn.mockRejectedValue(new Error('Email or password is incorrect.'));
    await typeInto(tree, 'Email', 'sara@coachconnect.dev');
    await typeInto(tree, 'Password', 'wrong');
    await press(tree, 'Sign in');
    expect(lastToast()).toMatchObject({ message: 'Email or password is incorrect.', tone: 'error' });
    expect(allText(tree)).not.toContain('Email or password is incorrect.'); // not inside the screen itself
  });

  it('shows "Password updated" (green) after the forgot-password flow, and forgets it when you leave', async () => {
    const tree = await setup({ passwordUpdated: true });
    expect(allText(tree)).toContain('Password updated. Sign in with your new password.');
    expect(byLabel(tree, 'Sign in')).toBeTruthy();
    await press(tree, 'Forgot password?');
    expect(navigationMock.setParams).toHaveBeenCalledWith({ passwordUpdated: false });
  });

  it('shows why the user was signed out (banned or session ended)', async () => {
    useAuthStore.setState({ signedOutReason: 'banned' });
    const banned = await setup();
    expect(allText(banned)).toContain('This account has been suspended.');
    ReactTestRenderer.act(() => banned.unmount());
    useAuthStore.setState({ signedOutReason: 'expired' });
    const expired = await setup();
    expect(allText(expired)).toContain('Your session ended. Please sign in again.');
  });
});

