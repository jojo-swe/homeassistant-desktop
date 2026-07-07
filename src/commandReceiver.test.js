jest.mock('electron', () => ({
  shell: { openExternal: jest.fn() },
}));

jest.mock('child_process', () => ({
  execFile: jest.fn(),
  exec: jest.fn(),
}));

jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('./notifications', () => ({
  showNotification: jest.fn(),
}));

const { shell } = require('electron');
const { exec, execFile } = require('child_process');
const commandReceiver = require('./commandReceiver');

describe('commandReceiver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    test('warns on unknown command without throwing', () => {
      expect(() => commandReceiver.execute('nonexistent_command', {})).not.toThrow();
    });

    test('does nothing for unknown command', () => {
      commandReceiver.execute('fake_cmd', {});
      expect(exec).not.toHaveBeenCalled();
      expect(execFile).not.toHaveBeenCalled();
    });
  });

  describe('open_url', () => {
    test('opens valid http URL in external browser', () => {
      commandReceiver.execute('open_url', { url: 'http://example.com' });
      expect(shell.openExternal).toHaveBeenCalledWith('http://example.com');
    });

    test('opens valid https URL in external browser', () => {
      commandReceiver.execute('open_url', { url: 'https://example.com' });
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    });

    test('rejects non-http protocols', () => {
      commandReceiver.execute('open_url', { url: 'file:///etc/passwd' });
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    test('rejects missing url', () => {
      commandReceiver.execute('open_url', {});
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    test('rejects javascript protocol', () => {
      commandReceiver.execute('open_url', { url: 'javascript:alert(1)' });
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('show_notification', () => {
    test('calls showNotification with title and message', () => {
      const { showNotification } = require('./notifications');
      commandReceiver.execute('show_notification', { title: 'Test', message: 'Hello' });
      expect(showNotification).toHaveBeenCalledWith('Test', 'Hello');
    });

    test('uses defaults when title/message missing', () => {
      const { showNotification } = require('./notifications');
      commandReceiver.execute('show_notification', {});
      expect(showNotification).toHaveBeenCalledWith('Home Assistant', '');
    });
  });

  describe('lock_screen', () => {
    test('executes rundll32 on win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      commandReceiver.execute('lock_screen', {});
      expect(execFile).toHaveBeenCalledWith('rundll32.exe', ['user32.dll,LockWorkStation']);
      Object.defineProperty(process, 'platform', { value: process.platform, configurable: true });
    });
  });
});
