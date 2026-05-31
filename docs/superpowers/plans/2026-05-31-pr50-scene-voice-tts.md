# PR #50 — Scene Voice/TTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yinuo (6, English-native) hears native zh-CN pronunciation of every safe character/word stimulus she sees in scenes, via a tap-only 🔊 button on top of the Web Speech API.

**Architecture:** Three shared client-side primitives (`useSpeechSupported`, `useSpeak`, `SpeakButton`) replace inline `speak()` helpers in 2 existing scenes and add audio to 1 more. `ChapterAudioButton` (PR #48) refactors to consume `SpeakButton` so Story Mode and scene audio share one codepath. No DB, no server, no scene_config changes.

**Tech Stack:** React 19 (`useSyncExternalStore`), Vitest + RTL + jsdom, Web Speech API.

---

## Spec correction (read first)

During planning I inspected the live scene code and found two errors in the approved spec that must be reflected in implementation:

1. **ImagePickScene and VisualPickScene cannot have stimulus audio in v1.** Their stimulus is the target hanzi (or its representation) and their choices are the hanzi/pinyin themselves — speaking the stimulus tells the kid the answer. The original spec listed these as scoped IN; **drop them and document why in §10 of the spec (Task 8 below).**
2. **FlashcardScene shows only hanzi + pinyin + meaning** — there is no example-word or example-sentence row in the current data model (`FlashcardSceneData = {hanzi, pinyin, meaningEn, meaningZh, imageHook}`). The spec's "3 buttons — main hanzi, example word, example sentence" is wrong; the actual surfaces are **hanzi (big tap-target, already a button) + pinyin row (revealed-then-tappable, already a button)**. Both currently use an inline `speak()` helper with the latent `'speechSynthesis' in window` detection bug. Refactor both to share the hook; do not add new content rows.

**Net v1 surface (revised):** Flashcard refactor, AudioPick refactor, TranslatePick `cn_to_en` (new), Story Mode `ChapterAudioButton` refactor.

---

## File structure

### New files
| Path | Responsibility |
|---|---|
| `src/lib/hooks/useSpeechSupported.ts` | `useSyncExternalStore`-based boolean: is Web Speech API present? |
| `src/lib/hooks/useSpeak.ts` | Returns a `speak(text: string): void` callback that cancels in-flight speech, builds a `SpeechSynthesisUtterance` with `lang='zh-CN'` + `rate=0.85`, and calls `speechSynthesis.speak`. No-op when unsupported. |
| `src/components/play/SpeakButton.tsx` | Visual chip (`size: 'sm' \| 'md'`) using both hooks. Renders `null` when unsupported. |
| `tests/unit/lib/hooks/useSpeechSupported.test.tsx` | Hook tests. |
| `tests/unit/lib/hooks/useSpeak.test.tsx` | Hook tests (asserts cancel-before-speak + utterance shape). |
| `tests/unit/components/play/SpeakButton.test.tsx` | Component tests. |
| `tests/unit/components/scenes/AudioPickScene.test.tsx` | New: regression for refactored CTA. |
| `tests/unit/components/scenes/TranslatePickScene.test.tsx` | New: `cn_to_en` shows SpeakButton, `en_to_cn` doesn't. |

### Modified files
| Path | Change |
|---|---|
| `src/components/play/story/ChapterAudioButton.tsx` | Thin wrapper over `<SpeakButton size="md" />`. Same exported API. |
| `src/components/scenes/FlashcardScene.tsx` | Drop inline `speak()` helper; use `useSpeak()` hook. Big hanzi tap-target and pinyin row stay clickable. |
| `src/components/scenes/AudioPickScene.tsx` | Drop inline `speak()` helper; use `useSpeak()` hook for the central 🔊 CTA. |
| `src/components/scenes/TranslatePickScene.tsx` | Add `<SpeakButton size="sm">` adjacent to the hanzi stimulus when `direction === 'cn_to_en'`. |
| `tests/unit/flashcard-scene.test.tsx` | Add tests for hanzi tap calling speak with the right text. |
| `tests/unit/story-chapter-audio-button.test.tsx` *(if exists)* | Regression — keep passing after refactor. |
| `docs/superpowers/specs/2026-05-31-pr50-scene-voice-tts-design.md` | Correct §4.3 table + §1/2 prose to reflect actual v1 scope. |
| `CLAUDE.md` | Add PR #50 to "Current state" + new landmine: "Speaking the hanzi reveals the answer in stimulus→pinyin and stimulus→hanzi scenes." |

### Untouched (locked by spec §4.4)
- `src/lib/audio/{play,sounds,themes}` — procedural ding/buzz/fanfare, unrelated system.
- `src/lib/scenes/compile-week.ts` — TTS is render-time only.
- DB schema, migrations, seed scripts.

---

## Task 1: `useSpeechSupported` hook

**Files:**
- Create: `src/lib/hooks/useSpeechSupported.ts`
- Test: `tests/unit/lib/hooks/useSpeechSupported.test.tsx`

- [ ] **Step 1.1: Write the failing test**

Create `tests/unit/lib/hooks/useSpeechSupported.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpeechSupported } from '@/lib/hooks/useSpeechSupported';

describe('useSpeechSupported', () => {
  let originalSpeech: SpeechSynthesis | undefined;

  beforeEach(() => {
    originalSpeech = window.speechSynthesis;
  });

  afterEach(() => {
    if (originalSpeech === undefined) {
      // delete back to undefined
      // @ts-expect-error test cleanup
      delete window.speechSynthesis;
    } else {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: originalSpeech,
      });
    }
  });

  it('returns true when speechSynthesis is present', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis,
    });
    const { result } = renderHook(() => useSpeechSupported());
    expect(result.current).toBe(true);
  });

  it('returns false when speechSynthesis is undefined', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useSpeechSupported());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/lib/hooks/useSpeechSupported.test.tsx`
Expected: FAIL — `Cannot find module '@/lib/hooks/useSpeechSupported'`.

- [ ] **Step 1.3: Implement the hook**

Create `src/lib/hooks/useSpeechSupported.ts`:

```ts
'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

const getSnapshot = (): boolean =>
  typeof window !== 'undefined' && window.speechSynthesis != null;

const getServerSnapshot = (): boolean => false;

export function useSpeechSupported(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/lib/hooks/useSpeechSupported.test.tsx`
Expected: PASS — 2 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/hooks/useSpeechSupported.ts tests/unit/lib/hooks/useSpeechSupported.test.tsx
git commit -m "feat(pr50): useSpeechSupported hook"
```

---

## Task 2: `useSpeak` hook

**Files:**
- Create: `src/lib/hooks/useSpeak.ts`
- Test: `tests/unit/lib/hooks/useSpeak.test.tsx`

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/lib/hooks/useSpeak.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeak } from '@/lib/hooks/useSpeak';

describe('useSpeak', () => {
  let cancel: ReturnType<typeof vi.fn>;
  let speak: ReturnType<typeof vi.fn>;
  let originalSpeech: SpeechSynthesis | undefined;
  let originalUtterance: typeof SpeechSynthesisUtterance | undefined;

  beforeEach(() => {
    originalSpeech = window.speechSynthesis;
    originalUtterance = window.SpeechSynthesisUtterance;
    cancel = vi.fn();
    speak = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    // jsdom ships a constructor; we just want to capture the instance shape
  });

  afterEach(() => {
    if (originalSpeech !== undefined) {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: originalSpeech,
      });
    }
    if (originalUtterance !== undefined) {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: originalUtterance,
      });
    }
  });

  it('cancels in-flight speech before speaking', () => {
    const { result } = renderHook(() => useSpeak());
    act(() => result.current('妈'));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
      speak.mock.invocationCallOrder[0],
    );
  });

  it('builds an utterance with lang=zh-CN and rate=0.85', () => {
    const { result } = renderHook(() => useSpeak());
    act(() => result.current('妈'));
    const utt = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utt.text).toBe('妈');
    expect(utt.lang).toBe('zh-CN');
    expect(utt.rate).toBe(0.85);
  });

  it('is a no-op when speechSynthesis is undefined', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useSpeak());
    expect(() => act(() => result.current('妈'))).not.toThrow();
    expect(speak).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/lib/hooks/useSpeak.test.tsx`
Expected: FAIL — `Cannot find module '@/lib/hooks/useSpeak'`.

- [ ] **Step 2.3: Implement the hook**

Create `src/lib/hooks/useSpeak.ts`:

```ts
'use client';

import { useCallback } from 'react';

export function useSpeak(): (text: string) => void {
  return useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (synth == null) return;
    try {
      synth.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'zh-CN';
      utt.rate = 0.85;
      synth.speak(utt);
    } catch (err) {
      console.warn('[useSpeak] speak failed:', err);
    }
  }, []);
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/lib/hooks/useSpeak.test.tsx`
Expected: PASS — 3 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/hooks/useSpeak.ts tests/unit/lib/hooks/useSpeak.test.tsx
git commit -m "feat(pr50): useSpeak hook (zh-CN, rate 0.85, cancel-before-speak)"
```

---

## Task 3: `SpeakButton` component

**Files:**
- Create: `src/components/play/SpeakButton.tsx`
- Test: `tests/unit/components/play/SpeakButton.test.tsx`

- [ ] **Step 3.1: Write the failing test**

Create `tests/unit/components/play/SpeakButton.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeakButton } from '@/components/play/SpeakButton';

