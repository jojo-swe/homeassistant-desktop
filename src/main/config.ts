import Store from 'electron-store';
import type { AppConfig, Shortcut } from './types';

const store = new Store<AppConfig>({
  defaults: {
    autoUpdate: true,
    automaticSwitching: true,
    detachedMode: false,
    disableHover: false,
    stayOnTop: false,
    fullScreen: false,
    shortcutEnabled: false,
    allInstances: [],
    haBaseUrl: '',
    haToken: '',
    pinnedEntities: [],
    shortcuts: [] as Shortcut[],
    theme: 'dark' as 'dark' | 'light',
  },
});

export default store;
