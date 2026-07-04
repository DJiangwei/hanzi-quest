import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('review section plays a flashcard and advances on 认识', async ({ page }) => {
  const childId = await enterKidHome(page);
  await page.getByTestId('voyage-stop-link').first().click();
  await page.waitForURL(/\/week\/([0-9a-f-]+)/);
  const weekId = page.url().match(/\/week\/([0-9a-f-]+)/)![1];
  await page.goto(`/play/${childId}/level/${weekId}/review`);
  const gotIt = page.getByRole('button', { name: /^认识/ });
  await expect(gotIt.first()).toBeVisible({ timeout: 20_000 });
  await gotIt.first().click();
  // Next flashcard, or the fanfare if it was a 1-scene section — either is a pass.
  await expect(
    page.getByRole('button', { name: /认识|继续|返回/ }).first(),
  ).toBeVisible({ timeout: 20_000 });
  await expectNoErrorBoundary(page);
});
