const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// pnpm workspace: dependencies are hoisted to the repo root and @coach-connect/shared is a symlink to
// packages/shared, so Metro must look (and watch) outside this folder too.
const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [path.join(workspaceRoot, 'node_modules'), path.join(workspaceRoot, 'packages/shared')],
  resolver: {
    nodeModulesPaths: [path.join(__dirname, 'node_modules'), path.join(workspaceRoot, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
