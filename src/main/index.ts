import { app, globalShortcut } from 'electron';
import logger from 'electron-log';
import config from './config';
import * as windowManager from './window';
import { createTray, changePosition } from './tray';
import { useAutoUpdater, clearUpdateInterval, getUpdateCheckerInterval } from './updater';
import { registerAll } from './ipc';
import * as sensorPusher from './sensorPusher';
import * as shortcutManager from './shortcutManager';
import { currentInstance, addInstance } from './instances';
import { openSettingsWindow } from './settingsWindow';
import { refreshEntityCache, getCachedEntities, setCachedEntities } from './entityCache';
import * as availabilityChecker from './availabilityChecker';
import { stopTracking } from './activeWindow';

logger.catchErrors();
logger.info(`${app.getName()} started`);
logger.info(`Platform: ${process.platform} ${process.arch}`);

let forceQuit = false;
let autostartEnabled = false;
let entityCacheInterval: NodeJS.Timeout | null = null;

function checkAutoStart(): void {
  autostartEnabled = app.getLoginItemSettings().openAtLogin;
}

windowManager.init({
  showWindow: () => windowManager.showWindow(),
  changePosition: () => changePosition(),
  toggleFullScreen: (mode?: boolean) => windowManager.toggleFullScreen(mode),
  forceQuit: () => forceQuit,
});

if (process.platform === 'darwin') app.dock?.hide();

async function initializeApp(): Promise<void> {
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
    getCachedEntities,
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

  registerAll({
    getMainWindow: () => windowManager.getMainWindow()!,
    showWindow: () => windowManager.showWindow(),
    openSettingsWindow,
    getCachedEntities,
    setCachedEntities,
    reinitMainWindow: async () => {
      await windowManager.reinitMainWindow();
      availabilityChecker.init({
        showError: (isError: boolean) => windowManager.showError(isError),
      });
    },
    addInstance,
    currentInstance,
    bonjour: availabilityChecker.getBonjour(),
    forceQuit: () => {
      forceQuit = true;
    },
  });

  availabilityChecker.init({
    showError: (isError: boolean) => windowManager.showError(isError),
  });

  if (config.get('shortcutEnabled')) windowManager.registerKeyboardShortcut();
  const fullscreenRegistered = globalShortcut.register('CommandOrControl+Alt+Return', () => windowManager.toggleFullScreen());
  if (!fullscreenRegistered) {
    logger.warn('Failed to register fullscreen shortcut (CommandOrControl+Alt+Return) — may be in use by another app.');
  }
  shortcutManager.registerAll();

  if (!config.has('currentInstance')) config.set('disableHover', true);
  if (!config.has('autoUpdate')) config.set('autoUpdate', true);

  sensorPusher.init(30_000);

  await refreshEntityCache();
  entityCacheInterval = setInterval(refreshEntityCache, 60 * 1000);
}

app.whenReady().then(initializeApp).catch((err) => {
  logger.error('Failed to initialize application:', err);
});

app.on('will-quit', () => {
  windowManager.unregisterKeyboardShortcut();
  shortcutManager.unregisterAll();
  availabilityChecker.stop();
  sensorPusher.stop();
  stopTracking();
  if (entityCacheInterval) {
    clearInterval(entityCacheInterval);
    entityCacheInterval = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
