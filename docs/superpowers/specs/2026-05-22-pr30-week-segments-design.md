# PR #30 — 4-segment weekly structure + 3 new scene types

> **Author:** brainstormed with David, 2026-05-22.
> **Sibling:** picks up after PRs #21–#28 (shop, Atlas, sea/dino/solar packs, coin economy).
> **Status:** spec ready for implementation plan.

## Why

Each week today compiles into a thin, linear sequence: `N flashcards → 1 audio_pick → 1 visual_pick → 1 image_pick → 1 word_match → boss` (≈ 14 levels for a 10-char week). The quiz block has only **one rep of each game type**, which makes the week feel like "ten flashcards plus a four-item appendix" instead of distinct practice stages. David also wants more practice variety beyond the existing 6 scene types, with explicit support for Yinuo's English-native bilingual profile.

This PR delivers:

1. A **named 4-段 (4-segment) structure** in every week — Flashcards, Sound & Pinyin, Sight & Match, Meaning & Sentence — visible to the kid as a small chip above each scene.
2. **Three new scene types**: `pinyin_pick`, `translate_pick` (bidirectional CN↔EN), `sentence_cloze`.
3. **Boss rotation widened** to include the new types.
4. A **one-off recompile script** to upgrade the 10 weeks of `pirate-class-level-1` in prod immediately on merge.

## Locked decisions (settled in brainstorm)

