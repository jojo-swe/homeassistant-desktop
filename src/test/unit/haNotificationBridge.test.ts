import { describe, test, expect } from 'vitest';
import haNotificationBridge from '../../main/haNotificationBridge';

describe('haNotificationBridge', () => {
  test('is a string (injectable JS code)', () => {
    expect(typeof haNotificationBridge).toBe('string');
  });

  test('is wrapped in an IIFE', () => {
    expect(haNotificationBridge).toMatch(/^\(function haNotificationBridge/);
    expect(haNotificationBridge).toMatch(/\}\)\(\);$/);
  });

  test('contains subscribeEvents for state_changed', () => {
    expect(haNotificationBridge).toContain('subscribeEvents');
    expect(haNotificationBridge).toContain('state_changed');
  });

  test('contains subscribeEvents for desktop_command', () => {
    expect(haNotificationBridge).toContain('desktop_command');
  });

  test('filters for persistent_notification entities', () => {
    expect(haNotificationBridge).toContain('persistent_notification.');
  });

  test('sends ha-notification via window.api.send', () => {
    expect(haNotificationBridge).toContain("window.api.send('ha-notification'");
  });

  test('sends desktop-command via window.api.send', () => {
    expect(haNotificationBridge).toContain("window.api.send('desktop-command'");
  });

  test('contains polling logic with max attempts', () => {
    expect(haNotificationBridge).toContain('MAX_ATTEMPTS');
    expect(haNotificationBridge).toContain('pollForConnection');
  });

  test('uses fingerprint dedup for notifications', () => {
    expect(haNotificationBridge).toContain('fingerprint');
    expect(haNotificationBridge).toContain('seen.has');
    expect(haNotificationBridge).toContain('seen.add');
  });

  test('handles DOMContentLoaded for loading state', () => {
    expect(haNotificationBridge).toContain('DOMContentLoaded');
    expect(haNotificationBridge).toContain('readyState');
  });

  test('extracts title and message from new_state attributes', () => {
    expect(haNotificationBridge).toContain('new_state.attributes');
    expect(haNotificationBridge).toContain('title');
    expect(haNotificationBridge).toContain('message');
  });

  test('skips when new_state is missing', () => {
    expect(haNotificationBridge).toContain('if (!new_state) return');
  });

  test('skips when old_state exists (already seen notification)', () => {
    expect(haNotificationBridge).toContain('old_state');
  });
});
