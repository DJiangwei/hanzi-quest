# PR #35 — Week hub restructure + pinyin removal + practice boost

**Date:** 2026-05-24
**Author:** Claude + David (brainstorm)
**Status:** Spec — pending implementation plan

---

## 1. Goal

Split the per-week play flow into three separately-enterable sections — 回顾 (Review), 练习 (Practice), Boss 战 — accessed via a new week hub page. Drop pinyin-focused practice (no longer the learning priority). Boost practice quantity ~2× and rebalance toward listening + meaning. Lay the foundation for **PR #36** (image-prompted word formation) without shipping that scene type yet.

After this PR ships:
- Tap an island → land on a hub page with 3 big section cards instead of dropping straight into a linear 17-level run.
- Each section is its own session: complete it, return to the hub, see ✨.
- Boss is locked until ≥6 of 12 practice scenes are cleared.
- `pinyin_pick` scenes disappear from new compilations. The component + scene_template stay for backwards-compat with old `scene_attempts` rows; the template is flipped to `is_active=false`.
- Yinuo's existing progress is preserved across recompile via stable `level_key` upsert keys (no more 0-progress reset every time the compile logic changes).
- Practice grows from 5 (post-pinyin-removal) → **12 scenes** per 10-char week: 3 audio_pick + 3 sight (image/visual/word) + 6 meaning (3 translate + 3 cloze).

## 2. Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Section entry UX | **Dedicated hub page** at `/play/[childId]/week/[weekId]`. Tap island → hub, not directly into scenes. |
| Section gating | **Boss requires ≥ 6 of 12 practice scenes cleared.** Review + Practice are always open. |
| Image-word scope | **Deferred to PR #36** (needs image-gen infra + Vercel Blob + words.imageUrl column). PR #35 is structural only. |
| Practice quantity | **12 scenes per 10-char week**: 3 audio_pick + 3 sight + 6 meaning (3 translate_pick + 3 sentence_cloze). |
| Pinyin removal | Drop `pinyin_pick` from compile + boss rotation. **Keep the component file and scene_template row** (flip `isActive=false`) — old `scene_attempts` rows still reference the template. No data destruction. |
| Progress preservation | **Stable `level_key`** on `week_levels`. Migration adds a new column + unique constraint; compile upserts by key instead of delete-then-insert. Yinuo's attempts survive every recompile. |
| URL routing | New hub at `/play/[childId]/week/[weekId]`. New section runner at `/play/[childId]/level/[weekId]/[section]` where section ∈ `review \| practice \| boss`. Old `/play/[childId]/level/[weekId]` redirects to the hub. |

## 3. Architecture

### 3.1 Routing change

```
Today:
  /play/[childId]                          → IslandMap (island tap → /level/[weekId])
  /play/[childId]/level/[weekId]           → SceneRunner (linear 17 levels)

After PR #35:
  /play/[childId]                          → IslandMap (island tap → /week/[weekId])
  /play/[childId]/week/[weekId]            → WeekHub (3 section cards)  ← NEW
  /play/[childId]/level/[weekId]/[section] → SceneRunner filtered by section  ← NEW path
  /play/[childId]/level/[weekId]           → redirect to /week/[weekId]  ← BACK-COMPAT
```

`section ∈ 'review' | 'practice' | 'boss'`. Derived from existing `sceneConfig.segment` field (no schema change for the section→segment map):
- `section='review'`  ↔ `segment === 'review'`
- `section='practice'` ↔ `segment ∈ {sound, sight, meaning}`
- `section='boss'`     ↔ `segment === 'boss'`

### 3.2 Stable level keys (the awkward bit, solved)

**Today**: `compileWeekIntoLevels` does `tx.delete(weekLevels).where(weekId=…)` then re-inserts. New rows = new UUIDs, so `sceneAttempts.weekLevelId` becomes orphaned on every recompile. Per-week-per-section "X/12 done" UI reads 0 after a recompile even though Yinuo's history is intact.

**Fix**: introduce a deterministic key per level slot.

