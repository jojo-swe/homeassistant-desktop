import { shell } from 'electron';
import { execFile, exec } from 'node:child_process';
import logger from 'electron-log';
import { showNotification } from './notifications';

interface CommandPayload {
  title?: string;
  message?: string;
  url?: string;
  [key: string]: unknown;
}

type CommandHandler = (payload: CommandPayload) => void;

const HANDLERS: Record<string, CommandHandler> = {
  lock_screen: () => {
    logger.info('Command: lock_screen');
    if (process.platform === 'win32') {
      execFile('rundll32.exe', ['user32.dll,LockWorkStation']);
    } else if (process.platform === 'darwin') {
      exec(String.raw`/System/Library/CoreServices/Menu\ Extras/User.menu/Contents/Resources/CGSession -suspend || pmset displaysleepnow`);
    } else {
      exec('loginctl lock-session');
    }
  },

  sleep: () => {
    logger.info('Command: sleep');
    if (process.platform === 'win32') {
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Add-type -assembly "System.Windows.Forms" | Out-Null; [System.Windows.Forms.Application]::SetSuspendState(\'Suspend\', $false, $false)',
        ],
        { timeout: 5000 }
      );
    } else if (process.platform === 'darwin') {
      exec('pmset sleepnow');
    } else {
      exec('systemctl suspend');
    }
  },

  mute: () => {
    logger.info('Command: mute');
    if (process.platform === 'win32') {
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)',
        ],
        { timeout: 3000 }
      );
    } else if (process.platform === 'darwin') {
      exec('osascript -e "set volume with output muted"');
    } else {
      exec('amixer -D pulse sset Master mute');
    }
  },

  unmute: () => {
    logger.info('Command: unmute');
    if (process.platform === 'win32') {
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)',
        ],
        { timeout: 3000 }
      );
    } else if (process.platform === 'darwin') {
      exec('osascript -e "set volume without output muted"');
    } else {
      exec('amixer -D pulse sset Master unmute');
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

function execute(command: string, payload: CommandPayload = {}): void {
  const handler = HANDLERS[command];
  if (!handler) {
    logger.warn(`CommandReceiver: unknown command "${command}" — ignored.`);
    return;
  }
  try {
    handler(payload);
  } catch (err) {
    logger.error(`CommandReceiver: error executing "${command}": ${(err as Error).message}`);
  }
}

export { execute };
