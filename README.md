# Home Assistant Desktop

> **Fork notice:** The name "Home Assistant Desktop" and the original codebase were created by [Marvin Kelm](https://github.com/mrvnklm) and later maintained by [Ivan Prodanov](https://github.com/iprodanovbg). This repository is a fork actively maintained by [jojo-swe](https://github.com/jojo-swe).

A modern Desktop App (Windows / macOS / Linux) for [Home Assistant](https://www.home-assistant.io/), built with [Electron](https://www.electronjs.org/) 43.

This fork radically improves application security via context isolation, adds rich two-way native OS integrations, and is under active development with a roadmap toward a **v2.0 "Liquid Glass" UI redesign**.

![Home Assistant - Desktop](https://raw.githubusercontent.com/jojo-swe/homeassistant-desktop/master/media/screenshot.png)

## ✨ Features

### Core

- Hover / click the tray icon to open the app (can be fully detached)
- Supports multiple instances of Home Assistant (including automatic switching)
- Automatic instance discovery using Bonjour
- Right-click context menu for Quick Actions, settings, reset, or quit
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

### Security

- **Context Isolation** — `nodeIntegration: false` with strict `preload.js` bridge
- **IPC Channel Allowlists** — Shared module synchronizes allowed channels between preload and main process
- **URL Validation** — All user-supplied URLs are validated before storage
- **No Remote Code Execution** — Removed arbitrary Node.js execution risks from remote Chromium contexts

## 📥 Installation

Download the latest version for your platform from the [Releases section](https://github.com/jojo-swe/homeassistant-desktop/releases/latest).

Automatic updates are bundled and will seamlessly pull newer binaries from GitHub Releases automatically.

## 📋 Telemetry & Home Assistant Integration

You can fetch the desktop sensors (CPU, Active Window, Webcam) from the Home Assistant dashboard using Webhooks or directly evaluating them using local commandline REST sensors pointing to the app's internal IP endpoints, depending on your network topology. See the accompanying `walkthrough.md` or Wiki for configuration recipes.

## 🔧 Development

```bash
# Install dependencies
npm install

# Run the app
npm start

# Lint and format
npm run lint
npm run format

# Run tests
npm test
npm run test:coverage

# Build for current platform
npm run build
```

### Tech Stack

| Component        | Version                |
| ---------------- | ---------------------- |
| Electron         | 43                     |
| Node.js          | ≥ 20                   |
| electron-builder | 26                     |
| electron-updater | 6                      |
| Test framework   | Jest (41 tests)        |
| Linter           | ESLint 9 (flat config) |
| Formatter        | Prettier 3             |

## 🗺️ Roadmap

### v1.6.0 (Current — July 2026)

- ✅ Stability fixes (6 critical bugs)
- ✅ CI/CD pipeline with GitHub Actions
- ✅ ESLint + Prettier code quality tooling
- ✅ Jest test framework (41 unit tests across 5 suites)
- ✅ Shared `theme.css` for unified dark theme
- ✅ Redesigned onboarding, error, and settings pages
- ✅ Tray menu improvements (status indicator, refresh entities)
- ✅ Security patches (0 vulnerabilities)
- ✅ Electron 43, electron-updater 6, electron-builder 26

### v2.0.0 — Liquid Glass UI Redesign (Planned)

Inspired by the "Liquid Glass" design language from iOS 26 — translucent, layered surfaces with real-time backdrop blur, light refraction, and depth-based hierarchy.

- **Glassmorphism foundation** — Translucent surfaces, `backdrop-filter: blur(20px)`, inner glow shadows, elevation levels
- **Redesign all UI pages** — Onboarding, settings, and error pages with glass cards, frosted inputs, and animated transitions
- **Native window vibrancy** — macOS `vibrancy: 'under-window'`, Windows 11 `backgroundMaterial: 'acrylic'`, Linux CSS fallback
- **Dynamic accent color** — Detect HA theme color via `/api/config` and apply throughout the app
- **Animated transitions** — Fade+scale page transitions, stagger fade-ins, `prefers-reduced-motion` support
- **TypeScript migration** — Type-safe codebase

See the full roadmap in [CHANGELOG.md](./CHANGELOG.md) for release history.

## 🤝 Contributing

Pull requests are always welcome. For major changes involving the Electron main-process or external native dependencies, please open an issue first to discuss the architecture.

## 📜 Credits & License

This is a fork of [iprodanovbg/homeassistant-desktop](https://github.com/iprodanovbg/homeassistant-desktop), which was itself a fork of [mrvnklm/homeassistant-desktop](https://github.com/mrvnklm/homeassistant-desktop) — the original prototype by [Marvin Kelm](https://github.com/mrvnklm). All credit for the original project name and codebase goes to them.

Copyright 2022, [Ivan Prodanov](https://github.com/iprodanovbg)  
Copyright 2020-2021, [Marvin Kelm](https://github.com/mrvnklm)  
Copyright 2026, [jojo-swe](https://github.com/jojo-swe)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0).
