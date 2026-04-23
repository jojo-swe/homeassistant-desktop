#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const metainfoFile = 'io.github.jojo_swe.homeassistant-desktop.metainfo.xml';
let failures = 0;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

// Parse <release version="..." date="..."> entries from metainfo.xml
const metainfo = fs.readFileSync(path.join(__dirname, '..', metainfoFile), 'utf8');
const releases = new Map(
  [...metainfo.matchAll(/<release\b([^>]*)\/?>/g)].map(m => {
    const attrs = m[1];
    const v = attrs.match(/\bversion="([^"]+)"/)?.[1];
    const d = attrs.match(/\bdate="([^"]+)"/)?.[1];
    return [v, d];
  }).filter(([v, d]) => v && d),
);

// 1. package.json version must have a release entry
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
if (!releases.has(pkg.version)) {
  fail(`package.json version ${pkg.version} has no <release> entry in ${metainfoFile}`);
}

// 2. Every v* git tag must have a release entry with the correct date
const tags = execSync('git tag -l "v*"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

for (const tag of tags) {
  const version = tag.replace(/^v/, '');
  if (!releases.has(version)) {
    fail(`Git tag ${tag} has no <release> entry in ${metainfoFile}`);
    continue;
  }

  const tagDate = execSync(`git tag -l "${tag}" --format="%(creatordate:short)"`, {
    encoding: 'utf8',
  }).trim();
  if (!tagDate) {
    fail(`Git tag ${tag} has no date (shallow clone or missing tag object)`);
    continue;
  }
  const metainfoDate = releases.get(version);
  if (tagDate !== metainfoDate) {
    fail(`Release ${version} date "${metainfoDate}" does not match git tag date "${tagDate}"`);
  }
}

if (failures > 0) {
  process.exit(1);
}
console.log(`OK: ${metainfoFile} has matching release entries for package.json v${pkg.version} and ${tags.length} git tag(s)`);
