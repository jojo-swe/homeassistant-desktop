import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockTray = {
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  on: vi.fn(),
  getBounds: vi.fn(() => ({ x: 0, y: 0, width: 40, height: 40 })),
};

const mockMenu = { items: [] };

vi.mock('electron', () => ({
  Tray: vi.fn(() => mockTray),
  Menu: {
    buildFromTemplate: vi.fn((template) => ({ ...mockMenu, template })),
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    setLoginItemSettings: vi.fn(),
    relaunch: vi.fn(),
    exit: vi.fn(),
    quit: vi.fn(),
  },
  screen: {
    getDisplayNearestPoint: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })),
    getCursorScreenPoint: vi.fn(() => ({ x: 100, y: 100 })),
  },
  shell: { openExternal: vi.fn() },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 2 }),
  },
}));

vi.mock('electron-traywindow-positioner', () => ({
  default: {
    getTaskbarPosition: vi.fn(() => 'bottom'),
    position: vi.fn(),
    calculate: vi.fn(() => ({ x: 100, y: 100 })),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../main/config', () => {
  const store: Record<string, unknown> = {};
  return {
    default: {
      get: vi.fn((key: string) => store[key]),
      set: vi.fn((key: string, val: unknown) => {
        store[key] = val;
      }),
      has: vi.fn((key: string) => key in store),
      delete: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(),
    },
  };
});

vi.mock('../../main/haClient', () => ({
  toggle: vi.fn(),
}));

import { Tray, Menu, app, screen, shell, dialog } from 'electron';
import Positioner from 'electron-traywindow-positioner';
import config from '../../main/config';
import * as haClient from '../../main/haClient';
import { createTray, getTray, getMenu, changePosition } from '../../main/tray';
import type { TrayInitDeps } from '../../main/types';

function createDeps(): TrayInitDeps {
  return {
    getMainWindow: vi.fn(() => ({
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 420, height: 460 })),
      getPosition: vi.fn(() => [0, 0]),
      getSize: vi.fn(() => [420, 460]),
      setPosition: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      isVisible: vi.fn(() => false),
      loadURL: vi.fn().mockResolvedValue(undefined),
      isAlwaysOnTop: vi.fn(() => false),
      setAlwaysOnTop: vi.fn(),
      webContents: { session: { clearCache: vi.fn(), clearStorageData: vi.fn() } },
    }) as any),
    showWindow: vi.fn(),
    toggleFullScreen: vi.fn(),
    openSettingsWindow: vi.fn(),
    getCachedEntities: vi.fn(() => []),
    refreshEntityCache: vi.fn().mockResolvedValue(undefined),
    getAutostartEnabled: vi.fn(() => false),
    getUpdateCheckerInterval: vi.fn(() => null),
    clearUpdateInterval: vi.fn(),
    useAutoUpdater: vi.fn().mockResolvedValue(undefined),
    forceQuit: vi.fn(),
  };
}

