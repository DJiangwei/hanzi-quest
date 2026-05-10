# Architecture — hanzi-quest

This document describes **how the system is built**. For *what we are building and why*, read [`GAME-DESIGN.md`](./GAME-DESIGN.md). For the phase roadmap and shipped PR log, read [`PLAN.md`](./PLAN.md).

A future session — even on a smaller model — should be able to read this document and make confident changes without re-deriving the design from code.

---

## 1. Stack at a glance

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** App Router + TypeScript | The repo's CLAUDE.md / AGENTS.md flag this: Next 16 renamed `middleware.ts` → `proxy.ts`, removed deprecated APIs. **Always read `node_modules/next/dist/docs/` before assuming an API.** |
| Hosting | **Vercel** (Fluid Compute) | All routes are Vercel Functions; Node 24 default; auto-deploy from GitHub main + preview per PR. |
| Database | **PostgreSQL via Neon** (Vercel Marketplace) | A single Neon DB serves Production, Preview, and Development envs. |
| ORM / migrations | **Drizzle** 0.45 + drizzle-kit | Schema in `src/db/schema/*.ts`; migrations in `drizzle/`. Run via `pnpm db:generate` + `pnpm db:migrate`. |
| Auth | **Clerk** (Vercel Marketplace) | `clerkMiddleware` lives in `src/proxy.ts`. We mirror Clerk users into our own `users` table on first authenticated touch (see §6 Auth flow). |
| AI generation | **DeepSeek V4 Pro** via Vercel AI SDK | Originally Claude through Vercel AI Gateway; switched 2026-05-10 — Gateway requires credit card on file. DeepSeek key in `DEEPSEEK_API_KEY` env. |
| Styling | Tailwind v4 (`@theme` in `globals.css`) | Pirate-adventure tokens — `sand` / `ocean` / `sunset` / `treasure` / semantic `good` `bad`. |
| Fonts | next/font/google: Fredoka (Latin), Noto Sans SC, Noto Serif SC | Display hanzi uses `.font-hanzi` (Noto Serif SC) — 楷书 textbook feel. |
| Validation | Zod | Server actions and AI outputs are Zod-validated at every boundary. |
| Forms | React 19 `useActionState` + server actions | No client-side form library. |
| Test | Vitest (unit) + Playwright (e2e, only smoke today) | All schema / scene / action tests are mock-based; no DB required in CI. |

---

## 2. Repository map

```
src/
├─ app/                              # Next App Router
│  ├─ layout.tsx                     # ClerkProvider + fonts + manifest
│  ├─ page.tsx                       # Public landing
│  ├─ icon.svg, apple-icon.tsx       # PWA icons
│  ├─ manifest.ts                    # Web app manifest
│  ├─ (auth)/sign-in, sign-up        # Catch-all Clerk components
│  ├─ parent/                        # Parent-only console (status pages)
│  │   ├─ layout.tsx                 # Bootstrap + parent shell
│  │   ├─ page.tsx                   # Dashboard
│  │   ├─ children/                  # CRUD on child_profiles
│  │   ├─ week/new, week/[id]/review # Single-week input + AI review
│  │   └─ stage/new                  # Bulk paste 10 lessons
│  ├─ play/[childId]/                # Child-friendly play surface
│  │   ├─ layout.tsx                 # Gradient bg + minimal chrome
│  │   ├─ page.tsx                   # Island map (level select)
│  │   └─ level/[weekId]/page.tsx    # Hosts <SceneRunner>
│  └─ api/webhooks/clerk/route.ts    # Clerk user.created/.updated/.deleted
├─ components/
│  ├─ parent/                        # Parent-side forms & buttons
│  └─ scenes/                        # SceneRunner + 5 scene types + shared Quiz UI
├─ db/
│  ├─ index.ts                       # Drizzle client (postgres-js)
│  └─ schema/{auth,content,game,economy,collections,avatar,system}.ts
├─ lib/
│  ├─ auth/{bootstrap,guards}.ts     # ensureUserBootstrapped, assertParent, requireChild
│  ├─ db/{users,children,curriculum,weeks,characters,ai-jobs,play,coins}.ts
│  ├─ actions/{children,weeks,play}.ts        # server actions ('use server')
│  ├─ ai/{generate-content,schemas,prompts/}  # AI pipeline (DeepSeek V4 Pro)
│  ├─ hanzi/extract.ts                        # Unicode Han ideograph extractor
│  └─ scenes/{registry,types,configs,compile-week,sample}.ts
├─ i18n/                             # next-intl (en + zh-CN scaffolding)
└─ proxy.ts                          # clerkMiddleware (Next 16 file convention)

drizzle/                              # Generated migrations + journal
scripts/
├─ migrate.ts                        # apply migrations
├─ preview-week-gen.ts               # dry-run AI gen on a char list
├─ seed-pirate-class.ts              # one-shot: shared 海盗班 pack
└─ bind-yinuo-to-pirate-class.ts     # one-shot: enroll children into a pack
tests/unit/                          # Vitest (10 files, ~61 cases)
```

