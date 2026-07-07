import { describe, test, expect, beforeEach, vi } from 'vitest';

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

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../main/systemMonitor', () => ({
  default: {
    getStats: vi.fn(),
  },
}));

vi.mock('../../main/activeWindow', () => ({
  getActiveWindow: vi.fn().mockResolvedValue({ process_name: null, window_title: null }),
  startTracking: vi.fn(),
}));

import config from '../../main/config';
import logger from 'electron-log';
import * as sensorPusher from '../../main/sensorPusher';
import SystemMonitor from '../../main/systemMonitor';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

describe('sensorPusher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ENTITY_IDS', () => {
    test('contains all expected sensor keys', () => {
      expect(sensorPusher.ENTITY_IDS).toHaveProperty('cpu');
      expect(sensorPusher.ENTITY_IDS).toHaveProperty('memory');
      expect(sensorPusher.ENTITY_IDS).toHaveProperty('battery');
      expect(sensorPusher.ENTITY_IDS).toHaveProperty('activeWindow');
      expect(sensorPusher.ENTITY_IDS).toHaveProperty('webcam');
      expect(sensorPusher.ENTITY_IDS).toHaveProperty('microphone');
      expect(sensorPusher.ENTITY_IDS).toHaveProperty('userActive');
    });

    test('entity IDs include hostname', () => {
      const hostname = require('os')
        .hostname()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      expect(sensorPusher.ENTITY_IDS.cpu).toContain(hostname);
    });
  });

  describe('isReady (via pushAllSensors behavior)', () => {
    test('pushAllSensors does nothing when HA not configured', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return '';
        if (key === 'haToken') return '';
        return undefined;
      });
      await sensorPusher.pushAllSensors();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('pushAllSensors pushes sensors when HA is configured', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: false,
        microphone_active: false,
        battery_percent: null,
        battery_charging: null,
        hostname: 'test',
        platform: 'linux',
      });
      fetchMock.mockResolvedValue({ ok: true });

      await sensorPusher.pushAllSensors();
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    test('can be called without init', () => {
      expect(() => sensorPusher.stop()).not.toThrow();
    });
  });

  describe('init', () => {
    test('skips init when HA not configured', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return '';
        if (key === 'haToken') return '';
        return undefined;
      });
      sensorPusher.init(30_000);
      expect(fetchMock).not.toHaveBeenCalled();
      sensorPusher.stop();
    });

    test('initializes and pushes sensors when HA is configured', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: false,
        microphone_active: false,
        battery_percent: null,
        battery_charging: null,
        hostname: 'test',
        platform: 'linux',
      });
      fetchMock.mockResolvedValue({ ok: true });
      sensorPusher.init(30_000);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      sensorPusher.stop();
    });

    test('does not re-initialize if already initialized', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: false,
        microphone_active: false,
        battery_percent: null,
        battery_charging: null,
        hostname: 'test',
        platform: 'linux',
      });
      fetchMock.mockResolvedValue({ ok: true });
      sensorPusher.init(30_000);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const callCount = fetchMock.mock.calls.length;
      sensorPusher.init(30_000);
      expect(fetchMock.mock.calls.length).toBe(callCount);
      sensorPusher.stop();
    });
  });

  describe('start', () => {
    test('calls init when not initialized', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: false,
        microphone_active: false,
        battery_percent: null,
        battery_charging: null,
        hostname: 'test',
        platform: 'linux',
      });
      fetchMock.mockResolvedValue({ ok: true });
      sensorPusher.start(30_000);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      sensorPusher.stop();
    });

    test('starts sensors when initialized but no interval running', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: false,
        microphone_active: false,
        battery_percent: null,
        battery_charging: null,
        hostname: 'test',
        platform: 'linux',
      });
      fetchMock.mockResolvedValue({ ok: true });
      sensorPusher.init(30_000);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      sensorPusher.stop();
      sensorPusher.start(30_000);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      sensorPusher.stop();
    });
  });

  describe('pushAllSensors with battery', () => {
    test('pushes battery sensor when battery_percent is not null', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: true,
        microphone_active: true,
        battery_percent: 75,
        battery_charging: true,
        hostname: 'test',
        platform: 'linux',
      });
      fetchMock.mockResolvedValue({ ok: true });

      await sensorPusher.pushAllSensors();
      expect(fetchMock).toHaveBeenCalled();
      const batteryCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('battery'),
      );
      expect(batteryCall).toBeDefined();
    });
  });

  describe('pushAllSensors error handling', () => {
    test('logs error on SystemMonitor failure', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockRejectedValue(new Error('monitor failed'));
      await sensorPusher.pushAllSensors();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('pushState retry', () => {
    test('retries on non-ok response', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: false,
        microphone_active: false,
        battery_percent: null,
        battery_charging: null,
        hostname: 'test',
        platform: 'linux',
      });
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true });

      await sensorPusher.pushAllSensors();
      expect(fetchMock.mock.calls.length).toBeGreaterThan(5);
    });

    test('catches fetch errors gracefully', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      vi.mocked(SystemMonitor.getStats).mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: false,
        microphone_active: false,
        battery_percent: null,
        battery_charging: null,
        hostname: 'test',
        platform: 'linux',
      });
      fetchMock.mockRejectedValue(new Error('network error'));

      await sensorPusher.pushAllSensors();
      await vi.waitFor(() => expect(logger.debug).toHaveBeenCalled());
    });
  });
});
