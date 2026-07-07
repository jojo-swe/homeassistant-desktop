import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { execFile } from 'child_process';
import { getActiveWindow, startTracking, stopTracking } from '../../main/activeWindow';

describe('activeWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveWindow', () => {
    test('returns nulls on non-win32 platform', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      const result = await getActiveWindow();
      expect(result).toEqual({ process_name: null, window_title: null });
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('parses powershell output correctly on win32', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.mocked(execFile).mockImplementation(
        ((_cmd: string, _args: string[], _opts: unknown, cb: any) => {
          cb(null, 'chrome|Google - Search', '');
          return undefined as any;
        }) as any,
      );
      const result = await getActiveWindow();
      expect(result).toEqual({ process_name: 'chrome', window_title: 'Google - Search' });
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('returns nulls on execFile error', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.mocked(execFile).mockImplementation(
        ((_cmd: string, _args: string[], _opts: unknown, cb: any) => {
          cb(new Error('failed'), '', '');
          return undefined as any;
        }) as any,
      );
      const result = await getActiveWindow();
      expect(result).toEqual({ process_name: null, window_title: null });
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('handles empty output', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.mocked(execFile).mockImplementation(
        ((_cmd: string, _args: string[], _opts: unknown, cb: any) => {
          cb(null, '|', '');
          return undefined as any;
        }) as any,
      );
      const result = await getActiveWindow();
      expect(result).toEqual({ process_name: null, window_title: null });
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });
  });

  describe('startTracking', () => {
    test('does not start a second interval if already running', () => {
      const onChange = vi.fn();
      startTracking(onChange, 100);
      startTracking(onChange, 100);
      stopTracking();
    });

    test('stopTracking clears the interval', () => {
      stopTracking();
      expect(() => stopTracking()).not.toThrow();
    });
  });
});
