import { describe, test, expect, vi } from 'vitest';

vi.mock('electron-store', () => {
  const store: Record<string, unknown> = {
    autoUpdate: true,
    automaticSwitching: true,
    detachedMode: false,
    disableHover: false,
    stayOnTop: false,
    fullScreen: false,
    shortcutEnabled: false,
    allInstances: [],
    haBaseUrl: '',
    haToken: '',
    pinnedEntities: [],
    shortcuts: [],
  };
  return {
    default: class MockStore {
      get = vi.fn((key: string) => store[key]);
      set = vi.fn((key: string, val: unknown) => {
        store[key] = val;
      });
      has = vi.fn((key: string) => key in store);
      delete = vi.fn((key: string) => {
        delete store[key];
      });
      clear = vi.fn(() => {
        for (const key of Object.keys(store)) delete store[key];
      });
    },
  };
});

import config from '../../main/config';

describe('config', () => {
  test('returns default values for known keys', () => {
    expect(config.get('autoUpdate')).toBe(true);
    expect(config.get('automaticSwitching')).toBe(true);
    expect(config.get('detachedMode')).toBe(false);
    expect(config.get('disableHover')).toBe(false);
    expect(config.get('stayOnTop')).toBe(false);
    expect(config.get('fullScreen')).toBe(false);
    expect(config.get('shortcutEnabled')).toBe(false);
    expect(config.get('allInstances')).toEqual([]);
    expect(config.get('haBaseUrl')).toBe('');
    expect(config.get('haToken')).toBe('');
    expect(config.get('pinnedEntities')).toEqual([]);
    expect(config.get('shortcuts')).toEqual([]);
  });

  test('set and get round-trips a value', () => {
    config.set('haBaseUrl', 'http://localhost:8123');
    expect(config.get('haBaseUrl')).toBe('http://localhost:8123');
  });

  test('has() returns true for set keys', () => {
    config.set('haToken', 'abc');
    expect(config.has('haToken')).toBe(true);
  });

  test('has() returns false for unset keys', () => {
    expect(config.has('nonexistent_key_xyz')).toBe(false);
  });

  test('delete removes a key', () => {
    config.set('haBaseUrl', 'http://test');
    config.delete('haBaseUrl');
    expect(config.has('haBaseUrl')).toBe(false);
  });
});
