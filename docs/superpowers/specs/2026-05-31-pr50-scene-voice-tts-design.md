# PR #50 — Scene Voice/TTS — Design

**Status:** approved (David, 2026-05-31)
**Branch:** `feat/pr50-scene-tts`
**Owner:** Claude + David

---

## 1. Goal

Yinuo (6, English-native) hears native zh-CN pronunciation of every character/word stimulus she sees in scenes. Free, no auth, no infra cost. Extends the Web Speech API pattern that shipped in PR #48 (Story Mode `ChapterAudioButton`) from one chapter view to the entire scene loop.

## 2. Why

- She's English-native; reading hanzi without pronunciation is a missing leg of the stool.
- The pattern is proven (PR #48 ships zh-CN TTS via `useSyncExternalStore` + `lang='zh-CN'` + `rate=0.85`) and free (Web Speech API).
- `AudioPickScene` already speaks zh-CN inline but uses the buggy `'speechSynthesis' in window` detection (per the PR #48 landmine — `vi.stubGlobal(undefined)` still makes `in` true). Worth fixing while we're in there.

## 3. Non-goals

- Post-reveal "replay the correct answer" audio (clean v2 add).
- Auto-play on scene entry (startling; opens parent-setting can of worms).
- Voice-rate or voice-selection UI.
- Custom recorded voices (that's Family Bridge territory).
- English TTS (Yinuo is English-native; not useful).
- A "voice on/off" parent toggle (tap-only buttons mean opt-in by default — no global switch needed).

## 4. Architecture

### 4.1 Shared primitives

- **`src/lib/hooks/useSpeechSupported.ts`** — `useSyncExternalStore`-based hook returning `boolean`. SSR returns `false`; client probes `typeof window !== 'undefined' && window.speechSynthesis != null`. Subscribe is a no-op (support doesn't change at runtime).
- **`src/components/play/SpeakButton.tsx`** — single shared component used by every scene + Story Mode. Renders `null` when unsupported. Props:
  ```ts
  interface SpeakButtonProps {
    text: string;
    size?: 'sm' | 'md'; // sm = inline next to hanzi; md = standalone CTA (matches PR #48 chapter style)
    label?: string;     // aria-label override; defaults to `Read aloud`
    className?: string;
  }
  ```
  On click: `window.speechSynthesis.cancel()` → `new SpeechSynthesisUtterance(text)` with `lang='zh-CN'`, `rate=0.85` → `speak()`. No voice selection in v1. **Render gate is API presence, NOT voice availability** — if the browser has `speechSynthesis` but no zh-CN voice, the button still renders and the browser picks its default voice (which on most devices is still acceptable). Voice picker is a v2 candidate (§10).

### 4.2 Consolidating existing audio

- **`ChapterAudioButton` (PR #48)** — refactor to a thin wrapper: `<SpeakButton text={text} size="md" label="Read aloud" />`. Keep the export so callers don't change.
- **`AudioPickScene`** — remove the inline `speak()` helper; replace the "play sound" CTA with `<SpeakButton text={target.hanzi} size="md" label="Play sound" />`. This also fixes the latent detection bug.

### 4.3 Per-scene integration (revised during planning)

| Scene | 🔊 placement | Text spoken |
|---|---|---|
| `FlashcardScene` | Big hanzi tap-target + revealed pinyin row (refactor existing 2 inline-speak surfaces to use the shared hook) | target hanzi |
| `AudioPickScene` | Existing central 🔊 CTA (refactor to shared hook) | target hanzi |
| `TranslatePickScene` (direction `cn_to_en`) | `<SpeakButton size="sm">` next to hanzi stimulus | target hanzi |
| `TranslatePickScene` (direction `en_to_cn`) | — | (skip; choices are hanzi → would reveal answer) |
| `ImagePickScene` | — | (v2 — choices are hanzi → speaking stimulus reveals answer) |
| `VisualPickScene` | — | (v2 — choices are pinyin = the sound → speaking stimulus reveals answer) |
| `SentenceClozeScene` | — | (v2 — stem-with-blank is awkward to speak) |
| `ImageWordScene` | — | (v2) |
| `WordMatchScene` | — | (v2 — would reveal pairing) |
| `BossScene` | inherits from child scene | n/a |
| `ChapterAudioButton` (Story Mode, PR #48) | refactor to wrap SpeakButton | **deferred to post-PR-#48 follow-up** (no consumer exists on PR #50 branch) |

Scenes that wrap `MultipleChoiceQuiz` pass a richer `prompt: ReactNode` containing `<SpeakButton>` adjacent to the hanzi. `MultipleChoiceQuiz` stays generic — it doesn't know it's wrapping a hanzi-bearing prompt.

### 4.4 What stays untouched

- Procedural audio in `src/lib/audio/{play,sounds,themes}` (ding / buzz / fanfare / theme music) — separate system, different purpose. No refactor.
- Scene compile logic (`src/lib/scenes/compile-week.ts`) — TTS is a render-time concern; no `scene_config` changes; no recompile needed.
- DB schema — no migration.

## 5. UX details

- Button visual: small pill `🔊` icon-only for `size="sm"` (inline next to hanzi); pill `🔊 Read aloud` / `🔊 朗读` for `size="md"` (standalone CTA, matches PR #48 chapter style). Bilingual label for `md` (Yinuo is English-native but the chapter button is already bilingual).
- Tap target: ≥44×44 px even for `sm` (icon button needs padding).
- Cancel-before-speak: tapping a second button (or the same button twice) interrupts the in-flight utterance. No queueing.
- `aria-label` always present; screen-reader users hear "Read aloud: 妈" or similar.
- `prefers-reduced-motion`: not applicable (no animation on the button itself; the underlying speech synthesis is unaffected).

## 6. Data flow

```
SceneRunner
  └─ {SpecificScene}            (renders the prompt + delegates to MCQ if applicable)
      └─ <SpeakButton text="妈" />
          └─ useSpeechSupported() → bool
          └─ on click: speechSynthesis.cancel() → speak(SpeechSynthesisUtterance(text))
```

No props bubble back up. No server roundtrip. No coin economy hook.

## 7. Error handling

- API unavailable → button renders `null` (no UI noise; quiet degrade).
- `speak()` throws (rare; some embedded WebViews) → swallow in try/catch; log to console for dev visibility.
- Voice unavailable but API exists → browser picks any voice and approximates pronunciation. Acceptable for v1; if quality is too poor we surface a voice-picker in v2.

## 8. Tests (Vitest + RTL + jsdom)

**New test files:**
- `tests/unit/components/play/SpeakButton.test.tsx`
  - renders null when `speechSynthesis` is undefined
  - renders button when `speechSynthesis` is present
  - on click, calls `cancel()` THEN constructs an utterance with `lang='zh-CN'` + `rate=0.85` THEN calls `speak()` (mock + assert call order)
  - applies `aria-label` from props (default + override)
- `tests/unit/lib/hooks/useSpeechSupported.test.tsx`
  - SSR snapshot returns `false`
  - client snapshot returns `true` when API present, `false` when absent

**Updated test files:**
- `tests/unit/components/play/story/ChapterAudioButton.test.tsx` — regression: still works after refactor (uses SpeakButton under the hood, but same exported behavior)
- `tests/unit/components/scenes/AudioPickScene.test.tsx` — regression: clicking "play" still triggers speech with the target hanzi
- `tests/unit/components/scenes/FlashcardScene.test.tsx` — assert 3 SpeakButtons rendered with hanzi, example word, example sentence text
- `tests/unit/components/scenes/ImagePickScene.test.tsx`, `VisualPickScene.test.tsx`, `TranslatePickScene.test.tsx` — assert SpeakButton present on stimulus (cn_to_en direction only for translate)

**Estimated:** +20 to +25 net tests. From 590 → ~610-615.

## 9. Verification

Pre-merge:
1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green (the four-green gate).
2. `pnpm dev` → log in → play through a review session → confirm hanzi speaks when tapped on flashcard, image-pick, visual-pick.
3. AudioPickScene still plays the prompt (refactored CTA).
4. Story Mode chapter page still has the "Read aloud" button working (regression).
5. DevTools → `prefers-reduced-motion: reduce` — no regression (no animation tied to speech).
6. Test on a browser without zh-CN voice (e.g. headless Chromium) — button still renders (API present) but speech may be approximate; acceptable.

## 10. Open questions / v2 candidates

- **ImagePick + VisualPick audio:** spec v1 over-scoped these. Their stimulus is the target hanzi (or its visual proxy) and their CHOICES are the answer surface (hanzi for ImagePick, pinyin for VisualPick). Speaking the stimulus tells the kid the answer. Defer to v2 with a post-reveal pattern (button appears only after the correct choice is locked in), same shape as the cloze/image-word v2.
- **Sentence-cloze audio:** speaking the stem with the blank is awkward; speaking the completed sentence post-reveal is cleaner. Defer to v2.
- **Image-word post-reveal audio:** the correct-word reveal is the moment a 🔊 would add value. Defer to v2.
- **ChapterAudioButton refactor:** PR #50 originally planned to refactor PR #48's `ChapterAudioButton` into a thin wrapper over `SpeakButton`. Skipped because PR #48 had not merged when PR #50 was implemented (creating the wrapper file with no consumer would land as dead code in review). Trivial 1-file follow-up after PR #48 merges: swap the body of `ChapterAudioButton.tsx` for `<SpeakButton text={text} size="md" label="Read aloud" />`.
- **Voice selection UI:** if Yinuo or David finds a particular voice too robotic, expose a picker in parent settings. Defer until someone complains.
- **Per-character mastery hook:** could log "audio replay" events as a weak mastery signal (a kid replaying = uncertainty). Cross-cutting with future adaptive-difficulty PR. Out of scope here.
- **Auto-play on flashcard entry:** could fire once on mount; needs a parent on/off toggle. Defer until requested.

## 11. Landmines / things to preserve

- **Don't pull `useSpeechSupported` into a server component.** It's a `'use client'` hook (uses `useSyncExternalStore`). Story Mode's chapter page does this correctly today.
- **`SpeakButton` must stay client-only.** Mark `'use client'` at top.
- **Detection must use `!= null` not `'speechSynthesis' in window`.** The latter is true even when `vi.stubGlobal` zeroes it out — this was the PR #48 landmine.
- **`speechSynthesis.cancel()` before every `speak()`** — otherwise tapping rapidly queues utterances and the kid hears a backlog of 妈 妈 妈 妈.

## 12. Effort + rollout

- 9 implementation tasks landed (1 hook + 1 hook + 1 component + 3 scene refactors/adds + 2 doc tasks + 1 verify) — Task 4 (ChapterAudioButton wrapper) deferred to post-PR-#48 follow-up
- 6 files touched (3 new primitives, 2 scene refactors + 1 scene addition; 2 doc files)
- One-day single-session work (subagent-driven, two-stage review)
- No DB migration, no recompile, no seed script, no env var
- No prod data risk: pure render-layer change
- Rollout: standard PR + four-green gate + merge to main