describe('SpeakButton', () => {
  let cancel: ReturnType<typeof vi.fn>;
  let speak: ReturnType<typeof vi.fn>;
  let originalSpeech: SpeechSynthesis | undefined;

  beforeEach(() => {
    originalSpeech = window.speechSynthesis;
    cancel = vi.fn();
    speak = vi.fn();
  });

  afterEach(() => {
    if (originalSpeech !== undefined) {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: originalSpeech,
      });
    }
  });

  it('renders null when speechSynthesis is undefined', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined,
    });
    const { container } = render(<SpeakButton text="妈" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a button when speechSynthesis is present', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    render(<SpeakButton text="妈" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls speak() with the configured text on click', async () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    render(<SpeakButton text="妈" />);
    await userEvent.click(screen.getByRole('button'));
    expect(speak).toHaveBeenCalledTimes(1);
    const utt = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utt.text).toBe('妈');
  });

  it('applies default aria-label "Read aloud"', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    render(<SpeakButton text="妈" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Read aloud');
  });

  it('applies aria-label override when label prop is provided', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    render(<SpeakButton text="妈" label="Play sound" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Play sound');
  });

  it('renders text label only for size="md"', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
    const { rerender } = render(<SpeakButton text="妈" size="md" />);
    expect(screen.getByText(/Read aloud/i)).toBeInTheDocument();
    rerender(<SpeakButton text="妈" size="sm" />);
    expect(screen.queryByText(/Read aloud/i)).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/components/play/SpeakButton.test.tsx`
Expected: FAIL — `Cannot find module '@/components/play/SpeakButton'`.

- [ ] **Step 3.3: Implement the component**

Create `src/components/play/SpeakButton.tsx`:

```tsx
'use client';

import { useSpeechSupported } from '@/lib/hooks/useSpeechSupported';
import { useSpeak } from '@/lib/hooks/useSpeak';

interface SpeakButtonProps {
  text: string;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

const BASE =
  'inline-flex items-center justify-center gap-1 rounded-full bg-amber-100 font-medium text-amber-900 hover:bg-amber-200';
const SIZES: Record<NonNullable<SpeakButtonProps['size']>, string> = {
  sm: 'h-11 w-11 text-base', // ≥44px tap target per spec §5
  md: 'h-11 px-4 text-sm',
};

export function SpeakButton({
  text,
  size = 'sm',
  label = 'Read aloud',
  className = '',
}: SpeakButtonProps) {
  const supported = useSpeechSupported();
  const speak = useSpeak();

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={label}
      className={`${BASE} ${SIZES[size]} ${className}`}
    >
      <span aria-hidden>🔊</span>
      {size === 'md' ? <span>{label}</span> : null}
    </button>
  );
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/components/play/SpeakButton.test.tsx`
Expected: PASS — 6 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/play/SpeakButton.tsx tests/unit/components/play/SpeakButton.test.tsx
git commit -m "feat(pr50): SpeakButton component (sm icon + md labeled variants)"
```

---

## Task 4: Refactor `ChapterAudioButton` to use `SpeakButton`

**Files:**
- Modify: `src/components/play/story/ChapterAudioButton.tsx`
- Verify: existing PR #48 tests still pass.

- [ ] **Step 4.1: Find existing ChapterAudioButton tests**

Run: `grep -rl "ChapterAudioButton" tests/`
Expected: file path(s) of tests that import `ChapterAudioButton`. Note them; they must still pass after refactor.

- [ ] **Step 4.2: Refactor the component**

Replace the contents of `src/components/play/story/ChapterAudioButton.tsx` with:

```tsx
'use client';

import { SpeakButton } from '@/components/play/SpeakButton';

export function ChapterAudioButton({ text }: { text: string }) {
  return <SpeakButton text={text} size="md" label="Read aloud" />;
}
```

- [ ] **Step 4.3: Run the regression tests**

Run: `pnpm vitest run` (or the specific ChapterAudioButton test file found in Step 4.1)
Expected: PASS — all existing tests that exercise `ChapterAudioButton` still pass. If a test asserts the exact internal DOM (e.g. specific class strings unique to the old implementation), update it to assert behavior (e.g. `expect(screen.getByRole('button', { name: /read aloud/i })).toBeInTheDocument()` and click → speak called).

- [ ] **Step 4.4: Commit**

```bash
git add src/components/play/story/ChapterAudioButton.tsx tests/
git commit -m "refactor(pr50): ChapterAudioButton wraps SpeakButton"
```

---

## Task 5: Refactor `FlashcardScene` to use `useSpeak`

**Files:**
- Modify: `src/components/scenes/FlashcardScene.tsx`
- Modify: `tests/unit/flashcard-scene.test.tsx`

- [ ] **Step 5.1: Add a failing speak-on-tap test**

Append to `tests/unit/flashcard-scene.test.tsx`:

```tsx
import { vi as _vi } from 'vitest';

describe('FlashcardScene speech', () => {
  let cancel: ReturnType<typeof _vi.fn>;
  let speak: ReturnType<typeof _vi.fn>;

  beforeEach(() => {
    cancel = _vi.fn();
    speak = _vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
  });

  const data = { hanzi: '海', pinyin: ['hǎi'], meaningEn: 'sea', meaningZh: '海洋', imageHook: null };

  it('tapping the big hanzi triggers speech with the hanzi text', async () => {
    render(<FlashcardScene data={data} onComplete={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Play audio for 海/i }));
    expect(speak).toHaveBeenCalledTimes(1);
    const utt = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utt.text).toBe('海');
    expect(utt.lang).toBe('zh-CN');
  });
});
```

Add `import { beforeEach } from 'vitest';` to the top of the file if not already present.

- [ ] **Step 5.2: Run test to verify it fails OR shows the latent bug**

Run: `pnpm vitest run tests/unit/flashcard-scene.test.tsx`
Expected: the existing `'speechSynthesis' in window` check passes (because the property is set), but the test still fails on detection or utterance shape — confirming the inline helper has a known bug. (If by accident it passes, fine — the refactor below is still required for consistency.)

- [ ] **Step 5.3: Refactor `FlashcardScene`**

In `src/components/scenes/FlashcardScene.tsx`:
1. Delete lines 21–29 (the inline `speak(text)` helper).
2. Add the hook import: `import { useSpeak } from '@/lib/hooks/useSpeak';`
3. Inside `FlashcardScene` body (line 32, just after `const [meaningShown, setMeaningShown] = useState(false);`), add `const speak = useSpeak();`
4. The existing `onClick={() => speak(data.hanzi)}` calls (lines 40 and 55) now resolve to the hook's callback. No JSX change required.

Final file should look like:

```tsx
// src/components/scenes/FlashcardScene.tsx
'use client';

import { useState } from 'react';
import { TreasureMapBackdrop } from '@/components/ui/TreasureMapBackdrop';
import { WoodSignButton } from '@/components/ui/WoodSignButton';
import { useSpeak } from '@/lib/hooks/useSpeak';

interface FlashcardSceneData {
  hanzi: string;
  pinyin: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
}

interface Props {
  data: FlashcardSceneData;
  onComplete: () => void;
}

export function FlashcardScene({ data, onComplete }: Props) {
  const [pinyinShown, setPinyinShown] = useState(false);
  const [meaningShown, setMeaningShown] = useState(false);
  const speak = useSpeak();

  return (
    <TreasureMapBackdrop intensity="medium">
      <div className="flex flex-col items-center justify-center gap-8 px-6 py-10">
        <button
          type="button"
          onClick={() => speak(data.hanzi)}
          className="font-hanzi block select-none leading-none text-[var(--color-ocean-900)] transition-transform active:scale-95"
          aria-label={`Play audio for ${data.hanzi}`}
          style={{
            fontSize: 'clamp(11rem, 55vw, 22rem)',
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
        </div>

        <WoodSignButton size="lg" onClick={onComplete}>
          Got it →
        </WoodSignButton>
      </div>
    </TreasureMapBackdrop>
  );
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/flashcard-scene.test.tsx`
Expected: PASS — all original + new tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/scenes/FlashcardScene.tsx tests/unit/flashcard-scene.test.tsx
git commit -m "refactor(pr50): FlashcardScene uses useSpeak hook"
```

---

## Task 6: Refactor `AudioPickScene` to use `useSpeak`

**Files:**
- Modify: `src/components/scenes/AudioPickScene.tsx`
- Create: `tests/unit/components/scenes/AudioPickScene.test.tsx`

- [ ] **Step 6.1: Write failing test**

Create `tests/unit/components/scenes/AudioPickScene.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioPickScene } from '@/components/scenes/AudioPickScene';

describe('AudioPickScene', () => {
  let cancel: ReturnType<typeof vi.fn>;
  let speak: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cancel = vi.fn();
    speak = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak } as unknown as SpeechSynthesis,
    });
  });

  const target = { characterId: 't', hanzi: '妈', pinyinArray: ['mā'] };
  const pool = [
    target,
    { characterId: 'd1', hanzi: '马', pinyinArray: ['mǎ'] },
    { characterId: 'd2', hanzi: '麻', pinyinArray: ['má'] },
    { characterId: 'd3', hanzi: '骂', pinyinArray: ['mà'] },
  ];

  it('tapping the play button speaks the target hanzi', async () => {
    render(<AudioPickScene target={target} pool={pool} onComplete={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /play audio/i }));
    expect(speak).toHaveBeenCalledTimes(1);
    const utt = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utt.text).toBe('妈');
    expect(utt.lang).toBe('zh-CN');
  });
});
```

- [ ] **Step 6.2: Run test to verify it passes against the OLD implementation (sanity check)**

Run: `pnpm vitest run tests/unit/components/scenes/AudioPickScene.test.tsx`
Expected: PASS — the existing inline `speak()` already does this. We're locking the behavior before refactoring.

- [ ] **Step 6.3: Refactor `AudioPickScene`**

Replace the contents of `src/components/scenes/AudioPickScene.tsx` with:

```tsx
'use client';

