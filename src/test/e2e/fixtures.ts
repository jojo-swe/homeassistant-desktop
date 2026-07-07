import { test as base, expect, type Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as net from 'net';

export interface TestFixture {
  process: ChildProcess;
  page: Page;
}

const ELECTRON_BIN = path.join(__dirname, '../../..', 'node_modules/electron/dist/electron.exe');
const APP_ENTRY = path.join(__dirname, '../../..', 'out/main/index.js');
const DEBUG_PORT = 9222;

async function waitForPort(port: number, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
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
  process: async ({}, use) => {
    const child = spawn(ELECTRON_BIN, [`--remote-debugging-port=${DEBUG_PORT}`, APP_ENTRY], {
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

    await waitForPort(DEBUG_PORT);
    await use(child);
    child.kill('SIGTERM');
    if (!child.killed) child.kill('SIGKILL');
    await new Promise((r) => setTimeout(r, 1000));
  },
  page: async ({ process }, use) => {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
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
