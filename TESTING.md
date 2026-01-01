# Unit Tests

This directory contains unit tests for the SIP Core Home Assistant integration.

## Setup

Tests are configured with Jest and TypeScript. All test files should be placed in `__tests__` directories alongside their source files or use `.test.ts` or `.spec.ts` suffixes.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Structure

Tests are organized by component:

- `__tests__/audio-visualizer.test.ts` - Audio visualizer resource management and bounds checking
- `__tests__/sip-core.test.ts` - SIP core validation, user validation, and config validation
- `__tests__/event-listeners.test.ts` - Event listener registration, cleanup, and deduplication

## Writing Tests

Each test file should:

1. Import and test specific functionality
2. Use descriptive test names
3. Group related tests using `describe()` blocks
4. Test both success and failure cases
5. Clean up resources (mocks, event listeners) after each test

### Example Test

```typescript
describe('Feature Name', () => {
  describe('Specific Behavior', () => {
    it('should do something specific', () => {
      const result = myFunction(input);
      expect(result).toBe(expected);
    });
  });
});
```

## Coverage

- Target: 50% coverage across branches, functions, lines, and statements
- Coverage reports are generated in `coverage/` directory when running `npm run test:coverage`

## CI/CD Integration

Tests run automatically on:
- All pull requests to `main` and `develop` branches
- Every commit pushed to GitHub

See `.github/workflows/build.yml` for the build workflow configuration.
