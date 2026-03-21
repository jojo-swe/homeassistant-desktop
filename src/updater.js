const { autoUpdater } = require('electron-updater');
const logger = require('electron-log');
const config = require('../config');

autoUpdater.logger = logger;

let updateCheckerInterval;

async function checkForUpdates() {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    logger.error(error);
    clearInterval(updateCheckerInterval);
  }
}

async function useAutoUpdater(onForceQuit) {
  autoUpdater.on('error', (message) => {
    logger.error('There was a problem updating the application');
    logger.error(message);
    clearInterval(updateCheckerInterval);
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

function clearUpdateInterval() {
  clearInterval(updateCheckerInterval);
  updateCheckerInterval = null;
}

function getUpdateCheckerInterval() {
  return updateCheckerInterval;
}

module.exports = { useAutoUpdater, checkForUpdates, clearUpdateInterval, getUpdateCheckerInterval };
