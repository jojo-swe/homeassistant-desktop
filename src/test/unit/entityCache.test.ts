import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../main/haClient', () => ({
  isConfigured: vi.fn(),
  getToggleableEntities: vi.fn(),
}));

import logger from 'electron-log';
import * as haClient from '../../main/haClient';
import { refreshEntityCache, getCachedEntities, setCachedEntities } from '../../main/entityCache';
import type { HAEntity } from '../../main/types';

describe('entityCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCachedEntities([]);
  });

  test('getCachedEntities returns empty array by default', () => {
    expect(getCachedEntities()).toEqual([]);
  });

  test('setCachedEntities sets the cache', () => {
    const entities: HAEntity[] = [
      { entity_id: 'light.test', name: 'Test Light', state: 'on', domain: 'light' },
    ];
    setCachedEntities(entities);
    expect(getCachedEntities()).toEqual(entities);
  });

  test('refreshEntityCache does nothing when HA not configured', async () => {
    vi.mocked(haClient.isConfigured).mockReturnValue(false);
    await refreshEntityCache();
    expect(haClient.getToggleableEntities).not.toHaveBeenCalled();
  });

  test('refreshEntityCache fetches and caches entities when configured', async () => {
    const entities: HAEntity[] = [
      { entity_id: 'light.living', name: 'Living Room', state: 'off', domain: 'light' },
      { entity_id: 'switch.kitchen', name: 'Kitchen', state: 'on', domain: 'switch' },
    ];
    vi.mocked(haClient.isConfigured).mockReturnValue(true);
    vi.mocked(haClient.getToggleableEntities).mockResolvedValue(entities);
    await refreshEntityCache();
    expect(getCachedEntities()).toEqual(entities);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('2 entities'));
  });

  test('refreshEntityCache logs error on failure', async () => {
    vi.mocked(haClient.isConfigured).mockReturnValue(true);
    vi.mocked(haClient.getToggleableEntities).mockRejectedValue(new Error('network error'));
    await refreshEntityCache();
    expect(logger.error).toHaveBeenCalledWith('Failed to refresh entity cache:', expect.any(Error));
  });
});