---

## 3. End-to-end data flow

```
                         ┌────────────────────────────────┐
       parent UI ───►    │  /parent/stage/new (paste 10   │
                         │   lines = 10 lessons)          │
                         └───────────────┬────────────────┘
                                         │ createStageAction
                                         ▼
                          ┌────────────────────────────────┐
                          │  weeks rows (status=draft)     │
                          │  + week_characters links       │
                          │  + characters (upsert by hanzi)│
                          └───────────────┬────────────────┘
                                          │  user clicks
                                          │  "Generate AI"
                                          ▼
                          ┌────────────────────────────────┐
                          │  generateWeekAction →          │
                          │  generateWeekContent           │
                          │  → DeepSeek V4 Pro via AI SDK  │
                          │  → Zod-validated WeekContent   │
                          │  → persist words / sentences   │
                          │  → status = awaiting_review    │
                          │  → ai_jobs row records tokens  │
                          └───────────────┬────────────────┘
                                          │
       parent UI ───►    /parent/week/[id]/review (edit cards, regenerate)
                                          │ publishWeekAction
                                          ▼
                          ┌────────────────────────────────┐
                          │ compileWeekIntoLevels →        │
                          │ 14 week_levels rows:           │
                          │   10× flashcard + 1× audio_pick│
                          │   + 1× visual_pick + (image_pick│
                          │   if any char has imageHook)   │
                          │   + word_match (if ≥2 words)   │
                          │ status = published             │
                          └───────────────┬────────────────┘
                                          ▼
       child UI ───►     /play/[childId]
                          │ listChildPlayableWeeks  ← child's own + pack-shared
                          ▼
                          /play/[childId]/level/[weekId]
                          │ <SceneRunner> walks the levels
                          │   on mount: startSessionAction
                          │   between cards: finishAttemptAction (+50 coins)
                          │   at end: finishLevelAction (week_progress)
                          ▼
                          🎉 "Island cleared! +X coins"
```

---

## 4. The two curriculum modes

The same `weeks` table represents **both** kinds of week, distinguished by who owns it:

| | Per-family week | Shared pack week |
|---|---|---|
| `parent_user_id` | non-null | **null** |
| `child_id` | non-null | **null** |
| `curriculum_pack_id` | family's own auto-created `school-custom` | a public pack (e.g. `pirate-class-level-1`) |
| Created by | `/parent/stage/new` server action | `scripts/seed-pirate-class.ts` |
| Uniqueness | `(child_id, week_number)` unique | partial unique `(curriculum_pack_id, week_number) WHERE child_id IS NULL` |
| Who plays it | only that child | **every** child whose `current_curriculum_pack_id` points at this pack |

`lib/db/weeks.ts::listChildPlayableWeeks(childId)` returns the union: the child's per-family published weeks **plus** the published shared weeks of the pack they're enrolled in. Shared weeks surface first in the order.

**Implication**: if you ever filter on `weeks.parent_user_id` or `weeks.child_id`, remember the column can be `NULL` for shared rows. Use `isNull(weeks.childId)` to target shared, or join via `child_profiles.current_curriculum_pack_id`.

---

## 5. Database schema overview

Source of truth: `src/db/schema/*.ts`. Migrations in `drizzle/*.sql`. PLAN.md §4 has the original column-by-column spec.

```
auth      users (Clerk id = text PK)              child_profiles (parent_user_id FK)
content   characters (hanzi+script unique)        words / example_sentences
          character_word, character_sentence      curriculum_packs   weeks   week_characters
game      scene_templates (7 types, seeded)       week_levels (compiled output of publish)
          play_sessions, scene_attempts           week_progress, streaks
economy   coin_balances, coin_transactions        shop_items, shop_purchases, gacha_pulls
collections collection_packs, collectible_items   child_collections, shard_balances
avatar    avatar_slots, avatar_items              child_avatar_inventory, child_avatar_equipped, powerup_inventory
system    ai_jobs (token usage, status)           audit_log
```

