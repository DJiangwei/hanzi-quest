# 汉字探险 (hanzi-quest) — Implementation Plan

> Repo: `git@github.com:DJiangwei/hanzi-quest.git` (public)
> Owner: David Jiang (`@DJiangwei`)
> First learner: 6 yo daughter, growing up in UK, currently attending weekend 汉字班

---

## 1. Context

### Problem
A 6-year-old Chinese-heritage girl in the UK attends a weekend 汉字班 where she learns 10 new characters per week. School provides minimal supplementary practice material. Parents want a fun, sustainable way to reinforce *her actual school curriculum* (not a generic Chinese learning app), while preserving long-term motivation for years of study ahead.

### Outcome
A web game where:
1. **Parent** logs in once a week and types in the 10 characters from school class.
2. **AI** (Claude via Vercel AI Gateway) auto-generates pinyin, 3 example words, 1 example sentence, and an image hook description per character.
3. **Parent** reviews and (optionally) edits the AI output, then "publishes" the week.
4. **Child** opens the app, sees a Mario-style overworld map, picks the new week's level, and plays through 10–12 micro-games (scenes) covering recognition (听音选字 / 看字选音 / 看图选字 / 字词配对) plus writing (描红).
5. **Boss battle** at end of week → child earns coins + free gacha pull.
6. **Coins** unlock avatar items, free gacha pulls drop themed collectibles (V1 = 12 生肖).

### Strategic shape
- **Architected as a Platform** (multi-family, multi-child, content-pack-aware, scene-registry extensible).
- **Shipped as Personal V1** (one family, one collection theme, 5 scene types + writing + boss).
- All forward-looking subsystems exist as DB tables / interfaces from day 1 even when surfaced minimally in V1 (avoids painful rewrites later).

### Non-goals (V1)
- 自适应难度 / SRS algorithm (V2)
- OCR 拍字表 (V2)
- 离线 PWA (V2)
- 节日/朝代/恐龙等更多 collection packs (V1.5+)
- 独立 mini-games（成语故事 / 拼音 match）— infra ready, content not in V1
- 家庭邀请、朋友 PK、教师后台 (V2+)

---

## 2. System Architecture

### Stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 16 App Router + TypeScript | Single Next.js app, no monorepo |
| Styling | Tailwind v4 + shadcn/ui | Parent dashboard uses shadcn; child game UI uses bespoke styled components |
| Animations | Framer Motion + Lottie | Map nodes, scene transitions, reward pop-ups, character animations |
| Hanzi rendering | `hanzi-writer` (npm) + MakeMeAHanzi data (CC0) | Stroke order animations + tracing input |
| Hosting | Vercel (Fluid Compute) | All routes via Vercel Functions; Node 24 default |
| Database | PostgreSQL via **Neon** (Vercel Marketplace) | Auto-provisions `DATABASE_URL` |
| ORM / migrations | Drizzle + drizzle-kit | Schema in TS, migrations in repo |
| Auth | **Clerk** (Vercel Marketplace) | Parent users via Clerk; child profiles are app-managed sub-entities under a parent |
| AI generation | **Vercel AI SDK** + **Vercel AI Gateway** + Claude (`anthropic/claude-sonnet-4-6` for content gen, `anthropic/claude-haiku-4-5` for cheaper validations) | No direct `@ai-sdk/anthropic`; use Gateway provider strings |
| TTS | V1: Web Speech API (browser, free) · V2: Azure Speech (zh-CN-XiaoxiaoNeural) cached to Blob | Cost-controlled |
| Images | V1: SVG/Lottie + curated emoji + `/public/illustrations/*` · V2: AI image gen + Blob | Avoid cost spike up front |
| File storage | Vercel Blob | Audio cache, AI-generated assets, user uploads (later) |
| i18n | `next-intl` | en + zh-CN locales from day 1 |
| Validation | Zod | DB input, AI output, API contracts |
| State (client) | React Server Components + Server Actions; Zustand for client-only game state (current scene, in-flight session) | No Redux |
| Testing | Vitest (unit) + Playwright (E2E) | CI required for green merge |
| Observability | Vercel Analytics + AI Gateway built-in | OTel later if needed |

### Top-level data flow

