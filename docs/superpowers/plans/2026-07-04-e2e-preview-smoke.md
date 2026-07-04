# Preview-Deploy E2E Smoke Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playwright smoke flows that run automatically against every Vercel Preview deployment (Clerk Testing-Token auth, writes to the Neon dev branch), catching RSC-boundary crashes and seed/migration drift that unit tests structurally cannot see.

**Architecture:** A `deployment_status`-triggered GitHub workflow passes the preview URL into Playwright via `E2E_BASE_URL`. `@clerk/testing` global setup mints a Testing Token; an auth-setup project signs in a dedicated e2e user once and caches storageState; 6 ordered specs click real flows and assert no error boundary. A one-off script provisions the permanent Clerk e2e user; the suite self-provisions its child through the real parent UI.

**Tech Stack:** Playwright (@playwright/test, existing), `@clerk/testing` (new dev dep), GitHub Actions, Clerk Backend API, gh CLI for secrets.

**Spec:** `docs/superpowers/specs/2026-07-04-e2e-preview-smoke-design.md`

## Global Constraints

- E2E targets previews / localhost ONLY — never set `E2E_BASE_URL` to prod. Preview + local both use the Neon **dev** branch (C1), so real writes are safe.
- Specs assert **structure, not seeded content** (dev-branch data drifts): counts/roles/testids, never week names.
- Local behavior unchanged: `pnpm test:e2e` with no `E2E_BASE_URL` still boots `pnpm dev` and runs against localhost.
- Unit-test gates (`ci.yml`) untouched; the new workflow is non-blocking for merge initially.
- `deployment_status` workflows execute the workflow file from the DEFAULT branch — the trigger only goes live after merge; pre-merge validation is via `workflow_dispatch` + local runs.
- Secrets: `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` (gh repo secrets). Never commit any of these; `tests/e2e/.auth/` is gitignored.
- Scripts touching env follow hard rule #5 (loadEnv first, dynamic imports inside main).
- All four gates green at PR open: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

### Task 1: Playwright config rework + dep

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/global-setup.ts`
- Modify: `.gitignore` (add `tests/e2e/.auth/`)
- Modify: `package.json` (add `@clerk/testing` dev dep)

**Interfaces:**
- Produces: env contract `E2E_BASE_URL` (absent → localhost + webServer); Playwright projects `setup` (matches `*.setup.ts`) → `chromium` (uses `tests/e2e/.auth/user.json` storageState, matches `*.spec.ts` except `smoke.spec.ts` which keeps no-auth).

- [ ] **Step 1: Install dep**

```bash
pnpm add -D @clerk/testing
```

- [ ] **Step 2: Rewrite `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const isRemote = Boolean(process.env.E2E_BASE_URL);
// Vercel "Protection Bypass for Automation" — only set if previews are protected.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // ordered flows share one e2e account
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
    ...(bypass
      ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypass } }
      : {}),
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /\d\d-.*\.spec\.ts/,
    },
    // legacy unauthenticated local smoke
    { name: 'public', use: { ...devices['Desktop Chrome'] }, testMatch: /smoke\.spec\.ts/ },
  ],
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
```

- [ ] **Step 3: Write `tests/e2e/global-setup.ts`**

```ts
import { clerkSetup } from '@clerk/testing/playwright';
import { config as loadDotenv } from 'dotenv';

export default async function globalSetup() {
  // Local runs: pull Clerk keys from .env.local; CI provides real env vars.
  loadDotenv({ path: '.env.local' });
  process.env.CLERK_PUBLISHABLE_KEY ??=
    process.env.E2E_CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  process.env.CLERK_SECRET_KEY ??= process.env.E2E_CLERK_SECRET_KEY;
  await clerkSetup();
}
```

- [ ] **Step 4: `.gitignore`** — add a line `tests/e2e/.auth/`.

- [ ] **Step 5: Verify config loads + legacy smoke still passes locally**

Run: `pnpm exec playwright test --list` (expects the 3 projects listed, no config error).
Run: `pnpm exec playwright install chromium` (if not installed) then `pnpm exec playwright test --project=public`
Expected: `smoke.spec.ts` PASS against auto-booted localhost. (Requires `.env.local` → dev DB, safe.)

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e/global-setup.ts .gitignore package.json pnpm-lock.yaml
git commit -m "test(e2e): config rework — remote baseURL, Clerk global setup, auth project split"
```

---

### Task 2: Create the permanent Clerk e2e user + GitHub secrets

