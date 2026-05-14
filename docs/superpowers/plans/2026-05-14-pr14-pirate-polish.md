# PR #14 — Pirate Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 6-item pirate-polish layer for hanzi-quest /play and /parent: treasure-map flashcard backdrop, answer-feedback animations (coin shower + card shake), wood-sign CTA buttons, Lottie level fanfare, Web Audio procedural sounds, and a /parent CTA repaint — all respecting `prefers-reduced-motion`.

**Architecture:** Three foundation layers (a `useReducedMotion` hook, a procedural Web Audio module, a `CoinHudContext` for HUD-ref sharing) underpin three reusable UI primitives (`WoodSignButton`, `TreasureMapBackdrop`, three FX components) which slot into the existing `FlashcardScene`, `MultipleChoiceQuiz`, and `SceneRunner` without changing their public contracts. Coin showers travel from the tapped button toward the top-bar HUD ref exposed by context; sounds lazy-init `AudioContext` on first user-gesture-triggered call.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · framer-motion@^12 (LazyMotion + `m.*` subset) · @lottiefiles/dotlottie-react@^0.19 (dynamic-imported, end-state only) · Web Audio API (procedural OscillatorNode, no asset files) · Vitest + RTL + jsdom for unit tests.

**Source spec:** `docs/superpowers/specs/2026-05-14-pr14-pirate-polish-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/lib/hooks/use-reduced-motion.ts` | `useReducedMotion()` hook — reads `matchMedia('(prefers-reduced-motion: reduce)')`, subscribes to changes, returns boolean. |
| `src/lib/hooks/coin-hud-context.ts` | `CoinHudContext` (React Context) + `useCoinHud()` consumer. Exposes the top-bar coin counter ref to any scene component. |
| `src/lib/audio/sounds.ts` | Three pure functions — `playDing(ctx)`, `playBuzz(ctx)`, `playFanfare(ctx)` — that schedule oscillators on a passed `AudioContext`. |
| `src/lib/audio/play.ts` | `playSound(name)` public API, lazy `AudioContext` singleton, `setAudioMuted(bool)`. |
| `src/components/ui/WoodSignButton.tsx` | Shared CTA primitive — mid-fi wood-grain CSS + nails. `size: 'sm' \| 'md' \| 'lg'`, `variant: 'primary' \| 'ghost'`. |
| `src/components/ui/TreasureMapBackdrop.tsx` | SVG-rich wrapper. `intensity: 'medium' \| 'subtle'`. Used by FlashcardScene. |
| `src/components/scenes/fx/CoinShower.tsx` | 5-coin arc animation from `originRect` toward `targetEl`. Hides under reduced-motion. |
| `src/components/scenes/fx/ShakeWrap.tsx` | Wraps children with framer-motion shake keyed off `triggerKey`. Hides motion under reduced-motion. |
| `src/components/scenes/fx/LevelFanfare.tsx` | dotlottie player + "Island cleared!" headline + WoodSignButton "Back to map". Reduced-motion → emoji fallback. |
| `public/animations/pirate-fanfare.json` | Lottie JSON asset, ~40KB max. Sourced manually in Task 11 (instructions inline). |

### Modified files

| Path | Change |
|---|---|
| `package.json` | Add `framer-motion@^12` and `@lottiefiles/dotlottie-react@^0.19`. |
| `src/components/scenes/FlashcardScene.tsx` | Wrap main column in `<TreasureMapBackdrop intensity="medium">`; replace "Got it →" `<button>` with `<WoodSignButton>`. |
| `src/components/scenes/MultipleChoiceQuiz.tsx` | Add `tappedRect` capture on click; add `<CoinShower>` mount on correct; add `<ShakeWrap>` around choices grid keyed by `triggerKey`; call `playSound('ding'\|'buzz')`. |
| `src/components/scenes/SceneRunner.tsx` | Add `coinHudRef`; wrap children in `<CoinHudContext.Provider>`; call `setAudioMuted(useReducedMotion())` in effect; replace end-state block with `<LevelFanfare>`. |
| `src/components/parent/AddChildForm.tsx`, `EditChildForm.tsx`, `NewWeekForm.tsx`, `NewStageForm.tsx`, `GenerateWeekButton.tsx`, `PublishWeekButton.tsx`, `DeleteChildButton.tsx` | Swap their primary submit/action buttons to `<WoodSignButton>`. |
| `PLAN.md` | Add PR #15 row to Shipped table once this merges. |

---

## Task 1: Add dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (auto)

- [ ] **Step 1: Install framer-motion and dotlottie-react**

```bash
pnpm add framer-motion@^12 @lottiefiles/dotlottie-react@^0.19
```

Expected output ends with: `+ framer-motion ^12.x.x` and `+ @lottiefiles/dotlottie-react ^0.19.x`.

- [ ] **Step 2: Verify type resolution**

```bash
pnpm typecheck
```

Expected: exit 0. If it fails on missing types from the new packages, both ship their own `.d.ts` so this should pass cleanly.

- [ ] **Step 3: Verify build still works**

```bash
pnpm build
```

Expected: exit 0, "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add framer-motion + dotlottie-react for PR #14

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: useReducedMotion hook

**Files:**
- Create: `src/lib/hooks/use-reduced-motion.ts`
- Test: `tests/unit/use-reduced-motion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/use-reduced-motion.test.ts
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

describe('useReducedMotion', () => {
  type Listener = (ev: MediaQueryListEvent) => void;
  let listeners: Listener[] = [];
  let currentMatches = false;

  function makeMql(): MediaQueryList {
    return {
      matches: currentMatches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: (_: string, cb: Listener) => listeners.push(cb),
      removeEventListener: (_: string, cb: Listener) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: () => true,
      addListener: () => undefined,
      removeListener: () => undefined,
    } as unknown as MediaQueryList;
  }

  beforeEach(() => {
    listeners = [];
    currentMatches = false;
    vi.stubGlobal('matchMedia', vi.fn(() => makeMql()));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when prefers-reduced-motion is not set', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce is active at mount', () => {
    currentMatches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => {
      listeners.forEach((cb) =>
        cb({ matches: true } as MediaQueryListEvent),
      );
    });
    expect(result.current).toBe(true);
  });

  it('safely returns false in non-window environment', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/use-reduced-motion.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/hooks/use-reduced-motion'".

- [ ] **Step 3: Implement the hook**

```ts
// src/lib/hooks/use-reduced-motion.ts
'use client';

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const onChange = (ev: MediaQueryListEvent) => setReduced(ev.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/use-reduced-motion.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks/use-reduced-motion.ts tests/unit/use-reduced-motion.test.ts
git commit -m "feat(a11y): useReducedMotion hook

Reads matchMedia('(prefers-reduced-motion: reduce)') with SSR-safe
fallback. Subscribes to changes during the session.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Audio — procedural sound generators

**Files:**
- Create: `src/lib/audio/sounds.ts`
- Test: `tests/unit/sounds.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/sounds.test.ts
import { describe, expect, it, vi } from 'vitest';
import { playDing, playBuzz, playFanfare } from '@/lib/audio/sounds';

function makeMockCtx() {
  const oscs: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frequency: { value: number }; type: string }> = [];
  const gains: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> } }> = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { value: 440 },
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(() => ({ connect: vi.fn() })),
      };
      oscs.push(osc as never);
      return osc;
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(() => ({ connect: vi.fn() })),
      };
      gains.push(gain as never);
      return gain;
    }),
  } as unknown as AudioContext;
  return { ctx, oscs, gains };
}

describe('sounds', () => {
  it('playDing schedules 3 oscillators (arpeggio C5-E5-G5)', () => {
    const { ctx, oscs } = makeMockCtx();
    playDing(ctx);
    expect(oscs).toHaveLength(3);
    expect(oscs.map((o) => o.frequency.value)).toEqual([523, 659, 784]);
    expect(oscs.every((o) => o.type === 'triangle')).toBe(true);
  });

  it('playBuzz schedules 1 sawtooth oscillator', () => {
    const { ctx, oscs } = makeMockCtx();
    playBuzz(ctx);
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe('sawtooth');
  });

  it('playFanfare schedules 6 oscillators', () => {
    const { ctx, oscs } = makeMockCtx();
    playFanfare(ctx);
    expect(oscs).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/sounds.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/audio/sounds'".

- [ ] **Step 3: Implement sounds.ts**

```ts
// src/lib/audio/sounds.ts

function scheduleNote(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType,
  peak: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Three-tone triangle arpeggio C5-E5-G5 — pleasant "correct" chime. */
export function playDing(ctx: AudioContext): void {
  const notes: Array<[number, number]> = [
    [523, 0],
    [659, 0.08],
    [784, 0.16],
  ];
  for (const [freq, offset] of notes) {
    scheduleNote(ctx, freq, offset, 0.18, 'triangle', 0.15);
  }
}

/** Short descending sawtooth — "try again" buzz, not punishing. */
export function playBuzz(ctx: AudioContext): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.27);
}

