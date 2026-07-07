import { describe, test, expect } from 'vitest';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const root = path.join(__dirname, '..', '..', '..');
const metainfoFile = 'io.github.jojo_swe.homeassistant-desktop.metainfo.xml';
const metainfo = fs.readFileSync(path.join(root, metainfoFile), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const releases = new Map<string, string | undefined>(
  [...metainfo.matchAll(/<release\b([^>]*)\/?>/g)]
    .map((m) => {
      const attrs = m[1];
      const v = attrs.match(/\bversion="([^"]+)"/)?.[1];
      const d = attrs.match(/\bdate="([^"]+)"/)?.[1];
      return [v, d] as [string, string | undefined];
    })
    .filter(([v, d]) => v && d),
);

describe('releases', () => {
  test('package.json version has a release entry', () => {
    expect(releases.has(pkg.version)).toBe(true);
  });

  test.skip('every git tag has a matching release entry', () => {
    const tags = execSync('git tag -l "v*"', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);

    const missing: string[] = [];
    for (const tag of tags) {
      const version = tag.replace(/^v/, '');
      if (!releases.has(version)) {
        missing.push(tag);
      }
    }

    if (missing.length > 0) {
      console.warn(`Missing release entries for tags: ${missing.join(', ')}`);
    }
    expect(missing.length).toBe(0);
  });
});
