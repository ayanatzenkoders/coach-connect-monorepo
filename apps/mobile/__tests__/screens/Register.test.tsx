import React from 'react';
import Register from '@/src/screens/auth/register/Register';
import { ApiError } from '@/src/service/setup/apiClient';
import { useAuthStore } from '@/src/store/auth.store';
import { allText, byLabel, clearToast, lastToast, navigationMock, press, render, resetNavigationMock, screenProps, typeInto } from '@/test-utils';

jest.mock('react-native-keychain', () => ({}));

const register = jest.fn();

async function setup(email?: string) {
  return render(<Register {...screenProps('Register', email ? { email } : undefined)} />);
}
async function fillValid(tree: Awaited<ReturnType<typeof render>>, password = 'Longenough1') {
  await typeInto(tree, 'Full name', '  Sara Malik ');
  await typeInto(tree, 'Email', ' sara@coachconnect.dev ');
  await typeInto(tree, 'Password', password);
}

describe('Register screen', () => {
  beforeEach(() => {
    clearToast();
    resetNavigationMock();
    register.mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({ register });
  });

  it('shows the title, three fields and the four password rules', async () => {
    const tree = await setup();
    expect(allText(tree)).toContain('Create your account');
    for (const label of ['Full name', 'Email', 'Password', 'Create account']) expect(byLabel(tree, label)).toBeTruthy();
    expect(allText(tree)).toEqual(expect.arrayContaining(['At least 8 characters', 'One lowercase letter', 'One uppercase letter', 'One number']));
  });

  it('starts with the email passed in (from "Forgot password: no account")', async () => {
    const tree = await setup('ghost@example.com');
    expect(byLabel(tree, 'Email').props.value).toBe('ghost@example.com');
  });

  it('blocks submit and lists what is missing', async () => {
    const tree = await setup();
    await press(tree, 'Create account');
    expect(register).not.toHaveBeenCalled();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Enter your name.', 'Enter a valid email address.']));
  });

  it.each([
    ['no uppercase letter', 'alllowercase1'],
    ['no lowercase letter', 'ALLUPPERCASE1'],
    ['no number', 'NoNumbersHere'],
    ['only 7 characters', 'Abcde1f'],
  ])('refuses a password with %s', async (_label, pw) => {
    const tree = await setup();
    await fillValid(tree, pw);
    await press(tree, 'Create account');
    expect(register).not.toHaveBeenCalled();
    expect(allText(tree)).toContain('Your password does not meet all the requirements below.');
  });

  it('submits trimmed name and email with a strong password', async () => {
    const tree = await setup();
    await fillValid(tree);
    await press(tree, 'Create account');
    expect(register).toHaveBeenCalledWith('Sara Malik', 'sara@coachconnect.dev', 'Longenough1');
  });

  it('shows "email already exists" (from the server) as a toast', async () => {
    const tree = await setup();
    register.mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.'));
    await fillValid(tree);
    await press(tree, 'Create account');
    expect(lastToast()).toMatchObject({ message: 'An account with this email already exists.', tone: 'error' });
  });

  it('shows no-internet as a toast', async () => {
    const tree = await setup();
    register.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    await fillValid(tree);
    await press(tree, 'Create account');
    expect(lastToast()?.message).toBe('Cannot reach the server.');
  });

  it('goes back to sign in', async () => {
    const tree = await setup();
    await press(tree, 'Back to sign in');
    expect(navigationMock.goBack).toHaveBeenCalled();
  });
});