import { useMemo } from 'react';
import { sampleDistractors, shuffle } from '@/lib/scenes/sample';
import { useSpeak } from '@/lib/hooks/useSpeak';
import { MultipleChoiceQuiz } from './MultipleChoiceQuiz';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
}

interface Props {
  target: CharacterDetail;
  pool: CharacterDetail[];
  onComplete: (correct: boolean) => void;
  hintRequested?: boolean;
}

export function AudioPickScene({ target, pool, onComplete, hintRequested }: Props) {
  const speak = useSpeak();

  const choices = useMemo(() => {
    const distractors = sampleDistractors(
      pool,
      target,
      3,
      (a, b) => a.characterId === b.characterId,
    );
    return shuffle([target, ...distractors]).map((c) => ({
      key: c.characterId,
      label: <span className="text-5xl">{c.hanzi}</span>,
      isCorrect: c.characterId === target.characterId,
    }));
  }, [pool, target]);

  return (
    <MultipleChoiceQuiz
      prompt="听一听，选出对的字"
      stimulus={
        <button
          type="button"
          onClick={() => speak(target.hanzi)}
          className="flex h-32 w-32 items-center justify-center rounded-full bg-sky-200 text-5xl shadow-lg transition-transform active:scale-95 hover:bg-sky-300"
          aria-label="Play audio"
        >
          🔊
        </button>
      }
      choices={choices}
      onComplete={onComplete}
      hintRequested={hintRequested}
    />
  );
}
```

The diff: deleted the inline `speak()` function (lines 20–27), added `import { useSpeak } from '@/lib/hooks/useSpeak';`, and added `const speak = useSpeak();` inside the component.

- [ ] **Step 6.4: Run test to verify it still passes**

Run: `pnpm vitest run tests/unit/components/scenes/AudioPickScene.test.tsx`
Expected: PASS — 1 test passes (same behavior, refactored).

- [ ] **Step 6.5: Commit**

```bash
git add src/components/scenes/AudioPickScene.tsx tests/unit/components/scenes/AudioPickScene.test.tsx
git commit -m "refactor(pr50): AudioPickScene uses useSpeak (fixes detection bug)"
```

---

## Task 7: Add `SpeakButton` to `TranslatePickScene` (cn_to_en only)

**Files:**
- Modify: `src/components/scenes/TranslatePickScene.tsx`
- Create: `tests/unit/components/scenes/TranslatePickScene.test.tsx`

- [ ] **Step 7.1: Write failing tests**

Create `tests/unit/components/scenes/TranslatePickScene.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranslatePickScene } from '@/components/scenes/TranslatePickScene';

