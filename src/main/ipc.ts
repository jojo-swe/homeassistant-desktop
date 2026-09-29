import { ipcMain, app, dialog, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'node:fs';
import logger from 'electron-log';
import config from './config';
import SystemMonitor from './systemMonitor';
import { showNotification } from './notifications';
import { getActiveWindow } from './activeWindow';
import * as haClient from './haClient';
import { execute as executeCommand } from './commandReceiver';
import * as shortcutManager from './shortcutManager';
import * as sensorPusher from './sensorPusher';
import { isHttpUrl, isInstanceUrl, isLocalAppUrl } from './urlSafety';
import { getSettingsWindow } from './settingsWindow';
import { suggestScene, activateScene } from './sceneSelector';
import { routeNotification, getDigest, clearDigest } from './smartNotifications';
import type { HAEntity, IpcRegisterDeps, SaveSettingsResult, TestConnectionResult } from './types';

type SenderEvent = Pick<IpcMainEvent | IpcMainInvokeEvent, 'senderFrame'>;

function senderUrl(event: SenderEvent): string {
  return event.senderFrame?.url ?? '';
}

/**
 * The preload bridge is also exposed to the remote Home Assistant page, so every channel
 * checks who is calling. Privileged channels only accept the app's own bundled pages.
 */
function isTrustedSender(event: SenderEvent, channel: string, allowInstance = false): boolean {
  const url = senderUrl(event);
  if (isLocalAppUrl(url) || (allowInstance && isInstanceUrl(url))) return true;
  logger.warn(`Blocked IPC "${channel}" from untrusted sender: ${url || 'unknown'}`);
  return false;
}

function onLocal(channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void): void {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrustedSender(event, channel)) listener(event, ...args);
  });
}

