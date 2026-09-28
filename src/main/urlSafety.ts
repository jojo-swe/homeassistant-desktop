import { shell } from 'electron';
import logger from 'electron-log';
import config from './config';

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True for absolute http(s) URLs — the only kind we accept as a Home Assistant instance. */
export function isHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const parsed = parse(url);
  return !!parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
}

/** True for the app's own bundled pages. */
export function isLocalAppUrl(url: string): boolean {
  return parse(url)?.protocol === 'file:';
}

/** True when the URL shares an origin with one of the configured Home Assistant instances. */
export function isInstanceUrl(url: string): boolean {
  const parsed = parse(url);
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) return false;
  const instances = config.get('allInstances') || [];
  return instances.some((instance) => parse(instance)?.origin === parsed.origin);
}

/**
 * Opens a URL in the user's default handler, but only for web and mail links.
 * Other schemes (smb:, file:, ms-*, search-ms: …) can launch local programs and are refused.
 */
export async function openExternalSafe(url: string): Promise<void> {
  const parsed = parse(url);
  if (!parsed || !EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    logger.warn(`Refused to open external URL with unsupported scheme: ${url}`);
    return;
  }
  await shell.openExternal(url);
}