describe('TranslatePickScene', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis,
    });
  });

  const target = { characterId: 't', hanzi: '妈', meaningEn: 'mother' };
  const pool = [
    target,
    { characterId: 'd1', hanzi: '爸', meaningEn: 'father' },
    { characterId: 'd2', hanzi: '哥', meaningEn: 'older brother' },
    { characterId: 'd3', hanzi: '姐', meaningEn: 'older sister' },
  ];

  it('renders a SpeakButton next to the hanzi stimulus in cn_to_en direction', () => {
    render(
      <TranslatePickScene
        target={target}
        pool={pool}
        direction="cn_to_en"
        onComplete={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /read aloud/i })).toBeInTheDocument();
  });

  it('does NOT render a SpeakButton in en_to_cn direction (would reveal answer)', () => {
    render(
      <TranslatePickScene
        target={target}
        pool={pool}
        direction="en_to_cn"
        onComplete={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: /read aloud/i })).toBeNull();
  });
});
```

- [ ] **Step 7.2: Run test to verify failure**

Run: `pnpm vitest run tests/unit/components/scenes/TranslatePickScene.test.tsx`
Expected: FAIL — first test fails (no SpeakButton present).

- [ ] **Step 7.3: Add SpeakButton to the stimulus**

In `src/components/scenes/TranslatePickScene.tsx`:
1. Add import: `import { SpeakButton } from '@/components/play/SpeakButton';`
2. Replace the `cn_to_en` branch of the `stimulus` ternary (lines 48–52) with a wrapper that includes the SpeakButton:

```tsx
  const stimulus =
    direction === 'cn_to_en' ? (
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-amber-100 text-7xl font-bold text-amber-900 shadow-lg">
          {target.hanzi}
        </div>
        <SpeakButton text={target.hanzi} size="sm" label={`Play sound for ${target.hanzi}`} />
      </div>
    ) : (
      <div className="flex h-32 items-center justify-center rounded-2xl bg-amber-100 px-8 text-3xl font-bold text-amber-900 shadow-lg">
        {target.meaningEn ?? '?'}
      </div>
    );
