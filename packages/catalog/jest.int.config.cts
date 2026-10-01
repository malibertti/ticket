const baseConfig = require('./jest.config.cts');

module.exports = {
  ...baseConfig,
  displayName: 'catalog.int',
  testMatch: ['<rootDir>/src/**/*.int.spec.ts'],
  testTimeout: 30_000,
  coverageDirectory: '../../coverage/packages/catalog.int',
  transformIgnorePatterns: [
    'node_modules/(?!(@nestjs/config/|\\.pnpm/@nestjs\\+config@))',
  ],
};
