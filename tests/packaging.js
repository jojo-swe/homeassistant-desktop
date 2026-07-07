#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

// --- Load files ---

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appId = pkg.build?.appId;

const desktopFile = `${appId}.desktop`;
const metainfoFile = `${appId}.metainfo.xml`;
const flatpakFile = `${appId}.yml`;

function readOrFail(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch (e) {
    fail(`${file} could not be read: ${e.message}`);
    return '';
  }
}

const desktop = appId ? readOrFail(desktopFile) : '';
const metainfo = appId ? readOrFail(metainfoFile) : '';
const flatpak = appId ? readOrFail(flatpakFile) : '';

// --- package.json: general build config ---

if (!appId) {
  fail('package.json build.appId is missing');
}

if (!pkg.build.productName) {
  fail('package.json build.productName is missing');
}

// --- package.json: macOS build targets ---

const macTargets = (pkg.build.mac?.target || []).map((t) => t.toLowerCase());
for (const expected of ['dmg', 'zip']) {
  if (!macTargets.includes(expected)) {
    fail(`package.json mac.target missing "${expected}"`);
  }
}

if (!pkg.build.mac?.category) {
  fail('package.json mac.category is missing');
}

// --- package.json: Windows build targets ---

const winTargets = (pkg.build.win?.target || []).map((t) => t.toLowerCase());
for (const expected of ['nsis', 'zip']) {
  if (!winTargets.includes(expected)) {
    fail(`package.json win.target missing "${expected}"`);
  }
}

// --- package.json: Linux build targets ---

const linuxTargets = (pkg.build.linux?.target || []).map((t) => t.toLowerCase());
for (const expected of ['appimage', 'deb', 'rpm']) {
  if (!linuxTargets.includes(expected)) {
    fail(`package.json linux.target missing "${expected}"`);
  }
}

if (!pkg.build.linux?.category) {
  fail('package.json linux.category is missing (required for .desktop file)');
}

if (!pkg.build.linux?.desktop?.StartupWMClass) {
  fail('package.json linux.desktop.StartupWMClass is missing');
}

// --- package.json: deb dependencies ---

const debDeps = pkg.build.deb?.depends || [];
if (!debDeps.includes('libayatana-appindicator3-1')) {
  fail('package.json deb.depends missing "libayatana-appindicator3-1" (required for tray icon)');
}

// --- .desktop file: required fields ---

for (const field of ['Name', 'Exec', 'Icon', 'Type', 'Categories', 'StartupWMClass']) {
  if (!desktop.includes(`${field}=`)) {
    fail(`${desktopFile} missing required field "${field}"`);
  }
}

// --- .desktop file: Icon must match app ID ---

const iconMatch = desktop.match(/^Icon=(.+)$/m);
if (iconMatch && iconMatch[1] !== appId) {
  fail(`${desktopFile} Icon="${iconMatch[1]}" does not match app ID "${appId}"`);
}

// --- metainfo.xml: required elements ---

for (const element of ['<id>', '<name>', '<summary>', '<project_license>', '<description>', '<releases>']) {
  if (!metainfo.includes(element)) {
    fail(`${metainfoFile} missing required element "${element}"`);
  }
}

// --- metainfo.xml: id must match app ID ---

const idMatch = metainfo.match(/<id>([^<]+)<\/id>/);
if (idMatch && idMatch[1] !== appId) {
  fail(`${metainfoFile} <id>${idMatch[1]}</id> does not match app ID "${appId}"`);
}

// --- metainfo.xml: launchable must reference .desktop file ---

const launchableMatch = metainfo.match(/<launchable[^>]*>([^<]+)<\/launchable>/);
if (launchableMatch && launchableMatch[1] !== desktopFile) {
  fail(`${metainfoFile} launchable "${launchableMatch[1]}" does not match "${desktopFile}"`);
}

// --- metainfo.xml: license must match package.json ---

const licenseMatch = metainfo.match(/<project_license>([^<]+)<\/project_license>/);
if (licenseMatch && licenseMatch[1] !== pkg.license) {
  fail(`${metainfoFile} project_license "${licenseMatch[1]}" does not match package.json license "${pkg.license}"`);
}

// --- Flatpak manifest: valid YAML ---

try {
  require('yaml').parse(flatpak);
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.warn(`SKIP: ${flatpakFile} YAML validation skipped (install the "yaml" package to enable)`);
  } else {
    fail(`${flatpakFile} is not valid YAML: ${e.message}`);
  }
}

// --- Flatpak manifest: required top-level keys ---

for (const key of ['app-id', 'runtime', 'sdk', 'command', 'finish-args', 'modules']) {
  if (!flatpak.match(new RegExp(`^${key}:`, 'm'))) {
    fail(`${flatpakFile} missing required key "${key}"`);
  }
}

// --- Flatpak manifest: app-id must match ---

const flatpakIdMatch = flatpak.match(/^app-id:\s*(.+)$/m);
if (flatpakIdMatch && flatpakIdMatch[1] !== appId) {
  fail(`${flatpakFile} app-id "${flatpakIdMatch[1]}" does not match "${appId}"`);
}

// --- Flatpak manifest: must reference .desktop and metainfo files ---

if (!flatpak.includes(desktopFile)) {
  fail(`${flatpakFile} does not reference ${desktopFile}`);
}
if (!flatpak.includes(metainfoFile)) {
  fail(`${flatpakFile} does not reference ${metainfoFile}`);
}

// --- Result ---

if (failures > 0) {
  process.exit(1);
}
console.log(`OK: Packaging configuration is consistent (app ID: ${appId})`);
