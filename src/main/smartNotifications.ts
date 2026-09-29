import config from './config';
import { evaluate, isConfigured, type NoulAnswer } from './typeSafeClient';

interface DigestItem {
  title: string;
  message: string;
  receivedAt: string;
}

const MAX_DIGEST_ITEMS = 50;
const digest: DigestItem[] = [];
// Bumped by clearDigest, so a classification that was in flight during a clear doesn't refill the list.
let digestGeneration = 0;

async function routeNotification(
  title: string,
  message: string,
  showNow: () => void,
  onDigestUpdated: () => void
): Promise<void> {
  if (!config.get('smartNotificationsEnabled') || !isConfigured()) {
    showNow();
    return;
  }
  // Do not classify clipped text: the omitted part could change its urgency.
  if (title.length > 200 || message.length > 2_000 || !message.trim()) {
    showNow();
    return;
  }

  const generation = digestGeneration;
  try {
    const result = await evaluate(
      { title, message },
      {
        needs_immediate_attention: {
          type: 'noul',
          instructions:
            'Does this Home Assistant notification call for prompt human attention because it indicates a safety, security, health, access, or time-sensitive problem?',
          criteria: {
            true: 'A person should see this promptly and may need to act soon.',
            false: 'Routine status, informational update, or reminder that can wait in a digest.',
          },
        },
      }
    );
    const answer = result.answers?.needs_immediate_attention as NoulAnswer | undefined;
    if (!config.get('smartNotificationsEnabled')) {
      showNow();
      return;
    }
    if (answer?.type !== 'noul' || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
      showNow();
      return;
    }
    // Only clearly routine messages are held. Ambiguous and urgent ones still appear now.
    if (answer.noul >= 0.2) {
      showNow();
      return;
    }
    // Never drop a held item to make room, and never refill a digest cleared while this was classified:
    // show the notification instead, so it is not lost either way.
    if (generation !== digestGeneration || digest.length >= MAX_DIGEST_ITEMS) {
      showNow();
      return;
    }
    digest.unshift({ title, message, receivedAt: new Date().toISOString() });
    try {
      onDigestUpdated();
    } catch {
      // The item is already in the digest; a closed Settings window must not duplicate it as a toast.
    }
  } catch {
    // A network or model failure must not hide a Home Assistant notification.
    showNow();
  }
}

function getDigest(): DigestItem[] {
  return [...digest];
}

function clearDigest(): void {
  digest.length = 0;
  digestGeneration++;
}

export { routeNotification, getDigest, clearDigest };
export type { DigestItem };
