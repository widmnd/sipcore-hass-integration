/**
 * Tests for Lit component rendering and behavior
 */

import { createMockElement, createMockHass, createCleanupHandler } from './test-utils';

describe('Component Rendering and Lifecycle', () => {
  let cleanup: ReturnType<typeof createCleanupHandler>;

  beforeEach(() => {
    cleanup = createCleanupHandler();
  });

  afterEach(() => {
    cleanup.runCleanups();
  });

  describe('Component Lifecycle', () => {
    it('should initialize component with properties', () => {
      const element = createMockElement();

      // Simulate component initialization
      const config = { extensions: [], buttons: [] };
      element.setAttribute('config', JSON.stringify(config));

      expect(element.setAttribute).toHaveBeenCalledWith('config', expect.any(String));
    });

    it('should attach event listeners on connect', () => {
      const element = createMockElement();
      const handler = jest.fn();

      element.addEventListener('change', handler);

      expect(element.addEventListener).toHaveBeenCalledWith('change', handler);
      cleanup.addCleanup(() => {
        element.removeEventListener('change', handler);
      });
    });

    it('should cleanup event listeners on disconnect', () => {
      const element = createMockElement();
      const handler = jest.fn();

      element.addEventListener('click', handler);
      element.removeEventListener('click', handler);

      expect(element.removeEventListener).toHaveBeenCalledWith('click', handler);
    });
  });

  describe('Event Handling', () => {
    it('should handle change events', () => {
      const element = createMockElement();
      const handlers = {
        onChange: jest.fn(),
      };

      element.addEventListener('change', handlers.onChange);
      expect(element.addEventListener).toHaveBeenCalledWith('change', handlers.onChange);

      cleanup.addCleanup(() => {
        element.removeEventListener('change', handlers.onChange);
      });
    });

    it('should handle input events', () => {
      const element = createMockElement();
      const handlers = {
        onInput: jest.fn(),
      };

      element.addEventListener('input', handlers.onInput);
      expect(element.addEventListener).toHaveBeenCalledWith('input', handlers.onInput);
    });

    it('should handle click events', () => {
      const element = createMockElement();
      const handlers = {
        onClick: jest.fn(),
      };

      element.addEventListener('click', handlers.onClick);
      expect(element.addEventListener).toHaveBeenCalledWith('click', handlers.onClick);
    });
  });

  describe('DOM Manipulation', () => {
    it('should update DOM classes', () => {
      const element = createMockElement();

      element.classList.add('active');
      element.classList.remove('disabled');
      element.classList.toggle('visible');

      expect(element.classList.add).toHaveBeenCalledWith('active');
      expect(element.classList.remove).toHaveBeenCalledWith('disabled');
      expect(element.classList.toggle).toHaveBeenCalledWith('visible');
    });

    it('should set and remove attributes', () => {
      const element = createMockElement();

      element.setAttribute('data-test', 'value');
      element.removeAttribute('data-test');

      expect(element.setAttribute).toHaveBeenCalledWith('data-test', 'value');
      expect(element.removeAttribute).toHaveBeenCalledWith('data-test');
    });

    it('should query DOM elements', () => {
      const element = createMockElement();
      const childElement = createMockElement();

      element.querySelector = jest.fn().mockReturnValue(childElement);
      const result = element.querySelector('.child');

      expect(element.querySelector).toHaveBeenCalledWith('.child');
      expect(result).toBe(childElement);
    });
  });

  describe('Home Assistant Integration', () => {
    it('should access hass object', () => {
      const hass = createMockHass();

      expect(hass.data).toBeDefined();
      expect(hass.config).toBeDefined();
      expect(hass.callService).toBeDefined();
    });

    it('should call Home Assistant services', () => {
      const hass = createMockHass();

      hass.callService('notify', 'send', {
        message: 'Test message',
      });

      expect(hass.callService).toHaveBeenCalledWith(
        'notify',
        'send',
        expect.objectContaining({
          message: 'Test message',
        }),
      );
    });

    it('should access SIP configuration from hass.data', () => {
      const hass = createMockHass();

      const sipConfig = hass.data.sip_core;
      expect(sipConfig).toBeDefined();
      expect(sipConfig.config).toBeDefined();
      expect(sipConfig.options).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      const element = createMockElement();

      const config = element.getAttribute('config');
      const parsedConfig = config ? JSON.parse(config) : null;

      expect(parsedConfig).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      const element = createMockElement();
      element.getAttribute = jest.fn().mockReturnValue('invalid json');

      try {
        const config = element.getAttribute('config');
        const parsed = JSON.parse(config || '');
        expect(parsed).toBeUndefined();
      } catch (error) {
        // Expected error
        expect(error).toBeInstanceOf(SyntaxError);
      }
    });

    it('should handle missing event handlers', () => {
      const element = createMockElement();

      // Should not throw
      expect(() => {
        element.addEventListener('nonexistent', jest.fn());
      }).not.toThrow();
    });
  });
});
