declare module 'electron-traywindow-positioner' {
  import type { BrowserWindow, Rectangle } from 'electron';

  export function getTaskbarPosition(trayBounds: Rectangle): string;
  export function position(mainWindow: BrowserWindow, trayBounds: Rectangle, alignment: { x: string; y: string }): void;
  export function calculate(
    windowBounds: Rectangle,
    trayBounds: Rectangle,
    alignment: { x: string; y: string }
  ): { x: number; y: number };
}