- **No schema changes.** All three new scene types reuse existing columns/tables (`characters.pinyinArray`, `characters.meaningEn`/`meaningZh`, `example_sentences` + `character_sentence`).
- **Total levels per 10-char week: ~17.** 10 flashcards + 6 mixed quizzes + 1 boss. Cap was chosen to stay under the ~20-level fatigue line for a 6-year-old while still feeling segmented.
- **`translate_pick` is bidirectional** — 50/50 random CN→EN vs EN→CN per level. Reinforces in both directions.
- **Recompile prod weeks 1–10** via `scripts/recompile-all-weeks.ts` (idempotent, follows `scripts/recompile-pirate-class.ts` pattern from PR #19).
- **Segment label UI is a single bilingual chip** above each scene. No IslandMap re-skin, no per-segment scoreboard. Cheap.
- **Sentence cloze falls back gracefully** — if a character has no `example_sentence`, swap it for a translate_pick at compile time. Never crash the week.

## Scope

### In scope

- New `scene_templates` rows: `pinyin_pick`, `translate_pick`, `sentence_cloze` (drizzle migration, append-only).
- Three new React scene components in `src/components/scenes/`.
- Three new Zod configs in `src/lib/scenes/configs.ts`.
- Extended `BossQuestionTypeSchema` to include the new types.
- Rewritten `compileWeekIntoLevels` that produces 4 segmented blocks and respects fallbacks.
- New `segment` field on `week_levels.sceneConfig` — strictly UI metadata (`'review' | 'sound' | 'sight' | 'meaning' | 'boss'`); not a schema column, just a config key.
- `SceneRunner` reads `segment` from config and renders a bilingual segment chip.
- `scripts/recompile-all-weeks.ts` (one-off, idempotent, `loadEnv()` + dynamic db import).
- Unit tests for: each new scene, compile-week segment math + fallback, translate direction split, boss rotation.

### Out of scope (explicit deferrals)

- Any AI prompt/scene-generation changes. New scenes are derived from existing character data at compile time.
- New image generation for `image_pick` (still requires `imageHook`).
- Sentence regeneration / fix-ups for characters with poor `example_sentences`.
- Per-segment coin rewards / progress bars / segment intermissions. (Could be a follow-up — see "Open follow-ups".)
- Boss config migration for previously-compiled boss rows. New boss rotation only takes effect on recompile.
- Shop content (sound themes, powerups, pet, decor, trophies) — still queued in original roadmap.

## Week structure (target)

Target total levels per 10-char week: **17** (10 flashcards + 6 quizzes + 1 boss) — matches the "15-18 levels" envelope agreed in brainstorm.

For a week with `N` characters:

| Segment | Slug (config) | Content | Levels |
|---|---|---|---|
| 1. 汉字回顾 / Character Review | `review` | `N` flashcards | `N` |
| 2. 听 & 拼 / Sound & Pinyin | `sound` | 1× audio_pick + 1× pinyin_pick | 2 |
| 3. 看 & 配 / Sight & Match | `sight` | 1× (image_pick if any imageHook, else extra visual_pick) + 1× word_match | 2 |
| 4. 译 & 句 / Meaning & Sentence | `meaning` | 1× translate_pick + 1× sentence_cloze | 2 (with cloze→translate fallback if no example_sentence) |
| Boss | `boss` | 10 rotating Qs from 6 boss-able quiz types | 1 (if N ≥ 10) |

**Edge cases:**

- `N < 2`: skip all quiz segments + boss (only flashcards). Should never happen for published weeks but handle gracefully.
- `N < 10`: skip boss only.
- `N > 12`: flashcards stay 1-per-char; quiz segments stay at 2 levels each. Total grows linearly with `N`.

**Length range:** N=5 → 11 levels, N=10 → 17 levels, N=15 → 22 levels. Sweet spot N=8–10 lands at 15–17.

Caps are deliberately tight for the first iteration. If Yinuo flies through and asks for more, we can lift segment 2/3/4 caps to 2 each in a follow-up — the compiler will then produce 10 + 4 + 4 + 4 + 1 = 23 for N=10, which is at the upper bound of tolerable.

## New scene types — UX detail

### `pinyin_pick` (Segment 2)

- **Prompt:** large pinyin in a sign-painted card: `píng guǒ` (full pinyin from `pinyinArray.join(' ')`). Optional TTS button replays it.
- **Options:** 4 hanzi tiles. 1 correct, 3 distractors sampled from the same week's characters preferring "sound-confusable" (shares pinyin initial OR shares tone OR shares final). Falls back to random within-week if not enough confusable candidates exist.
- **Visual:** mirrors `AudioPickScene` layout. Wooden tile buttons.
- **Score:** 100 first-try / 50 retry, matches existing scenes.

### `translate_pick` (Segment 4)

Two directions, each level deterministically chooses based on `position % 2`:

- **CN → EN** (`position` even within the segment): big hanzi card center, "What does **苹** mean?" prompt. 4 English option buttons. Correct = `meaningEn`, distractors from week's other characters' `meaningEn`.
- **EN → CN** (`position` odd): English word ("apple") in prompt. 4 hanzi tiles below. Correct = the character, distractors from week.
- **Bilingual UI strings:** "请选择 / Pick" / "意思 / Meaning".
- **Score:** same as above.

### `sentence_cloze` (Segment 4)

- **Prompt:** TTS reads the full sentence aloud. On screen: sentence rendered with the target hanzi replaced by `___` (e.g., "我喜欢吃 ___ 果。"). English gloss optional under the blank (`I love eating ___ pples.`) if `example_sentences.translationEn` exists.
- **Options:** 4 hanzi tiles (correct + 3 same-week distractors).
- **Fallback path:** if `character_sentence` returns zero rows for the target character, the compile step swaps this level for an extra `translate_pick`. Validated at compile time, not runtime — no broken scenes ship.

## Segment chip UI

Inside `SceneRunner`:

```tsx
const segmentLabels = {
  review:  { zh: '汉字回顾',   en: 'Character Review' },
  sound:   { zh: '听 & 拼',     en: 'Sound & Pinyin' },
  sight:   { zh: '看 & 配',     en: 'Sight & Match' },
  meaning: { zh: '译 & 句',     en: 'Meaning & Sentence' },
  boss:    { zh: '海怪',        en: 'Kraken' },
};
```

Rendered as a small parchment-style chip above the scene area: `第 2 段 · 听 & 拼 · Stage 2 · Sound & Pinyin`. Respects `useReducedMotion()` (no entrance animation if set).

## Boss

`BossQuestionTypeSchema` extends from 3 → 6 (word_match deliberately excluded — it's a multi-character round, not a single-question form):

```ts
z.enum([
  'audio_pick',
  'visual_pick',
  'image_pick',
  'pinyin_pick',
  'translate_pick',
  'sentence_cloze',
]);
```

`compileWeekIntoLevels` seeds boss `questionTypes` with all 6 boss-able types. Boss component already routes by question type — adding 3 cases is a small change. Existing boss rows in DB keep their old narrow lists (backward-safe). After recompile, all current weeks pick up the wider rotation.

## Code map

**New files:**
- `src/components/scenes/PinyinPickScene.tsx`
- `src/components/scenes/TranslatePickScene.tsx`
- `src/components/scenes/SentenceClozeScene.tsx`
- `scripts/recompile-all-weeks.ts`
- `tests/unit/pinyin-pick-scene.test.tsx`
- `tests/unit/translate-pick-scene.test.tsx`
- `tests/unit/sentence-cloze-scene.test.tsx`
- `tests/unit/compile-week-segments.test.ts`

**Modified:**
- `src/lib/scenes/configs.ts` — add 3 new Zod schemas; extend `BossQuestionTypeSchema`; add `segment` key to all configs.
- `src/lib/scenes/compile-week.ts` — rewrite into segment-emitting compiler with caps + fallbacks.
- `src/lib/scenes/registry.ts` (or wherever scene type → component dispatcher lives) — register 3 new types.
- `src/components/scenes/SceneRunner.tsx` — read `segment` from current scene's config, render segment chip.
- `src/components/scenes/BossScene.tsx` — add case branches for 3 new question types.
- `src/lib/db/characters.ts` (or wherever `getCharactersWithDetailsForWeek` lives) — ensure returned shape includes `pinyinArray`, `meaningEn`, `sentences` (already does for sentences; verify pinyin/meaning).
- `drizzle/0006_*.sql` — append `scene_templates` rows for `pinyin_pick`, `translate_pick`, `sentence_cloze` (or do it via `scripts/recompile-all-weeks.ts` if templates seeding lives there — pick whichever matches existing patterns).
- `CLAUDE.md` — bump "last refreshed" + add new scene types to scene-count line.

## Recompile strategy

`scripts/recompile-all-weeks.ts`:

```ts
// loadEnv, dynamic import db, then:
const published = await db.select().from(weeks).where(eq(weeks.status, 'published'));
for (const w of published) {
  await compileWeekIntoLevels(w.id);
  console.log(`  recompiled ${w.id} (${w.weekNumber}): ${count} levels`);
}
```

Idempotent (compileWeekIntoLevels already deletes + reinserts in a transaction). Run once against prod after merge:

```bash
pnpm tsx scripts/recompile-all-weeks.ts
```

Confirm with David before running (shared DATABASE_URL landmine).

## Tests

- **Compile**: for a synthetic week with 10 chars (some with `imageHook`, all with sentences) — assert level count is in range, segment ordering is correct, each segment respects cap, fallback path triggers when a char has no example_sentences.
- **Pinyin pick scene**: renders pinyin prompt, 4 options, correct option triggers score 100, wrong triggers 50 + retry.
- **Translate pick scene**: 50/50 direction; CN→EN renders hanzi prompt + English options; EN→CN flipped. Distractor pool excludes correct answer.
- **Sentence cloze scene**: renders sentence with blank, audio plays on mount, correct option scores 100, fallback path covered.
- **Boss**: new question types route to the correct sub-renderer; mocking remains the same.
- **Mocks**: all external boundaries mocked per CLAUDE.md rule (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`).

## Verification

Before opening PR #30:

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
2. `pnpm dev` → `/play/<childId>/level/<weekId>` → step through a full week, verify each segment chip renders correctly and all 4 segments behave.
3. Manually trigger fallback by editing a character to have no `example_sentence` and confirm compile substitutes a translate_pick.
4. Trigger boss with new question types in rotation, verify each routes correctly.
5. Toggle `prefers-reduced-motion` — segment chip + scene transitions degrade.
6. Re-publish a week from admin and confirm new levels appear without 404 (no shared-pack landmine — recompile uses `compileWeekIntoLevels` directly with weekId).
7. After merge, run `scripts/recompile-all-weeks.ts` against prod, confirm Yinuo's island shows the new level count.

## Open follow-ups (not blocking PR #30)

- Per-segment coin reward bonus (e.g., +10 for clearing a full segment) — could ship in PR #31 alongside sound themes.
- IslandMap re-skin to show 4 sub-island groupings instead of one linear chain — visual upgrade, defer until Yinuo plays the chip version.
- AI-generated `example_sentences` quality pass — some seeded sentences are too long for cloze. Separate authoring task.
- Translate pick supporting word-level translations (use `words` table, not just `characters.meaningEn`). Could expand the cognitive challenge.

## Memory I'll write after PR #30 ships

- Update `CLAUDE.md` "Current state" with the segmented week structure + 7-scene-type count.
- Possibly a landmine entry if the segment-chip rendering or scene-template seeding bites.
