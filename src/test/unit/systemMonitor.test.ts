import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => ({
  powerMonitor: {
    getSystemIdleTime: vi.fn(() => 42),
  },
}));

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('systeminformation', () => ({
  default: {
    currentLoad: vi.fn().mockResolvedValue({ currentLoad: 55.123 }),
    battery: vi.fn().mockResolvedValue({ hasBattery: true, percent: 80, isCharging: true }),
  },
}));

import os from 'os';
import { powerMonitor } from 'electron';
import si from 'systeminformation';
import { execFile } from 'child_process';
import SystemMonitor from '../../main/systemMonitor';

describe('systemMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStats', () => {
    test('returns all system stats on win32', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.mocked(execFile).mockImplementation(((_cmd: string, _args: string[], _opts: unknown, cb: any) => {
        cb(null, 'True|False', '');
        return undefined as any;
      }) as any);

      const stats = await SystemMonitor.getStats();

      expect(stats.cpu_load_percent).toBe(55.12);
      expect(stats.idle_time_seconds).toBe(42);
      expect(stats.is_active).toBe(true);
      expect(stats.webcam_active).toBe(true);
      expect(stats.microphone_active).toBe(false);
      expect(stats.battery_percent).toBe(80);
      expect(stats.battery_charging).toBe(true);
      expect(stats.hostname).toBe(os.hostname());
      expect(stats.platform).toBe('win32');

      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('returns nulls for media devices on non-win32', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const stats = await SystemMonitor.getStats();

      expect(stats.webcam_active).toBe(false);
      expect(stats.microphone_active).toBe(false);

      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('handles cpu load failure gracefully', async () => {
      vi.mocked(si.currentLoad).mockRejectedValueOnce(new Error('not supported'));
      vi.mocked(si.battery).mockResolvedValue({ hasBattery: false, percent: 0, isCharging: false } as any);

      const stats = await SystemMonitor.getStats();

      expect(stats.cpu_load_percent).toBeNull();
      expect(stats.battery_percent).toBeNull();
      expect(stats.battery_charging).toBeNull();
    });

    test('handles battery failure gracefully', async () => {
      vi.mocked(si.currentLoad).mockResolvedValue({ currentLoad: 10 } as any);
      vi.mocked(si.battery).mockRejectedValueOnce(new Error('no battery'));

      const stats = await SystemMonitor.getStats();

      expect(stats.battery_percent).toBeNull();
      expect(stats.battery_charging).toBeNull();
    });

    test('handles execFile error for media status', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.mocked(execFile).mockImplementation(((_cmd: string, _args: string[], _opts: unknown, cb: any) => {
        cb(new Error('powershell failed'), '', '');
        return undefined as any;
      }) as any);

      const stats = await SystemMonitor.getStats();

      expect(stats.webcam_active).toBe(false);
      expect(stats.microphone_active).toBe(false);

      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('is_active is true when idle time < 300', async () => {
      vi.mocked(powerMonitor.getSystemIdleTime).mockReturnValue(100);
      const stats = await SystemMonitor.getStats();
      expect(stats.is_active).toBe(true);
    });

    test('computes memory usage percentage', async () => {
      const stats = await SystemMonitor.getStats();
      expect(stats.memory_usage_percent).toBeGreaterThanOrEqual(0);
      expect(stats.memory_usage_percent).toBeLessThanOrEqual(100);
    });
  });
});
