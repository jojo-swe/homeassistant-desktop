import { test, expect } from './fixtures';

test.describe('Error page', () => {
  test('error page loads with Connection Lost title', async ({ page }) => {
    await page.locator('#url').waitFor();

    const errorPath = require('path').join(__dirname, '../../..', 'out/renderer/error/index.html');
    await page.goto('file://' + errorPath);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.error-title')).toHaveText('Connection Lost');
  });

  test('error page has Reconnect button', async ({ page }) => {
    await page.locator('#url').waitFor();

    const errorPath = require('path').join(__dirname, '../../..', 'out/renderer/error/index.html');
    await page.goto('file://' + errorPath);
    await page.waitForLoadState('domcontentloaded');

    const reconnectBtn = page.getByText('Reconnect');
    await expect(reconnectBtn).toBeVisible();
    await expect(reconnectBtn).toHaveAttribute('aria-label', 'Reconnect to Home Assistant');
  });

  test('error page has Restart button', async ({ page }) => {
    await page.locator('#url').waitFor();

    const errorPath = require('path').join(__dirname, '../../..', 'out/renderer/error/index.html');
    await page.goto('file://' + errorPath);
    await page.waitForLoadState('domcontentloaded');

    const restartBtn = page.getByText('Restart');
    await expect(restartBtn).toBeVisible();
    await expect(restartBtn).toHaveAttribute('aria-label', 'Restart application');
  });

  test('error page has theme toggle button', async ({ page }) => {
    await page.locator('#url').waitFor();

    const errorPath = require('path').join(__dirname, '../../..', 'out/renderer/error/index.html');
    await page.goto('file://' + errorPath);
    await page.waitForLoadState('domcontentloaded');

    const themeBtn = page.locator('.theme-toggle');
    await expect(themeBtn).toBeVisible();
  });

  test('error page theme toggle changes data-theme attribute', async ({ page }) => {
    await page.locator('#url').waitFor();

    const errorPath = require('path').join(__dirname, '../../..', 'out/renderer/error/index.html');
    await page.goto('file://' + errorPath);
    await page.waitForLoadState('domcontentloaded');

    const themeBtn = page.locator('.theme-toggle');
    await themeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('error card has role=alert', async ({ page }) => {
    await page.locator('#url').waitFor();

    const errorPath = require('path').join(__dirname, '../../..', 'out/renderer/error/index.html');
    await page.goto('file://' + errorPath);
    await page.waitForLoadState('domcontentloaded');

    const errorCard = page.locator('.error-card');
    await expect(errorCard).toHaveAttribute('role', 'alert');
  });
});
