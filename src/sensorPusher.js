/**
 * src/sensorPusher.js
 *
 * Pushes desktop sensor states directly to Home Assistant via its REST API.
 * Sensors auto-appear in HA's developer tools → States without any configuration.
 *
 * Sensors registered:
 *   sensor.desktop_cpu_load         — CPU load %
 *   sensor.desktop_memory_usage     — RAM used %
 *   sensor.desktop_battery          — Battery % (if present)
 *   sensor.desktop_active_window    — Foreground app process name
 *   binary_sensor.desktop_webcam    — Webcam in use
 *   binary_sensor.desktop_microphone — Microphone in use
 *   binary_sensor.desktop_active    — User is active (not idle > 5 min)
 */

const logger = require('electron-log');
const config = require('../config');
const SystemMonitor = require('./systemMonitor');
const { getActiveWindow, startTracking } = require('./activeWindow');

const HOSTNAME = require('os').hostname().toLowerCase().replace(/[^a-z0-9]/g, '_');

// Entity IDs keyed on context
const ENTITY_IDS = {
  cpu:            `sensor.desktop_${HOSTNAME}_cpu_load`,
  memory:         `sensor.desktop_${HOSTNAME}_memory_usage`,
  battery:        `sensor.desktop_${HOSTNAME}_battery`,
  activeWindow:   `sensor.desktop_${HOSTNAME}_active_window`,
  webcam:         `binary_sensor.desktop_${HOSTNAME}_webcam`,
  microphone:     `binary_sensor.desktop_${HOSTNAME}_microphone`,
  userActive:     `binary_sensor.desktop_${HOSTNAME}_active`,
};

let _periodicInterval = null;
let _initialized = false;

function getBaseUrl() { return (config.get('haBaseUrl') || '').replace(/\/$/, ''); }
function getToken()   { return config.get('haToken') || ''; }
function isReady()    { return !!(getBaseUrl() && getToken()); }

async function pushState(entityId, state, attributes = {}) {
  if (!isReady()) return;
  try {
    const res = await fetch(`${getBaseUrl()}/api/states/${entityId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state, attributes }),
    });
    if (!res.ok) {
      logger.warn(`Sensor push failed for ${entityId}: ${res.status}`);
    }
  } catch (err) {
    logger.debug(`Sensor push error (${entityId}): ${err.message}`);
  }
}

async function pushAllSensors() {
  if (!isReady()) return;

  try {
    const stats = await SystemMonitor.getStats();

    // CPU & memory
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

    // Battery (only push if device has a battery)
    if (stats.battery_percent !== null) {
      await pushState(ENTITY_IDS.battery, stats.battery_percent, {
        friendly_name: 'Desktop Battery',
        unit_of_measurement: '%',
        device_class: 'battery',
        charging: stats.battery_charging,
        icon: stats.battery_charging ? 'mdi:battery-charging' : 'mdi:battery',
      });
    }

    // User active / idle
    await pushState(ENTITY_IDS.userActive, stats.is_active ? 'on' : 'off', {
      friendly_name: 'Desktop User Active',
      device_class: 'occupancy',
      idle_seconds: stats.idle_time_seconds,
    });

    // Webcam & Mic
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
    logger.error('Sensor push cycle failed:', err.message);
  }
}

async function pushActiveWindow(windowInfo) {
  await pushState(ENTITY_IDS.activeWindow, windowInfo.process_name || 'unknown', {
    friendly_name: 'Desktop Active Window',
    window_title: windowInfo.window_title || '',
    icon: 'mdi:application',
  });
}

/**
 * Start the sensor push platform.
 * - Pushes all sensors immediately and then every `intervalMs`.
 * - Hooks into the active window tracker for real-time window changes.
 */
function init(intervalMs = 30_000) {
  if (_initialized) return;
  _initialized = true;

  if (!isReady()) {
    logger.info('SensorPusher: HA not configured — skipping init.');
    return;
  }

  logger.info(`SensorPusher: initialising (push every ${intervalMs / 1000}s)`);

  // Initial push
  pushAllSensors();

  // Periodic push
  _periodicInterval = setInterval(pushAllSensors, intervalMs);

  // Hook active window tracker — push on each change (Windows only)
  if (process.platform === 'win32') {
    startTracking(async (windowInfo) => {
      await pushActiveWindow(windowInfo);
    }, 3000);
  } else {
    // Push once on non-Windows to register the entity
    getActiveWindow().then(pushActiveWindow).catch(() => {});
  }
}

function stop() {
  if (_periodicInterval) {
    clearInterval(_periodicInterval);
    _periodicInterval = null;
  }
  _initialized = false;
}

module.exports = { init, stop, pushAllSensors, ENTITY_IDS };
