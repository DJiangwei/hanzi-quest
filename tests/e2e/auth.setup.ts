import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import { expectNoErrorBoundary } from './helpers';

const authFile = 'tests/e2e/.auth/user.json';

setup('sign in as the e2e user', async ({ page }) => {
  const identifier = process.env.E2E_USER_EMAIL;
  if (!identifier) throw new Error('E2E_USER_EMAIL not set');

  await setupClerkTestingToken({ page });
  await page.goto('/');
  await clerk.loaded({ page });
  // Dev-instance canonical path: +clerk_test email + fixed code 424242
  // (the helper enters the code itself; no email is actually sent).
  await clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier } });
  // clerk.signIn can resolve before the session is active — wait for the real thing.
  await page.waitForFunction(
    () => (window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user != null,
    undefined,
    { timeout: 15_000 },
  );
  await page.goto('/');
  await expectNoErrorBoundary(page);
  await page.context().storageState({ path: authFile });
});
