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
  isDestroyed: vi.fn(() => false),
};

vi.mock('electron', () => ({
  BrowserWindow: Object.assign(
    vi.fn(() => mockBrowserWindow),
    {
      getAllWindows: vi.fn(() => [mockBrowserWindow]),
    }
  ),
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

import { BrowserWindow, globalShortcut, shell } from 'electron';
import logger from 'electron-log';
import config from '../../main/config';
import * as windowManager from '../../main/window';
import { currentInstance } from '../../main/instances';

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
        })
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
      mockBrowserWindow.loadURL.mockRejectedValueOnce(new Error('not found')).mockResolvedValueOnce(undefined);
      await windowManager.createMainWindow(false);
      expect(mockBrowserWindow.loadURL).toHaveBeenCalledTimes(2);
    });

    test('sets window open handler to open external URLs', async () => {
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      expect(mockBrowserWindow.webContents.setWindowOpenHandler).toHaveBeenCalled();
      const handler = mockBrowserWindow.webContents.setWindowOpenHandler.mock.calls[0][0];
      const result = handler({ url: 'https://example.com' } as any);
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
      expect(result.action).toBe('deny');
    });

    test('did-finish-load injects CSS and notification bridge for HA URLs', async () => {
      mockBrowserWindow.webContents.getURL.mockReturnValue('http://ha.local:8123');
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const cb = mockBrowserWindow.webContents.on.mock.calls.find((c: any[]) => c[0] === 'did-finish-load')![1];
      await cb();
      expect(mockBrowserWindow.webContents.insertCSS).toHaveBeenCalled();
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('HA notification bridge injected.');
    });

    test('did-finish-load does not inject bridge for renderer URLs', async () => {
      mockBrowserWindow.webContents.getURL.mockReturnValue('file:///renderer/index.html');
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const cb = mockBrowserWindow.webContents.on.mock.calls.find((c: any[]) => c[0] === 'did-finish-load')![1];
      await cb();
      expect(mockBrowserWindow.webContents.executeJavaScript).not.toHaveBeenCalled();
    });

    test('did-finish-load catches injection errors', async () => {
      mockBrowserWindow.webContents.getURL.mockReturnValue('http://ha.local:8123');
      mockBrowserWindow.webContents.executeJavaScript.mockRejectedValueOnce(new Error('inject failed'));
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const cb = mockBrowserWindow.webContents.on.mock.calls.find((c: any[]) => c[0] === 'did-finish-load')![1];
      await cb();
      expect(logger.error).toHaveBeenCalled();
    });

    test('did-finish-load injects drag CSS on macOS detached mode', async () => {
      mockBrowserWindow.webContents.getURL.mockReturnValue('file:///renderer/index.html');
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'detachedMode') return true;
        return undefined;
      });
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const cb = mockBrowserWindow.webContents.on.mock.calls.find((c: any[]) => c[0] === 'did-finish-load')![1];
      await cb();
      expect(mockBrowserWindow.webContents.insertCSS).toHaveBeenCalledTimes(2);
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    test('applies saved detachedMode window size', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'detachedMode') return true;
        if (key === 'windowSizeDetached') return [800, 600];
        if (key === 'windowPosition') return [100, 200];
        return undefined;
      });
      vi.mocked(config.has).mockImplementation((key: string) => {
        if (key === 'windowSizeDetached') return true;
        if (key === 'windowPosition') return true;
        return false;
      });
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      expect(mockBrowserWindow.setSize).toHaveBeenCalledWith(800, 600);
      expect(mockBrowserWindow.setPosition).toHaveBeenCalledWith(100, 200);
    });

    test('saves detachedMode window size when not set', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'detachedMode') return true;
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(false);
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      expect(config.set).toHaveBeenCalledWith('windowSizeDetached', [420, 460]);
      expect(config.set).toHaveBeenCalledWith('windowPosition', [0, 0]);
    });

    test('applies saved windowSize in non-detached mode', async () => {
      vi.mocked(config.get).mockReturnValue(undefined);
      vi.mocked(config.has).mockImplementation((key: string) => {
        if (key === 'windowSize') return true;
        return false;
      });
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'windowSize') return [500, 500];
        return undefined;
      });
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      expect(mockBrowserWindow.setSize).toHaveBeenCalledWith(500, 500);
    });

    test('saves windowSize when not set in non-detached mode', async () => {
      vi.mocked(config.get).mockReturnValue(undefined);
      vi.mocked(config.has).mockReturnValue(false);
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      expect(config.set).toHaveBeenCalledWith('windowSize', [420, 460]);
    });

    test('resize handler saves size and toggles disableHover', async () => {
      vi.useFakeTimers();
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const resizeCb = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'resize')![1];
      resizeCb();
      expect(config.set).toHaveBeenCalledWith('disableHover', true);
      vi.advanceTimersByTime(600);
      expect(config.set).toHaveBeenCalledWith('disableHover', false);
      vi.useRealTimers();
    });

    test('resize handler skips when fullscreen', async () => {
      mockBrowserWindow.isFullScreen.mockReturnValue(true);
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const resizeCb = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'resize')![1];
      resizeCb();
      expect(config.set).not.toHaveBeenCalledWith('disableHover', expect.anything());
      mockBrowserWindow.isFullScreen.mockReturnValue(false);
    });

    test('resize handler saves detachedMode size', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'detachedMode') return true;
        return undefined;
      });
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const resizeCb = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'resize')![1];
      resizeCb();
      expect(config.set).toHaveBeenCalledWith('windowSizeDetached', [420, 460]);
    });

    test('move handler saves position in detachedMode', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'detachedMode') return true;
        return undefined;
      });
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const moveCb = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'move')![1];
      moveCb();
      expect(config.set).toHaveBeenCalledWith('windowPosition', [0, 0]);
    });

    test('close handler hides window when not forceQuit', async () => {
      const forceQuit = vi.fn(() => false);
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit,
      });
      await windowManager.createMainWindow(false);
      const closeCb = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'close')![1];
      const preventDefault = vi.fn();
      closeCb({ preventDefault });
      expect(mockBrowserWindow.hide).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
    });

    test('close handler does not hide when forceQuit is true', async () => {
      const forceQuit = vi.fn(() => true);
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit,
      });
      await windowManager.createMainWindow(false);
      const closeCb = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'close')![1];
      const preventDefault = vi.fn();
      closeCb({ preventDefault });
      expect(mockBrowserWindow.hide).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    });

    test('blur handler hides window in non-detached mode', async () => {
      vi.mocked(config.get).mockReturnValue(undefined);
      mockBrowserWindow.isAlwaysOnTop.mockReturnValue(false);
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const blurCb = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'blur')![1];
      blurCb();
      expect(mockBrowserWindow.hide).toHaveBeenCalled();
    });

    test('blur handler does not hide in detachedMode', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'detachedMode') return true;
        return undefined;
      });
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const blurCb = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'blur')![1];
      blurCb();
      expect(mockBrowserWindow.hide).not.toHaveBeenCalled();
    });

    test('calls showWindow when initialized and alwaysOnTop or show=true', async () => {
      const showWindow = vi.fn();
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'stayOnTop') return true;
        return undefined;
      });
      mockBrowserWindow.isAlwaysOnTop.mockReturnValue(true);
      windowManager.init({
        showWindow,
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      expect(showWindow).toHaveBeenCalled();
    });
  });

  describe('showWindow', () => {
    test('does nothing when no main window', () => {
      expect(() => windowManager.showWindow()).not.toThrow();
    });

    test('shows, focuses, and sets visible on all workspaces when window exists', async () => {
      const changePosition = vi.fn();
      windowManager.init({
        showWindow: vi.fn(),
        changePosition,
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      mockBrowserWindow.isVisible.mockReturnValue(false);
      windowManager.showWindow();
      expect(changePosition).toHaveBeenCalled();
      expect(mockBrowserWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true);
      expect(mockBrowserWindow.show).toHaveBeenCalled();
      expect(mockBrowserWindow.focus).toHaveBeenCalled();
      expect(mockBrowserWindow.setSkipTaskbar).toHaveBeenCalled();
    });

    test('does not show if already visible', async () => {
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      mockBrowserWindow.isVisible.mockReturnValue(true);
      windowManager.showWindow();
      expect(mockBrowserWindow.show).not.toHaveBeenCalled();
    });
  });

  describe('toggleFullScreen', () => {
    test('does nothing when no main window', () => {
      expect(() => windowManager.toggleFullScreen()).not.toThrow();
    });

    test('toggles fullscreen on when called with true', async () => {
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      windowManager.toggleFullScreen(true);
      expect(mockBrowserWindow.setFullScreen).toHaveBeenCalledWith(true);
      expect(mockBrowserWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
    });

    test('toggles fullscreen off and restores stayOnTop', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'stayOnTop') return true;
        return undefined;
      });
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      windowManager.toggleFullScreen(false);
      expect(mockBrowserWindow.setFullScreen).toHaveBeenCalledWith(false);
      expect(mockBrowserWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
    });

    test('toggles fullscreen to inverse when mode is undefined', async () => {
      mockBrowserWindow.isFullScreen.mockReturnValue(false);
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      windowManager.toggleFullScreen();
      expect(mockBrowserWindow.setFullScreen).toHaveBeenCalledWith(true);
    });
  });

  describe('registerKeyboardShortcut', () => {
    test('registers CommandOrControl+Alt+X', () => {
      windowManager.registerKeyboardShortcut();
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Alt+X', expect.any(Function));
    });

    test('shortcut callback hides visible window', async () => {
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      mockBrowserWindow.isVisible.mockReturnValue(true);
      windowManager.registerKeyboardShortcut();
      const cb = vi.mocked(globalShortcut.register).mock.calls[0][1];
      cb();
      expect(mockBrowserWindow.hide).toHaveBeenCalled();
    });

    test('shortcut callback shows hidden window', async () => {
      const showWindow = vi.fn();
      windowManager.init({
        showWindow,
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      mockBrowserWindow.isVisible.mockReturnValue(false);
      windowManager.registerKeyboardShortcut();
      const cb = vi.mocked(globalShortcut.register).mock.calls[0][1];
      cb();
      expect(mockBrowserWindow.show).toHaveBeenCalled();
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

    test('loads index file when error is cleared and current URL is error page', async () => {
      mockBrowserWindow.webContents.getURL.mockReturnValue('file:///renderer/error/index.html');
      vi.mocked(currentInstance).mockReturnValue('http://ha.local');
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      await windowManager.showError(false);
      expect(mockBrowserWindow.loadURL).toHaveBeenLastCalledWith(expect.stringMatching(/renderer[\\/]index/));
    });

    test('loads error file when isError and currentInstance exists', async () => {
      mockBrowserWindow.webContents.getURL.mockReturnValue('http://ha.local:8123');
      vi.mocked(currentInstance).mockReturnValue('http://ha.local');
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      await windowManager.showError(true);
      expect(mockBrowserWindow.loadURL).toHaveBeenLastCalledWith(expect.stringMatching(/renderer[\\/]error/));
    });

    test('does not load error file when no currentInstance', async () => {
      mockBrowserWindow.webContents.getURL.mockReturnValue('http://ha.local:8123');
      vi.mocked(currentInstance).mockReturnValue(false);
      windowManager.init({
        showWindow: vi.fn(),
        changePosition: vi.fn(),
        toggleFullScreen: vi.fn(),
        forceQuit: vi.fn(() => false),
      });
      await windowManager.createMainWindow(false);
      const callCount = mockBrowserWindow.loadURL.mock.calls.length;
      await windowManager.showError(true);
      expect(mockBrowserWindow.loadURL.mock.calls.length).toBe(callCount);
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

  describe('applyAccentColor', () => {
    test('inserts CSS with accent color into all windows', () => {
      windowManager.applyAccentColor('#ff5722');
      expect(mockBrowserWindow.webContents.insertCSS).toHaveBeenCalledWith(expect.stringContaining('#ff5722'));
    });

    test('does nothing when color is empty', () => {
      const callCount = mockBrowserWindow.webContents.insertCSS.mock.calls.length;
      windowManager.applyAccentColor('');
      expect(mockBrowserWindow.webContents.insertCSS.mock.calls.length).toBe(callCount);
    });
  });
});