Migration `0011_*.sql`:
```sql
ALTER TABLE week_levels ADD COLUMN level_key text;
-- Backfill existing rows with a non-colliding placeholder (week_id::text || ':' || position)
UPDATE week_levels SET level_key = week_id::text || ':' || position::text WHERE level_key IS NULL;
-- Tighten to NOT NULL + unique
ALTER TABLE week_levels ALTER COLUMN level_key SET NOT NULL;
ALTER TABLE week_levels ADD CONSTRAINT week_levels_week_level_key_unique UNIQUE (week_id, level_key);
```

`compileWeekIntoLevels` builds keys like:
- `review:flashcard:<characterId>` — one per character, stable across recompiles
- `practice:audio_pick:0`, `practice:audio_pick:1`, `practice:audio_pick:2`
- `practice:image_pick:0`, `practice:visual_pick:0`, `practice:word_match:0`
- `practice:translate_pick:0`, `practice:translate_pick:1`, `practice:translate_pick:2`
- `practice:sentence_cloze:0`, `practice:sentence_cloze:1`, `practice:sentence_cloze:2`
- `boss:boss:0`

Compile upserts via `ON CONFLICT (week_id, level_key) DO UPDATE SET position=..., scene_config=...`. Levels whose key is no longer in the new compile are deleted at the end of the transaction.

**Why this is safe for Yinuo's existing data**: the backfill key for pre-PR-35 rows is `week_id::text || ':' || position::text`. After the first post-PR-35 recompile, those rows are replaced (their old keys don't match the new deterministic keys) — Yinuo's `sceneAttempts` *would* orphan on this first recompile. Acceptable cost (one-time) for the structural benefit going forward. Alternative is a separate attempt-migration step; we opted for the cheaper path with a one-time small regression at PR #35 ship time.

If David objects to the one-time reset at ship time, an attempt-migration script can be added: snapshot old `(position, sceneTemplateId)` per week, run recompile with new keys, then rewrite `sceneAttempts.weekLevelId` for each char→new-row match. Adds ~80 lines but preserves PR #34-era attempts. **Default: no migration script; accept one-time reset.**

### 3.3 Compile changes (`src/lib/scenes/compile-week.ts`)

Replace the segment emission with the new quantity + remove pinyin:

```
review segment  → N × flashcard            (one per character, in input order)
sound segment   → 3 × audio_pick           (3 distinct chars; sampled without replacement)
sight segment   → 1 × image_pick (if any char has imageHook)
                  + 1 × visual_pick        (different char from image_pick target)
                  + 1 × word_match         (3-4 chars with words; if <2 available, slot becomes
                                            extra visual_pick)
meaning segment → 3 × translate_pick       (alternating cn_to_en / en_to_cn / cn_to_en)
                  + 3 × sentence_cloze     (sampled from chars-with-sentences; if <3 available,
                                            remaining slots become extra translate_pick)
boss segment    → 1 × boss                 (only if N ≥ 10; rotates 5 question types — pinyin_pick
                                            removed from the list)
```

**Boss question types** (was 6, now 5):
```ts
['audio_pick', 'visual_pick', 'image_pick', 'translate_pick', 'sentence_cloze']
```

**Edge cases for small char counts:**
- `N < 2`: review only (no practice, no boss).
- `2 ≤ N < 4`: practice scaled to 6 (1 audio + 1 sight + 4 meaning), no boss.
- `4 ≤ N < 10`: practice at 10 scenes (2 audio + 2 sight + 6 meaning), no boss.
- `N ≥ 10`: full 12 practice + boss.

### 3.4 Boss gating

Yinuo can enter Review or Practice anytime. Boss is gated.

**Lock condition**: `boss_locked = practiceCleared < 6` where `practiceCleared` is the count of distinct practice levels with at least one `scene_attempts.score >= 100`.

**Where the gate is enforced**:
1. **UI**: WeekHub renders the boss card with `disabled` style + "完成 6/12 练习 解锁 Boss / Clear 6 practice levels to unlock" copy when locked.
2. **Route guard**: `/play/[childId]/level/[weekId]/boss/page.tsx` server-checks the same condition before rendering. If locked, redirect to `/play/[childId]/week/[weekId]` (defensive; covers deep-link attempts).

The threshold is a single constant `BOSS_UNLOCK_PRACTICE_THRESHOLD = 6` in `src/lib/scenes/configs.ts` for easy tuning.

### 3.5 WeekHub UI

