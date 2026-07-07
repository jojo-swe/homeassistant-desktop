declare module 'electron-log' {
  interface ElectronLog {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
    catchErrors: (opts?: unknown) => void;
  }

  const log: ElectronLog;
  export default log;
}
