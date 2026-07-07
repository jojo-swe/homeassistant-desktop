import { autoUpdater } from 'electron-updater';
import logger from 'electron-log';
import config from './config';

autoUpdater.logger = logger;

let updateCheckerInterval: NodeJS.Timeout | null = null;

async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    logger.error(error);
    if (updateCheckerInterval) clearInterval(updateCheckerInterval);
  }
}

async function useAutoUpdater(onForceQuit: () => void): Promise<void> {
  autoUpdater.on('error', (message) => {
    logger.error('There was a problem updating the application');
    logger.error(message);
    if (updateCheckerInterval) clearInterval(updateCheckerInterval);
  });

  autoUpdater.on('update-downloaded', () => {
    onForceQuit();
    autoUpdater.quitAndInstall();
  });

  if (!updateCheckerInterval && config.get('autoUpdate')) {
    updateCheckerInterval = setInterval(checkForUpdates, 1000 * 60 * 60 * 4);
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
