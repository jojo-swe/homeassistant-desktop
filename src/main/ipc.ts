import { ipcMain, app, dialog } from 'electron';
import * as fs from 'fs';
import logger from 'electron-log';
import config from './config';
import SystemMonitor from './systemMonitor';
import { showNotification } from './notifications';
import { getActiveWindow } from './activeWindow';
import * as haClient from './haClient';
import { execute as executeCommand } from './commandReceiver';
import * as shortcutManager from './shortcutManager';
import * as sensorPusher from './sensorPusher';
import type { HAEntity, IpcRegisterDeps, SaveSettingsResult, TestConnectionResult } from './types';

function registerAll(deps: IpcRegisterDeps): void {
  const {
    getMainWindow,
    showWindow,
    openSettingsWindow,
    getCachedEntities,
    setCachedEntities,
    reinitMainWindow,
    addInstance,
    currentInstance,
    bonjour,
    forceQuit,
  } = deps;

  ipcMain.on('get-instances', (event) => {
    event.reply('get-instances', config.get('allInstances') || []);
  });

  ipcMain.on('ha-instance', (event, url: string) => {
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

  let bonjourFind: { stop: () => void } | null = null;

  ipcMain.on('start-bonjour', (event) => {
    if (bonjourFind) bonjourFind.stop();
    bonjourFind = (bonjour as { find: (opts: Record<string, unknown>, cb: (instance: { txt: { internal_url: string; external_url: string } }) => void) => { stop: () => void } }).find(
      { type: 'home-assistant' },
      (instance) => {
        event.reply('bonjour-instance', {
          internal_url: instance.txt.internal_url,
          external_url: instance.txt.external_url,
        });
      },
    );
    setTimeout(() => {
      if (bonjourFind) {
        bonjourFind.stop();
        bonjourFind = null;
      }
    }, 30_000);
  });

  ipcMain.on('ha-notification', (_event, { title, message }: { title: string; message: string }) => {
    showNotification(title, message, () => showWindow());
  });

  ipcMain.on('desktop-command', (_event, { command, payload }: { command: string; payload: Record<string, unknown> }) => {
    executeCommand(command, payload);
  });

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

  ipcMain.on('settings-open', (event) => {
    event.reply('settings-loaded', {
      haBaseUrl: config.get('haBaseUrl'),
      haToken: config.get('haToken'),
      pinnedEntities: config.get('pinnedEntities') || [],
      theme: config.get('theme') || 'dark',
    });
    const entities = getCachedEntities();
    if (entities.length) event.reply('entities-loaded', entities);
  });

  ipcMain.handle('save-settings', async (_event, { haBaseUrl, haToken }): Promise<SaveSettingsResult> => {
    try {
      const trimmedUrl = haBaseUrl.trim();
      const trimmedToken = haToken.trim();
      if (!trimmedUrl || !trimmedToken) {
        return { ok: false, error: 'URL and token are required.' };
      }
      try {
        new URL(trimmedUrl);
      } catch {
        return { ok: false, error: 'Invalid URL format.' };
      }
      config.set('haBaseUrl', trimmedUrl.replace(/\/$/, ''));
      config.set('haToken', trimmedToken);
      const entities: HAEntity[] = await haClient.getToggleableEntities();
      setCachedEntities(entities);
      sensorPusher.start();
      return { ok: true, entities };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('test-connection', async (_event, { haBaseUrl, haToken }): Promise<TestConnectionResult> => {
    try {
      const trimmedUrl = haBaseUrl.trim().replace(/\/$/, '');
      const trimmedToken = haToken.trim();
      if (!trimmedUrl || !trimmedToken) {
        return { ok: false, error: 'URL and token are required.' };
      }
      try {
        new URL(trimmedUrl);
      } catch {
        return { ok: false, error: 'Invalid URL format.' };
      }
      const states = await haClient.getStatesWithCredentials(trimmedUrl, trimmedToken);
      return { ok: !!states, count: states?.length };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('save-pinned', async (_event, pinnedEntities: string[]) => {
    config.set('pinnedEntities', pinnedEntities);
    return { ok: true };
  });

  ipcMain.handle('get-shortcuts', async () => {
    return shortcutManager.load();
  });

  ipcMain.handle('save-shortcut', async (_event, shortcut) => {
    shortcutManager.upsert(shortcut);
    return { ok: true };
  });

  ipcMain.handle('remove-shortcut', async (_event, accelerator: string) => {
    shortcutManager.remove(accelerator);
    return { ok: true };
  });

  ipcMain.handle('export-config', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Configuration',
      defaultPath: 'homeassistant-desktop-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, error: 'Cancelled' };
    try {
      const exportData = {
        haBaseUrl: config.get('haBaseUrl'),
        haToken: config.get('haToken'),
        pinnedEntities: config.get('pinnedEntities') || [],
        shortcuts: config.get('shortcuts') || [],
        allInstances: config.get('allInstances') || [],
        automaticSwitching: config.get('automaticSwitching'),
        detachedMode: config.get('detachedMode'),
        disableHover: config.get('disableHover'),
        stayOnTop: config.get('stayOnTop'),
        shortcutEnabled: config.get('shortcutEnabled'),
        autoUpdate: config.get('autoUpdate'),
      };
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');
      logger.info(`Config exported to ${result.filePath}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('import-config', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Configuration',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, error: 'Cancelled' };
    try {
      const filePath = result.filePaths[0];
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);

      if (typeof data !== 'object' || data === null) {
        return { ok: false, error: 'Invalid config file: expected JSON object.' };
      }

      if (data.haBaseUrl !== undefined) {
        if (typeof data.haBaseUrl !== 'string') {
          return { ok: false, error: 'Invalid haBaseUrl: expected string.' };
        }
        try { new URL(data.haBaseUrl); } catch { return { ok: false, error: 'Invalid haBaseUrl: not a valid URL.' }; }
      }
      if (data.haToken !== undefined && typeof data.haToken !== 'string') {
        return { ok: false, error: 'Invalid haToken: expected string.' };
      }
      if (data.pinnedEntities !== undefined && !Array.isArray(data.pinnedEntities)) {
        return { ok: false, error: 'Invalid pinnedEntities: expected array.' };
      }
      if (data.shortcuts !== undefined && !Array.isArray(data.shortcuts)) {
        return { ok: false, error: 'Invalid shortcuts: expected array.' };
      }
      if (data.allInstances !== undefined && !Array.isArray(data.allInstances)) {
        return { ok: false, error: 'Invalid allInstances: expected array.' };
      }

      const keys = [
        'haBaseUrl', 'haToken', 'pinnedEntities', 'shortcuts',
        'allInstances', 'automaticSwitching', 'detachedMode',
        'disableHover', 'stayOnTop', 'shortcutEnabled', 'autoUpdate',
      ];
      for (const key of keys) {
        if (data[key] !== undefined) config.set(key, data[key]);
      }
      logger.info(`Config imported from ${filePath}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  logger.info('IPC handlers registered.');
}

export { registerAll };
