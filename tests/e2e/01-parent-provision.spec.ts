import { expect, test } from '@playwright/test';
import { E2E_CHILD_NAME, expectNoErrorBoundary } from './helpers';

test('parent dashboard renders and the e2e child exists (created if missing)', async ({ page }) => {
  await page.goto('/parent/children');
  await expectNoErrorBoundary(page);

  const exists = await page
    .getByText(E2E_CHILD_NAME)
    .first()
    .isVisible()
    .catch(() => false);

  if (!exists) {
    // Real add-child flow (AddChildForm: input name="displayName", submit "Add child")
    await page.locator('input[name="displayName"]').fill(E2E_CHILD_NAME);
    await page.getByRole('button', { name: /Add child/i }).click();
    await expect(page.getByText(E2E_CHILD_NAME).first()).toBeVisible({ timeout: 15_000 });
  }
});