**Files:**
- Create: `scripts/create-e2e-user.ts`

**Interfaces:**
- Produces: Clerk user `e2e-smoke+clerk_test@hanziquest.test` with a generated password; gh repo secrets `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`.

- [ ] **Step 1: Write `scripts/create-e2e-user.ts`**

```ts
// One-off: create the permanent e2e smoke-test user in Clerk (dev instance).
// Idempotent: exits cleanly if the user already exists.
// Usage: pnpm tsx scripts/create-e2e-user.ts   (prints the generated password ONCE)
import { config as loadEnv } from 'dotenv';
import { randomBytes } from 'node:crypto';

const EMAIL = 'e2e-smoke+clerk_test@hanziquest.test';

async function main() {
  loadEnv({ path: '.env.local' });
  const sk = process.env.CLERK_SECRET_KEY;
  if (!sk) throw new Error('CLERK_SECRET_KEY not set');

  const headers = { Authorization: `Bearer ${sk}`, 'Content-Type': 'application/json' };

  const existing = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(EMAIL)}`,
    { headers },
  ).then((r) => r.json());
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`e2e user already exists: ${existing[0].id} (${EMAIL})`);
    return;
  }

  const password = randomBytes(18).toString('base64url');
  const res = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email_address: [EMAIL],
      password,
      first_name: 'E2E',
      last_name: 'Smoke',
      skip_password_checks: true,
    }),
  });
  if (!res.ok) throw new Error(`Clerk create failed: ${res.status} ${await res.text()}`);
  const user = await res.json();
  console.log(`created e2e user: ${user.id}`);
  console.log(`EMAIL:    ${EMAIL}`);
  console.log(`PASSWORD: ${password}   <-- save to gh secret E2E_USER_PASSWORD now`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it (against the Clerk dev instance; no DB touched)**

Run: `pnpm tsx scripts/create-e2e-user.ts`
Expected: `created e2e user: user_…` + printed password (or "already exists").

- [ ] **Step 3: Set GitHub secrets** (values: publishable/secret keys from `.env.local`; email/password from step 2 — do NOT echo them into the transcript, pipe directly)

```bash
grep '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=' .env.local | cut -d'"' -f2 | gh secret set E2E_CLERK_PUBLISHABLE_KEY
grep '^CLERK_SECRET_KEY=' .env.local | cut -d'"' -f2 | gh secret set E2E_CLERK_SECRET_KEY
printf 'e2e-smoke+clerk_test@hanziquest.test' | gh secret set E2E_USER_EMAIL
printf '<password from step 2>' | gh secret set E2E_USER_PASSWORD
gh secret list
```

Expected: 4 secrets listed.

- [ ] **Step 4: Commit**

```bash
git add scripts/create-e2e-user.ts
git commit -m "test(e2e): one-off Clerk e2e-user provisioning script"
```

---

### Task 3: Auth setup + shared helpers + provision spec

**Files:**
- Create: `tests/e2e/helpers.ts`
- Create: `tests/e2e/auth.setup.ts`
- Create: `tests/e2e/01-parent-provision.spec.ts`

**Interfaces:**
- Consumes: projects/global-setup from Task 1; e2e user from Task 2 (env `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`, with local fallback read from `.env.local` keys of the same name if David adds them there — otherwise export in shell).
- Produces: `tests/e2e/.auth/user.json` storageState; helpers `expectNoErrorBoundary(page)`, `enterKidHome(page): Promise<string>` (returns childId), `E2E_CHILD_NAME = 'E2E测试'`.

- [ ] **Step 1: Write `tests/e2e/helpers.ts`**

```ts
import { expect, type Page } from '@playwright/test';

export const E2E_CHILD_NAME = 'E2E测试';

/** The whole point of this suite: the page rendered, not an error boundary. */
export async function expectNoErrorBoundary(page: Page) {
  await expect(page.locator('body')).not.toContainText(/Application error|Something went wrong|服务器出错/);
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
```

- [ ] **Step 2: Write `tests/e2e/auth.setup.ts`**

```ts
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import { expectNoErrorBoundary } from './helpers';

const authFile = 'tests/e2e/.auth/user.json';

setup('sign in as the e2e user', async ({ page }) => {
  const identifier = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!identifier || !password) throw new Error('E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

  await setupClerkTestingToken({ page });
  await page.goto('/');
  await clerk.signIn({ page, signInParams: { strategy: 'password', identifier, password } });
  await page.goto('/');
  await expectNoErrorBoundary(page);
  await page.context().storageState({ path: authFile });
});
```

- [ ] **Step 3: Write `tests/e2e/01-parent-provision.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { E2E_CHILD_NAME, expectNoErrorBoundary } from './helpers';

test('parent dashboard renders and the e2e child exists (created if missing)', async ({ page }) => {
  await page.goto('/parent/children');
  await expectNoErrorBoundary(page);

  if (!(await page.getByText(E2E_CHILD_NAME).first().isVisible().catch(() => false))) {
    // Real add-child flow (AddChildForm: input name="displayName")
    await page.locator('input[name="displayName"]').fill(E2E_CHILD_NAME);
    await page.getByRole('button', { name: /添加|Add/ }).first().click();
    await expect(page.getByText(E2E_CHILD_NAME).first()).toBeVisible({ timeout: 15_000 });
  }
});
```

- [ ] **Step 4: Run locally** (export `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` in the shell first)

Run: `pnpm exec playwright test --project=setup --project=chromium tests/e2e/auth.setup.ts tests/e2e/01-parent-provision.spec.ts`
Expected: both PASS; `tests/e2e/.auth/user.json` created; child "E2E测试" now exists in the DEV db. Adjust the add-button locator to the real AddChildForm submit label if the first run fails there (check `src/components/parent/AddChildForm.tsx`).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/helpers.ts tests/e2e/auth.setup.ts tests/e2e/01-parent-provision.spec.ts
git commit -m "test(e2e): Clerk testing-token auth setup + self-provisioning parent spec"
```

---

### Task 4: Kid-flow specs (02–06)

**Files:**
- Create: `tests/e2e/02-kid-home.spec.ts`
- Create: `tests/e2e/03-week-hub.spec.ts`
- Create: `tests/e2e/04-play-flashcard.spec.ts`
- Create: `tests/e2e/05-surfaces.spec.ts`
- Create: `tests/e2e/06-maps.spec.ts`

**Interfaces:**
- Consumes: `enterKidHome`, `expectNoErrorBoundary` (Task 3); VoyageBoard testids `voyage-board` / `voyage-stop-link`; WeekHub section title 回顾; flashcard buttons 认识/不确定/不认识 (PR #132).

- [ ] **Step 1: Write the five specs**

```ts
// tests/e2e/02-kid-home.spec.ts
import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('kid home renders the voyage board and HUD', async ({ page }) => {
  await enterKidHome(page);
  await expect(page.getByTestId('voyage-board')).toBeVisible();
  expect(await page.getByTestId('voyage-stop-link').count()).toBeGreaterThan(0);
  await expectNoErrorBoundary(page);
});
```

```ts
// tests/e2e/03-week-hub.spec.ts
import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('tapping an island opens the week hub with sections', async ({ page }) => {
  await enterKidHome(page);
  await page.getByTestId('voyage-stop-link').first().click();
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('回顾').first()).toBeVisible();
  await expectNoErrorBoundary(page);
});
```

```ts
// tests/e2e/04-play-flashcard.spec.ts
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
```

```ts
// tests/e2e/05-surfaces.spec.ts
import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('backpack, shop and calendar all render', async ({ page }) => {
  const childId = await enterKidHome(page);
  for (const path of ['collection', 'shop', 'calendar']) {
    await page.goto(`/play/${childId}/${path}`);
    await expectNoErrorBoundary(page);
    // structure-only assertion: the page produced interactive content
    expect(await page.getByRole('link').count() + await page.getByRole('button').count()).toBeGreaterThan(0);
  }
});
```

```ts
// tests/e2e/06-maps.spec.ts
import { expect, test } from '@playwright/test';
import { enterKidHome, expectNoErrorBoundary } from './helpers';