```
Parent ──► /parent/week/new (server action: createWeek)
              │
              ▼
        weeks (status=draft) ──► enqueue AI generation job
                                       │
                                       ▼
                          Vercel AI SDK → AI Gateway → Claude
                                       │
                                       ▼
              characters / words / example_sentences (status=ai_generated)
                                       │
                                       ▼
Parent ──► /parent/week/:id/review ──► edit + approve (server action: publishWeek)
                                       │
                                       ▼
              week_levels (compiled scene sequence)
                                       │
                                       ▼
Child ──► /map ──► /level/:weekId ──► sceneRunner
              │                          │
              │                          ▼
              │                  scene_attempts + coin_transactions
              │
              ▼
          Boss complete → free gacha pull → child_collections
```

### Trust boundaries
- **Parent role** (Clerk metadata): can create/edit weeks, see all child progress, edit AI output.
- **Child role**: plays game, can equip avatar / open shop, *cannot* see/edit curriculum or other children.
- Server actions check `auth.userId` + role on every mutation. Drizzle queries always filter by `parent_user_id`.
- Multi-tenancy via `parent_user_id` foreign key on all family-scoped tables. No cross-family data leak.

---

## 3. Module Boundaries

```
src/
├─ app/
│  ├─ (marketing)/                    # Landing, not in V1
│  ├─ (auth)/sign-in, sign-up         # Clerk-mounted
│  ├─ (parent)/
│  │   ├─ layout.tsx                  # Parent shell, role gate
│  │   ├─ page.tsx                    # Dashboard overview
│  │   ├─ week/new/page.tsx
│  │   ├─ week/[id]/review/page.tsx
│  │   ├─ week/[id]/preview/page.tsx
│  │   ├─ progress/[childId]/page.tsx
│  │   └─ children/page.tsx           # Add/edit child profiles
│  ├─ (child)/
│  │   ├─ layout.tsx                  # Child shell, locked-down
│  │   ├─ map/page.tsx                # Mario-style overworld
│  │   ├─ level/[weekId]/page.tsx     # Scene runner host
│  │   ├─ shop/page.tsx
│  │   ├─ collection/page.tsx
│  │   └─ avatar/page.tsx
│  ├─ api/
│  │   ├─ ai/generate-week/route.ts   # POST: kick off AI gen for a week
│  │   └─ tts/[char]/route.ts         # GET: stream/redirect cached TTS audio (V2)
│  └─ layout.tsx
│
├─ db/
│  ├─ index.ts                        # Drizzle client
│  └─ schema/
│      ├─ auth.ts                     # users, child_profiles
│      ├─ content.ts                  # characters, words, sentences, weeks
│      ├─ game.ts                     # scene_templates, week_levels, sessions, attempts
│      ├─ economy.ts                  # coins, txns, shop_items, gacha_pulls
│      ├─ collections.ts              # collection_packs, collectible_items, child_collections
│      ├─ avatar.ts                   # avatar_items, child_avatar, child_inventory
│      └─ system.ts                   # ai_jobs, audit_log
│
├─ lib/
│  ├─ auth/                           # Clerk helpers, role guards
│  ├─ ai/
│  │   ├─ generate-content.ts         # Main AI gen pipeline
│  │   ├─ prompts/                    # Versioned prompt templates
│  │   └─ schemas.ts                  # Zod schemas for AI output
│  ├─ scenes/
│  │   ├─ registry.ts                 # sceneRegistry { type → Component, configSchema }
│  │   ├─ types.ts                    # SceneConfig, SceneResult, SceneProps
│  │   └─ compile-week.ts             # weeks + characters → week_levels (scene instances)
│  ├─ economy/
│  │   ├─ coins.ts                    # award/spend/balance helpers
│  │   ├─ gacha.ts                    # roll algorithm
│  │   └─ shop.ts                     # purchase logic
│  ├─ hanzi/
│  │   ├─ data.ts                     # MakeMeAHanzi loader
│  │   └─ pinyin.ts                   # Helpers for tone mark normalization
│  ├─ tts/
│  │   └─ web-speech.ts               # V1 TTS wrapper
│  └─ db/                             # Repository functions per entity
│
├─ components/
│  ├─ ui/                             # shadcn primitives
│  ├─ parent/                         # Dashboard widgets
│  ├─ map/                            # Map renderer, level node, paths
│  ├─ scenes/                         # One file per scene type (FlashcardScene, etc.)
│  ├─ economy/                        # CoinBadge, ShopGrid, GachaModal
│  └─ avatar/                         # AvatarCanvas, ItemPicker
│
├─ i18n/
│  ├─ messages/en.json
│  └─ messages/zh-CN.json
│
└─ tests/
   ├─ unit/                           # Vitest
   └─ e2e/                            # Playwright
```

