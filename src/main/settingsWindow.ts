import { BrowserWindow } from 'electron';

const SETTINGS_FILE = `file://${__dirname}/../renderer/settings/index.html`;

let settingsWindow: BrowserWindow | null = null;

function openSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 460,
    height: 640,
    minWidth: 420,
    minHeight: 500,
    title: 'Home Assistant Desktop — Settings',
    autoHideMenuBar: true,
    resizable: true,
    skipTaskbar: false,
    frame: process.platform === 'darwin' ? false : undefined,
    titleBarStyle: process.platform !== 'darwin' ? 'hidden' : undefined,
    titleBarOverlay: process.platform === 'win32'
      ? { color: 'rgba(0,0,0,0)', symbolColor: '#e8e8f0', height: 40 }
      : undefined,
    transparent: process.platform === 'darwin',
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: `${__dirname}/../preload/index.js`,
    },
  });

  settingsWindow.loadURL(SETTINGS_FILE);
  settingsWindow.webContents.on('did-finish-load', async () => {
    if (!settingsWindow || settingsWindow.isDestroyed()) return;
    await settingsWindow.webContents.executeJavaScript(
      `document.documentElement.setAttribute('data-platform', '${process.platform}');`
    );
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}

function closeSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.close();
    settingsWindow = null;
  }
}

export { openSettingsWindow, getSettingsWindow, closeSettingsWindow };
