import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../main/config', () => ({
  default: { get: vi.fn() },
}));

import { shell } from 'electron';
import logger from 'electron-log';
import config from '../../main/config';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  APP_PAGES_DIR,
  isHttpUrl,
  isInstanceAuthUrl,
  isInstanceUrl,
  isLocalAppUrl,
  openExternalSafe,
} from '../../main/urlSafety';

describe('urlSafety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(config.get).mockReturnValue(['http://homeassistant.local:8123', 'https://ha.example.com']);
  });

  describe('isHttpUrl', () => {
    test.each(['http://ha.local:8123', 'https://ha.example.com/lovelace'])('accepts %s', (url) => {
      expect(isHttpUrl(url)).toBe(true);
    });

    test.each(['javascript:alert(1)', 'file:///etc/passwd', 'smb://host/share', 'not a url', '', 42, null])(
      'rejects %s',
      (url) => {
        expect(isHttpUrl(url)).toBe(false);
      }
    );
  });

  describe('isLocalAppUrl', () => {
    const page = (...parts: string[]) => pathToFileURL(path.join(APP_PAGES_DIR, ...parts)).href;

    test('accepts bundled renderer pages', () => {
      expect(isLocalAppUrl(page('index.html'))).toBe(true);
      expect(isLocalAppUrl(page('settings', 'index.html'))).toBe(true);
      expect(isLocalAppUrl(page('error', 'index.html') + '?x=1#y')).toBe(true);
    });

    test('rejects other files on disk, including path tricks', () => {
      expect(isLocalAppUrl('file:///tmp/evil.html')).toBe(false);
      expect(isLocalAppUrl(pathToFileURL(path.join(APP_PAGES_DIR, '..', 'evil.html')).href)).toBe(false);
      expect(isLocalAppUrl(pathToFileURL(APP_PAGES_DIR + '-evil/index.html').href)).toBe(false);
      expect(isLocalAppUrl(pathToFileURL(APP_PAGES_DIR).href)).toBe(false);
    });

    test('rejects web pages', () => {
      expect(isLocalAppUrl('https://evil.example/')).toBe(false);
      expect(isLocalAppUrl('')).toBe(false);
    });
  });

  describe('isInstanceAuthUrl', () => {
    test('matches login pages on a configured instance only', () => {
      expect(isInstanceAuthUrl('http://homeassistant.local:8123/auth/authorize?client_id=x')).toBe(true);
      expect(isInstanceAuthUrl('http://homeassistant.local:8123/lovelace/0')).toBe(false);
      expect(isInstanceAuthUrl('https://evil.example/auth/authorize')).toBe(false);
    });
  });

  describe('isInstanceUrl', () => {
    test('matches any path on a configured instance origin', () => {
      expect(isInstanceUrl('http://homeassistant.local:8123/config/dashboard')).toBe(true);
      expect(isInstanceUrl('https://ha.example.com/auth/authorize?x=1')).toBe(true);
    });

    test('does not match a different port, scheme or host', () => {
      expect(isInstanceUrl('http://homeassistant.local:9999/')).toBe(false);
      expect(isInstanceUrl('http://ha.example.com/')).toBe(false);
      expect(isInstanceUrl('https://ha.example.com.evil.example/')).toBe(false);
    });

    test('is false when no instances are configured', () => {
      vi.mocked(config.get).mockReturnValue(undefined);
      expect(isInstanceUrl('http://homeassistant.local:8123/')).toBe(false);
    });
  });

  describe('openExternalSafe', () => {
    test.each(['https://github.com/jojo-swe', 'http://ha.local:8123', 'mailto:someone@example.com'])(
      'opens %s',
      async (url) => {
        await openExternalSafe(url);
        expect(shell.openExternal).toHaveBeenCalledWith(url);
      }
    );

    test.each(['smb://attacker/share', 'file:///C:/Windows/System32/calc.exe', 'search-ms:query=x', 'garbage'])(
      'refuses %s',
      async (url) => {
        await openExternalSafe(url);
        expect(shell.openExternal).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
      }
    );
  });
});
