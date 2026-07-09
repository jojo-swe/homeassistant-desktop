import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..', '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appId = pkg.build?.appId;

function readOrFail(file: string): string {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return '';
  }
}

const desktopFile = `${appId}.desktop`;
const metainfoFile = `${appId}.metainfo.xml`;
const flatpakFile = `${appId}.yml`;
const desktop = appId ? readOrFail(desktopFile) : '';
const metainfo = appId ? readOrFail(metainfoFile) : '';
const flatpak = appId ? readOrFail(flatpakFile) : '';

describe('packaging', () => {
  test('package.json has appId', () => {
    expect(appId).toBeTruthy();
  });

  test('package.json has productName', () => {
    expect(pkg.build.productName).toBeTruthy();
  });

  test('macOS targets include dmg and zip', () => {
    const macTargets = (pkg.build.mac?.target || []).map((t: string) => t.toLowerCase());
    expect(macTargets).toContain('dmg');
    expect(macTargets).toContain('zip');
  });

  test('macOS has category', () => {
    expect(pkg.build.mac?.category).toBeTruthy();
  });

  test('Windows targets include nsis, zip, and portable', () => {
    const winTargets = (pkg.build.win?.target || []).map((t: string) => t.toLowerCase());
    expect(winTargets).toContain('nsis');
    expect(winTargets).toContain('zip');
    expect(winTargets).toContain('portable');
  });

  test('NSIS installer is non-one-click with directory selection', () => {
    expect(pkg.build.nsis?.oneClick).toBe(false);
    expect(pkg.build.nsis?.allowToChangeInstallationDirectory).toBe(true);
  });

  test('Linux targets include AppImage, deb, and rpm', () => {
    const linuxTargets = (pkg.build.linux?.target || []).map((t: string) => t.toLowerCase());
    expect(linuxTargets).toContain('appimage');
    expect(linuxTargets).toContain('deb');
    expect(linuxTargets).toContain('rpm');
  });

  test('Linux has category', () => {
    expect(pkg.build.linux?.category).toBeTruthy();
  });

  test('deb depends on libayatana-appindicator3-1', () => {
    const debDeps = pkg.build.deb?.depends || [];
    expect(debDeps).toContain('libayatana-appindicator3-1');
  });

  test('desktop file has required fields', () => {
    for (const field of ['Name', 'Exec', 'Icon', 'Type', 'Categories', 'StartupWMClass']) {
      expect(desktop).toContain(`${field}=`);
    }
  });

  test('desktop file Icon matches appId', () => {
    const iconMatch = desktop.match(/^Icon=(.+)$/m);
    if (iconMatch) {
      expect(iconMatch[1]).toBe(appId);
    }
  });

  test('metainfo.xml has required elements', () => {
    for (const element of ['<id>', '<name>', '<summary>', '<project_license>', '<description>', '<releases>']) {
      expect(metainfo).toContain(element);
    }
  });

  test('metainfo.xml id matches appId', () => {
    const idMatch = metainfo.match(/<id>([^<]+)<\/id>/);
    if (idMatch) {
      expect(idMatch[1]).toBe(appId);
    }
  });

  test('metainfo.xml launchable references desktop file', () => {
    const launchableMatch = metainfo.match(/<launchable[^>]*>([^<]+)<\/launchable>/);
    if (launchableMatch) {
      expect(launchableMatch[1]).toBe(desktopFile);
    }
  });

  test('metainfo.xml license matches package.json', () => {
    const licenseMatch = metainfo.match(/<project_license>([^<]+)<\/project_license>/);
    if (licenseMatch) {
      expect(licenseMatch[1]).toBe(pkg.license);
    }
  });

  test('flatpak manifest has required keys', () => {
    for (const key of ['app-id', 'runtime', 'sdk', 'command', 'finish-args', 'modules']) {
      expect(flatpak).toMatch(new RegExp(`^${key}:`, 'm'));
    }
  });

  test('flatpak app-id matches appId', () => {
    const flatpakIdMatch = flatpak.match(/^app-id:\s*(.+)$/m);
    if (flatpakIdMatch) {
      expect(flatpakIdMatch[1]).toBe(appId);
    }
  });

  test('flatpak references desktop and metainfo files', () => {
    expect(flatpak).toContain(desktopFile);
    expect(flatpak).toContain(metainfoFile);
  });
});
