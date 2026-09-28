# Home Assistant integration walkthrough

Home Assistant Desktop is more than a window onto your dashboard: it reports your computer's state
to Home Assistant as sensors, turns Home Assistant notifications into native OS notifications, and
lets automations send commands back to the computer.

This guide covers setup and some example automations.

## 1. Connect the app

1. Launch the app and enter your Home Assistant URL (for example `http://homeassistant.local:8123`),
   or pick an instance found automatically on your network.
2. Log in to Home Assistant in the app window as usual.

This is enough for the dashboard, native notifications (section 3) and commands (section 4).
Sensors and tray Quick Actions also need an access token:

3. In Home Assistant, open your **Profile → Security → Long-lived access tokens** and create a token.
4. In the app, open **⚙ Settings** from the tray menu, enter the URL, paste the token and click
   **Save & Test**.

The token is stored locally in the app's config file and is only sent to the URL you entered.

## 2. Desktop sensors

Once a token is saved, the app pushes these entities to Home Assistant every 30 seconds through the
REST API (`POST /api/states/<entity_id>`). `<host>` is your computer's hostname, lower-cased, with
anything other than letters and digits replaced by `_` (a PC named `Office-PC` becomes `office_pc`).

| Entity                                    | State                             | Notes                                                      |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| `sensor.desktop_<host>_cpu_load`          | CPU load, %                       |                                                            |
| `sensor.desktop_<host>_memory_usage`      | RAM in use, %                     |                                                            |
| `sensor.desktop_<host>_battery`           | Battery level, %                  | Only on computers with a battery; `charging` attribute     |
| `binary_sensor.desktop_<host>_active`     | `on` while in use                 | `idle_seconds` attribute                                   |
| `binary_sensor.desktop_<host>_webcam`     | `on` while a camera is in use     |                                                            |
| `binary_sensor.desktop_<host>_microphone` | `on` while a microphone is in use |                                                            |
| `sensor.desktop_<host>_active_window`     | Focused program's process name    | Windows only (updated every 3 s); `window_title` attribute |

Good to know:

- Entities created this way have no unique ID, so they can't be renamed or assigned to an area in
  the UI. If you need that, wrap them in [template sensors](https://www.home-assistant.io/integrations/template/).
- Home Assistant forgets pushed states when it restarts. They come back on the next push, within
  30 seconds, while the app is running.
- When the app isn't running the entities keep their last value. To detect that the computer is
  offline, check how long ago the entity last changed, e.g. with a `template` trigger on
  `now() - states.binary_sensor.desktop_<host>_active.last_updated`.

### Example: "on air" light during calls

```yaml
automation:
  - alias: On-air light while the webcam is in use
    triggers:
      - trigger: state
        entity_id: binary_sensor.desktop_office_pc_webcam
    actions:
      - action: 'light.turn_{{ trigger.to_state.state }}'
        target:
          entity_id: light.office_door
```

### Example: turn the office lights off when you walk away

```yaml
automation:
  - alias: Office lights follow desk activity
    triggers:
      - trigger: state
        entity_id: binary_sensor.desktop_office_pc_active
        to: 'off'
        for: '00:10:00'
    actions:
      - action: light.turn_off
        target:
          area_id: office
```

## 3. Native notifications

Any new [persistent notification](https://www.home-assistant.io/integrations/persistent_notification/)
in Home Assistant is shown as a native OS notification (Windows Action Center, macOS Notification
Center, Linux notification daemon). Clicking it opens the app window.

```yaml
action: persistent_notification.create
data:
  title: Washing machine
  message: The laundry is done.
```

Notifications are delivered while the app is running and signed in to Home Assistant; the window
can be hidden.

## 4. Commands from Home Assistant

Automations can control the computer by firing a `desktop_command` event. The app listens for it
through its Home Assistant session, so the app must be running and signed in. Every computer running
the app receives the event.

| `command`           | Extra data         | Effect                                   |
| ------------------- | ------------------ | ---------------------------------------- |
| `lock_screen`       |                    | Locks the session                        |
| `sleep`             |                    | Suspends the computer                    |
| `mute` / `unmute`   |                    | Mutes / unmutes the default audio output |
| `show_notification` | `title`, `message` | Shows a native notification              |
| `open_url`          | `url` (http/https) | Opens the URL in the default browser     |

On Linux, `lock_screen` uses `loginctl`, `sleep` uses `systemctl suspend`, and mute uses `amixer`
(PulseAudio/PipeWire).

### Example: lock the computer when you leave home

```yaml
automation:
  - alias: Lock the desktop when I leave
    triggers:
      - trigger: state
        entity_id: person.me
        from: home
    actions:
      - event: desktop_command
        event_data:
          command: lock_screen
```

### Example: mute the computer when the doorbell rings

```yaml
automation:
  - alias: Mute desktop for the doorbell
    triggers:
      - trigger: state
        entity_id: binary_sensor.doorbell
        to: 'on'
    actions:
      - event: desktop_command
        event_data:
          command: mute
      - event: desktop_command
        event_data:
          command: show_notification
          title: Doorbell
          message: Someone is at the door.
```

You can test a command from **Developer tools → Events**: set the event type to `desktop_command`
and the event data to `command: show_notification` with a `title` and `message`, then **Fire event**.

## 5. Tray Quick Actions and keyboard shortcuts

With a token saved, **Settings** lists your toggleable entities (lights, switches, input booleans,
fans, covers, automations and scripts). Pinned entities appear under **⚡ Quick Actions** in the tray
menu, where one click toggles them; drag pins in Settings to reorder them. You can also assign
global keyboard shortcuts that toggle an entity from anywhere.

## Troubleshooting

- **Sensors don't appear**: check the URL and token with **Test Only** in Settings. Failed pushes
  are recorded in the app's log, `main.log`, found in `%APPDATA%\Home Assistant Desktop\logs` on
  Windows, `~/Library/Logs/Home Assistant Desktop` on macOS, and
  `~/.config/Home Assistant Desktop/logs` on Linux.
- **Commands or notifications don't arrive**: open the app window and make sure you are signed in to
  Home Assistant. They are received through that session.
- **The window shows "Connection lost"**: the app checks `<your URL>/auth/providers` every few
  seconds. With several instances configured and **Automatic Switching** enabled, it switches to
  another reachable instance.