```
   ⭐  Week 5 · 装备齐 准备出航
   ────────────────────────────────

   ┌─────────────────────────────────┐
   │  📖  回顾 · Review              │
   │  10/10 ✨ 全部完成              │
   │  Review                         │
   └─────────────────────────────────┘   tap → /level/[weekId]/review

   ┌─────────────────────────────────┐
   │  ✍️  练习 · Practice            │
   │  4/12  🔥 继续努力              │
   │  Practice                       │
   └─────────────────────────────────┘   tap → /level/[weekId]/practice

   ┌─────────────────────────────────┐
   │  🐙  Boss 战 · Boss Battle      │
   │  未解锁 (完成 6 关练习 解锁)    │
   │  Locked                         │
   └─────────────────────────────────┘   disabled until practice ≥ 6/12

   [← 返回航海图 / Back to map]
```

**Card states**:
- **Not started** (0/N): amber outline, no chip.
- **In progress** (partial): amber filled + 🔥 chip + "继续 / Continue".
- **Cleared** (N/N): treasure-gold border + ✨ chip + "已完成 / Cleared".
- **Locked** (boss only, until practice ≥ 6): muted gray + 🔒 + reason copy.

**Server data shape** for the WeekHub:
```ts
interface WeekHubData {
  week: { id: string; weekNumber: number; label: string };
  sections: {
    review:   { done: number; total: number };
    practice: { done: number; total: number };
    boss:     { done: number; total: number; locked: boolean };
  };
}
```

Counts computed via:
```sql
-- per section
SELECT COUNT(DISTINCT wl.id) FROM week_levels wl
LEFT JOIN scene_attempts sa ON sa.week_level_id = wl.id
LEFT JOIN play_sessions ps ON ps.id = sa.session_id
WHERE wl.week_id = $weekId
  AND derive_section(wl.scene_config->>'segment') = $section
  AND ps.child_id = $childId
  AND sa.score >= 100
```

Or simpler: pull all levels for the week + child's attempts, group in JS. Both are O(small) for 10-char weeks.

### 3.6 SceneRunner filtering

`SceneRunner` today receives all the week's levels and walks them in `position` order. After PR #35:
- Page component reads `[section]` from the URL.
- Server query filters `weekLevels` by `sceneConfig.segment` matching the section's allowed values.
- SceneRunner receives only the filtered slice.
- After the last level: navigate to `/play/[childId]/week/[weekId]` (not the island map).

**Exit-mid-session UX**: existing exit-confirm dialog stays. "返回" goes to the week hub (not the island map). User can then go from hub back to map if desired.

### 3.7 Island tap routing

`src/components/play/IslandMap.tsx` currently links each island to `/play/[childId]/level/[weekId]`. Switch to `/play/[childId]/week/[weekId]`.

### 3.8 Old URL redirect

`src/app/play/[childId]/level/[weekId]/page.tsx` today renders the linear scene runner. Replace with a server-side redirect to `/play/[childId]/week/[weekId]`. The new section-scoped runner lives at `/play/[childId]/level/[weekId]/[section]/page.tsx`.

## 4. Data model

**No new tables.** One new column: `week_levels.level_key text NOT NULL` (migration 0011).

**No new enums.** `Section` is a TS type only; the DB still uses `segment` in JSON.

**Existing `pinyin_pick` scene_template**: flipped to `isActive=false` via a tiny ops script `scripts/disable-pinyin-pick.ts` (idempotent: `UPDATE scene_templates SET is_active=false WHERE type='pinyin_pick'`). The React component and config schema stay, since old `scene_attempts` rows still join through.

## 5. UI components

**New:**
- `src/app/play/[childId]/week/[weekId]/page.tsx` — server page, fetches hub data, renders `<WeekHub>`.
- `src/components/play/WeekHub.tsx` — client component (3 section cards + boss gating UI).
- `src/components/play/SectionCard.tsx` — extracted card primitive (4 states).
- `src/app/play/[childId]/level/[weekId]/[section]/page.tsx` — server page, fetches levels filtered by section + child progress, renders `<SceneRunner>`.

