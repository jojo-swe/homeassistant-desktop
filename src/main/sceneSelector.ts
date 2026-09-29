import * as haClient from './haClient';
import { evaluate, type ChoiceAnswer } from './typeSafeClient';

interface SceneSuggestion {
  ok: boolean;
  sceneId?: string;
  name?: string;
  error?: string;
}

async function suggestScene(request: string): Promise<SceneSuggestion> {
  const phrase = request.trim();
  if (!phrase || phrase.length > 500) {
    return { ok: false, error: 'Describe the scene you want in 1–500 characters.' };
  }

  const states = await haClient.getStates();
  if (!states) return { ok: false, error: 'Could not load Home Assistant scenes.' };
  const scenes = states.filter((state) => state.entity_id.startsWith('scene.'));
  if (scenes.length === 0) return { ok: false, error: 'No Home Assistant scenes were found.' };
  if (scenes.length > 254) {
    return { ok: false, error: 'This feature supports up to 254 scenes.' };
  }

  const criteria: Record<string, string> = {
    none: 'No listed scene clearly matches the request.',
  };
  scenes.forEach((scene, index) => {
    criteria[`scene_${index}`] = `${scene.attributes?.friendly_name || scene.entity_id} (${scene.entity_id})`;
  });

  try {
    const result = await evaluate(
      {
        request: phrase,
        available_scenes: scenes.map((scene) => ({
          entity_id: scene.entity_id,
          name: scene.attributes?.friendly_name || scene.entity_id,
        })),
      },
      {
        selected_scene: {
          type: 'choice',
          instructions:
            'Which available Home Assistant scene best matches the user request? Select none if the request is unrelated or ambiguous.',
          criteria,
        },
      }
    );
    const answer = result.answers?.selected_scene as ChoiceAnswer | undefined;
    if (answer?.type !== 'choice' || !Number.isFinite(answer.confidence) || answer.confidence < 0.5) {
      return { ok: false, error: 'The scene request is unclear. Try a more specific description.' };
    }
    const index = /^scene_(\d+)$/.exec(answer.choice)?.[1];
    const scene = index === undefined ? undefined : scenes[Number(index)];
    if (
      !scene ||
      !Number.isFinite(answer.probabilities?.[answer.choice]) ||
      answer.probabilities[answer.choice] < 0.6
    ) {
      return { ok: false, error: 'No scene clearly matches. Try a more specific description.' };
    }
    return { ok: true, sceneId: scene.entity_id, name: scene.attributes?.friendly_name || scene.entity_id };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function activateScene(sceneId: string): Promise<SceneSuggestion> {
  if (!/^scene\.[a-z0-9_]+$/.test(sceneId)) {
    return { ok: false, error: 'Invalid scene.' };
  }
  const states = await haClient.getStates();
  if (!states?.some((state) => state.entity_id === sceneId)) {
    return { ok: false, error: 'This scene is no longer available.' };
  }
  const activated = await haClient.activateScene(sceneId);
  return activated ? { ok: true, sceneId } : { ok: false, error: 'Home Assistant could not activate the scene.' };
}

export { suggestScene, activateScene };
