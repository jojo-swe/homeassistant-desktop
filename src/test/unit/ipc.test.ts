import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
  },
  app: { relaunch: vi.fn(), exit: vi.fn() },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../main/config', () => {
  const store: Record<string, unknown> = {};
  return {
    default: {
      get: vi.fn((key: string) => store[key]),
      set: vi.fn((key: string, val: unknown) => {
        store[key] = val;
      }),
      has: vi.fn((key: string) => key in store),
    },
  };
});

vi.mock('../../main/systemMonitor', () => ({
  default: {
    getStats: vi.fn().mockResolvedValue({
      memory_usage_percent: 50,
      cpu_load_percent: 30,
      idle_time_seconds: 10,
      is_active: true,
      webcam_active: false,
      microphone_active: false,
      battery_percent: 80,
      battery_charging: true,
      hostname: 'test',
      platform: 'linux',
    }),
  },
}));

vi.mock('../../main/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('../../main/activeWindow', () => ({
  getActiveWindow: vi.fn().mockResolvedValue({ process_name: 'test', window_title: 'Test' }),
}));

vi.mock('../../main/haClient', () => ({
  getStates: vi.fn(),
  getToggleableEntities: vi.fn(),
}));

vi.mock('../../main/commandReceiver', () => ({
  execute: vi.fn(),
}));

vi.mock('../../main/shortcutManager', () => ({
  load: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../main/sensorPusher', () => ({
  start: vi.fn(),
  stop: vi.fn(),
  init: vi.fn(),
  pushAllSensors: vi.fn(),
}));

import { ipcMain, app } from 'electron';
import logger from 'electron-log';
import config from '../../main/config';
import SystemMonitor from '../../main/systemMonitor';
import { showNotification } from '../../main/notifications';
import { getActiveWindow } from '../../main/activeWindow';
import * as haClient from '../../main/haClient';
import { execute as executeCommand } from '../../main/commandReceiver';
import * as shortcutManager from '../../main/shortcutManager';
import * as sensorPusher from '../../main/sensorPusher';
import { registerAll } from '../../main/ipc';
import type { IpcRegisterDeps } from '../../main/types';

function createDeps(): IpcRegisterDeps {
  return {
    getMainWindow: vi.fn(),
    showWindow: vi.fn(),
    openSettingsWindow: vi.fn(),
    getCachedEntities: vi.fn(() => []),
    setCachedEntities: vi.fn(),
    reinitMainWindow: vi.fn().mockResolvedValue(undefined),
    addInstance: vi.fn(),
    currentInstance: vi.fn(() => false as string | false),
    bonjour: { find: vi.fn() },
    forceQuit: vi.fn(),
  };
}

function getHandler(channel: string): Function | undefined {
  const call = vi.mocked(ipcMain.on).mock.calls.find((c) => c[0] === channel);
  return call?.[1];
}

function getHandle(channel: string): Function | undefined {
  const call = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === channel);
  return call?.[1];
}

