module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/custom_components'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec).ts'],
  testPathIgnorePatterns: ['test-utils.ts', 'test-fixtures.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'custom_components/**/*.py',
    '!src/**/*.d.ts',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
