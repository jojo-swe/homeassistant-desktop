import { Tray, Menu, app, screen, shell, dialog, BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import Positioner from 'electron-traywindow-positioner';
import logger from 'electron-log';
import config from './config';
import * as haClient from './haClient';
import type { HAEntity, TrayInitDeps } from './types';

const ICON_WIN = `${__dirname}/../../assets/IconWin.png`;
const ICON_MAC = `${__dirname}/../../assets/IconTemplate.png`;

let tray: Tray | null = null;
let _getMainWindow: () => BrowserWindow | null;
let _showWindow: () => void;
let _toggleFullScreen: () => void;
let _openSettingsWindow: () => void;
let _getCachedEntities: () => HAEntity[];
let _refreshEntityCache: () => Promise<void>;
let _getAutostartEnabled: () => boolean;
let _getUpdateCheckerInterval: () => NodeJS.Timeout | null;
let _clearUpdateInterval: () => void;
let _useAutoUpdater: () => Promise<void>;
let _forceQuit: () => void;

function init(deps: TrayInitDeps): void {
  _getMainWindow = deps.getMainWindow;
  _showWindow = deps.showWindow;
  _toggleFullScreen = deps.toggleFullScreen;
  _openSettingsWindow = deps.openSettingsWindow;
  _getCachedEntities = deps.getCachedEntities;
  _refreshEntityCache = deps.refreshEntityCache;
  _getAutostartEnabled = deps.getAutostartEnabled;
  _getUpdateCheckerInterval = deps.getUpdateCheckerInterval;
  _clearUpdateInterval = deps.clearUpdateInterval;
  _useAutoUpdater = deps.useAutoUpdater;
  _forceQuit = deps.forceQuit;
}

function getTray(): Tray | null {
  return tray;
}

function changePosition(): void {
  const mainWindow = _getMainWindow();
  if (!mainWindow || !tray) return;
  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const displayWorkArea = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y }).workArea;
  const taskBarPosition = Positioner.getTaskbarPosition(trayBounds);

  if (taskBarPosition === 'top' || taskBarPosition === 'bottom') {
    const alignment = { x: 'center', y: taskBarPosition === 'top' ? 'up' : 'down' };
    if (trayBounds.x + (trayBounds.width + windowBounds.width) / 2 < displayWorkArea.width) {
      Positioner.position(mainWindow, trayBounds, alignment);
    } else {
      const { y } = Positioner.calculate(mainWindow.getBounds(), trayBounds, alignment);
      mainWindow.setPosition(
        displayWorkArea.width - windowBounds.width + displayWorkArea.x,
        y + (taskBarPosition === 'bottom' ? displayWorkArea.y : 0),
        false,
      );
    }
  } else {
    const alignment = { x: taskBarPosition, y: 'center' };
    if (trayBounds.y + (trayBounds.height + windowBounds.height) / 2 < displayWorkArea.height) {
      const { x, y } = Positioner.calculate(mainWindow.getBounds(), trayBounds, alignment);
      mainWindow.setPosition(x + (taskBarPosition === 'right' ? displayWorkArea.x : 0), y);
    } else {
      const { x } = Positioner.calculate(mainWindow.getBounds(), trayBounds, alignment);
      mainWindow.setPosition(x, displayWorkArea.y + displayWorkArea.height - windowBounds.height, false);
    }
  }
}

function setWindowFocusTimer(): void {
  const mainWindow = _getMainWindow();
  if (!mainWindow) return;
  setTimeout(() => {
    if (!mainWindow) return;
    const mousePos = screen.getCursorScreenPoint();
    const windowPosition = mainWindow.getPosition();
    const windowSize = mainWindow.getSize();
    const inWindow =
      mousePos.x >= windowPosition[0] &&
      mousePos.x <= windowPosition[0] + windowSize[0] &&
      mousePos.y >= windowPosition[1] &&
      mousePos.y <= windowPosition[1] + windowSize[1];

    if (!inWindow) {
      mainWindow.hide();
    } else {
      setWindowFocusTimer();
    }
  }, 110);
}