describe('ipc', () => {
  let deps: IpcRegisterDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createDeps();
  });

  describe('registerAll', () => {
    test('registers all expected channels', () => {
      registerAll(deps);
      const onChannels = vi.mocked(ipcMain.on).mock.calls.map((c) => c[0]);
      const handleChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);

      expect(onChannels).toContain('get-instances');
      expect(onChannels).toContain('ha-instance');
      expect(onChannels).toContain('reconnect');
      expect(onChannels).toContain('restart');
      expect(onChannels).toContain('start-bonjour');
      expect(onChannels).toContain('ha-notification');
      expect(onChannels).toContain('desktop-command');
      expect(onChannels).toContain('settings-open');

      expect(handleChannels).toContain('get-system-stats');
      expect(handleChannels).toContain('get-active-window');
      expect(handleChannels).toContain('get-media-status');
      expect(handleChannels).toContain('save-settings');
      expect(handleChannels).toContain('test-connection');
      expect(handleChannels).toContain('save-pinned');
      expect(handleChannels).toContain('get-shortcuts');
      expect(handleChannels).toContain('save-shortcut');
      expect(handleChannels).toContain('remove-shortcut');
    });

    test('logs registration confirmation', () => {
      registerAll(deps);
      expect(logger.info).toHaveBeenCalledWith('IPC handlers registered.');
    });
  });

  describe('get-instances', () => {
    test('replies with allInstances from config', () => {
      vi.mocked(config.get).mockReturnValue(['http://ha1.local']);
      const reply = vi.fn();
      registerAll(deps);
      const handler = getHandler('get-instances')!;
      handler({ reply });
      expect(reply).toHaveBeenCalledWith('get-instances', ['http://ha1.local']);
    });

    test('replies with empty array when no instances', () => {
      vi.mocked(config.get).mockReturnValue(undefined);
      const reply = vi.fn();
      registerAll(deps);
      const handler = getHandler('get-instances')!;
      handler({ reply });
      expect(reply).toHaveBeenCalledWith('get-instances', []);
    });
  });

  describe('ha-instance', () => {
    test('calls addInstance when url is provided', () => {
      const reply = vi.fn();
      registerAll(deps);
      const handler = getHandler('ha-instance')!;
      handler({ reply }, 'http://ha.local');
      expect(deps.addInstance).toHaveBeenCalledWith('http://ha.local');
    });

    test('replies with currentInstance when set', () => {
      vi.mocked(deps.currentInstance).mockReturnValue('http://ha.local');
      const reply = vi.fn();
      registerAll(deps);
      const handler = getHandler('ha-instance')!;
      handler({ reply }, 'http://ha.local');
      expect(reply).toHaveBeenCalledWith('ha-instance', 'http://ha.local');
    });

    test('does not reply when currentInstance is false', () => {
      vi.mocked(deps.currentInstance).mockReturnValue(false);
      const reply = vi.fn();
      registerAll(deps);
      const handler = getHandler('ha-instance')!;
      handler({ reply }, '');
      expect(reply).not.toHaveBeenCalled();
    });
  });

  describe('reconnect', () => {
    test('calls reinitMainWindow', async () => {
      registerAll(deps);
      const handler = getHandler('reconnect')!;
      await handler({});
      expect(deps.reinitMainWindow).toHaveBeenCalled();
    });
  });

  describe('restart', () => {
    test('relaunches and exits the app', () => {
      registerAll(deps);
      const handler = getHandler('restart')!;
      handler({});
      expect(app.relaunch).toHaveBeenCalled();
      expect(app.exit).toHaveBeenCalled();
    });
  });

  describe('start-bonjour', () => {
    test('calls bonjour.find with home-assistant type', () => {
      const reply = vi.fn();
      const find = vi.fn();
      registerAll({ ...deps, bonjour: { find } });
      const handler = getHandler('start-bonjour')!;
      handler({ reply });
      expect(find).toHaveBeenCalledWith({ type: 'home-assistant' }, expect.any(Function));
    });

    test('bonjour callback replies with urls', () => {
      const reply = vi.fn();
      const find = vi.fn((_opts: unknown, cb: (instance: any) => void) => {
        cb({ txt: { internal_url: 'http://internal', external_url: 'http://external' } });
      });
      registerAll({ ...deps, bonjour: { find } });
      const handler = getHandler('start-bonjour')!;
      handler({ reply });
      expect(reply).toHaveBeenCalledWith('bonjour-instance', {
        internal_url: 'http://internal',
        external_url: 'http://external',
      });
    });
  });

  describe('ha-notification', () => {
    test('calls showNotification with onClick', () => {
      registerAll(deps);
      const handler = getHandler('ha-notification')!;
      handler({}, { title: 'Alert', message: 'Hello' });
      expect(showNotification).toHaveBeenCalledWith('Alert', 'Hello', expect.any(Function));
    });
  });

  describe('desktop-command', () => {
    test('calls executeCommand with command and payload', () => {
      registerAll(deps);
      const handler = getHandler('desktop-command')!;
      handler({}, { command: 'lock_screen', payload: { extra: 'data' } });
      expect(executeCommand).toHaveBeenCalledWith('lock_screen', { extra: 'data' });
    });
  });

  describe('get-system-stats', () => {
    test('returns SystemMonitor.getStats', async () => {
      registerAll(deps);
      const handler = getHandle('get-system-stats')!;
      const result = await handler({});
      expect(result.cpu_load_percent).toBe(30);
    });
  });

  describe('get-active-window', () => {
    test('returns getActiveWindow', async () => {
      registerAll(deps);
      const handler = getHandle('get-active-window')!;
      const result = await handler({});
      expect(result).toEqual({ process_name: 'test', window_title: 'Test' });
    });
  });

  describe('get-media-status', () => {
    test('returns webcam and microphone status', async () => {
      registerAll(deps);
      const handler = getHandle('get-media-status')!;
      const result = await handler({});
      expect(result).toEqual({ webcam_active: false, microphone_active: false });
    });
  });

  describe('settings-open', () => {
    test('replies with settings-loaded and ha config', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local';
        if (key === 'haToken') return 'token';
        if (key === 'pinnedEntities') return ['light.test'];
        return undefined;
      });
      const reply = vi.fn();
      registerAll(deps);
      const handler = getHandler('settings-open')!;
      handler({ reply });
      expect(reply).toHaveBeenCalledWith('settings-loaded', {
        haBaseUrl: 'http://ha.local',
        haToken: 'token',
        pinnedEntities: ['light.test'],
      });
    });

    test('replies with entities-loaded when cache is non-empty', () => {
      vi.mocked(deps.getCachedEntities).mockReturnValue([{ entity_id: 'light.test', name: 'Test', state: 'on', domain: 'light' }]);
      const reply = vi.fn();
      registerAll(deps);
      const handler = getHandler('settings-open')!;
      handler({ reply });
      expect(reply).toHaveBeenCalledWith('entities-loaded', expect.any(Array));
    });
  });

  describe('save-settings', () => {
    test('returns error when URL is empty', async () => {
      registerAll(deps);
      const handler = getHandle('save-settings')!;
      const result = await handler({}, { haBaseUrl: '', haToken: '' });
      expect(result.ok).toBe(false);
    });

    test('returns error for invalid URL', async () => {
      registerAll(deps);
      const handler = getHandle('save-settings')!;
      const result = await handler({}, { haBaseUrl: 'not-a-url', haToken: 'token' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    test('saves settings and returns entities on success', async () => {
      const mockEntities = [{ entity_id: 'light.test', name: 'Test', state: 'on', domain: 'light' }];
      vi.mocked(haClient.getToggleableEntities).mockResolvedValue(mockEntities);
      registerAll(deps);
      const handler = getHandle('save-settings')!;
      const result = await handler({}, { haBaseUrl: 'http://ha.local:8123/', haToken: 'token' });
      expect(result.ok).toBe(true);
      expect(result.entities).toEqual(mockEntities);
      expect(config.set).toHaveBeenCalledWith('haBaseUrl', 'http://ha.local:8123');
      expect(sensorPusher.start).toHaveBeenCalled();
    });

    test('returns error on haClient failure', async () => {
      vi.mocked(haClient.getToggleableEntities).mockRejectedValue(new Error('Network error'));
      registerAll(deps);
      const handler = getHandle('save-settings')!;
      const result = await handler({}, { haBaseUrl: 'http://ha.local', haToken: 'token' });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('test-connection', () => {
    test('returns ok with count on success', async () => {
      const mockStates = [{ entity_id: 'light.1' }, { entity_id: 'switch.2' }];
      vi.mocked(haClient.getStates).mockResolvedValue(mockStates as any);
      registerAll(deps);
      const handler = getHandle('test-connection')!;
      const result = await handler({}, { haBaseUrl: 'http://ha.local', haToken: 'token' });
      expect(result.ok).toBe(true);
      expect(result.count).toBe(2);
    });

    test('returns ok:false when getStates returns null', async () => {
      vi.mocked(haClient.getStates).mockResolvedValue(null);
      registerAll(deps);
      const handler = getHandle('test-connection')!;
      const result = await handler({}, { haBaseUrl: 'http://ha.local', haToken: 'token' });
      expect(result.ok).toBe(false);
    });

    test('returns error on failure and restores config', async () => {
      vi.mocked(haClient.getStates).mockRejectedValue(new Error('Connection refused'));
      registerAll(deps);
      const handler = getHandle('test-connection')!;
      const result = await handler({}, { haBaseUrl: 'http://ha.local', haToken: 'token' });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('save-pinned', () => {
    test('saves pinned entities', async () => {
      registerAll(deps);
      const handler = getHandle('save-pinned')!;
      const result = await handler({}, ['light.a', 'switch.b']);
      expect(config.set).toHaveBeenCalledWith('pinnedEntities', ['light.a', 'switch.b']);
      expect(result.ok).toBe(true);
    });
  });

  describe('get-shortcuts', () => {
    test('returns shortcuts from shortcutManager.load', async () => {
      vi.mocked(shortcutManager.load).mockReturnValue([{ accelerator: 'Ctrl+Shift+1', entityId: 'light.test', service: 'toggle' }]);
      registerAll(deps);
      const handler = getHandle('get-shortcuts')!;
      const result = await handler({});
      expect(result).toHaveLength(1);
    });
  });

  describe('save-shortcut', () => {
    test('calls shortcutManager.upsert', async () => {
      registerAll(deps);
      const handler = getHandle('save-shortcut')!;
      const result = await handler({}, { accelerator: 'Ctrl+Shift+1', entityId: 'light.test' });
      expect(shortcutManager.upsert).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });

  describe('remove-shortcut', () => {
    test('calls shortcutManager.remove', async () => {
      registerAll(deps);
      const handler = getHandle('remove-shortcut')!;
      const result = await handler({}, 'Ctrl+Shift+1');
      expect(shortcutManager.remove).toHaveBeenCalledWith('Ctrl+Shift+1');
      expect(result.ok).toBe(true);
    });
  });
});
