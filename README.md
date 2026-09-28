# Home Assistant Desktop

> **Fork notice:** The name "Home Assistant Desktop" and the original codebase were created by [Marvin Kelm](https://github.com/mrvnklm) and later maintained by [Ivan Prodanov](https://github.com/iprodanovbg). This repository is a fork actively maintained by [jojo-swe](https://github.com/jojo-swe).

A modern Desktop App (Windows / macOS / Linux) for [Home Assistant](https://www.home-assistant.io/), built with [Electron](https://www.electronjs.org/) 43.

This fork radically improves application security via context isolation, adds rich two-way native OS integrations, and ships a **v2.0 "Liquid Glass" graphical overhaul** — translucent, layered surfaces with real-time backdrop blur, depth-based hierarchy, and adaptive theming.

![Home Assistant - Desktop](https://raw.githubusercontent.com/jojo-swe/homeassistant-desktop/master/media/screenshot.png)

## ✨ Features

### Core

- Frameless windows with native title bar overlay on Windows, transparent macOS controls, and CSS drag regions for window movement in detached mode
- Hover / click the tray icon to open the app (can be fully detached)
- Supports multiple instances of Home Assistant (including automatic switching)
- Automatic instance discovery using Bonjour
- Right-click context menu on all platforms (Windows, macOS, Linux) for Quick Actions, theme switcher, settings, reset, or quit
- Global OS keyboard shortcut (`Cmd/Ctrl + Alt + X`) can be enabled to show/hide the app instantly from anywhere
- Fullscreen mode (`Cmd/Ctrl + Alt + Return`)
- Automatic updates via GitHub Releases

### Native OS Integration

- **OS Notifications Bridge** — Intercepts Home Assistant `persistent_notification` events via WebSocket and pushes them natively to the OS (Windows Action Center, macOS Notification Center). Clicking the notification brings the app window to focus.
- **Quick-Action System Tray Menu** — Pin any Home Assistant entity (lights, switches, scripts) directly to your system tray context menu for instant toggling without opening the full interface.
- **Connection Status Indicator** — Tray menu shows live connected/disconnected status.
- **Refresh Entities** — Pull entity updates on demand from the tray menu.

### Desktop System Sensors

Your PC acts as a rich sensor node for Home Assistant automations:

- **Active Window Tracker** — Exposes the process name and window title of the program currently in focus.
- **Webcam & Microphone Tracker** — Exposes a boolean when a camera or microphone session is actively being used.
- **Detailed Telemetry** — CPU load, RAM usage, System Idle time, and Battery state.
- **Retry with Backoff** — Sensor push automatically retries on transient network failures.

### Two-Way Command Receiver

Your PC securely listens for `desktop_command` events from Home Assistant. Remotely:

- Lock the screen / sleep the PC
- Mute / unmute volume (cross-platform)
- Open URLs
- Trigger custom actions

### Settings Panel

- Interactive UI for storing your Long-Lived Access Token (with show/hide toggle)
- Entity selection with search and pagination (50 per page) for large HA instances
- Toast notifications on save
- Resizable window with persistent layout
- Global keyboard shortcut configuration
- Test connection button with feedback
- Export / import configuration

### TypeSafe AI (optional)

- **Scene selection** — In Settings, describe a mood or activity. TypeSafe chooses from scenes that already exist in your Home Assistant instance. Review the suggestion and click **Activate** to apply it. Unclear requests do not activate a scene.
- **Smarter notifications** — Enable this in Settings to hold clearly routine Home Assistant persistent notifications in an in-app digest. Urgent and uncertain notifications still appear as native OS notifications. If TypeSafe is unavailable, notifications appear normally. The digest is kept in memory until the app exits; the original notifications remain in Home Assistant.

Get an API key from [TypeSafe](https://console.typesafe.ai/), enter it under **Settings → TypeSafe AI**, and save. The key is stored in the app's local settings and is not included in config exports. When these features run, the scene request and available scene names, or a notification's title and text, are sent to the TypeSafe API. Both features are inactive until configured; notification triage also requires its separate checkbox.

### Liquid Glass Design System

The v2.0 graphical overhaul introduces a glassmorphism-based design language inspired by Apple's "Liquid Glass" aesthetic:

- **Translucent Layered Surfaces** — `backdrop-filter: blur(20px) saturate(180%)` creates frosted-glass panels that blur and tint the content behind them in real time
- **Depth & Elevation** — Multi-level shadow system (`--shadow-sm`, `--shadow`, `--shadow-lg`, `--shadow-glow`) with inner glow highlights (`inset 0 1px 0 rgba(255,255,255,0.06)`) for a physical sense of layering
- **Native Window Vibrancy** — On macOS the window itself uses `vibrancy: 'under-window'` for true system-level backdrop blur; on Windows 11 it uses `backgroundMaterial: 'acrylic'`; Linux falls back to CSS-only glassmorphism
- **Adaptive Theming** — Dark and light themes with distinct glass tints, surface opacities, and border treatments; toggle from the tray menu (🎨 Theme → Dark/Light) or any renderer page, persisted via `electron-store` and synced across all open windows
- **Dynamic Accent Color** — Automatically detects the Home Assistant `--primary-color` CSS variable from the loaded HA frontend and applies it as `--ha-blue` across all app UI windows; persists across sessions
- **Animated Transitions** — Fade+scale page transitions, stagger fade-ins, and `prefers-reduced-motion` support for accessibility
- **Refreshed App Icons** — New SVG source icon with generated PNGs for all platforms (tray, favicon, 512px master)

### Accessibility

- ARIA labels on all interactive elements, `aria-live` regions for dynamic feedback, keyboard-visible focus rings, `role="alert"` on error states, `role="search"` on entity filter
- Modern color palette with improved contrast ratios and consistent CSS variables (`--shadow`, `--transition`, `--ha-blue-light`)

### Security

- **Context Isolation** — `nodeIntegration: false` with strict `preload.js` bridge
- **IPC Channel Allowlists** — Shared module synchronizes allowed channels between preload and main process
- **URL Validation** — All user-supplied URLs are validated before storage
- **No Remote Code Execution** — Removed arbitrary Node.js execution risks from remote Chromium contexts

## 📥 Installation

Download the latest version for your platform from the [Releases section](https://github.com/jojo-swe/homeassistant-desktop/releases/latest):

| Platform              | File                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| Windows (x64 / ARM64) | `…-win.exe` installer (both architectures), or `…-win-<arch>-portable.exe` |
| macOS                 | `…-mac-arm64.dmg` (Apple Silicon) or `…-mac-x64.dmg` (Intel)               |
| Linux                 | `.AppImage`, `.deb` or `.rpm` for `x86_64`/`amd64` or `arm64`/`aarch64`    |

The builds are not code-signed yet:

- **Windows**: SmartScreen may warn about an unrecognized app. Choose **More info → Run anyway**.
- **macOS**: if macOS says the app is damaged or can't be opened, run
  `xattr -cr "/Applications/Home Assistant Desktop.app"` once after installing.

The Windows installer and the Linux AppImage update themselves from GitHub Releases: new versions
download in the background and install when you quit the app. Automatic updates can be turned off from
the tray menu. macOS requires signed apps for in-place updates, so on macOS download new versions
manually for now.

## 📋 Home Assistant Integration

With a long-lived access token saved in **Settings**, the app pushes your computer's CPU, memory,
battery, activity, webcam/microphone and active-window state to Home Assistant as sensors. It shows
Home Assistant notifications natively, and it runs commands (lock, sleep, mute, open URL,
notification) that automations send as a `desktop_command` event. See
[docs/walkthrough.md](docs/walkthrough.md) for the entity list and example automations.

## 🔧 Development

```bash
# Install dependencies
npm install

# Run the app (dev mode with hot reload)
npm run dev

# Preview the built app
npm start

# Lint and format
npm run lint
npm run format

# Run unit tests
npm test
npm run test:coverage

# Run E2E tests (builds first, then launches Electron)
npm run test:e2e

# Type checking
npm run typecheck

# Regenerate app icons from SVG source
npm run generate-icons

# Build for current platform
npm run build
```

### Tech Stack

| Component          | Version                |
| ------------------ | ---------------------- |
| Electron           | 43                     |
| Node.js            | ≥ 20                   |
| electron-builder   | 26                     |
| electron-updater   | 6                      |
| Renderer framework | Svelte 5               |
| Build tool         | electron-vite 3        |
| Unit tests         | Vitest (389 tests)     |
| E2E tests          | Playwright (31 tests)  |
| Linter             | ESLint 9 (flat config) |
| Formatter          | Prettier 3             |
| Language           | TypeScript (strict)    |

## 🗺️ Roadmap

### v2.0.0 (Current — September 2026)

First stable release of the 2.x line. See [CHANGELOG.md](./CHANGELOG.md#200---2026-09-28) for details.

- ✅ Home Assistant loads on startup for configured users (IPC startup race fixed)
- ✅ IPC sender validation: remote pages can no longer read the access token or change settings
- ✅ Main window stays on your Home Assistant instances; other links open in the browser
- ✅ Auto-update fixed on Windows and Linux (asset names, per-architecture update manifests)
- ✅ Updates install on quit instead of restarting mid-use; the Automatic Updates setting is respected
- ✅ Pinned Quick Actions save correctly; Reconnect no longer quits the app
- ✅ Single-instance lock; OS logout/shutdown can quit the app
- ✅ E2E suite running in CI; lint and format checks in CI

### v2.0.0-beta.1 (July 2026)

- ✅ Glassmorphism design system with translucent surfaces, backdrop blur, depth-based hierarchy
- ✅ Native window vibrancy (macOS `under-window`, Windows 11 `acrylic`, Linux CSS fallback)
- ✅ Dark/Light theme switcher in tray menu, synced across all windows
- ✅ Dynamic accent color detection from HA frontend
- ✅ Svelte 5 renderer migration (Onboarding, Settings, Error)
- ✅ Full TypeScript strict mode across main, preload, and renderer
- ✅ Vitest test framework with 342 unit tests across 22 suites
- ✅ Playwright E2E tests (28 tests)
- ✅ Frameless windows with `titleBarOverlay` on Windows, transparent macOS controls
- ✅ CSS drag regions on all renderer headers for window movement in detached mode
- ✅ Accessibility audit: ARIA labels, aria-live regions, focus-visible styles, role attributes
- ✅ App icon refresh: new SVG source with generated PNGs for all platforms
- ✅ Shared CSS utilities (`.card`, `.section`) and new CSS variables in `theme.css`
- ✅ CI workflow with xvfb for Linux E2E testing
- ✅ Comprehensive bug sweep — 16 fixes across main, renderer, preload, and IPC
- ✅ Active window tracker now uses `GetForegroundWindow` (was CPU-based, incorrect)
- ✅ Bonjour discovery timeout race condition fixed
- ✅ Auto-updater duplicate event listener stacking fixed
- ✅ Preload `off()` method exposed for IPC listener cleanup
- ✅ Resize timeout race fixed (no more hover flicker during resize)
- ✅ `unregisterKeyboardShortcut` now targets only its own shortcut
- ✅ Platform-conditional notification icons (macOS/Windows)
- ✅ Shortcut validation on IPC `save-shortcut` channel
- ✅ `node:` prefix for all Node.js built-in imports
- ✅ Removed dead code (`consecutiveFailures`, unused `renderPins()`)
- ✅ Shared `INDEX_FILE` constant between `window.ts` and `tray.ts`

### v1.6.0 (July 2026)

- ✅ Stability fixes (6 critical bugs)
- ✅ CI/CD pipeline with GitHub Actions
- ✅ ESLint + Prettier code quality tooling
- ✅ Vitest test framework (291 unit tests across 21 suites)
- ✅ Shared `theme.css` for unified dark theme
- ✅ Redesigned onboarding, error, and settings pages (Svelte 5 migration)
- ✅ Tray menu improvements (status indicator, refresh entities)
- ✅ Security patches (0 vulnerabilities)
- ✅ Electron 43, electron-updater 6, electron-builder 26
- ✅ Full TypeScript migration (strict mode)

### v2.0.0 — Liquid Glass Graphical Overhaul (Complete)

A full graphical overhaul introducing a glassmorphism-based design language with translucent surfaces, real-time backdrop blur, depth-based hierarchy, and adaptive theming.

- **Glassmorphism foundation** — Translucent surfaces, `backdrop-filter: blur(20px)`, inner glow shadows, elevation levels ✅
- **Redesign all UI pages** — Onboarding, settings, and error pages with glass cards, frosted inputs, and animated transitions ✅
- **Native window vibrancy** — macOS `vibrancy: 'under-window'`, Windows 11 `backgroundMaterial: 'acrylic'`, Linux CSS fallback ✅
- **Tray context menu on all platforms** — Right-click works on Windows, macOS, and Linux (was Linux-only) ✅
- **Theme switcher in tray menu** — 🎨 Theme submenu with Dark/Light radio options, persisted in `electron-store`, synced across all windows ✅
- **Dynamic accent color** — Detect HA `--primary-color` CSS variable and apply throughout the app ✅
- **Animated transitions** — Fade+scale page transitions, stagger fade-ins, `prefers-reduced-motion` support ✅
- **Packaging & distribution** — Unsigned builds, portable Windows executable, non-one-click NSIS installer ✅
- **TypeScript migration** — Type-safe codebase ✅ (completed in v1.6.0)
- **Legacy cleanup** — Removed pre-migration `.js` source files, old `web/` directory, legacy `tests/` folder, and unused CSS ✅

See [CHANGELOG.md](./CHANGELOG.md) for full release history.

## 🤝 Contributing

Pull requests are always welcome. For major changes involving the Electron main-process or external native dependencies, please open an issue first to discuss the architecture.

## 📜 Credits & License

This is a fork of [iprodanovbg/homeassistant-desktop](https://github.com/iprodanovbg/homeassistant-desktop), which was itself a fork of [mrvnklm/homeassistant-desktop](https://github.com/mrvnklm/homeassistant-desktop) — the original prototype by [Marvin Kelm](https://github.com/mrvnklm). All credit for the original project name and codebase goes to them.

Copyright 2022, [Ivan Prodanov](https://github.com/iprodanovbg)  
Copyright 2020-2021, [Marvin Kelm](https://github.com/mrvnklm)  
Copyright 2026, [jojo-swe](https://github.com/jojo-swe)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0).
