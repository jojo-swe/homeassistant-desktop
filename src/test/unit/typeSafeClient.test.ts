import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../main/config', () => ({ default: { get: vi.fn() } }));

import config from '../../main/config';
import { evaluate, isConfigured } from '../../main/typeSafeClient';

describe('typeSafeClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(config.get).mockReturnValue('test-key' as never);
    vi.stubGlobal('fetch', fetchMock);
  });

  test('sends typed questions from the main process', async () => {
    const response = { answers: { urgency: { type: 'noul', noul: 0.9 } } };
    fetchMock.mockResolvedValue({ ok: true, json: async () => response });
    const state = { title: 'Water leak' };
    const questions = { urgency: { type: 'noul', instructions: 'Is this urgent?' } };
    expect(await evaluate(state, questions)).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.typesafe.ai/v1/systemone',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, model: 'jev-latest', questions }),
      })
    );
  });

  test('requires a key and reports API failures', async () => {
    vi.mocked(config.get).mockReturnValue('' as never);
    expect(isConfigured()).toBe(false);
    await expect(evaluate({}, {})).rejects.toThrow('Add a TypeSafe API key');
    expect(fetchMock).not.toHaveBeenCalled();

    vi.mocked(config.get).mockReturnValue('test-key' as never);
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(evaluate({}, {})).rejects.toThrow('TypeSafe request failed (401)');
  });
});