```

- [ ] **Step 7.4: Run test to verify passes**

Run: `pnpm vitest run tests/unit/components/scenes/TranslatePickScene.test.tsx`
Expected: PASS — both tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add src/components/scenes/TranslatePickScene.tsx tests/unit/components/scenes/TranslatePickScene.test.tsx
git commit -m "feat(pr50): SpeakButton on TranslatePickScene cn_to_en stimulus"
```

---

## Task 8: Update spec to reflect corrected scope

**Files:**
- Modify: `docs/superpowers/specs/2026-05-31-pr50-scene-voice-tts-design.md`

- [ ] **Step 8.1: Correct §4.3 (per-scene integration table)**

Open `docs/superpowers/specs/2026-05-31-pr50-scene-voice-tts-design.md`. Replace the §4.3 table with:

```markdown
| Scene | 🔊 placement | Text spoken |
|---|---|---|
| `FlashcardScene` | Big hanzi tap-target + revealed pinyin row (refactor to shared hook) | target hanzi |
| `AudioPickScene` | Existing central 🔊 CTA (refactor to shared hook) | target hanzi |
| `TranslatePickScene` (direction `cn_to_en`) | SpeakButton (sm) next to hanzi stimulus | target hanzi |
| `TranslatePickScene` (direction `en_to_cn`) | — | (skip; choices are hanzi → would reveal answer) |
| `ImagePickScene` | — | (v2 — choices are hanzi → speaking stimulus reveals answer) |
| `VisualPickScene` | — | (v2 — choices are pinyin = the sound → speaking stimulus reveals answer) |
| `SentenceClozeScene` | — | (v2 — stem-with-blank is awkward to speak) |
| `ImageWordScene` | — | (v2) |
| `WordMatchScene` | — | (v2 — would reveal pairing) |
| `BossScene` | inherits from child scene | n/a |
```

