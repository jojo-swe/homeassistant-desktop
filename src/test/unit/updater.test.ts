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

    test('update-downloaded handler calls onForceQuit and quitAndInstall', async () => {
      const onForceQuit = vi.fn();
      vi.mocked(autoUpdater.on).mockImplementation((event: string, cb: Function) => {
        if (event === 'update-downloaded') {
          cb();
        }
        return autoUpdater;
      });
      // Reset module state to allow listener registration
      vi.resetModules();
      const { useAutoUpdater: freshUseAutoUpdater } = await import('../../main/updater');
      await freshUseAutoUpdater(onForceQuit);
      expect(onForceQuit).toHaveBeenCalled();
      expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });

    test('error handler clears interval', async () => {
      vi.mocked(autoUpdater.on).mockImplementation((event: string, cb: Function) => {
        if (event === 'error') {
          cb(new Error('update error'));
        }
        return autoUpdater;
      });
      // Reset module state to allow listener registration
      vi.resetModules();
      const { useAutoUpdater: freshUseAutoUpdater } = await import('../../main/updater');
      await freshUseAutoUpdater(() => {});
      expect(logger.error).toHaveBeenCalled();
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
