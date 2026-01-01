/**
 * Test utilities and mock factories
 */

/**
 * Mock SIP User object
 */
export function createMockUser(overrides?: Partial<any>) {
  return {
    user: 'test-user',
    password: 'password123',
    domain: 'example.com',
    display_name: 'Test User',
    ...overrides,
  };
}

/**
 * Mock SIP Configuration
 */
export function createMockSIPConfig(overrides?: Partial<any>) {
  return {
    extensions: [
      {
        number: '1001',
        user: 'user1',
        password: 'pass1',
        domain: 'example.com',
      },
    ],
    buttons: [
      {
        name: 'Office',
        number: '1001',
      },
    ],
    heartbeatIntervalMs: 30000,
    stunServers: ['stun:stun.l.google.com:19302'],
    ...overrides,
  };
}

/**
 * Mock Home Assistant object
 */
export function createMockHass(overrides?: Partial<any>) {
  return {
    callService: jest.fn().mockResolvedValue(undefined),
    callWS: jest.fn().mockResolvedValue(undefined),
    states: {},
    entities: {},
    config: {
      latitude: 0,
      longitude: 0,
      elevation: 0,
      unit_system: 'metric',
      time_zone: 'UTC',
    },
    data: {
      sip_core: {
        config: createMockSIPConfig(),
        options: { sip_config: createMockSIPConfig() },
        entry_id: 'test-entry-id',
      },
    },
    auth: {
      access_token: 'test-token',
      refresh_token: 'refresh-token',
    },
    ...overrides,
  };
}

/**
 * Mock jssip UA (User Agent)
 */
export function createMockUA(overrides?: Partial<any>) {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invite: jest.fn().mockReturnValue({
      send: jest.fn(),
    }),
    register: jest.fn().mockReturnValue({
      send: jest.fn(),
    }),
    on: jest.fn(),
    off: jest.fn(),
    transport: {
      server: {
        ws_uri: 'wss://example.com:8089/ws',
      },
    },
    ...overrides,
  };
}

/**
 * Mock jssip UserAgent
 */
export function createMockJSSIPUserAgent(overrides?: Partial<any>) {
  return {
    ...createMockUA(),
    configuration: {
      sockets: [],
      uri: 'sip:user@example.com',
      password: 'password123',
      ...overrides,
    },
  };
}

/**
 * Mock AudioContext
 */
export function createMockAudioContext(overrides?: Partial<any>) {
  return {
    createMediaElementSource: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
    createAnalyser: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: jest.fn(),
    }),
    createMediaStreamSource: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
    destination: {},
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Mock MediaDevices
 */
export function createMockMediaDevices(overrides?: Partial<any>) {
  return {
    enumerateDevices: jest.fn().mockResolvedValue([
      {
        deviceId: 'default',
        groupId: 'group-1',
        kind: 'audioinput',
        label: 'Default Audio Input',
      },
      {
        deviceId: 'mic-1',
        groupId: 'group-1',
        kind: 'audioinput',
        label: 'External Microphone',
      },
      {
        deviceId: 'speaker-1',
        groupId: 'group-1',
        kind: 'audiooutput',
        label: 'External Speaker',
      },
    ]),
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([
        {
          stop: jest.fn(),
          kind: 'audio',
        },
      ]),
    }),
    ...overrides,
  };
}

/**
 * DOM test helpers
 */
export function createMockElement(overrides?: Partial<any>) {
  return {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn().mockReturnValue(false),
    },
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    querySelector: jest.fn().mockReturnValue(null),
    querySelectorAll: jest.fn().mockReturnValue([]),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    innerHTML: '',
    textContent: '',
    ...overrides,
  };
}

/**
 * Setup helpers for common test scenarios
 */
export function setupUserValidationTest() {
  return {
    validateUser: (user: any) => {
      if (!user) return false;
      return (
        typeof user.user === 'string' &&
        typeof user.password === 'string' &&
        typeof user.domain === 'string'
      );
    },
  };
}

export function setupConfigValidationTest() {
  return {
    validateConfig: (config: any) => {
      if (!config || typeof config !== 'object') return false;
      return (
        'extensions' in config &&
        Array.isArray(config.extensions) &&
        'buttons' in config &&
        Array.isArray(config.buttons)
      );
    },
    validateExtension: (ext: string) => {
      const extensionRegex = /^[a-zA-Z0-9_-]{1,20}$/;
      return extensionRegex.test(ext);
    },
  };
}

/**
 * Cleanup helper for resource management
 */
export function createCleanupHandler() {
  const cleanups: (() => void)[] = [];

  return {
    addCleanup: (cleanup: () => void) => {
      cleanups.push(cleanup);
    },
    runCleanups: () => {
      cleanups.reverse().forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      });
      cleanups.length = 0;
    },
  };
}
