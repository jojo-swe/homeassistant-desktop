import { shell } from 'electron';
import logger from 'electron-log';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config';

/** Directory holding the bundled renderer pages (out/renderer, next to the main bundle in out/main). */
export const APP_PAGES_DIR = nodePath.resolve(__dirname, '..', 'renderer');

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

/**
 * True only for the app's own bundled pages. Any other file: URL is treated as untrusted, since a
 * page loaded from elsewhere on disk would otherwise get the privileged IPC channels.
 */
export function isLocalAppUrl(url: string): boolean {
  const parsed = parse(url);
  if (!parsed || parsed.protocol !== 'file:') return false;
  let filePath: string;
  try {
    filePath = nodePath.resolve(fileURLToPath(parsed));
  } catch {
    return false;
  }
  const relative = nodePath.relative(APP_PAGES_DIR, filePath);
  return relative !== '' && !relative.startsWith('..') && !nodePath.isAbsolute(relative);
}

/** True when the URL shares an origin with one of the configured Home Assistant instances. */
export function isInstanceUrl(url: string): boolean {
  const parsed = parse(url);
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) return false;
  const instances = config.get('allInstances') || [];
  return instances.some((instance) => parse(instance)?.origin === parsed.origin);
}

/** True for a page of a configured instance's login flow (e.g. /auth/authorize). */
export function isInstanceAuthUrl(url: string): boolean {
  return isInstanceUrl(url) && parse(url)!.pathname.startsWith('/auth/');
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