### Module contracts (the bits that matter)

**`lib/scenes/registry.ts`** — extensibility heart
```ts
export type SceneType =
  | 'flashcard' | 'audio_pick' | 'visual_pick'
  | 'image_pick' | 'word_match' | 'tracing' | 'boss';

export interface SceneProps<C> {
  config: C;
  onComplete: (result: SceneResult) => void;
}

export interface SceneRegistration<C> {
  type: SceneType;
  configSchema: z.ZodType<C>;
  Component: React.ComponentType<SceneProps<C>>;
  defaultBuilder: (chars: Character[]) => C;  // Used when compiling a week
}

export const sceneRegistry: Record<SceneType, SceneRegistration<unknown>>;
```
**Adding a new scene type = one file in `components/scenes/` + one register call. No edits anywhere else.**

This same `Scene` abstraction also powers future independent mini-games (成语故事, 拼音 match) — they will be rendered from a "Game Room" entry instead of a week level, but reuse the same component contract, same `scene_attempts` ledger, same coin/reward pipeline. **No second framework needed.**

**`lib/ai/generate-content.ts`** — content pipeline
```ts
generateWeekContent({
  weekId, characters: string[], targetLocale: 'zh-CN' | 'zh-TW',
}): Promise<{
  perCharacter: Array<{
    hanzi: string;
    pinyin: string[];           // tone-marked
    meaning_en: string; meaning_zh: string;
    words: Array<{ word: string; pinyin: string[]; meaning_en: string; }>;  // 3 each
    sentence: { text: string; pinyin: string[]; meaning_en: string; };       // 1 each
    image_hook: string;          // short prompt-able description, e.g. "kid hugging the sun"
  }>;
}>
```
Single call to AI Gateway with structured output (Zod schema). Model: `anthropic/claude-sonnet-4-6`. Temperature 0.4.

---

## 4. Database Schema (Drizzle / Postgres)

All tables include `created_at timestamptz default now()` and `updated_at` where edits matter. `id` is `uuid` (default `gen_random_uuid()`) unless noted. Foreign keys are `on delete cascade` for owned data, `restrict` for shared content.

### auth.ts
- **`users`** — mirror of Clerk user (synced via webhook): `id (clerk_id PK)`, `email`, `display_name`, `role enum('parent','admin')`, `locale`, timestamps
- **`child_profiles`** — `id`, `parent_user_id FK→users.id`, `display_name`, `avatar_config jsonb`, `birth_year`, `current_curriculum_pack_id FK?→curriculum_packs`, timestamps

### content.ts
- **`characters`** — `id`, `hanzi` (unique with `script`), `script enum('simplified','traditional')`, `pinyin_array text[]`, `meaning_en`, `meaning_zh`, `stroke_count int`, `frequency_rank int?`, `image_url?`, `audio_url?`, `source enum('curated','school','ai_generated')`, `created_by_user_id FK?`, timestamps
  *(Globally shared — same 字 reused across families. Deduped on `(hanzi, script)`.)*
- **`words`** — `id`, `text`, `script`, `pinyin_array`, `meaning_en`, `audio_url?`
- **`character_word`** — `character_id`, `word_id`, `position smallint` (PK composite)
- **`example_sentences`** — `id`, `text`, `pinyin_array`, `meaning_en`, `audio_url?`
- **`character_sentence`** — `character_id`, `sentence_id` (PK composite)
- **`curriculum_packs`** — `id`, `slug` (e.g., `school-custom`, `bubian-y1-up`, `hsk1`), `name`, `description`, `is_public boolean`, `owner_user_id FK?`
  *(V1 ships with one auto-created pack per family: `school-custom`. Future: ingest 部编版 etc.)*
- **`weeks`** — `id`, `parent_user_id FK→users.id`, `child_id FK→child_profiles.id`, `curriculum_pack_id FK→curriculum_packs.id`, `week_number int`, `label text` (e.g., "Week 14 — 春天"), `status enum('draft','ai_generating','awaiting_review','published','archived')`, `notes`, `published_at?`, timestamps
- **`week_characters`** — `week_id`, `character_id`, `position smallint`, `parent_notes?` (PK composite)

