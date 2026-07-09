import { Notification, nativeImage } from 'electron';
import nodePath from 'node:path';
import logger from 'electron-log';

const ICON_PATH = nodePath.join(
  __dirname,
  '..',
  '..',
  'assets',
  process.platform === 'darwin' ? 'IconTemplate.png' : 'IconWin.png'
);

function showNotification(title: string, message: string, onClick?: () => void): void {
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

export { showNotification };
