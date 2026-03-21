/**
 * This script is injected into the Home Assistant web page after it loads.
 * It waits for HA's internal WebSocket connection object (window.hassConnection)
 * and subscribes to state_changed events for persistent_notification entities.
 * When a new notification appears, it sends it via the secure preload bridge.
 */
(function haNotificationBridge() {
  const POLL_INTERVAL = 800;
  const MAX_ATTEMPTS = 60; // ~48 seconds wait time
  let attempts = 0;
  const seen = new Set();

  function subscribe(conn) {
    conn.subscribeEvents((event) => {
      const { entity_id, new_state, old_state } = event.data || {};

      // Only care about persistent notifications that are new or changed
      if (!entity_id || !entity_id.startsWith('persistent_notification.')) return;
      if (!new_state) return;

      const notifId = entity_id;
      const title = new_state.attributes?.title || 'Home Assistant';
      const message = new_state.attributes?.message || '';

      // Deduplicate: only fire if this is a genuinely new notification
      const fingerprint = `${notifId}|${message}`;
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);

      // If the old_state was null it's a brand new notification, not a reload
      if (old_state !== null && old_state !== undefined) return;

      window.api.send('ha-notification', { title, message });
    }, 'state_changed');
  }

  function pollForConnection() {
    attempts++;
    if (attempts > MAX_ATTEMPTS) return; // give up gracefully

    if (window.hassConnection) {
      window.hassConnection
        .then((conn) => subscribe(conn))
        .catch(() => {}); // HA connection may not be ready yet
    } else {
      setTimeout(pollForConnection, POLL_INTERVAL);
    }
  }

  // Wait for the DOM to be interactive before polling
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pollForConnection);
  } else {
    setTimeout(pollForConnection, 1000);
  }
})();
