import { autoUpdater, type UpdateInfo } from 'electron-updater';
import logger from 'electron-log';
import config from './config';
import { showNotification } from './notifications';

autoUpdater.logger = logger;
// Downloaded updates are applied the next time the app quits; never restart out from under the user.
autoUpdater.autoInstallOnAppQuit = true;

const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4;

let updateCheckerInterval: NodeJS.Timeout | null = null;
let listenersRegistered = false;

async function checkForUpdates(): Promise<void> {
  if (!config.get('autoUpdate')) return;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    // Usually transient (offline, GitHub rate limit). Keep the schedule so the next check can succeed.
    logger.error('Update check failed:', error);
  }
}

async function useAutoUpdater(onForceQuit: () => void): Promise<void> {
  if (!listenersRegistered) {
    autoUpdater.on('error', (error) => {
      logger.error('There was a problem updating the application');
      logger.error(error);
    });

    autoUpdater.on('update-downloaded', (info?: UpdateInfo) => {
      const version = info?.version ? ` ${info.version}` : '';
      logger.info(`Update${version} downloaded; it will be installed on quit.`);
      showNotification(
        'Update ready',
        `Home Assistant Desktop${version} will be installed when you quit. Click to restart now.`,
        () => {
          onForceQuit();
          autoUpdater.quitAndInstall();
        }
      );
    });
    listenersRegistered = true;
  }

  if (!config.get('autoUpdate')) return;

  if (!updateCheckerInterval) {
    updateCheckerInterval = setInterval(checkForUpdates, CHECK_INTERVAL_MS);
  }

  await checkForUpdates();
}

function clearUpdateInterval(): void {
  if (updateCheckerInterval) {
    clearInterval(updateCheckerInterval);
    updateCheckerInterval = null;
  }
}

function getUpdateCheckerInterval(): NodeJS.Timeout | null {
  return updateCheckerInterval;
}

export { useAutoUpdater, checkForUpdates, clearUpdateInterval, getUpdateCheckerInterval };
