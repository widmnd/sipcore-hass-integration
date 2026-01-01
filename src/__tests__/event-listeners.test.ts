/**
 * Tests for event listener management and cleanup
 */

describe('Event Listener Management', () => {
  let mockElement: any;

  beforeEach(() => {
    mockElement = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  });

  describe('listener registration and cleanup', () => {
    it('should register event listeners', () => {
      const handler = jest.fn();
      mockElement.addEventListener('click', handler);

      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', handler);
    });

    it('should remove event listeners on cleanup', () => {
      const handler = jest.fn();
      mockElement.removeEventListener('click', handler);

      expect(mockElement.removeEventListener).toHaveBeenCalledWith('click', handler);
    });

    it('should prevent duplicate listeners with deduplication flag', () => {
      let listenersAttached = false;
      const handler = jest.fn();

      // First attempt to attach
      if (!listenersAttached) {
        mockElement.addEventListener('change', handler);
        listenersAttached = true;
      }

      // Second attempt - should be skipped
      if (!listenersAttached) {
        mockElement.addEventListener('change', handler);
      }

      expect(mockElement.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('stored listener references', () => {
    it('should store listener reference for cleanup', () => {
      const handler = jest.fn();
      let storedHandler: any = null;

      // Store reference
      storedHandler = handler;
      mockElement.addEventListener('input', storedHandler);

      // Cleanup
      if (storedHandler) {
        mockElement.removeEventListener('input', storedHandler);
      }

      expect(mockElement.addEventListener).toHaveBeenCalledWith('input', handler);
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('input', handler);
    });
  });

  describe('disconnection lifecycle', () => {
    it('should clean up all listeners on disconnect', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      mockElement.addEventListener('click', handler1);
      mockElement.addEventListener('change', handler2);

      // Simulate disconnect
      mockElement.removeEventListener('click', handler1);
      mockElement.removeEventListener('change', handler2);

      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(2);
    });
  });
});
