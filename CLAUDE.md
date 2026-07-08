# Home Assistant Desktop

Desktop tray application for [Home Assistant](https://www.home-assistant.io/) built with Electron. Runs on Windows, macOS, and Linux.

## Project Overview

A system-tray Electron app that wraps the Home Assistant web UI. Key features:
- System tray icon with hover/click to show the HA web interface
- Multiple HA instance support with automatic switching via Bonjour/mDNS discovery
- Detached window mode, fullscreen mode, always-on-top
- Auto-launch at login, global keyboard shortcut (Cmd/Ctrl+Alt+X)
- Pinned entity quick-actions in tray menu (toggle lights, switches, etc.)
- Custom global keyboard shortcuts that trigger HA entity toggles
- System sensor push to HA (CPU, memory, battery, active window, webcam/mic)
- Desktop command receiver (lock screen, mute, notifications, etc. from HA)
- Native OS notifications for HA persistent notifications
- Auto-update via electron-updater (GitHub Releases)

## Tech Stack

| Layer | Technology |
|---|---|
| App shell | Electron 43 |
| Build toolchain | electron-vite 3 (wraps Vite 6) |
| Packaging | electron-builder 26 |
| UI framework | Svelte 5 (runes API — `$state`, `$derived`) |
| Language | TypeScript 6, strict mode throughout |
| Config | electron-store 8 (JSON in `userData`) |
| Auto-update | electron-updater 6 (GitHub Releases, `jojo-swe/homeassistant-desktop`) |
| Unit tests | Vitest 3 + jsdom, v8 coverage (≥80% threshold) |
| E2E tests | Playwright 1.61 (Electron CDP) |
| Linting | ESLint 9 + eslint-config-prettier |
| Formatting | Prettier 3 |
| Node requirement | >= 20 |

## Architecture

### Directory Layout

```
src/
├── main/           ← Electron main process (TypeScript, CJS output)
├── preload/        ← Electron preload bridge (TypeScript, CJS output)
├── renderer/       ← Svelte 5 frontend (three independent pages)
│   ├── index.html + Onboarding.svelte   ← first-run / instance setup
│   ├── error/      ← unreachable-instance error page
│   └── settings/   ← HA connection, entity pins, shortcuts, theme
└── test/
    ├── unit/       ← Vitest tests for src/main/*.ts
    ├── e2e/        ← Playwright tests via Electron CDP
    └── packaging/  ← artifact structure tests
```

> **Note:** `app.js`, `config.js`, `preload.js`, `web/`, and `src/*.js` are legacy files
> left over from the pre-migration JS codebase. They are not compiled or loaded by the
> current build. Do not modify them; they will be removed.

### Main Process Modules (`src/main/`)

Every module uses dependency injection — functions accept a `deps` object rather than
importing singletons. This is what makes the unit test suite (Vitest + mocks) work.

| Module | Role |
|---|---|
| `index.ts` | Bootstrap: wires all modules, registers shortcuts, seeds entity cache |
| `ipc-channels.ts` | Single source of truth for all valid IPC channel names |
| `ipc.ts` | All `ipcMain.on`/`ipcMain.handle` registrations via `registerAll(deps)` |
| `window.ts` | Main `BrowserWindow` lifecycle, tray positioning, fullscreen |
| `tray.ts` | System tray icon + context menu, pinned entity toggles |
| `settingsWindow.ts` | Singleton settings `BrowserWindow` |
| `haClient.ts` | HA REST API calls (states, toggle, etc.) |
| `entityCache.ts` | In-memory entity cache, refreshed every 60 s |
| `instances.ts` | Multi-instance list in config, getter/setter |
| `availabilityChecker.ts` | 3 s HTTP ping, error page on failure, Bonjour failover |
| `sensorPusher.ts` | Pushes system sensor states to HA REST every 30 s |
| `systemMonitor.ts` | CPU/memory/battery/idle/webcam/mic via `systeminformation` |
| `activeWindow.ts` | Active window detection (Windows-only, PowerShell) |
| `shortcutManager.ts` | Global keyboard shortcuts triggering HA entity toggles |
| `commandReceiver.ts` | Executes desktop commands from HA (lock, mute, notifications, etc.) |
| `haNotificationBridge.ts` | JS injected into live HA page; subscribes to WebSocket events |
| `notifications.ts` | Native OS notifications via Electron `Notification` API |
| `updater.ts` | `electron-updater` auto-update, checks every 4 hours |
| `config.ts` | `electron-store` instance typed with `AppConfig` |
| `types.ts` | All shared interfaces |

### IPC Architecture

Security baseline: `nodeIntegration: false`, `contextIsolation: true` on all windows.

The preload (`src/preload/index.ts`) exposes `window.api` via `contextBridge`:
```ts
window.api.send(channel, data)    // fire-and-forget → ipcMain.on
window.api.on(channel, callback)  // push replies from main
window.api.invoke(channel, data)  // request-response → ipcMain.handle
```

All channel names are validated against the const arrays in `src/main/ipc-channels.ts`.

### Renderer Pages

Three independent Svelte 5 apps, each with its own `index.html` + `main.ts` entry:

- **Onboarding** (`src/renderer/`) — URL input + Bonjour discovery; navigates to HA on success
- **Error** (`src/renderer/error/`) — shown when HA is unreachable; Reconnect / Restart
- **Settings** (`src/renderer/settings/`) — HA URL/token, entity pins, shortcuts, import/export, theme toggle

### Config Schema (`electron-store`)

Stored as JSON in `app.getPath('userData')`. Key fields:

| Key | Type | Purpose |
|---|---|---|
| `haBaseUrl` | `string` | HA server URL |
| `haToken` | `string` | Long-lived access token |
| `allInstances` | `string[]` | All known HA instance URLs |
| `currentInstance` | `number` | Index into `allInstances` |
| `pinnedEntities` | `string[]` | `entity_id`s in tray quick-actions |
| `shortcuts` | `Shortcut[]` | Global keyboard shortcuts |
| `autoUpdate` | `boolean` | Enable/disable auto-update |
| `detachedMode` | `boolean` | Free-floating window mode |

## Development

```bash
npm install
npm run dev         # electron-vite dev server with HMR
npm run start       # preview last build
```

## Build Commands

```bash
npm run build:dir           # compile only → out/ (fast, no installer)
npm run build               # compile + package → dist/
npm run build-local-mac     # macOS x64 dmg+zip
npm run build-local-mac-arm # macOS arm64 dmg+zip
npm run build-local-linux   # Linux AppImage x64
npm run build-local-win     # Windows NSIS+zip x64
```

## Testing

```bash
npm test                  # unit + packaging tests (single run)
npm run test:coverage     # with v8 coverage (thresholds: 80% stmts)
npm run test:e2e          # build then run Playwright E2E
npm run test:e2e:only     # Playwright without rebuilding
npm run typecheck         # svelte-check + tsc --noEmit
npm run lint:check        # ESLint check
npm run format:check      # Prettier check
```

E2E tests use Playwright connecting to the Electron process via CDP (`--remote-debugging-port=9222`). Run with `xvfb-run` on Linux CI.

## CI/CD

**`ci.yml`** — triggers on push/PR to `master`, Node 22:
1. `test` — typecheck + coverage on ubuntu
2. `build` (needs test) — `build:dir` only
3. `e2e` (needs build) — installs Electron system deps, runs `xvfb-run -a npm run test:e2e`

**`build.yml`** — triggers on tag push (`v*`) or `workflow_dispatch`, matrix across macOS/Windows/Ubuntu, Node 22. Publishes to GitHub Releases when tag starts with `v`.

## Code Style

- TypeScript 6, strict mode, no `any`
- Svelte 5 runes API (`$state`, `$derived`, `$effect`) — no Svelte 4 reactivity
- Prettier + ESLint enforced (run `npm run lint` and `npm run format` before committing)
- 2-space indentation, single quotes, trailing commas (see `.prettierrc`)
- Dependency injection in all main-process modules (no global singletons)

## Security Notes

- `nodeIntegration: false` + `contextIsolation: true` on all `BrowserWindow` instances
- All IPC channels validated against `SEND_CHANNELS`/`REPLY_CHANNELS`/`INVOKE_CHANNELS` in `ipc-channels.ts`
- CSP headers on all renderer HTML pages (`src/renderer/**/index.html`)
- HA token stored in `electron-store` (plain JSON) — Phase 2 goal: migrate to `safeStorage`
- `haNotificationBridge` injects JS into the live HA page via `executeJavaScript()` — Phase 2 goal: replace with a dedicated preload

## Known Issues / Roadmap

- Token stored in plaintext `electron-store` — should use `safeStorage` or OS keychain
- `executeJavaScript()` bridge injection into HA page is fragile — should use a dedicated preload script loaded for the HA URL
- IPC handlers don't validate sender origin — a compromised remote page has bridge access
- No rate limiting on expensive IPC handlers (`test-connection`, `get-system-stats`)
- URL validation still allows HTTP (unencrypted) without a warning
- `web/` and root `app.js`/`config.js`/`preload.js` are legacy dead code pending cleanup