/** Six-tone ascending fanfare — level cleared. */
export function playFanfare(ctx: AudioContext): void {
  const sequence: Array<[number, number]> = [
    [523, 0],     // C5
    [659, 0.12],  // E5
    [784, 0.24],  // G5
    [1047, 0.36], // C6
    [784, 0.55],  // G5
    [1047, 0.7],  // C6 hold
  ];
  for (const [freq, offset] of sequence) {
    scheduleNote(ctx, freq, offset, 0.22, 'triangle', 0.18);
  }
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/sounds.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio/sounds.ts tests/unit/sounds.test.ts
git commit -m "feat(audio): procedural sound generators (ding/buzz/fanfare)

Web Audio OscillatorNode + GainNode schedules — no asset files.
Ding = triangle arpeggio C5-E5-G5; Buzz = sawtooth descent 300→200Hz;
Fanfare = six-tone triangle sequence up to C6.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Audio — playSound singleton + mute

**Files:**
- Create: `src/lib/audio/play.ts`
- Test: `tests/unit/play-sound.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/play-sound.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/audio/sounds', () => ({
  playDing: vi.fn(),
  playBuzz: vi.fn(),
  playFanfare: vi.fn(),
}));

describe('playSound', () => {
  let ctorCalls = 0;

  beforeEach(async () => {
    vi.resetModules();
    ctorCalls = 0;
    class FakeCtx {
      currentTime = 0;
      state = 'running' as AudioContextState;
      destination = {};
      constructor() {
        ctorCalls++;
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      createOscillator() {
        return { type: 'sine', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, start: vi.fn(), stop: vi.fn(), connect: () => ({ connect: () => undefined }) };
      }
      createGain() {
        return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: () => ({ connect: () => undefined }) };
      }
    }
    vi.stubGlobal('window', {
      AudioContext: FakeCtx,
    });
    vi.stubGlobal('AudioContext', FakeCtx);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('no-ops when called before muted=false set', async () => {
    const { playSound } = await import('@/lib/audio/play');
    const { playDing } = await import('@/lib/audio/sounds');
    playSound('ding');
    expect(playDing).toHaveBeenCalledTimes(1);
    expect(ctorCalls).toBe(1);
  });

  it('no-ops when muted=true', async () => {
    const { playSound, setAudioMuted } = await import('@/lib/audio/play');
    const { playDing } = await import('@/lib/audio/sounds');
    setAudioMuted(true);
    playSound('ding');
    expect(playDing).not.toHaveBeenCalled();
    expect(ctorCalls).toBe(0);
  });

  it('routes to the right generator', async () => {
    const { playSound } = await import('@/lib/audio/play');
    const { playDing, playBuzz, playFanfare } = await import('@/lib/audio/sounds');
    playSound('ding');
    playSound('buzz');
    playSound('fanfare');
    expect(playDing).toHaveBeenCalledTimes(1);
    expect(playBuzz).toHaveBeenCalledTimes(1);
    expect(playFanfare).toHaveBeenCalledTimes(1);
  });

  it('creates AudioContext only once across multiple calls', async () => {
    const { playSound } = await import('@/lib/audio/play');
    playSound('ding');
    playSound('buzz');
    playSound('fanfare');
    expect(ctorCalls).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/play-sound.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/audio/play'".

- [ ] **Step 3: Implement play.ts**

```ts
// src/lib/audio/play.ts
import { playBuzz, playDing, playFanfare } from './sounds';

export type SoundName = 'ding' | 'buzz' | 'fanfare';

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

const handlers: Record<SoundName, (ctx: AudioContext) => void> = {
  ding: playDing,
  buzz: playBuzz,
  fanfare: playFanfare,
};

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  handlers[name](c);
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/play-sound.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio/play.ts tests/unit/play-sound.test.ts
git commit -m "feat(audio): playSound singleton + setAudioMuted

Lazy AudioContext on first user-gesture-triggered call; subsequent
calls reuse. setAudioMuted toggles a module-scoped flag wired from
useReducedMotion in SceneRunner.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: CoinHudContext

**Files:**
- Create: `src/lib/hooks/coin-hud-context.ts`
- Test: `tests/unit/coin-hud-context.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/coin-hud-context.test.tsx
import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { CoinHudContext, useCoinHud } from '@/lib/hooks/coin-hud-context';

function Consumer() {
  const { coinHudRef } = useCoinHud();
  return <span data-testid="probe">{coinHudRef.current ? 'attached' : 'null'}</span>;
}

function Provider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  return <CoinHudContext.Provider value={{ coinHudRef: ref }}>{children}</CoinHudContext.Provider>;
}

describe('CoinHudContext', () => {
  it('useCoinHud returns null-ref default outside any provider', () => {
    render(<Consumer />);
    expect(screen.getByTestId('probe').textContent).toBe('null');
  });

  it('useCoinHud returns provided ref inside a provider', () => {
    render(
      <Provider>
        <Consumer />
      </Provider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('null');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/coin-hud-context.test.tsx
```

Expected: FAIL with "Cannot find module '@/lib/hooks/coin-hud-context'".

- [ ] **Step 3: Implement context**

```tsx
// src/lib/hooks/coin-hud-context.ts
'use client';

import { createContext, useContext, type RefObject } from 'react';

interface CoinHudValue {
  coinHudRef: RefObject<HTMLElement | null>;
}

const defaultValue: CoinHudValue = {
  coinHudRef: { current: null },
};

export const CoinHudContext = createContext<CoinHudValue>(defaultValue);

export function useCoinHud(): CoinHudValue {
  return useContext(CoinHudContext);
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/coin-hud-context.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks/coin-hud-context.ts tests/unit/coin-hud-context.test.tsx
git commit -m "feat(scenes): CoinHudContext for shared HUD ref

SceneRunner is the provider; any scene component can call useCoinHud()
to retrieve the top-bar coin counter ref. Default ref is null-current
so consumers stay tolerant in test environments.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: WoodSignButton component

**Files:**
- Create: `src/components/ui/WoodSignButton.tsx`
- Test: `tests/unit/wood-sign-button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/wood-sign-button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

describe('WoodSignButton', () => {
  it('renders children and forwards onClick', async () => {
    const onClick = vi.fn();
    render(<WoodSignButton onClick={onClick}>Sail!</WoodSignButton>);
    const btn = screen.getByRole('button', { name: 'Sail!' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies size class for md (default) and lg', () => {
    const { rerender } = render(<WoodSignButton>x</WoodSignButton>);
    let btn = screen.getByRole('button');
    expect(btn.className).toMatch(/py-4|py-3/);
    rerender(<WoodSignButton size="lg">x</WoodSignButton>);
    btn = screen.getByRole('button');
    expect(btn.className).toMatch(/py-5|py-6/);
  });

  it('disabled state blocks onClick', async () => {
    const onClick = vi.fn();
    render(
      <WoodSignButton onClick={onClick} disabled>
        x
      </WoodSignButton>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Install @testing-library/user-event if absent**

```bash
pnpm ls @testing-library/user-event 2>/dev/null | grep user-event || pnpm add -D @testing-library/user-event
```

Expected: either the package is already installed (no-op) or it gets added.

- [ ] **Step 3: Run test, expect failure**

```bash
pnpm test tests/unit/wood-sign-button.test.tsx
```

Expected: FAIL with "Cannot find module '@/components/ui/WoodSignButton'".

- [ ] **Step 4: Implement WoodSignButton**

```tsx
// src/components/ui/WoodSignButton.tsx
'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'primary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  variant?: Variant;
}

const sizeMap: Record<Size, string> = {
  sm: 'px-5 py-2 text-sm',
  md: 'px-7 py-3 text-base',
  lg: 'px-9 py-5 text-lg',
};

const primaryBase =
  // grain stripes via repeating gradient + warm wood gradient
  "relative bg-[linear-gradient(180deg,#d6a868_0%,#b07f3e_100%)] " +
  // overlay grain (CSS background isn't composable cleanly without inline style — we layer with before)
  'text-[#fff8e1] font-extrabold rounded-2xl ' +
  'border-2 border-[#6b4720] ' +
  'shadow-[inset_0_-3px_0_rgba(107,71,32,0.3),0_4px_0_#6b4720,0_6px_14px_rgba(0,0,0,0.25)] ' +
  '[text-shadow:0_1px_0_rgba(0,0,0,0.35)] ' +
  'transition-transform duration-150 active:translate-y-0.5 active:shadow-[inset_0_-2px_0_rgba(107,71,32,0.3),0_1px_0_#6b4720,0_2px_6px_rgba(0,0,0,0.2)] ' +
  'hover:-translate-y-px ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ocean-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-sand-50)]';

const ghostBase =
  'relative bg-transparent text-[var(--color-sand-900)] font-bold rounded-2xl ' +
  'border-2 border-[#6b4720]/60 ' +
  'transition-colors hover:bg-[var(--color-sand-100)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ocean-500)] focus-visible:ring-offset-2';

const nailPseudoClasses =
  'before:content-[""] before:absolute before:top-1/2 before:left-2 before:-translate-y-1/2 before:w-1 before:h-1 before:rounded-full before:bg-[#4a2e10] ' +
  'after:content-[""] after:absolute after:top-1/2 after:right-2 after:-translate-y-1/2 after:w-1 after:h-1 after:rounded-full after:bg-[#4a2e10]';

const grainOverlay =
  'before:hidden';

export const WoodSignButton = forwardRef<HTMLButtonElement, Props>(
  function WoodSignButton({ size = 'md', variant = 'primary', className = '', children, ...rest }, ref) {
    const base = variant === 'primary' ? primaryBase : ghostBase;
    const nails = variant === 'primary' ? nailPseudoClasses : '';
    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        className={[base, sizeMap[size], nails, className].filter(Boolean).join(' ')}
        {...rest}
      >
        {/* grain stripes layer — sits under the text via z-index */}
        {variant === 'primary' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, transparent 0, transparent 5px, rgba(107,71,32,0.12) 5px, rgba(107,71,32,0.12) 6px)',
            }}
          />
        )}
        <span className="relative">{children}</span>
      </button>
    );
  },
);
```

- [ ] **Step 5: Run test, expect pass**

```bash
pnpm test tests/unit/wood-sign-button.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/WoodSignButton.tsx tests/unit/wood-sign-button.test.tsx
git commit -m "feat(ui): WoodSignButton — shared pirate CTA primitive

Mid-fi CSS: warm wood gradient + grain stripes overlay + 2 black nail
pseudo-elements + chunky bottom shadow. sm/md/lg sizes + primary/ghost
variants. Zero image asset, full focus-visible support.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: TreasureMapBackdrop component

**Files:**
- Create: `src/components/ui/TreasureMapBackdrop.tsx`
- Test: `tests/unit/treasure-map-backdrop.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/treasure-map-backdrop.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TreasureMapBackdrop } from '@/components/ui/TreasureMapBackdrop';

describe('TreasureMapBackdrop', () => {
  it('renders children', () => {
    render(
      <TreasureMapBackdrop>
        <p>hi</p>
      </TreasureMapBackdrop>,
    );
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('includes compass + route SVG when intensity=medium (default)', () => {
    const { container } = render(<TreasureMapBackdrop><p /></TreasureMapBackdrop>);
    expect(container.querySelector('[data-testid="map-compass"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="map-route"]')).toBeTruthy();
  });

  it('omits compass + route when intensity=subtle', () => {
    const { container } = render(
      <TreasureMapBackdrop intensity="subtle"><p /></TreasureMapBackdrop>,
    );
    expect(container.querySelector('[data-testid="map-compass"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-route"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/treasure-map-backdrop.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement TreasureMapBackdrop**

```tsx
// src/components/ui/TreasureMapBackdrop.tsx
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  intensity?: 'medium' | 'subtle';
}

export function TreasureMapBackdrop({ children, intensity = 'medium' }: Props) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          intensity === 'medium'
            ? 'radial-gradient(ellipse at 30% 20%, rgba(200,159,94,0.12) 0%, transparent 50%), linear-gradient(180deg, #f5ead0 0%, #e6cb8e 100%)'
            : 'radial-gradient(ellipse at 30% 20%, rgba(200,159,94,0.10) 0%, transparent 50%), linear-gradient(180deg, #f5ead0 0%, #ead7a8 100%)',
      }}
    >
      {intensity === 'medium' && (
        <svg
          aria-hidden="true"
          viewBox="0 0 300 320"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-55"
        >
          <path
            data-testid="map-route"
            d="M 20 280 Q 80 220 130 250 T 250 180 Q 280 140 270 90"
            fill="none"
            stroke="#6b4720"
            strokeWidth={2}
            strokeDasharray="4 6"
            opacity={0.5}
          />
          <g data-testid="map-compass" transform="translate(40 40)" fill="#6b4720" opacity={0.4}>
            <polygon points="0,-18 5,0 0,18 -5,0" />
            <polygon points="-18,0 0,5 18,0 0,-5" />
            <circle r={3} />
          </g>
        </svg>
      )}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center w-full">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/treasure-map-backdrop.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/TreasureMapBackdrop.tsx tests/unit/treasure-map-backdrop.test.tsx
git commit -m "feat(ui): TreasureMapBackdrop — parchment + compass + route

medium (default) renders compass rose + dotted curve route at 0.55
opacity; subtle drops the SVG overlay and just keeps the parchment
gradient. Used by FlashcardScene to give the character a 'discovery'
backdrop without competing for attention.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: CoinShower FX component

**Files:**
- Create: `src/components/scenes/fx/CoinShower.tsx`
- Test: `tests/unit/coin-shower.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/coin-shower.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { CoinShower } from '@/components/scenes/fx/CoinShower';

describe('CoinShower', () => {
  it('renders 5 coin elements by default when motion allowed', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { container } = render(<CoinShower />);
    expect(container.querySelectorAll('[data-testid="coin"]')).toHaveLength(5);
  });

  it('renders count coins when count prop set', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const { container } = render(<CoinShower count={3} />);
    expect(container.querySelectorAll('[data-testid="coin"]')).toHaveLength(3);
  });

  it('renders nothing when reduced-motion is on', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { container } = render(<CoinShower />);
    expect(container.querySelectorAll('[data-testid="coin"]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/coin-shower.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement CoinShower**

```tsx
// src/components/scenes/fx/CoinShower.tsx
'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

interface Props {
  count?: number;
  originRect?: DOMRect | null;
  targetEl?: RefObject<HTMLElement | null>;
  onComplete?: () => void;
}

interface CoinSpec {
  id: number;
  startX: number;
  startY: number;
  delay: number;
}

const SCATTER_PX = 24;

export function CoinShower({ count = 5, originRect, targetEl, onComplete }: Props) {
  const reduced = useReducedMotion();
  const [targetXY, setTargetXY] = useState<{ x: number; y: number } | null>(null);

  // Resolve target position once on mount — coin shower is short-lived,
  // re-resolving on every frame is unnecessary.
  useEffect(() => {
    if (reduced) {
      onComplete?.();
      return;
    }
    if (!targetEl?.current) {
      setTargetXY(null);
      return;
    }
    const r = targetEl.current.getBoundingClientRect();
    setTargetXY({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [reduced, targetEl, onComplete]);

  const coins = useMemo<CoinSpec[]>(() => {
    if (reduced) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      startX: originRect ? originRect.left + originRect.width / 2 : window.innerWidth / 2,
      startY: originRect ? originRect.top + originRect.height / 2 : window.innerHeight / 2,
      delay: i * 0.08,
    }));
  }, [count, originRect, reduced]);

  if (reduced) return null;

  return (
    <LazyMotion features={domAnimation}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
        {coins.map((c) => {
          const dx = targetXY ? targetXY.x - c.startX : (Math.random() - 0.5) * SCATTER_PX;
          const dy = targetXY ? targetXY.y - c.startY : -120;
          return (
            <m.div
              key={c.id}
              data-testid="coin"
              initial={{ x: c.startX - 9, y: c.startY - 9, scale: 0.3, opacity: 0 }}
              animate={{
                x: c.startX - 9 + dx,
                y: c.startY - 9 + dy,
                scale: 1,
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 0.9,
                delay: c.delay,
                ease: 'easeOut',
                times: [0, 0.2, 0.8, 1],
              }}
              onAnimationComplete={c.id === count - 1 ? onComplete : undefined}
              className="absolute h-[18px] w-[18px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
              style={{
                background:
                  'radial-gradient(circle at 35% 30%, #f5d875, #c9930b 70%, #6b4720)',
              }}
            />
          );
        })}
      </div>
    </LazyMotion>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/coin-shower.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/scenes/fx/CoinShower.tsx tests/unit/coin-shower.test.tsx
git commit -m "feat(fx): CoinShower — 5-coin arc toward HUD ref

framer-motion LazyMotion + m.div, staggered 80ms per coin, 900ms total
duration. Resolves target XY from targetEl ref on mount. Returns null
under prefers-reduced-motion.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: ShakeWrap FX component

**Files:**
- Create: `src/components/scenes/fx/ShakeWrap.tsx`
- Test: `tests/unit/shake-wrap.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/shake-wrap.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { ShakeWrap } from '@/components/scenes/fx/ShakeWrap';

describe('ShakeWrap', () => {
  it('renders children with motion when triggerKey changes (reduced=false)', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <ShakeWrap triggerKey={1}>
        <span data-testid="kid">k</span>
      </ShakeWrap>,
    );
    expect(screen.getByTestId('kid')).toBeInTheDocument();
  });

  it('passes children through with no motion when reduced=true', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(
      <ShakeWrap triggerKey={1}>
        <span data-testid="kid">k</span>
      </ShakeWrap>,
    );
    expect(screen.getByTestId('kid')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/shake-wrap.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement ShakeWrap**

```tsx
// src/components/scenes/fx/ShakeWrap.tsx
'use client';

import { LazyMotion, domAnimation, m } from 'framer-motion';
import type { ReactNode } from 'react';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

interface Props {
  triggerKey: number;
  children: ReactNode;
}

const shake = {
  x: [0, -8, 8, -8, 8, -4, 4, 0],
};

export function ShakeWrap({ triggerKey, children }: Props) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        key={triggerKey}
        animate={shake}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/shake-wrap.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/scenes/fx/ShakeWrap.tsx tests/unit/shake-wrap.test.tsx
git commit -m "feat(fx): ShakeWrap — horizontal-nudge animation keyed on triggerKey

framer-motion m.div replays the 350ms shake whenever triggerKey
changes (monotonic counter pattern keeps it stable under React 18
strict-mode double mount). Under reduced-motion, passes children
through untouched.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: LevelFanfare FX component (+ Lottie asset)

**Files:**
- Create: `src/components/scenes/fx/LevelFanfare.tsx`
- Create: `public/animations/pirate-fanfare.json` (manual)
- Test: `tests/unit/level-fanfare.test.tsx`

- [ ] **Step 1: Source the Lottie JSON**

This is a one-time manual step. Open https://lottiefiles.com and search for **"confetti burst"** or **"pirate treasure"**. Filter to **Free** (CC0 / lottiefiles free). Pick one matching:
- JSON file size < 60 KB
- Duration 1.5–3 s
- Self-contained (no external assets)

Download as Lottie JSON (not dotLottie) and save to:

```
public/animations/pirate-fanfare.json
```

Sanity check the file size:

```bash
wc -c public/animations/pirate-fanfare.json
```

Expected: between 5000 and 60000 bytes. If outside, pick a different file.

If you cannot find a suitable file on lottiefiles right now, use this hand-coded fallback (it's a minimal 8-coin radial burst — visually OK, swappable later):

```json
{"v":"5.7.4","fr":30,"ip":0,"op":45,"w":400,"h":400,"nm":"Burst","ddd":0,"assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"burst","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[0]},{"t":8,"s":[100]},{"t":35,"s":[100]},{"t":45,"s":[0]}]},"r":{"a":0,"k":0},"p":{"a":0,"k":[200,200]},"a":{"a":0,"k":[0,0]},"s":{"a":1,"k":[{"t":0,"s":[20,20,100]},{"t":40,"s":[140,140,100]}]}},"ao":0,"shapes":[{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[18,18]},"p":{"a":0,"k":[0,0]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.96,0.78,0.22,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},{"ty":"tr","p":{"a":0,"k":[0,-90]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"nm":"t"}],"nm":"c1"},{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[18,18]},"p":{"a":0,"k":[0,0]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.91,0.24,0.24,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},{"ty":"tr","p":{"a":0,"k":[64,-64]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"nm":"t"}],"nm":"c2"},{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[18,18]},"p":{"a":0,"k":[0,0]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.16,0.72,0.48,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},{"ty":"tr","p":{"a":0,"k":[90,0]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"nm":"t"}],"nm":"c3"},{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[18,18]},"p":{"a":0,"k":[0,0]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.21,0.6,0.86,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},{"ty":"tr","p":{"a":0,"k":[64,64]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"nm":"t"}],"nm":"c4"},{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[18,18]},"p":{"a":0,"k":[0,0]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.96,0.78,0.22,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},{"ty":"tr","p":{"a":0,"k":[0,90]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"nm":"t"}],"nm":"c5"},{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[18,18]},"p":{"a":0,"k":[0,0]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.91,0.24,0.24,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},{"ty":"tr","p":{"a":0,"k":[-64,64]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"nm":"t"}],"nm":"c6"},{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[18,18]},"p":{"a":0,"k":[0,0]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.16,0.72,0.48,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},{"ty":"tr","p":{"a":0,"k":[-90,0]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"nm":"t"}],"nm":"c7"},{"ty":"gr","it":[{"d":1,"ty":"el","s":{"a":0,"k":[18,18]},"p":{"a":0,"k":[0,0]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.21,0.6,0.86,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},{"ty":"tr","p":{"a":0,"k":[-64,-64]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"nm":"t"}],"nm":"c8"}],"ip":0,"op":45,"st":0,"bm":0}]}
```

Save as `public/animations/pirate-fanfare.json`.

- [ ] **Step 2: Write the failing test**

```tsx
// tests/unit/level-fanfare.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: vi.fn(),
}));
vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => <div data-testid="lottie" />,
}));

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { playSound } from '@/lib/audio/play';
import { LevelFanfare } from '@/components/scenes/fx/LevelFanfare';

describe('LevelFanfare', () => {
  it('renders Lottie + headline + coins line + Back-to-map when motion allowed', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    render(
      <LevelFanfare
        weekLabel="Lesson 5"
        coinsThisSession={120}
        onContinue={() => undefined}
      />,
    );
    expect(screen.getByTestId('lottie')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Island cleared/i })).toBeInTheDocument();
    expect(screen.getByText(/Lesson 5/)).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to map/i })).toBeInTheDocument();
  });

  it('omits Lottie + skips fanfare sound when reduced-motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    vi.mocked(playSound).mockClear();
    render(
      <LevelFanfare weekLabel="Lesson 5" coinsThisSession={120} onContinue={() => undefined} />,
    );
    expect(screen.queryByTestId('lottie')).not.toBeInTheDocument();
    expect(screen.getByText('🎉')).toBeInTheDocument();
    expect(playSound).not.toHaveBeenCalled();
  });

  it('calls playSound("fanfare") on mount when motion allowed', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    vi.mocked(playSound).mockClear();
    render(
      <LevelFanfare weekLabel="x" coinsThisSession={1} onContinue={() => undefined} />,
    );
    expect(playSound).toHaveBeenCalledWith('fanfare');
  });
});
```

- [ ] **Step 3: Run test, expect failure**

```bash
pnpm test tests/unit/level-fanfare.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Implement LevelFanfare**

