# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-07-09

### Bug Sweep — 16 Fixes

A comprehensive bug sweep across the entire codebase, fixing issues in the main process, renderer/Svelte components, preload/IPC layer, and tests.

### Added

- Frameless windows with native titleBarOverlay on Windows, transparent macOS controls, and CSS drag regions on all renderer headers
- Preload `off()` method exposed via context bridge for IPC listener cleanup in Svelte components
- Shortcut validation on IPC `save-shortcut` channel (validates accelerator and entityId fields)
- macOS lock screen fallback (`pmset displaysleepnow`) for newer macOS versions
- `node:` prefix for all Node.js built-in imports (child_process, fs, path, os)
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

- Unit test count increased from 338 to 342
- Updated tests for updater listener guard and specific shortcut unregister

## [2.0.0] - 2026-07-09

### Liquid Glass Graphical Overhaul

A full graphical overhaul introducing a glassmorphism-based design language with translucent surfaces, real-time backdrop blur, depth-based hierarchy, and adaptive theming.

### Added

- **Glassmorphism design system** — Translucent surfaces with `backdrop-filter: blur(20px) saturate(180%)`, inner glow shadows, multi-level elevation (`--shadow-sm`, `--shadow`, `--shadow-lg`, `--shadow-glow`), and glass-specific CSS variables (`--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-saturate`)
- **Native window vibrancy** — macOS `vibrancy: 'under-window'`, Windows 11 `backgroundMaterial: 'acrylic'`, Linux CSS-only glassmorphism fallback
- **Dark / Light theme switcher** — Tray menu 🎨 Theme submenu with Dark/Light radio options, persisted in `electron-store`, synced across all open windows; light theme with distinct glass tints, surface opacities, and border treatments
- **Dynamic accent color** — Automatically detects HA `--primary-color` CSS variable from the loaded frontend and applies it as `--ha-blue` across all app UI windows; persists across sessions
- **Animated transitions** — Fade+scale page transitions, stagger fade-ins, `prefers-reduced-motion` support
- **Tray context menu on all platforms** — Right-click works on Windows, macOS, and Linux (was Linux-only)
- **Packaging & distribution** — Unsigned builds, portable Windows executable, non-one-click NSIS installer
- **Svelte 5 renderer migration** — Onboarding, Settings, and Error pages rebuilt as Svelte 5 components with Vite bundling
- **TypeScript strict mode** — Full type-safe codebase across main, preload, and renderer
- **Vitest test framework** — 338 unit tests across 22 suites
- **Playwright E2E tests** — 28 end-to-end tests covering error page, theme toggle, and accessibility attributes
- **Favicon bundling** — Vite-compatible asset imports with TypeScript declarations for `.png` and `.svg` modules

### Changed

- Redesigned all UI pages (Onboarding, Settings, Error) with glass cards, frosted inputs, and animated transitions
- Updated color palette with improved contrast ratios and consistent CSS variables
- Refreshed app icons — new SVG source with generated PNGs for all platforms
- CI workflow with xvfb for Linux E2E testing

### Removed

- All pre-migration `.js` source files in `src/` (superseded by TypeScript)
- Legacy `web/` directory (superseded by `src/renderer/` Svelte components)
- Legacy `tests/` directory (superseded by `src/test/` Vitest suites)
- Root legacy files: `app.js`, `config.js`, `preload.js`, `jest.config.js`
- Unused CSS: `src/renderer/assets/style.css`, `src/renderer/assets/error.css`

## [1.7.0] - 2026-07-07

### Added

- Dark/light theme toggle on Onboarding and Error pages, persisted via `localStorage` (shared with Settings)
- Accessibility improvements: `aria-label` on all interactive elements, `aria-live` regions for dynamic feedback, `role="alert"` on error card, `role="search"` on entity filter, `role="status"` on discovery section
- Global `:focus-visible` keyboard navigation styles in `theme.css`
- Playwright E2E test coverage expanded from 12 to 28 tests, including error page tests, theme toggle tests, and accessibility attribute verification
- New `error.spec.ts` E2E test file for error page rendering and interaction
- App icon refresh: new SVG source icon, regenerated PNGs for all platforms (favicon, tray icons, 512x512 master icon)
- `generate-icons` npm script and `scripts/generate-icons.cjs` for icon regeneration from SVG source
- Shared `.card` and `.section` utility classes in `theme.css`
- New CSS variables: `--ha-blue-light`, `--shadow`, `--transition`

### Changed

- Updated dark theme color palette: brighter blue (`#29b6f6`), darker surfaces, improved text contrast
- Updated light theme color palette: cooler grays, standard color values
- All hardcoded transition durations replaced with `var(--transition)` for consistency
- Added `box-shadow: var(--shadow)` to error card, entity list, shortcut rows, and toast notification
- Pin chip background now uses `--ha-blue-light` variable instead of hardcoded rgba
- ESLint config now ignores `out/` build artifacts and legacy `.js` files

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
