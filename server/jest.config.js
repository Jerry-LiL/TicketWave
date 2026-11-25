module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setEnv.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  testTimeout: 20000,
  maxWorkers: 1,
};
