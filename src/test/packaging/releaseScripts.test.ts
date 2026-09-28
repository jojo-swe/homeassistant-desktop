import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const root = path.join(__dirname, '..', '..', '..');
const { prepare, manifestReferences } = require(path.join(root, 'scripts', 'prepare-release-assets.cjs'));
const { extractSection } = require(path.join(root, 'scripts', 'release-notes.cjs'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function manifest(...files: string[]): string {
  return [
    'version: 2.0.0',
    'files:',
    ...files.flatMap((f) => [`  - url: ${f}`, '    sha512: abc', '    size: 1']),
    `path: ${files[0]}`,
    'sha512: abc',
  ].join('\n');
}

describe('prepare-release-assets', () => {
  let tmp: string;

  function write(rel: string, content = 'x'): void {
    const file = path.join(tmp, 'artifacts', rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-assets-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('parses url and path entries from a manifest', () => {
    expect(manifestReferences(manifest('a.exe', 'b.zip')).sort()).toEqual(['a.exe', 'b.zip']);
  });

  test('flattens artifacts and accepts manifests whose files are all present', () => {
    write('windows/app-v2.0.0-win.exe');
    write('windows/latest.yml', manifest('app-v2.0.0-win.exe'));
    write('linux/app-v2.0.0-linux-x86_64.AppImage');
    write('linux/latest-linux.yml', manifest('app-v2.0.0-linux-x86_64.AppImage'));

    const { files, errors } = prepare(path.join(tmp, 'artifacts'), path.join(tmp, 'out'), {
      requiredManifests: ['latest.yml', 'latest-linux.yml'],
    });

    expect(errors).toEqual([]);
    expect(files).toContain('latest.yml');
    expect(fs.existsSync(path.join(tmp, 'out', 'app-v2.0.0-win.exe'))).toBe(true);
  });

  test('reports a manifest that points at a file missing from the release', () => {
    write('mac/latest-mac.yml', manifest('app-v2.0.0-mac-arm64.zip'));
    const { errors } = prepare(path.join(tmp, 'artifacts'), path.join(tmp, 'out'), {
      requiredManifests: ['latest-mac.yml'],
    });
    expect(errors).toEqual([expect.stringContaining('references "app-v2.0.0-mac-arm64.zip"')]);
  });

  test('reports duplicate file names from different jobs (e.g. two latest.yml)', () => {
    write('win-x64/latest.yml', manifest('a.exe'));
    write('win-arm64/latest.yml', manifest('a.exe'));
    write('win-x64/a.exe');
    const { errors } = prepare(path.join(tmp, 'artifacts'), path.join(tmp, 'out'), {
      requiredManifests: ['latest.yml'],
    });
    expect(errors).toEqual([expect.stringContaining('Duplicate asset "latest.yml"')]);
  });

  test('reports asset names with spaces, which GitHub renames', () => {
    write('win/Home Assistant Desktop.exe');
    write('win/latest.yml', manifest('Home Assistant Desktop.exe'));
    const { errors } = prepare(path.join(tmp, 'artifacts'), path.join(tmp, 'out'), {
      requiredManifests: ['latest.yml'],
    });
    expect(errors).toEqual([expect.stringContaining('whitespace')]);
  });

  test('requires every platform manifest by default', () => {
    write('linux/latest-linux.yml', manifest('x.AppImage'));
    write('linux/x.AppImage');
    const { errors } = prepare(path.join(tmp, 'artifacts'), path.join(tmp, 'out'));
    expect(errors).toEqual(
      expect.arrayContaining([
        'Missing update manifest latest.yml',
        'Missing update manifest latest-mac.yml',
        'Missing update manifest latest-linux-arm64.yml',
      ])
    );
  });
});

describe('release artifact naming', () => {
  test('artifact names contain no spaces, so update manifests match uploaded asset names', () => {
    const patterns = [pkg.build.artifactName, pkg.build.portable?.artifactName].filter(Boolean);
    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      expect(pattern).not.toContain('${productName}');
      expect(pattern).not.toMatch(/\s/);
    }
  });
});

describe('release-notes', () => {
  const changelog = [
    '# Changelog',
    '',
    '## [2.0.0] - 2026-09-28',
    '',
    '### Fixed',
    '- Thing',
    '',
    '## [2.0.0-beta.1] - 2026-07-09',
    '',
    '- Beta thing',
  ].join('\n');

  test('extracts exactly one version section', () => {
    expect(extractSection(changelog, '2.0.0')).toBe('### Fixed\n- Thing');
  });

  test('does not confuse a version with its prerelease', () => {
    expect(extractSection(changelog, '2.0.0-beta.1')).toBe('- Beta thing');
  });

  test('returns null for an unknown version', () => {
    expect(extractSection(changelog, '9.9.9')).toBeNull();
  });

  test('CHANGELOG.md has notes for the current package version', () => {
    const real = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
    expect(extractSection(real, pkg.version)).toBeTruthy();
  });
});
