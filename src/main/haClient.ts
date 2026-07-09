import config from './config';
import logger from 'electron-log';
import type { HAEntity, HAState } from './types';

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

function getSettings(): { baseUrl: string; token: string } {
  const baseUrl = (config.get('haBaseUrl') || '').replace(/\/$/, '');
  const token = config.get('haToken') || '';
  return { baseUrl, token };
}

function isConfigured(): boolean {
  const { baseUrl, token } = getSettings();
  return !!(baseUrl && token);
}

async function fetchHA(
  path: string,
  method: string = 'GET',
  body: Record<string, unknown> | null = null
): Promise<unknown> {
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
    logger.error(`HA fetch failed (${path}): ${(err as Error).message}`);
    return null;
  }
}

async function getStates(): Promise<HAState[] | null> {
  const result = await fetchHA('states');
  return result as HAState[] | null;
}

async function getStatesWithCredentials(baseUrl: string, token: string): Promise<HAState[] | null> {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${cleanUrl}/api/states`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      logger.error(`HA API error: ${res.status} ${res.statusText} → states`);
      return null;
    }
    return (await res.json()) as HAState[];
  } catch (err) {
    logger.error(`HA fetch failed (states): ${(err as Error).message}`);
    return null;
  }
}

async function getToggleableEntities(): Promise<HAEntity[]> {
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

async function toggle(entityId: string): Promise<unknown> {
  const domain = entityId.split('.')[0];
  const result = await fetchHA(`services/${domain}/toggle`, 'POST', { entity_id: entityId });
  if (result !== null) {
    logger.info(`Toggled: ${entityId}`);
  }
  return result;
}

async function getState(entityId: string): Promise<HAState | null> {
  const result = await fetchHA(`states/${entityId}`);
  return result as HAState | null;
}

export { isConfigured, getToggleableEntities, toggle, getState, getStates, getStatesWithCredentials };
