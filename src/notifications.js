const { Notification, nativeImage } = require('electron');
const path = require('path');
const logger = require('electron-log');

const ICON_PATH = path.join(__dirname, '..', 'assets', 'IconWin.png');

/**
 * Shows a native OS notification for a Home Assistant alert.
 * @param {string} title - The notification title
 * @param {string} message - The notification body
 * @param {Function} onClick - Optional click handler
 */
function showNotification(title, message, onClick) {
  if (!Notification.isSupported()) {
    logger.warn('Native notifications are not supported on this platform.');
    return;
  }

  try {
    const icon = nativeImage.createFromPath(ICON_PATH);
    const notification = new Notification({
      title: title || 'Home Assistant',
      body: message || '',
      icon: icon.isEmpty() ? undefined : icon,
      silent: false,
    });

    if (onClick) {
      notification.on('click', onClick);
    }

    notification.show();
    logger.info(`Notification shown: "${title}"`);
  } catch (err) {
    logger.error('Failed to show notification:', err);
  }
}

module.exports = { showNotification };
