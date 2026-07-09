import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => {
  const mockWindow = {
    focus: vi.fn(),
    loadURL: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    webContents: {
      on: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue(undefined),
    },
  };
  return {
    BrowserWindow: vi.fn(() => mockWindow),
  };
});

import { BrowserWindow } from 'electron';
import { openSettingsWindow, getSettingsWindow, closeSettingsWindow } from '../../main/settingsWindow';

describe('settingsWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeSettingsWindow();
  });

  test('creates a new settings window', () => {
    openSettingsWindow();
    expect(BrowserWindow).toHaveBeenCalled();
    const win = getSettingsWindow();
    expect(win).toBeDefined();
  });

  test('focuses existing window instead of creating a new one', () => {
    openSettingsWindow();
    openSettingsWindow();
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
    const win = getSettingsWindow();
    expect(win?.focus).toHaveBeenCalled();
  });

  test('sets null on closed event', () => {
    openSettingsWindow();
    const win = getSettingsWindow();
    expect(win).toBeDefined();
    const closedHandler = vi
      .mocked(BrowserWindow)
      .mock.results[0].value.on.mock.calls.find((c: any[]) => c[0] === 'closed')?.[1];
    expect(closedHandler).toBeDefined();
    closedHandler();
    expect(getSettingsWindow()).toBeNull();
  });

  test('closeSettingsWindow closes and nullifies', () => {
    openSettingsWindow();
    const win = getSettingsWindow();
    closeSettingsWindow();
    expect(win?.close).toHaveBeenCalled();
    expect(getSettingsWindow()).toBeNull();
  });

  test('closeSettingsWindow does nothing when no window exists', () => {
    expect(() => closeSettingsWindow()).not.toThrow();
    expect(getSettingsWindow()).toBeNull();
  });
});