Conventions:
- All primary keys are `uuid` with `defaultRandom()` **except** `users.id` (text — Clerk id) and `avatar_slots.id` (text — semantic slot key).
- `script` enum for content; per-family content is `script='simplified'`.
- Cross-file FKs use lazy `references(() => otherTable.col)` callbacks; circular module imports between `auth.ts` and `content.ts` resolve at DDL-generation time, not import time.
- Tables include `created_at`, plus `updated_at` where mutations happen.

To add a new column or table:
1. Edit `src/db/schema/*.ts`.
2. `pnpm db:generate` — drizzle-kit produces `drizzle/NNNN_*.sql`.
3. Read the generated SQL — never trust it blind.
4. `pnpm db:migrate` (writes to Neon).
5. Commit BOTH the schema change and the generated SQL + `drizzle/meta/*` snapshot.

Pitfall: if you ever generate a `--custom` migration, drizzle-kit's first run records the empty file's hash in `drizzle.__drizzle_migrations`. Editing the file afterward won't reapply — you must `DELETE FROM drizzle.__drizzle_migrations` for that row and re-run. See git log around drizzle/0001_cool_drax.sql for context.

---

## 6. Auth flow

```
Clerk session (browser)
  │
  ▼
src/proxy.ts (clerkMiddleware)
  ├─ public matchers: /, /sign-in*, /sign-up*, /api/webhooks/*
  └─ all others: auth.protect() — Clerk 7 returns 404 to anon (intentional)
  │
  ▼
src/app/parent/layout.tsx
  │ const user = await ensureUserBootstrapped()
  │   ┌─────────────────────────────────────────────────────┐
  │   │ getUserById(clerkId) → exists?  return row          │
  │   │   missing? → currentUser() → upsert users row       │
  │   │            → ensureSchoolCustomPack(userId)          │
  │   └─────────────────────────────────────────────────────┘
  │ redirect '/sign-in' if no user
  │
  ▼
server action / page receives request
  │ assertParent() — throws Unauthorized/Forbidden
  │ requireChild(childId) — throws NotFound if child doesn't belong to caller
  │
  ▼
work happens, scoped queries always include parent_user_id or child_id checks
```

The **bootstrap pattern** is load-bearing: the Clerk webhook (`/api/webhooks/clerk`) is currently optional because `ensureUserBootstrapped` self-heals on the first authenticated request. If we ever turn off the bootstrap, the webhook becomes mandatory.

---

## 7. AI pipeline

Files:
- `src/lib/ai/schemas.ts` — `WeekContentSchemaV1` + `PerCharacterSchema` (Zod). Tone-mark pinyin required (`pinyin: string[]` one entry per character of the surrounding text); exactly 3 words per character; sentence ≤ 12 chars.
- `src/lib/ai/prompts/generate-week-v1.ts` — system prompt + 2-shot example. `PROMPT_VERSION = 'generate-week-v1'` is stored in `ai_jobs.input.promptVersion` for traceability.
- `src/lib/ai/generate-content.ts` — `generateWeekContent` and `regenerateCharacter`. Uses `deepseek('deepseek-v4-pro')` from `@ai-sdk/deepseek`. Wraps `generateObject` with the schema. Persists in a single transaction.

Idempotence:
- Character rows are upserted on `(hanzi, script)` — re-running gen updates pinyin/meaning/hook.
- Word and sentence links are *replaced* per character (drop old links, insert new), not merged. This keeps regen "destructive but clean."

Token usage is recorded on `ai_jobs` (`tokens_in`, `tokens_out`). No cost calculation yet — DeepSeek pricing is ~$0.005 per 10-char week.

