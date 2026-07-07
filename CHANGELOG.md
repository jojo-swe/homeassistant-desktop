# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
