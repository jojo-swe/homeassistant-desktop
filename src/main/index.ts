import { app, BrowserWindow, globalShortcut, net } from 'electron';
import { Bonjour } from 'bonjour-service';
import logger from 'electron-log';
import config from './config';
import * as windowManager from './window';
import { createTray, getTray, getMenu, changePosition } from './tray';
import { useAutoUpdater, clearUpdateInterval, getUpdateCheckerInterval } from './updater';
import { registerAll } from './ipc';
import * as haClient from './haClient';
import * as sensorPusher from './sensorPusher';
import * as shortcutManager from './shortcutManager';
import { currentInstance, addInstance } from './instances';
import type { HAEntity } from './types';

logger.catchErrors();
logger.info(`${app.getName()} started`);
logger.info(`Platform: ${process.platform} ${process.arch}`);

const bonjour = new Bonjour();

let forceQuit = false;
let autostartEnabled = false;
let cachedEntities: HAEntity[] = [];
let availabilityCheckerInterval: NodeJS.Timeout | null = null;
let settingsWindow: BrowserWindow | null = null;

const SETTINGS_FILE = `file://${__dirname}/../renderer/settings/index.html`;

function checkAutoStart(): void {
  autostartEnabled = app.getLoginItemSettings().openAtLogin;
}

async function refreshEntityCache(): Promise<void> {
  if (!haClient.isConfigured()) return;
  try {
    cachedEntities = await haClient.getToggleableEntities();
    logger.info(`Entity cache refreshed: ${cachedEntities.length} entities.`);
  } catch (err) {
    logger.error('Failed to refresh entity cache:', err);
  }
}

function openSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 460,
    height: 640,
    minWidth: 420,
    minHeight: 500,
    title: 'Home Assistant Desktop — Settings',
    autoHideMenuBar: true,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: `${__dirname}/../preload/index.js`,
    },
  });

  settingsWindow.loadURL(SETTINGS_FILE);
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function availabilityCheck(): void {
  const instance = currentInstance();
  if (!instance) return;

  let url: URL;
  try {
    url = new URL(instance);
  } catch {
    logger.error(`Invalid stored instance URL: "${instance}"`);
    return;
  }
  const request = net.request(`${url.origin}/auth/providers`);

  request.on('response', async (response) => {
    if (response.statusCode !== 200) {
      logger.error('Response error: ' + response);
      await windowManager.showError(true);
    }
  });

  request.on('error', async (error) => {
    logger.error(error);
    if (availabilityCheckerInterval) {
      clearInterval(availabilityCheckerInterval);
      availabilityCheckerInterval = null;
    }
    await windowManager.showError(true);

    if (config.get('automaticSwitching')) checkForAvailableInstance();
  });

  request.end();
}

function checkForAvailableInstance(): void {
  const instances = config.get('allInstances');
  if (!instances || instances.length <= 1) return;

  bonjour.find({ type: 'home-assistant' }, (instance) => {
    const internalUrl = instance.txt?.internal_url;
    const externalUrl = instance.txt?.external_url;
    if (internalUrl && instances.indexOf(internalUrl) !== -1)
      return currentInstance(internalUrl);
    if (externalUrl && instances.indexOf(externalUrl) !== -1)
      return currentInstance(externalUrl);
  });

  for (const instance of instances.filter((e) => e !== currentInstance())) {
    const url = new URL(instance);
    const request = net.request(`${url.origin}/auth/providers`);
    let found: string | null = null;
    request.on('response', (response) => {
      if (response.statusCode === 200) found = instance;
    });
    request.on('error', () => {});
    request.end();
    if (found) {
      currentInstance(found);
      break;
    }
  }
}

windowManager.init({
  showWindow: () => windowManager.showWindow(),
  changePosition: () => changePosition(),
  toggleFullScreen: (mode?: boolean) => windowManager.toggleFullScreen(mode),
  forceQuit: () => forceQuit,
});

if (process.platform === 'darwin') app.dock?.hide();

app.whenReady().then(async () => {
  await useAutoUpdater(() => {
    forceQuit = true;
  });
  checkAutoStart();

  await windowManager.createMainWindow(!config.has('currentInstance'));

  createTray({
    getMainWindow: () => windowManager.getMainWindow()!,
    showWindow: () => windowManager.showWindow(),
    toggleFullScreen: () => windowManager.toggleFullScreen(),
    openSettingsWindow,
    getCachedEntities: () => cachedEntities,
    refreshEntityCache,
    getAutostartEnabled: () => autostartEnabled,
    getUpdateCheckerInterval,
    clearUpdateInterval,
    useAutoUpdater: () =>
      useAutoUpdater(() => {
        forceQuit = true;
      }),
    forceQuit: () => {
      forceQuit = true;
    },
  });

  if (process.platform === 'linux') {
    const tray = getTray();
    if (tray) tray.setContextMenu(getMenu());
  }

  registerAll({
    getMainWindow: () => windowManager.getMainWindow()!,
    showWindow: () => windowManager.showWindow(),
    openSettingsWindow,
    getCachedEntities: () => cachedEntities,
    setCachedEntities: (entities: HAEntity[]) => {
      cachedEntities = entities;
    },
    reinitMainWindow: async () => {
      await windowManager.reinitMainWindow();
      if (!availabilityCheckerInterval) {
        availabilityCheckerInterval = setInterval(availabilityCheck, 3000);
      }
    },
    addInstance,
    currentInstance,
    bonjour,
    forceQuit: () => {
      forceQuit = true;
    },
  });

  if (!availabilityCheckerInterval) {
    logger.info('Initialized availability check');
    availabilityCheckerInterval = setInterval(availabilityCheck, 3000);
  }

  if (config.get('shortcutEnabled')) windowManager.registerKeyboardShortcut();
  globalShortcut.register('CommandOrControl+Alt+Return', () => windowManager.toggleFullScreen());
  shortcutManager.registerAll();

  if (!config.has('currentInstance')) config.set('disableHover', true);
  if (!config.has('autoUpdate')) config.set('autoUpdate', true);

  sensorPusher.init(30_000);

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
