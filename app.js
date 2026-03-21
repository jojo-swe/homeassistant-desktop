/**
 * app.js — Main process entry point (orchestrator)
 *
 * This file wires together the modular src/ components.
 * Business logic lives in the individual modules:
 *   src/window.js    — BrowserWindow lifecycle
 *   src/tray.js      — System Tray & context menu
 *   src/updater.js   — Auto-updater
 *   src/ipc.js       — All ipcMain handlers
 *   src/haClient.js  — HA REST API
 *   src/systemMonitor.js — System telemetry
 *   src/activeWindow.js  — Active window tracking
 *   src/notifications.js — Native OS notifications
 */

const { app, BrowserWindow, globalShortcut, net } = require('electron');
const Bonjour = require('bonjour-service');
const logger = require('electron-log');
const config = require('./config');

// ── src modules ──────────────────────────────────────────────────────────────
const windowManager = require('./src/window');
const { createTray, getTray, getMenu } = require('./src/tray');
const { useAutoUpdater, clearUpdateInterval, getUpdateCheckerInterval } = require('./src/updater');
const { registerAll } = require('./src/ipc');
const haClient = require('./src/haClient');
const sensorPusher = require('./src/sensorPusher');
const shortcutManager = require('./src/shortcutManager');

logger.catchErrors();
logger.info(`${app.getName()} started`);
logger.info(`Platform: ${process.platform} ${process.arch}`);

// ── Globals ──────────────────────────────────────────────────────────────────
const bonjour = new Bonjour.Bonjour();

let forceQuit = false;
let autostartEnabled = false;
let cachedEntities = [];
let availabilityCheckerInterval;
let settingsWindow = null;

const SETTINGS_FILE = `file://${__dirname}/web/settings.html`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function currentInstance(url = null) {
  if (url) config.set('currentInstance', config.get('allInstances').indexOf(url));
  if (config.has('currentInstance')) return config.get('allInstances')[config.get('currentInstance')];
  return false;
}

function addInstance(url) {
  if (!config.has('allInstances')) config.set('allInstances', []);
  let instances = config.get('allInstances');
  if (instances.find(e => e === url)) { currentInstance(url); return; }
  if (!instances.length) config.set('disableHover', false);
  instances.push(url);
  config.set('allInstances', instances);
  currentInstance(url);
}

function checkAutoStart() {
  autostartEnabled = app.getLoginItemSettings().openAtLogin;
}

async function refreshEntityCache() {
  if (!haClient.isConfigured()) return;
  try {
    cachedEntities = await haClient.getToggleableEntities();
    logger.info(`Entity cache refreshed: ${cachedEntities.length} entities.`);
  } catch (err) {
    logger.error('Failed to refresh entity cache:', err);
  }
}

function openSettingsWindow() {
  if (settingsWindow) { settingsWindow.focus(); return; }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 600,
    minWidth: 420,
    minHeight: 500,
    title: 'Home Assistant Desktop — Settings',
    autoHideMenuBar: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: `${__dirname}/preload.js`,
    },
  });

  settingsWindow.loadURL(SETTINGS_FILE);
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function availabilityCheck() {
  const instance = currentInstance();
  if (!instance) return;

  const url = new URL(instance);
  const request = net.request(`${url.origin}/auth/providers`);

  request.on('response', async (response) => {
    if (response.statusCode !== 200) {
      logger.error('Response error: ' + response);
      await windowManager.showError(true);
    }
  });

  request.on('error', async (error) => {
    logger.error(error);
    clearInterval(availabilityCheckerInterval);
    availabilityCheckerInterval = null;
    await windowManager.showError(true);

    if (config.get('automaticSwitching')) checkForAvailableInstance();
  });

  request.end();
}

function checkForAvailableInstance() {
  const instances = config.get('allInstances');
  if (!instances?.length > 1) return;

  bonjour.find({ type: 'home-assistant' }, (instance) => {
    if (instance.txt.internal_url && instances.indexOf(instance.txt.internal_url) !== -1) return currentInstance(instance.txt.internal_url);
    if (instance.txt.external_url && instances.indexOf(instance.txt.external_url) !== -1) return currentInstance(instance.txt.external_url);
  });

  for (let instance of instances.filter(e => e !== currentInstance())) {
    const url = new URL(instance);
    const request = net.request(`${url.origin}/auth/providers`);
    let found;
    request.on('response', (response) => { if (response.statusCode === 200) found = instance; });
    request.on('error', () => {});
    request.end();
    if (found) { currentInstance(found); break; }
  }
}

// ── Wire modules together ────────────────────────────────────────────────────

// Window module needs runtime callbacks to avoid circular dependency
windowManager.init({
  showWindow:      () => windowManager.showWindow(),
  changePosition:  () => trayModule.changePosition(),
  toggleFullScreen: (mode) => windowManager.toggleFullScreen(mode),
  forceQuit:       () => forceQuit,
});

// Lazy ref so trayModule is defined after createTray is called
const trayModule = require('./src/tray');

// ── macOS dock ───────────────────────────────────────────────────────────────
if (process.platform === 'darwin') app.dock.hide();

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await useAutoUpdater(() => { forceQuit = true; });
  checkAutoStart();

  await windowManager.createMainWindow(!config.has('currentInstance'));

  // Hand dependencies to tray module
  createTray({
    getMainWindow:        () => windowManager.getMainWindow(),
    showWindow:           () => windowManager.showWindow(),
    toggleFullScreen:     () => windowManager.toggleFullScreen(),
    openSettingsWindow,
    getCachedEntities:    () => cachedEntities,
    refreshEntityCache,
    getAutostartEnabled:  () => autostartEnabled,
    getUpdateCheckerInterval,
    clearUpdateInterval,
    useAutoUpdater:       () => useAutoUpdater(() => { forceQuit = true; }),
    forceQuit:            () => { forceQuit = true; },
  });

  if (process.platform === 'linux') {
    getTray().setContextMenu(getMenu());
  }

  // Register all IPC handlers
  registerAll({
    getMainWindow:    () => windowManager.getMainWindow(),
    showWindow:       () => windowManager.showWindow(),
    openSettingsWindow,
    getCachedEntities: () => cachedEntities,
    setCachedEntities: (entities) => { cachedEntities = entities; },
    reinitMainWindow: async () => {
      await windowManager.reinitMainWindow();
      if (!availabilityCheckerInterval) {
        availabilityCheckerInterval = setInterval(availabilityCheck, 3000);
      }
    },
    addInstance,
    currentInstance,
    bonjour,
    forceQuit: () => { forceQuit = true; },
  });

  if (!availabilityCheckerInterval) {
    logger.info('Initialized availability check');
    availabilityCheckerInterval = setInterval(availabilityCheck, 3000);
  }

  // Keyboard shortcuts
  if (config.get('shortcutEnabled')) windowManager.registerKeyboardShortcut();
  globalShortcut.register('CommandOrControl+Alt+Return', () => windowManager.toggleFullScreen());
  shortcutManager.registerAll();

  if (!config.has('currentInstance')) config.set('disableHover', true);
  if (!config.has('autoUpdate')) config.set('autoUpdate', true);

  // Active window tracker + full sensor push platform
  sensorPusher.init(30_000);

  // Initial entity cache + 60s refresh
  await refreshEntityCache();
  setInterval(refreshEntityCache, 60 * 1000);
});

app.on('will-quit', () => {
  windowManager.unregisterKeyboardShortcut();
  shortcutManager.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
