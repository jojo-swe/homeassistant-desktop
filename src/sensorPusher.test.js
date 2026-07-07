jest.mock('../config', () => {
  const store = {};
  return {
    get: jest.fn((key) => store[key]),
    set: jest.fn((key, val) => {
      store[key] = val;
    }),
    has: jest.fn((key) => key in store),
  };
});

jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('./systemMonitor', () => ({
  getStats: jest.fn(),
}));

jest.mock('./activeWindow', () => ({
  getActiveWindow: jest.fn().mockResolvedValue({ process_name: null, window_title: null }),
  startTracking: jest.fn(),
}));

const config = require('../config');
const sensorPusher = require('./sensorPusher');

global.fetch = jest.fn();

describe('sensorPusher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      config.get.mockImplementation((key) => {
        if (key === 'haBaseUrl') return '';
        if (key === 'haToken') return '';
        return undefined;
      });
      await sensorPusher.pushAllSensors();
      expect(fetch).not.toHaveBeenCalled();
    });

    test('pushAllSensors pushes sensors when HA is configured', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      const SystemMonitor = require('./systemMonitor');
      SystemMonitor.getStats.mockResolvedValue({
        cpu_load_percent: 45.2,
        memory_usage_percent: 60.0,
        idle_time_seconds: 10,
        is_active: true,
        webcam_active: false,
        microphone_active: false,
        battery_percent: null,
        battery_charging: null,
      });
      fetch.mockResolvedValue({ ok: true });

      await sensorPusher.pushAllSensors();
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    test('can be called without init', () => {
      expect(() => sensorPusher.stop()).not.toThrow();
    });
  });
});
