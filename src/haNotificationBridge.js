/**
 * This script is injected into the Home Assistant web page after it loads.
 * It subscribes to:
 *   1. state_changed on persistent_notification.* — forwards to native OS notifications
 *   2. desktop_command custom events             — forwards to commandReceiver.js
 */
(function haNotificationBridge() {
  const POLL_INTERVAL = 800;
  const MAX_ATTEMPTS = 60; // ~48 seconds wait time
  let attempts = 0;
  const seen = new Set();

  function subscribe(conn) {
    // ── 1. Persistent notifications ──────────────────────────────────────────
    conn.subscribeEvents((event) => {
      const { entity_id, new_state, old_state } = event.data || {};

      if (!entity_id || !entity_id.startsWith('persistent_notification.')) return;
      if (!new_state) return;

      const title = new_state.attributes?.title || 'Home Assistant';
      const message = new_state.attributes?.message || '';

      const fingerprint = `${entity_id}|${message}`;
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);

      // Only fire on brand-new notifications (old_state === null)
      if (old_state !== null && old_state !== undefined) return;

      window.api.send('ha-notification', { title, message });
    }, 'state_changed');

    // ── 2. Desktop commands ───────────────────────────────────────────────────
    // Fire from HA with: event: desktop_command / data: { command: "lock_screen" }
    conn.subscribeEvents((event) => {
      const { command, ...payload } = event.data || {};
      if (!command) return;
      window.api.send('desktop-command', { command, payload });
    }, 'desktop_command');
  }

  function pollForConnection() {
    attempts++;
    if (attempts > MAX_ATTEMPTS) return;

    if (window.hassConnection) {
      window.hassConnection
        .then((conn) => subscribe(conn))
        .catch(() => {});
    } else {
      setTimeout(pollForConnection, POLL_INTERVAL);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pollForConnection);
  } else {
    setTimeout(pollForConnection, 1000);
  }
})();