describe('tray', () => {
  let deps: TrayInitDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createDeps();
    vi.mocked(config.get).mockReturnValue(undefined);
    vi.mocked(config.has).mockReturnValue(false);
  });

  describe('createTray', () => {
    test('creates a Tray instance and sets tooltip', () => {
      createTray(deps);
      expect(Tray).toHaveBeenCalled();
      expect(mockTray.setToolTip).toHaveBeenCalledWith('Home Assistant Desktop');
    });

    test('registers click handler on non-linux', () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      createTray(deps);
      expect(mockTray.on).toHaveBeenCalledWith('click', expect.any(Function));
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    });
  });

  describe('getTray', () => {
    test('returns the tray instance after createTray', () => {
      createTray(deps);
      expect(getTray()).toBeDefined();
    });
  });

  describe('getMenu', () => {
    test('builds a menu with status and quit items', () => {
      const menu = getMenu();
      expect(Menu.buildFromTemplate).toHaveBeenCalled();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const labels = template.map((item: any) => item.label).filter(Boolean);
      expect(labels).toContain('Quit');
    });

    test('shows not connected status when HA is not configured', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return [];
        return undefined;
      });
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const statusItem = template.find((item: any) => item.label?.includes('Not Connected'));
      expect(statusItem).toBeDefined();
    });

    test('shows connected status when HA is configured', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'haBaseUrl') return 'http://ha.local';
        if (key === 'allInstances') return [];
        return undefined;
      });
      vi.mocked(config.has).mockImplementation((key: string) => key === 'haBaseUrl');
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const statusItem = template.find((item: any) => item.label?.includes('Connected'));
      expect(statusItem).toBeDefined();
      expect(statusItem!.label).toContain('🟢');
    });

    test('includes instance menu items when instances exist', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return ['http://ha1.local', 'http://ha2.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha1.local';
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const instanceItems = template.filter((item: any) => item.label === 'http://ha1.local' || item.label === 'http://ha2.local');
      expect(instanceItems).toHaveLength(2);
    });

    test('includes quick actions when entities are pinned', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'pinnedEntities') return ['light.living'];
        if (key === 'allInstances') return ['http://ha.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha.local';
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      vi.mocked(deps.getCachedEntities).mockReturnValue([
        { entity_id: 'light.living', name: 'Living Room', state: 'on', domain: 'light' },
      ]);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const quickActionMenu = template.find((item: any) => item.label === '⚡ Quick Actions');
      expect(quickActionMenu).toBeDefined();
      const submenu = (quickActionMenu as any).submenu as any[];
      const entityItem = submenu.find((item: any) => item.label?.includes('Living Room'));
      expect(entityItem).toBeDefined();
    });

    test('shows no entities pinned message when empty', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'pinnedEntities') return [];
        if (key === 'allInstances') return ['http://ha.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha.local';
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const quickActionMenu = template.find((item: any) => item.label === '⚡ Quick Actions');
      const submenu = (quickActionMenu as any).submenu as any[];
      const noEntitiesItem = submenu.find((item: any) =>
        item.label?.includes('No entities pinned'),
      );
      expect(noEntitiesItem).toBeDefined();
    });

    test('includes version label', () => {
      vi.mocked(app.getVersion).mockReturnValue('2.0.0');
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const versionItem = template.find((item: any) => item.label === 'v2.0.0');
      expect(versionItem).toBeDefined();
    });

    test('quit click calls forceQuit and app.quit', () => {
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const quitItem = template.find((item: any) => item.label === 'Quit');
      quitItem.click();
      expect(deps.forceQuit).toHaveBeenCalled();
      expect(app.quit).toHaveBeenCalled();
    });

    test('restart click calls app.relaunch and app.exit', () => {
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const restartItem = template.find((item: any) => item.label === 'Restart Application');
      restartItem.click();
      expect(app.relaunch).toHaveBeenCalled();
      expect(app.exit).toHaveBeenCalled();
    });

    test('settings click calls openSettingsWindow', () => {
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const settingsItem = template.find((item: any) => item.label === '⚙ Settings');
      settingsItem.click();
      expect(deps.openSettingsWindow).toHaveBeenCalled();
    });

    test('refresh entities click calls refreshEntityCache', async () => {
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const refreshItem = template.find((item: any) => item.label === '↻ Refresh Entities');
      await refreshItem.click();
      expect(deps.refreshEntityCache).toHaveBeenCalled();
    });

    test('github click opens external URL', async () => {
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const githubItem = template.find((item: any) => item.label === 'Open on github.com');
      await githubItem.click();
      expect(shell.openExternal).toHaveBeenCalledWith('https://github.com/jojo-swe/homeassistant-desktop');
    });

    test('fullscreen click calls toggleFullScreen', () => {
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const fsItem = template.find((item: any) => item.label === 'Use Fullscreen');
      fsItem.click();
      expect(deps.toggleFullScreen).toHaveBeenCalled();
    });

    test('manage quick actions click calls openSettingsWindow', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'pinnedEntities') return ['light.test'];
        if (key === 'allInstances') return ['http://ha.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha.local';
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      vi.mocked(deps.getCachedEntities).mockReturnValue([
        { entity_id: 'light.test', name: 'Test', state: 'on', domain: 'light' },
      ]);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const qaMenu = template.find((item: any) => item.label === '⚡ Quick Actions');
      const manageItem = (qaMenu as any).submenu.find((i: any) => i.label === 'Manage Quick Actions...');
      manageItem.click();
      expect(deps.openSettingsWindow).toHaveBeenCalled();
    });

    test('quick action entity click calls haClient.toggle', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'pinnedEntities') return ['light.test'];
        if (key === 'allInstances') return ['http://ha.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha.local';
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      vi.mocked(deps.getCachedEntities).mockReturnValue([
        { entity_id: 'light.test', name: 'Test', state: 'on', domain: 'light' },
      ]);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const qaMenu = template.find((item: any) => item.label === '⚡ Quick Actions');
      const entityItem = (qaMenu as any).submenu.find((i: any) => i.label?.includes('Test'));
      await entityItem.click();
      expect(haClient.toggle).toHaveBeenCalledWith('light.test');
    });

    test('enable shortcut click toggles config', () => {
      createTray(deps);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'shortcutEnabled') return false;
        if (key === 'allInstances') return [];
        return undefined;
      });
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const shortcutItem = template.find((item: any) => item.label === 'Enable Shortcut');
      shortcutItem.click();
      expect(config.set).toHaveBeenCalledWith('shortcutEnabled', true);
    });

    test('start at login click toggles autostart', () => {
      createTray(deps);
      vi.mocked(deps.getAutostartEnabled).mockReturnValue(false);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const loginItem = template.find((item: any) => item.label === 'Start at Login');
      loginItem.click();
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    });

    test('automatic updates click enables updates when off', async () => {
      createTray(deps);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'autoUpdate') return false;
        if (key === 'allInstances') return [];
        return undefined;
      });
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const updateItem = template.find((item: any) => item.label === 'Automatic Updates');
      await updateItem.click();
      expect(config.set).toHaveBeenCalledWith('autoUpdate', true);
      expect(deps.useAutoUpdater).toHaveBeenCalled();
    });

    test('automatic updates click disables updates when on', async () => {
      createTray(deps);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'autoUpdate') return true;
        if (key === 'allInstances') return [];
        return undefined;
      });
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const updateItem = template.find((item: any) => item.label === 'Automatic Updates');
      await updateItem.click();
      expect(config.set).toHaveBeenCalledWith('autoUpdate', false);
      expect(deps.clearUpdateInterval).toHaveBeenCalled();
    });

    test('hover to show click toggles disableHover', () => {
      createTray(deps);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'disableHover') return false;
        if (key === 'detachedMode') return false;
        if (key === 'allInstances') return [];
        return undefined;
      });
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const hoverItem = template.find((item: any) => item.label === 'Hover to Show');
      hoverItem.click();
      expect(config.set).toHaveBeenCalledWith('disableHover', true);
    });

    test('stay on top click toggles config', () => {
      createTray(deps);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'stayOnTop') return false;
        if (key === 'allInstances') return [];
        return undefined;
      });
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const stayItem = template.find((item: any) => item.label === 'Stay on Top');
      stayItem.click();
      expect(config.set).toHaveBeenCalledWith('stayOnTop', true);
    });

    test('detached window click toggles config', async () => {
      createTray(deps);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'detachedMode') return false;
        if (key === 'allInstances') return [];
        return undefined;
      });
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const detachedItem = template.find((item: any) => item.label === 'Use detached Window');
      await detachedItem.click();
      expect(config.set).toHaveBeenCalledWith('detachedMode', true);
    });

    test('open in browser click opens external URL when instance exists', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return ['http://ha.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha.local';
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const openItem = template.find((item: any) => item.label === 'Open in Browser');
      await openItem.click();
      expect(shell.openExternal).toHaveBeenCalledWith('http://ha.local');
    });

    test('instance checkbox click switches instance', async () => {
      const mockWindow = {
        loadURL: vi.fn().mockResolvedValue(undefined),
        show: vi.fn(),
      };
      vi.mocked(deps.getMainWindow).mockReturnValue(mockWindow as any);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return ['http://ha1.local', 'http://ha2.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha1.local';
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const instanceItem = template.find((item: any) => item.label === 'http://ha2.local');
      await instanceItem.click();
      expect(config.set).toHaveBeenCalledWith('currentInstance', 1);
      expect(mockWindow.loadURL).toHaveBeenCalledWith('http://ha2.local');
    });

    test('add another instance click resets currentInstance', async () => {
      const mockWindow = {
        loadURL: vi.fn().mockResolvedValue(undefined),
        show: vi.fn(),
      };
      vi.mocked(deps.getMainWindow).mockReturnValue(mockWindow as any);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return ['http://ha.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha.local';
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const addItem = template.find((item: any) => item.label === 'Add another Instance...');
      await addItem.click();
      expect(config.delete).toHaveBeenCalledWith('currentInstance');
    });

    test('automatic switching click toggles config', () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return ['http://ha1.local', 'http://ha2.local'];
        if (key === 'currentInstance') return 0;
        if (key === 'haBaseUrl') return 'http://ha1.local';
        if (key === 'automaticSwitching') return false;
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(true);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const autoItem = template.find((item: any) => item.label === 'Automatic Switching');
      autoItem.click();
      expect(config.set).toHaveBeenCalledWith('automaticSwitching', true);
    });
  });

  describe('changePosition', () => {
    test('does nothing when no main window', () => {
      vi.mocked(deps.getMainWindow).mockReturnValue(null as any);
      createTray(deps);
      expect(() => changePosition()).not.toThrow();
    });

    test('positions window for bottom taskbar', () => {
      createTray(deps);
      changePosition();
      expect(screen.getDisplayNearestPoint).toHaveBeenCalled();
    });

    test('positions window for top taskbar', () => {
      vi.mocked(Positioner.getTaskbarPosition).mockReturnValue('top');
      createTray(deps);
      changePosition();
      expect(Positioner.position).toHaveBeenCalled();
    });

    test('positions window for bottom taskbar with overflow (right edge)', () => {
      vi.mocked(Positioner.getTaskbarPosition).mockReturnValue('bottom');
      mockTray.getBounds.mockReturnValue({ x: 1800, y: 1040, width: 40, height: 40 });
      vi.mocked(deps.getMainWindow).mockReturnValue({
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 420, height: 460 })),
        getPosition: vi.fn(() => [0, 0]),
        getSize: vi.fn(() => [420, 460]),
        setPosition: vi.fn(),
        hide: vi.fn(),
        show: vi.fn(),
        isVisible: vi.fn(() => false),
        loadURL: vi.fn().mockResolvedValue(undefined),
        isAlwaysOnTop: vi.fn(() => false),
        setAlwaysOnTop: vi.fn(),
        webContents: { session: { clearCache: vi.fn(), clearStorageData: vi.fn() } },
      } as any);
      createTray(deps);
      changePosition();
      expect(Positioner.calculate).toHaveBeenCalled();
    });

    test('positions window for left taskbar', () => {
      vi.mocked(Positioner.getTaskbarPosition).mockReturnValue('left');
      createTray(deps);
      changePosition();
      expect(Positioner.calculate).toHaveBeenCalled();
    });

    test('positions window for right taskbar with overflow (bottom edge)', () => {
      vi.mocked(Positioner.getTaskbarPosition).mockReturnValue('right');
      mockTray.getBounds.mockReturnValue({ x: 1880, y: 900, width: 40, height: 40 });
      vi.mocked(deps.getMainWindow).mockReturnValue({
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 420, height: 460 })),
        getPosition: vi.fn(() => [0, 0]),
        getSize: vi.fn(() => [420, 460]),
        setPosition: vi.fn(),
        hide: vi.fn(),
        show: vi.fn(),
        isVisible: vi.fn(() => false),
        loadURL: vi.fn().mockResolvedValue(undefined),
        isAlwaysOnTop: vi.fn(() => false),
        setAlwaysOnTop: vi.fn(),
        webContents: { session: { clearCache: vi.fn(), clearStorageData: vi.fn() } },
      } as any);
      createTray(deps);
      changePosition();
      expect(Positioner.calculate).toHaveBeenCalled();
    });

    test('does nothing when tray is null', () => {
      vi.mocked(deps.getMainWindow).mockReturnValue({
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 420, height: 460 })),
        getPosition: vi.fn(() => [0, 0]),
        getSize: vi.fn(() => [420, 460]),
        setPosition: vi.fn(),
      } as any);
      // Don't call createTray so tray stays null
      expect(() => changePosition()).not.toThrow();
    });
  });

  describe('reset application', () => {
    test('reset everything clears config and session', async () => {
      const mockWindow = {
        loadURL: vi.fn().mockResolvedValue(undefined),
        show: vi.fn(),
        hide: vi.fn(),
        isVisible: vi.fn(() => false),
        isAlwaysOnTop: vi.fn(() => false),
        setAlwaysOnTop: vi.fn(),
        webContents: { session: { clearCache: vi.fn().mockResolvedValue(undefined), clearStorageData: vi.fn().mockResolvedValue(undefined) } },
      };
      vi.mocked(deps.getMainWindow).mockReturnValue(mockWindow as any);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return [];
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(false);
      vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0 } as any);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const resetItem = template.find((item: any) => item.label === '⚠️ Reset Application');
      await resetItem.click();
      await vi.waitFor(() => expect(config.clear).toHaveBeenCalled());
      await vi.waitFor(() => expect(app.relaunch).toHaveBeenCalled(), { timeout: 2000 });
      expect(mockWindow.webContents.session.clearCache).toHaveBeenCalled();
      expect(mockWindow.webContents.session.clearStorageData).toHaveBeenCalled();
      expect(app.exit).toHaveBeenCalled();
    });

    test('reset windows deletes window config keys', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return [];
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(false);
      vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1 } as any);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const resetItem = template.find((item: any) => item.label === '⚠️ Reset Application');
      await resetItem.click();
      await vi.waitFor(() => expect(config.delete).toHaveBeenCalledWith('windowSize'));
      expect(config.delete).toHaveBeenCalledWith('windowSizeDetached');
      expect(config.delete).toHaveBeenCalledWith('windowPosition');
      expect(config.delete).toHaveBeenCalledWith('fullScreen');
      expect(config.delete).toHaveBeenCalledWith('detachedMode');
      expect(app.relaunch).toHaveBeenCalled();
    });

    test('cancel does nothing', async () => {
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return [];
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(false);
      vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 2 } as any);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const resetItem = template.find((item: any) => item.label === '⚠️ Reset Application');
      await resetItem.click();
      await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalled());
      expect(config.clear).not.toHaveBeenCalled();
      expect(app.relaunch).not.toHaveBeenCalled();
    });
  });

  describe('stay on top click with main window', () => {
    test('sets always on top and shows window when already on top', () => {
      const mockWindow = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 420, height: 460 })),
        getPosition: vi.fn(() => [0, 0]),
        getSize: vi.fn(() => [420, 460]),
        setPosition: vi.fn(),
        hide: vi.fn(),
        show: vi.fn(),
        isVisible: vi.fn(() => false),
        loadURL: vi.fn().mockResolvedValue(undefined),
        isAlwaysOnTop: vi.fn(() => true),
        setAlwaysOnTop: vi.fn(),
        webContents: { session: { clearCache: vi.fn(), clearStorageData: vi.fn() } },
      };
      vi.mocked(deps.getMainWindow).mockReturnValue(mockWindow as any);
      const store: Record<string, unknown> = { stayOnTop: true };
      vi.mocked(config.get).mockImplementation((key: string) => store[key] as any);
      vi.mocked(config.set).mockImplementation((key: string, val: unknown) => { store[key] = val; });
      vi.mocked(config.has).mockReturnValue(false);
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const stayItem = template.find((item: any) => item.label === 'Stay on Top');
      stayItem.click();
      expect(config.set).toHaveBeenCalledWith('stayOnTop', false);
      expect(mockWindow.setAlwaysOnTop).toHaveBeenCalledWith(false);
    });
  });

  describe('show/hide window click (linux)', () => {
    test('toggles window visibility', () => {
      const mockWindow = {
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 420, height: 460 })),
        getPosition: vi.fn(() => [0, 0]),
        getSize: vi.fn(() => [420, 460]),
        setPosition: vi.fn(),
        hide: vi.fn(),
        show: vi.fn(),
        isVisible: vi.fn(() => true),
        loadURL: vi.fn().mockResolvedValue(undefined),
        isAlwaysOnTop: vi.fn(() => false),
        setAlwaysOnTop: vi.fn(),
        webContents: { session: { clearCache: vi.fn(), clearStorageData: vi.fn() } },
      };
      vi.mocked(deps.getMainWindow).mockReturnValue(mockWindow as any);
      vi.mocked(config.get).mockImplementation((key: string) => {
        if (key === 'allInstances') return [];
        return undefined;
      });
      vi.mocked(config.has).mockReturnValue(false);
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      createTray(deps);
      getMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)![0] as any[];
      const showHideItem = template.find((item: any) => item.label === 'Show/Hide Window');
      expect(showHideItem).toBeDefined();
      showHideItem.click();
      expect(mockWindow.hide).toHaveBeenCalled();
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });
});
