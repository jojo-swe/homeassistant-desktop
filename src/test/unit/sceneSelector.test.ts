import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../main/haClient', () => ({ getStates: vi.fn(), activateScene: vi.fn() }));
vi.mock('../../main/typeSafeClient', () => ({ evaluate: vi.fn() }));

import * as haClient from '../../main/haClient';
import { evaluate } from '../../main/typeSafeClient';
import { suggestScene, activateScene } from '../../main/sceneSelector';

const scenes = [
  { entity_id: 'scene.movie', state: 'scening', attributes: { friendly_name: 'Movie Time' } },
  { entity_id: 'scene.reading', state: 'scening', attributes: { friendly_name: 'Reading' } },
];

describe('sceneSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(haClient.getStates).mockResolvedValue(scenes);
  });

  test('maps a model choice only to an existing scene', async () => {
    vi.mocked(evaluate).mockResolvedValue({
      answers: {
        selected_scene: { type: 'choice', choice: 'scene_1', confidence: 0.9, probabilities: { scene_1: 0.9 } },
      },
    });
    expect(await suggestScene('I want to read')).toEqual({ ok: true, sceneId: 'scene.reading', name: 'Reading' });
    expect(vi.mocked(evaluate).mock.calls[0][1]).toMatchObject({
      selected_scene: { criteria: { none: expect.any(String), scene_0: expect.stringContaining('scene.movie') } },
    });
  });

  test('does not suggest a made-up or uncertain scene', async () => {
    vi.mocked(evaluate).mockResolvedValueOnce({
      answers: {
        selected_scene: { type: 'choice', choice: 'scene_9', confidence: 1, probabilities: { scene_9: 1 } },
      },
    });
    expect((await suggestScene('unknown')).ok).toBe(false);
    vi.mocked(evaluate).mockResolvedValueOnce({
      answers: {
        selected_scene: { type: 'choice', choice: 'scene_0', confidence: 0.2, probabilities: { scene_0: 0.55 } },
      },
    });
    expect((await suggestScene('maybe')).ok).toBe(false);
  });

  test('checks a scene still exists before activation', async () => {
    vi.mocked(haClient.activateScene).mockResolvedValue(true);
    expect((await activateScene('scene.movie')).ok).toBe(true);
    expect(haClient.activateScene).toHaveBeenCalledWith('scene.movie');
    expect((await activateScene('scene.gone')).ok).toBe(false);
    expect(haClient.activateScene).toHaveBeenCalledTimes(1);
  });
});
