import config from './config';

type ChoiceAnswer = {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

type NoulAnswer = { type: 'noul'; noul: number };

interface TypeSafeResponse {
  answers?: Record<string, ChoiceAnswer | NoulAnswer>;
}

function isConfigured(): boolean {
  return !!config.get('typeSafeApiKey')?.trim();
}

async function evaluate(state: Record<string, unknown>, questions: Record<string, unknown>): Promise<TypeSafeResponse> {
  const key = config.get('typeSafeApiKey')?.trim();
  if (!key) throw new Error('Add a TypeSafe API key in Settings first.');

  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state, model: 'jev-latest', questions }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`TypeSafe request failed (${response.status}).`);
  }
  return (await response.json()) as TypeSafeResponse;
}

export { evaluate, isConfigured };
export type { ChoiceAnswer, NoulAnswer };
