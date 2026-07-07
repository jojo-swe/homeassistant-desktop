import { test, expect } from './fixtures';

test.describe('Tray and window behavior', () => {
  test('main window exists after launch', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Home Assistant');
  });

  test('app process is running', async ({ process }) => {
    expect(process.pid).toBeDefined();
    expect(process.killed).toBe(false);
  });

  test('onboarding page has subtitle text', async ({ page }) => {
    await expect(page.locator('.subtitle')).toContainText('Home Assistant URL');
  });

  test('app process stays alive after window interactions', async ({ page, process }) => {
    await page.locator('#url').fill('http://test.local:8123');
    await page.locator('#url').clear();
    expect(process.killed).toBe(false);
    await expect(page.locator('h1')).toHaveText('Home Assistant');
  });

  test('main window can navigate to settings page and back', async ({ page }) => {
    await page.locator('#url').waitFor();

    const settingsPath = require('path').join(__dirname, '../../..', 'out/renderer/settings/index.html');
    await page.goto('file://' + settingsPath);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toHaveText('Settings');

    const onboardingPath = require('path').join(__dirname, '../../..', 'out/renderer/index.html');
    await page.goto('file://' + onboardingPath);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible();
  });
});
