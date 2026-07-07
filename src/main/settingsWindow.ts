import { BrowserWindow } from 'electron';
import logger from 'electron-log';

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: `${__dirname}/../preload/index.js`,
    },
  });

  settingsWindow.loadURL(SETTINGS_FILE);
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