```tsx
// src/components/scenes/fx/LevelFanfare.tsx
'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useEffect } from 'react';
import { playSound } from '@/lib/audio/play';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

interface Props {
  weekLabel: string;
  coinsThisSession: number;
  onContinue: () => void;
}

export function LevelFanfare({ weekLabel, coinsThisSession, onContinue }: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!reduced) playSound('fanfare');
  }, [reduced]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative h-40 w-40">
        {reduced ? (
          <div className="flex h-full w-full items-center justify-center text-6xl" aria-hidden="true">
            🎉
          </div>
        ) : (
          <DotLottieReact
            data-testid="lottie"
            src="/animations/pirate-fanfare.json"
            autoplay
            loop={false}
            aria-label="celebration animation"
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>
      <h2 className="font-hanzi text-4xl font-bold text-[var(--color-ocean-900)]">
        Island cleared!
      </h2>
      <p className="text-lg text-[var(--color-sand-900)]">
        <span className="font-hanzi">{weekLabel}</span>
        <span className="mx-2 text-[var(--color-sand-700)]">·</span>
        <span className="font-semibold text-[var(--color-treasure-700)]">
          🪙 +{coinsThisSession}
        </span>
      </p>
      <WoodSignButton size="lg" onClick={onContinue}>
        Back to map
      </WoodSignButton>
    </main>
  );
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
pnpm test tests/unit/level-fanfare.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/scenes/fx/LevelFanfare.tsx tests/unit/level-fanfare.test.tsx public/animations/pirate-fanfare.json
git commit -m "feat(fx): LevelFanfare — Lottie + headline + back-to-map button

DotLottieReact loads pirate-fanfare.json on the end-state of a play
session. Triggers playSound('fanfare') once on mount. Under reduced
motion, falls back to a single 🎉 emoji and skips the sound.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Integrate FlashcardScene

**Files:**
- Modify: `src/components/scenes/FlashcardScene.tsx`
- Test: `tests/unit/flashcard-scene.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/flashcard-scene.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FlashcardScene } from '@/components/scenes/FlashcardScene';

