# Distribution-Readiness Audit — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)
**Branch:** `feat/distribution-readiness-audit`

## Context

hanzi-quest is now distributed to *different* kids' accounts, not just the maintainer's family (PRs #92/#93/#94 fixed the first wave of single-family assumptions: PIN-gate route group, per-child homework, Story hidden, name privacy). David's chosen next-phase thrust is **harden for distribution**, scoped to a **friends & family** audience (a handful of other kids he personally hands the app to — high trust, no public sign-up polish or moderation needed).

Within that, the chosen first piece is the **isolation / hardcode audit**: before another family touches the app, *correctness* is the gate — one child's data must never reach another account, and no stranger should see family-specific copy ("Yinuo", "海盗班 crew"). This is a safety property, not a feature. A progress dashboard, onboarding flow, and invite links were the other distribution candidates and are explicitly **out of scope** for this phase.

This phase is an **audit that produces findings + targeted fixes + a regression net** — not new product surface (with one small exception: a minimal multi-child picker, see Workstream 3).

## Goal

Make the app safe to hand to another family:
1. Guarantee no cross-account data access (read or write).
2. Remove all user-visible family-specific copy, and generalize the Story hero name.
3. Lock in the guarantees with regression tests so future PRs can't silently regress them.

## Non-Goals

- Parent progress dashboard (deferred — separate phase).
- Guided onboarding / welcome flow (deferred).
- Invite links / account provisioning mechanics (deferred — Clerk self-sign-up works today).
- Public-distribution concerns: content safety, COPPA/privacy, app stores, support (not friends & family).
- Any change to game mechanics, economy, or learning content.

## Audit Findings (gathered during design — the starting record)

These are the concrete findings from the design-phase grounding pass. The implementation re-verifies each and the spec carries them as the audit record.

### Read side — SAFE (verify + document, expected clean)

Every `/play/[childId]/*` page renders under `src/app/play/[childId]/layout.tsx`, which calls `requireChild(childId)` and `notFound()`s on failure. `requireChild` chains `assertParent()` → `getChildOwnedBy(childId, parent.id)`, filtering on **both** `childProfiles.id` AND `childProfiles.parentUserId` — genuine ownership enforcement. The home page (`page.tsx`) re-checks for defense in depth. **Result:** visiting `/play/<another-family's-child>` 404s before any data renders. No read-side exfiltration hole.

Parent routes (`/parent/(secured)/*`) use `assertParent()` + `getChildOwnedBy()` for any child-scoped read. Confirmed gated.

**Audit task:** formally enumerate every route/page/API handler that reads child-scoped data and confirm it sits under a `requireChild`/`getChildOwnedBy` guard. Expected to be a clean pass; record the enumeration in the PR description.

### Write side — REAL FINDING (fix required)

In the Next.js App Router, **every exported `async function` in a `'use server'` file is a publicly-callable RPC endpoint** — the client can invoke it with arbitrary arguments. Three functions are exported from `'use server'` files, take a raw `childId`/`weekId`, and deliberately skip `requireChild` ("trust-caller — only invoked from already-gated actions"). The "only invoked from" assumption is **not enforced by the framework**:

| Function | File | Current guard | Risk | Internal callers (all gated) |
|---|---|---|---|---|
| `pullCardForChild` | `src/lib/actions/gacha.ts` | none (trust-caller) | Authenticated parent can grant a card to *another family's* child | `homework.ts` finishHomeworkAction; `play.ts` finishLevelAction/finishAttemptAction; `story.ts` generateStoryChapter — all after `requireChild` |
| `claimWeeklyGiftIfDue` | `src/lib/actions/gacha.ts` | none (trust-caller) | Same — triggers gift-pack grant on a foreign child | `play.ts` finishAttemptAction — after `requireChild` |
| `triggerEagerStoryGeneration` | `src/lib/actions/play.ts` | none (trust-caller) | Fires paid DeepSeek generation on a foreign child's week | `play.ts` finishLevelAction (Story currently hidden) |

Impact is **write-side mischief, not data exfiltration** (none of these *return* another child's data), but each is a genuine cross-account integrity gap.

**Fix:** relocate these three out of `'use server'` files into a plain (non-`'use server'`) internal module, so the framework no longer exposes them as endpoints while the gated actions still import + call them. Proposed home: `src/lib/play/grants-internal.ts` (or co-locate with existing `src/lib/db/grants.ts` callers — implementer's judgment, but it must NOT be a `'use server'` module). Update the three import sites (`homework.ts`, `play.ts`, `story.ts`).

> **Constraint:** these helpers transitively import `@/lib/db/*` (postgres). The relocation target is a server-only module imported only by server actions — never by a client component. Keep the `'use server'`/client boundary intact.

### Minor finding — `generateMissingImagesForWeek`

`src/lib/actions/images.ts` exports `generateMissingImagesForWeek(weekId)` from a `'use server'` file. It checks `session.userId` (logged in) but **not** parent role or week ownership — any authenticated user can trigger image generation for any `weekId`, burning image-gen + Blob resources. It only writes to *shared-pack* `words.image_url` rows (global content, not child-scoped), so harm is low (resource burn, not data leak).

**Fix (light):** upgrade the guard from `auth()` to `assertParent()` (role check). It stays week-scoped (shared-pack content is intentionally global, so no per-child check needed). This is a 2-line change; classify and fix in the same sweep.

### Hardcodes — user-visible (REAL FINDINGS)

Only two family strings are reachable by a stranger today (the i18n landing `title`/`subtitle` are already generic):

| Location | String | Fix |
|---|---|---|
| `src/app/page.tsx:23` | `For the 海盗班 crew` (badge) | Generalize to neutral copy, e.g. `Weekly characters, made playable` (bilingual per chrome rule where it's kid/parent-facing chrome; landing is pre-auth marketing, keep it simple + non-family) |
| `src/app/parent/(secured)/page.tsx:111` | `🏴‍☠️ The 海盗班 crew sails through the shared 加勒比海 islands…` | Generalize to describe the shared Caribbean pack without the family class name, e.g. `🏴‍☠️ Your crew sails the shared 加勒比海 islands. To add weekly homework, open a child → pick a week → add items.` |

### Hardcodes — Story hero name (fix now, per David)

Story Mode is hidden behind `STORY_HIDDEN`, so these aren't reachable today, but David chose to fix them now so re-enabling Story is correct for any kid:

- `src/lib/ai/deepseek-story.ts` — `SYSTEM_PROMPT` says "The hero is always the same child" and the tone examples hardcode "Yinuo crushed the boss…", "Yinuo cleared…", "Yinuo barely cleared…". Thread the child's display name in: the generator already runs under `requireChild` (it has `child`), so pass `child.displayName` into the prompt builder and replace the literal "Yinuo" in the tone-example strings with the passed name.
- `src/components/play/LatestChapterPill.tsx:22` — `Captain Yinuo&apos;s latest chapter`. The pill is rendered from a server component that has the child; pass `displayName` in and render `Captain {name}'s latest chapter` (keep bilingual treatment consistent with the surrounding chrome).

> Both files are behind `STORY_HIDDEN`; the fix is forward-looking. No need to un-hide Story.

### Hardcodes — non-visible code comments (sweep, per David)

~12 doc comments contain "Yinuo" (collection data files: `flagsData.ts`, `seaCreaturesData.ts`, `solarSystemData.ts`, `dinosaursData.ts`, `landmarksData.ts`, `FestivalCard.tsx`, `LandmarkCard.tsx`, `DinosaurCard.tsx`, `SeaCreatureCard.tsx`, `SolarBodyCard.tsx`, `FlagCard.tsx`, `BonusToast.tsx`). They're never rendered. David chose to sweep them for hygiene. Mechanical: replace "Yinuo is English-native" → "the child is English-native" (or "kids are English-native") in comments only — **do not** touch any rendered string or the bilingual rule itself. AI-prompt files (`generate-week-v1.ts`) that say "6-year-old…English" describe the *audience* generically and need no change.

### Multi-child picker (minimal, per David)

`src/app/page.tsx:12` auto-redirects single-child accounts to `/play/[childId]`; accounts with >1 child fall through to the bare landing with no way to pick a child. Friends & family have ~1 kid each, but David's own account (and any multi-kid family) is stranded.

**Fix (minimal):** when a signed-in user has >1 child, render a simple child-picker on the landing (or a dedicated `/play` index) — one card/button per child (name + avatar + "Play →") linking to `/play/[childId]`, plus the existing "Open parent dashboard" link. No new data model; reads `listChildrenForUser`. Single-child redirect and zero-child landing are unchanged. Bilingual per chrome rule.

## Workstreams (implementation shape)

1. **Cross-account integrity**
   - Relocate `pullCardForChild`, `claimWeeklyGiftIfDue`, `triggerEagerStoryGeneration` out of `'use server'` into a server-only non-action module; update import sites.
   - Upgrade `generateMissingImagesForWeek` guard to `assertParent()`.
   - Read-side enumeration (verify + document; expected clean).

2. **Hardcode generalization**
   - Landing badge + parent dashboard copy → generic.
   - Story hero name → `child.displayName` (prompt + pill), behind `STORY_HIDDEN`.
   - Comment sweep ("Yinuo" → generic in doc comments only).

3. **Minimal multi-child picker**
   - >1-child accounts get a picker on the landing; single/zero-child unchanged.

4. **Regression net**
   - Test: each formerly-trust-caller path rejects a foreign `childId` *at its action entry* (the gated action still enforces ownership; the relocated helper is no longer reachable as an endpoint).
   - Guard test: assert the relocated helpers are not exported from any `'use server'` file (a static check over `src/lib/actions/*` source, or an import-graph assertion) so a future PR can't reintroduce the endpoint.
   - Test: `generateMissingImagesForWeek` rejects a non-parent session.
   - Test: landing renders the child-picker for a 2-child user and redirects for a 1-child user.
   - Snapshot/grep test: no rendered family string ("海盗班", "Yinuo") in user-facing components (lightweight regression guard over `src/app` + `src/components`, excluding comments).

## Testing Strategy

Per repo rules: Vitest + RTL + jsdom; mock all external boundaries (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`). No test hits a real DB or network. The four-green gate (`pnpm typecheck && pnpm lint && pnpm test && pnpm build`) must pass at PR open.

## Out of Scope (explicit deferrals)

- Parent progress dashboard, onboarding flow, invite links.
- Public-distribution hardening (moderation, COPPA, app stores).
- Re-enabling Story Mode (only its name-hardcode is fixed, behind the flag).
- Any DB migration (this phase is code-only — no schema change anticipated).

## Open Questions

None — the three scoping decisions (Story name: fix now; comments: sweep; multi-child: minimal picker) are resolved.
