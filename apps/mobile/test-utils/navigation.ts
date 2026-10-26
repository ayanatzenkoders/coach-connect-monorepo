/* eslint-env jest */
/**
 * A stand-in for React Navigation in tests. jest.setup.js makes `useNavigation()` return this object,
 * so a screen's hook can "navigate" without a real NavigationContainer, and tests check what it did:
 *
 *    expect(navigationMock.navigate).toHaveBeenCalledWith('ResetCode', { email, resendSeconds: 60 });
 */
export const navigationMock = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setParams: jest.fn(),
  dispatch: jest.fn(),
};

/** What `useIsFocused()` answers. Set `focusState.focused = false` to pretend another screen is on top. */
export const focusState = { focused: true };

export const resetNavigationMock = () => {
  Object.values(navigationMock).forEach((fn) => fn.mockReset());
  focusState.focused = true;
};

/** The props a native-stack screen receives: `{ navigation, route }`. */
export function screenProps<T = unknown>(name: string, params?: T) {
  return { navigation: navigationMock, route: { key: `${name}-test`, name, params } } as any;
}
