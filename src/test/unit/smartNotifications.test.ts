import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../main/config', () => ({ default: { get: vi.fn(() => true) } }));
vi.mock('../../main/typeSafeClient', () => ({ evaluate: vi.fn(), isConfigured: vi.fn(() => true) }));

import config from '../../main/config';
import { evaluate, isConfigured } from '../../main/typeSafeClient';
import { routeNotification, getDigest, clearDigest } from '../../main/smartNotifications';

describe('smartNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDigest();
    vi.mocked(config.get).mockReturnValue(true as never);
    vi.mocked(isConfigured).mockReturnValue(true);
  });

  test('holds clearly routine items in the digest', async () => {
    vi.mocked(evaluate).mockResolvedValue({ answers: { needs_immediate_attention: { type: 'noul', noul: 0.03 } } });
    const show = vi.fn();
    const updated = vi.fn();
    await routeNotification('Laundry', 'Finished', show, updated);
    expect(show).not.toHaveBeenCalled();
    expect(updated).toHaveBeenCalledOnce();
    expect(getDigest()[0]).toMatchObject({ title: 'Laundry', message: 'Finished' });
  });

  test('shows uncertain items and API failures immediately', async () => {
    vi.mocked(evaluate).mockResolvedValueOnce({ answers: { needs_immediate_attention: { type: 'noul', noul: 0.4 } } });
    vi.mocked(evaluate).mockRejectedValueOnce(new Error('offline'));
    const show = vi.fn();
    await routeNotification('Door', 'Check it', show, vi.fn());
    await routeNotification('Door', 'Check it', show, vi.fn());
    expect(show).toHaveBeenCalledTimes(2);
    expect(getDigest()).toEqual([]);
  });

  test('does not call TypeSafe when disabled', async () => {
    vi.mocked(config.get).mockReturnValue(false as never);
    const show = vi.fn();
    await routeNotification('Status', 'Hello', show, vi.fn());
    expect(show).toHaveBeenCalledOnce();
    expect(evaluate).not.toHaveBeenCalled();
  });

  test('shows long messages instead of judging clipped content', async () => {
    const show = vi.fn();
    await routeNotification('Status', 'x'.repeat(2_001), show, vi.fn());
    expect(show).toHaveBeenCalledOnce();
    expect(evaluate).not.toHaveBeenCalled();
  });

  test('does not show a queued item if refreshing the digest UI fails', async () => {
    vi.mocked(evaluate).mockResolvedValue({
      answers: { needs_immediate_attention: { type: 'noul', noul: 0.01 } },
    });
    const show = vi.fn();
    await routeNotification('Laundry', 'Finished', show, () => {
      throw new Error('window closed');
    });
    expect(show).not.toHaveBeenCalled();
    expect(getDigest()).toHaveLength(1);
  });

  test('shows an item instead of refilling a digest cleared while it was being classified', async () => {
    let answer!: (value: unknown) => void;
    vi.mocked(evaluate).mockReturnValue(new Promise((resolve) => (answer = resolve)) as never);
    const show = vi.fn();
    const pending = routeNotification('Laundry', 'Finished', show, vi.fn());
    clearDigest();
    answer({ answers: { needs_immediate_attention: { type: 'noul', noul: 0.01 } } });
    await pending;
    expect(getDigest()).toEqual([]);
    expect(show).toHaveBeenCalledOnce();
  });

  test('shows new routine items once the digest is full instead of dropping older ones', async () => {
    vi.mocked(evaluate).mockResolvedValue({ answers: { needs_immediate_attention: { type: 'noul', noul: 0.01 } } });
    const show = vi.fn();
    for (let i = 0; i < 50; i++) await routeNotification(`Item ${i}`, 'Done', show, vi.fn());
    expect(show).not.toHaveBeenCalled();
    await routeNotification('Item 50', 'Done', show, vi.fn());
    expect(show).toHaveBeenCalledOnce();
    const digest = getDigest();
    expect(digest).toHaveLength(50);
    expect(digest.at(-1)?.title).toBe('Item 0');
  });
});
