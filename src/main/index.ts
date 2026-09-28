import { app, globalShortcut } from 'electron';
import logger from 'electron-log';
import config from './config';
import * as windowManager from './window';
import { createTray, changePosition, refreshMenu } from './tray';
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
let entityCacheInterval: NodeJS.Timeout | null = null;

// A second copy would duplicate the tray icon, sensor pushes and global shortcuts.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  logger.info('Another instance is already running — exiting.');
  app.quit();
}

app.on('second-instance', () => windowManager.showWindow());

function isAutostartEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

async function refreshEntitiesAndMenu(): Promise<void> {
  await refreshEntityCache();
  refreshMenu();
}

windowManager.init({
  showWindow: () => windowManager.showWindow(),
  changePosition: () => changePosition(),
  toggleFullScreen: (mode?: boolean) => windowManager.toggleFullScreen(mode),
  forceQuit: () => forceQuit,
});

if (process.platform === 'darwin') app.dock?.hide();

async function initializeApp(): Promise<void> {
  // IPC must be ready before the first page loads: onboarding asks for the current instance
  // while it is still loading, and messages sent before a listener exists are dropped.
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
        onStatusChange: () => refreshMenu(),
      });
    },
    addInstance,
    currentInstance,
    bonjour: availabilityChecker.getBonjour(),
    forceQuit: () => {
      forceQuit = true;
    },
  });

  const isFirstRun = !config.has('currentInstance');
  await windowManager.createMainWindow(isFirstRun);

  const storedAccent = config.get('accentColor');
  if (storedAccent) windowManager.applyAccentColor(storedAccent);

  createTray({
    getMainWindow: () => windowManager.getMainWindow()!,
    showWindow: () => windowManager.showWindow(),
    toggleFullScreen: () => windowManager.toggleFullScreen(),
    openSettingsWindow,
    getCachedEntities,
    refreshEntityCache: refreshEntitiesAndMenu,
    getAutostartEnabled: isAutostartEnabled,
    getUpdateCheckerInterval,
    clearUpdateInterval,
    useAutoUpdater: () =>
      useAutoUpdater(() => {
        forceQuit = true;
      }),
    forceQuit: () => {
      forceQuit = true;
    },
    isConnected: () => availabilityChecker.isConnected(),
  });

  // The window is created before the tray exists, so on first run show onboarding once the
  // tray is in place to position against.
  if (isFirstRun) windowManager.showWindow();

  availabilityChecker.init({
    showError: (isError: boolean) => windowManager.showError(isError),
    onStatusChange: () => refreshMenu(),
  });

  if (config.get('shortcutEnabled')) windowManager.registerKeyboardShortcut();
  config.onDidChange('shortcutEnabled', (enabled) => {
    if (enabled) windowManager.registerKeyboardShortcut();
    else windowManager.unregisterKeyboardShortcut();
  });
  config.onDidChange('pinnedEntities', () => refreshMenu());
  const fullscreenRegistered = globalShortcut.register('CommandOrControl+Alt+Return', () =>
    windowManager.toggleFullScreen()
  );
  if (!fullscreenRegistered) {
    logger.warn('Failed to register fullscreen shortcut (CommandOrControl+Alt+Return) — may be in use by another app.');
  }
  shortcutManager.registerAll();

  if (!config.has('currentInstance')) config.set('disableHover', true);
  if (!config.has('autoUpdate')) config.set('autoUpdate', true);

  sensorPusher.init(30_000);

  // Network-bound; don't hold up startup.
  void useAutoUpdater(() => {
    forceQuit = true;
  });

  await refreshEntitiesAndMenu();
  entityCacheInterval = setInterval(refreshEntitiesAndMenu, 60 * 1000);
}

if (hasSingleInstanceLock) {
  app
    .whenReady()
    .then(initializeApp)
    .catch((err) => {
      logger.error('Failed to initialize application:', err);
    });
}

// Closing the main window only hides it; an explicit quit (menu, OS logout, installer, SIGTERM)
// must be allowed through.
app.on('before-quit', () => {
  forceQuit = true;
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

// Tray app: keep running when no windows are open. Quitting is explicit (tray menu / OS).
app.on('window-all-closed', () => {});