### game.ts
- **`scene_templates`** — `id`, `type` (enum from registry), `version smallint`, `default_config jsonb`, `is_active boolean`
  *(Static seed. Lets us version configs over time.)*
- **`week_levels`** — `id`, `week_id`, `position smallint`, `scene_template_id`, `scene_config jsonb`, `unlocked_after_position smallint?`
  *(Compiled during `publishWeek`. The actual playable scene instances.)*
- **`play_sessions`** — `id`, `child_id`, `started_at`, `ended_at?`, `device`, `session_summary jsonb` (counts, coin total)
- **`scene_attempts`** — `id`, `session_id`, `week_level_id`, `started_at`, `completed_at?`, `correct_count int`, `total_count int`, `hints_used int`, `score int`, `coins_awarded int`
- **`week_progress`** — `child_id`, `week_id`, `completion_percent`, `boss_cleared boolean`, `last_played_at`, `total_time_seconds int` (PK composite)
- **`streaks`** — `child_id PK`, `current_streak int`, `longest_streak int`, `last_played_date`, `freeze_tokens int`

### economy.ts
- **`coin_balances`** — `child_id PK`, `balance int`, `lifetime_earned int`
- **`coin_transactions`** — `id`, `child_id`, `delta int`, `reason enum(...)`, `ref_type?`, `ref_id?`, `created_at`
- **`shop_items`** — `id`, `slug`, `kind enum('avatar','powerup','consumable','pack_voucher')`, `name`, `description`, `image_url`, `price_coins int`, `available_from?`, `available_to?`, `metadata jsonb`
- **`shop_purchases`** — `id`, `child_id`, `shop_item_id`, `coins_spent`, `created_at`
- **`gacha_pulls`** — `id`, `child_id`, `pack_id`, `cost_coins`, `is_free boolean`, `result_item_id`, `was_duplicate boolean`, `created_at`

### collections.ts
- **`collection_packs`** — `id`, `slug` (e.g., `zodiac`, `festivals`), `name`, `description`, `theme_color`, `is_active`, `available_from?`, `available_to?`
- **`collectible_items`** — `id`, `pack_id`, `slug`, `name_zh`, `name_en`, `lore_zh`, `lore_en`, `rarity enum('common','rare','epic')`, `drop_weight int`, `image_url`
- **`child_collections`** — `child_id`, `item_id`, `count int`, `first_obtained_at` (PK composite)
- **`shard_balances`** — `child_id`, `pack_id`, `shards int` (PK composite) *(卡屑 per-pack.)*

### avatar.ts
- **`avatar_slots`** — `id` (e.g., `head`, `hat`, `top`, `background`), `display_order`
- **`avatar_items`** — `id`, `slot_id`, `name`, `image_url`, `unlock_via enum('default','shop','collection','achievement')`, `unlock_ref?`
- **`child_avatar_inventory`** — `child_id`, `avatar_item_id`, `obtained_at` (PK composite)
- **`child_avatar_equipped`** — `child_id`, `slot_id`, `avatar_item_id?` (PK composite)
- **`powerup_inventory`** — `child_id`, `powerup_kind enum('revive','hint','streak_freeze')`, `count int` (PK composite)

