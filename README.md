# Home Assistant Desktop

A modernized Desktop App (Windows / macOS / Linux) for [Home Assistant](https://www.home-assistant.io/), built with [Electron](https://www.electronjs.org/).

**This repository is an actively maintained, modernized standalone continuation** that updates the framework (Node.js 20+ & Electron 32+), radically improves application security via context isolation, and adds rich, two-way native OS integrations that go far beyond a simple webview.

## 🚀 New Features in this Version

- **Native OS Notifications Bridge**: Intercepts Home Assistant `persistent_notification` events via WebSocket and pushes them natively to the OS (Windows Action Center, macOS Notification Center). Clicking the notification brings the app window to focus.
- **Quick-Action System Tray Menu**: Pin any Home Assistant entity (lights, switches, scripts) directly to your system tray context menu, allowing instant toggling without opening the full interface.
- **Rich Desktop System Sensors**: Your PC now acts as a rich sensor node for Home Assistant Automations:
  - **Active Window Tracker:** Exposes the process name and window title of the program currently in focus.
  - **Webcam & Microphone Tracker:** Exposes a boolean when a camera or microphone session is actively being used.
  - **Detailed Telemetry:** CPU load, RAM usage, System Idle time, and Battery state.
- **Dedicated Settings Panel**: An interactive UI for safely storing your Long-Lived Access Token to utilize the REST features and selecting pinned entities.
- **Hardened Security Architecture**: Removed arbitrary Node.js code execution risks from remote Chromium contexts (`nodeIntegration: false`, strict `preload.js` bridge isolation).

![Home Assistant - Desktop](https://raw.githubusercontent.com/jojo-swe/homeassistant-desktop/master/media/screenshot.png)

## 📥 Installation

Download the latest version for your platform from the [Releases section](https://github.com/jojo-swe/homeassistant-desktop/releases/latest). 

Automatic updates are bundled and will seamlessly pull newer binaries from GitHub Releases automatically.

## ⚙️ Standard Features

- Hover / click the tray icon to open the app (can be fully detached)
- Supports multiple instances of Home Assistant (including automatic switching)
- Automatic instance discovery using Bonjour
- Right-click context menu for Quick Actions, settings, reset, or quit
- Global OS keyboard shortcut (`Cmd/Ctrl + Alt + X`) can be enabled to show/hide the app instantly from anywhere
- Fullscreen mode (`Cmd/Ctrl + Alt + Return`)

## 📋 Telemetry & Home Assistant Integration

You can fetch the desktop sensors (CPU, Active Window, Webcam) from the Home Assistant dashboard using Webhooks or directly evaluating them using local commandline REST sensors pointing to the app's internal IP endpoints, depending on your network topology. See the accompanying `walkthrough.md` or Wiki for configuration recipes.

## 🤝 Contributing

Pull requests are always welcome. For major changes involving the Electron main-process or external native dependencies, please open an issue first to discuss the architecture.

Run `npm test` before pushing to verify that release metadata is consistent.

For a full list of changes in the latest releases, see the [CHANGELOG.md](./CHANGELOG.md).

---

## 📜 Credits & License

This project is a standalone continuation built to keep the Desktop companion alive.
Huge credit to the original authors who laid the groundwork:
- [iprodanovbg/homeassistant-desktop](https://github.com/iprodanovbg/homeassistant-desktop)
- [mrvnklm/homeassistant-desktop](https://github.com/mrvnklm/homeassistant-desktop) (Original prototype)

Copyright 2022, [Ivan Prodanov](https://github.com/iprodanovbg)  
Copyright 2020-2021, [Marvin Kelm](https://github.com/mrvnklm)  

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0).
