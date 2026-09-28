import * as http from 'http';
import type { AddressInfo } from 'net';
import { test, expect } from './fixtures';

// A stand-in for a Home Assistant instance: the availability checker polls /auth/providers.
const FAKE_HA_PORT = 18123;
const FAKE_HA_URL = `http://127.0.0.1:${FAKE_HA_PORT}`;

let server: http.Server;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url?.startsWith('/auth/providers')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<!doctype html><html><body><h1 id="fake-ha">Fake Home Assistant</h1>' +
        '<a id="third-party" href="https://example.invalid/">elsewhere</a></body></html>'
    );
  });
  await new Promise<void>((resolve) => server.listen(FAKE_HA_PORT, '127.0.0.1', resolve));
  expect((server.address() as AddressInfo).port).toBe(FAKE_HA_PORT);
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.describe('Configured instance', () => {
  test.use({
    appConfig: { allInstances: [FAKE_HA_URL], currentInstance: 0, autoUpdate: false },
  });

  test('loads the saved instance on startup instead of onboarding', async ({ page }) => {
    await expect.poll(() => page.url(), { timeout: 15000 }).toContain(FAKE_HA_URL);
    await expect(page.locator('#fake-ha')).toBeVisible();
  });

  test('links to third-party sites do not navigate the app window', async ({ page }) => {
    await expect.poll(() => page.url(), { timeout: 15000 }).toContain(FAKE_HA_URL);
    // Click from inside the page: Playwright's click() would wait for a navigation that the app cancels.
    await page.evaluate(() => (document.getElementById('third-party') as HTMLAnchorElement).click());
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(page.url()).toContain(FAKE_HA_URL);
    // Same document still loaded. Checked via evaluate: locator assertions would wait for the
    // cancelled navigation that Playwright saw start to "finish", which it never does.
    expect(await page.evaluate(() => !!document.getElementById('fake-ha'))).toBe(true);
  });

  test('the Home Assistant page cannot read app settings over IPC', async ({ page }) => {
    await expect.poll(() => page.url(), { timeout: 15000 }).toContain(FAKE_HA_URL);
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const api = (window as unknown as { api: any }).api;
          api.on('settings-loaded', (settings: unknown) => resolve(settings));
          api.send('settings-open');
          setTimeout(() => resolve('no-reply'), 1500);
        })
    );
    expect(result).toBe('no-reply');
  });
});
