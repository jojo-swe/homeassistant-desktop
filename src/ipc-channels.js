/**
 * src/ipc-channels.js
 *
 * Central registry of all valid IPC channel names.
 * Shared between preload.js (renderer-side validation) and ipc.js (main-side handlers).
 */

const SEND_CHANNELS = [
  'get-instances',
  'ha-instance',
  'reconnect',
  'restart',
  'start-bonjour',
  'ha-notification',
  'settings-open',
  'desktop-command',
];

const REPLY_CHANNELS = ['get-instances', 'ha-instance', 'bonjour-instance', 'settings-loaded', 'entities-loaded'];

const INVOKE_CHANNELS = [
  'get-system-stats',
  'get-active-window',
  'get-media-status',
  'save-settings',
  'test-connection',
  'save-pinned',
  'get-shortcuts',
  'save-shortcut',
  'remove-shortcut',
];

module.exports = { SEND_CHANNELS, REPLY_CHANNELS, INVOKE_CHANNELS };
