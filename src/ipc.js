/**
 * src/ipc.js
 * Registers all ipcMain event/handle listeners in one place.
 * Called once from app.js after app.whenReady().
 */
const { ipcMain, app } = require('electron');
const logger = require('electron-log');
const config = require('../config');
const SystemMonitor = require('./systemMonitor');
const { showNotification } = require('./notifications');
const { getActiveWindow } = require('./activeWindow');
const haClient = require('./haClient');
const commandReceiver = require('./commandReceiver');
const shortcutManager = require('./shortcutManager');

function registerAll({ getMainWindow, showWindow, openSettingsWindow, getCachedEntities, setCachedEntities, reinitMainWindow, addInstance, currentInstance, bonjour, forceQuit }) {

  // ── Renderer → Main (one-way) ─────────────────────────────────────────────

  ipcMain.on('get-instances', (event) => {
    event.reply('get-instances', config.get('allInstances') || []);
  });

  ipcMain.on('ha-instance', (event, url) => {
    if (url) addInstance(url);
    if (currentInstance()) event.reply('ha-instance', currentInstance());
  });

  ipcMain.on('reconnect', async () => {
    await reinitMainWindow();
  });

  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.on('start-bonjour', (event) => {
    bonjour.find({ type: 'home-assistant' }, (instance) => {
      event.reply('bonjour-instance', {
        internal_url: instance.txt.internal_url,
        external_url: instance.txt.external_url,
      });
    });
  });

  ipcMain.on('ha-notification', (_event, { title, message }) => {
    showNotification(title, message, () => showWindow());
  });

  ipcMain.on('desktop-command', (_event, { command, payload }) => {
    commandReceiver.execute(command, payload);
  });

  // ── Renderer → Main (invoke / two-way) ───────────────────────────────────

  ipcMain.handle('get-system-stats', async () => {
    return SystemMonitor.getStats();
  });

  ipcMain.handle('get-active-window', async () => {
    return getActiveWindow();
  });

  ipcMain.handle('get-media-status', async () => {
    const stats = await SystemMonitor.getStats();
    return {
      webcam_active: stats.webcam_active,
      microphone_active: stats.microphone_active,
    };
  });

  // ── Settings window ───────────────────────────────────────────────────────

  ipcMain.on('settings-open', (event) => {
    event.reply('settings-loaded', {
      haBaseUrl: config.get('haBaseUrl'),
      haToken:   config.get('haToken'),
      pinnedEntities: config.get('pinnedEntities') || [],
    });
    const entities = getCachedEntities();
    if (entities.length) event.reply('entities-loaded', entities);
  });

  ipcMain.handle('save-settings', async (_event, { haBaseUrl, haToken }) => {
    try {
      config.set('haBaseUrl', haBaseUrl.trim());
      config.set('haToken', haToken.trim());
      const entities = await haClient.getToggleableEntities();
      setCachedEntities(entities);
      return { ok: true, entities };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('test-connection', async (_event, { haBaseUrl, haToken }) => {
    const orig = { url: config.get('haBaseUrl'), token: config.get('haToken') };
    config.set('haBaseUrl', haBaseUrl);
    config.set('haToken', haToken);
    try {
      const states = await haClient.getStates();
      config.set('haBaseUrl', orig.url);
      config.set('haToken', orig.token);
      return { ok: !!states, count: states?.length };
    } catch (err) {
      config.set('haBaseUrl', orig.url);
      config.set('haToken', orig.token);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('save-pinned', async (_event, pinnedEntities) => {
    config.set('pinnedEntities', pinnedEntities);
    return { ok: true };
  });

  // ── Shortcuts ─────────────────────────────────────────────────────────────
  ipcMain.handle('get-shortcuts', async () => {
    return shortcutManager.load();
  });

  ipcMain.handle('save-shortcut', async (_event, shortcut) => {
    shortcutManager.upsert(shortcut);
    return { ok: true };
  });

  ipcMain.handle('remove-shortcut', async (_event, accelerator) => {
    shortcutManager.remove(accelerator);
    return { ok: true };
  });

  logger.info('IPC handlers registered.');
}

module.exports = { registerAll };