- [ ] **Step 8.2: Add a new entry to §10 (Open questions / v2 candidates)**

Append to §10:

```markdown
- **ImagePick + VisualPick audio:** spec v1 over-scoped these. Their stimulus is the target hanzi (or its visual representation) and their choices ARE the answer surface (hanzi or pinyin). Speaking the stimulus tells the kid the answer. Defer to v2 with a post-reveal pattern (button appears only after the correct choice is locked in), same shape as the cloze/image-word v2.
```

- [ ] **Step 8.3: Correct §12 effort estimate**

Replace §12 first bullet:

```markdown
- ~10 implementation tasks (1 hook + 1 hook + 1 component + 4 scene/Story refactors + 1 spec correction + 1 CLAUDE.md update + 1 verify)
```

- [ ] **Step 8.4: Commit**

```bash
git add docs/superpowers/specs/2026-05-31-pr50-scene-voice-tts-design.md
git commit -m "docs(pr50): correct spec scope (drop ImagePick/VisualPick)"
```

---

## Task 9: Update `CLAUDE.md` (Current state + landmines)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 9.1: Update the "last refreshed" date**

In `CLAUDE.md`, find the line near the top:

```markdown
## Current state (last refreshed 2026-05-30)
```

Replace `2026-05-30` with `2026-05-31`.

