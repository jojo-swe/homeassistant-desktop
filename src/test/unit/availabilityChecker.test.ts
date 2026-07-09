import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => ({
  net: {
    request: vi.fn(),
  },
}));

vi.mock('bonjour-service', () => ({
  Bonjour: vi.fn(() => ({
    find: vi.fn(),
  })),
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../main/config', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../main/instances', () => ({
  currentInstance: vi.fn(),
}));

import { net } from 'electron';
import logger from 'electron-log';
import config from '../../main/config';
import { currentInstance } from '../../main/instances';
import * as availabilityChecker from '../../main/availabilityChecker';

function makeMockRequest() {
  const handlers: Record<string, (...args: any[]) => void> = {};
  return {
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      handlers[event] = cb;
      return mockRequest;
    }),
    end: vi.fn(() => {
      if (handlers['response']) handlers['response']({ statusCode: 200 });
    }),
    _handlers: handlers,
  };
}

let mockRequest: any;

describe('availabilityChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    availabilityChecker.stop();
    mockRequest = makeMockRequest();
    vi.mocked(net.request).mockReturnValue(mockRequest as any);
  });

  describe('init', () => {
    test('starts interval and logs info', () => {
      const showError = vi.fn().mockResolvedValue(undefined);
      availabilityChecker.init({ showError });
      expect(logger.info).toHaveBeenCalledWith('Initialized availability check');
    });

    test('does not start a second interval if already running', () => {
      const showError = vi.fn().mockResolvedValue(undefined);
      availabilityChecker.init({ showError });
      availabilityChecker.init({ showError });
      expect(logger.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    test('stops the interval', () => {
      const showError = vi.fn().mockResolvedValue(undefined);
      availabilityChecker.init({ showError });
      availabilityChecker.stop();
      availabilityChecker.init({ showError });
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    test('can be called when not running', () => {
      expect(() => availabilityChecker.stop()).not.toThrow();
    });
  });

  describe('availabilityCheck', () => {
    test('does nothing when no current instance', () => {
      vi.mocked(currentInstance).mockReturnValue(null as any);
      const showError = vi.fn().mockResolvedValue(undefined);
      availabilityChecker.init({ showError });
      availabilityChecker.stop();
      availabilityChecker['availabilityCheck']({ showError });
      expect(net.request).not.toHaveBeenCalled();
    });

    test('logs error on invalid URL', () => {
      vi.mocked(currentInstance).mockReturnValue('not-a-url');
      const showError = vi.fn().mockResolvedValue(undefined);
      availabilityChecker['availabilityCheck']({ showError });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid stored instance URL'));
    });

    test('makes request to auth providers endpoint', () => {
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      const showError = vi.fn().mockResolvedValue(undefined);
      availabilityChecker['availabilityCheck']({ showError });
      expect(net.request).toHaveBeenCalledWith('http://ha.local:8123/auth/providers');
    });

    test('calls showError on non-200 response', async () => {
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      const showError = vi.fn().mockResolvedValue(undefined);
      const handlers: Record<string, (...args: any[]) => void> = {};
      vi.mocked(net.request).mockReturnValue({
        on: vi.fn((event: string, cb: (...args: any[]) => void) => {
          handlers[event] = cb;
          return mockRequest;
        }),
        end: vi.fn(() => {
          if (handlers['response']) handlers['response']({ statusCode: 500 });
        }),
      } as any);
      availabilityChecker['availabilityCheck']({ showError });
      await vi.waitFor(() => expect(showError).toHaveBeenCalledWith(true));
    });

    test('calls showError on request error and clears interval', async () => {
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      const showError = vi.fn().mockResolvedValue(undefined);
      const handlers: Record<string, (...args: any[]) => void> = {};
      vi.mocked(net.request).mockReturnValue({
        on: vi.fn((event: string, cb: (...args: any[]) => void) => {
          handlers[event] = cb;
          return mockRequest;
        }),
        end: vi.fn(() => {
          if (handlers['error']) handlers['error'](new Error('connection refused'));
        }),
      } as any);
      availabilityChecker.init({ showError });
      availabilityChecker['availabilityCheck']({ showError });
      await vi.waitFor(() => expect(showError).toHaveBeenCalledWith(true));
    });

    test('triggers checkForAvailableInstance on error when automaticSwitching is enabled', async () => {
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'automaticSwitching') return true;
        if (key === 'allInstances') return ['http://ha.local:8123'];
        return undefined;
      });
      const showError = vi.fn().mockResolvedValue(undefined);
      const handlers: Record<string, (...args: any[]) => void> = {};
      vi.mocked(net.request).mockReturnValue({
        on: vi.fn((event: string, cb: (...args: any[]) => void) => {
          handlers[event] = cb;
          return mockRequest;
        }),
        end: vi.fn(() => {
          if (handlers['error']) handlers['error'](new Error('connection refused'));
        }),
      } as any);
      availabilityChecker.init({ showError });
      availabilityChecker['availabilityCheck']({ showError });
      await vi.waitFor(() => expect(config.get).toHaveBeenCalledWith('automaticSwitching'));
    });
  });

  describe('checkForAvailableInstance', () => {
    test('does nothing when only one instance', () => {
      vi.mocked(config.get).mockReturnValue(['http://ha.local:8123']);
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      availabilityChecker['checkForAvailableInstance']();
      expect(net.request).not.toHaveBeenCalled();
    });

    test('does nothing when no instances', () => {
      vi.mocked(config.get).mockReturnValue(null as any);
      availabilityChecker['checkForAvailableInstance']();
      expect(net.request).not.toHaveBeenCalled();
    });

    test('makes requests for other instances', () => {
      vi.mocked(config.get).mockReturnValue(['http://ha.local:8123', 'http://ha.remote:8123']);
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      availabilityChecker['checkForAvailableInstance']();
      expect(net.request).toHaveBeenCalled();
    });

    test('handles invalid URL gracefully without throwing', () => {
      vi.mocked(config.get).mockReturnValue(['http://ha.local:8123', 'not-a-url']);
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      expect(() => availabilityChecker['checkForAvailableInstance']()).not.toThrow();
    });

    test('sets currentInstance when a remote instance responds 200', async () => {
      vi.mocked(config.get).mockReturnValue(['http://ha.local:8123', 'http://ha.remote:8123']);
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      const handlers: Record<string, (...args: any[]) => void> = {};
      vi.mocked(net.request).mockReturnValue({
        on: vi.fn((event: string, cb: (...args: any[]) => void) => {
          handlers[event] = cb;
          return mockRequest;
        }),
        end: vi.fn(() => {
          if (handlers['response']) handlers['response']({ statusCode: 200 });
        }),
      } as any);
      availabilityChecker['checkForAvailableInstance']();
      await vi.waitFor(() => expect(currentInstance).toHaveBeenCalledWith('http://ha.remote:8123'));
    });

    test('does not set currentInstance when all remote instances fail', async () => {
      vi.mocked(config.get).mockReturnValue(['http://ha.local:8123', 'http://ha.remote:8123']);
      vi.mocked(currentInstance).mockReturnValue('http://ha.local:8123');
      const handlers: Record<string, (...args: any[]) => void> = {};
      vi.mocked(net.request).mockReturnValue({
        on: vi.fn((event: string, cb: (...args: any[]) => void) => {
          handlers[event] = cb;
          return mockRequest;
        }),
        end: vi.fn(() => {
          if (handlers['error']) handlers['error'](new Error('refused'));
        }),
      } as any);
      availabilityChecker['checkForAvailableInstance']();
      await new Promise((r) => setTimeout(r, 50));
      expect(currentInstance).not.toHaveBeenCalledWith('http://ha.remote:8123');
    });
  });

  describe('getBonjour', () => {
    test('returns a bonjour instance', () => {
      const b = availabilityChecker.getBonjour();
      expect(b).toBeDefined();
    });

    test('returns the same instance on subsequent calls', () => {
      const b1 = availabilityChecker.getBonjour();
      const b2 = availabilityChecker.getBonjour();
      expect(b1).toBe(b2);
    });
  });
});
