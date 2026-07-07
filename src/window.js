const { BrowserWindow, shell, screen, globalShortcut } = require('electron');
const Positioner = require('electron-traywindow-positioner');
const logger = require('electron-log');
const fs = require('fs');
const config = require('../config');
const { currentInstance } = require('./instances');

const INDEX_FILE = `file://${__dirname}/../web/index.html`;
const ERROR_FILE = `file://${__dirname}/../web/error.html`;
const PRELOAD_PATH = `${__dirname}/../preload.js`;
const BRIDGE_PATH = `${__dirname}/haNotificationBridge.js`;

let mainWindow;
let initialized = false;
let resizeEvent = false;

// Injected callbacks from app.js to avoid circular dependency
let _showWindow;
let _changePosition;
let _toggleFullScreen;
let _forceQuitFn;

function init({ showWindow, changePosition, toggleFullScreen, forceQuit }) {
  _showWindow = showWindow;
  _changePosition = changePosition;
  _toggleFullScreen = toggleFullScreen;
  _forceQuitFn = forceQuit;
}

function getMainWindow() {
  return mainWindow;
}

function isInitialized() {
  return initialized;
}

async function createMainWindow(show = false) {
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH,
    },
  });

  await mainWindow.loadURL(INDEX_FILE).catch(async (err) => {
    logger.error('Failed to load index page:', err.message);
    await mainWindow.loadURL(ERROR_FILE).catch(() => {});
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Hide scrollbar and inject HA notification bridge for HA pages
  mainWindow.webContents.on('did-finish-load', async () => {
    await mainWindow.webContents.insertCSS(
      '::-webkit-scrollbar { display: none; } body { -webkit-user-select: none; }'
    );

    if (config.get('detachedMode') && process.platform === 'darwin') {
      await mainWindow.webContents.insertCSS('body { -webkit-app-region: drag; }');
    }

    const url = mainWindow.webContents.getURL();
    if (!url.includes('web/index.html') && !url.includes('web/error.html') && url.startsWith('http')) {
      try {
        const bridgeScript = fs.readFileSync(BRIDGE_PATH, 'utf8');
        await mainWindow.webContents.executeJavaScript(bridgeScript);
        logger.info('HA notification bridge injected.');
      } catch (err) {
        logger.error('Failed to inject HA notification bridge:', err);
      }
    }
  });

  // Window size / position persistence
  if (config.get('detachedMode')) {
    if (config.has('windowSizeDetached')) {
      mainWindow.setSize(...config.get('windowSizeDetached'));
    } else {
      config.set('windowSizeDetached', mainWindow.getSize());
    }

    if (config.has('windowPosition')) {
      mainWindow.setPosition(...config.get('windowPosition'));
    } else {
      config.set('windowPosition', mainWindow.getPosition());
    }
  } else if (config.has('windowSize')) {
    mainWindow.setSize(...config.get('windowSize'));
  } else {
    config.set('windowSize', mainWindow.getSize());
  }

  mainWindow.on('resize', (e) => {
    if (mainWindow.isFullScreen()) return e;

    if (!config.get('disableHover') || resizeEvent) {
      config.set('disableHover', true);
      resizeEvent = e;
      setTimeout(() => {
        if (resizeEvent === e) {
          config.set('disableHover', false);
          resizeEvent = false;
        }
      }, 600);
    }

    if (config.get('detachedMode')) {
      config.set('windowSizeDetached', mainWindow.getSize());
    } else {
      if (process.platform !== 'linux') _changePosition();
      config.set('windowSize', mainWindow.getSize());
    }
  });

  mainWindow.on('move', () => {
    if (config.get('detachedMode')) {
      config.set('windowPosition', mainWindow.getPosition());
    }
  });

  mainWindow.on('close', (e) => {
    if (!_forceQuitFn()) {
      mainWindow.hide();
      e.preventDefault();
    }
  });

  mainWindow.on('blur', () => {
    if (!config.get('detachedMode') && !mainWindow.isAlwaysOnTop()) {
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

async function reinitMainWindow(availabilityCheck) {
  logger.info('Re-initialized main window');
  mainWindow.destroy();
  mainWindow = null;
  await createMainWindow(!config.has('currentInstance'));

  if (availabilityCheck) availabilityCheck();
}

function showWindow() {
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

function toggleFullScreen(mode) {
  if (mode === undefined) mode = !mainWindow.isFullScreen();
  config.set('fullScreen', mode);
  mainWindow.setFullScreen(mode);
  mainWindow.setAlwaysOnTop(mode ? true : config.get('stayOnTop'));
}

function registerKeyboardShortcut() {
  globalShortcut.register('CommandOrControl+Alt+X', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
}

function unregisterKeyboardShortcut() {
  globalShortcut.unregisterAll();
}

async function showError(isError) {
  if (!isError && mainWindow.webContents.getURL().includes('error.html')) {
    await mainWindow.loadURL(INDEX_FILE);
  }
  if (isError && currentInstance() && !mainWindow.webContents.getURL().includes('error.html')) {
    await mainWindow.loadURL(ERROR_FILE);
  }
}

module.exports = {
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
  currentInstance,
  INDEX_FILE,
  ERROR_FILE,
};
