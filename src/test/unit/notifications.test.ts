import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('electron', () => ({
  Notification: class MockNotification {
    static isSupported = vi.fn(() => true);
    on = vi.fn();
    show = vi.fn();
    constructor(_opts: unknown) {}
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({ isEmpty: () => false })),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { Notification, nativeImage } from 'electron';
import logger from 'electron-log';
import { showNotification } from '../../main/notifications';

describe('notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Notification.isSupported).mockReturnValue(true);
  });

  test('shows notification when supported', () => {
    showNotification('Test Title', 'Test Message');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Test Title'));
  });

  test('warns when notifications are not supported', () => {
    vi.mocked(Notification.isSupported).mockReturnValue(false);
    showNotification('Title', 'Message');
    expect(logger.warn).toHaveBeenCalled();
  });

  test('uses default title when empty', () => {
    showNotification('', 'Message');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Notification shown'));
  });

  test('registers click handler when onClick is provided', () => {
    const onClick = vi.fn();
    showNotification('Title', 'Message', onClick);
  });

  test('logs error on exception', () => {
    vi.mocked(Notification.isSupported).mockReturnValue(true);
    vi.mocked(nativeImage.createFromPath).mockImplementation(() => {
      throw new Error('Boom');
    });
    showNotification('Title', 'Message');
    expect(logger.error).toHaveBeenCalled();
  });
});
