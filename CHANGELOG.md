# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.4] - 2026-03-21

### Added
- **Native OS Notifications Bridge**: Intercepts Home Assistant `persistent_notification` events via WebSocket and pushes them natively to the OS (Windows Action Center, macOS Notification Center). Clicking the notification raises the app window.
- **Quick-Action Tray Menu**: Pin any Home Assistant entity from the new Settings panel and quickly toggle it right from the system tray menu without fully opening the browser window.
- **Dedicated Settings Panel**: Added an interactive Settings window (`Right-Click Tray -> Manage Quick Actions...`) to easily configure your Home Assistant Base URL and Long-Lived Access Token, as well as pick entities for the Tray Menu.
- **Extended System Sensors**: Exposes advanced desktop sensors that can be pulled by Home Assistant:
  - Active Foreground Window Tracker (Process & Window Title tracking)
  - Webcam & Microphone active session status
  - CPU load, accurate Memory usage, system idle time, and Battery status
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
