import { test, expect } from './fixtures';

test.describe('App launch and onboarding', () => {
  test('app launches and shows onboarding page', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Home Assistant');
  });

  test('onboarding has URL input field', async ({ page }) => {
    const urlInput = page.locator('#url');
    await expect(urlInput).toBeVisible();
    await expect(urlInput).toHaveAttribute('placeholder', 'http://homeassistant.local:8123');
  });

  test('onboarding has Connect button', async ({ page }) => {
    const submitBtn = page.locator('#submit');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();
  });

  test('typing invalid URL shows error feedback', async ({ page }) => {
    const urlInput = page.locator('#url');
    await urlInput.fill('not-a-url');
    const feedback = page.locator('.feedback');
    await expect(feedback).toContainText('valid URL');
  });

  test('typing valid http URL shows checking feedback', async ({ page }) => {
    const urlInput = page.locator('#url');
    await urlInput.fill('http://homeassistant.local:8123');
    const feedback = page.locator('.feedback');
    await expect(feedback).toContainText(/Checking|detected|reach/);
  });

  test('URL with invalid path shows path error', async ({ page }) => {
    const urlInput = page.locator('#url');
    await urlInput.fill('http://homeassistant.local:8123/invalid-path');
    const feedback = page.locator('.feedback');
    await expect(feedback).toContainText('path should be');
  });
});
