const { contextBridge, ipcRenderer } = require('electron');
const { SEND_CHANNELS, REPLY_CHANNELS, INVOKE_CHANNELS } = require('./src/ipc-channels');

contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    if (SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    if (REPLY_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  invoke: (channel, data) => {
    if (INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },
});
