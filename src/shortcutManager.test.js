jest.mock('../config', () => {
  const store = { shortcuts: [] };
  return {
    get: jest.fn((key) => store[key]),
    set: jest.fn((key, val) => {
      store[key] = val;
    }),
    has: jest.fn((key) => key in store),
  };
});

jest.mock('electron', () => ({
  globalShortcut: {
    register: jest.fn(() => true),
    unregister: jest.fn(),
    unregisterAll: jest.fn(),
  },
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('./haClient', () => ({
  toggle: jest.fn(),
}));

const config = require('../config');
const { globalShortcut } = require('electron');
const shortcutManager = require('./shortcutManager');

describe('shortcutManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key) => {
      if (key === 'shortcuts') return [];
      return undefined;
    });
  });

  describe('load', () => {
    test('returns shortcuts array from config', () => {
      config.get.mockReturnValue([{ accelerator: 'Ctrl+Shift+1', entityId: 'light.test' }]);
      expect(shortcutManager.load()).toHaveLength(1);
    });

    test('returns empty array when no shortcuts stored', () => {
      config.get.mockReturnValue(undefined);
      expect(shortcutManager.load()).toEqual([]);
    });
  });

  describe('upsert', () => {
    test('adds new shortcut to empty list', () => {
      let savedShortcuts = null;
      config.get.mockReturnValue([]);
      config.set.mockImplementation((key, val) => {
        savedShortcuts = val;
      });

      shortcutManager.upsert({ accelerator: 'Ctrl+Shift+1', entityId: 'light.test' });
      expect(savedShortcuts).toHaveLength(1);
      expect(savedShortcuts[0].accelerator).toBe('Ctrl+Shift+1');
    });

    test('updates existing shortcut with same accelerator', () => {
      const existing = [{ accelerator: 'Ctrl+Shift+1', entityId: 'light.old' }];
      let savedShortcuts = null;
      config.get.mockReturnValue(existing);
      config.set.mockImplementation((key, val) => {
        savedShortcuts = val;
      });

      shortcutManager.upsert({ accelerator: 'Ctrl+Shift+1', entityId: 'light.new' });
      expect(savedShortcuts).toHaveLength(1);
      expect(savedShortcuts[0].entityId).toBe('light.new');
    });
  });

  describe('remove', () => {
    test('removes shortcut by accelerator', () => {
      const existing = [
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a' },
        { accelerator: 'Ctrl+Shift+2', entityId: 'light.b' },
      ];
      let savedShortcuts = null;
      config.get.mockReturnValue(existing);
      config.set.mockImplementation((key, val) => {
        savedShortcuts = val;
      });

      shortcutManager.remove('Ctrl+Shift+1');
      expect(savedShortcuts).toHaveLength(1);
      expect(savedShortcuts[0].accelerator).toBe('Ctrl+Shift+2');
    });

    test('unregisters the removed shortcut', () => {
      config.get.mockReturnValue([{ accelerator: 'Ctrl+Shift+1', entityId: 'light.a' }]);
      shortcutManager.remove('Ctrl+Shift+1');
      expect(globalShortcut.unregister).toHaveBeenCalledWith('Ctrl+Shift+1');
    });

    test('re-registers remaining shortcuts after removal', () => {
      config.get.mockReturnValue([{ accelerator: 'Ctrl+Shift+1', entityId: 'light.a' }]);
      shortcutManager.remove('Ctrl+Shift+1');
      expect(globalShortcut.register).toHaveBeenCalled();
    });
  });

  describe('registerAll', () => {
    test('skips when no shortcuts', () => {
      config.get.mockReturnValue([]);
      shortcutManager.registerAll();
      expect(globalShortcut.register).not.toHaveBeenCalled();
    });

    test('registers all valid shortcuts', () => {
      config.get.mockReturnValue([
        { accelerator: 'Ctrl+Shift+1', entityId: 'light.a' },
        { accelerator: 'Ctrl+Shift+2', entityId: 'switch.b' },
      ]);
      shortcutManager.registerAll();
      expect(globalShortcut.register).toHaveBeenCalledTimes(2);
    });

    test('skips shortcuts with missing accelerator or entityId', () => {
      config.get.mockReturnValue([
        { accelerator: '', entityId: 'light.a' },
        { accelerator: 'Ctrl+Shift+2', entityId: '' },
      ]);
      shortcutManager.registerAll();
      expect(globalShortcut.register).not.toHaveBeenCalled();
    });
  });
});
