import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('backpack, shop and calendar all render', async ({ page }) => {
  const childId = await enterKidHome(page);
  for (const path of ['collection', 'shop', 'calendar']) {
    await page.goto(`/play/${childId}/${path}`);
    await expectNoErrorBoundary(page);
    // structure-only assertion: the page produced interactive content
    const interactive =
      (await page.getByRole('link').count()) + (await page.getByRole('button').count());
    expect(interactive, `${path} should render interactive content`).toBeGreaterThan(0);
  }
});
