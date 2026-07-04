import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('tapping an island opens the week hub with sections', async ({ page }) => {
  await enterKidHome(page);
  await page.getByTestId('voyage-stop-link').first().click();
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('回顾').first()).toBeVisible();
  await expectNoErrorBoundary(page);
});