Adding a new prompt version:
1. Create `src/lib/ai/prompts/generate-week-v2.ts` (don't edit v1 — history matters).
2. Bump callers to pass v2's system + builder.
3. Persist the version in `ai_jobs.input.promptVersion`.
4. Schemas may need versioning too (`WeekContentSchemaV2`).

---

## 8. Scene system

The whole game loop hinges on **scenes** — small interactive units. There are 5 active scene types today; the registry is built to take more without refactoring callers.

### 8.1 Compile-time vs run-time

```
parent publishes a week
        │
        ▼
compileWeekIntoLevels(weekId)
   ├─ reads characters + their words/sentences/imageHook
   ├─ picks templates from scene_templates (active only)
   └─ emits week_levels rows: { sceneTemplateId, sceneConfig (jsonb), position }
        │
        ▼
        DB stable. The level is now playable.

child opens level
        │
        ▼
listLevelsForWeek(weekId) → CompiledLevel[]
        │
        ▼
<SceneRunner> walks the array
   for each level:
     switch (sceneType):
       'flashcard'   → <FlashcardScene>
       'audio_pick'  → <AudioPickScene>  (pool = whole week)
       'visual_pick' → <VisualPickScene>
       'image_pick'  → <ImagePickScene>
       'word_match'  → <WordMatchScene>  (pairs computed from configured characterIds)
```

`scene_config` is loose `jsonb` so each scene type can store what it needs. Today: just `{ characterId }` (or `{ characterIds: string[] }` for `word_match`). The full character details — pinyin, words, sentence, imageHook — are fetched separately and passed into all scenes as a `pool` so distractors stay coherent within the same week.

### 8.2 How to add a new scene type

1. Add the enum value in `src/db/schema/game.ts` (`scene_type` pgEnum) if it isn't already there. Regenerate + apply migration.
2. Seed an `scene_templates` row (or update the existing one to `is_active = true`).
3. Define the config Zod schema in `src/lib/scenes/configs.ts`.
4. Write the component in `src/components/scenes/MyScene.tsx`. It receives `target` + `pool` (or similar) + `onComplete(correct: boolean)`. For multiple-choice, wrap `<MultipleChoiceQuiz>`.
5. Wire dispatch in `src/components/scenes/SceneRunner.tsx`.
6. Update `compile-week.ts` to emit your scene type with appropriate `scene_config`.
7. Add a vitest case in `tests/unit/compile-week.test.ts` covering the new output path.

No changes needed in: `play.ts` actions, repository helpers, or any UI outside the runner. That's the win.

### 8.3 Coin economy plug-in

Every scene completion goes through `finishAttemptAction(...)`, which awards coins based on first-time vs replay vs all-correct bonus (see `lib/actions/play.ts`). New scene types automatically participate — they just need to call `onComplete(true/false)` correctly.

---

## 9. Deployment & infra

| Resource | Provisioned by | Notes |
|---|---|---|
| Vercel project | `daviddaijw-6886s-projects/hanzi-adventure` | Renamed 2026-05-10 from `hanzi-quest`. Auto-aliased at `hanzi-adventure.vercel.app`; old alias `hanzi-quest-eight.vercel.app` still works. |
| GitHub repo | `DJiangwei/hanzi-quest` | SSH push only (gh CLI OAuth token lacks `workflow` scope; can't push `.github/workflows/*` over HTTPS). |
| GitHub → Vercel deploy | wired | Every push to `main` → prod deploy; every PR → preview deploy. |
| Neon Postgres | `neon-cordovan-leaf` via Vercel Marketplace | One DB shared across prod / preview / dev envs. |
| Clerk | `clerk-byzantium-sail` via Vercel Marketplace, app slug `singular-whippet-76` (dev tier) | Dashboard reachable only via `vercel integration open clerk` → SSO link. Direct dashboard.clerk.com login won't show the instance. |
| AI provider | DeepSeek V4 Pro | API key in `DEEPSEEK_API_KEY`; landed in Production + Development Vercel envs. Preview env not set (Vercel CLI 53.x quirk — preview adds need manual dashboard click). |
| Branch protection on main | **not enforced** | Phase 0 checklist item to revisit. |
| Vercel SSO / deployment protection | **disabled** | Otherwise the renamed `hanzi-adventure.vercel.app` alias returned 401 to public; Clerk handles app-level auth anyway. |

OIDC token for AI Gateway lives in `VERCEL_OIDC_TOKEN` and expires every ~12 hours — local scripts that hit Gateway need a recent `vercel env pull .env.local`. Since we switched to DeepSeek this matters less.

---

## 10. Testing strategy

| Layer | Tool | Approach |
|---|---|---|
| Unit | Vitest | Mock external boundaries (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`). 10 files, ~61 cases today. Run with `pnpm test`. |
| Type | tsc --noEmit | `pnpm typecheck`. Required green for merge. |
| Lint | ESLint | `pnpm lint`. We hit two React-hooks rules in PR #6 — see those commits for the patterns (`useRef<number>(0)` not `useRef<number>(Date.now())`; remount via `key={...}` instead of reset-state-in-effect). |
| Build | Next | `pnpm build`. Required green for merge. |
| E2E | Playwright | Only smoke test scaffolded; real e2e is V2. |

Mock patterns we use (see `tests/unit/compile-week.test.ts` for the canonical example):

```ts
const mocks = vi.hoisted(() => ({
  // build mock fns here, NOT outside the hoisted callback
  // — vi.mock() hoists to file top, before const declarations execute
}));
vi.mock('@/db', () => ({ db: { ... mocks.fn ... } }));
```

UUIDs in test fixtures must be valid v4 (`11111111-2222-4333-a444-555555555555`). Zod's `.uuid()` strictly enforces the version digit; the nil UUID will fail.

`redirect()` from `next/navigation` is mocked to throw — assert via `expect(action).rejects.toThrow('__REDIRECT__:/some/path')`.

---

## 11. Cookbook — common future tasks

### Add a new admin page under `/parent/X`
1. Create `src/app/parent/X/page.tsx`. Use `assertParent()` at the top.
2. If you need form input, factor a client component into `src/components/parent/XForm.tsx` using `useActionState`.
3. Server actions go in `src/lib/actions/X.ts` with `'use server'`.
4. Link from `/parent` dashboard.

### Add a new column to an existing table
1. Edit `src/db/schema/*.ts`.
2. `pnpm db:generate` + read SQL + `pnpm db:migrate`.
3. Update affected repos (`src/lib/db/*.ts`) and consumers.
4. **Always nullable on first add** unless you have a backfill story — adding `NOT NULL` to a table with existing rows breaks the migration.

### Change the AI prompt
1. New file `src/lib/ai/prompts/generate-week-vN.ts`.
2. Update `PROMPT_VERSION`.
3. Wire callers.
4. `scripts/preview-week-gen.ts` to dry-run before persisting.

### Run a one-off data migration
1. Write `scripts/something.ts`. **Dynamic-import** anything that touches the db client at module load (see `scripts/seed-pirate-class.ts` — `await import('../src/db')` inside `main()`, not at file top, so dotenv runs first).
2. Test idempotence: re-running must be a no-op.
3. Commit the script even though it's a one-off — it's executable history.

### Reach the Clerk dashboard
`vercel integration open clerk` from the repo. Direct dashboard login does NOT show Marketplace-provisioned instances.

### Sync AI Gateway / DeepSeek key
- DeepSeek: `vercel env add DEEPSEEK_API_KEY <env>` (preview env gets stuck non-interactively — use dashboard for that one).
- Gateway OIDC (if we ever re-enable Gateway): `vercel env pull .env.local`. Token lasts ~12h.

---

## 12. Known sharp edges

- **Vercel AI Gateway** requires a credit card. We're on DeepSeek to avoid this. If you re-enable Gateway, add the card or expect 403s.
- **Vercel CLI 53.x** can't add Preview env vars non-interactively (it always wants `<gitbranch>` or interactive confirm). Use dashboard.
- **Drizzle journal** in `drizzle/meta/` MUST be committed. The Phase 0 scaffold ignored it; PR #1 removed that line from `.gitignore`. Never re-add.
- **Clerk 7 control components**: `<SignedIn>`/`<SignedOut>` were removed — use `<Show when="signed-in">` / `<Show when="signed-out">`. `<UserButton afterSignOutUrl>` was removed — lift to `<ClerkProvider afterSignOutUrl="/">`.
- **`auth.protect()` returns 404 by default** in Clerk 7. That's what makes `/parent/*` 404 to anon visitors instead of redirecting to sign-in. Acceptable today; future PR can pass `unauthenticatedUrl: '/sign-in'` for friendlier UX.
- **Route groups vs path segments**: `app/(parent)/page.tsx` would collide with `app/page.tsx` at `/`. We use a real `app/parent/` segment, not a group.
- **Next 16 file rename**: `middleware.ts` → `src/proxy.ts`. Default export still works. Don't recreate `middleware.ts`.

---

## 13. Pointers

- Roadmap and per-phase status: [`PLAN.md`](./PLAN.md)
- Product design + pedagogy + aesthetics: [`GAME-DESIGN.md`](./GAME-DESIGN.md)
- Per-session collaboration norms and surprising behaviours: `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/`
- Original spec (when this doc and that disagree, **this doc wins** — PLAN was authored before implementation drift): PLAN.md §1-13
