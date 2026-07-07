import { globalShortcut } from 'electron';
import logger from 'electron-log';
import config from './config';
import * as haClient from './haClient';
import type { Shortcut } from './types';

const CONFIG_KEY = 'shortcuts';

function load(): Shortcut[] {
  return config.get(CONFIG_KEY) || [];
}

function save(shortcuts: Shortcut[]): void {
  config.set(CONFIG_KEY, shortcuts);
}

function registerAll(): void {
  const shortcuts = load();
  if (!shortcuts.length) return;

  shortcuts.forEach(({ accelerator }) => {
    try {
      globalShortcut.unregister(accelerator);
    } catch {
      /* ignore */
    }
  });

  shortcuts.forEach(({ accelerator, entityId, service, domain }) => {
    if (!accelerator || !entityId) return;
    const resolvedDomain = domain || entityId.split('.')[0];
    const resolvedService = service || 'toggle';

    try {
      const registered = globalShortcut.register(accelerator, async () => {
        logger.info(`Shortcut triggered: ${accelerator} → ${resolvedDomain}.${resolvedService}(${entityId})`);
        try {
          await haClient.toggle(entityId);
        } catch (err) {
          logger.error(`Shortcut action failed for ${entityId}: ${(err as Error).message}`);
        }
      });

      if (!registered) {
        logger.warn(`Shortcut "${accelerator}" could not be registered (already in use?).`);
      } else {
        logger.info(`Shortcut registered: ${accelerator} → ${entityId}`);
      }
    } catch (err) {
      logger.error(`Failed to register shortcut "${accelerator}": ${(err as Error).message}`);
    }
  });
}

function unregisterAll(): void {
  const shortcuts = load();
  shortcuts.forEach(({ accelerator }) => {
    try {
      globalShortcut.unregister(accelerator);
    } catch {
      /* ignore */
    }
  });
}

function upsert(shortcut: Shortcut): void {
  const shortcuts = load();
  const idx = shortcuts.findIndex((s) => s.accelerator === shortcut.accelerator);
  if (idx >= 0) {
    shortcuts[idx] = shortcut;
  } else {
    shortcuts.push(shortcut);
  }
  save(shortcuts);
  registerAll();
}

function remove(accelerator: string): void {
  try {
    globalShortcut.unregister(accelerator);
  } catch {
    /* ignore */
  }
  const shortcuts = load().filter((s) => s.accelerator !== accelerator);
  save(shortcuts);
  registerAll();
}

export { load, save, registerAll, unregisterAll, upsert, remove };
