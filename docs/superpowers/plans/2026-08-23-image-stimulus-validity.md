# 看图找字 Stimulus Validity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop 看图找字 from ever showing a picture that cannot identify its answer — and give number characters a picture that is exactly right instead of merely excluding them.

**Architecture:** Stimulus validity becomes a computed property enforced at compile time. `image_pick` starts compiling its chosen `wordId` into `scene_config` (as `image_word` already does), so the choice is frozen and auditable instead of resolved as "the first word with a URL" at render. Number characters bypass diffusion art entirely and render a procedural balloon-counting SVG. A read-only verify script closes the loop for future authoring.

**Tech Stack:** TypeScript, Drizzle/Neon Postgres, Vitest + React Testing Library, procedural SVG.

**Spec:** `docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md`

## Global Constraints

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green before the PR opens. Run the FULL suite.
- Branch `fix/image-stimulus-validity`. **Never push to `main`.** **SSH for git push.**
- Tests mock all external boundaries. Any test importing a `@/lib/db/*` module needs `vi.mock('@/db', () => ({ db: {} }))` or it throws `DATABASE_URL is not set` **only on CI**.
- **No migration.** This changes `scene_config` *content*, which is jsonb — not the schema. If you find yourself writing DDL, stop.
- **Do not regenerate any art.** Zero Blob spend. The fix is selection and rendering.
- **The runtime-image landmine still holds:** `words.image_url` must keep resolving at render time so a future art backfill needs no recompile. You are freezing *which word*, never *where its picture lives*.
- **Stable level keys** (`practice:image_pick:<slot>`) must not change — they preserve `scene_attempts.week_level_id` across the required recompile.
- Every kid-facing label bilingual, ZH first.

## Facts established by investigation — use these, do not re-derive

- The curriculum teaches exactly one number per week, weeks 1–10: 一 二 三 四 五 六 七 八 九 十. All 30 of their words are count-dependent.
- Ten words map to two characters taught in the same week: 大人(人/大) · 二月(二/月) · 太阳(太/阳) · 月亮(亮/月) · 爸妈(妈/爸) · 火山(山/火) · 唱歌(唱/歌) · 多少(多/少) · 朋友(友/朋) · 小朋友(友/朋).
- **Excluding every bad stimulus costs zero characters their eligibility** — all 86 non-number characters retain ≥1 unambiguous word that already has an image.

---

### Task 1: The validity predicate (pure)

**Files:** Create `src/lib/scenes/stimulus-validity.ts`; test `tests/unit/stimulus-validity.test.ts`

**Produces:**

```ts
/** Characters whose meaning IS a quantity — diffusion cannot render an exact count. */
export const COUNTING_CHARS: ReadonlySet<string>;   // 一二三四五六七八九十
export function isCountingChar(hanzi: string): boolean;

export interface StimulusCandidate { wordId: string; text: string; imageUrl: string | null }

/**
 * Words that can serve as an image_pick stimulus for `hanzi` this week.
 * `wordOwners` maps word TEXT -> the hanzi taught in the same week that own it.
 */
export function validStimulusWords(
  hanzi: string,
  words: StimulusCandidate[],
  wordOwners: ReadonlyMap<string, ReadonlySet<string>>,
): StimulusCandidate[];
```

Rules: a word is invalid if it has no `imageUrl`, or `wordOwners.get(text)` has size > 1. A counting char has **no** valid words at all (it renders procedurally — Task 3), so `validStimulusWords` returns `[]` for it; eligibility for counting chars is handled separately in Task 2.

Pure — no `@/db`, no React.

- [ ] Write failing tests covering: a clean word passes; a word owned by two same-week chars is rejected; an image-less word is rejected; a counting char yields `[]`; **the real 唱歌/多少 and 大人 cases** from the facts above, using their actual characters.
- [ ] Run them, see them fail.
- [ ] Implement. Run green.
- [ ] Commit: `feat(scenes): stimulus validity predicate for 看图找字`

---

### Task 2: Compile the chosen word, and filter targets

**Files:** `src/lib/scenes/configs.ts`, `src/lib/scenes/compile-week.ts`, `src/lib/scenes/stimulus.ts`; tests `tests/unit/compile-week-image-pick.test.ts` (new) + existing compile suites

**Changes:**

1. `ImagePickConfigSchema` (`configs.ts:36`) gains `wordId: z.string().uuid().optional()`. **Optional, not required** — old compiled rows have no `wordId` and must keep validating until the recompile runs.
2. `compile-week.ts` (the `image_pick` block at ~line 128): build the `wordOwners` map for the week (word text → set of hanzi among `chars`), then pick targets from characters that either have ≥1 valid stimulus word **or** are counting chars. Emit `{ characterId, wordId }`, where `wordId` is the chosen valid word (omitted for counting chars).
3. `pickStimulusImage` (`stimulus.ts`) gains an optional `preferredWordId`: when supplied and present, use that word; otherwise fall back to today's first-with-URL behaviour so old rows still render.

**Do not change the level key shape.**