function getMenu(): Menu {
  const mainWindow = _getMainWindow();

  const getCurrentInstance = (): string | false => {
    if (config.has('currentInstance')) {
      const idx = config.get('currentInstance');
      if (idx === undefined) return false;
      return config.get('allInstances')[idx] ?? false;
    }
    return false;
  };

  let instancesMenu: MenuItemConstructorOptions[] = [
    {
      label: 'Open in Browser',
      enabled: !!getCurrentInstance(),
      click: async () => {
        const inst = getCurrentInstance();
        if (inst) await shell.openExternal(inst);
      },
    },
    { type: 'separator' },
  ];

  const allInstances = config.get('allInstances');
  if (allInstances?.length) {
    allInstances.forEach((e) => {
      instancesMenu.push({
        label: e,
        type: 'checkbox',
        checked: getCurrentInstance() === e,
        click: async () => {
          config.set('currentInstance', config.get('allInstances').indexOf(e));
          if (mainWindow) {
            await mainWindow.loadURL(e);
            mainWindow.show();
          }
        },
      });
    });

    instancesMenu.push(
      { type: 'separator' },
      {
        label: 'Add another Instance...',
        click: async () => {
          config.delete('currentInstance');
          if (mainWindow) {
            await mainWindow.loadURL(`file://${__dirname}/../renderer/index.html`);
            mainWindow.show();
          }
        },
      },
      {
        label: 'Automatic Switching',
        type: 'checkbox',
        enabled: allInstances.length > 1,
        checked: config.get('automaticSwitching'),
        click: () => config.set('automaticSwitching', !config.get('automaticSwitching')),
      },
    );
  } else {
    instancesMenu.push({ label: 'Not Connected...', enabled: false });
  }

  const pinned = config.get('pinnedEntities') || [];
  const cachedEntities = _getCachedEntities();
  const quickActions: MenuItemConstructorOptions[] =
    pinned.length > 0
      ? pinned.map((entityId) => {
          const entity = cachedEntities.find((e) => e.entity_id === entityId);
          const name = entity?.name || entityId;
          const isOn = entity?.state === 'on';
          return {
            label: `${isOn ? '●' : '○'} ${name}`,
            click: async () => {
              await haClient.toggle(entityId);
              setTimeout(_refreshEntityCache, 800);
            },
          };
        })
      : [{ label: 'No entities pinned — open Settings', enabled: false }];

  const quickActionsMenu: MenuItemConstructorOptions[] = [
    { type: 'separator' },
    {
      label: '⚡ Quick Actions',
      submenu: [
        ...quickActions,
        { type: 'separator' },
        { label: 'Manage Quick Actions...', click: () => _openSettingsWindow() },
      ],
    },
  ];

  const haConfigured = config.has('haBaseUrl') && config.get('haBaseUrl');
  const statusLabel = haConfigured ? '🟢 Connected' : '🔴 Not Connected';

  return Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    {
      label: 'Show/Hide Window',
      visible: process.platform === 'linux',
      click: () => {
        if (mainWindow) {
          mainWindow.isVisible() ? mainWindow.hide() : _showWindow();
        }
      },
    },
    { visible: process.platform === 'linux', type: 'separator' },
    ...instancesMenu,
    ...quickActionsMenu,
    { type: 'separator' },
    {
      label: 'Hover to Show',
      visible: process.platform !== 'linux' && !config.get('detachedMode'),
      enabled: !config.get('detachedMode'),
      type: 'checkbox',
      checked: !config.get('disableHover'),
      click: () => config.set('disableHover', !config.get('disableHover')),
    },
    {
      label: 'Stay on Top',
      type: 'checkbox',
      checked: config.get('stayOnTop'),
      click: () => {
        config.set('stayOnTop', !config.get('stayOnTop'));
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(config.get('stayOnTop'));
          if (mainWindow.isAlwaysOnTop()) _showWindow();
        }
      },
    },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: _getAutostartEnabled(),
      click: () => {
        app.setLoginItemSettings({ openAtLogin: !_getAutostartEnabled() });
      },
    },
    {
      label: 'Enable Shortcut',
      type: 'checkbox',
      accelerator: 'CommandOrControl+Alt+X',
      checked: config.get('shortcutEnabled'),
      click: () => {
        config.set('shortcutEnabled', !config.get('shortcutEnabled'));
      },
    },
    { type: 'separator' },
    {
      label: 'Use detached Window',
      type: 'checkbox',
      checked: config.get('detachedMode'),
      click: async () => {
        config.set('detachedMode', !config.get('detachedMode'));
        mainWindow?.hide();
      },
    },
    {
      label: 'Use Fullscreen',
      type: 'checkbox',
      checked: config.get('fullScreen'),
      accelerator: 'CommandOrControl+Alt+Return',
      click: () => _toggleFullScreen(),
    },
    { type: 'separator' },
    {
      label: '🎨 Theme',
      submenu: [
        {
          label: 'Dark',
          type: 'radio',
          checked: config.get('theme') !== 'light',
          click: () => {
            config.set('theme', 'dark');
            applyThemeToAllWindows('dark');
          },
        },
        {
          label: 'Light',
          type: 'radio',
          checked: config.get('theme') === 'light',
          click: () => {
            config.set('theme', 'light');
            applyThemeToAllWindows('light');
          },
        },
      ],
    },
    { type: 'separator' },
    { label: `v${app.getVersion()}`, enabled: false },
    {
      label: 'Automatic Updates',
      type: 'checkbox',
      checked: config.get('autoUpdate'),
      click: async () => {
        const currentStatus = config.get('autoUpdate');
        config.set('autoUpdate', !currentStatus);
        if (currentStatus) {
          _clearUpdateInterval();
        } else {
          await _useAutoUpdater();
        }
      },
    },
    {
      label: 'Open on github.com',
      click: async () => shell.openExternal('https://github.com/jojo-swe/homeassistant-desktop'),
    },
    { type: 'separator' },
    { label: '⚙ Settings', click: () => _openSettingsWindow() },
    {
      label: '↻ Refresh Entities',
      click: async () => {
        await _refreshEntityCache();
      },
    },
    { type: 'separator' },
    {
      label: 'Restart Application',
      click: () => {
        app.relaunch();
        app.exit();
      },
    },
    {
      label: '⚠️ Reset Application',
      click: () => {
        dialog
          .showMessageBox({
            message: 'Are you sure you want to reset Home Assistant Desktop?',
            buttons: ['Reset Everything!', 'Reset Windows', 'Cancel'],
          })
          .then(async (res: { response: number }) => {
            if (res.response !== 2) {
              if (res.response === 0) {
                config.clear();
                if (mainWindow) {
                  await mainWindow.webContents.session.clearCache();
                  await mainWindow.webContents.session.clearStorageData();
                }
              } else {
                config.delete('windowSizeDetached');
                config.delete('windowSize');
                config.delete('windowPosition');
                config.delete('fullScreen');
                config.delete('detachedMode');
              }
              app.relaunch();
              app.exit();
            }
          });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        _forceQuit();
        app.quit();
      },
    },
  ]);
}

function applyThemeToAllWindows(theme: 'dark' | 'light'): void {
  const mainWindow = _getMainWindow();
  const windows = [mainWindow, ...BrowserWindow.getAllWindows().filter((w) => w !== mainWindow)];
  for (const win of windows) {
    if (!win || win.isDestroyed()) continue;
    const code = theme === 'light'
      ? "document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('settings-theme', 'light');"
      : "document.documentElement.removeAttribute('data-theme'); localStorage.setItem('settings-theme', 'dark');";
    win.webContents.executeJavaScript(code).catch(() => {});
  }
}

function createTray(deps: TrayInitDeps): void {
  init(deps);
  tray = new Tray(process.platform === 'darwin' ? ICON_MAC : ICON_WIN);
  tray.setToolTip('Home Assistant Desktop');
  tray.setContextMenu(getMenu());
  if (process.platform !== 'linux') {
    tray.on('click', () => _showWindow());
  }
}

export { createTray, getTray, getMenu, changePosition, setWindowFocusTimer };
