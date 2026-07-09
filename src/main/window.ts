import { BrowserWindow, shell, screen, globalShortcut } from 'electron';
import Positioner from 'electron-traywindow-positioner';
import logger from 'electron-log';
import fs from 'fs';
import path from 'path';
import config from './config';
import { currentInstance } from './instances';
import haNotificationBridge from './haNotificationBridge';
import type { WindowInitDeps } from './types';

const ACCENT_EXTRACT_JS = `
new Promise(resolve => {
  const timeout = setTimeout(() => resolve(null), 10000);
  const check = () => {
    const el = document.querySelector('home-assistant') || document.documentElement;
    const c = getComputedStyle(el).getPropertyValue('--primary-color').trim();
    if (c) { clearTimeout(timeout); resolve(c); return; }
    setTimeout(check, 500);
  };
  check();
})`;

const INDEX_FILE = `file://${path.join(__dirname, '..', 'renderer', 'index.html')}`;
const ERROR_FILE = `file://${path.join(__dirname, '..', 'renderer', 'error', 'index.html')}`;
const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'index.js');

let mainWindow: BrowserWindow | null = null;
let initialized = false;
let resizeEvent: boolean = false;
let isNavigating = false;

let _showWindow: () => void;
let _changePosition: () => void;
let _toggleFullScreen: (mode?: boolean) => void;
let _forceQuitFn: () => boolean;

function init({ showWindow, changePosition, toggleFullScreen, forceQuit }: WindowInitDeps): void {
  _showWindow = showWindow;
  _changePosition = changePosition;
  _toggleFullScreen = toggleFullScreen;
  _forceQuitFn = forceQuit;
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function isInitialized(): boolean {
  return initialized;
}

async function createMainWindow(show = false): Promise<void> {
  logger.info('Initialized main window');
  mainWindow = new BrowserWindow({
    width: 420,
    height: 460,
    minWidth: 420,
    minHeight: 460,
    show: false,
    skipTaskbar: !show,
    autoHideMenuBar: true,
    frame: config.get('detachedMode') && process.platform !== 'darwin',
    transparent: process.platform === 'darwin',
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH,
    },
  });

  await mainWindow.loadURL(INDEX_FILE).catch(async (err: Error) => {
    logger.error('Failed to load index page:', err.message);
    await mainWindow!.loadURL(ERROR_FILE).catch(() => {});
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    if (!mainWindow) return;
    await mainWindow.webContents.insertCSS(
      '::-webkit-scrollbar { display: none; } body { -webkit-user-select: none; }'
    );

    if (config.get('detachedMode') && process.platform === 'darwin') {
      await mainWindow.webContents.insertCSS('body { -webkit-app-region: drag; }');
    }

    const url = mainWindow.webContents.getURL();
    if (!url.includes('renderer/index') && !url.includes('renderer/error') && url.startsWith('http')) {
      try {
        await mainWindow.webContents.executeJavaScript(haNotificationBridge);
        logger.info('HA notification bridge injected.');
      } catch (err) {
        logger.error('Failed to inject HA notification bridge:', err);
      }

      try {
        const color = await mainWindow.webContents.executeJavaScript(ACCENT_EXTRACT_JS);
        if (color && typeof color === 'string' && color !== config.get('accentColor')) {
          config.set('accentColor', color);
          applyAccentColor(color);
          logger.info(`Accent color detected: ${color}`);
        }
      } catch (err) {
        logger.error('Failed to extract accent color:', err);
      }
    }
  });

  if (config.get('detachedMode')) {
    if (config.has('windowSizeDetached')) {
      const size = config.get('windowSizeDetached');
      if (size) mainWindow.setSize(size[0], size[1]);
    } else {
      config.set('windowSizeDetached', mainWindow.getSize() as [number, number]);
    }

    if (config.has('windowPosition')) {
      const pos = config.get('windowPosition');
      if (pos) mainWindow.setPosition(pos[0], pos[1]);
    } else {
      config.set('windowPosition', mainWindow.getPosition() as [number, number]);
    }
  } else if (config.has('windowSize')) {
    const size = config.get('windowSize');
    if (size) mainWindow.setSize(size[0], size[1]);
  } else {
    config.set('windowSize', mainWindow.getSize() as [number, number]);
  }

  mainWindow.on('resize', () => {
    if (mainWindow?.isFullScreen()) return;

    if (!config.get('disableHover') || resizeEvent) {
      config.set('disableHover', true);
      resizeEvent = true;
      setTimeout(() => {
        if (resizeEvent) {
          config.set('disableHover', false);
          resizeEvent = false;
        }
      }, 600);
    }

    if (config.get('detachedMode')) {
      if (mainWindow) config.set('windowSizeDetached', mainWindow.getSize() as [number, number]);
    } else {
      if (process.platform !== 'linux') _changePosition();
      if (mainWindow) config.set('windowSize', mainWindow.getSize() as [number, number]);
    }
  });

  mainWindow.on('move', () => {
    if (config.get('detachedMode') && mainWindow) {
      config.set('windowPosition', mainWindow.getPosition() as [number, number]);
    }
  });

  mainWindow.on('close', (e) => {
    if (!_forceQuitFn()) {
      mainWindow?.hide();
      e.preventDefault();
    }
  });

  mainWindow.on('blur', () => {
    if (!config.get('detachedMode') && mainWindow && !mainWindow.isAlwaysOnTop()) {
      mainWindow.hide();
    }
  });

  mainWindow.setAlwaysOnTop(!!config.get('stayOnTop'));

  if (initialized && (mainWindow.isAlwaysOnTop() || show)) {
    _showWindow();
  }

  _toggleFullScreen(!!config.get('fullScreen'));
  initialized = true;
}

