module.exports = {
  testMatch: ['**/src/**/*.test.js'],
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js', '!src/haNotificationBridge.js'],
  coverageDirectory: 'coverage',
  verbose: false,
};
