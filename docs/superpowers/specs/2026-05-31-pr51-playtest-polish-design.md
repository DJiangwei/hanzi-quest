# PR #51 — Playtest Polish + Bug Fix — Design

**Status:** approved scope (David, 2026-05-31)
**Branch:** `feat/pr51-playtest-polish`
**Owner:** Claude + David

---

## 1. Goal

Address six concrete playtest issues David surfaced while watching Yinuo play. Three are polish, three are correctness bugs. All ship together as one cohesive "first reaction to the live build" PR.

## 2. Why

Yinuo (6yo, English-native, doesn't read pinyin yet) is the real user. Each item below either reduces visual / cognitive friction in the loop or fixes a broken affordance she hits on second play. Bundle:

- The kid spends ~30% of practice time on flashcards — fixing the hanzi size + adding pronunciation-supportable example words is the single highest-leverage UX change in this PR.
- She doesn't know pinyin yet, so `visual_pick` ("它怎么读？/ how is it read") is pedagogically wrong for her right now — it tests a skill she hasn't been taught.
- `image_word` currently displays the base 字 chip, which lets her solve it by character recognition instead of by image-word meaning understanding. Hiding it forces the intended learning behaviour.
- Repeat-boss "宝箱已经开过啦" looks like a chest-failure bug to her; the chest button shouldn't appear on replays at all.
- The Sounds shop tab is broken — preview tap → silence (AudioContext suspended at speak time).

## 3. Items in scope

| # | Surface | Change | Type |
|---|---|---|---|
| 1A | FlashcardScene | Hanzi size `clamp(11rem, 55vw, 22rem)` → `clamp(8rem, 42vw, 16rem)` (~30% smaller) | Polish |
| 1B | FlashcardScene | Add example-word row + example-sentence row, each with `<SpeakButton size="sm">` from PR #50. Both rows behind a reveal toggle (consistent with existing pinyin/meaning reveals). | Feature |
| 2A | compile-week + scene_templates | Retire `visual_pick` (`scene_templates.is_active=false`, drop from compile-week; replace the slot with extra `image_pick` on a different char OR drop sight slot count from 3 to 2 — see §4.3) | Compile change |
| 2C | ImageWordScene | Drop the base-hanzi chip from the prompt. New prompt: "看图选词 / Match the picture" — pure image→word meaning. | Polish |
| 3A | finishLevelAction + SceneRunner + LevelFanfare | Thread `freePullClaimed: boolean` from server → client. `chestAvailable = bossCleared && !freePullClaimed`. Hide the chest button on repeat boss wins instead of letting it 422 with `AlreadyClaimedError`. | Bug fix |
| 5A | SoundsTabBody | `preview()` must `await ctx.resume()` before calling `theme.ding(ctx)`. AudioContext was being scheduled while still suspended → silent. | Bug fix |

## 4. Architecture / per-item design

### 4.1 1A — Flashcard font size

Single class change in `FlashcardScene.tsx`:

- Old: `style={{ fontSize: 'clamp(11rem, 55vw, 22rem)' }}`
- New: `style={{ fontSize: 'clamp(8rem, 42vw, 16rem)' }}`

No other JSX changes. The `textShadow` decoration stays.

### 4.2 1B — Flashcard example word + sentence

The character data passed via `pool` already includes `words` (array, ordered by AI gen) and `sentence` (single object). `SceneRunner` currently only forwards `{hanzi, pinyin, meaningEn, meaningZh, imageHook}` to `FlashcardScene`. Extend the contract:

```ts
interface FlashcardSceneData {
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  // PR #51 additions:
  firstWord: string | null;        // c.words[0]?.text ?? null
  firstSentence: string | null;    // c.sentence?.text ?? null
}
```

`SceneRunner.tsx` case `'flashcard'` updates the `data` object to include the two new fields. Both reach the scene as plain strings (the `<SpeakButton>` consumes the string directly — no pool wiring needed inside the scene).

In `FlashcardScene.tsx`, add two new reveal rows below the existing pinyin/meaning block:

```tsx
{firstWord ? (
  wordShown ? (
    <div className="flex items-center gap-2">
      <span className="text-3xl font-hanzi text-[var(--color-ocean-800)]">
        {firstWord}
      </span>
      <SpeakButton text={firstWord} size="sm" label={`Read aloud ${firstWord}`} />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setWordShown(true)}
      className="rounded-full border-2 border-dashed border-[var(--color-ocean-300)] px-5 py-1.5 text-sm text-[var(--color-ocean-700)] hover:bg-[var(--color-ocean-100)]"
    >
      Tap to show example word / 例词
    </button>
  )
) : null}

{firstSentence ? (
  sentenceShown ? (
    <div className="flex items-center gap-2 px-2 text-center">
      <p className="text-xl font-hanzi text-[var(--color-ocean-800)]">
        {firstSentence}
      </p>
      <SpeakButton text={firstSentence} size="sm" label="Read aloud sentence" />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setSentenceShown(true)}
      className="rounded-full border-2 border-dashed border-[var(--color-ocean-300)] px-5 py-1.5 text-sm text-[var(--color-ocean-700)] hover:bg-[var(--color-ocean-100)]"
    >
      Tap to show sentence / 例句
    </button>
  )
) : null}
```

Two new `useState` locals: `wordShown` / `sentenceShown`. Both default `false` so the flashcard starts visually clean and the kid taps to reveal — same reveal pattern as pinyin/meaning.

### 4.3 2A — Retire VisualPickScene

Follow the `pinyin_pick` precedent from PR #35:

1. `scene_templates` row for `visual_pick` → flip `is_active=false` (no migration, no DB column changes; flip the row via a small idempotent script `scripts/retire-visual-pick.ts` — or include as a one-liner SQL in the spec for a manual run since it's a single row).
2. `compile-week.ts` SIGHT section: remove the `visual_pick` slot logic AND its use as fallback for `image_pick` / `image_word`. The new sight allocation:
   - Slot 0: `image_pick` (on a char with `imageHook`); if no eligible char → falls back to a second `image_word` slot (which already has its own fallback chain). No `visual_pick` fallback path remains.
   - Slot 1: `word_match` (multi-char, untouched in this PR; David's PR #53 will replace it).
   - Slot count: `sight` drops from 3 → 2 in `computePracticeSizing` for the `n >= 10` and `n < 10` tiers. Total practice for 10-char weeks: 14 → 13.
3. `VisualPickScene.tsx` component file + `VisualPickConfigSchema` + the `SceneRunner` case stay (backwards-compat for old `scene_attempts` rows that reference visual_pick). The `is_active=false` flip means no new visual_pick attempts will be created.
4. Boss unlock threshold (currently 7/14) becomes `Math.ceil(13/2) = 7`. Or drop to 6 to keep proportional gating. Recommend **6/13** — easier unlock, matches David's "smooth difficulty" intent.
5. Recompile prod: `pnpm tsx scripts/recompile-all-weeks.ts` after merge. Stable `level_key` upserts mean existing `scene_attempts` linkages are preserved for surviving level keys; `visual_pick` keys are simply not upserted, and old rows are filtered out at runtime by `getCharactersAvailableForChildWeek` / section page.

### 4.4 2C — Hide base hanzi in ImageWordScene

`ImageWordScene.tsx` prompt is currently:

```tsx
prompt={
  <span>
    看图选词 / Pick the word with{' '}
    <span className="ml-1 rounded-md bg-amber-200 px-2 py-0.5 text-2xl font-extrabold text-amber-900">
      {baseChar.hanzi}
    </span>
  </span>
}
```

Replace with:

```tsx
prompt="看图选词 / Match the picture to a word"
```

The `baseChar` prop is no longer rendered but still passed (the type stays — `'use client'` props are stable to avoid the SceneRunner case-block having to change). Distractor selection in compile-week already constrains all 4 candidates to contain the same base char, so the kid still has a constrained answer space — the test is now purely "which word matches the image meaning".

### 4.5 3A — Boss chest button hides on repeat

Three small surgical changes:

1. **`finishLevelAction` (`src/lib/actions/play.ts`)** — extend the return shape:

```ts
return {
  ok: true,
  bossCleared,
  freePullClaimed: existingProgress?.freePullClaimed ?? false,
  bonuses,
};
```

The `existingProgress` read already happens at line 224–225. Just expose the flag in the return.

2. **`SceneRunner.tsx`** — accept the flag in its result type + thread it to `LevelFanfare`:

```tsx
const [serverState, setServerState] = useState<{
  bossCleared: boolean;
  freePullClaimed: boolean;
} | null>(null);

// ... after finishLevelAction call:
setServerState({ bossCleared: result.bossCleared, freePullClaimed: result.freePullClaimed });

// ... in LevelFanfare render:
<LevelFanfare
  ...
  chestAvailable={serverState?.bossCleared === true && !serverState.freePullClaimed}
/>
```

Note: the current `chestAvailable={lastSceneType === 'boss'}` line is what David's seeing — pure client-side check. Replace it with the server-derived flag.

3. **No change to `LevelFanfare.tsx`** — it already handles `chestAvailable=false` by hiding the button.

This is the correct fix because the SERVER is the authority on whether a pull is claimable. The client should not guess.

### 4.6 5A — Sound preview await resume

`src/components/shop/SoundsTabBody.tsx` lines 97–108 — make `preview()` async + await:

```tsx
const preview = async (slug: string) => {
  const theme = getTheme(slug);
  if (!theme?.ding) return;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  theme.ding(ctx);
};
```

Caller (the button `onClick`) doesn't need to await — `preview(slug)` returns a promise that the button handler can ignore. Pattern:

```tsx
<button type="button" onClick={() => { void preview(slug); }}>
```

This unblocks the suspended AudioContext before any nodes are scheduled. Existing test `sounds-tab-body.test.tsx` line 90-104 should be extended to actually assert `.ding` was called on a running context (or just test the await is present via a controlled mock).

## 5. Out of scope

These are real follow-ups from the same playtest session but are too big for this PR — each gets its own brainstorm + spec:

- **PR #52: Gacha economy redesign.** Remove shop gacha. Cards come from Boss (1/clear including repeats), `perfect_week` (1/wk), Story chapter (1/wk). Allow duplicate pulls + new `swap` mechanic.
- **PR #53: WordMatch replacement.** New game form (memory match / 连连看 / etc) replacing the current confusing word_match.
- **PR #54: Avatar expansion.** More slots (hair, pants, background decor...), multi-theme (pirate / sailing / space / Caribbean...), heavy content design.
- **Boss animations per week (3B):** brainstorm separately. Likely 10 small SVG variants keyed by `week.weekNumber`.
- **Backpack expansion (4C):** more flags/sea creatures/dinos — content-only, can land incrementally as needed.
- **Flashcard 1C extras:** what else to add to the review screen — defer until 1B is live and we see if Yinuo wants more.

## 6. Tests (Vitest + RTL + jsdom)

**Updated test files:**
- `tests/unit/flashcard-scene.test.tsx`:
  - Hanzi style uses `clamp(8rem, 42vw, 16rem)` (regression).
  - When `firstWord` is null: word reveal button absent.
  - When `firstWord` is provided: "Tap to show example word" button appears → click → word + SpeakButton render.
  - Same shape for `firstSentence`.
- `tests/unit/image-word-scene.test.tsx`:
  - Prompt does NOT include `baseChar.hanzi` chip.
  - Prompt text matches `/Match the picture/i`.
- `tests/unit/compile-week.test.ts` (or whichever file tests compile sizing):
  - 10-char week → 13 practice slots (was 14).
  - 0 levels with `sceneType === 'visual_pick'` are emitted.
- `tests/unit/sounds-tab-body.test.tsx`:
  - Preview tap → awaits `ctx.resume()` → calls `theme.ding(ctx)` (assert order via mocks).
- New `tests/unit/finish-level-action.test.ts` (or extend existing):
  - Boss clear (first time) returns `{bossCleared: true, freePullClaimed: false}`.
  - Boss clear (repeat — `freePullClaimed=true` already in DB) returns `{bossCleared: true, freePullClaimed: true}`.
- `tests/unit/scene-runner.test.tsx` (or extend):
  - When `freePullClaimed=true`, `LevelFanfare` is rendered with `chestAvailable=false`.

**Estimated:** +12 to +18 new tests. From 542 → ~554-560.

## 7. Verification

Pre-merge:
1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green.
2. `pnpm dev` → log in → review section → confirm flashcard hanzi is visibly smaller; tap to reveal example word + sentence; speak buttons play zh-CN.
3. Practice section → confirm no `visual_pick` scenes appear (only audio_pick / image_pick / word_match / image_word in sight; translate_pick / sentence_cloze in meaning).
4. `image_word` scene → confirm no base-hanzi chip in prompt.
5. First boss clear → chest button appears, tapping it pulls.
6. Replay same boss → chest button does NOT appear.
7. Shop > Sounds tab → tap 🔊 preview → hear theme ding.
8. Run `scripts/retire-visual-pick.ts` against prod (one-time, idempotent).
9. Run `pnpm tsx scripts/recompile-all-weeks.ts` against prod (one-time; existing scene_attempts preserved via stable level_key upserts).

## 8. Landmines / things to preserve

- **`visual_pick` template stays in DB.** Like `pinyin_pick` before it (PR #35), we flip `is_active=false` rather than DELETE the row, because old `scene_attempts` rows reference it via foreign key. The component file and config schema also stay — backwards-compat only.
- **Boss unlock threshold drops.** Currently 7 of 14 practice scenes; becomes 6 of 13. Update `BOSS_UNLOCK_PRACTICE_THRESHOLD` in `src/lib/scenes/configs.ts` from 7 → 6.
- **freePullClaimed flow is server-authoritative.** The client must never re-derive "is the chest available" from local state. Always trust the value returned by `finishLevelAction`. If you add new boss-related affordances in a future PR, follow the same pattern.
- **`SoundsTabBody.preview` must remain async.** Don't refactor away the `await ctx.resume()`. Without it, browsers in their default autoplay-restricted state will swallow the ding.
- **Recompile is required.** Without `pnpm tsx scripts/recompile-all-weeks.ts`, prod weeks will keep their existing `visual_pick` level rows until next compile. The retire-visual-pick script + recompile together remove `visual_pick` from active play.

## 9. Effort + rollout

- ~10 implementation tasks (1A, 1B threading + UI, 2A compile + threshold + template flip + recompile, 2C, 3A finishLevelAction + SceneRunner, 5A async fix + test, CLAUDE.md update, verify)
- ~10 files touched
- 1 small ops script (`scripts/retire-visual-pick.ts`) + 1 prod recompile run
- No DB migration, no new seed, no env var
- No prod data risk — `level_key` upserts preserve scene_attempts linkages
- Rollout: PR → four-green gate → merge → run retire script + recompile against prod