- [ ] **Step 9.2: Add PR #50 entry to Current state**

After the PR #48 paragraph in the "Current state" section, append:

```markdown
- **PR #50 (shipped 2026-05-31)** — Scene voice/TTS. Three shared client primitives — `useSpeechSupported` hook, `useSpeak` hook (cancels in-flight + builds zh-CN utterance at rate 0.85), `SpeakButton` component (sm icon / md labeled variants). FlashcardScene + AudioPickScene refactored to use `useSpeak` (drops their inline `speak()` helpers + fixes the PR #48 `'speechSynthesis' in window` detection bug). New: `<SpeakButton size="sm">` next to the hanzi stimulus on TranslatePickScene `cn_to_en`. Story Mode `ChapterAudioButton` (PR #48) refactored to wrap `SpeakButton` — Story Mode + scenes now share one TTS codepath. ImagePickScene + VisualPickScene deferred to v2 (their stimulus is the answer surface — speaking would reveal it). No DB migration, no recompile. +N tests.
```

(Fill in `+N tests` with the actual delta after the final verification step.)

- [ ] **Step 9.3: Add landmine entry**

In the "Landmines" section of `CLAUDE.md`, append:

```markdown
- **Speaking the hanzi stimulus reveals the answer in any scene whose choices are pinyin or hanzi.** PR #50 (Voice/TTS) deferred ImagePickScene + VisualPickScene for this reason: their stimulus is the target hanzi (or imageHook) and their choices are the matching hanzi/pinyin themselves. Adding a 🔊 on the stimulus tells the kid the answer. The general rule: TTS on the stimulus is only safe when the choices are a DIFFERENT modality (e.g. choices are English meanings, image hooks, or unrelated hanzi where the sound doesn't disambiguate). When in doubt, the safe pattern for these scenes is post-reveal audio — render `<SpeakButton>` only after the correct choice has been locked in. Implementing post-reveal audio is a v2 candidate.
- **`useSpeechSupported` and `useSpeak` are client-only hooks.** Both live in `src/lib/hooks/` and use React 19 `useSyncExternalStore` (the canonical SSR-safe detection pattern, same as PR #48's `ChapterAudioButton`). Do not import them from a server component — they will throw at request time. They are safely consumed by `SpeakButton` (which is `'use client'`) and by client components like the refactored scenes.
- **`SpeakButton` size variants are not interchangeable.** `size="sm"` is the inline icon-only chip that goes next to a hanzi stimulus (44×44 tap target — preserve this for thumbs). `size="md"` is the labeled CTA used by Story Mode chapter pages and the AudioPickScene central button (the visible "Read aloud" / "Play sound" label is part of the affordance). Swapping them silently changes the visual + label rendering.
```

- [ ] **Step 9.4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): record PR #50 (Scene voice/TTS) + landmines"
```

---

## Task 10: Verify + open PR

- [ ] **Step 10.1: Run the four-green gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all 4 green. If any fail, fix inline before continuing — do NOT push.

- [ ] **Step 10.2: Count new tests**

Run: `pnpm vitest run --reporter=basic 2>&1 | tail -5`
Note the total test count. Compare to baseline 590 (post-PR-#48). Net new should be ~12–15 (3 hook tests + 6 SpeakButton tests + 1 AudioPick + 2 TranslatePick + 1 new Flashcard speech test).

- [ ] **Step 10.3: Backfill the test count in CLAUDE.md**

In the PR #50 entry added in Step 9.2, replace `+N tests` with the actual delta (e.g. `+13 tests, 603 total`).

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): backfill PR #50 test count"
```

- [ ] **Step 10.4: Manual dev smoke**

