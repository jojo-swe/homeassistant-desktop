# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-28

First stable release of the 2.x "Liquid Glass" line. It includes everything from
[2.0.0-beta.1](https://github.com/jojo-swe/homeassistant-desktop/releases/tag/v2.0.0-beta.1)
plus fixes for problems found in a pre-release review. Several would have affected every user.

> **Upgrading from 2.0.0-beta.1 or 1.6.0:** those versions can't auto-update to this one because of
> the packaging bug fixed here. Download 2.0.0 manually once; later updates install automatically on
> Windows and Linux (AppImage). The Windows installer upgrades 1.6.0 in place.

### Security

- **IPC sender validation.** The preload bridge is also exposed to the remote Home Assistant page, and
  IPC handlers didn't check who was calling. Any page loaded in the main window could read the stored
  access token or change settings. Privileged channels now accept only the app's own pages; the
  Home Assistant origin may only send notifications and commands.
- **Navigation guard.** The main window stays on the app's pages and your configured instances; other
  links open in the system browser.
- **Safe external links.** Only `http(s)` and `mailto` URLs are handed to the OS. Schemes such as
  `smb:` or `ms-*` can launch programs on Windows.
- Settings import rejects instance URLs that aren't `http(s)`; pinned-entity input is validated.

### Fixed

- Home Assistant didn't load at startup for configured users. The onboarding page asked for the
  current instance before the IPC handlers were registered, and the request was dropped.
- **Reconnect** on the connection-lost page quit the app on Windows and Linux.
- The app couldn't be quit by OS logout/shutdown, installers or `SIGTERM`: closing the window only
  hid it.
- Pinning Quick Actions in Settings never saved (Svelte state couldn't be sent over IPC).
- Auto-update downloads failed: release asset names contained spaces, which GitHub renames, so the
  URLs in the update manifests returned 404.
- Windows x64 / arm64 (and macOS Intel / Apple Silicon) builds overwrote each other's update manifest,
  which could offer the wrong architecture's installer.
- Tray menu actions failed after the main window was re-created.
- A Bonjour reply without a TXT record crashed discovery. A new mDNS browser was also leaked every few
  seconds while Home Assistant was unreachable.
- Windows: the active-window sensor always reported `powershell`.
- Windows: `mute` / `unmute` commands toggled instead of setting the state.
- The onboarding window now appears on first launch.
- **Start at Login** and **Enable Shortcut** take effect immediately. The tray menu refreshes when
  entities or pins change.

### Changed

- Updates download in the background and install when you quit, with a notification to restart now.
  They no longer restart the app mid-use. Turning off **Automatic Updates** stops update checks
  entirely, and a failed check no longer stops future checks.
- Only one instance of the app can run at a time; launching it again shows the existing window.
- The update check no longer delays startup.
- Release files are now named `homeassistant-desktop-v<version>-<os>-<arch>.<ext>`. The Windows
  installer covers both x64 and ARM64.
- The release workflow verifies update manifests before publishing and takes release notes from
  this changelog.

### Development

- E2E suite runs on Linux CI. It previously hard-coded `electron.exe`, so it never passed. It now
  uses an isolated profile per test, and new tests cover startup with a configured instance, the
  navigation guard and IPC sender checks.
- CI runs lint and format checks and uses `npm ci`. Action versions are aligned.
- Added `CLAUDE.md`, `docs/walkthrough.md` (sensors, notifications, commands) and a SessionStart hook
  for Claude Code on the web.

## [2.0.0-beta.1] - 2026-07-09

### Liquid Glass Graphical Overhaul + Comprehensive Bug Sweep

A full graphical overhaul introducing a glassmorphism-based design language with translucent surfaces, real-time backdrop blur, depth-based hierarchy, and adaptive theming. Includes a 16-fix bug sweep across the entire codebase.

### Added

- **Glassmorphism design system** — Translucent surfaces with `backdrop-filter: blur(20px) saturate(180%)`, inner glow shadows, multi-level elevation, and glass-specific CSS variables
- **Native window vibrancy** — macOS `vibrancy: 'under-window'`, Windows 11 `backgroundMaterial: 'acrylic'`, Linux CSS-only glassmorphism fallback
- **Frameless windows** — Native `titleBarOverlay` on Windows, transparent macOS controls, CSS drag regions on all renderer headers
- **Dark / Light theme switcher** — Tray menu Theme submenu with Dark/Light radio options, persisted in `electron-store`, synced across all open windows; theme toggle on all renderer pages (onboarding, settings, error)
- **Dynamic accent color** — Automatically detects HA `--primary-color` CSS variable and applies it as `--ha-blue` across all app UI windows
- **Animated transitions** — Fade+scale page transitions, stagger fade-ins, `prefers-reduced-motion` support
- **Accessibility improvements** — `aria-label` on all interactive elements, `aria-live` regions for dynamic feedback, `role="alert"` on error card, `role="search"` on entity filter, `role="status"` on discovery section, global `:focus-visible` keyboard navigation styles
- **Tray context menu on all platforms** — Right-click works on Windows, macOS, and Linux (was Linux-only)
- **Svelte 5 renderer migration** — Onboarding, Settings, and Error pages rebuilt as Svelte 5 components with Vite bundling
- **TypeScript strict mode** — Full type-safe codebase across main, preload, and renderer
- **Vitest test framework** — 342 unit tests across 22 suites
- **Playwright E2E tests** — 28 end-to-end tests covering error page, theme toggle, and accessibility attributes
- **App icon refresh** — New SVG source icon, regenerated PNGs for all platforms (favicon, tray icons, 512x512 master), `generate-icons` npm script
- **Shared CSS utilities** — `.card` and `.section` classes, new CSS variables (`--ha-blue-light`, `--shadow`, `--transition`) in `theme.css`
- **Preload `off()` method** — Exposed `ipcRenderer.removeListener` via context bridge for IPC listener cleanup
- **Shortcut validation** — IPC `save-shortcut` handler validates `accelerator` and `entityId` fields
- **macOS lock screen fallback** — `pmset displaysleepnow` for newer macOS versions
- `node:` prefix for all Node.js built-in imports
- Shared `INDEX_FILE` constant between `window.ts` and `tray.ts`

### Fixed

- Active window tracker now uses `GetForegroundWindow` P/Invoke instead of CPU-based process sorting
- Bonjour discovery timeout race condition — previous timeout is now cleared before starting a new find
- Auto-updater duplicate event listener stacking on repeated `useAutoUpdater` calls
- Onboarding duplicate `bonjour-instance` listeners — moved outside `get-instances` reply handler
- Resize timeout race causing `disableHover` flicker — timeout is now tracked and cleared
- `unregisterKeyboardShortcut` now targets only its own shortcut instead of calling `unregisterAll()`
- Notification icon is now platform-conditional (macOS IconTemplate vs Windows IconWin)
- Removed dead `consecutiveFailures` variable from `availabilityChecker.ts`
- Response error logging now uses `statusCode` instead of stringifying the response object
- `instances.ts` guards against `indexOf` returning -1 before setting `currentInstance`
- `reinitMainWindow` removed unused `availabilityCheck` parameter
- `Onboarding.svelte` `existingInstances` is now reactive with `$state()`
- Removed redundant `renderPins()` function in `Settings.svelte`

### Changed

- Redesigned all UI pages (Onboarding, Settings, Error) with glass cards, frosted inputs, and animated transitions
- Updated dark theme color palette: brighter blue (`#29b6f6`), darker surfaces, improved text contrast
- Updated light theme color palette: cooler grays, standard color values
- All hardcoded transition durations replaced with `var(--transition)` for consistency
- Refreshed app icons — new SVG source with generated PNGs for all platforms
- CI workflow with xvfb for Linux E2E testing
- ESLint config now ignores `out/` build artifacts and legacy `.js` files
- Unit test count increased from 291 to 342
- Updated tests for updater listener guard and specific shortcut unregister

### Removed

- All pre-migration `.js` source files in `src/` (superseded by TypeScript)
- Legacy `web/` directory (superseded by `src/renderer/` Svelte components)
- Legacy `tests/` directory (superseded by `src/test/` Vitest suites)
- Root legacy files: `app.js`, `config.js`, `preload.js`, `jest.config.js`
- Unused CSS: `src/renderer/assets/style.css`, `src/renderer/assets/error.css`
- Dead `consecutiveFailures` variable from `availabilityChecker.ts`
- Redundant `renderPins()` function from `Settings.svelte`

## [1.6.0] - 2026-07-07

### Added

- ESLint + Prettier code quality tooling with `lint` and `format` scripts
- Jest test framework with 41 unit tests covering haClient, commandReceiver, shortcutManager, sensorPusher, and ipc-channels
- Shared `theme.css` for unified visual design across all UI pages (index, error, settings)
- Token show/hide toggle in Settings panel
- Toast notification on settings save
- Entity pagination (50 per page) in Settings panel for large HA instances
- Connection status indicator in tray menu header
- "Refresh Entities" action in tray menu
- Resizable settings window (was fixed at 420×600)
- Cross-platform mute/unmute commands (macOS, Linux support)
- URL validation in save-settings IPC handler
- Retry with backoff for sensor push on transient network failures
- `sensorPusher.start()` method to begin pushing after HA is configured via Settings
- Shared `src/instances.js` module to eliminate duplicated `currentInstance`/`addInstance`
- Shared `src/ipc-channels.js` module to synchronize preload and IPC channel allowlists
- Flatpak manifest, `.desktop` file, and AppStream metainfo for Linux desktop integration
- `appId` updated to reverse-DNS convention (`io.github.jojo_swe.homeassistant-desktop`)
- Linux `StartupWMClass` and `libayatana-appindicator3-1` deb dependency for tray icon on GNOME/KDE
- Packaging validation tests (assets, packaging, releases)

### Changed

- Onboarding page (`index.html`) redesigned with dark theme, text feedback for URL validation, and loading states
- Error page (`error.html`) redesigned with styled error card and consistent theme
- Settings panel uses shared `theme.css` instead of inline duplicated CSS variables
- `app.js` tray module import moved to top-level (was lazy-loaded after use)
- `preload.js` imports channel lists from shared module instead of hardcoding

### Fixed

- CI publish target: added explicit `publish` config to `package.json` and `permissions: contents: write` to GitHub Actions workflow
- Broken condition `!instances?.length > 1` in `app.js` (always evaluated to false)
- Swapped window size/position persistence in detached mode (`window.js`)
- `shortcutManager.remove()` now calls `registerAll()` so removed shortcuts are immediately unregistered
- `sensorPusher` now starts when HA is configured via Settings (was only initialized at app startup)
- Misleading no-op ternary in `haClient.js` toggle function
- `loadURL` in `createMainWindow` now has error fallback to error page
- `availabilityCheck` wraps `new URL()` in try/catch to prevent crash on malformed stored URLs

## [1.5.4] - 2026-03-21

### Added

- **Native OS Notifications Bridge**: Intercepts Home Assistant `persistent_notification` events via WebSocket and pushes them natively to the OS (Windows Action Center, macOS Notification Center). Clicking the notification raises the app window.
- **Quick-Action Tray Menu**: Pin any Home Assistant entity from the new Settings panel and quickly toggle it right from the system tray menu without fully opening the browser window.
- **Dedicated Settings Panel**: Added an interactive Settings window (`Right-Click Tray -> Manage Quick Actions...`) to easily configure your Home Assistant Base URL and Long-Lived Access Token, as well as pick entities for the Tray Menu.
- **Two-Way Sensor Push Platform**: Automatically registers the PC as a rich sensor node in Home Assistant via REST API POST calls. Your PC's CPU, Memory, Battery, Webcam activity, Mic activity, Idle state, and Foreground Window name are pushed in real-time, requiring no yaml configuration.
- **Two-Way Command Receiver**: Your PC now securely listens for `desktop_command` events from Home Assistant! You can remotely lock the screen, sleep the PC, mute the volume, or open URLs from your HA automations.
- **Global Keyboard Shortcuts**: Register OS-wide hotkeys (e.g., `Ctrl+Shift+1`) right from the Settings panel that instantly toggle Home Assistant entities, no matter what app you're currently using.
- **Secure IPC Bridge**: Fully implemented `contextIsolation` and `preload.js` to ensure bullet-proof security when browsing the Home Assistant web interface, mitigating XSS risks.

### Changed

- Complete modernization of the underlying tech stack: Updated to **Node.js ≥20** and **Electron v32+**.
- Refactored UI HTML files (`index.html`, `error.html`) for improved accessibility, removal of deprecated inline styles, and overall code hygiene.
- Switched to using `systeminformation` and native WMI queries (`Get-Process`) for robust and antivirus-safe system data monitoring.
- Updated `electron-updater` configuration to properly hook into GitHub Releases for auto-updating.

### Removed

- Removed the deprecated and obsolete `auto-launch` dependency.
- Completely disabled `nodeIntegration` in remote content windows for improved security.

---

### Previous Versions

> Changes prior to 1.5.4 were made by the original authors in the upstream repositories.
