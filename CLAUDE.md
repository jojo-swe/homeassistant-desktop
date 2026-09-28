# Home Assistant Desktop

Electron tray app for Home Assistant (Windows / macOS / Linux). Electron 43, TypeScript (strict),
Svelte 5 renderer, built with electron-vite and packaged with electron-builder.

## Commands

```bash
npm run dev            # run the app with hot reload
npm test               # unit + component + packaging tests (Vitest, fast)
npm run typecheck      # svelte-check (renderer + tests) and tsc for main/preload
npm run lint:check     # ESLint — note: currently only covers .js/.cjs, not the TS sources
npm run format:check   # Prettier (CI fails on unformatted files; `npm run format` fixes)
npm run test:e2e       # builds, then Playwright drives the real app (Linux: xvfb-run -a npm run test:e2e)
npm run build:dir      # compile to out/ without packaging
```

Run `typecheck`, `lint:check`, `format:check` and `npm test` before pushing — CI runs all four.

## Layout

- `src/main/` — main process. `index.ts` wires everything up at startup; `window.ts` (main window),
  `tray.ts` (tray + menu), `ipc.ts` (IPC handlers), `config.ts` (electron-store settings),
  `sensorPusher.ts` / `commandReceiver.ts` / `haNotificationBridge.ts` (Home Assistant integration),
  `updater.ts` (electron-updater), `urlSafety.ts` (URL checks used for navigation / openExternal),
  `typeSafeClient.ts` / `sceneSelector.ts` / `smartNotifications.ts` (optional TypeSafe AI features;
  every failure path must fall back to showing the notification / doing nothing).
- `src/preload/index.ts` — `window.api` bridge; only channels listed in `src/main/ipc-channels.ts` pass.
- `src/renderer/` — Svelte pages: `Onboarding.svelte`, `settings/`, `error/`, shared `assets/theme.css`.
- `src/test/unit|component|packaging` (Vitest), `src/test/e2e` (Playwright over CDP).
- `scripts/` — icon generation and release helpers used by `.github/workflows/build.yml`.
- `docs/walkthrough.md` — user-facing guide to sensors, notifications and commands.

## Rules that are easy to break

- **New IPC channel**: add it to `src/main/ipc-channels.ts` (or the preload silently drops it) and
  register it in `ipc.ts` with `onLocal` / `handleLocal`, which reject senders that aren't the bundled
  `file://` pages. The preload is also exposed to the remote Home Assistant page, so never add a
  channel that trusts its sender without that check.
- **Register IPC before loading a page**: pages send IPC while loading; messages sent before a
  listener exists are dropped (this once broke startup for every configured user).
- **Opening URLs**: use `openExternalSafe` from `urlSafety.ts`, never `shell.openExternal` on
  untrusted input.
- **Svelte `$state` over IPC**: pass `$state.snapshot(value)`; proxies can't be structured-cloned.
- **Closing vs quitting**: closing the main window only hides it; `before-quit` sets `forceQuit` so real
  quits go through. Don't destroy the only window (it triggers `window-all-closed`).

## Releases

- Version lives in `package.json`; add a matching `## [x.y.z]` section to `CHANGELOG.md` and a
  `<release>` entry to `io.github.jojo_swe.homeassistant-desktop.metainfo.xml` (a test checks this).
- Publishing: run the **Build & release** workflow on `master` with `release: true` (or push a `vX.Y.Z`
  tag matching `package.json`). It builds all platforms, verifies the auto-update manifests with
  `scripts/prepare-release-assets.cjs`, and publishes a GitHub release with notes from the changelog.
  Versions with a `-` suffix are published as prereleases.
- Artifact names must not contain spaces (GitHub renames them and breaks `latest*.yml` URLs), and
  Windows/macOS must build both architectures in one job so each writes a single update manifest.
- Builds are unsigned. macOS auto-update (Squirrel.Mac) requires a signed app, so Mac users update
  manually until signing is set up.