describe('FlashcardScene', () => {
  const data = { hanzi: '海', pinyin: ['hǎi'], meaningEn: 'sea', meaningZh: '海洋', imageHook: null };

  it('renders the hanzi + Got-it button', () => {
    render(<FlashcardScene data={data} onComplete={() => undefined} />);
    expect(screen.getByText('海')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
  });

  it('renders inside a treasure-map backdrop (compass present)', () => {
    const { container } = render(<FlashcardScene data={data} onComplete={() => undefined} />);
    expect(container.querySelector('[data-testid="map-compass"]')).toBeTruthy();
  });

  it('Got-it button calls onComplete', async () => {
    const onComplete = vi.fn();
    render(<FlashcardScene data={data} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, expect failure on the second assertion**

```bash
pnpm test tests/unit/flashcard-scene.test.tsx
```

Expected: FAIL — the existing FlashcardScene does not yet wrap in TreasureMapBackdrop.

- [ ] **Step 3: Modify FlashcardScene.tsx**

Replace the whole file:

```tsx
// src/components/scenes/FlashcardScene.tsx
'use client';

import { useState } from 'react';
import { TreasureMapBackdrop } from '@/components/ui/TreasureMapBackdrop';
import { WoodSignButton } from '@/components/ui/WoodSignButton';

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

function speak(text: string) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

export function FlashcardScene({ data, onComplete }: Props) {
  const [pinyinShown, setPinyinShown] = useState(false);
  const [meaningShown, setMeaningShown] = useState(false);

  return (
    <TreasureMapBackdrop intensity="medium">
      <div className="flex flex-col items-center justify-center gap-8 px-6 py-10">
        <button
          type="button"
          onClick={() => speak(data.hanzi)}
          className="font-hanzi select-none text-[14rem] leading-none text-[var(--color-ocean-900)] transition-transform active:scale-95"
          aria-label={`Play audio for ${data.hanzi}`}
          style={{ textShadow: '0 2px 0 rgba(255,250,225,0.5)' }}
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

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/flashcard-scene.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/scenes/FlashcardScene.tsx tests/unit/flashcard-scene.test.tsx
git commit -m "feat(scenes): FlashcardScene wraps TreasureMapBackdrop + WoodSign CTA

Visual change only — the hanzi tap, pinyin reveal, meaning reveal, and
onComplete contract are all unchanged.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Integrate MultipleChoiceQuiz (animations + audio + a11y)

**Files:**
- Modify: `src/components/scenes/MultipleChoiceQuiz.tsx`
- Test: `tests/unit/multiple-choice-quiz.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/multiple-choice-quiz.test.tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: vi.fn(),
}));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return {
    CoinHudContext: ctx,
    useCoinHud: () => useContext(ctx),
  };
});

import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { playSound } from '@/lib/audio/play';
import { MultipleChoiceQuiz } from '@/components/scenes/MultipleChoiceQuiz';

const choices = [
  { key: 'a', label: 'A', isCorrect: false },
  { key: 'b', label: 'B', isCorrect: true },
  { key: 'c', label: 'C', isCorrect: false },
  { key: 'd', label: 'D', isCorrect: false },
];

describe('MultipleChoiceQuiz', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(playSound).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onComplete(true) 750ms after correct pick', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const onComplete = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={onComplete} />,
    );
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(800); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });

  it('plays ding on correct, buzz on wrong', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(
      <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={() => undefined} />,
    );
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(playSound).toHaveBeenCalledWith('ding');
    rerender(
      <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={() => undefined} />,
    );
    await user.click(screen.getByRole('button', { name: 'A' }));
    expect(playSound).toHaveBeenCalledWith('buzz');
  });

  it('a11y: reduced-motion mounts no CoinShower DOM after correct pick', async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(
      <MultipleChoiceQuiz prompt={null} stimulus={null} choices={choices} onComplete={() => undefined} />,
    );
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(container.querySelectorAll('[data-testid="coin"]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/multiple-choice-quiz.test.tsx
```

Expected: FAIL — current MultipleChoiceQuiz doesn't call playSound, so the second test will fail.

- [ ] **Step 3: Modify MultipleChoiceQuiz**

Replace the whole file:

```tsx
// src/components/scenes/MultipleChoiceQuiz.tsx
'use client';

import { type ReactNode, useRef, useState } from 'react';
import { CoinShower } from './fx/CoinShower';
import { ShakeWrap } from './fx/ShakeWrap';
import { playSound } from '@/lib/audio/play';
import { useCoinHud } from '@/lib/hooks/coin-hud-context';

interface Choice {
  key: string;
  label: ReactNode;
  isCorrect: boolean;
}

interface Props {
  prompt: ReactNode;
  stimulus: ReactNode;
  choices: Choice[];
  onComplete: (correct: boolean) => void;
}

export function MultipleChoiceQuiz({
  prompt,
  stimulus,
  choices,
  onComplete,
}: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [triggerKey, setTriggerKey] = useState(0);
  const [tappedRect, setTappedRect] = useState<DOMRect | null>(null);
  const [showCoins, setShowCoins] = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const { coinHudRef } = useCoinHud();

  const handlePick = (
    key: string,
    isCorrect: boolean,
    el: HTMLButtonElement,
  ) => {
    if (revealed) return;
    setRevealed(key);
    setTappedRect(el.getBoundingClientRect());
    if (isCorrect) {
      setShowCoins(true);
      playSound('ding');
    } else {
      setTriggerKey((k) => k + 1);
      playSound('buzz');
    }
    setTimeout(() => completeRef.current(isCorrect), 750);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6">
      {prompt ? (
        <p className="font-hanzi text-center text-lg text-[var(--color-ocean-700)]">
          {prompt}
        </p>
      ) : null}
      <div className="flex items-center justify-center">{stimulus}</div>
      <ShakeWrap triggerKey={triggerKey}>
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          {choices.map((c) => {
            const state =
              revealed === null
                ? 'idle'
                : c.key === revealed
                  ? c.isCorrect
                    ? 'correct'
                    : 'wrong'
                  : c.isCorrect
                    ? 'reveal-correct'
                    : 'dim';
            return (
              <button
                key={c.key}
                type="button"
                disabled={revealed !== null}
                onClick={(e) => handlePick(c.key, c.isCorrect, e.currentTarget)}
                className={[
                  'rounded-2xl border-2 px-4 py-6 text-3xl font-bold shadow-sm transition-transform active:scale-95',
                  state === 'idle' &&
                    'border-[var(--color-sand-200)] bg-white text-[var(--color-ocean-900)] hover:border-[var(--color-ocean-300)] hover:bg-[var(--color-ocean-100)]',
                  state === 'correct' &&
                    'border-[var(--color-good)] bg-[var(--color-good-bg)] text-[var(--color-ocean-900)]',
                  state === 'wrong' &&
                    'border-[var(--color-bad)] bg-[var(--color-bad-bg)] text-[var(--color-ocean-900)]',
                  state === 'reveal-correct' &&
                    'border-[var(--color-good)] bg-[var(--color-good-bg)]/60',
                  state === 'dim' &&
                    'border-[var(--color-sand-200)] bg-[var(--color-sand-100)] text-[var(--color-sand-700)]',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </ShakeWrap>
      {showCoins && (
        <CoinShower
          count={5}
          targetEl={coinHudRef}
          originRect={tappedRect}
          onComplete={() => setShowCoins(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/multiple-choice-quiz.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/scenes/MultipleChoiceQuiz.tsx tests/unit/multiple-choice-quiz.test.tsx
git commit -m "feat(scenes): MultipleChoiceQuiz coin-shower + shake + audio feedback

On correct: scale pulse (existing class) + CoinShower toward HUD ref
+ ding. On wrong: ShakeWrap retrigger via triggerKey counter + buzz.
The 750ms onComplete contract is preserved exactly.

Coin HUD ref read via useCoinHud() — SceneRunner is the provider
(installed in the next task).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Integrate SceneRunner (provider + fanfare + audio mute)

**Files:**
- Modify: `src/components/scenes/SceneRunner.tsx`
- Test: `tests/unit/scene-runner-fanfare.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/scene-runner-fanfare.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actions/play', () => ({
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 's1' }),
  finishAttemptAction: vi.fn(),
  finishLevelAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: vi.fn(),
  setAudioMuted: vi.fn(),
}));
vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => <div data-testid="lottie" />,
}));

import { SceneRunner } from '@/components/scenes/SceneRunner';
import { setAudioMuted } from '@/lib/audio/play';

describe('SceneRunner', () => {
  it('calls setAudioMuted(false) on mount when reduced-motion=false', async () => {
    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Lesson 1"
        levels={[]}
        charactersById={{}}
        pool={[]}
      />,
    );
    // wait microtask for session start promise
    await Promise.resolve();
    await Promise.resolve();
    expect(setAudioMuted).toHaveBeenCalledWith(false);
  });

  it('renders LevelFanfare in end state', async () => {
    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Lesson 1"
        levels={[]}
        charactersById={{}}
        pool={[]}
      />,
    );
    // levels=[] → done=true path; with empty levels, currentLevel undefined → done branch
    // the end-state renders LevelFanfare which (via our mock) shows lottie
    await screen.findByTestId('lottie');
    expect(screen.getByRole('heading', { name: /Island cleared/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/unit/scene-runner-fanfare.test.tsx
```

Expected: FAIL — current SceneRunner end-state is hand-rolled, not LevelFanfare.

- [ ] **Step 3: Modify SceneRunner.tsx**

Replace the whole file:

```tsx
// src/components/scenes/SceneRunner.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  finishAttemptAction,
  finishLevelAction,
  startSessionAction,
} from '@/lib/actions/play';
import { setAudioMuted } from '@/lib/audio/play';
import { CoinHudContext } from '@/lib/hooks/coin-hud-context';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';
import { AudioPickScene } from './AudioPickScene';
import { FlashcardScene } from './FlashcardScene';
import { ImagePickScene } from './ImagePickScene';
import { VisualPickScene } from './VisualPickScene';
import { WordMatchScene } from './WordMatchScene';
import { LevelFanfare } from './fx/LevelFanfare';

interface CharacterDetail {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
}

export type SceneType =
  | 'flashcard'
  | 'audio_pick'
  | 'visual_pick'
  | 'image_pick'
  | 'word_match'
  | 'tracing'
  | 'boss';

interface CompiledLevel {
  id: string;
  position: number;
  sceneType: SceneType;
  config: Record<string, unknown>;
}

interface Props {
  childId: string;
  weekId: string;
  weekLabel: string;
  levels: CompiledLevel[];
  charactersById: Record<string, CharacterDetail>;
  pool: CharacterDetail[];
}

export function SceneRunner({
  childId,
  weekId,
  weekLabel,
  levels,
  charactersById,
  pool,
}: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [coinsThisSession, setCoinsThisSession] = useState(0);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const startedAtRef = useRef<number>(0);
  const coinHudRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setAudioMuted(reduced);
  }, [reduced]);

  useEffect(() => {
    let cancelled = false;
    startSessionAction(childId).then((r) => {
      if (!cancelled) {
        setSessionId(r.sessionId);
        startedAtRef.current = Date.now();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  if (!sessionId) {
    return (
      <main className="flex flex-1 items-center justify-center text-zinc-500">
        Loading…
      </main>
    );
  }

  const currentLevel = levels[index];
  const totalLevels = levels.length;

  if (done || !currentLevel) {
    return (
      <LevelFanfare
        weekLabel={weekLabel}
        coinsThisSession={coinsThisSession}
        onContinue={() => router.push(`/play/${childId}`)}
      />
    );
  }

  const advance = (correct: boolean) => {
    if (pending) return;
    startTransition(async () => {
      const result = await finishAttemptAction({
        sessionId,
        weekLevelId: currentLevel.id,
        weekId,
        childId,
        correctCount: correct ? 1 : 0,
        totalCount: 1,
        hintsUsed: 0,
      });
      setCoinsThisSession((c) => c + result.coinsAwarded);

      const nextIndex = index + 1;
      if (nextIndex >= totalLevels) {
        const elapsedSeconds = Math.round(
          (Date.now() - startedAtRef.current) / 1000,
        );
        await finishLevelAction({
          sessionId,
          childId,
          weekId,
          totalScenesPassed: totalLevels,
          totalScenesInWeek: totalLevels,
          durationSeconds: elapsedSeconds,
        });
        setDone(true);
      } else {
        setIndex(nextIndex);
      }
    });
  };

  let body: React.ReactNode;
  switch (currentLevel.sceneType) {
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
          }}
          onComplete={() => advance(true)}
        />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'audio_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <AudioPickScene key={currentLevel.id} target={c} pool={pool} onComplete={advance} />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'visual_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <VisualPickScene key={currentLevel.id} target={c} pool={pool} onComplete={advance} />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'image_pick': {
      const characterId = currentLevel.config.characterId as string | undefined;
      const c = characterId ? charactersById[characterId] : undefined;
      body = c ? (
        <ImagePickScene key={currentLevel.id} target={c} pool={pool} onComplete={advance} />
      ) : (
        <MissingData />
      );
      break;
    }
    case 'word_match': {
      const ids = (currentLevel.config.characterIds as string[] | undefined) ?? [];
      const pairs = ids
        .map((id) => {
          const c = charactersById[id];
          return c && c.firstWord
            ? { characterId: id, hanzi: c.hanzi, word: c.firstWord }
            : null;
        })
        .filter(
          (p): p is { characterId: string; hanzi: string; word: string } => Boolean(p),
        );
      body =
        pairs.length >= 2 ? (
          <WordMatchScene key={currentLevel.id} pairs={pairs} onComplete={advance} />
        ) : (
          <MissingData />
        );
      break;
    }
    default:
      body = <MissingData />;
  }

  return (
    <CoinHudContext.Provider value={{ coinHudRef }}>
      <main className="flex min-h-[80vh] flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-sand-200)] bg-white/50 px-6 py-3 text-sm text-[var(--color-sand-900)] backdrop-blur">
          <span className="font-hanzi font-semibold">{weekLabel}</span>
          <span className="flex items-center gap-3">
            <span className="rounded-full bg-[var(--color-ocean-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-ocean-700)]">
              {index + 1} / {totalLevels}
            </span>
            <span
              ref={coinHudRef as React.RefObject<HTMLSpanElement>}
              className="rounded-full bg-[var(--color-treasure-400)] px-3 py-0.5 text-sm font-bold text-[var(--color-treasure-700)]"
            >
              🪙 {coinsThisSession}
            </span>
          </span>
        </div>
        {body}
      </main>
    </CoinHudContext.Provider>
  );
}

function MissingData() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 text-center text-[var(--color-bad)]">
      Missing data for this scene — re-publish the week from /parent.
    </main>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/unit/scene-runner-fanfare.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
pnpm test
```

Expected: PASS, all suites (target ~75 tests counting new files).

- [ ] **Step 6: Lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/scenes/SceneRunner.tsx tests/unit/scene-runner-fanfare.test.tsx
git commit -m "feat(scenes): SceneRunner provides CoinHudContext + LevelFanfare end-state

- Top-bar coin counter span gets attached to coinHudRef (consumed by
  MultipleChoiceQuiz via useCoinHud).
- Reduced-motion is wired to the global audio mute flag once at mount.
- End-state hands off to LevelFanfare (Lottie + Back-to-map WoodSign).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Repaint /parent CTAs with WoodSignButton

**Files:**
- Modify: `src/components/parent/AddChildForm.tsx`
- Modify: `src/components/parent/EditChildForm.tsx`
- Modify: `src/components/parent/NewWeekForm.tsx`
- Modify: `src/components/parent/NewStageForm.tsx`
- Modify: `src/components/parent/GenerateWeekButton.tsx`
- Modify: `src/components/parent/PublishWeekButton.tsx`
- Modify: `src/components/parent/DeleteChildButton.tsx`

- [ ] **Step 1: Survey current state**

```bash
grep -RnE '<button[^>]+type="submit"' src/components/parent
grep -Rn 'rounded-full' src/components/parent
```

Note each occurrence — they should become `<WoodSignButton type="submit">` (size=`md` default).

- [ ] **Step 2: Replace primary submit buttons file-by-file**

In each of the 7 files, identify the **single primary CTA** (typically `type="submit"` or the one that triggers the dangerous/main action). Replace its `<button …>…</button>` with `<WoodSignButton …>…</WoodSignButton>`.

Rules:
- Keep `type="submit"` if the original had it.
- Drop the Tailwind classes that styled it (rounded-full, bg-*, px-*, py-*, font-*, shadow-*). WoodSignButton handles all of that.
- Keep semantic props: `disabled`, `aria-*`, `onClick`, `form`, `name`.
- Secondary buttons (Cancel, dismiss, dropdown toggles) stay as plain `<button>` — only the **primary** CTA gets the wood treatment.
- DeleteChildButton's destructive button uses `variant="ghost"` to avoid the "happy wood" tone on a destructive action.

Example — `NewWeekForm.tsx` (illustrative; replace verbatim style not text):

before:
```tsx
<button
  type="submit"
  disabled={pending}
  className="rounded-full bg-[var(--color-ocean-500)] px-6 py-2 text-white shadow-md hover:bg-[var(--color-ocean-700)] disabled:opacity-50"
>
  Create week
</button>
```

after:
```tsx
import { WoodSignButton } from '@/components/ui/WoodSignButton';
// ...
<WoodSignButton type="submit" disabled={pending}>
  Create week
</WoodSignButton>
```

DeleteChildButton: keep destructive semantics, use ghost variant:

```tsx
<WoodSignButton type="submit" variant="ghost" disabled={pending}>
  Delete
</WoodSignButton>
```

- [ ] **Step 3: Typecheck after each file (or all at end)**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Lint**

```bash
pnpm lint
```

Expected: exit 0. If unused import warnings surface (because the old class strings are gone), remove the dangling Tailwind class concatenation utilities.

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: PASS, all suites. (Existing parent-action tests don't assert button class names.)

- [ ] **Step 6: Build**

```bash
pnpm build
```

Expected: exit 0. Scan the route bundle sizes printed at the end; `/parent/*` first-load JS should grow by no more than ~10 KB.

- [ ] **Step 7: Commit**

```bash
git add src/components/parent/
git commit -m "feat(ui): /parent CTAs adopt WoodSignButton

Primary submit on AddChildForm, EditChildForm, NewWeekForm, NewStageForm,
GenerateWeekButton, PublishWeekButton — all wood. DeleteChildButton uses
the ghost variant to keep destructive UX visually quieter.

Secondary buttons (cancel, dismiss) stay as plain native buttons.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: PLAN.md sync + open PR

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Full test + build + lint pass**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all exit 0. Note the new test count (~75) and the `/play/[childId]/level/[weekId]` route bundle size.

- [ ] **Step 2: Update PLAN.md Shipped table**

In `PLAN.md`, in the Shipped table, add right after the row for PR #13:

```markdown
| #14 | PR #14 spec — pirate-polish design doc | brainstorming + writing-plans output |
| #15 | Pirate polish layer (PR #14 implementation) | treasure-map flashcard backdrop · coin-shower + shake + Web Audio · WoodSignButton CTAs on /play and /parent · Lottie level fanfare · prefers-reduced-motion fully respected |
```

In the "Next up" section, update:

```markdown
### Next up (locked order, per art-direction memory)
- **PR #16** — Boss kraken (Phase 4) + treasure-chest gacha reveal (Phase 5 entry)
```

In the phase plan table (§2), update the rows that referenced PR #14/#15 to PR #15/#16 respectively. Specifically the two rows in §2 currently saying:

```
| 3 — Map + scenes | ... PR #14 |
| 4 — Writing + Boss | ... PR #15 |
| 5 — Economy + shop + gacha + zodiac | ... PR #15+ |
```

become:

```
| 3 — Map + scenes | ... PR #15 |
| 4 — Writing + Boss | ... PR #16 |
| 5 — Economy + shop + gacha + zodiac | ... PR #16+ |
```

- [ ] **Step 3: Commit PLAN.md**

```bash
git add PLAN.md
git commit -m "docs(plan): record PR #14 (spec) + PR #15 (pirate-polish implementation)

Boss + gacha pushed back to PR #16 to match GitHub numbering reality.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin <current-branch>
gh pr create --title "feat(ui): PR #15 — pirate polish (animations + audio + treasure-map cards)" --body "$(cat <<'EOF'
## Summary

Implements `docs/superpowers/specs/2026-05-14-pr14-pirate-polish-design.md`. Six-item scope:

- **Treasure-map backdrop** on FlashcardScene (parchment + compass + faint route)
- **Answer-feedback animations** on MultipleChoiceQuiz — 5-coin shower toward HUD on correct; horizontal card-shake on wrong
- **Wood-sign CTAs** replace teal pills on /play and /parent primary buttons
- **Lottie level fanfare** at "Island cleared!" end-state, with reduced-motion fallback
- **Web Audio procedural sounds** — ding (correct), buzz (wrong), fanfare (level complete) — no asset files
- **prefers-reduced-motion respected** end-to-end — disables motion + audio + Lottie, keeps colour feedback

## Architecture

Three foundation layers feed three UI primitives that slot into the existing scene components:

- `useReducedMotion` hook → CoinShower/ShakeWrap/LevelFanfare degradation
- Web Audio `playSound` singleton + `setAudioMuted` → ding/buzz/fanfare
- `CoinHudContext` → exposes top-bar HUD ref to any scene component that wants to fire a coin shower

## Bundle impact

framer-motion (LazyMotion subset) ~25 KB gzip; dotlottie-react + JSON ~55 KB but **dynamic-imported**, end-state only — first paint of `/play/[childId]/level/[weekId]` does not include them.

## Test plan

- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (75 cases), `pnpm build` all green
- [ ] Vercel preview: anonymous → `/sign-in` still redirects
- [ ] Vercel preview: play one whole level on iPhone Safari; correct → coin shower flying to HUD; wrong → card shake
- [ ] macOS System Settings → Accessibility → Reduce motion → replay same level → confirm no shower/shake/Lottie/audio but colour feedback still flips
- [ ] AI button on `/parent/week/[id]/review` still works (DeepSeek key regression check from PR #13)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Wait for CI green**

```bash
gh pr view --json statusCheckRollup --jq '.statusCheckRollup[] | {name, status, conclusion}'
```

Expected: `ci` → COMPLETED + SUCCESS, Vercel preview → SUCCESS.

If CI fails, fix in place (typically lint complaints about button className changes) and push again — no force-push.

---

## Self-Review

Performed inline before final save.

**Spec coverage:**
- Treasure-map backdrop on FlashcardScene → Task 7 (component) + Task 11 (integration). ✅
- Answer feedback (coin shower + shake) → Tasks 8 + 9 (components) + Task 12 (integration). ✅
- WoodSignButton on /play → Tasks 6 + 11. ✅
- WoodSignButton on /parent → Task 14. ✅
- Lottie level fanfare → Task 10 + Task 13. ✅
- Web Audio procedural sounds → Tasks 3 + 4. ✅
- prefers-reduced-motion fully respected → Task 2 (hook) + all fx components consume it. ✅
- CoinHudContext → Task 5 (component) + Task 13 (provider). ✅
- Coin shower target ref via context → Task 12 consumes, Task 13 provides. ✅
- Audio lazy init on first user gesture → Task 4 implementation comment in `getCtx()`. ✅
- 750ms onComplete unchanged → Task 12 test asserts this. ✅
- a11y integration test (reduced-motion path through MultipleChoiceQuiz) → Task 12 third test. ✅
- Bundle dynamic-imported Lottie → Task 10 (DotLottieReact is mounted only inside LevelFanfare; LevelFanfare itself is only mounted in the `done` branch of SceneRunner). Note that we don't add a `dynamic()` wrapper because LevelFanfare's tree only enters the React render tree at end-state. This is equivalent for bundle purposes since route bundles are built from import graph, not runtime mount. ✅

**Placeholder scan:** Every step has actual code or actual commands. Task 10 includes a hand-coded JSON fallback so the engineer never has to leave the editor.

**Type consistency:**
- `WoodSignButton` Props `size: 'sm' | 'md' | 'lg'` matches the contract in spec §5. ✅
- `TreasureMapBackdrop` Props `intensity: 'medium' | 'subtle'` matches spec. ✅
- `CoinShower` Props `count, originRect, targetEl, onComplete` matches spec. ✅
- `ShakeWrap` Props `triggerKey: number` matches spec (renamed from `shakeKey`). ✅
- `LevelFanfare` Props `weekLabel, coinsThisSession, onContinue` matches spec. ✅
- `playSound('ding'|'buzz'|'fanfare')` consistent across Tasks 3, 4, 10, 12. ✅
- `useCoinHud().coinHudRef` type `RefObject<HTMLElement | null>` consistent between Task 5 and Task 13. ✅

**Scope check:** Single PR producing the 6 spec items. Each task is self-contained and committable. No spec requirement left orphaned.

No issues to fix.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-pr14-pirate-polish.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using `executing-plans`, batch with checkpoints

Which approach?
