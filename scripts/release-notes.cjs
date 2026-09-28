#!/usr/bin/env node
/**
 * Prints the CHANGELOG.md section for a version, for use as the GitHub release body.
 *
 * Usage: node scripts/release-notes.cjs <version> [changelog-path]
 */
const fs = require('node:fs');
const path = require('node:path');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns the body under `## [<version>]` up to the next `## ` heading, or null if absent. */
function extractSection(changelog, version) {
  const heading = new RegExp(`^## \\[?v?${escapeRegExp(version)}\\]?(\\s|$)`);
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

if (require.main === module) {
  const [version, changelogPath = path.join(__dirname, '..', 'CHANGELOG.md')] = process.argv.slice(2);
  if (!version) {
    console.error('Usage: release-notes.cjs <version> [changelog-path]');
    process.exit(2);
  }
  const section = extractSection(fs.readFileSync(changelogPath, 'utf8'), version);
  if (!section) {
    console.error(`No CHANGELOG entry found for ${version}`);
    process.exit(1);
  }
  console.log(section);
}

module.exports = { extractSection };
