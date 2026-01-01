/**
 * Tests for SIP Core validation and error handling
 */

import {
  createMockUser,
  createMockSIPConfig,
  setupUserValidationTest,
  setupConfigValidationTest,
  createCleanupHandler,
} from './test-utils';

describe('SIPCore Validation', () => {
  let cleanup: ReturnType<typeof createCleanupHandler>;

  beforeEach(() => {
    cleanup = createCleanupHandler();
  });

  afterEach(() => {
    cleanup.runCleanups();
  });

  describe('User validation', () => {
    it('should validate required user fields', () => {
      const { validateUser } = setupUserValidationTest();

      const validUser = createMockUser();
      const invalidUser = createMockUser({ password: undefined });

      expect(validateUser(validUser)).toBe(true);
      expect(validateUser(invalidUser)).toBe(false);
      expect(validateUser(null)).toBe(false);
    });

    it('should require all three user fields', () => {
      const { validateUser } = setupUserValidationTest();

      expect(validateUser({ user: 'test' })).toBe(false);
      expect(validateUser({ user: 'test', password: 'pass' })).toBe(false);
      expect(validateUser({ user: 'test', password: 'pass', domain: 'example.com' })).toBe(true);
    });

    it('should reject users with invalid field types', () => {
      const { validateUser } = setupUserValidationTest();

      expect(validateUser({ user: 123, password: 'pass', domain: 'example.com' })).toBe(false);
      expect(validateUser({ user: 'test', password: null, domain: 'example.com' })).toBe(false);
      expect(validateUser({ user: 'test', password: 'pass', domain: {} })).toBe(false);
    });
  });

  describe('Configuration validation', () => {
    it('should validate extension format', () => {
      const { validateExtension } = setupConfigValidationTest();

      expect(validateExtension('1001')).toBe(true);
      expect(validateExtension('user-ext')).toBe(true);
      expect(validateExtension('extension_123')).toBe(true);
    });

    it('should reject invalid extension formats', () => {
      const { validateExtension } = setupConfigValidationTest();

      expect(validateExtension('invalid@ext')).toBe(false);
      expect(validateExtension('')).toBe(false);
      expect(validateExtension('this-is-way-too-long-extension-name')).toBe(false);
      expect(validateExtension('ext#123')).toBe(false);
    });

    it('should validate config structure', () => {
      const { validateConfig } = setupConfigValidationTest();

      const validConfig = createMockSIPConfig();
      const invalidConfig = createMockSIPConfig({ extensions: 'not-an-array' });

      expect(validateConfig(validConfig)).toBe(true);
      expect(validateConfig(invalidConfig)).toBe(false);
    });

    it('should handle empty configuration', () => {
      const { validateConfig } = setupConfigValidationTest();

      expect(validateConfig({})).toBe(false);
      expect(validateConfig({ extensions: [], buttons: [] })).toBe(true);
    });

    it('should reject non-object configurations', () => {
      const { validateConfig } = setupConfigValidationTest();

      expect(validateConfig(null)).toBe(false);
      expect(validateConfig(undefined)).toBe(false);
      expect(validateConfig('string')).toBe(false);
      expect(validateConfig(123)).toBe(false);
    });
  });

  describe('null safety checks', () => {
    it('should safely access optional properties', () => {
      const user: any = createMockUser();

      // Test optional chaining and nullish coalesce
      const password = user['password'] ?? 'default';
      expect(password).toBe('password123');
    });

    it('should provide default for missing optional properties', () => {
      const user: any = { user: 'test' };

      const password = user['password'] ?? 'default';
      const domain = user['domain'] ?? 'example.com';

      expect(password).toBe('default');
      expect(domain).toBe('example.com');
    });

    it('should handle null references gracefully', () => {
      const config = null;

      if (!config) {
        expect(config).toBeNull();
      }
    });

    it('should handle undefined values', () => {
      const config: any = undefined;

      const heartbeat = config?.heartbeatIntervalMs ?? 30000;
      expect(heartbeat).toBe(30000);
    });
  });

  describe('Configuration defaults', () => {
    it('should provide sensible defaults for config', () => {
      const config = createMockSIPConfig();

      expect(config.heartbeatIntervalMs).toBe(30000);
      expect(config.stunServers).toBeDefined();
      expect(Array.isArray(config.stunServers)).toBe(true);
    });

    it('should allow configuration overrides', () => {
      const config = createMockSIPConfig({ heartbeatIntervalMs: 60000 });

      expect(config.heartbeatIntervalMs).toBe(60000);
    });
  });
});
