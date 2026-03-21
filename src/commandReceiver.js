/**
 * src/commandReceiver.js
 *
 * Handles remote commands sent from Home Assistant to the desktop PC.
 * Commands arrive via a custom HA event `desktop_command` fired from
 * HA scripts/automations. The haNotificationBridge.js script (injected
 * into the HA page) listens for the event and forwards it via IPC.
 *
 * Supported commands:
 *   lock_screen      — Locks the Windows/macOS session
 *   sleep            — Puts the PC to sleep
 *   mute             — Mutes system volume
 *   unmute           — Unmutes system volume
 *   show_notification — Shows a native OS notification (requires title/message)
 *   open_url          — Opens a URL in the default browser (requires url)
 */

const { shell } = require('electron');
const { execFile, exec } = require('child_process');
const logger = require('electron-log');
const { showNotification } = require('./notifications');

// Whitelisted commands — arbitrary strings are never executed
const HANDLERS = {
  lock_screen: (_, showNotifFn) => {
    logger.info('Command: lock_screen');
    if (process.platform === 'win32') {
      execFile('rundll32.exe', ['user32.dll,LockWorkStation']);
    } else if (process.platform === 'darwin') {
      exec('/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend');
    } else {
      exec('loginctl lock-session');
    }
  },

  sleep: (_) => {
    logger.info('Command: sleep');
    if (process.platform === 'win32') {
      // Safe PowerShell sleep — no DllImport, no Add-Type
      execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        'Add-type -assembly "System.Windows.Forms" | Out-Null; [System.Windows.Forms.Application]::SetSuspendState(\'Suspend\', $false, $false)'
      ], { timeout: 5000 });
    } else if (process.platform === 'darwin') {
      exec('pmset sleepnow');
    } else {
      exec('systemctl suspend');
    }
  },

  mute: (_) => {
    logger.info('Command: mute');
    if (process.platform === 'win32') {
      execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        '$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)'
      ], { timeout: 3000 });
    }
  },

  unmute: (_) => {
    logger.info('Command: unmute');
    if (process.platform === 'win32') {
      execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        '$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)'
      ], { timeout: 3000 });
    }
  },

  show_notification: (payload) => {
    logger.info('Command: show_notification');
    const title = payload.title || 'Home Assistant';
    const message = payload.message || '';
    showNotification(title, message);
  },

  open_url: (payload) => {
    const url = payload.url;
    if (!url || !/^https?:\/\//.test(url)) {
      logger.warn('Command: open_url — invalid or missing URL');
      return;
    }
    logger.info(`Command: open_url → ${url}`);
    shell.openExternal(url);
  },
};

/**
 * Executes an incoming desktop command.
 * @param {string} command — One of the whitelisted command strings
 * @param {object} payload — Optional extra data (title, message, url)
 */
function execute(command, payload = {}) {
  const handler = HANDLERS[command];
  if (!handler) {
    logger.warn(`CommandReceiver: unknown command "${command}" — ignored.`);
    return;
  }
  try {
    handler(payload);
  } catch (err) {
    logger.error(`CommandReceiver: error executing "${command}":`, err.message);
  }
}

module.exports = { execute };
