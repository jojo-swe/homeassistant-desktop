const config = require('../config');
const logger = require('electron-log');

const TOGGLEABLE_DOMAINS = new Set([
  'light',
  'switch',
  'input_boolean',
  'fan',
  'cover',
  'lock',
  'automation',
  'script',
]);

function getSettings() {
  const baseUrl = (config.get('haBaseUrl') || '').replace(/\/$/, '');
  const token = config.get('haToken') || '';
  return { baseUrl, token };
}

function isConfigured() {
  const { baseUrl, token } = getSettings();
  return !!(baseUrl && token);
}

async function fetchHA(path, method = 'GET', body = null) {
  const { baseUrl, token } = getSettings();
  if (!baseUrl || !token) {
    logger.warn('HA client not configured — skipping API call.');
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}/api/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      logger.error(`HA API error: ${res.status} ${res.statusText} → ${path}`);
      return null;
    }
    return res.json();
  } catch (err) {
    logger.error(`HA fetch failed (${path}):`, err.message);
    return null;
  }
}

/** Returns all entity states from HA */
async function getStates() {
  return fetchHA('states');
}

/** Returns only toggleable entities (lights, switches, etc.) */
async function getToggleableEntities() {
  const states = await getStates();
  if (!states) return [];
  return states
    .filter((s) => TOGGLEABLE_DOMAINS.has(s.entity_id.split('.')[0]))
    .map((s) => ({
      entity_id: s.entity_id,
      name: s.attributes?.friendly_name || s.entity_id,
      state: s.state,
      domain: s.entity_id.split('.')[0],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Toggles a given entity */
async function toggle(entityId) {
  const domain = entityId.split('.')[0];
  const result = await fetchHA(`services/${domain}/toggle`, 'POST', { entity_id: entityId });
  if (result !== null) {
    logger.info(`Toggled: ${entityId}`);
  }
  return result;
}

/** Gets the state of a single entity */
async function getState(entityId) {
  return fetchHA(`states/${entityId}`);
}

module.exports = { isConfigured, getToggleableEntities, toggle, getState, getStates };
