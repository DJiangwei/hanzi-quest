import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('kid home renders the voyage board and HUD', async ({ page }) => {
  await enterKidHome(page);
  await expect(page.getByTestId('voyage-board')).toBeVisible();
  expect(await page.getByTestId('voyage-stop-link').count()).toBeGreaterThan(0);
  await expectNoErrorBoundary(page);
});
