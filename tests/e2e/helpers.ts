import { expect, type Page } from '@playwright/test';

export const E2E_CHILD_NAME = 'E2E测试';

/** The whole point of this suite: the page rendered, not an error boundary. */
export async function expectNoErrorBoundary(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /Application error|Something went wrong|服务器出错/,
  );
}

/** From anywhere: open the entry chooser and enter the kid game. Returns childId. */
export async function enterKidHome(page: Page): Promise<string> {
  await page.goto('/?choose=1');
  await page.getByRole('button', { name: /开始游戏/ }).first().click();
  await page.waitForURL(/\/play\/[0-9a-f-]+/);
  await expectNoErrorBoundary(page);
  const m = page.url().match(/\/play\/([0-9a-f-]+)/);
  if (!m) throw new Error(`no childId in url: ${page.url()}`);
  return m[1];
}
