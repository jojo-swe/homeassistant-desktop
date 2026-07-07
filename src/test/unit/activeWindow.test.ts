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
import logger from 'electron-log';
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

    test('calls onChange when window changes', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.mocked(execFile).mockImplementation(
        ((_cmd: string, _args: string[], _opts: unknown, cb: any) => {
          cb(null, 'chrome|Google - Search', '');
          return undefined as any;
        }) as any,
      );
      const onChange = vi.fn();
      vi.useFakeTimers();
      startTracking(onChange, 100);
      await vi.advanceTimersByTimeAsync(150);
      expect(onChange).toHaveBeenCalledWith({ process_name: 'chrome', window_title: 'Google - Search' });
      stopTracking();
      vi.useRealTimers();
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('catches errors from onChange callback', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.mocked(execFile).mockImplementation(
        ((_cmd: string, _args: string[], _opts: unknown, cb: any) => {
          cb(null, 'code|Test', '');
          return undefined as any;
        }) as any,
      );
      const onChange = vi.fn(() => { throw new Error('callback failed'); });
      vi.useFakeTimers();
      startTracking(onChange, 100);
      await vi.advanceTimersByTimeAsync(150);
      expect(logger.error).toHaveBeenCalled();
      stopTracking();
      vi.useRealTimers();
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('does not call onChange when window has not changed', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      let callCount = 0;
      vi.mocked(execFile).mockImplementation(
        ((_cmd: string, _args: string[], _opts: unknown, cb: any) => {
          callCount++;
          cb(null, 'chrome|Same Title', '');
          return undefined as any;
        }) as any,
      );
      const onChange = vi.fn();
      vi.useFakeTimers();
      startTracking(onChange, 100);
      await vi.advanceTimersByTimeAsync(150);
      await vi.advanceTimersByTimeAsync(150);
      expect(onChange).toHaveBeenCalledTimes(1);
      stopTracking();
      vi.useRealTimers();
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });

    test('stopTracking clears the interval', () => {
      stopTracking();
      expect(() => stopTracking()).not.toThrow();
    });
  });
});
