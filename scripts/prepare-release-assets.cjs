#!/usr/bin/env node
/**
 * Flattens the per-platform build artifacts into one directory for the GitHub release and checks
 * that auto-update will work once published:
 *   - every update manifest (latest*.yml) electron-updater looks for is present
 *   - every file a manifest references is part of the release
 *   - no two jobs produced a file with the same name (one would silently overwrite the other)
 *   - no asset name contains whitespace (GitHub renames those, breaking manifest URLs)
 *
 * Usage: node scripts/prepare-release-assets.cjs <artifacts-dir> <output-dir>
 */
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_MANIFESTS = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml', 'latest-linux-arm64.yml'];

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/** File names referenced by an electron-builder update manifest (`url:` and `path:` entries). */
function manifestReferences(content) {
  const refs = new Set();
  for (const match of content.matchAll(/^\s*(?:-\s+)?(?:url|path):\s*(.+?)\s*$/gm)) {
    refs.add(match[1].replace(/^['"]|['"]$/g, ''));
  }
  return [...refs];
}

function prepare(srcDir, outDir, { requiredManifests = REQUIRED_MANIFESTS } = {}) {
  const errors = [];
  const sources = new Map();
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of listFiles(srcDir)) {
    const name = path.basename(file);
    if (sources.has(name)) {
      errors.push(`Duplicate asset "${name}" from ${sources.get(name)} and ${file}`);
      continue;
    }
    if (/\s/.test(name)) {
      errors.push(`Asset name contains whitespace (GitHub would rename it): "${name}"`);
    }
    sources.set(name, file);
    fs.copyFileSync(file, path.join(outDir, name));
  }

  for (const manifest of requiredManifests) {
    if (!sources.has(manifest)) errors.push(`Missing update manifest ${manifest}`);
  }

  for (const name of sources.keys()) {
    if (!/^latest.*\.ya?ml$/.test(name)) continue;
    const refs = manifestReferences(fs.readFileSync(path.join(outDir, name), 'utf8'));
    if (refs.length === 0) errors.push(`${name} does not reference any files`);
    for (const ref of refs) {
      if (!sources.has(ref)) errors.push(`${name} references "${ref}", which is not part of the release`);
    }
  }

  return { files: [...sources.keys()].sort(), errors };
}

if (require.main === module) {
  const [srcDir, outDir] = process.argv.slice(2);
  if (!srcDir || !outDir) {
    console.error('Usage: prepare-release-assets.cjs <artifacts-dir> <output-dir>');
    process.exit(2);
  }
  const { files, errors } = prepare(srcDir, outDir);
  console.log(`Release assets (${files.length}):\n  ${files.join('\n  ')}`);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s) found:\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
  console.log('\nUpdate manifests verified.');
}

module.exports = { prepare, manifestReferences, REQUIRED_MANIFESTS };
