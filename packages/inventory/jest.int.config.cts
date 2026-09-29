const baseConfig = require('./jest.config.cts');

module.exports = {
  ...baseConfig,
  displayName: 'inventory-int',
  testMatch: ['<rootDir>/src/**/*.int.spec.ts'],
  testTimeout: 30_000,
  coverageDirectory: '../../coverage/packages/inventory-int',
  transformIgnorePatterns: [
    'node_modules/(?!(@nestjs/config/|\\.pnpm/@nestjs\\+config@))',
  ],
};
