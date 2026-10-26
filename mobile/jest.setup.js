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