test('maps gateway renders at least one map card', async ({ page }) => {
  const childId = await enterKidHome(page);
  await page.goto(`/play/${childId}/maps`);
  await expectNoErrorBoundary(page);
  await expect(page.getByText(/海/).first()).toBeVisible();
});
```

- [ ] **Step 2: Run the full suite locally**

Run: `pnpm exec playwright test`
Expected: setup + 6 specs PASS against localhost/dev-DB. Fix any locator drift by inspecting the real DOM (playwright trace / `--ui`), NOT by weakening `expectNoErrorBoundary`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/
git commit -m "test(e2e): kid-flow smoke specs — home, week hub, flashcard play, surfaces, maps"
```

---

### Task 5: Workflow + docs + PR

**Files:**
- Create: `.github/workflows/e2e-preview.yml`
- Modify: `CLAUDE.md` (snapshot line + landmine), `docs/IMPROVEMENT-ROADMAP.md` (tick D1)

- [ ] **Step 1: Write `.github/workflows/e2e-preview.yml`**

```yaml
name: E2E (preview)

on:
  deployment_status:
  workflow_dispatch:
    inputs:
      base_url:
        description: 'Deployment URL to test'
        required: true

concurrency:
  group: e2e-${{ github.event.deployment_status.environment_url || inputs.base_url }}
  cancel-in-progress: true

jobs:
  e2e:
    # deployment_status: only successful non-production deployments
    if: >
      github.event_name == 'workflow_dispatch' ||
      (github.event.deployment_status.state == 'success' &&
       !contains(github.event.deployment_status.environment, 'Production'))
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11, run_install: false }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - name: Run smoke suite
        env:
          E2E_BASE_URL: ${{ github.event.deployment_status.environment_url || inputs.base_url }}
          E2E_CLERK_PUBLISHABLE_KEY: ${{ secrets.E2E_CLERK_PUBLISHABLE_KEY }}
          E2E_CLERK_SECRET_KEY: ${{ secrets.E2E_CLERK_SECRET_KEY }}
          E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
          E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
          VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
        run: pnpm exec playwright test
      - name: Upload report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Check whether previews are protected** (decides the bypass secret)

Run: `curl -s -o /dev/null -w "%{http_code}" <this PR's preview URL>`
Expected: `200` (public → skip the bypass secret) or `401` (protected → get the bypass secret from Vercel project settings → Deployment Protection → "Protection Bypass for Automation", set `gh secret set VERCEL_AUTOMATION_BYPASS_SECRET`).

