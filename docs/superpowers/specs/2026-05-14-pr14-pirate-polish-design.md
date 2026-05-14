# PR #14 — Pirate Polish (animations + audio + treasure-map cards)

**Status:** Approved design — 2026-05-14
**Roadmap slot:** PR #14, between PR #13 (housekeeping) and PR #15 (boss + gacha)
**Source brainstorm:** `.superpowers/brainstorm/4066-1778792329/` (gitignored)

---

## 1. Goals

Land the "pirate-adventure" feedback layer locked in `art_direction` memory so the 6-year-old gets visceral reward feedback during play and the parent console picks up a matching CTA style.

In scope (6 items, locked):

1. Treasure-map backdrop on `FlashcardScene` (parchment + faint compass + dotted route — fidelity option **B** from `treasure-map-backdrop.html`).
2. Answer-feedback animations on `MultipleChoiceQuiz`: correct = coin-shower + scale pulse + ding; wrong = card-shake + buzz (intensity **B** from `correct-feedback.html`).
3. Wood-sign CTA buttons replace teal pill on /play primary CTAs (visual option **C** from `wood-sign-buttons.html` — mid-fi with grain + nails).
4. Lottie fanfare on `SceneRunner` "Island cleared!" end-state.
5. Web Audio procedural sound trio (ding / buzz / fanfare) — no asset files.
6. /parent CTAs also adopt WoodSignButton (visual consistency across surfaces).

