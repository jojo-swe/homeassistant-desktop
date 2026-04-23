#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

function fileExists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

// Read PNG dimensions from the IHDR chunk (bytes 16-23)
function pngDimensions(relPath) {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(path.join(root, relPath), 'r');
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// --- Entry points ---

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!fileExists(pkg.main)) {
  fail(`Main entry point "${pkg.main}" does not exist`);
}

for (const file of ['preload.js', 'config.js']) {
  if (!fileExists(file)) {
    fail(`Required file "${file}" does not exist`);
  }
}

// --- Application icon ---

const appIcon = 'build/icon.png';
if (!fileExists(appIcon)) {
  fail(`Application icon "${appIcon}" does not exist`);
} else {
  const { width, height } = pngDimensions(appIcon);
  if (width < 512 || height < 512) {
    fail(`${appIcon} is ${width}x${height}, must be at least 512x512 for Linux icon generation`);
  }
}

// --- Tray icons ---

for (const icon of [
  'assets/IconWin.png',
  'assets/IconWin@2x.png',
  'assets/IconTemplate.png',
  'assets/IconTemplate@2x.png',
]) {
  if (!fileExists(icon)) {
    fail(`Tray icon "${icon}" does not exist`);
  }
}

// --- Desktop shortcut (.desktop file) ---

const appId = pkg.build.appId;
const desktopPath = path.join(root, `${appId}.desktop`);
if (fs.existsSync(desktopPath)) {
  const desktop = fs.readFileSync(desktopPath, 'utf8');
  if (!desktop.includes('Terminal=false')) {
    fail(`${appId}.desktop must have Terminal=false (GUI app)`);
  }
  if (!desktop.includes('[Desktop Entry]')) {
    fail(`${appId}.desktop missing [Desktop Entry] header`);
  }
}

// --- CI workflow: targets must match package.json ---

const linuxWorkflow = fs.readFileSync(path.join(root, '.github/workflows/build-linux.yml'), 'utf8');

const linuxTargets = (pkg.build.linux?.target || []).map(t => t.toLowerCase());
const linuxArgsMatch = linuxWorkflow.match(/--linux\s+([^"]+?)(?:\s+--|\s*")/);
if (!linuxArgsMatch) {
  fail('build-linux.yml: could not locate --linux target list');
} else {
  const ciLinuxTargets = linuxArgsMatch[1].trim().split(/\s+/);
  for (const target of linuxTargets) {
    if (!ciLinuxTargets.includes(target)) {
      fail(`build-linux.yml is missing Linux target "${target}" (present in package.json)`);
    }
  }
  for (const target of ciLinuxTargets) {
    if (!linuxTargets.includes(target)) {
      fail(`build-linux.yml has Linux target "${target}" not in package.json`);
    }
  }
}

// --- Result ---

if (failures > 0) {
  process.exit(1);
}
console.log('OK: Entry points, icons, desktop shortcut, and CI workflow are consistent');