- [ ] **Step 3: Docs** — CLAUDE.md snapshot ("Infra & tests" paragraph: mention the preview e2e suite) + new landmine:

> **Landmine:** *E2E smoke targets previews/localhost — both on the Neon DEV branch — never prod.* The `deployment_status` workflow only runs the workflow file from `main` (goes live post-merge; use `workflow_dispatch` with a preview URL to test changes). Auth = `@clerk/testing` Testing Tokens (works because Clerk is a `pk_test` dev instance) with the permanent user `e2e-smoke+clerk_test@hanziquest.test` (gh secrets `E2E_*`); the suite self-provisions its child "E2E测试" via the real parent UI, so resetting the dev DB branch is always safe. Specs assert STRUCTURE (testids/roles/counts), never seeded content — dev data drifts from prod. Don't weaken `expectNoErrorBoundary` to make a flake pass; that assertion is the suite's entire reason to exist.

Tick D1 in `docs/IMPROVEMENT-ROADMAP.md`.

- [ ] **Step 4: Gates + PR**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (unit tests unaffected — e2e specs are outside vitest's `tests/unit` include).
Then push + `gh pr create` (feature branch `feat/e2e-preview-smoke`). After the PR's preview deploy finishes, validate end-to-end: `gh workflow run e2e-preview.yml -f base_url=<preview-url>` — requires the workflow file on main… if `workflow_dispatch` isn't available pre-merge, run the suite against the preview URL LOCALLY instead: `E2E_BASE_URL=<preview-url> E2E_USER_EMAIL=… E2E_USER_PASSWORD=… pnpm exec playwright test`. Expected: all specs pass against the live preview.

- [ ] **Step 5: Commit + PR**

```bash
git add .github/workflows/e2e-preview.yml CLAUDE.md docs/IMPROVEMENT-ROADMAP.md
git commit -m "ci(e2e): preview-deploy smoke workflow + docs"
git push -u origin feat/e2e-preview-smoke
gh pr create --title "test: preview-deploy e2e smoke suite (D1)" --body "…"
```

---

## Self-review notes

- Spec §4.1→Task 5, §4.2→Task 1, §4.3→Tasks 2–3, §4.4→Tasks 3–4, §4.5 respected (no boss/purchase specs). ✔
- Locators verified against source: `voyage-board`/`voyage-stop-link` testids, `displayName` input, 回顾 SectionCard, 认识 button (PR #132), 开始游戏 EntryChooser. Add-child submit label to be confirmed at Task 3 Step 4 (flagged in-step). ✔
- Type consistency: `enterKidHome(page): Promise<string>` used by all Task-4 specs; `E2E_CHILD_NAME` only by 01. ✔
