/** Central registry of all valid IPC channel names. Shared between preload and main. */

export const SEND_CHANNELS = [
  'get-instances',
  'ha-instance',
  'reconnect',
  'restart',
  'start-bonjour',
  'ha-notification',
  'settings-open',
  'desktop-command',
] as const;

export const REPLY_CHANNELS = [
  'get-instances',
  'ha-instance',
  'bonjour-instance',
  'settings-loaded',
  'entities-loaded',
] as const;

export const INVOKE_CHANNELS = [
  'get-system-stats',
  'get-active-window',
  'get-media-status',
  'save-settings',
  'test-connection',
  'save-pinned',
  'get-shortcuts',
  'save-shortcut',
  'remove-shortcut',
] as const;

export type SendChannel = (typeof SEND_CHANNELS)[number];
export type ReplyChannel = (typeof REPLY_CHANNELS)[number];
export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];
