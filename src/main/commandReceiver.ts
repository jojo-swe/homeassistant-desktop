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

/**
 * Sets (rather than toggles) the default output device's mute state through the Windows Core Audio
 * API. The media mute key (VK_VOLUME_MUTE) only toggles, so "mute" would unmute a muted system.
 */
function windowsSetMuteScript(mute: boolean): string {
  return `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  [PreserveSig] int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int f();
  [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class HadAudio {
  public static void SetMute(bool mute) {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice device = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
    IAudioEndpointVolume volume = null;
    var volumeId = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(device.Activate(ref volumeId, 23, 0, out volume));
    Marshal.ThrowExceptionForHR(volume.SetMute(mute, Guid.Empty));
  }
}
'@
[HadAudio]::SetMute($${mute ? 'true' : 'false'})
`;
}

function windowsSetMute(mute: boolean): void {
  execFile(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', windowsSetMuteScript(mute)],
    { timeout: 10000 },
    (err) => {
      if (err) logger.error(`Failed to ${mute ? 'mute' : 'unmute'} audio:`, err.message);
    }
  );
}

const HANDLERS: Record<string, CommandHandler> = {
  lock_screen: () => {
    logger.info('Command: lock_screen');
    if (process.platform === 'win32') {
      execFile('rundll32.exe', ['user32.dll,LockWorkStation']);
    } else if (process.platform === 'darwin') {
      exec(
        String.raw`/System/Library/CoreServices/Menu\ Extras/User.menu/Contents/Resources/CGSession -suspend || pmset displaysleepnow`
      );
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
      windowsSetMute(true);
    } else if (process.platform === 'darwin') {
      exec('osascript -e "set volume with output muted"');
    } else {
      exec('amixer -D pulse sset Master mute');
    }
  },

  unmute: () => {
    logger.info('Command: unmute');
    if (process.platform === 'win32') {
      windowsSetMute(false);
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
