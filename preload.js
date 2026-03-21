const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    const validChannels = ['get-instances', 'ha-instance', 'reconnect', 'restart', 'start-bonjour', 'ha-notification', 'settings-open', 'desktop-command'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    const validChannels = ['get-instances', 'ha-instance', 'bonjour-instance', 'settings-loaded', 'entities-loaded'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  invoke: (channel, data) => {
    const validChannels = ['get-system-stats', 'get-active-window', 'get-media-status', 'save-settings', 'test-connection', 'save-pinned', 'get-shortcuts', 'save-shortcut', 'remove-shortcut'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  }
});
