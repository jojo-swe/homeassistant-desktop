import { test, expect } from './fixtures';

test.describe('Settings window', () => {
  test('settings page loads and shows form fields', async ({ page }) => {
    await page.locator('#url').waitFor();

    const settingsPath = require('path').join(__dirname, '../../..', 'out/renderer/settings/index.html');
    await page.goto('file://' + settingsPath);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1')).toHaveText('Settings');
    await expect(page.locator('#haUrl')).toBeVisible();
    await expect(page.locator('#haToken')).toBeVisible();
  });

  test('settings has theme toggle button', async ({ page }) => {
    await page.locator('#url').waitFor();

    const settingsPath = require('path').join(__dirname, '../../..', 'out/renderer/settings/index.html');
    await page.goto('file://' + settingsPath);
    await page.waitForLoadState('domcontentloaded');

    const themeBtn = page.locator('.icon-btn');
    await expect(themeBtn).toBeVisible();
  });

  test('settings has import/export buttons', async ({ page }) => {
    await page.locator('#url').waitFor();

    const settingsPath = require('path').join(__dirname, '../../..', 'out/renderer/settings/index.html');
    await page.goto('file://' + settingsPath);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Export Config')).toBeVisible();
    await expect(page.getByText('Import Config')).toBeVisible();
  });

  test('settings theme toggle changes data-theme attribute', async ({ page }) => {
    await page.locator('#url').waitFor();

    const settingsPath = require('path').join(__dirname, '../../..', 'out/renderer/settings/index.html');
    await page.goto('file://' + settingsPath);
    await page.waitForLoadState('domcontentloaded');

    const themeBtn = page.locator('.icon-btn');
    await themeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('settings has entity search with role=search', async ({ page }) => {
    await page.locator('#url').waitFor();

    const settingsPath = require('path').join(__dirname, '../../..', 'out/renderer/settings/index.html');
    await page.goto('file://' + settingsPath);
    await page.waitForLoadState('domcontentloaded');

    const searchSection = page.locator('[role="search"]');
    await expect(searchSection).toBeVisible();
    await expect(page.locator('#entitySearch')).toBeVisible();
  });

  test('settings status message has aria-live', async ({ page }) => {
    await page.locator('#url').waitFor();

    const settingsPath = require('path').join(__dirname, '../../..', 'out/renderer/settings/index.html');
    await page.goto('file://' + settingsPath);
    await page.waitForLoadState('domcontentloaded');

    const statusMsg = page.locator('.status-msg');
    await expect(statusMsg).toHaveAttribute('aria-live', 'polite');
  });

  test('settings token toggle has aria-label', async ({ page }) => {
    await page.locator('#url').waitFor();

    const settingsPath = require('path').join(__dirname, '../../..', 'out/renderer/settings/index.html');
    await page.goto('file://' + settingsPath);
    await page.waitForLoadState('domcontentloaded');

    const tokenToggle = page.locator('.token-toggle');
    await expect(tokenToggle).toHaveAttribute('aria-label', 'Show or hide token');
  });
});
