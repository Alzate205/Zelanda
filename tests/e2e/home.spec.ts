import { test, expect } from '@playwright/test';

test('home page carga y muestra body', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
