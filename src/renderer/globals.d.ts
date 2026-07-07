declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component;
  export default component;
}

interface Window {
  api: {
    send: (channel: string, data?: unknown) => void;
    on: (channel: string, func: (...args: unknown[]) => void) => void;
    invoke: (channel: string, data?: unknown) => Promise<unknown>;
  };
}
