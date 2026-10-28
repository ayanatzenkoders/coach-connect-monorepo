/* eslint-env jest */
// react-native-svg draws with native code that does not exist in tests. Render plain placeholders instead.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const make = (name) => (props) => React.createElement(name, props, props.children);
  return {
    __esModule: true,
    default: make('Svg'),
    Svg: make('Svg'),
    Path: make('Path'),
    Circle: make('Circle'),
  };
});

// React Navigation: screens' hooks call useNavigation(); tests use a simple mock instead of a real navigator.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const { navigationMock, focusState } = require('./test-utils/navigation');
  return { ...actual, useNavigation: () => navigationMock, useIsFocused: () => focusState.focused };
});

// No real network connection in tests: the socket is a fake, and a test plays the server with fakeSocket.receive().
jest.mock('@/src/service/socket/socket', () => {
  const { fakeSocket } = require('./test-utils/socket');
  return { getSocket: () => fakeSocket, connectSocket: jest.fn(), disconnectSocket: jest.fn() };
});

// The real SafeAreaProvider waits for the phone to report screen insets, which never happens in tests.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// React Query normally hands updates to React with setTimeout(0). With fake timers that would stall,
// so in tests it calls straight away.
require('@tanstack/react-query').notifyManager.setScheduler((callback) => callback());