function handleLocal(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event, channel)) throw new Error(`Unauthorized IPC sender for "${channel}"`);
    return handler(event, ...args);
  });
}

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
    refreshTrayMenu,
  } = deps;

  const isSettingsSender = (event: Electron.IpcMainInvokeEvent): boolean => {
    const settings = getSettingsWindow();
    return !!settings && event.sender === settings.webContents;
  };

  onLocal('get-instances', (event) => {
    event.reply('get-instances', config.get('allInstances') || []);
  });

  onLocal('ha-instance', (event, url: unknown) => {
    if (isHttpUrl(url)) addInstance(url);
    if (currentInstance()) event.reply('ha-instance', currentInstance());
  });

  onLocal('reconnect', async () => {
    await reinitMainWindow();
  });

  onLocal('restart', () => {
    app.relaunch();
    app.exit();
  });

  let bonjourFind: { stop: () => void } | null = null;
  let bonjourTimeout: NodeJS.Timeout | null = null;

  onLocal('start-bonjour', (event) => {
    if (bonjourFind) bonjourFind.stop();
    if (bonjourTimeout) clearTimeout(bonjourTimeout);
    bonjourFind = (
      bonjour as {
        find: (
          opts: Record<string, unknown>,
          cb: (instance: { txt?: { internal_url?: string; external_url?: string } }) => void
        ) => { stop: () => void };
      }
    ).find({ type: 'home-assistant' }, (instance) => {
      // Some mDNS responders omit the TXT record entirely.
      event.reply('bonjour-instance', {
        internal_url: instance.txt?.internal_url,
        external_url: instance.txt?.external_url,
      });
    });
    bonjourTimeout = setTimeout(() => {
      if (bonjourFind) {
        bonjourFind.stop();
        bonjourFind = null;
      }
      bonjourTimeout = null;
    }, 30_000);
  });

  // Sent by the bridge injected into the Home Assistant page, so the instance origin is allowed too.
  ipcMain.on('ha-notification', (event, data: { title?: unknown; message?: unknown }) => {
    if (!isTrustedSender(event, 'ha-notification', true)) return;
    if (!data || typeof data.title !== 'string' || typeof data.message !== 'string') return;
    const { title, message } = data as { title: string; message: string };
    void routeNotification(
      title,
      message,
      () => showNotification(title, message, () => showWindow()),
      () => {
        getSettingsWindow()?.webContents.send('notification-digest-updated', getDigest());
        refreshTrayMenu();
      }
    );
  });

  ipcMain.on(
    'desktop-command',
    (event, { command, payload }: { command: string; payload: Record<string, unknown> }) => {
      if (!isTrustedSender(event, 'desktop-command', true)) return;
      executeCommand(command, payload);
    }
  );

  handleLocal('get-system-stats', async () => {
    return SystemMonitor.getStats();
  });

  handleLocal('get-active-window', async () => {
    return getActiveWindow();
  });

  handleLocal('get-media-status', async () => {
    const stats = await SystemMonitor.getStats();
    return {
      webcam_active: stats.webcam_active,
      microphone_active: stats.microphone_active,
    };
  });

  onLocal('settings-open', (event) => {
    event.reply('settings-loaded', {
      haBaseUrl: config.get('haBaseUrl'),
      haToken: config.get('haToken'),
      pinnedEntities: config.get('pinnedEntities') || [],
      theme: config.get('theme') || 'dark',
      accentColor: config.get('accentColor') || '',
      typeSafeKeyConfigured: !!config.get('typeSafeApiKey'),
      smartNotificationsEnabled: config.get('smartNotificationsEnabled') || false,
      notificationDigest: getDigest(),
    });
    const entities = getCachedEntities();
    if (entities.length) event.reply('entities-loaded', entities);
  });

  handleLocal('save-settings', async (_event, { haBaseUrl, haToken }): Promise<SaveSettingsResult> => {
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

  handleLocal('test-connection', async (_event, { haBaseUrl, haToken }): Promise<TestConnectionResult> => {
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

  handleLocal('save-typesafe-settings', async (event, data: unknown) => {
    if (!isSettingsSender(event)) return { ok: false, error: 'Settings window required.' };
    if (!data || typeof data !== 'object') return { ok: false, error: 'Invalid settings.' };
    const { apiKey, enabled, clearKey } = data as Record<string, unknown>;
    if (typeof enabled !== 'boolean' || typeof clearKey !== 'boolean' || typeof apiKey !== 'string') {
      return { ok: false, error: 'Invalid settings.' };
    }
    if (apiKey.length > 500) return { ok: false, error: 'API key is too long.' };
    if (clearKey) config.set('typeSafeApiKey', '');
    else if (apiKey.trim()) config.set('typeSafeApiKey', apiKey.trim());
    config.set('smartNotificationsEnabled', enabled && !!config.get('typeSafeApiKey'));
    refreshTrayMenu();
    return {
      ok: true,
      typeSafeKeyConfigured: !!config.get('typeSafeApiKey'),
      smartNotificationsEnabled: config.get('smartNotificationsEnabled'),
    };
  });

  handleLocal('suggest-scene', async (event, request: unknown) => {
    if (!isSettingsSender(event)) return { ok: false, error: 'Settings window required.' };
    if (typeof request !== 'string') return { ok: false, error: 'Invalid request.' };
    return suggestScene(request);
  });

  handleLocal('activate-scene', async (event, sceneId: unknown) => {
    if (!isSettingsSender(event)) return { ok: false, error: 'Settings window required.' };
    if (typeof sceneId !== 'string') return { ok: false, error: 'Invalid scene.' };
    return activateScene(sceneId);
  });

  handleLocal('clear-notification-digest', async (event) => {
    if (!isSettingsSender(event)) return { ok: false };
    clearDigest();
    refreshTrayMenu();
    return { ok: true };
  });

  handleLocal('save-pinned', async (_event, pinnedEntities: unknown) => {
    if (!Array.isArray(pinnedEntities) || !pinnedEntities.every((id) => typeof id === 'string')) {
      return { ok: false, error: 'Invalid pinned entities: expected an array of entity IDs.' };
    }
    config.set('pinnedEntities', pinnedEntities);
    return { ok: true };
  });

  handleLocal('get-shortcuts', async () => {
    return shortcutManager.load();
  });

  handleLocal('save-shortcut', async (_event, shortcut) => {
    if (!shortcut || typeof shortcut.accelerator !== 'string' || typeof shortcut.entityId !== 'string') {
      return { ok: false, error: 'Invalid shortcut: accelerator and entityId are required.' };
    }
    shortcutManager.upsert(shortcut);
    return { ok: true };
  });

  handleLocal('remove-shortcut', async (_event, accelerator: string) => {
    shortcutManager.remove(accelerator);
    return { ok: true };
  });

  handleLocal('export-config', async () => {
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

  handleLocal('import-config', async () => {
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
        try {
          new URL(data.haBaseUrl);
        } catch {
          return { ok: false, error: 'Invalid haBaseUrl: not a valid URL.' };
        }
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
      if (
        data.allInstances !== undefined &&
        (!Array.isArray(data.allInstances) || !data.allInstances.every(isHttpUrl))
      ) {
        return { ok: false, error: 'Invalid allInstances: expected an array of http(s) URLs.' };
      }

      const keys = [
        'haBaseUrl',
        'haToken',
        'pinnedEntities',
        'shortcuts',
        'allInstances',
        'automaticSwitching',
        'detachedMode',
        'disableHover',
        'stayOnTop',
        'shortcutEnabled',
        'autoUpdate',
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
