import { contextBridge, ipcRenderer } from 'electron';
import { SEND_CHANNELS, REPLY_CHANNELS, INVOKE_CHANNELS } from '../main/ipc-channels';

contextBridge.exposeInMainWorld('api', {
  send: (channel: string, data?: unknown) => {
    if (SEND_CHANNELS.includes(channel as (typeof SEND_CHANNELS)[number])) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: string, func: (...args: unknown[]) => void) => {
    if (REPLY_CHANNELS.includes(channel as (typeof REPLY_CHANNELS)[number])) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },
  off: (channel: string, func: (...args: unknown[]) => void) => {
    if (REPLY_CHANNELS.includes(channel as (typeof REPLY_CHANNELS)[number])) {
      ipcRenderer.removeListener(channel, func as never);
    }
  },
  invoke: (channel: string, data?: unknown) => {
    if (INVOKE_CHANNELS.includes(channel as (typeof INVOKE_CHANNELS)[number])) {
      return ipcRenderer.invoke(channel, data);
    }
  },
});
