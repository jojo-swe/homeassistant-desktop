import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { Shortcut } from '../../main/types';

vi.mock('../../main/config', () => {
  const store: Record<string, unknown> = { shortcuts: [] };
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

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn(() => true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../main/haClient', () => ({
  toggle: vi.fn(),
}));

import config from '../../main/config';
import { globalShortcut } from 'electron';
import logger from 'electron-log';
import * as haClient from '../../main/haClient';
import * as shortcutManager from '../../main/shortcutManager';

describe('shortcutManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(config.get).mockImplementation((key: string) => {
      if (key === 'shortcuts') return [];
      return undefined;
    });
  });

  describe('load', () => {
    test('returns shortcuts array from config', () => {
      vi.mocked(config.get).mockReturnValue([{ accelerator: 'Ctrl+Shift+1', entityId: 'light.test' }] as Shortcut[]);
      expect(shortcutManager.load()).toHaveLength(1);
    });

    test('returns empty array when no shortcuts stored', () => {
      vi.mocked(config.get).mockReturnValue(undefined);
      expect(shortcutManager.load()).toEqual([]);
    });
  });

  describe('upsert', () => {
    test('adds new shortcut to empty list', () => {
      let savedShortcuts: Shortcut[] | null = null;
      vi.mocked(config.get).mockReturnValue([] as Shortcut[]);
      vi.mocked(config.set).mockImplementation(((key: string, val: unknown) => {
        savedShortcuts = val as Shortcut[];
      }) as typeof config.set);

      shortcutManager.upsert({ accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' });
      expect(savedShortcuts).toHaveLength(1);
      expect(savedShortcuts![0].accelerator).toBe('Ctrl+Shift+1');
    });

    test('updates existing shortcut with same accelerator', () => {
      const existing = [{ accelerator: 'Ctrl+Shift+1', entityId: 'light.old', service: 'toggle' }] as Shortcut[];
      let savedShortcuts: Shortcut[] | null = null;
      vi.mocked(config.get).mockReturnValue(existing);
      vi.mocked(config.set).mockImplementation(((key: string, val: unknown) => {
        savedShortcuts = val as Shortcut[];
      }) as typeof config.set);

      shortcutManager.upsert({ accelerator: 'Ctrl+Shift+1', entityId: 'light.new', service: 'toggle' });
      expect(savedShortcuts).toHaveLength(1);
      expect(savedShortcuts![0].entityId).toBe('light.new');
    });
  });

  describe('remove', () => {
    test('removes shortcut by accelerator', () => {
      const existing = [
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a', service: 'toggle' },
        { accelerator: 'Ctrl+Shift+2', entityId: 'light.b', service: 'toggle' },
      ] as Shortcut[];
      let savedShortcuts: Shortcut[] | null = null;
      vi.mocked(config.get).mockReturnValue(existing);
      vi.mocked(config.set).mockImplementation(((key: string, val: unknown) => {
        savedShortcuts = val as Shortcut[];
      }) as typeof config.set);

      shortcutManager.remove('Ctrl+Shift+1');
      expect(savedShortcuts).toHaveLength(1);
      expect(savedShortcuts![0].accelerator).toBe('Ctrl+Shift+2');
    });

    test('unregisters the removed shortcut', () => {
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a', service: 'toggle' },
      ] as Shortcut[]);
      shortcutManager.remove('Ctrl+Shift+1');
      expect(globalShortcut.unregister).toHaveBeenCalledWith('Ctrl+Shift+1');
    });

    test('catches errors during unregister in remove', () => {
      vi.mocked(globalShortcut.unregister).mockImplementationOnce(() => {
        throw new Error('not registered');
      });
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a', service: 'toggle' },
      ] as Shortcut[]);
      expect(() => shortcutManager.remove('Ctrl+Shift+1')).not.toThrow();
    });

    test('re-registers remaining shortcuts after removal', () => {
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a', service: 'toggle' },
      ] as Shortcut[]);
      shortcutManager.remove('Ctrl+Shift+1');
      expect(globalShortcut.register).toHaveBeenCalled();
    });
  });

  describe('registerAll', () => {
    test('skips when no shortcuts', () => {
      vi.mocked(config.get).mockReturnValue([]);
      shortcutManager.registerAll();
      expect(globalShortcut.register).not.toHaveBeenCalled();
    });

    test('registers all valid shortcuts', () => {
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a', service: 'toggle' },
        { accelerator: 'Ctrl+Shift+2', entityId: 'switch.b', service: 'toggle' },
      ] as Shortcut[]);
      shortcutManager.registerAll();
      expect(globalShortcut.register).toHaveBeenCalledTimes(2);
    });

    test('skips shortcuts with missing accelerator or entityId', () => {
      vi.mocked(config.get).mockReturnValue([
        { accelerator: '', entityId: 'light.a', service: 'toggle' },
        { accelerator: 'Ctrl+Shift+2', entityId: '', service: 'toggle' },
      ] as Shortcut[]);
      shortcutManager.registerAll();
      expect(globalShortcut.register).not.toHaveBeenCalled();
    });

    test('uses domain from entityId when domain is not specified', () => {
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' },
      ] as Shortcut[]);
      shortcutManager.registerAll();
      expect(globalShortcut.register).toHaveBeenCalledWith('Ctrl+Shift+1', expect.any(Function));
    });

    test('uses default service when service is not specified', () => {
      vi.mocked(config.get).mockReturnValue([{ accelerator: 'Ctrl+Shift+1', entityId: 'light.test' }] as Shortcut[]);
      shortcutManager.registerAll();
      expect(globalShortcut.register).toHaveBeenCalledWith('Ctrl+Shift+1', expect.any(Function));
    });

    test('warns when shortcut registration fails', () => {
      vi.mocked(globalShortcut.register).mockReturnValueOnce(false);
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' },
      ] as Shortcut[]);
      shortcutManager.registerAll();
      expect(logger.warn).toHaveBeenCalled();
    });

    test('catches errors during registration', () => {
      vi.mocked(globalShortcut.register).mockImplementationOnce(() => {
        throw new Error('registration failed');
      });
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' },
      ] as Shortcut[]);
      expect(() => shortcutManager.registerAll()).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    test('catches errors during unregister in registerAll', () => {
      vi.mocked(globalShortcut.unregister).mockImplementationOnce(() => {
        throw new Error('not registered');
      });
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' },
      ] as Shortcut[]);
      expect(() => shortcutManager.registerAll()).not.toThrow();
    });

    test('shortcut trigger callback calls haClient.toggle', async () => {
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' },
      ] as Shortcut[]);
      vi.mocked(haClient.toggle).mockResolvedValue(undefined);
      shortcutManager.registerAll();
      const cb = vi.mocked(globalShortcut.register).mock.calls[0][1];
      await cb();
      expect(haClient.toggle).toHaveBeenCalledWith('light.test');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Shortcut triggered'));
    });

    test('shortcut trigger callback catches haClient errors', async () => {
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' },
      ] as Shortcut[]);
      vi.mocked(haClient.toggle).mockRejectedValue(new Error('HA failed'));
      shortcutManager.registerAll();
      const cb = vi.mocked(globalShortcut.register).mock.calls[0][1];
      await cb();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Shortcut action failed'));
    });
  });

  describe('unregisterAll', () => {
    test('unregisters all shortcuts', () => {
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a', service: 'toggle' },
        { accelerator: 'Ctrl+Shift+2', entityId: 'switch.b', service: 'toggle' },
      ] as Shortcut[]);
      shortcutManager.unregisterAll();
      expect(globalShortcut.unregister).toHaveBeenCalledTimes(2);
    });

    test('does nothing when no shortcuts', () => {
      vi.mocked(config.get).mockReturnValue([]);
      shortcutManager.unregisterAll();
      expect(globalShortcut.unregister).not.toHaveBeenCalled();
    });

    test('catches errors during unregister', () => {
      vi.mocked(globalShortcut.unregister).mockImplementationOnce(() => {
        throw new Error('not registered');
      });
      vi.mocked(config.get).mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a', service: 'toggle' },
      ] as Shortcut[]);
      expect(() => shortcutManager.unregisterAll()).not.toThrow();
    });
  });

  describe('save', () => {
    test('saves shortcuts to config', () => {
      let saved: Shortcut[] | null = null;
      vi.mocked(config.set).mockImplementation(((key: string, val: unknown) => {
        if (key === 'shortcuts') saved = val as Shortcut[];
      }) as typeof config.set);
      shortcutManager.save([{ accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' }]);
      expect(saved).toHaveLength(1);
    });
  });
});
