import { test as base, expect, type Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as net from 'net';
import electronPath from 'electron';

export interface TestFixture {
  /** Settings written to the app's config.json before launch (e.g. a configured instance). */
  appConfig: Record<string, unknown> | undefined;
  process: ChildProcess;
  page: Page;
  debugPort: number;
}

// In a Node context the `electron` package exports the platform-specific binary path.
const ELECTRON_BIN = electronPath as unknown as string;
const APP_ENTRY = path.join(__dirname, '../../..', 'out/main/index.js');

async function findAvailablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = address && typeof address !== 'string' ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!port) throw new Error('Could not allocate an Electron debug port.');
  return port;
}

async function waitForPort(port: number, child: ChildProcess, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        if (child.exitCode !== null || child.signalCode !== null) {
          reject(new Error(`Electron exited before debug port ${port} opened (code: ${child.exitCode}, signal: ${child.signalCode}).`));
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Port ${port} not ready after ${timeoutMs}ms`));
        } else {
          setTimeout(tryConnect, 200);
        }
      });
    }
    tryConnect();
  });
}

/**
 * The app holds a single-instance lock and the debug port, so the next test can only start once
 * this process has fully exited. Ask politely first, then force it.
 */
async function stopApp(child: ChildProcess, graceMs = 5000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), graceMs);
  await exited;
  clearTimeout(timer);
}

export const test = base.extend<TestFixture>({
  debugPort: async ({}, use) => {
    await use(await findAvailablePort());
  },
  appConfig: [undefined, { option: true }],
  process: async ({ appConfig, debugPort }, use) => {
    // Chromium refuses to start as root (e.g. in containers) unless the sandbox is disabled.
    const sandboxArgs = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
    // Fresh profile per test: config (electron-store) and localStorage both live under userData,
    // so without this one test's theme or instance leaks into the next — and into the developer's
    // real app settings. userData derives from these variables on Linux / Windows / macOS.
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ha-desktop-e2e-'));
    const profileEnv =
      process.platform === 'darwin'
        ? { HOME: profileDir }
        : process.platform === 'win32'
          ? { APPDATA: profileDir }
          : { XDG_CONFIG_HOME: profileDir };
    if (appConfig) {
      // Launched as a bare script, the app's userData directory is named "Electron".
      const userData =
        process.platform === 'darwin'
          ? path.join(profileDir, 'Library', 'Application Support', 'Electron')
          : path.join(profileDir, 'Electron');
      fs.mkdirSync(userData, { recursive: true });
      fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify(appConfig));
    }
    const child = spawn(ELECTRON_BIN, [...sandboxArgs, `--remote-debugging-port=${debugPort}`, APP_ENTRY], {
      cwd: path.join(__dirname, '../../..'),
      env: { ...process.env, ...profileEnv, NODE_ENV: 'test', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
      stdio: 'pipe',
    });

    child.stdout?.on('data', (data: Buffer) => {
      console.log(`[electron stdout] ${data.toString().trim()}`);
    });
    child.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('disk_cache') && !msg.includes('gpu_disk_cache')) {
        console.error(`[electron stderr] ${msg}`);
      }
    });

    await waitForPort(debugPort, child);
    await use(child);
    await stopApp(child);
    fs.rmSync(profileDir, { recursive: true, force: true });
  },
  page: async ({ process, debugPort }, use) => {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const contexts = browser.contexts();
    const ctx = contexts[0] || (await browser.newContext());
    const pages = ctx.pages();
    const page = pages[0] || (await ctx.newPage());
    await page.waitForLoadState('domcontentloaded');
    await use(page);
    await browser.close();
  },
});

export { expect };