Run: `pnpm dev`
1. Log in as a test parent → open `/play/<childId>`.
2. Enter a week's `review` section → hit a flashcard scene → tap the big hanzi → expect zh-CN speech.
3. Reveal pinyin → tap pinyin → expect speech.
4. Enter a `practice` section → wait for an audio_pick scene → tap the 🔊 circle → expect speech.
5. Wait for a translate_pick `cn_to_en` scene → tap the small 🔊 chip below the hanzi → expect speech.
6. Wait for a translate_pick `en_to_cn` scene → confirm NO 🔊 button is present.
7. Open a story chapter via the home pill → confirm the existing "Read aloud" button still works (Story Mode regression check).

Document in the PR description any surface you couldn't exercise (e.g. no `audio_pick` scene scheduled this week).

- [ ] **Step 10.5: Push branch + open PR**

```bash
git push -u origin feat/pr50-scene-tts
gh pr create --title "feat(pr50): Scene voice/TTS — zh-CN pronunciation buttons" --body "$(cat <<'EOF'
## Summary

- **Three shared primitives:** `useSpeechSupported` hook, `useSpeak` hook, `SpeakButton` component. SSR-safe Web Speech detection via `useSyncExternalStore`; cancels in-flight speech before every speak; lang=zh-CN; rate=0.85.
- **FlashcardScene + AudioPickScene refactored** to use `useSpeak` — drops their inline `speak()` helpers and fixes the PR #48 `'speechSynthesis' in window` detection bug.
- **TranslatePickScene `cn_to_en`** gets a new `<SpeakButton size="sm">` next to the hanzi stimulus.
- **Story Mode `ChapterAudioButton`** (PR #48) refactors to wrap `SpeakButton`. Same external API; same `getByRole('button', { name: /read aloud/i })` works.
- **ImagePickScene + VisualPickScene deferred to v2** — their stimulus IS the answer surface, so speaking reveals the answer. Documented as a landmine + v2 candidate.

## Architecture

- No DB, no migration, no server, no recompile. Pure render-layer change.
- Yinuo is English-native — this is one of the most important learning surfaces in the game.
- ~10 files touched, ~13 new tests.

## Test plan

- [ ] Tap big hanzi on a flashcard → hear zh-CN
- [ ] Reveal + tap pinyin → hear zh-CN
- [ ] Tap 🔊 on AudioPick → hear zh-CN
- [ ] Tap 🔊 on TranslatePick cn_to_en stimulus → hear zh-CN
- [ ] Confirm NO 🔊 on TranslatePick en_to_cn (would reveal)
- [ ] Confirm NO 🔊 on ImagePick / VisualPick (deferred to v2)
- [ ] Story chapter page "Read aloud" still works (regression)
- [ ] Lighthouse / prefers-reduced-motion no regression

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Share with David.

---

## Self-review (controller checklist)

Spec coverage — every spec requirement maps to a task:

| Spec §  | Requirement | Task |
|---|---|---|
| §4.1 | `useSpeechSupported` hook | Task 1 |
| §4.1 | `SpeakButton` component (sm/md, label prop, null on unsupported) | Task 3 |
| §4.2 | `ChapterAudioButton` thin-wrapper refactor | Task 4 |
| §4.2 | `AudioPickScene` inline-helper removal + bug fix | Task 6 |
| §4.3 | FlashcardScene integration | Task 5 (corrected scope: hanzi + pinyin, no example rows) |
| §4.3 | AudioPickScene integration | Task 6 |
| §4.3 | TranslatePickScene cn_to_en integration | Task 7 |
| §4.3 | TranslatePickScene en_to_cn skip | Task 7 (test asserts no SpeakButton) |
| §4.3 | ImagePickScene / VisualPickScene | Task 8 (moved to v2 with rationale) |
| §5 | sm = ≥44px tap target | Task 3 (h-11 w-11 → 44×44) |
| §5 | aria-label always present | Task 3 (default + override tested) |
| §5 | cancel-before-speak | Task 2 (test asserts call order) |
| §7 | API unavailable → null | Task 3 (test) |
| §7 | speak throws → log + don't crash | Task 2 (try/catch in implementation) |
| §8 | tests enumerated | Tasks 1, 2, 3, 5, 6, 7 |
| §11 | Don't pull hook into server component | Task 9 (landmine) |
| §11 | SpeakButton client-only | Task 3 (`'use client'`) |
| §11 | Detection uses `!= null` | Task 1 (implementation) |
| §11 | Cancel before speak | Task 2 (implementation) |

Placeholder scan: none — every step has full code or full commands.

Type consistency: `useSpeak(): (text: string) => void`, `useSpeechSupported(): boolean`, `SpeakButtonProps { text, size?, label?, className? }` — used consistently across Tasks 1–9.

Plan is internally consistent and ready for execution.
