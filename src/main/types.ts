/** Shared type definitions for Home Assistant Desktop */

export interface HAEntity {
  entity_id: string;
  name: string;
  state: string;
  domain: string;
}

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    title?: string;
    message?: string;
  };
}

export interface SystemStats {
  memory_usage_percent: number;
  cpu_load_percent: number | null;
  idle_time_seconds: number;
  is_active: boolean;
  webcam_active: boolean;
  microphone_active: boolean;
  battery_percent: number | null;
  battery_charging: boolean | null;
  hostname: string;
  platform: string;
}

export interface ActiveWindowInfo {
  process_name: string | null;
  window_title: string | null;
}

export interface Shortcut {
  accelerator: string;
  entityId: string;
  service: string;
  domain?: string;
}

export interface AppConfig {
  autoUpdate: boolean;
  automaticSwitching: boolean;
  detachedMode: boolean;
  disableHover: boolean;
  stayOnTop: boolean;
  fullScreen: boolean;
  shortcutEnabled: boolean;
  allInstances: string[];
  haBaseUrl: string;
  haToken: string;
  pinnedEntities: string[];
  shortcuts: Shortcut[];
  currentInstance?: number;
  windowSize?: [number, number];
  windowSizeDetached?: [number, number];
  windowPosition?: [number, number];
}

export interface SaveSettingsResult {
  ok: boolean;
  error?: string;
  entities?: HAEntity[];
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  count?: number;
}

export interface WindowInitDeps {
  showWindow: () => void;
  changePosition: () => void;
  toggleFullScreen: (mode?: boolean) => void;
  forceQuit: () => boolean;
}

export interface TrayInitDeps {
  getMainWindow: () => Electron.BrowserWindow;
  showWindow: () => void;
  toggleFullScreen: () => void;
  openSettingsWindow: () => void;
  getCachedEntities: () => HAEntity[];
  refreshEntityCache: () => Promise<void>;
  getAutostartEnabled: () => boolean;
  getUpdateCheckerInterval: () => NodeJS.Timeout | null;
  clearUpdateInterval: () => void;
  useAutoUpdater: () => Promise<void>;
  forceQuit: () => void;
}

export interface IpcRegisterDeps {
  getMainWindow: () => Electron.BrowserWindow;
  showWindow: () => void;
  openSettingsWindow: () => void;
  getCachedEntities: () => HAEntity[];
  setCachedEntities: (entities: HAEntity[]) => void;
  reinitMainWindow: () => Promise<void>;
  addInstance: (url: string) => void;
  currentInstance: (url?: string | null) => string | false;
  bonjour: unknown;
  forceQuit: () => void;
}

export interface EntityAttributes {
  friendly_name?: string;
  unit_of_measurement?: string;
  icon?: string;
  device_class?: string | null;
  charging?: boolean | null;
  idle_seconds?: number;
  window_title?: string;
}
