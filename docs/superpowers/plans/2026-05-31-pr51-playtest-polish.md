# PR #51 — Playtest Polish + Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six post-playtest changes to FlashcardScene size + content, ImageWordScene prompt, visual_pick retirement, boss-chest repeat handling, and Sounds-tab preview audio.

**Architecture:** Pure render-layer + compile-layer changes plus one server-action return-shape extension. No DB migration. No new packages. Recompile prod after merge. Depends on the SpeakButton component shipping (or co-shipping) from PR #50.

**Tech Stack:** Next.js 16, React 19, Drizzle, Vitest + RTL + jsdom, Web Audio API.

---

## Pre-flight (read once before starting)

**Branch:** `feat/pr51-playtest-polish` (already created off `main`).

**PR #50 dependency on `SpeakButton`:** PR #50 (`feat/pr50-scene-tts`) introduces `@/components/play/SpeakButton`. Two cases:

- If PR #50 has merged to `main` by the time this PR opens: rebase this branch onto `main`, `SpeakButton` will be present, proceed.
- If PR #50 has NOT merged yet: cherry-pick the SpeakButton + hook commits onto this branch OR rebase this branch onto `feat/pr50-scene-tts`. Tasks 2 (1B) and the test of Task 5 (3A) need it.

Recommended: rebase this PR's branch onto whichever of (`main` / `feat/pr50-scene-tts`) currently has `SpeakButton`. If both are unmerged, base this PR on top of PR #50 and call out the dependency in the PR description.

---

## File structure

### New files
| Path | Responsibility |
|---|---|
| `scripts/retire-visual-pick.ts` | One-shot ops script. Flips `scene_templates.is_active=false` for `visual_pick`. Idempotent (no-op if already false). Uses the `loadEnv()` + dynamic `@/db` import pattern (CLAUDE.md landmine). |
| `tests/unit/retire-visual-pick.test.ts` | Verifies the script's core SQL flip. Mocks `@/db`. |

### Modified files
| Path | Change |
|---|---|
| `src/components/scenes/FlashcardScene.tsx` | (1A) shrink hanzi `fontSize` clamp. (1B) add `firstWord` + `firstSentence` props, two new reveal-toggle rows with `<SpeakButton>`. |
| `src/components/scenes/SceneRunner.tsx` | (1B) pass `firstWord` + `firstSentence` to `FlashcardScene`. (3A) capture `freePullClaimed` from `finishLevelAction` result; pass to `LevelFanfare`. |
| `src/components/scenes/ImageWordScene.tsx` | (2C) prompt becomes plain "看图选词 / Match the picture" — drop the inline `baseChar.hanzi` chip. |
| `src/components/shop/SoundsTabBody.tsx` | (5A) make `preview()` async; `await ctx.resume()` before scheduling. Caller uses `void preview(slug)`. |
| `src/lib/actions/play.ts` | (3A) `finishLevelAction` return includes `freePullClaimed: boolean`. |
| `src/lib/scenes/compile-week.ts` | (2A) SIGHT block: drop the `visual_pick` slot logic (keep `image_pick` + `word_match`). Sight slot count: 3 → 2 in `computePracticeSizing` for n ≥ 10 and n < 10 tiers. |
| `src/lib/scenes/configs.ts` | (2A) `BOSS_UNLOCK_PRACTICE_THRESHOLD` 7 → 6. |
| `tests/unit/flashcard-scene.test.tsx` | (1A) regression assert on fontSize clamp. (1B) tests for word/sentence reveal + SpeakButton presence. |
| `tests/unit/image-word-scene.test.tsx` | (2C) prompt does not include the base hanzi as a styled chip. |
| `tests/unit/sounds-tab-body.test.tsx` | (5A) preview awaits `ctx.resume()` before `theme.ding`. |
| `tests/unit/compile-week.test.ts` (locate the actual file in repo; fallback `tests/unit/compile-pirate-class.test.ts` or similar) | (2A) 10-char week emits 0 visual_pick scenes; total practice count = 13. |
| `tests/unit/finish-level-action.test.ts` (locate or extend the actual file; fallback create new) | (3A) returns `freePullClaimed` from existing progress. |
| `CLAUDE.md` | Append PR #51 entry + 4 new landmines. |

### Untouched (locked)
- `src/db/schema/*` — no migration.
- `src/lib/audio/{play,sounds,themes}` — preview is the only sound-system surface needing change.
- `src/components/scenes/VisualPickScene.tsx` — kept for backwards-compat with old `scene_attempts` rows.
- `src/lib/scenes/configs.ts VisualPickConfigSchema` — kept.
- Scene template DB rows — only `visual_pick.is_active` flips via the ops script; nothing else changes.

---

## Task 1: Flashcard hanzi font size (item 1A)

**Files:**
- Modify: `src/components/scenes/FlashcardScene.tsx`
- Test: `tests/unit/flashcard-scene.test.tsx`

- [ ] **Step 1.1: Add a failing regression test for the new clamp**

Append to `tests/unit/flashcard-scene.test.tsx` inside the top-level `describe`:

```tsx
it('renders the hanzi with the PR #51 fontSize clamp', () => {
  render(<FlashcardScene data={data} onComplete={() => undefined} />);
  const btn = screen.getByRole('button', { name: /Play audio for 海/i });
  expect(btn).toHaveStyle({ fontSize: 'clamp(8rem, 42vw, 16rem)' });
});
```

(The existing `data` const at the top of the file already has `hanzi: '海'`.)

- [ ] **Step 1.2: Run and confirm failure**

Run: `pnpm vitest run tests/unit/flashcard-scene.test.tsx`
Expected: FAIL — the assertion fails because the current style is `clamp(11rem, 55vw, 22rem)`.

- [ ] **Step 1.3: Apply the size change**

In `src/components/scenes/FlashcardScene.tsx`, change the big-hanzi `<button>`'s inline `style`:

```tsx
            style={{
              fontSize: 'clamp(8rem, 42vw, 16rem)',
              textShadow: '0 2px 0 rgba(255,250,225,0.5)',
            }}
```

(Only the `fontSize` line changes; preserve the `textShadow`.)

- [ ] **Step 1.4: Confirm test passes**

Run: `pnpm vitest run tests/unit/flashcard-scene.test.tsx`
Expected: PASS — all flashcard tests green.

- [ ] **Step 1.5: Commit**

```bash
git add src/components/scenes/FlashcardScene.tsx tests/unit/flashcard-scene.test.tsx
git commit -m "feat(pr51): shrink flashcard hanzi to clamp(8rem, 42vw, 16rem)"
```

---

## Task 2: Flashcard example word + sentence rows (item 1B)

**Files:**
- Modify: `src/components/scenes/FlashcardScene.tsx`
- Modify: `src/components/scenes/SceneRunner.tsx`
- Test: `tests/unit/flashcard-scene.test.tsx`

- [ ] **Step 2.1: Write failing tests for the new rows**

Append to `tests/unit/flashcard-scene.test.tsx`:

```tsx
describe('FlashcardScene example word + sentence (PR #51)', () => {
  const dataWithExtras = {
    hanzi: '海',
    pinyin: ['hǎi'],
    meaningEn: 'sea',
    meaningZh: '海洋',
    imageHook: null,
    firstWord: '大海',
    firstSentence: '我爱大海。',
  };

  it('shows reveal toggles when word + sentence are provided', () => {
    render(<FlashcardScene data={dataWithExtras} onComplete={() => undefined} />);
    expect(screen.getByRole('button', { name: /example word|例词/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sentence|例句/i })).toBeInTheDocument();
  });

  it('reveals the example word and renders a SpeakButton for it', async () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis,
    });
    render(<FlashcardScene data={dataWithExtras} onComplete={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /example word|例词/i }));
    expect(screen.getByText('大海')).toBeInTheDocument();
    // SpeakButton matches its aria-label
    expect(screen.getByRole('button', { name: /read aloud 大海/i })).toBeInTheDocument();
  });

  it('reveals the example sentence and renders a SpeakButton for it', async () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis,
    });
    render(<FlashcardScene data={dataWithExtras} onComplete={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /sentence|例句/i }));
    expect(screen.getByText('我爱大海。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /read aloud sentence/i })).toBeInTheDocument();
  });

  it('hides reveal toggles when firstWord and firstSentence are null', () => {
    render(<FlashcardScene data={{ ...dataWithExtras, firstWord: null, firstSentence: null }} onComplete={() => undefined} />);
    expect(screen.queryByRole('button', { name: /example word|例词/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /sentence|例句/i })).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run to confirm failure**

Run: `pnpm vitest run tests/unit/flashcard-scene.test.tsx`
Expected: FAIL — `firstWord` not in `FlashcardSceneData`; reveal buttons don't render.

- [ ] **Step 2.3: Extend FlashcardScene props + JSX**

Replace the full contents of `src/components/scenes/FlashcardScene.tsx` with:

```tsx
// src/components/scenes/FlashcardScene.tsx
'use client';

import { useState } from 'react';
import { TreasureMapBackdrop } from '@/components/ui/TreasureMapBackdrop';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { SpeakButton } from '@/components/play/SpeakButton';
import { useSpeak } from '@/lib/hooks/useSpeak';

interface FlashcardSceneData {
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
  firstSentence: string | null;
}

interface Props {
  data: FlashcardSceneData;
  onComplete: () => void;
}

