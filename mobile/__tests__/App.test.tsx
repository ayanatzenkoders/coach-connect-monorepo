import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { authApi } from '../src/api/authApi';
import { ApiError } from '../src/api/client';
import { useAuthStore } from '../src/auth/authStore';
import { allText, byLabel, clearToast, has, lastToast, press, pressText, typeInto, Tree } from '../test-utils';

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'x' },
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));
jest.mock('../src/api/authApi', () => ({
  authApi: { forgotPassword: jest.fn(), verifyResetCode: jest.fn(), resetPassword: jest.fn(), me: jest.fn(), login: jest.fn(), register: jest.fn(), refresh: jest.fn(), logout: jest.fn() },
}));
// The real SafeAreaProvider waits for the phone to report screen insets, which never happens in tests.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const api = authApi as jest.Mocked<typeof authApi>;

/** Open the app signed out and wait for the splash to finish. */
async function openApp(): Promise<Tree> {
  useAuthStore.setState({ status: 'booting', user: null, accessToken: null, signedOutReason: null });
  let tree!: Tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  // The start-up effect runs after the block above. Then the splash bar fills (~0.5 s) before Sign in appears.
  await ReactTestRenderer.act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearToast();
});

test('opens on Sign in when nobody is logged in', async () => {
  const tree = await openApp();
  expect(useAuthStore.getState().status).toBe('signedOut');
  expect(allText(tree)).toContain('Welcome back');
});

test('Sign in -> Forgot password -> back to Sign in', async () => {
  const tree = await openApp();
  await press(tree, 'Forgot password?');
  expect(allText(tree)).toContain('Forgot your password?');
  await press(tree, 'Back to sign in');
  expect(allText(tree)).toContain('Welcome back');
});

test('the whole reset: email -> code screen -> new password screen -> Sign in with a success notice', async () => {
  api.forgotPassword.mockResolvedValue({ expiresInSeconds: 600, resendAfterSeconds: 60 });
  api.verifyResetCode.mockResolvedValue({ resetToken: 'token-123', expiresInSeconds: 600 });
  api.resetPassword.mockResolvedValue({ ok: true });
  const tree = await openApp();

  await press(tree, 'Forgot password?');
  await typeInto(tree, 'Email', 'sara@coachconnect.dev');
  await press(tree, 'Send code');
  expect(api.forgotPassword).toHaveBeenCalledWith('sara@coachconnect.dev');

  // screen 2: the code
  expect(allText(tree)).toContain('Enter the code');
  expect(has(tree, 'Verify')).toBe(false);
  await typeInto(tree, 'Verification code', '482190');
  await press(tree, 'Verify');
  expect(api.verifyResetCode).toHaveBeenCalledWith({ email: 'sara@coachconnect.dev', code: '482190' });

  // screen 3: the new password (the code was right)
  expect(allText(tree)).toContain('Choose a new password');
  await typeInto(tree, 'New password', 'Brand-new-pass-9');
  await press(tree, 'Reset password');
  expect(api.resetPassword).toHaveBeenCalledWith({ resetToken: 'token-123', newPassword: 'Brand-new-pass-9' });

  // back on Sign in with a green notice
  expect(allText(tree)).toContain('Welcome back');
  expect(allText(tree)).toContain('Password updated. Sign in with your new password.');
});

test('a wrong code keeps you on the code screen with a toast', async () => {
  api.forgotPassword.mockResolvedValue({ expiresInSeconds: 600, resendAfterSeconds: 60 });
  api.verifyResetCode.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 4 }));
  const tree = await openApp();
  await press(tree, 'Forgot password?');
  await typeInto(tree, 'Email', 'sara@coachconnect.dev');
  await press(tree, 'Send code');
  await typeInto(tree, 'Verification code', '111111');
  await press(tree, 'Verify');
  expect(allText(tree)).toContain('Enter the code');
  expect(lastToast()?.message).toBe('That code is not correct. 4 tries left.');
  expect(api.resetPassword).not.toHaveBeenCalled();
});

test('no account for that email: toast, then "Create an account" opens sign-up with the email filled in', async () => {
  api.forgotPassword.mockRejectedValue(new ApiError(404, 'ACCOUNT_NOT_FOUND', 'No account exists with this email. Create an account to get started.'));
  const tree = await openApp();
  await press(tree, 'Forgot password?');
  await typeInto(tree, 'Email', 'ghost@example.com');
  await press(tree, 'Send code');
  expect(lastToast()?.message).toMatch(/No account exists/);
  expect(allText(tree)).toContain('Forgot your password?'); // still here: no code was sent
  await press(tree, 'Create an account');
  expect(allText(tree)).toContain('Create your account');
  expect(byLabel(tree, 'Email').props.value).toBe('ghost@example.com');
});

test('if the 10-minute reset window ran out, the user is sent back to start again (with a toast)', async () => {
  api.forgotPassword.mockResolvedValue({ expiresInSeconds: 600, resendAfterSeconds: 60 });
  api.verifyResetCode.mockResolvedValue({ resetToken: 'token-123', expiresInSeconds: 600 });
  api.resetPassword.mockRejectedValue(new ApiError(400, 'RESET_TOKEN_INVALID', 'This reset session has expired. Please start again.'));
  const tree = await openApp();
  await press(tree, 'Forgot password?');
  await typeInto(tree, 'Email', 'sara@coachconnect.dev');
  await press(tree, 'Send code');
  await typeInto(tree, 'Verification code', '482190');
  await press(tree, 'Verify');
  await typeInto(tree, 'New password', 'Brand-new-pass-9');
  await press(tree, 'Reset password');
  expect(lastToast()?.message).toBe('This reset session has expired. Please start again.');
  expect(allText(tree)).toContain('Forgot your password?');
});

test('"Create an account" on Sign in opens an empty sign-up form', async () => {
  const tree = await openApp();
  await pressText(tree, 'Create an account');
  expect(allText(tree)).toContain('Create your account');
  expect(byLabel(tree, 'Email').props.value).toBe('');
});
