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
});
