import os from 'os';
import logger from 'electron-log';
import config from './config';
import SystemMonitor from './systemMonitor';
import { getActiveWindow, startTracking } from './activeWindow';
import type { ActiveWindowInfo, EntityAttributes, SystemStats } from './types';

const HOSTNAME = os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_');

const ENTITY_IDS = {
  cpu: `sensor.desktop_${HOSTNAME}_cpu_load`,
  memory: `sensor.desktop_${HOSTNAME}_memory_usage`,
  battery: `sensor.desktop_${HOSTNAME}_battery`,
  activeWindow: `sensor.desktop_${HOSTNAME}_active_window`,
  webcam: `binary_sensor.desktop_${HOSTNAME}_webcam`,
  microphone: `binary_sensor.desktop_${HOSTNAME}_microphone`,
  userActive: `binary_sensor.desktop_${HOSTNAME}_active`,
} as const;

let _periodicInterval: NodeJS.Timeout | null = null;
let _initialized = false;

function getBaseUrl(): string {
  return (config.get('haBaseUrl') || '').replace(/\/$/, '');
}
function getToken(): string {
  return config.get('haToken') || '';
}
function isReady(): boolean {
  return !!(getBaseUrl() && getToken());
}

async function pushState(entityId: string, state: string | number, attributes: EntityAttributes = {}): Promise<void> {
  if (!isReady()) return;

  const doPush = async (): Promise<boolean> => {
    const res = await fetch(`${getBaseUrl()}/api/states/${entityId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state, attributes }),
    });
    if (!res.ok) {
      logger.warn(`Sensor push failed for ${entityId}: ${res.status}`);
      return false;
    }
    return true;
  };

  try {
    const ok = await doPush();
    if (!ok) {
      await new Promise((r) => setTimeout(r, 2000));
      await doPush();
    }
  } catch (err) {
    logger.debug(`Sensor push error (${entityId}): ${(err as Error).message}`);
  }
}

async function pushAllSensors(): Promise<void> {
  if (!isReady()) return;

  try {
    const stats: SystemStats = await SystemMonitor.getStats();

    await pushState(ENTITY_IDS.cpu, stats.cpu_load_percent ?? 'unavailable', {
      friendly_name: 'Desktop CPU Load',
      unit_of_measurement: '%',
      icon: 'mdi:cpu-64-bit',
      device_class: null,
    });

    await pushState(ENTITY_IDS.memory, stats.memory_usage_percent ?? 'unavailable', {
      friendly_name: 'Desktop Memory Usage',
      unit_of_measurement: '%',
      icon: 'mdi:memory',
    });

    if (stats.battery_percent !== null) {
      await pushState(ENTITY_IDS.battery, stats.battery_percent, {
        friendly_name: 'Desktop Battery',
        unit_of_measurement: '%',
        device_class: 'battery',
        charging: stats.battery_charging,
        icon: stats.battery_charging ? 'mdi:battery-charging' : 'mdi:battery',
      });
    }

    await pushState(ENTITY_IDS.userActive, stats.is_active ? 'on' : 'off', {
      friendly_name: 'Desktop User Active',
      device_class: 'occupancy',
      idle_seconds: stats.idle_time_seconds,
    });

    await pushState(ENTITY_IDS.webcam, stats.webcam_active ? 'on' : 'off', {
      friendly_name: 'Desktop Webcam Active',
      device_class: 'running',
      icon: 'mdi:webcam',
    });

    await pushState(ENTITY_IDS.microphone, stats.microphone_active ? 'on' : 'off', {
      friendly_name: 'Desktop Microphone Active',
      device_class: 'sound',
      icon: 'mdi:microphone',
    });

    logger.debug('Periodic sensor push complete.');
  } catch (err) {
    logger.error('Sensor push cycle failed:', (err as Error).message);
  }
}

async function pushActiveWindow(windowInfo: ActiveWindowInfo): Promise<void> {
  await pushState(ENTITY_IDS.activeWindow, windowInfo.process_name || 'unknown', {
    friendly_name: 'Desktop Active Window',
    window_title: windowInfo.window_title || '',
    icon: 'mdi:application',
  });
}

function init(intervalMs: number = 30_000): void {
  if (_initialized) return;
  _initialized = true;

  if (!isReady()) {
    logger.info('SensorPusher: HA not configured — skipping init.');
    return;
  }

  _startSensors(intervalMs);
}

function _startSensors(intervalMs: number): void {
  logger.info(`SensorPusher: initialising (push every ${intervalMs / 1000}s)`);

  pushAllSensors();

  if (_periodicInterval) clearInterval(_periodicInterval);
  _periodicInterval = setInterval(pushAllSensors, intervalMs);

  if (process.platform === 'win32') {
    startTracking(async (windowInfo) => {
      await pushActiveWindow(windowInfo);
    }, 3000);
  } else {
    getActiveWindow().then(pushActiveWindow).catch(() => {});
  }
}

function start(intervalMs: number = 30_000): void {
  if (!_initialized) {
    init(intervalMs);
    return;
  }
  if (isReady() && !_periodicInterval) {
    _startSensors(intervalMs);
  }
}

function stop(): void {
  if (_periodicInterval) {
    clearInterval(_periodicInterval);
    _periodicInterval = null;
  }
  _initialized = false;
}

export { init, start, stop, pushAllSensors, ENTITY_IDS };