**Modified:**
- `src/components/play/IslandMap.tsx` — link target changes from `/level/[weekId]` to `/week/[weekId]`.
- `src/app/play/[childId]/level/[weekId]/page.tsx` — replaced body with `redirect(\`/play/\${childId}/week/\${weekId}\`)`.
- `src/components/scenes/SceneRunner.tsx` — exit nav target changes from `/play/[childId]` to `/play/[childId]/week/[weekId]`.
- `src/lib/scenes/compile-week.ts` — new compile structure + stable keys + boss-question-types update.
- `src/lib/scenes/configs.ts` — add `BOSS_UNLOCK_PRACTICE_THRESHOLD = 6` constant.
- `src/lib/db/play.ts` — new helpers `getSectionStatsForChild(childId, weekId)`, `countPracticeClearedForChild(childId, weekId)`.
- `src/db/schema/game.ts` — add `levelKey` text column to `weekLevels`.

## 6. Tests (Vitest + RTL, mocking @/db / @clerk / next/cache / next/navigation)

1. `tests/unit/compile-week-pr35-structure.test.ts`
   - 10-char week produces 10+12+1 = 23 levels.
   - 5-char week produces 5+10+0 = 15 levels (no boss).
   - 3-char week produces 3+6+0 = 9 levels (scaled-down practice).
   - 1-char week produces 1+0+0 = 1 level (review only).
   - No level has `segment === 'sound'` with `sceneTemplate.type === 'pinyin_pick'`.
   - Boss questionTypes array has exactly 5 entries, none `pinyin_pick`.

2. `tests/unit/compile-week-stable-keys.test.ts`
   - Running `compileWeekIntoLevels(weekId)` twice on the same input keeps the same set of `level_key` values (and thus same row UUIDs) — the upsert path is exercised.
   - Re-running with different `chars[]` removes levels whose key isn't in the new set.

3. `tests/unit/week-hub-stats.test.ts`
   - `getSectionStatsForChild(childId, weekId)` returns correct `{done, total}` per section given mocked attempt rows.

4. `tests/unit/week-hub.test.tsx` (RTL)
   - WeekHub renders 3 cards.
   - Boss card is disabled when `sections.boss.locked === true`.
   - Boss card is enabled when `sections.boss.locked === false`.
   - Section card click navigates to the section URL (router push assertion).
   - Cleared section shows ✨ chip.

5. `tests/unit/section-route-guard.test.ts`
   - Boss page redirects to hub when locked.
   - Boss page renders when unlocked.

6. `tests/unit/scene-runner-exit-target.test.tsx` (light addition to existing scene-runner tests)
   - After the last level in a section, navigation target is `/play/<childId>/week/<weekId>` (not `/play/<childId>`).

## 7. Scripts

1. **`scripts/disable-pinyin-pick.ts`** — one-off: `UPDATE scene_templates SET is_active=false WHERE type='pinyin_pick'`. Idempotent. Run after merge before recompile.
2. **`scripts/recompile-all-weeks.ts`** — existing script; rerun against prod after merge. Now produces the new 23-level shape for each ≥10-char week.

(No new seed scripts. No trophy seed changes.)

## 8. Out of scope

