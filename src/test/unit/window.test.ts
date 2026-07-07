import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockBrowserWindow = {
  loadURL: vi.fn().mockResolvedValue(undefined),
  webContents: {
    setWindowOpenHandler: vi.fn(),
    on: vi.fn(),
    insertCSS: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn(() => 'file:///renderer/index.html'),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    session: {
      clearCache: vi.fn().mockResolvedValue(undefined),
      clearStorageData: vi.fn().mockResolvedValue(undefined),
    },
  },
  setSize: vi.fn(),
  getSize: vi.fn(() => [420, 460]),
  getPosition: vi.fn(() => [0, 0]),
  setPosition: vi.fn(),
  on: vi.fn(),
  isFullScreen: vi.fn(() => false),
  isAlwaysOnTop: vi.fn(() => false),
  setAlwaysOnTop: vi.fn(),
  setFullScreen: vi.fn(),
  isVisible: vi.fn(() => false),
  setVisibleOnAllWorkspaces: vi.fn(),
  show: vi.fn(),
  focus: vi.fn(),
  setSkipTaskbar: vi.fn(),
  hide: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindow),
  shell: { openExternal: vi.fn() },
  screen: { getDisplayNearestPoint: vi.fn() },
  globalShortcut: {
    register: vi.fn(),
    unregisterAll: vi.fn(),
  },
}));

vi.mock('electron-traywindow-positioner', () => ({
  default: {
    getTaskbarPosition: vi.fn(),
    position: vi.fn(),
    calculate: vi.fn(() => ({ x: 0, y: 0 })),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
  },
}));

vi.mock('../../main/config', () => {
  const store: Record<string, unknown> = {};
  return {
    default: {
      get: vi.fn((key: string) => store[key]),
      set: vi.fn((key: string, val: unknown) => {
        store[key] = val;
      }),
      has: vi.fn((key: string) => key in store),
      delete: vi.fn((key: string) => {
        delete store[key];
      }),
    },
  };
});

vi.mock('../../main/instances', () => ({
  currentInstance: vi.fn(() => false),
}));

vi.mock('../../main/haNotificationBridge', () => ({
  default: 'console.log("test");',
}));

import { BrowserWindow, globalShortcut } from 'electron';
import config from '../../main/config';
import * as windowManager from '../../main/window';

describe('window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(config.get).mockReturnValue(undefined);
    vi.mocked(config.has).mockReturnValue(false);
  });

  describe('init', () => {
    test('stores dependencies without error', () => {
      expect(() =>
        windowManager.init({
          showWindow: vi.fn(),
          changePosition: vi.fn(),
          toggleFullScreen: vi.fn(),
          forceQuit: vi.fn(() => false),
        }),
      ).not.toThrow();
    });
  });

  describe('getMainWindow', () => {
    test('returns null before createMainWindow', () => {
      expect(windowManager.getMainWindow()).toBeNull();
    });
  });

  describe('isInitialized', () => {
    test('returns false before createMainWindow', () => {
      expect(windowManager.isInitialized()).toBe(false);
    });
  });

  describe('createMainWindow', () => {
    test('creates a BrowserWindow and loads index file', async () => {
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      expect(BrowserWindow).toHaveBeenCalled();
      expect(mockBrowserWindow.loadURL).toHaveBeenCalled();
    });

    test('loads error page when index fails to load', async () => {
      mockBrowserWindow.loadURL
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce(undefined);
      await windowManager.createMainWindow(false);
      expect(mockBrowserWindow.loadURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('showWindow', () => {
    test('does nothing when no main window', () => {
      expect(() => windowManager.showWindow()).not.toThrow();
    });
  });

  describe('toggleFullScreen', () => {
    test('does nothing when no main window', () => {
      expect(() => windowManager.toggleFullScreen()).not.toThrow();
    });
  });

  describe('registerKeyboardShortcut', () => {
    test('registers CommandOrControl+Alt+X', () => {
      windowManager.registerKeyboardShortcut();
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Alt+X', expect.any(Function));
    });
  });

  describe('unregisterKeyboardShortcut', () => {
    test('unregisters all shortcuts', () => {
      windowManager.unregisterKeyboardShortcut();
      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    });
  });

  describe('showError', () => {
    test('does nothing when no main window', async () => {
      await expect(windowManager.showError(true)).resolves.not.toThrow();
    });
  });

  describe('reinitMainWindow', () => {
    test('destroys and recreates the window', async () => {
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      await windowManager.reinitMainWindow();
      expect(mockBrowserWindow.destroy).toHaveBeenCalled();
    });
  });
});
