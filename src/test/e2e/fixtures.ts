import { test as base, expect, type Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as net from 'net';

export interface TestFixture {
  process: ChildProcess;
  page: Page;
  debugPort: number;
}

// Electron 43 downloads its binary on first require, not during npm install.
const ELECTRON_BIN = require('electron') as string;
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

export const test = base.extend<TestFixture>({
  debugPort: async ({}, use) => {
    await use(await findAvailablePort());
  },
  process: async ({ debugPort }, use) => {
    const args = [
      ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : []),
      `--remote-debugging-port=${debugPort}`,
      APP_ENTRY,
    ];
    const child = spawn(ELECTRON_BIN, args, {
      cwd: path.join(__dirname, '../../..'),
      env: { ...process.env, NODE_ENV: 'test', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
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
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
      child.kill('SIGTERM');
      await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 1000))]);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
    }
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
