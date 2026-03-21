const { Tray, Menu, app, screen, shell } = require('electron');
const Positioner = require('electron-traywindow-positioner');
const logger = require('electron-log');
const config = require('../config');
const haClient = require('./haClient');

const ICON_WIN = `${__dirname}/../assets/IconWin.png`;
const ICON_MAC = `${__dirname}/../assets/IconTemplate.png`;

let tray;
let _getMainWindow;
let _showWindow;
let _toggleFullScreen;
let _openSettingsWindow;
let _getCachedEntities;
let _refreshEntityCache;
let _getAutostartEnabled;
let _getUpdateCheckerInterval;
let _clearUpdateInterval;
let _useAutoUpdater;
let _forceQuit;

function init(deps) {
  _getMainWindow       = deps.getMainWindow;
  _showWindow          = deps.showWindow;
  _toggleFullScreen    = deps.toggleFullScreen;
  _openSettingsWindow  = deps.openSettingsWindow;
  _getCachedEntities   = deps.getCachedEntities;
  _refreshEntityCache  = deps.refreshEntityCache;
  _getAutostartEnabled = deps.getAutostartEnabled;
  _getUpdateCheckerInterval = deps.getUpdateCheckerInterval;
  _clearUpdateInterval = deps.clearUpdateInterval;
  _useAutoUpdater      = deps.useAutoUpdater;
  _forceQuit           = deps.forceQuit;
}

function getTray() { return tray; }

function changePosition() {
  const mainWindow = _getMainWindow();
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
      mainWindow.setPosition(displayWorkArea.width - windowBounds.width + displayWorkArea.x, y + (taskBarPosition === 'bottom' && displayWorkArea.y), false);
    }
  } else {
    const alignment = { x: taskBarPosition, y: 'center' };
    if (trayBounds.y + (trayBounds.height + windowBounds.height) / 2 < displayWorkArea.height) {
      const { x, y } = Positioner.calculate(mainWindow.getBounds(), trayBounds, alignment);
      mainWindow.setPosition(x + (taskBarPosition === 'right' && displayWorkArea.x), y);
    } else {
      const { x } = Positioner.calculate(mainWindow.getBounds(), trayBounds, alignment);
      mainWindow.setPosition(x, displayWorkArea.y + displayWorkArea.height - windowBounds.height, false);
    }
  }
}

function setWindowFocusTimer() {
  const mainWindow = _getMainWindow();
  setTimeout(() => {
    const mousePos = screen.getCursorScreenPoint();
    const windowPosition = mainWindow.getPosition();
    const windowSize = mainWindow.getSize();
    const inWindow =
      mousePos.x >= windowPosition[0] && mousePos.x <= windowPosition[0] + windowSize[0] &&
      mousePos.y >= windowPosition[1] && mousePos.y <= windowPosition[1] + windowSize[1];

    if (!inWindow) {
      mainWindow.hide();
    } else {
      setWindowFocusTimer();
    }
  }, 110);
}

function getMenu() {
  const mainWindow = _getMainWindow();

  // ── Instances ─────────────────────────────────────────────────
  const currentInstance = () => {
    if (config.has('currentInstance')) return config.get('allInstances')[config.get('currentInstance')];
    return false;
  };

  let instancesMenu = [
    {
      label: 'Open in Browser',
      enabled: !!currentInstance(),
      click: async () => shell.openExternal(currentInstance()),
    },
    { type: 'separator' },
  ];

  const allInstances = config.get('allInstances');
  if (allInstances?.length) {
    allInstances.forEach((e) => {
      instancesMenu.push({
        label: e,
        type: 'checkbox',
        checked: currentInstance() === e,
        click: async () => {
          config.set('currentInstance', config.get('allInstances').indexOf(e));
          await mainWindow.loadURL(e);
          mainWindow.show();
        },
      });
    });

    instancesMenu.push(
      { type: 'separator' },
      {
        label: 'Add another Instance...',
        click: async () => {
          config.delete('currentInstance');
          await mainWindow.loadURL(`file://${__dirname}/../web/index.html`);
          mainWindow.show();
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

  // ── Quick Actions ──────────────────────────────────────────────
  const pinned = config.get('pinnedEntities') || [];
  const cachedEntities = _getCachedEntities();
  const quickActions = pinned.length > 0
    ? pinned.map(entityId => {
        const entity = cachedEntities.find(e => e.entity_id === entityId);
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

  const quickActionsMenu = [
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

  return Menu.buildFromTemplate([
    {
      label: 'Show/Hide Window',
      visible: process.platform === 'linux',
      click: () => mainWindow.isVisible() ? mainWindow.hide() : _showWindow(),
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
        mainWindow.setAlwaysOnTop(config.get('stayOnTop'));
        if (mainWindow.isAlwaysOnTop()) _showWindow();
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
        mainWindow.hide();
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
    { type: 'separator' },
    {
      label: 'Restart Application',
      click: () => { app.relaunch(); app.exit(); },
    },
    {
      label: '⚠️ Reset Application',
      click: () => {
        const { dialog } = require('electron');
        dialog.showMessageBox({
          message: 'Are you sure you want to reset Home Assistant Desktop?',
          buttons: ['Reset Everything!', 'Reset Windows', 'Cancel'],
        }).then(async (res) => {
          if (res.response !== 2) {
            if (res.response === 0) {
              config.clear();
              await mainWindow.webContents.session.clearCache();
              await mainWindow.webContents.session.clearStorageData();
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
      click: () => { _forceQuit(); app.quit(); },
    },
  ]);
}

function createTray(deps) {
  if (tray instanceof Tray) return;

  init(deps);

  logger.info('Initialized Tray menu');
  tray = new Tray(
    ['win32', 'linux'].includes(process.platform) ? ICON_WIN : ICON_MAC,
  );

  tray.on('click', () => {
    const mainWindow = _getMainWindow();
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      if (process.platform === 'darwin') app.dock.hide();
    } else {
      _showWindow();
    }
  });

  tray.on('right-click', () => {
    const mainWindow = _getMainWindow();
    if (!config.get('detachedMode')) mainWindow.hide();
    tray.popUpContextMenu(getMenu());
  });

  let timer;
  tray.on('mouse-move', () => {
    if (config.get('detachedMode') || _getMainWindow().isAlwaysOnTop() || config.get('disableHover')) return;
    if (!_getMainWindow().isVisible()) _showWindow();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const mousePos = screen.getCursorScreenPoint();
      const trayBounds = tray.getBounds();
      const inTray =
        mousePos.x >= trayBounds.x && mousePos.x <= trayBounds.x + trayBounds.width &&
        mousePos.y >= trayBounds.y && mousePos.y <= trayBounds.y + trayBounds.height;
      if (!inTray) setWindowFocusTimer();
    }, 100);
  });
}

module.exports = { createTray, getTray, getMenu, changePosition };
