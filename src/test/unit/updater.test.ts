import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: null,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../main/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('../../main/config', () => {
  const store: Record<string, unknown> = { autoUpdate: true };
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

import { autoUpdater } from 'electron-updater';
import logger from 'electron-log';
import config from '../../main/config';
import { useAutoUpdater, checkForUpdates, clearUpdateInterval, getUpdateCheckerInterval } from '../../main/updater';

describe('updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearUpdateInterval();
    vi.mocked(config.get).mockReturnValue(true);
  });

  describe('checkForUpdates', () => {
    test('calls autoUpdater.checkForUpdates', async () => {
      await checkForUpdates();
      expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    test('logs error on failure', async () => {
      vi.mocked(autoUpdater.checkForUpdates).mockRejectedValueOnce(new Error('network'));
      await checkForUpdates();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('useAutoUpdater', () => {
    test('registers event handlers and starts interval', async () => {
      vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(undefined as any);
      await useAutoUpdater(() => {});
      expect(autoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
      expect(getUpdateCheckerInterval()).not.toBeNull();
    });

    test('does not create duplicate interval', async () => {
      await useAutoUpdater(() => {});
      const first = getUpdateCheckerInterval();
      await useAutoUpdater(() => {});
      expect(getUpdateCheckerInterval()).toBe(first);
    });

    test('does not start interval when autoUpdate is false', async () => {
      clearUpdateInterval();
      vi.mocked(config.get).mockReturnValue(false);
      await useAutoUpdater(() => {});
      expect(getUpdateCheckerInterval()).toBeNull();
    });

    test('update-downloaded notifies instead of restarting, and restarts only on click', async () => {
      const onForceQuit = vi.fn();
      vi.mocked(autoUpdater.on).mockImplementation((event: string, cb: Function) => {
        if (event === 'update-downloaded') {
          cb({ version: '2.0.1' });
        }
        return autoUpdater;
      });
      // Reset module state to allow listener registration
      vi.resetModules();
      const fresh = await import('../../main/updater');
      const { showNotification: freshShowNotification } = await import('../../main/notifications');
      await fresh.useAutoUpdater(onForceQuit);
      fresh.clearUpdateInterval();

      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
      expect(freshShowNotification).toHaveBeenCalledWith(
        'Update ready',
        expect.stringContaining('2.0.1'),
        expect.any(Function)
      );

      const onClick = vi.mocked(freshShowNotification).mock.calls[0][2]!;
      onClick();
      expect(onForceQuit).toHaveBeenCalled();
      expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });

    test('error handler logs but keeps the check schedule', async () => {
      vi.mocked(autoUpdater.on).mockImplementation((event: string, cb: Function) => {
        if (event === 'error') {
          cb(new Error('update error'));
        }
        return autoUpdater;
      });
      // Reset module state to allow listener registration
      vi.resetModules();
      const fresh = await import('../../main/updater');
      await fresh.useAutoUpdater(() => {});
      expect(logger.error).toHaveBeenCalled();
      expect(fresh.getUpdateCheckerInterval()).not.toBeNull();
      fresh.clearUpdateInterval();
    });

    test('a failed check does not stop future checks', async () => {
      vi.mocked(autoUpdater.checkForUpdates).mockRejectedValueOnce(new Error('offline'));
      await useAutoUpdater(() => {});
      expect(logger.error).toHaveBeenCalled();
      expect(getUpdateCheckerInterval()).not.toBeNull();
    });

    test('does not check for updates when autoUpdate is disabled', async () => {
      vi.mocked(config.get).mockReturnValue(false);
      await useAutoUpdater(() => {});
      await checkForUpdates();
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    });
  });

  describe('clearUpdateInterval', () => {
    test('clears the interval when set', async () => {
      vi.mocked(config.get).mockReturnValue(true);
      await useAutoUpdater(() => {});
      expect(getUpdateCheckerInterval()).not.toBeNull();
      clearUpdateInterval();
      expect(getUpdateCheckerInterval()).toBeNull();
    });

    test('is safe to call when no interval exists', () => {
      clearUpdateInterval();
      expect(getUpdateCheckerInterval()).toBeNull();
    });
  });
});