Out of scope (deliberately deferred to PR #15+):

- HanziWriter tracing scene (Phase 4)
- Boss kraken (Phase 4)
- Gacha treasure-chest reveal (Phase 5)
- Mascot illustration / commissioned art (defer per art_direction "no commission until Yinuo validates loop")

---

## 2. Visual decisions (frozen)

| Element | Decision | Notes |
|---|---|---|
| Wood-sign button | Option C — mid-fi CSS | `repeating-linear-gradient` grain stripes + 2 black "nails" via pseudo-elements + double-stroke 6b4720 border + 4px chunky bottom-shadow. Zero image asset. |
| Treasure-map backdrop | Option B — parchment + compass + route | Parchment `f5ead0→e6cb8e` gradient base, top-left compass rose SVG, dotted curve route at 0.5 opacity. No palm tree, no red X (option C was too busy under hanzi). |
| Correct-answer feedback | Option B — 5-coin shower | 5 coins arc from tapped button toward top HUD 🪙 counter, staggered 80ms each, 900ms total. Counter increments after coins arrive (visual causality). |
| Wrong-answer feedback | Unitary | 4× horizontal `-8px↔+8px` nudge over 350ms + dim color state already in `MultipleChoiceQuiz`. No fidelity options — wrong feedback shouldn't be celebrated. |
| Level fanfare | Lottie + sound | dotlottie player loads only at end-state via `dynamic(ssr:false)`. JSON picked from lottiefiles.com (free CC0, <60KB, pirate or generic fanfare). |

---

## 3. Tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Animation library | `framer-motion@^12` with `LazyMotion` + `m.div` subset import | ~25 KB gzip subset vs 60 KB full. React-component API; SSR-friendly. |
| Lottie player | `@lottiefiles/dotlottie-react@^0.19` | ~15 KB gzip — 30% smaller than `lottie-react`. |
| Audio | Web Audio API procedural via `OscillatorNode` | Zero asset files. ~1 KB of code. Acceptable quality for a 6-year-old. |
| Reduced-motion detection | Self-written `useReducedMotion()` hook on `matchMedia` | Avoid `framer-motion/useReducedMotion` to keep audio + lottie decisions outside Framer's scope. |

Bundle impact: ~81 KB gzip total. Lottie player + JSON are dynamic-imported, so first paint of `/play/[childId]/level/[weekId]` does **not** include them.

---

## 4. File layout

```
src/
├─ components/
│  ├─ ui/
│  │  ├─ WoodSignButton.tsx         # shared CTA, primary | ghost variants, sm | md | lg sizes
│  │  └─ TreasureMapBackdrop.tsx    # SVG-rich wrapper, intensity: medium (default) | subtle
│  └─ scenes/
│     ├─ fx/
│     │  ├─ CoinShower.tsx          # framer-motion: spawns N coins toward targetEl ref
│     │  ├─ ShakeWrap.tsx           # framer-motion: keyed shake-on-mount
│     │  └─ LevelFanfare.tsx        # dotlottie + "Island cleared!" + playSound('fanfare')
│     ├─ FlashcardScene.tsx         # MODIFIED: wraps in <TreasureMapBackdrop>; CTA → <WoodSignButton>
│     ├─ MultipleChoiceQuiz.tsx     # MODIFIED: on correct → <CoinShower>+ding; on wrong → <ShakeWrap>+buzz
│     └─ SceneRunner.tsx            # MODIFIED: end-state → <LevelFanfare>; coinHudRef forwarded down
└─ lib/
   ├─ hooks/
   │  ├─ use-reduced-motion.ts      # matchMedia('(prefers-reduced-motion: reduce)') hook
   │  └─ coin-hud-context.ts        # React Context: { coinHudRef: RefObject<HTMLElement> }
   └─ audio/
      ├─ sounds.ts                  # playDing / playBuzz / playFanfare — OscillatorNode + GainNode
      └─ play.ts                    # playSound(name), setAudioMuted(bool), lazy AudioContext singleton

public/
└─ animations/
   └─ pirate-fanfare.json           # NEW asset; cache-immutable; ~40KB max
```

Modified files: 3 components (FlashcardScene, MultipleChoiceQuiz, SceneRunner). Plus 4-6 button replacements in `/src/components/parent/*` consuming the new `WoodSignButton`.

---

## 5. Component contracts

```ts
// WoodSignButton.tsx
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';          // 14 / 18 / 22 px padding tiers
  variant?: 'primary' | 'ghost';      // primary = filled wood (default); ghost = wood-bordered transparent
}

// TreasureMapBackdrop.tsx
interface Props {
  children: ReactNode;
  intensity?: 'medium' | 'subtle';    // medium = default (compass + route); subtle = parchment only
}

// CoinShower.tsx
interface Props {
  count?: number;                      // default 5
  targetEl?: RefObject<HTMLElement>;   // top-HUD coin counter element
  originRect?: DOMRect | null;         // where coins spawn (tapped button bounding box)
  onComplete?: () => void;
}

// ShakeWrap.tsx
interface Props {
  triggerKey: number;                  // monotonic counter — changing value retriggers shake; same value = no animation. Counter semantics keep retrigger logic stable under React 18 strict-mode double-mount.
  children: ReactNode;
}

// LevelFanfare.tsx
interface Props {
  weekLabel: string;
  coinsThisSession: number;
  onContinue: () => void;              // wires to "Back to map" WoodSignButton
}
```

---

## 6. Data-flow integration points

```
SceneRunner
  ├─ coinHudRef = useRef<HTMLSpanElement>(null)             [attached to top-bar 🪙 <span>]
  ├─ <CoinHudContext.Provider value={{ coinHudRef }}>       ← NEW
  │    └─ wraps body (all scene types now have access without prop drilling)
  └─ end-state ({done}):
        renders <LevelFanfare weekLabel coinsThisSession onContinue={() => router.push(`/play/${childId}`)} />
        — replaces the current 🎉/h2/p/button block

MultipleChoiceQuiz pick(key, isCorrect, btnEl)
  ├─ revealed = key                       [unchanged]
  ├─ const { coinHudRef } = useCoinHud()  ← NEW (context)
  ├─ tappedRect = btnEl.getBoundingClientRect()   ← NEW (captured at click time)
  ├─ if isCorrect:
  │    setSpawningCoins(true)             ← NEW state
  │    playSound('ding')                  ← NEW
  ├─ else:
  │    setTriggerKey(k => k + 1)          ← NEW state (monotonic counter)
  │    playSound('buzz')                  ← NEW
  └─ setTimeout(onComplete, 750)          [unchanged]

  render:
  ├─ <ShakeWrap triggerKey={triggerKey}>  ← wraps the choices grid
  │    {choices.map(c => <button onClick={e => pick(c.key, c.isCorrect, e.currentTarget)}>...</button>)}
  └─ {spawningCoins && (
       <CoinShower count={5} targetEl={coinHudRef} originRect={tappedRect} />
     )}
```

Coupling notes:

- `coinHudRef` is exposed via `CoinHudContext` (`lib/hooks/coin-hud-context.ts`). Any scene type can call `useCoinHud()` without prop drilling. SceneRunner is the sole provider. Default value is `{ coinHudRef: { current: null } }` so consumers stay tolerant if the context isn't installed (e.g., in tests).
- `AudioContext` singleton lives in `lib/audio/play.ts`. First call creates it (user-gesture safe — first call is always inside an onClick). Subsequent calls reuse.
- `setAudioMuted(value)` is called once from `SceneRunner` `useEffect` reading `useReducedMotion()`. No per-fx-component plumbing of the mute boolean.
- The MultipleChoiceQuiz 750ms `setTimeout` is **unchanged**. Animations slot into that existing window; CoinShower's 900ms tail intentionally overlaps the scene transition for the "coins land into next scene's HUD" illusion.

---

## 7. Accessibility — `prefers-reduced-motion` table

| Surface | Default | reduced-motion ON |
|---|---|---|
| Treasure-map backdrop | static SVG compass + route | unchanged (static is not motion) |
| WoodSignButton hover translate | `translateY(-2px)` 150ms | unchanged (hover is not animation-class motion per WCAG) |
| Correct: scale pulse | 1.0 → 1.08 → 1.0 / 450ms | not mounted; color state still flips |
| Correct: coin shower | 5 coins arc 900ms | not mounted |
| Correct: ding sound | three-tone arpeggio | no-op |
| Wrong: card shake | 4× nudge 350ms | not mounted; color state still flips |
| Wrong: buzz sound | sawtooth descent | no-op |
| Level fanfare Lottie | autoplay 1.5–3s | unmounted; falls back to existing 🎉 emoji + "Island cleared!" text |
| Level fanfare sound | six-tone fanfare | no-op |

Implementation: `useReducedMotion()` returns `boolean`. Each fx component reads it and early-returns its degraded form. The audio module reads it once at mount via `setAudioMuted()`.

Additional a11y:

- Coin shower is purely decorative — `<div aria-hidden="true">` wrapping motion divs.
- Lottie has `aria-label="celebration animation"`; the textual "Island cleared! +N coins" remains in the document flow for screen readers.
- WoodSignButton inherits native `<button>` focus ring (Tailwind ring utilities used to make it visible against wood color: `focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2`).

---

## 8. Asset budget

| Item | Budget | Hard cap |
|---|---|---|
| `framer-motion` gzip | 25 KB | 30 KB |
| `@lottiefiles/dotlottie-react` gzip | 15 KB | 20 KB |
| `pirate-fanfare.json` | 40 KB | 60 KB |
| Web Audio module source | 1 KB | 3 KB |
| Total impact on `/play` route bundle | ~25 KB initial (Framer Motion only) | Lottie + JSON load only on end-state |

Lottie selection criteria (when picking the file):

1. License: lottiefiles free tier or CC0 — never premium.
2. JSON size: under 60 KB original.
3. Duration: 1.5–3 seconds, single-play or short loop.
4. Theme: pirate / treasure / nautical first; generic confetti-burst as fallback if no fitting pirate piece exists.

---

## 9. Testing strategy

| Layer | Coverage |
|---|---|
| Vitest unit | (1) `useReducedMotion()` returns correct boolean for both `matchMedia` states; (2) `playSound()` is no-op when muted; (3) `CoinShower` renders nothing when reduced-motion is on; (4) `WoodSignButton` snapshot for size × variant matrix; (5) `MultipleChoiceQuiz` still calls `onComplete` exactly 750ms after pick despite animation injection (regression guard); (6) **a11y integration**: render `<MultipleChoiceQuiz>` under `<CoinHudContext.Provider>` with `matchMedia` mocked to `prefers-reduced-motion: reduce`; pick a correct answer; assert `playSound` was called with `'ding'` but is a no-op (mock verifies muted=true was set), CoinShower DOM is absent, button still flips to correct color state. |
| Type | `pnpm typecheck` — must stay green. |
| Lint | `pnpm lint` — must stay green. |
| Build | `pnpm build` — must stay green. Validates `LazyMotion + m.*` SSR friendliness and dotlottie dynamic import. |
| Manual on Vercel preview | (a) play one whole level on iPhone Safari; (b) toggle macOS "Reduce motion" pref and replay; (c) verify Preview env's DEEPSEEK key still works (no regression from PR #13). |

Expected test count: 61 → ~75 cases. New files:

- `tests/unit/use-reduced-motion.test.ts`
- `tests/unit/play-sound.test.ts`
- `tests/unit/wood-sign-button.test.ts`
- `tests/unit/coin-shower.test.ts` — reduced-motion no-render assertion
- `tests/unit/multiple-choice-a11y.test.ts` — integration: reduced-motion path through MultipleChoiceQuiz

Not tested:

- Framer Motion timeline curves — visual regression is V2 work, not this PR.
- Lottie JSON validity — caught at build by dotlottie's runtime warnings.
- AudioContext audible quality — manual ear check only.

---

## 10. Risks & non-goals

| Risk | Mitigation |
|---|---|
| AudioContext blocked before first user gesture | Lazy init in `playSound`; first call is always inside an onClick. First-tap latency might cut the very first ding short — accept; subsequent plays are fine. |
| Lottie license confusion | Pick CC0-only at selection time; commit the JSON with a `LICENSE.md` next to it noting source URL + license. |
| Bundle size regression on `/play` route | Track `pnpm build` route bundle size before/after in PR description. If `/play/[childId]/level/[weekId]` first-load JS grows >50 KB, reconsider Framer Motion or split further. |
| Audio annoying on long sessions | reduced-motion mutes it; future PR can add explicit Mute toggle in the SceneRunner top bar. |
| Wood-sign button focus visibility | `focus-visible:ring-2 ring-ocean-500 ring-offset-2` — visible against wood color. Manual check in keyboard nav. |

Non-goals (explicit):

- No commissioned art, no Fiverr mascot — that gate is "after Yinuo validates the loop" per art_direction.
- No Playwright visual regression infrastructure — V2.
- No sound preference toggle UI — relies on OS preference for now.
- No haptic feedback (`navigator.vibrate`) — kept out for V1 scope.

---

## 11. Handoff to implementation

After approval, the next skill is `superpowers:writing-plans` to convert this spec into a step-by-step implementation plan with PR-merge gating criteria.
