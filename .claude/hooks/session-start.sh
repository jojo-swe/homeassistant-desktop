#!/bin/bash
# Installs dependencies for Claude Code on the web sessions so tests, typecheck, lint
# and the Playwright E2E suite (under xvfb-run) work straight away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# npm install (not ci) so the cached container state is reused between sessions; --no-save
# keeps the lockfile untouched when the container's npm differs from the one that wrote it.
npm install --no-audit --no-fund --no-save

# The Electron binary is fetched by a postinstall script; make sure it is present for E2E runs.
if [ ! -x node_modules/electron/dist/electron ]; then
  node node_modules/electron/install.js
fi
