# Preview-Deploy E2E Smoke Suite — Design

**Date:** 2026-07-04 · **Status:** approved by David · **Roadmap ref:** `docs/IMPROVEMENT-ROADMAP.md` §P1-D / D1

## 1. Problem

Unit tests (1590) mock every external boundary, so the two bug classes that keep reaching prod are invisible to CI *by construction*: (a) RSC "functions cannot be passed to Client Components" crashes (PackUiMeta class — only reproduces on a real server render), and (b) seed/migration drift against a real DB (avatar-slot FK violation, missing `story_chapters`). Playwright is configured but only a localhost smoke spec exists and CI never runs it.

## 2. Goal

5–8 Playwright flows that run automatically against **every Vercel Preview deployment**, clicking through the real app against the real (dev-branch) database, asserting pages render without error boundaries. Catch the RSC + drift classes before merge.

## 3. Key facts the design leans on

- **Clerk is a development instance** (`pk_test`) even in production → official `@clerk/testing` Testing Tokens work (no CAPTCHA/bot-detection fights).
- **C1 (2026-07-04): Preview deployments use the Neon `dev` branch** → e2e can perform real writes (sign-up, child creation, scene completion) with zero prod risk.
- Vercel's GitHub integration emits `deployment_status` events → the preview URL arrives push-style in `github.event.deployment_status.environment_url`; no polling, no Vercel API token in CI.

## 4. Architecture

### 4.1 Workflow — `.github/workflows/e2e-preview.yml`
- Trigger: `deployment_status` (run only when `state == 'success'` and the environment name starts with `Preview`), plus `workflow_dispatch` with a `base_url` input for manual runs.
- Steps: checkout → pnpm/node setup (mirror ci.yml) → `pnpm install` → `npx playwright install --with-deps chromium` → `pnpm test:e2e` with `E2E_BASE_URL=<environment_url>` + Clerk/e2e secrets.
- Repo secrets (set via `gh secret set`, values from Vercel env / the create-user script): `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, and (only if previews turn out protected) `VERCEL_AUTOMATION_BYPASS_SECRET`.
- Playwright HTML report uploaded as an artifact on failure.
- This workflow is **non-blocking for merge initially** (branch protection still requires only `ci`); promote to required after it proves stable for a couple of weeks.

### 4.2 Playwright config
- `baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'`; `webServer` only when `E2E_BASE_URL` is unset (local behavior unchanged).
- `globalSetup` calls `clerkSetup()` from `@clerk/testing/playwright` (mints the Testing Token).
- Two projects: `setup` (runs `auth.setup.ts`, saves `storageState` to `tests/e2e/.auth/user.json` — gitignored) and `chromium` (depends on `setup`, uses the storage state).
- If `VERCEL_AUTOMATION_BYPASS_SECRET` is set, add the `x-vercel-protection-bypass` header via `extraHTTPHeaders` + query param on first navigation.

### 4.3 Test identity & data
- One permanent Clerk user created by a one-off `scripts/create-e2e-user.ts` (Clerk Backend API; email `e2e-smoke+clerk_test@hanziquest.test`, password from env; skips if the user already exists). NOT part of the app runtime.
- **Self-provisioning spec**: after sign-in, if the account has zero children, create child "E2E测试" through the real parent add-child UI. Idempotent — if the Neon dev branch is ever reset, the next run re-provisions. The e2e parent sets NO PIN (so `/parent` is reachable without PIN automation; the PIN gate redirect itself is asserted not to loop).
- Specs assert on **structure, not seeded content** (dev-branch data drifts from prod): e.g. "≥1 island medallion visible", never "week 3 is named 海边".

### 4.4 The flows (7 specs, ordered)
1. `auth.setup.ts` — Testing-Token sign-in through the real form; storageState saved.
2. `01-parent-provision.spec.ts` — `/parent` renders (no error boundary); child exists or is created via the add-child form.
3. `02-kid-home.spec.ts` — root `/` → entry chooser (or cookie redirect) → kid home renders: voyage board, quest panel, avatar header. This is the heaviest RSC surface (season sync + quest gen + voyage + pills).
4. `03-week-hub.spec.ts` — tap the first available island → week hub shows the 回顾/练习 section cards.
5. `04-play-flashcard.spec.ts` — enter 回顾, a flashcard renders, tap a self-assessment button (认识), scene advances (exercises `startSessionAction` → `finishAttemptAction` incl. the answer-events piggyback, against the dev DB).
6. `05-surfaces.spec.ts` — backpack (`/collection`), shop, calendar each render (packRegistry / shop tabs / lunar-calendar server compute).
7. `06-maps.spec.ts` — `/maps` gateway renders ≥1 map card.

Shared helper `expectNoErrorBoundary(page)`: asserts absence of Next.js error overlay text ("Application error", "Something went wrong") after each navigation.

### 4.5 Out of scope (v1)
Boss fight, purchases (coin-state-dependent), homework/study, mobile viewports, Safari/WebKit, visual regression, performance budgets. Local `smoke.spec.ts` stays as-is.

## 5. Failure modes considered
- **Preview protected** → bypass header (secret provisioned only if needed).
- **Deployment_status fires for Production deploys too** → environment filter in the workflow `if:`.
- **Flaky first-render (cold Neon dev branch)** → Playwright retries stay at 2; generous `navigationTimeout`.
- **Parallel PR previews** → flows are per-user idempotent; two runs racing on the same e2e user could conflict on child creation — the provision spec tolerates "already exists".
- **Clerk instance is shared with prod users** → the e2e user is a normal user with its own data; it never touches other accounts (all app reads/writes are child-scoped by `requireChild`).

## 6. Testing the tests
- `pnpm test:e2e` locally against `pnpm dev` (localhost + dev DB) must pass the same suite.
- First CI validation: this PR's own preview deployment triggers the workflow.

## 7. Docs
- CLAUDE.md: snapshot line + new landmine — *e2e targets previews/dev-DB only; never set `E2E_BASE_URL` to prod; specs assert structure not seeded content; e2e user is `e2e-smoke+clerk_test@…` (Clerk dev instance).* 
- Roadmap: tick D1.
