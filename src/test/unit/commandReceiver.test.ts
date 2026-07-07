import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
}));

vi.mock('child_process', () => ({
  execFile: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../main/notifications', () => ({
  showNotification: vi.fn(),
}));

import { shell } from 'electron';
import { execFile, exec } from 'child_process';
import { execute } from '../../main/commandReceiver';
import { showNotification } from '../../main/notifications';

describe('commandReceiver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    test('warns on unknown command without throwing', () => {
      expect(() => execute('nonexistent_command', {})).not.toThrow();
    });

    test('does nothing for unknown command', () => {
      execute('fake_cmd', {});
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('open_url', () => {
    test('opens valid http URL in external browser', () => {
      execute('open_url', { url: 'http://example.com' });
      expect(shell.openExternal).toHaveBeenCalledWith('http://example.com');
    });

    test('opens valid https URL in external browser', () => {
      execute('open_url', { url: 'https://example.com' });
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    });

    test('rejects non-http protocols', () => {
      execute('open_url', { url: 'file:///etc/passwd' });
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    test('rejects missing url', () => {
      execute('open_url', {});
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    test('rejects javascript protocol', () => {
      execute('open_url', { url: 'javascript:alert(1)' });
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('show_notification', () => {
    test('calls showNotification with title and message', () => {
      execute('show_notification', { title: 'Test', message: 'Hello' });
      expect(showNotification).toHaveBeenCalledWith('Test', 'Hello');
    });

    test('uses defaults when title/message missing', () => {
      execute('show_notification', {});
      expect(showNotification).toHaveBeenCalledWith('Home Assistant', '');
    });
  });

  describe('lock_screen', () => {
    test('calls rundll32 on win32', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      execute('lock_screen', {});
      expect(execFile).toHaveBeenCalledWith('rundll32.exe', ['user32.dll,LockWorkStation']);
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('calls CGSession on darwin', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      execute('lock_screen', {});
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('CGSession'));
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('calls loginctl on linux', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      execute('lock_screen', {});
      expect(exec).toHaveBeenCalledWith('loginctl lock-session');
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });
  });

  describe('sleep', () => {
    test('calls powershell on win32', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      execute('sleep', {});
      expect(execFile).toHaveBeenCalledWith('powershell', expect.any(Array), expect.any(Object));
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('calls pmset on darwin', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      execute('sleep', {});
      expect(exec).toHaveBeenCalledWith('pmset sleepnow');
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('calls systemctl on linux', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      execute('sleep', {});
      expect(exec).toHaveBeenCalledWith('systemctl suspend');
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });
  });

  describe('mute', () => {
    test('calls powershell on win32', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      execute('mute', {});
      expect(execFile).toHaveBeenCalledWith('powershell', expect.any(Array), expect.any(Object));
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('calls osascript on darwin', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      execute('mute', {});
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('output muted'));
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('calls amixer on linux', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      execute('mute', {});
      expect(exec).toHaveBeenCalledWith('amixer -D pulse sset Master mute');
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });
  });

  describe('unmute', () => {
    test('calls powershell on win32', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      execute('unmute', {});
      expect(execFile).toHaveBeenCalledWith('powershell', expect.any(Array), expect.any(Object));
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('calls osascript on darwin', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      execute('unmute', {});
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('without output muted'));
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('calls amixer on linux', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      execute('unmute', {});
      expect(exec).toHaveBeenCalledWith('amixer -D pulse sset Master unmute');
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });
  });
});