export function FlashcardScene({ data, onComplete }: Props) {
  const [pinyinShown, setPinyinShown] = useState(false);
  const [meaningShown, setMeaningShown] = useState(false);
  const [wordShown, setWordShown] = useState(false);
  const [sentenceShown, setSentenceShown] = useState(false);
  const speak = useSpeak();

  return (
    <TreasureMapBackdrop intensity="medium">
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        <button
          type="button"
          onClick={() => speak(data.hanzi)}
          className="font-hanzi block select-none leading-none text-[var(--color-ocean-900)] transition-transform active:scale-95"
          aria-label={`Play audio for ${data.hanzi}`}
          style={{
            fontSize: 'clamp(8rem, 42vw, 16rem)',
            textShadow: '0 2px 0 rgba(255,250,225,0.5)',
          }}
        >
          {data.hanzi}
        </button>

        <div className="flex flex-col items-center gap-2">
          {pinyinShown ? (
            <button
              type="button"
              onClick={() => speak(data.hanzi)}
              className="text-3xl font-medium tracking-wider text-[var(--color-ocean-700)]"
            >
              {data.pinyin.join(' ')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPinyinShown(true)}
              className="rounded-full border-2 border-dashed border-[var(--color-ocean-300)] px-6 py-2 text-[var(--color-ocean-700)] hover:border-[var(--color-ocean-500)] hover:bg-[var(--color-ocean-100)]"
            >
              Tap to show pinyin
            </button>
          )}

          {meaningShown ? (
            <p className="text-xl text-[var(--color-sand-900)]">
              {data.meaningEn ?? '—'}
              {data.meaningZh ? (
                <span className="ml-2 text-base text-[var(--color-sand-700)]">
                  · {data.meaningZh}
                </span>
              ) : null}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setMeaningShown(true)}
              className="text-sm text-[var(--color-sand-700)] hover:text-[var(--color-sand-900)]"
            >
              Tap to show meaning
            </button>
          )}

          {data.firstWord ? (
            wordShown ? (
              <div className="flex items-center gap-2">
                <span className="font-hanzi text-3xl text-[var(--color-ocean-800)]">
                  {data.firstWord}
                </span>
                <SpeakButton
                  text={data.firstWord}
                  size="sm"
                  label={`Read aloud ${data.firstWord}`}
                />
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

          {data.firstSentence ? (
            sentenceShown ? (
              <div className="flex items-center gap-2 px-2 text-center">
                <p className="font-hanzi text-xl text-[var(--color-ocean-800)]">
                  {data.firstSentence}
                </p>
                <SpeakButton
                  text={data.firstSentence}
                  size="sm"
                  label="Read aloud sentence"
                />
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
        </div>

        <WoodSignButton size="lg" onClick={onComplete}>
          Got it →
        </WoodSignButton>
      </div>
    </TreasureMapBackdrop>
  );
}
```

Key changes vs. PR #50 version:
- `FlashcardSceneData` gains `firstWord` and `firstSentence` (both nullable).
- Two new `useState` locals (`wordShown`, `sentenceShown`).
- Outer container `gap-8` → `gap-6` (4 reveal rows is denser than 2 — tighten spacing).
- Two new reveal blocks after the meaning block, each guarded by null.

- [ ] **Step 2.4: Thread the new fields from SceneRunner**

In `src/components/scenes/SceneRunner.tsx`, find the `case 'flashcard'` block (around line 230) and update the `data` object:

```tsx
    case 'flashcard': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <FlashcardScene
          key={currentLevel.id}
          data={{
            hanzi: c.hanzi,
            pinyin: c.pinyinArray,
            meaningEn: c.meaningEn,
            meaningZh: c.meaningZh,
            imageHook: c.imageHook,
            firstWord: c.firstWord,
            firstSentence: c.sentence?.text ?? null,
          }}
          onComplete={() => advance(true)}
        />
      ) : (
        <MissingData />
      );
      break;
    }
```

(`c.firstWord` and `c.sentence` already exist on `CharacterDetail` — see `SceneRunner.tsx` lines 51 + 53.)

- [ ] **Step 2.5: Run tests to confirm pass**

Run: `pnpm vitest run tests/unit/flashcard-scene.test.tsx`
Expected: PASS — all original + 4 new tests.

- [ ] **Step 2.6: Commit**

```bash
git add src/components/scenes/FlashcardScene.tsx src/components/scenes/SceneRunner.tsx tests/unit/flashcard-scene.test.tsx
git commit -m "feat(pr51): flashcard example word + sentence rows with SpeakButton"
```

---

## Task 3: ImageWordScene — hide base hanzi (item 2C)

**Files:**
- Modify: `src/components/scenes/ImageWordScene.tsx`
- Test: `tests/unit/image-word-scene.test.tsx`

- [ ] **Step 3.1: Write failing test**

Find `tests/unit/image-word-scene.test.tsx`. If it doesn't exist, create it. Add (or append) inside the main `describe`:

```tsx
it('does not render the base hanzi chip in the prompt (PR #51)', () => {
  const baseChar = { characterId: 'b1', hanzi: '鱼' };
  const correctWord = {
    wordId: 'w1', text: '小鱼', imageHook: 'a small fish', meaningEn: 'small fish', imageUrl: null,
  };
  const distractors = [
    { wordId: 'w2', text: '金鱼', imageHook: null, meaningEn: 'goldfish', imageUrl: null },
    { wordId: 'w3', text: '鱼缸', imageHook: null, meaningEn: 'fish tank', imageUrl: null },
    { wordId: 'w4', text: '鱼网', imageHook: null, meaningEn: 'fish net', imageUrl: null },
  ];
  render(
    <ImageWordScene
      baseChar={baseChar}
      correctWord={correctWord}
      distractors={distractors}
      onComplete={() => undefined}
    />,
  );
  // The prompt must NOT contain the base hanzi as a styled chip
  const promptZone = screen.queryByText(/Match the picture|看图选词/i);
  expect(promptZone).toBeInTheDocument();
  // No bg-amber-200 chip with 鱼 should exist (the old chip had this exact class set)
  const oldChip = document.querySelector('.bg-amber-200');
  expect(oldChip).toBeNull();
});
```

If the file doesn't already exist, the top of the new file should be:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageWordScene } from '@/components/scenes/ImageWordScene';

describe('ImageWordScene', () => {
  // ... tests
});
```

- [ ] **Step 3.2: Run to confirm failure**

Run: `pnpm vitest run tests/unit/image-word-scene.test.tsx`
Expected: FAIL — current prompt renders the inline `bg-amber-200` chip.

- [ ] **Step 3.3: Replace the prompt**

In `src/components/scenes/ImageWordScene.tsx`, replace the prompt JSX:

```tsx
    <MultipleChoiceQuiz
      prompt="看图选词 / Match the picture to a word"
      stimulus={stimulus}
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
    />
```

(Drop the `<span>...{baseChar.hanzi}...</span>` block entirely.)

`baseChar` is still passed as a prop and is still in the type — it's no longer used in the render but kept for backwards compatibility (no other change needed to call sites).

- [ ] **Step 3.4: Run test to confirm pass**

Run: `pnpm vitest run tests/unit/image-word-scene.test.tsx`
Expected: PASS — the chip is gone; prompt text is correct.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/scenes/ImageWordScene.tsx tests/unit/image-word-scene.test.tsx
git commit -m "feat(pr51): ImageWordScene — hide base hanzi chip from prompt"
```

---

## Task 4: Sound preview — await ctx.resume (item 5A)

**Files:**
- Modify: `src/components/shop/SoundsTabBody.tsx`
- Test: `tests/unit/sounds-tab-body.test.tsx`

- [ ] **Step 4.1: Inspect the existing test setup**

Run: `grep -n "preview\|ctx.resume\|ding" tests/unit/sounds-tab-body.test.tsx | head -20`
Note: the existing test (per the bug-investigation report) only asserts `getTheme` was called; it does NOT assert ordering between `ctx.resume()` and `ding()`. Add the new assertion.

- [ ] **Step 4.2: Write failing test for the await behavior**

Append to `tests/unit/sounds-tab-body.test.tsx`:

```tsx
describe('SoundsTabBody preview await (PR #51)', () => {
  it('awaits ctx.resume() before calling theme.ding(ctx)', async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    const ding = vi.fn();
    const stubGetTheme = vi.fn(() => ({ ding }));

    // Replace the audio-themes module mock so our spy is observed
    vi.doMock('@/lib/audio/themes', () => ({
      getTheme: stubGetTheme,
    }));

    const FakeCtx = vi.fn().mockImplementation(() => ({
      state: 'suspended',
      resume,
    }));
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeCtx,
    });

    // Re-import after vi.doMock takes effect
    const { SoundsTabBody } = await import('@/components/shop/SoundsTabBody');

    render(
      <SoundsTabBody
        childId="c1"
        items={[
          {
            id: 'item-1',
            slug: 'theme-music-box',
            label: 'Music Box',
            priceCoins: 100,
            owned: false,
            equipped: false,
            rarity: 'common',
          },
        ]}
        coinBalance={500}
        equippedThemeSlug={null}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /preview|预览|🔊/i }));

    // Allow the awaited resume() to flush
    await new Promise((r) => setTimeout(r, 0));

    expect(resume).toHaveBeenCalledTimes(1);
    expect(ding).toHaveBeenCalledTimes(1);
    // resume must be called BEFORE ding
    expect(resume.mock.invocationCallOrder[0]).toBeLessThan(
      ding.mock.invocationCallOrder[0],
    );
  });
});
```

If the existing test file's prop shapes / button names differ, adjust accordingly — query by whatever role/text actually labels the preview button in the live component (`Preview` / `🔊` / equivalent).

- [ ] **Step 4.3: Run and confirm failure**

Run: `pnpm vitest run tests/unit/sounds-tab-body.test.tsx`
Expected: FAIL — `resume.mock.invocationCallOrder[0]` is greater than `ding.mock.invocationCallOrder[0]` (the current implementation fires `ding` before `resume` has resolved).

- [ ] **Step 4.4: Make `preview` async and await resume**

In `src/components/shop/SoundsTabBody.tsx`, replace the `preview` function (lines 97–108):

```tsx
  const preview = async (slug: string) => {
    const theme = getTheme(slug);
    if (typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    theme.ding(ctx);
  };
```

Also find the `onClick` that invokes `preview` and wrap it in `void` (so the React `onClick` signature still returns `void`):

```tsx
onClick={() => { void preview(slug); }}
```

(If the existing JSX is `onClick={() => preview(slug)}`, change it to `onClick={() => { void preview(slug); }}` — same semantics; just satisfies the void-returning event-handler contract.)

- [ ] **Step 4.5: Run test to confirm pass**

Run: `pnpm vitest run tests/unit/sounds-tab-body.test.tsx`
Expected: PASS — resume called before ding.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/shop/SoundsTabBody.tsx tests/unit/sounds-tab-body.test.tsx
git commit -m "fix(pr51): sound preview awaits ctx.resume before scheduling"
```

---

## Task 5: Boss chest hides on repeat (item 3A)

**Files:**
- Modify: `src/lib/actions/play.ts`
- Modify: `src/components/scenes/SceneRunner.tsx`
- Test: (extend existing tests for `finishLevelAction` if present; add `tests/unit/finish-level-action.test.ts` otherwise)

- [ ] **Step 5.1: Locate or stub the finish-level-action test file**

Run: `grep -rl "finishLevelAction" tests/`
- If a test file already exists that exercises `finishLevelAction`, add a new `describe` block there.
- If none exists, create `tests/unit/finish-level-action.test.ts` with the minimal scaffold (mocks `@/db`, `@/lib/auth/guards`, `@/lib/db/play`, `@/lib/db/coins`, `@/lib/db/streaks`, `@/lib/db/trophies`, `next/cache`).

- [ ] **Step 5.2: Write failing test**

Add (or append) inside the chosen test file:

```ts
describe('finishLevelAction return shape (PR #51)', () => {
  it('returns freePullClaimed=false when the child has no progress yet', async () => {
    // Mock getWeekProgress → null (no row)
    // Mock listLevelsForWeek → [...,{ sceneType: 'boss' }]
    // Mock upsertWeekProgress, awardCoins, isPerfectWeekForChild → false
    // Mock endPlaySession, checkAndGrantTrophies → []
    // Mock requireChild → { child: { id: 'c1' } }
    // Mock getPlayableWeekForChild → { id: 'w1', label: 'Week 1', weekNumber: 1 }
    // ... see existing finishLevelAction tests for the exact mock harness shape

    const result = await finishLevelAction({
      sessionId: 's1',
      childId: 'c1',
      weekId: 'w1',
      totalScenesPassed: 10,
      totalScenesInWeek: 10,
      durationSeconds: 60,
    });

    expect(result.freePullClaimed).toBe(false);
    expect(result.bossCleared).toBe(true);
  });

  it('returns freePullClaimed=true when the child already claimed the boss chest', async () => {
    // Same as above but mock getWeekProgress → { bossCleared: true, freePullClaimed: true }
    const result = await finishLevelAction({
      sessionId: 's2',
      childId: 'c1',
      weekId: 'w1',
      totalScenesPassed: 10,
      totalScenesInWeek: 10,
      durationSeconds: 60,
    });

    expect(result.freePullClaimed).toBe(true);
    expect(result.bossCleared).toBe(true);
  });
});
```

If extending an existing harness, copy the existing mock-import scaffold rather than reinventing it. If creating new, copy the mock scaffold from `tests/unit/finish-attempt-action.test.ts` or similar — the patterns are identical.

- [ ] **Step 5.3: Run to confirm failure**

Run: `pnpm vitest run` (filter by your new test file)
Expected: FAIL — `result.freePullClaimed` is `undefined` because the action doesn't return it yet.

- [ ] **Step 5.4: Extend the action return**

In `src/lib/actions/play.ts`, find `finishLevelAction`. At line 224 the existing code reads `const existing = await getWeekProgress(child.id, parsed.weekId);`. The `existing` object already has `freePullClaimed: boolean | undefined` (per the schema return type at `src/lib/db/play.ts:202`). Update the return statement at line 284:

```ts
  revalidatePath(`/play/${child.id}`);
  return {
    ok: true,
    bossCleared,
    freePullClaimed: existing?.freePullClaimed ?? false,
    bonuses,
    trophies: collectedTrophies,
  };
}
```

- [ ] **Step 5.5: Run action test — confirm pass**

Run: `pnpm vitest run` (filter the finish-level-action test file)
Expected: PASS — return shape includes `freePullClaimed`.

- [ ] **Step 5.6: Write failing test for SceneRunner**

In `tests/unit/scene-runner.test.tsx` (or whichever existing file exercises `SceneRunner`), add:

```tsx
it('renders LevelFanfare with chestAvailable=false on repeat boss clear (PR #51)', async () => {
  // Mock finishLevelAction → { ok: true, bossCleared: true, freePullClaimed: true, bonuses: [], trophies: [] }
  // Drive the scene runner to its done state.
  // Assert chestAvailable === false on the rendered LevelFanfare props.
});
```

The implementation will need to drive the runner to completion through a sequence of `advance()` calls. If the existing SceneRunner tests already have a helper for this, reuse it. If not, the simplest harness mocks `finishLevelAction` directly:

```tsx
vi.mock('@/lib/actions/play', () => ({
  finishLevelAction: vi.fn().mockResolvedValue({
    ok: true,
    bossCleared: true,
    freePullClaimed: true,
    bonuses: [],
    trophies: [],
  }),
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 'sess-1' }),
  finishAttemptAction: vi.fn().mockResolvedValue({ ok: true, bonuses: [], trophies: [] }),
}));
```

Then render `SceneRunner` with a single boss-only level array, advance it, and assert on `LevelFanfare`'s `chestAvailable` prop. If `LevelFanfare` is mocked or hard to introspect, fall back to asserting that the chest-tap button (`getByText` for the chest-open label) is NOT in the document.

- [ ] **Step 5.7: Run to confirm failure**

Run: `pnpm vitest run tests/unit/scene-runner.test.tsx`
Expected: FAIL — `chestAvailable` is still derived from `lastSceneType === 'boss'`.

- [ ] **Step 5.8: Update SceneRunner to thread `freePullClaimed`**

In `src/components/scenes/SceneRunner.tsx`:

(a) Add new state right after `const [lastSceneType, ...]` (line 109):

```tsx
const [freePullClaimed, setFreePullClaimed] = useState(false);
```

(b) Inside the `finishLevelAction` await (around line 192), capture the new field:

```tsx
const levelResult = await finishLevelAction({
  sessionId,
  childId,
  weekId,
  totalScenesPassed: totalLevels,
  totalScenesInWeek: totalLevels,
  durationSeconds: elapsedSeconds,
});
collectedBonuses.push(...levelResult.bonuses);
collectedTrophies.push(...levelResult.trophies);
setFreePullClaimed(levelResult.freePullClaimed);
setDone(true);
```

(c) Replace the `chestAvailable` prop on `<LevelFanfare>` (line 164):

```tsx
<LevelFanfare
  weekLabel={weekLabel}
  coinsThisSession={coinsThisSession}
  childId={childId}
  weekId={weekId}
  chestAvailable={lastSceneType === 'boss' && !freePullClaimed}
  onContinue={() => router.push(resolvedExitHref)}
/>
```

- [ ] **Step 5.9: Run all relevant tests to confirm pass**

Run: `pnpm vitest run tests/unit/scene-runner.test.tsx`
Expected: PASS — repeat boss → `chestAvailable=false`.

- [ ] **Step 5.10: Commit**

```bash
git add src/lib/actions/play.ts src/components/scenes/SceneRunner.tsx tests/unit/
git commit -m "fix(pr51): boss chest button hides on repeat clears (server-authoritative)"
```

---

## Task 6: Retire visual_pick in compile-week (item 2A, compile half)

**Files:**
- Modify: `src/lib/scenes/compile-week.ts`
- Modify: `src/lib/scenes/configs.ts`
- Test: existing compile-week test file (locate: `grep -rl 'computePracticeSizing\|compileWeekIntoLevels' tests/`).

- [ ] **Step 6.1: Write failing test — no visual_pick + 13 practice slots**

Append to whichever test file covers `compileWeekIntoLevels`:

```ts
describe('compile-week PR #51 visual_pick retirement', () => {
  it('does not emit visual_pick levels for a 10-char week', async () => {
    const levels = await runCompileForCharCount(10);
    expect(levels.filter((l) => l.sceneType === 'visual_pick')).toHaveLength(0);
  });

  it('emits 13 practice-segment levels for a 10-char week (was 14)', async () => {
    const levels = await runCompileForCharCount(10);
    const practice = levels.filter((l) => l.segment === 'practice');
    expect(practice).toHaveLength(13);
  });
});
```

`runCompileForCharCount` is a helper — if the existing test file has one, reuse it; if not, the body should build N character fixtures and call the public compile entry point (the function is exported from `compile-week.ts`).

- [ ] **Step 6.2: Run and confirm failure**

Run: `pnpm vitest run` (target compile test file)
Expected: FAIL — visual_pick emitted; total practice is 14.

- [ ] **Step 6.3: Update `computePracticeSizing`**

In `src/lib/scenes/compile-week.ts`, replace the `computePracticeSizing` function (around line 346):

```ts
function computePracticeSizing(n: number): PracticeSizing {
  if (n < 2)  return { audio: 0, sight: 0, imageWord: 0, meaning: 0 };
  if (n < 4)  return { audio: 1, sight: 1, imageWord: 1, meaning: 4 };  // 7 practice
  if (n < 10) return { audio: 2, sight: 1, imageWord: 1, meaning: 6 };  // 10 practice
  return { audio: 3, sight: 2, imageWord: 2, meaning: 6 };              // 13 practice (was 14)
}
```

Changes:
- n≥10: `sight: 3 → 2` (drop the visual_pick slot)
- n<10: `sight: 2 → 1` (same; visual_pick slot drop)

- [ ] **Step 6.4: Update SIGHT block to drop visual_pick logic**

In the SIGHT block of `compileWeekIntoLevels` (around lines 117–188), replace the entire block with:

```ts
  // ── SIGHT ───────────────────────────────────────────────────────────────
  if (sizing.sight > 0) {
    const imageId = tmplByType.get('image_pick');
    const wordId = tmplByType.get('word_match');
    const usedCharIds = new Set<string>();

    // image_pick (slot 0): if any char has imageHook
    if (sizing.sight >= 1 && imageId) {
      const withHook = chars.filter((c) => Boolean(c.imageHook));
      if (withHook.length > 0) {
        const target = pickRandom(withHook);
        usedCharIds.add(target.id);
        push(
          imageId,
          { characterId: target.id },
          'sight',
          'practice:image_pick:0',
        );
      }
      // No visual_pick fallback in PR #51+. If no eligible char, slot stays unfilled.
    }

    // word_match (slot 1 — multi-char)
    if (sizing.sight >= 2 && wordId) {
      const withWords = chars.filter((c) => c.words.length > 0);
      const sample = shuffle(withWords).slice(0, Math.min(4, withWords.length));
      if (sample.length >= 2) {
        push(
          wordId,
          { characterIds: sample.map((c) => c.id) },
          'sight',
          'practice:word_match:0',
        );
      }
    }

    // ── SIGHT: image_word slots ────────────────────────────────────────────
    const imageWordId = tmplByType.get('image_word');
    if (imageWordId && sizing.imageWord > 0) {
      const eligibleChars = chars.filter((c) =>
        c.words.some((w) => w.imageHook !== null),
      );
      let emitted = 0;
      for (let slot = 0; slot < sizing.imageWord; slot++) {
        if (eligibleChars.length === 0) break;
        const target = pickRandom(eligibleChars);
        const eligibleWords = target.words.filter((w) => w.imageHook !== null);
        const correctWord = pickRandom(eligibleWords);
        const allOtherWords = chars
          .flatMap((c) => c.words.filter((w) => w.id !== correctWord.id))
          .map((w) => w.id);
        if (allOtherWords.length < 3) break;
        const distractors = shuffle(allOtherWords).slice(0, 3);
        push(
          imageWordId,
          { characterId: target.id, wordId: correctWord.id, distractorWordIds: distractors },
          'sight',
          `practice:image_word:${slot}`,
        );
        emitted++;
      }
      // No visual_pick fallback for unfilled image_word slots in PR #51+.
    }
  }
```

Key differences from the old block:
- Drop the `visualId = tmplByType.get('visual_pick')` lookup and ALL references to it.
- Drop the `visual_pick` fallback paths in `image_pick` (when no imageHook char) and `image_word` (when no eligible words).
- Drop the dedicated `visual_pick` slot logic.
- Move the existing `image_word` block (which was outside `sight`) inside this `sight` block for clarity — semantics unchanged because `image_word` was already counted as sight content.

Note: the existing code at line ~188 (outer `}` of the sight block) and line ~190 (start of image_word block) get merged. Verify the brace nesting is right after the edit.

- [ ] **Step 6.5: Update boss-unlock threshold**

In `src/lib/scenes/configs.ts` line ~98:

```ts
export const BOSS_UNLOCK_PRACTICE_THRESHOLD = 6;
```

(Was 7.)

- [ ] **Step 6.6: Run compile tests + check the section page route guard isn't tripped**

Run: `pnpm vitest run`
Expected: PASS — compile tests + section page tests (if they assert the threshold) update with the new values. If any existing test still asserts `7` against `BOSS_UNLOCK_PRACTICE_THRESHOLD`, update it to `6` and call out the intentional change in the commit message.

- [ ] **Step 6.7: Commit**

```bash
git add src/lib/scenes/compile-week.ts src/lib/scenes/configs.ts tests/
git commit -m "feat(pr51): retire visual_pick from compile; sight 3→2, boss threshold 7→6"
```

---

## Task 7: Ops script — flip visual_pick to is_active=false

**Files:**
- Create: `scripts/retire-visual-pick.ts`
- Test: `tests/unit/retire-visual-pick.test.ts`

- [ ] **Step 7.1: Write failing test**

Create `tests/unit/retire-visual-pick.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

describe('retire-visual-pick script', () => {
  it('updates scene_templates.is_active to false for type=visual_pick', async () => {
    const update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 't1' }]) }) });
    vi.doMock('@/db', () => ({
      db: { update },
    }));

    const { retireVisualPick } = await import('../../scripts/retire-visual-pick');
    const result = await retireVisualPick();

    expect(update).toHaveBeenCalledTimes(1);
    expect(result.updated).toBe(1);
  });
});
```

- [ ] **Step 7.2: Run and confirm failure**

Run: `pnpm vitest run tests/unit/retire-visual-pick.test.ts`
Expected: FAIL — file doesn't exist.

- [ ] **Step 7.3: Implement the script**

Create `scripts/retire-visual-pick.ts`:

```ts
import { eq } from 'drizzle-orm';
import { loadEnv } from './_loadEnv';

export async function retireVisualPick(): Promise<{ updated: number }> {
  const { db } = await import('@/db');
  const { sceneTemplates } = await import('@/db/schema/game');

  const result = await db
    .update(sceneTemplates)
    .set({ isActive: false })
    .where(eq(sceneTemplates.type, 'visual_pick'))
    .returning({ id: sceneTemplates.id });

  return { updated: result.length };
}

async function main() {
  await loadEnv();
  const { updated } = await retireVisualPick();
  console.log(`[retire-visual-pick] flipped ${updated} row(s) to is_active=false`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[retire-visual-pick] failed:', err);
    process.exit(1);
  });
}
```

Adjustments if needed:
- If `_loadEnv` doesn't exist as `scripts/_loadEnv.ts`, check how `scripts/seed-pirate-class.ts` loads env (the CLAUDE.md landmine says the pattern is `loadEnv()` then dynamic import). Match whatever the existing scripts do.
- Confirm the schema import path (`@/db/schema/game` — adjust if your schema uses a different barrel).

- [ ] **Step 7.4: Run and confirm pass**

Run: `pnpm vitest run tests/unit/retire-visual-pick.test.ts`
Expected: PASS.

- [ ] **Step 7.5: Dry-run sanity check (no DB write)**

Run: `pnpm tsx scripts/retire-visual-pick.ts --help 2>&1 || true`
Expected: either prints `[retire-visual-pick] failed:` (if env missing) OR runs and prints how many rows flipped. Either is fine for the dry-check.

**Do NOT run against prod yet.** That happens in Task 9, after merge.

- [ ] **Step 7.6: Commit**

```bash
git add scripts/retire-visual-pick.ts tests/unit/retire-visual-pick.test.ts
git commit -m "feat(pr51): ops script to retire visual_pick template"
```

---

## Task 8: CLAUDE.md update (Current state + landmines)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 8.1: Refresh date**

Update the line `## Current state (last refreshed YYYY-MM-DD)` to today's date (2026-05-31).

- [ ] **Step 8.2: Add PR #51 entry**

After the last existing PR entry in "Current state", append:

```markdown
- **PR #51 (shipped 2026-05-31)** — Playtest polish + bug fix bundle. Six items from David's post-PR-#50 playtest with Yinuo: (1A) flashcard hanzi shrunk from `clamp(11rem, 55vw, 22rem)` → `clamp(8rem, 42vw, 16rem)` (~30% smaller); (1B) flashcard gains example-word + example-sentence reveal rows, each with `<SpeakButton size="sm">` from PR #50 (derived from existing `character.firstWord` and `character.sentence.text`); (2A) `visual_pick` retired (template `is_active=false`, dropped from compile-week; sight slot count 3 → 2; total practice 14 → 13; `BOSS_UNLOCK_PRACTICE_THRESHOLD` 7 → 6) — kid doesn't read pinyin yet so "它怎么读" was pedagogically wrong; (2C) `ImageWordScene` prompt drops the base-hanzi chip → pure image→word matching; (3A) boss chest button now hides on repeat clears via server-authoritative `freePullClaimed` flag threaded through `finishLevelAction` → `SceneRunner` → `LevelFanfare`; (5A) Sounds shop preview now `await ctx.resume()` before scheduling, was silently no-op'ing while AudioContext was suspended. New ops script `scripts/retire-visual-pick.ts`. Recompile required (`pnpm tsx scripts/recompile-all-weeks.ts`). +N tests.
```

(Fill in `+N tests` after the final verification step in Task 9.)

- [ ] **Step 8.3: Add landmine entries**

Append to the "Landmines" section (find by `grep -n "^## Landmines" CLAUDE.md`):

```markdown
- **`visual_pick` template still exists in DB.** Retired in PR #51 by flipping `scene_templates.is_active=false` (same pattern as PR #35's `pinyin_pick` retirement). The `VisualPickScene.tsx` component file, the `VisualPickConfigSchema`, and the `SceneRunner` case all remain for backwards-compat with old `scene_attempts` rows referencing the template. If you ever re-introduce pinyin recognition, flip `is_active=true` AND update `compile-week.ts` to allocate the slot.
- **Boss chest must be server-authoritative.** Pre-PR-#51, `SceneRunner` computed `chestAvailable={lastSceneType === 'boss'}` on the client. This showed the chest button on repeat boss wins; tapping then threw `AlreadyClaimedError` server-side and surfaced as "宝箱已经开过啦" / "开宝箱失败" to the kid. The fix is to thread `freePullClaimed` from `finishLevelAction`'s return through `SceneRunner` state into `LevelFanfare`'s `chestAvailable` prop. Future boss-related affordances (e.g. a "share trophy" button) should follow the same server-truth pattern — never re-derive eligibility from client-only state.
- **`SoundsTabBody.preview()` must remain `async` with `await ctx.resume()` before scheduling.** Browsers in autoplay-restricted state create AudioContexts in `'suspended'`; calling `ctx.resume()` without awaiting (as the original PR #31 code did) returns a promise that hasn't resolved by the time scheduled audio nodes try to play, so the ding silently no-ops. PR #51 fixed this by awaiting. Don't refactor away the await even if it looks redundant — the suspension state IS real on every fresh context.
- **Flashcard now reads `firstWord` and `firstSentence` from CharacterDetail.** Threaded through `SceneRunner.case 'flashcard'`. Source data is `character.firstWord` (already populated by the AI scene-gen pipeline since PR #36's V2 schema) and `character.sentence?.text` (populated since the very first weeks). Don't break this contract — if a future scene-gen tweak makes `firstWord` or `sentence` nullable in new content, the flashcard's null guards handle it but Yinuo loses the audio-supported word/sentence rows for that char.
```

- [ ] **Step 8.4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record PR #51 (playtest polish + bug fix) + landmines"
```

---

## Task 9: Verify + recompile + open PR

- [ ] **Step 9.1: Run the four-green gate**

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all 4 green. If any fails, fix inline before continuing — do NOT push.

- [ ] **Step 9.2: Backfill test count in CLAUDE.md**

Count total tests from `pnpm test` output. Compare to `main`'s baseline (542 if PR #48/#50 haven't merged; higher if they have).

Update the `+N tests` placeholder in the PR #51 CLAUDE.md entry with the actual delta. Example:

```
... Recompile required (`pnpm tsx scripts/recompile-all-weeks.ts`). +12 tests (542 → 554 total).
```

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): backfill PR #51 test count"
```

- [ ] **Step 9.3: Manual dev smoke (browser)**

```bash
pnpm dev
```

Walk through:
1. Sign in → `/play/<childId>`.
2. Enter a week's `review` section → confirm flashcard hanzi is visibly smaller; reveal pinyin / meaning / word / sentence; tap each SpeakButton → hear zh-CN.
3. Enter `practice` section → confirm no `visual_pick` scene appears in the rotation.
4. Find an `image_word` scene → confirm no base-hanzi chip in prompt; prompt text is "看图选词 / Match the picture to a word".
5. Clear the boss for a week you've already cleared previously → confirm the chest button is NOT shown in the fanfare.
6. (If practical) Reset a `week_progress.freePullClaimed` row to `false` and replay → confirm chest button DOES show for genuinely-fresh clears.
7. Shop > Sounds tab → tap 🔊 preview for each theme → hear the ding.

Document in the PR description any surface you couldn't exercise.

- [ ] **Step 9.4: Push branch + open PR**

```bash
git push -u origin feat/pr51-playtest-polish
gh pr create --title "feat(pr51): playtest polish — flashcard + visual_pick + boss-chest + sound preview" --body "$(cat <<'EOF'
## Summary

Six items from David's post-PR-#50 playtest with Yinuo, bundled as one cohesive "first reaction to the live build" PR.

### Polish
- **1A** Flashcard hanzi shrunk `clamp(11rem, 55vw, 22rem)` → `clamp(8rem, 42vw, 16rem)`.
- **1B** Flashcard gains example-word + example-sentence reveal rows, each with `<SpeakButton size="sm">` from PR #50. Both read existing `character.firstWord` / `character.sentence.text` — no AI-gen change needed.
- **2A** `visual_pick` retired (template `is_active=false`, dropped from compile-week; sight slots 3 → 2; practice 14 → 13; boss-unlock threshold 7 → 6). Kid doesn't read pinyin yet — "它怎么读" was pedagogically wrong.
- **2C** `ImageWordScene` prompt drops the base-hanzi chip → pure image→word matching.

### Bug fixes
- **3A** Boss chest button now hides on REPEAT boss clears via server-authoritative `freePullClaimed` flag threaded through `finishLevelAction` → `SceneRunner` → `LevelFanfare`. Was previously falsely showing then 422-ing as `AlreadyClaimedError`.
- **5A** Sounds shop preview now `await ctx.resume()` before `theme.ding(ctx)`. Was silently no-op-ing on a freshly-suspended AudioContext.

## Architecture

- No DB migration, no new dep, no scene_config change.
- One ops script (`scripts/retire-visual-pick.ts`) + recompile required after merge.
- Depends on `SpeakButton` from PR #50. If PR #50 hasn't merged yet, rebase onto its branch.

## Test plan

- [ ] Flashcard hanzi visibly smaller
- [ ] Flashcard example word + sentence reveal and speak
- [ ] No `visual_pick` scenes appear in any practice section
- [ ] `image_word` prompt has no base-hanzi chip
- [ ] First boss clear → chest shows
- [ ] Repeat boss clear → chest hidden
- [ ] Shop > Sounds preview tap → audible

## Post-merge ops

```bash
# Flip the visual_pick template
pnpm tsx scripts/retire-visual-pick.ts
# Re-emit all level rows (preserves scene_attempts via stable level_key upserts)
pnpm tsx scripts/recompile-all-weeks.ts
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9.5: Post-merge prod ops (manual — DO NOT RUN unattended)**

After PR merges to `main`, against the production `DATABASE_URL`:

```bash
pnpm tsx scripts/retire-visual-pick.ts
pnpm tsx scripts/recompile-all-weeks.ts
```

Confirm with David before running. The recompile is idempotent (stable level_key upserts) so re-running is safe.

---

## Self-review (controller checklist)

Spec coverage:

| Spec § | Item | Implementing task |
|---|---|---|
| 4.1 / 1A | flashcard size | Task 1 |
| 4.2 / 1B | flashcard example word + sentence | Task 2 |
| 4.3 / 2A | retire visual_pick (compile) | Task 6 |
| 4.3 / 2A | retire visual_pick (ops script) | Task 7 |
| 4.4 / 2C | image_word prompt | Task 3 |
| 4.5 / 3A | boss chest server-authoritative | Task 5 |
| 4.6 / 5A | sound preview await | Task 4 |
| 6 / tests | enumerated | Tasks 1, 2, 3, 4, 5, 6, 7 |
| 7 / verification | four-green + dev smoke | Task 9 |
| 8 / landmines | doc'd | Task 8 |
| 9 / rollout | recompile + script | Task 9 |

Placeholder scan: every step has full code or full commands.

Type consistency:
- `FlashcardSceneData.firstWord: string | null` — used in Tasks 2 (extend), referenced consistently.
- `FlashcardSceneData.firstSentence: string | null` — same.
- `finishLevelAction` return adds `freePullClaimed: boolean` — used in Tasks 5 only, consistent.
- `SoundsTabBody.preview()` becomes `Promise<void>` — caller wrapped in `void`, consistent.
- `BOSS_UNLOCK_PRACTICE_THRESHOLD` changes 7 → 6 in Task 6, referenced as constant elsewhere.

Plan is internally consistent and ready for execution.
