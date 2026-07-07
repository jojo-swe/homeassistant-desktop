import logger from 'electron-log';
import * as haClient from './haClient';
import type { HAEntity } from './types';

let cachedEntities: HAEntity[] = [];

async function refreshEntityCache(): Promise<void> {
  if (!haClient.isConfigured()) return;
  try {
    cachedEntities = await haClient.getToggleableEntities();
    logger.info(`Entity cache refreshed: ${cachedEntities.length} entities.`);
  } catch (err) {
    logger.error('Failed to refresh entity cache:', err);
  }
}

function getCachedEntities(): HAEntity[] {
  return cachedEntities;
}

function setCachedEntities(entities: HAEntity[]): void {
  cachedEntities = entities;
}

export { refreshEntityCache, getCachedEntities, setCachedEntities };
