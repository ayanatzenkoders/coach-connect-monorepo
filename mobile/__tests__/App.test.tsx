import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { useAuthStore } from '../src/auth/authStore';

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'x' },
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

// The real SafeAreaProvider waits for the phone to report screen insets, which never happens in tests.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));

test('opens on Sign in when nobody is logged in', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  // The start-up effect runs after the block above. Then the splash bar fills (~0.5 s) before Sign in appears.
  await ReactTestRenderer.act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
  });
  expect(useAuthStore.getState().status).toBe('signedOut');
  expect(texts(tree)).toContain('Welcome back');
});
