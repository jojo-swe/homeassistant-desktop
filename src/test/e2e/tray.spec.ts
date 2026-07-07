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
});