- [ ] Write failing tests: a week containing 唱/歌 never emits 唱歌 as the stimulus for either; a counting char emits no `wordId`; the compiled `wordId` is one of the target's own words; old configs without `wordId` still parse.
- [ ] Run, fail, implement, green. Run the existing `compile-week-*` suites too — they assert level counts and will need updating if counts move.
- [ ] Commit: `feat(scenes): compile the image_pick stimulus word instead of guessing at render`

---

### Task 3: Procedural balloon counting cards

**Files:** Create `src/components/scenes/fx/CountingBalloons.tsx`; modify `src/components/scenes/ImagePickScene.tsx`, `src/components/scenes/SceneRunner.tsx`, `src/components/scenes/BossScene.tsx`; test `tests/unit/counting-balloons.test.tsx`

**`CountingBalloons({ count }: { count: number })`** — an inline SVG drawing **exactly `count` balloons**, 1–10.

Requirements:
- Distinct colours, arranged so 7–10 stay countable (a 5-per-row grid reads better than an arc at the top of the range — pick what actually counts cleanly and say why in a comment).
- Deterministic: no `Math.random()`. Colour per index from a fixed palette.
- Respect `useReducedMotion()` if you animate at all; static is fine and preferred.
- `role="img"` with a bilingual `aria-label`. **The label must not name the number** — that would hand a screen-reader user the answer. Say 一些气球 / some balloons.

**Wiring:** all three hosts that render `image_pick` must agree, or the boss silently diverges — this exact bug has happened twice in this repo (`pickStimulusImage` exists because of it). When the target character is a counting char, render `CountingBalloons` with `count = the character's value` instead of the `<img>`.

Put the hanzi→value mapping next to `COUNTING_CHARS` in Task 1's module so there is one source of truth.

- [ ] Write failing tests: renders exactly N balloon shapes for N = 1..10; is deterministic across renders; the aria-label does not contain the digit or the hanzi.
- [ ] Run, fail, implement, green.
- [ ] Verify all three hosts: grep for `ImagePickScene` and confirm each passes what the counting path needs.
- [ ] Commit: `feat(scenes): procedural balloon counting cards for number characters`

---

### Task 4: Verify script, docs, four-green

**Files:** Create `scripts/verify-stimulus-integrity.ts`; modify the DeepSeek authoring prompt, `CLAUDE.md`, `docs/CHANGELOG.md`, `PLAN.md`

1. **`scripts/verify-stimulus-integrity.ts`** — read-only, in the style of `scripts/verify-integrity.ts` (`loadEnv()` first, dynamic-import the db client **inside** `main()` — the landmine). Exits non-zero if any compiled `image_pick` level would render an ambiguous or count-dependent stimulus. Prints a per-week table. **NEVER mutates.**
2. **Authoring prompt** — add a line forbidding count-dependent `imageHook`s. Best-effort only; note in the code comment that the script is the real guard because DeepSeek does not reliably obey such constraints (already a documented landmine).
3. **Docs** — CLAUDE.md snapshot + "Recent changes" (keep the window at exactly 3, drop the oldest) + a landmine in the **Play loop & scenes** group:

> **Landmine:** *A picture must be able to identify its answer — `image_pick` never checked this.* It stored only `characterId` and grabbed `words.find(w => w.imageUrl)` at render, so the stimulus was whichever word happened to have art. Two consequences shipped for months: every week teaches a number (一…十) whose words hinge on a count diffusion cannot render (一起's hook is literally "two happy children" — for 一), and ten words map to two chars taught in the SAME week (唱歌 → 唱/歌, 多少 → 多/少), so with distractors drawn from that same pool the scene could offer both and have no correct answer. The chosen `wordId` is now compiled into `scene_config` and validated by `validStimulusWords`; counting chars bypass diffusion entirely for a procedural `CountingBalloons` SVG. `words.image_url` still resolves at RUNTIME — what is frozen is which word, not where its picture lives — so an art backfill still needs no recompile. `scripts/verify-stimulus-integrity.ts` fails if a bad stimulus is reintroduced.

CHANGELOG: bottom-appended flat bullet, this file's convention. PLAN.md: one `| #N | fix(scenes): … | |` row.

4. **Four-green**, then the controller opens the PR.

- [ ] Commit: `docs: 看图找字 stimulus validity — snapshot, changelog, plan row, landmine`

---

## Post-merge (REQUIRED — the fix is inert without it)

```bash
pnpm tsx scripts/backup-db.ts                    # first, always
pnpm tsx scripts/recompile-all-weeks.ts          # image_pick scene_config gains wordId
pnpm tsx scripts/verify-stimulus-integrity.ts    # expect 0 bad stimuli
pnpm tsx scripts/verify-integrity.ts             # expect 7/7
```

Against PROD via the `# PROD_DATABASE_URL=` swap. **Record `scene_attempts` count before and after the recompile and confirm it is unchanged** — stable level keys preserve the linkage, verified on this exact path when weeks 9+10 gained bosses.
