/* eslint-env jest */
// Runs after the test framework is ready (so afterEach exists).
const { unmountAll } = require('./test-utils');

afterEach(() => {
  unmountAll();
});
