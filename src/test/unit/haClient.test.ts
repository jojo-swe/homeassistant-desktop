import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { Shortcut } from '../../main/types';

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

import config from '../../main/config';
import * as haClient from '../../main/haClient';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

describe('haClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(config.get).mockImplementation((key: string) => {
      if (key === 'haBaseUrl') return 'http://ha.local:8123';
      if (key === 'haToken') return 'test-token';
      return undefined;
    });
  });

  describe('isConfigured', () => {
    test('returns true when both baseUrl and token are set', () => {
      expect(haClient.isConfigured()).toBe(true);
    });

    test('returns false when baseUrl is empty', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return '';
        if (key === 'haToken') return 'test-token';
        return undefined;
      });
      expect(haClient.isConfigured()).toBe(false);
    });

    test('returns false when token is empty', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local:8123';
        if (key === 'haToken') return '';
        return undefined;
      });
      expect(haClient.isConfigured()).toBe(false);
    });
  });

  describe('getStates', () => {
    test('calls fetch with correct URL and headers', async () => {
      const mockStates = [{ entity_id: 'light.living_room', state: 'on' }];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStates,
      });

      const result = await haClient.getStates();
      expect(result).toEqual(mockStates);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://ha.local:8123/api/states',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    test('returns null on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
      const result = await haClient.getStates();
      expect(result).toBeNull();
    });

    test('returns null on fetch error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
      const result = await haClient.getStates();
      expect(result).toBeNull();
    });
  });

  describe('getToggleableEntities', () => {
    test('filters to toggleable domains and maps fields', async () => {
      const mockStates = [
        { entity_id: 'light.living_room', state: 'on', attributes: { friendly_name: 'Living Room Light' } },
        { entity_id: 'switch.kitchen', state: 'off', attributes: { friendly_name: 'Kitchen Switch' } },
        { entity_id: 'sensor.temperature', state: '21.5', attributes: {} },
        { entity_id: 'script.welcome', state: 'off', attributes: { friendly_name: 'Welcome Script' } },
      ];
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockStates });

      const result = await haClient.getToggleableEntities();
      expect(result).toHaveLength(3);
      expect(result.find((e) => e.entity_id === 'light.living_room')).toEqual({
        entity_id: 'light.living_room',
        name: 'Living Room Light',
        state: 'on',
        domain: 'light',
      });
      expect(result.map((e) => e.entity_id)).not.toContain('sensor.temperature');
    });

    test('returns empty array when getStates returns null', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });
      const result = await haClient.getToggleableEntities();
      expect(result).toEqual([]);
    });

    test('uses entity_id as name when friendly_name is missing', async () => {
      const mockStates = [{ entity_id: 'switch.outlet', state: 'off', attributes: {} }];
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockStates });
      const result = await haClient.getToggleableEntities();
      expect(result[0].name).toBe('switch.outlet');
    });
  });

  describe('toggle', () => {
    test('calls the correct service endpoint', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ ok: true }] });
      await haClient.toggle('light.living_room');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://ha.local:8123/api/services/light/toggle',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ entity_id: 'light.living_room' }),
        }),
      );
    });
  });

  describe('getState', () => {
    test('calls the states endpoint for a single entity', async () => {
      const mockState = { entity_id: 'light.living_room', state: 'on' };
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockState });
      const result = await haClient.getState('light.living_room');
      expect(result).toEqual(mockState);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://ha.local:8123/api/states/light.living_room',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });
});
