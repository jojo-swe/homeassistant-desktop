import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..', '..');

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(root, relPath));
}

function pngDimensions(relPath: string): { width: number; height: number } {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(path.join(root, relPath), 'r');
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

describe('assets', () => {
  test('application icon exists and is at least 512x512', () => {
    const appIcon = 'build/icon.png';
    expect(fileExists(appIcon)).toBe(true);
    const { width, height } = pngDimensions(appIcon);
    expect(width).toBeGreaterThanOrEqual(512);
    expect(height).toBeGreaterThanOrEqual(512);
  });

  test('tray icons exist', () => {
    for (const icon of [
      'assets/IconWin.png',
      'assets/IconWin@2x.png',
      'assets/IconTemplate.png',
      'assets/IconTemplate@2x.png',
    ]) {
      expect(fileExists(icon)).toBe(true);
    }
  });

  test('desktop file has required fields', () => {
    const appId = pkg.build.appId;
    const desktopPath = path.join(root, `${appId}.desktop`);
    if (fs.existsSync(desktopPath)) {
      const desktop = fs.readFileSync(desktopPath, 'utf8');
      expect(desktop).toContain('Terminal=false');
      expect(desktop).toContain('[Desktop Entry]');
    }
  });

  test('CI workflow Linux targets match package.json', () => {
    const buildWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'build.yml'), 'utf8');
    const linuxTargets = (pkg.build.linux?.target || []).map((t: string) => t.toLowerCase());
    const linuxArgsMatch = buildWorkflow.match(/--linux\s+([^"]+?)(?:\s+--|\s*")/);
    if (linuxArgsMatch) {
      const ciLinuxTargets = linuxArgsMatch[1].trim().split(/\s+/).map((t: string) => t.toLowerCase());
      for (const target of linuxTargets) {
        expect(ciLinuxTargets).toContain(target);
      }
      for (const target of ciLinuxTargets) {
        expect(linuxTargets).toContain(target);
      }
    }
  });
});
