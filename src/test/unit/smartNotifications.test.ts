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
});
