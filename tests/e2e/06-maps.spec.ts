import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('maps gateway renders at least one map card', async ({ page }) => {
  const childId = await enterKidHome(page);
  await page.goto(`/play/${childId}/maps`);
  await expectNoErrorBoundary(page);
  await expect(page.getByText(/海/).first()).toBeVisible();
});