async function reinitMainWindow(availabilityCheck?: () => void): Promise<void> {
  logger.info('Re-initialized main window');
  mainWindow?.destroy();
  mainWindow = null;
  await createMainWindow(!config.has('currentInstance'));

  if (availabilityCheck) availabilityCheck();
}

function showWindow(): void {
  if (!mainWindow) return;
  if (!config.get('detachedMode')) {
    _changePosition();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.setVisibleOnAllWorkspaces(true);
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setSkipTaskbar(!config.get('detachedMode'));
  }
}

function toggleFullScreen(mode?: boolean): void {
  if (!mainWindow) return;
  if (mode === undefined) mode = !mainWindow.isFullScreen();
  config.set('fullScreen', mode);
  mainWindow.setFullScreen(mode);
  mainWindow.setAlwaysOnTop(mode ? true : config.get('stayOnTop'));
}

function registerKeyboardShortcut(): void {
  globalShortcut.register('CommandOrControl+Alt+X', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
}

function unregisterKeyboardShortcut(): void {
  globalShortcut.unregisterAll();
}

async function showError(isError: boolean): Promise<void> {
  if (!mainWindow) return;
  if (isNavigating) return;
  if (!isError && mainWindow.webContents.getURL().includes('renderer/error')) {
    isNavigating = true;
    await mainWindow.loadURL(INDEX_FILE).finally(() => {
      isNavigating = false;
    });
  }
  if (isError && currentInstance() && !mainWindow.webContents.getURL().includes('renderer/error')) {
    isNavigating = true;
    await mainWindow.loadURL(ERROR_FILE).finally(() => {
      isNavigating = false;
    });
  }
}

function applyAccentColor(color: string): void {
  if (!color) return;
  const css = `:root { --ha-blue: ${color} !important; --ha-blue-dark: ${color} !important; }`;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.insertCSS(css).catch(() => {});
    }
  }
}

export {
  init,
  getMainWindow,
  isInitialized,
  createMainWindow,
  reinitMainWindow,
  showWindow,
  toggleFullScreen,
  registerKeyboardShortcut,
  unregisterKeyboardShortcut,
  showError,
  applyAccentColor,
};
