module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/custom_components'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec).ts'],
  testPathIgnorePatterns: ['test-utils.ts', 'test-fixtures.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
