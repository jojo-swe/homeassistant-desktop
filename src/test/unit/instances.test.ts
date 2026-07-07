import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../../main/config', () => {
  const store: Record<string, unknown> = {
    allInstances: [],
  };
  return {
    default: {
      get: vi.fn((key: string) => store[key]),
      set: vi.fn((key: string, val: unknown) => {
        store[key] = val;
      }),
      has: vi.fn((key: string) => key in store),
    },
  };
});

import config from '../../main/config';
import { currentInstance, addInstance } from '../../main/instances';

describe('instances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(config.get).mockImplementation((key: string) => {
      if (key === 'allInstances') return ['http://ha1.local', 'http://ha2.local'];
      if (key === 'currentInstance') return 0;
      return undefined;
    });
    vi.mocked(config.has).mockImplementation((key: string) => key === 'currentInstance' || key === 'allInstances');
  });

  describe('currentInstance', () => {
    test('returns the URL at the stored index', () => {
      expect(currentInstance()).toBe('http://ha1.local');
    });

    test('returns false when currentInstance is not set', () => {
      vi.mocked(config.has).mockReturnValue(false);
      expect(currentInstance()).toBe(false);
    });

    test('returns false when index is undefined', () => {
      vi.mocked(config.has).mockReturnValue(true);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'currentInstance') return undefined;
        if (key === 'allInstances') return ['http://ha1.local'];
        return undefined;
      });
      expect(currentInstance()).toBe(false);
    });

    test('returns false when index is out of bounds', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'currentInstance') return 99;
        if (key === 'allInstances') return ['http://ha1.local'];
        return undefined;
      });
      expect(currentInstance()).toBe(false);
    });

    test('sets currentInstance when url is provided', () => {
      const urls = ['http://ha1.local', 'http://ha2.local'];
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return urls;
        return undefined;
      });
      currentInstance('http://ha2.local');
      expect(config.set).toHaveBeenCalledWith('currentInstance', 1);
    });
  });

  describe('addInstance', () => {
    test('adds a new instance and sets it as current', () => {
      const urls: string[] = [];
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return urls;
        return undefined;
      });
      vi.mocked(config.has).mockImplementation((key: string) => key === 'allInstances');
      vi.mocked(config.set).mockImplementation(((key: string, val?: unknown) => {
        if (key === 'allInstances') {
          urls.push(val as string);
        }
      }) as typeof config.set);

      addInstance('http://newha.local');
      expect(config.set).toHaveBeenCalledWith('allInstances', expect.arrayContaining(['http://newha.local']));
      expect(config.set).toHaveBeenCalledWith('currentInstance', expect.any(Number));
    });

    test('does not add duplicate instance but sets it as current', () => {
      const urls = ['http://ha1.local', 'http://ha2.local'];
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return urls;
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);

      addInstance('http://ha2.local');
      expect(config.set).not.toHaveBeenCalledWith('allInstances', expect.anything());
      expect(config.set).toHaveBeenCalledWith('currentInstance', 1);
    });

    test('sets disableHover to false when first instance is added', () => {
      const urls: string[] = [];
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return urls;
        return undefined;
      });
      vi.mocked(config.has).mockImplementation((key: string) => key === 'allInstances');
      vi.mocked(config.set).mockImplementation(((key: string, val?: unknown) => {
        if (key === 'allInstances') urls.push(val as string);
      }) as typeof config.set);

      addInstance('http://first.local');
      expect(config.set).toHaveBeenCalledWith('disableHover', false);
    });
  });
});