### system.ts
- **`ai_jobs`** — `id`, `kind enum('generate_week','regenerate_char',...)`, `input jsonb`, `output jsonb?`, `status enum('queued','running','succeeded','failed')`, `model`, `tokens_in?`, `tokens_out?`, `cost_usd?`, `error?`, timestamps
- **`audit_log`** — `id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `diff jsonb`, `created_at`

---

## 5. AI Content Generation Pipeline

### Single end-to-end call
1. Parent submits 10 chars on `/parent/week/new`. Server action creates a `weeks` row (status `ai_generating`) and an `ai_jobs` row.
2. Server action triggers `generateWeekContent()` *inline* (Fluid Compute can hold a 30-90s response easily — under 300s default timeout). For V1 we keep it synchronous so the parent sees results immediately on review page navigation.
3. `generateWeekContent`:
   - Builds a single prompt embedding all 10 chars + child age (6) + locale.
   - Calls Vercel AI SDK `generateObject` with Zod schema → AI Gateway → `anthropic/claude-sonnet-4-6`.
   - Validates output (Zod). Persists characters + words + sentences + relationships.
   - For each char, ensures `image_url` falls back to `/public/illustrations/placeholder.svg`. (No image gen V1.)
4. Marks week `awaiting_review`. Parent navigates to review page.

### Prompt strategy
- Single system prompt (versioned in `lib/ai/prompts/generate-week-v1.ts`).
- Output spec: structured JSON matching `WeekContentSchema` (Zod).
- Example shots: 2 sample inputs/outputs in the prompt for stability.
- Hard constraints: pinyin uses tone marks (not numbers); meanings stay age-appropriate (no abstract words); example sentences ≤ 8 chars; avoids characters not in the input set unless very common (≤ HSK 1).

### Cost / rate limiting
- 10 chars per call, ~2k input tokens / ~2k output tokens, ~$0.05/week with Sonnet. Negligible.
- Per-parent rate limit: 10 generations/day (anti-abuse). V2 only; V1 just relies on Clerk session + token cost cap dashboard.

### Regenerate single character
- "Regenerate" button on review page → calls `generateCharacterContent({ char, context })` → only that char's words/sentence change.

---

## 6. Game Loops (V1 specifics)

### Weekly map progression
- Map = SVG-driven overworld. Each "island" represents a week. Path between islands draws progressively as weeks complete.
- A week node has 3 states: locked (gray), available (animated pulse), completed (gold star).
- Tapping an available node opens a "level prep" modal: shows the 10 characters, "继续/Start" CTA.

### Scene runner
- A "level" is the ordered list of `week_levels` rows for the week (10–12 scenes incl. boss).
- Player progresses linearly. Quitting saves `play_sessions.session_summary`.
- Boss is the *last* `week_level` of the week and unlocks only after all preceding scenes have at least one passing attempt.
- Default compiler produces ≈ 13 scenes for 10 chars (calibrated after first weeks of real play).

### Reward formulas
- scene completion: `+50` coins (first time), `+5` (replay)
- 100% correct in scene: `+25` bonus
- week boss cleared: `+300` + 1 free gacha pull
- daily streak: `+20` per day continuous
- streak freeze: 1 token/week auto-granted; consumed silently if a day is missed

### Gacha drop table
- Active pack = `zodiac` (V1). 12 items: 4 common, 5 rare, 3 epic. (Adjust by drop_weight.)
- Free pull weight: same as paid.
- Duplicate handling: +30 shards (kind=zodiac). 100 shards → 1 free pull voucher (atomic in `redeemShards()`).

---

## 7. Parent Dashboard (V1)

| Route | Function |
|---|---|
| `/parent` | Active week status, child progress card, "Add new week" CTA |
| `/parent/children` | List/edit child profiles (display name, avatar, age) |
| `/parent/week/new` | Form: 10 char inputs (or paste-split), child selector, week label |
| `/parent/week/[id]/review` | Per-character cards: pinyin (editable), 3 words (editable, `regenerate`), sentence (editable, `regenerate`), image hook (just text V1). "Publish" button |
| `/parent/week/[id]/preview` | Read-only walk-through of compiled scene sequence (so parent can spot weirdness before child sees it) |
| `/parent/progress/[childId]` | Per-week breakdown: scenes done / accuracy / time, total coins lifetime, current streak |

---

## 8. Future Extensibility Points (architected day-1, surfaced later)

| Vector | Mechanism | V1 surface |
|---|---|---|
| New scene types | `sceneRegistry` + `scene_templates` row | 5 of 7 active |
| New collection themes | Insert `collection_packs` + `collectible_items` | 1 active (zodiac) |
| Standard curriculum imports (部编/HSK) | Seed `curriculum_packs` + `characters` + `weeks` JSON | School-custom only |
| Multi-family / SaaS | All family data scoped by `parent_user_id`. Clerk billing later. | Single family active |
| Multi-child | `child_profiles` already first-class. Switcher in parent shell. | One child default, more allowed |
| Adaptive SRS | New `srs_state` table + alt scene compiler | Linear V1 |
| Parent invites / co-parent | New `family_members` table + Clerk org migration | Single user V1 |
| Independent mini-games | "Game Room" entry → reuses `sceneRegistry` with non-week-bound configs | Hidden V1 |
| Better TTS | Swap `lib/tts/*` impl, cache to Blob | Web Speech API V1 |
| Image gen for image_pick scene | Background AI image job → Blob | Curated emoji V1 |
| OCR 字表 input | New endpoint, vision model in same Gateway | Manual entry V1 |
| Mobile native | Capacitor wrap of same Next.js app | Web only V1 |

---

## 9. Implementation Roadmap

> **Pacing assumption**: 1 primary developer + 1 collaborator working part-time. ~10–12 weeks to full V1. Early phases unlock daughter playing *something* in 3–4 weeks.

### Phase 0 — Bootstrap (Days 1–3) 🔧
- [ ] Create `github.com/DJiangwei/hanzi-quest` (public)
- [ ] Add collaborator
- [ ] Scaffold Next.js 16 App Router + TS + Tailwind v4
- [ ] Add `vercel.ts` (frameworks: nextjs)
- [ ] `vercel link` → connect to Vercel project
- [ ] Provision Neon via `vercel marketplace` → `DATABASE_URL` auto-set
- [ ] Provision Clerk via `vercel marketplace` → keys auto-set
- [ ] Add Drizzle + initial empty schema, `drizzle.config.ts`, migration scripts
- [ ] Add `next-intl` + `messages/en.json` + `messages/zh-CN.json` skeletons
- [ ] CI workflow (`.github/workflows/ci.yml`): typecheck, lint, vitest, drizzle migration check, playwright smoke
- [ ] Branch protection on `main`
- [ ] Vercel preview URLs working
- [ ] First deploy: blank "Hello 汉字探险" page on prod

**Verify:** PR from feature branch → CI green → preview URL loads → merge → main deploy succeeds.

### Phase 1 — Auth + child profiles + DB schema (Days 4–8)
- [ ] Implement full schema in `db/schema/*.ts`
- [ ] Generate + apply first migration
- [ ] Clerk webhook → mirror `users` row on signup
- [ ] `/parent/children` UI: create + edit child profile (name, avatar placeholder)
- [ ] Role gate (`assertParent()`, `requireChild()`) middleware/server-action helpers
- [ ] Seed scene_templates (7 types, even though only 5 active in V1)
- [ ] Seed default `curriculum_packs` (school-custom auto-created per family on signup)

**Verify:** Sign up → see empty parent dashboard → add daughter → row in DB.

### Phase 2 — Parent week input + AI generation (Days 9–18)
- [ ] `/parent/week/new` form (10 char inputs, paste-split helper)
- [ ] `lib/ai/generate-content.ts` with Zod-typed `generateObject` call
- [ ] Persist `characters` (deduped) + `words` + `example_sentences` + `weeks` row
- [ ] `/parent/week/[id]/review` UI: editable cards, regenerate per-char button
- [ ] Publish action → compile `week_levels` rows
- [ ] `/parent/week/[id]/preview` walk-through

**Verify:** Input 10 chars → 30s wait → review screen shows AI output → edit one pinyin → publish → DB shows compiled week_levels.

### Phase 3 — Map + scene engine + 5 base scenes (Days 19–35)
- [ ] Build `<WorldMap>` (SVG-based, framer-motion path animations, level nodes, locked/available/completed states)
- [ ] `<SceneRunner>` host: drives sequence, persists `play_sessions` + `scene_attempts`
- [ ] Implement 5 scene components:
  - `<FlashcardScene>` (字 + pinyin reveal + TTS + meaning hook)
  - `<AudioPickScene>` (听音 → 4-choice 字)
  - `<VisualPickScene>` (看字 → 4-choice pinyin)
  - `<ImagePickScene>` (看图 emoji/SVG → 4-choice 字)
  - `<WordMatchScene>` (drag-drop pairing)
- [ ] Pinyin policy: hidden by default, tap to reveal
- [ ] Coin awards on completion
- [ ] Map ↔ level navigation

**Verify:** Child profile → map → first level → 5 scenes → completion screen → coin balance updated. Daughter plays a real week. **First user-facing milestone — get her trying it.**

### Phase 4 — Writing scene + Boss (Days 36–48)
- [ ] Integrate `hanzi-writer` library
- [ ] `<TracingScene>`: stroke-by-stroke trace with grade-out animation (allow 80% stroke fidelity)
- [ ] `<BossScene>`: 10-question gauntlet, 3 lives, revive item integration, dramatic UI
- [ ] Boss completion → free gacha modal trigger

**Verify:** Daughter writes 大 / 小 / 山 with stroke order shown; clears boss with one mistake.

### Phase 5 — Economy + shop + gacha + zodiac collection (Days 49–60)
- [ ] Coin transactions ledger + helpers
- [ ] `/shop` 4 tabs (avatar / collection / powerups / specials)
- [ ] Avatar slot system + ~20 V1 unlockables (curated SVG art — could commission designer or AI-gen)
- [ ] Gacha pull modal with reveal animation (Lottie + sound)
- [ ] 12 zodiac items seeded (`scripts/seed-zodiac.ts`) — needs art assets
- [ ] Shard system (duplicate → shards, redeem → free pulls)
- [ ] Powerups: revive token (300), hint token (100), streak freeze (auto)

**Verify:** Boss → free pull → 兔 dropped → check `child_collections` + `child_avatar_inventory`. Buy hat with 200 coins.

### Phase 6 — Streaks + parent progress + polish (Days 61–70)
- [ ] Streak tracking (calendar view)
- [ ] `/parent/progress/[childId]`: charts (recharts), per-week breakdown
- [ ] Sound effects pass (correct/wrong/coin/level-up)
- [ ] Loading states, error states everywhere
- [ ] Accessibility pass (kbd nav, screen reader, contrast)
- [ ] i18n audit (no English bleeding into Chinese learning content)

### Phase 7 — Real-world beta with daughter (Days 71–84+)
- [ ] Use weekly: parent inputs school chars → daughter plays → observe
- [ ] Bug bash on real device (probably iPad in browser)
- [ ] Iterate scene difficulty / coin balance / hint frequency
- [ ] Gather adult-perceived friction points (UX, parent dashboard speed)

### Post-V1 candidates (prioritized)
1. **节日 collection pack** (春节 / 中秋 etc.) — highest cultural value
2. **Adaptive scene mix** based on per-character mastery
3. **OCR week input** (vision model upload of school 字表 photo)
4. **Azure TTS with native zh-CN voice** (Web Speech is iffy on iPad Safari)
5. **Independent mini-games** in "游戏室" (拼音 match, 成语 micro)
6. **Family invite + co-parent** (Clerk org)
7. **Public read-only progress link** for grandparents

---

## 10. Critical Files (when execution begins)

These are the files that will be touched first or are foundational. Most don't exist yet (greenfield).

| Path | Why critical |
|---|---|
| `vercel.ts` | Project config, framework declaration |
| `package.json` | Dependencies (single source) |
| `drizzle.config.ts` | Migration toolchain |
| `src/db/schema/*.ts` | Defines entire data model — edit carefully, migrations follow |
| `src/lib/scenes/registry.ts` | Extension point — design once, follow forever |
| `src/lib/ai/generate-content.ts` + `prompts/generate-week-v1.ts` | Quality of all generated content depends on this |
| `src/lib/scenes/compile-week.ts` | Translates AI output into playable level — bug here = bad UX everywhere |
| `src/lib/auth/guards.ts` | Trust boundary — security sensitivity |
| `src/components/map/WorldMap.tsx` | Most visible piece — highest design effort |
| `src/i18n/messages/{en,zh-CN}.json` | Add keys here every time UI text is added |
| `.github/workflows/ci.yml` | Without CI, branch protection fails |
| `scripts/seed-zodiac.ts` | One-time data load for V1 launch |

### External libraries to be reused (not reinvented)

- `@clerk/nextjs` — auth (no custom sign-in)
- `drizzle-orm` + `drizzle-kit` — schema/migrations
- `ai` (Vercel AI SDK) — content gen via Gateway
- `next-intl` — i18n
- `framer-motion` — animations
- `lottie-react` — for designer-supplied animations
- `hanzi-writer` — stroke order + tracing
- `@radix-ui/*` (via shadcn) — accessible primitives
- `zod` — validation
- `zustand` — client-only game state

---

## 11. Verification (end-to-end)

Once Phase 6 ships, this is the smoke test that proves the platform works:

1. Sign up as new parent → confirm Clerk session, `users` + `child_profiles` (1 row) + `school-custom` curriculum_pack created.
2. Add daughter (display name `Yinuo`, age 6).
3. `/parent/week/new` → enter 10 chars (e.g., `大 小 山 水 火 土 木 金 田 月`).
4. Wait ≤ 60s. Land on `/parent/week/[id]/review`. Confirm all 10 chars have pinyin/3 words/1 sentence.
5. Edit one word manually. Click `regenerate` on another character. Confirm both edits persist.
6. Click "Publish". Confirm `week_levels` populated with 13 scene rows (10 flashcards + 1 audio_pick + 1 word_match + 1 boss).
7. Switch to child profile (Yinuo). Land on `/map`. Confirm Week 1 node animated/available.
8. Tap node → run through 5 base scenes. Verify coin balance increments. Verify pinyin hidden by default + reveals on tap.
9. Reach tracing scene. Confirm `hanzi-writer` shows correct stroke order for 大. Trace it with mouse/touch — accept/grade.
10. Reach boss. Make 2 mistakes intentionally. Use revive item from inventory. Continue. Clear boss.
11. Free gacha modal opens. Reveal animation plays. New zodiac card added to `child_collections`.
12. Open `/shop` → confirm 4 tabs visible. Buy a hat (subtract coins).
13. Open `/avatar` → equip hat. Confirm `child_avatar_equipped` updated.
14. Switch to parent profile → `/parent/progress/[childId]` → confirm Week 1 stats visible.
15. CI: full test suite green (vitest unit tests, Playwright e2e for the above flow).

### Tests to write proactively
- **Unit (Vitest)**:
  - `lib/economy/coins.ts` — award/spend race conditions
  - `lib/economy/gacha.ts` — drop weight respected over 10000 trials
  - `lib/scenes/compile-week.ts` — given 10 chars, produces N scenes in correct order
  - `lib/ai/generate-content.ts` — Zod schema rejects malformed AI responses
- **E2E (Playwright)**:
  - Full "parent inputs week → child plays one scene" flow
  - Sign-up + child creation
  - Boss flow with revive

---

## 12. Open questions (to resolve in early execution, not blocking)

1. **Avatar art source.** V1 needs ~20 avatar items + 12 zodiac cards. Options: commission cheap illustration set, use AI-generated art (Midjourney-style with consistent style guide), open-source illustration packs. Pick during Phase 5.
2. **Sound assets.** Coin pickup, correct, wrong, level-up. Royalty-free pack from freesound or Soundsnap. Pick during Phase 6.
3. **Web Speech API quality on iPad Safari.** Test early — if zh-CN voice on Safari is bad, accelerate Azure TTS to Phase 5.
4. **Image hook → actual visual.** Phase 3 ImagePickScene needs *something* visual per character. V1 fallback: a curated emoji + colored backdrop. Acceptable for "看图选字" because the emoji disambiguates the character. Revisit in V2 with consistent illustrated set.
5. **Daughter's age progression.** This V1 is calibrated to 6 yo. As she grows, scene difficulty curve / new scene types (e.g., 成语 / 阅读理解) should be added — track in roadmap.

---

## 13. After plan approval — first concrete actions

1. Create the GitHub repo (or confirm if I should via `gh` CLI on your behalf during execution).
2. Phase 0 bootstrap (1-2 days) — gets us to a deployed empty Next.js on Vercel.
3. Phase 1 schema + auth — first PR a collaborator can review.
4. Then weekly check-ins / iteration as you and your daughter test phases.

---

## Appendix A: Brainstorming decisions log

These are the key decisions reached during the planning conversation, recorded so future agent sessions don't re-litigate them.

| Decision | Rationale |
|---|---|
| Architect Platform-grade, ship Personal V1 | Avoids future rewrite; doesn't over-engineer V1 |
| Map = level select, level = structured learning UI (not platforming) | Simpler stack (no Phaser); React + Framer Motion suffices |
| Curriculum source = parent inputs school chars + AI augment | Real product fits user's actual need (her daughter has a school 汉字班) |
| Pinyin hidden by default, tappable to reveal | Avoid pinyin crutch; promotes 字形 recognition |
| Writing/笔顺 IS in V1 (via HanziWriter) | Daughter's school class teaches writing; reading-first but writing complements |
| English UI chrome + Chinese learning content + Chinese parent dashboard | UK schooling makes English UI more natural for daughter |
| Session length default = 10–15 min (3–4 scenes) | 6yo attention span sweet spot |
| Boss battle weekly + 12 zodiac collection in V1 | Engagement loop required for sustained motivation |
| Single Next.js app, not monorepo | Right-sized for V1, can split later |
| Clerk + Neon + Drizzle + Vercel AI Gateway | Vercel-ecosystem-aligned, all Marketplace-provisionable |
| `sceneRegistry` is the extensibility heart | Single abstraction handles main-line + future independent mini-games |
| 12 zodiac is V1 collection; festivals/dynasties/dinosaurs are V1.5+ | Scope discipline |
