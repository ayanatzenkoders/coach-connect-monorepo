module.exports = {
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['./jest.setup.after.js'],
  preset: '@react-native/jest-preset',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  // React Navigation ships ES modules, so Jest has to compile it like our own code.
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)'],
};
