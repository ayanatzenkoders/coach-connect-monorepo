module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // "@/src/components" instead of "../../../components" (same alias as tsconfig.json and jest.config.js).
    ['module-resolver', { root: ['.'], alias: { '@': '.' }, extensions: ['.ts', '.tsx', '.js', '.json'] }],
  ],
  env: {
    // Strip console.* from release bundles; keep console.error for crash reporting.
    production: { plugins: [['transform-remove-console', { exclude: ['error'] }]] },
  },
};