- **Image-prompted word formation** (entire scene type + image-gen infra + Vercel Blob + `words.imageUrl` column) → PR #36.
- **Per-section trophies** (e.g. `practice-perfectionist`). Existing trophies still cover the milestones.
- **Section-level coin bonuses**. Coin economy stays as-is. Perfect-week bonus (PR #28) still fires once per week, gated on the whole week's perfection.
- **Replay UX for cleared sections**. Cleared sections stay tappable (matching the "any island tappable" principle); no separate replay button.
- **Boss difficulty rebalance**. Boss still uses 10 chars + now 5 rotating question types (was 6, minus `pinyin_pick`).
- **Pinyin in flashcards**. `FlashcardScene` shows pinyin via `usePinyinReveal` (locked decision: pinyin hidden by default; revealable). That's unchanged. Only the dedicated pinyin practice scenes are removed.
- **Section preview before entry**. Each section card shows count, not a preview of the next scene. Keep it simple.

## 9. Verification (pre-PR-open)

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — 4-green.
2. `pnpm dev`:
   - Tap island → land at `/play/<childId>/week/<weekId>` showing 3 cards.
   - 回顾 card → enters review session → finish 10 flashcards → returns to hub → 回顾 shows ✨.
   - 练习 card → enters practice → boss card locked at 0/12, still locked at 5/12, unlocks at 6/12.
   - Boss card → enters boss → win → returns to hub → boss shows ✨.
3. Type old URL `/play/<childId>/level/<weekId>` → server redirects to `/play/<childId>/week/<weekId>`.
4. No `pinyin_pick` scene appears in any compiled week. Boss question rotation never returns pinyin.
5. Recompile-all-weeks dev → each ≥10-char week has 23 levels. Each 5-char week has 15 levels.
6. (Acceptable one-time regression) Yinuo's pre-PR-35 attempts orphan on first recompile; hub shows 0 across all sections; she reclears as desired. Subsequent recompiles preserve progress.
7. Trophy regression sweep: `100-levels`, `streak-*`, `coins-*`, `perfect-week` — none should fire spurious / miss.

## 10. CLAUDE.md updates after merge

Under "Current state":
> PR #35 (shipped YYYY-MM-DD) — Week hub restructure. Each week now splits into 3 separately-enterable sections: 回顾 (Review) / 练习 (Practice) / Boss战. New routes `/play/[childId]/week/[weekId]` (hub) and `/play/[childId]/level/[weekId]/[section]`. Boss gated until ≥6 of 12 practice cleared. `pinyin_pick` removed from compile + boss rotation (scene_template flipped to is_active=false; component file stays for backwards compat). Practice quantity ~doubled to 12 scenes per 10-char week (3 audio + 3 sight + 6 meaning). New `week_levels.level_key` column + unique constraint enables stable upserts across recompiles — future compile changes won't reset Yinuo's progress.

Under "Landmines":
> **`pinyin_pick` is retired, not deleted.** The React component (`src/components/scenes/PinyinPickScene.tsx`), config schema, and `scene_templates` row all still exist with `is_active=false`. Old `scene_attempts` rows reference the template — don't delete it. Boss `questionTypes` array no longer includes `'pinyin_pick'`; if you re-add it, you also need to flip the template back to `is_active=true` and update compile-week.
>
> **Stable level keys on `week_levels`.** `compileWeekIntoLevels` upserts by `(week_id, level_key)` instead of delete-then-insert. The key shape is documented in compile-week.ts (`<segment>:<sceneTemplateType>:<slotIndex>` for slot-based scenes; `<segment>:<sceneTemplateType>:<characterId>` for per-char scenes). When changing the key shape, you'll regress all of Yinuo's existing attempts unless you write a one-off attempt-migration script. Don't change keys casually.

## 11. Implementation order (preview for plan stage)

1. **Migration & schema**: add `week_levels.level_key` column + unique constraint (migration 0011 — two-phase since UNIQUE+backfill can't share a transaction).
2. **Compile rewrite**: new structure (12 practice scenes, pinyin removed, boss types reduced) + stable-key upsert. Tests for shape + idempotency.
3. **DB query helpers**: `getSectionStatsForChild`, `countPracticeClearedForChild`, `getLevelsForSection` in `src/lib/db/play.ts`. Tests.
4. **WeekHub UI**: page + WeekHub client component + SectionCard primitive. Tests.
5. **Section route**: `/play/[childId]/level/[weekId]/[section]/page.tsx` server fetch + boss redirect guard. Tests.
6. **Old route redirect**: `/play/[childId]/level/[weekId]/page.tsx` body → `redirect(...)`.
7. **Island tap + SceneRunner exit target**: link + nav updates.
8. **Disable-pinyin-pick script** + run + recompile-all-weeks against prod after merge.
9. **CLAUDE.md update** + final 4-green gate + PR open.

## 12. Risk & rollback

- **Migration**: nullable column + backfill + unique constraint, all idempotent in concept. The UNIQUE-after-backfill order matters; if backfill misses rows the constraint creation fails. Mitigation: assert zero NULL rows mid-migration. Rollback: drop the column + constraint.
- **Compile rewrite**: the riskiest change. Mitigation: dual-mode for testing — keep the legacy compile function under `compileWeekIntoLevelsLegacy` for one PR cycle so we can compare outputs. Drop after PR #35 + 1 week of stability.
- **Old URL redirect**: trivial change but breaks any deep links in social/notes. Acceptable risk; only David uses the URL bar.
- **Yinuo's reset on first recompile**: one-time, predictable. If David objects strongly, we add an attempt-migration step.
