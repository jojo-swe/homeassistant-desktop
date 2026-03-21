/**
 * src/shortcutManager.js
 *
 * Manages global keyboard shortcuts that trigger Home Assistant service calls.
 * Shortcuts are configured through the Settings panel and persisted in electron-store.
 *
 * Config schema (config key: 'shortcuts'):
 * [
 *   { accelerator: 'Ctrl+Shift+1', entityId: 'light.living_room', service: 'toggle', domain: 'light' },
 *   ...
 * ]
 */

const { globalShortcut } = require('electron');
const logger = require('electron-log');
const config = require('../config');
const haClient = require('./haClient');

const CONFIG_KEY = 'shortcuts';

function load() {
  return config.get(CONFIG_KEY) || [];
}

function save(shortcuts) {
  config.set(CONFIG_KEY, shortcuts);
}

/**
 * Registers all saved shortcuts with the OS.
 * Safe to call multiple times — unregisters first.
 */
function registerAll() {
  const shortcuts = load();
  if (!shortcuts.length) return;

  // Unregister only our shortcuts (not the app-wide ones)
  shortcuts.forEach(({ accelerator }) => {
    try { globalShortcut.unregister(accelerator); } catch (_) {}
  });

  shortcuts.forEach(({ accelerator, entityId, service, domain }) => {
    if (!accelerator || !entityId) return;
    const resolvedDomain = domain || entityId.split('.')[0];
    const resolvedService = service || 'toggle';

    try {
      const registered = globalShortcut.register(accelerator, async () => {
        logger.info(`Shortcut triggered: ${accelerator} → ${resolvedDomain}.${resolvedService}(${entityId})`);
        try {
          await haClient.toggle(entityId); // toggle covers most use cases
        } catch (err) {
          logger.error(`Shortcut action failed for ${entityId}:`, err.message);
        }
      });

      if (!registered) {
        logger.warn(`Shortcut "${accelerator}" could not be registered (already in use?).`);
      } else {
        logger.info(`Shortcut registered: ${accelerator} → ${entityId}`);
      }
    } catch (err) {
      logger.error(`Failed to register shortcut "${accelerator}":`, err.message);
    }
  });
}

/**
 * Unregisters all managed shortcuts.
 */
function unregisterAll() {
  const shortcuts = load();
  shortcuts.forEach(({ accelerator }) => {
    try { globalShortcut.unregister(accelerator); } catch (_) {}
  });
}

/**
 * Adds or updates a shortcut entry, then re-registers all.
 */
function upsert(shortcut) {
  const shortcuts = load();
  const idx = shortcuts.findIndex(s => s.accelerator === shortcut.accelerator);
  if (idx >= 0) {
    shortcuts[idx] = shortcut;
  } else {
    shortcuts.push(shortcut);
  }
  save(shortcuts);
  registerAll();
}

/**
 * Removes a shortcut by accelerator key.
 */
function remove(accelerator) {
  try { globalShortcut.unregister(accelerator); } catch (_) {}
  const shortcuts = load().filter(s => s.accelerator !== accelerator);
  save(shortcuts);
}

module.exports = { load, save, registerAll, unregisterAll, upsert, remove };
