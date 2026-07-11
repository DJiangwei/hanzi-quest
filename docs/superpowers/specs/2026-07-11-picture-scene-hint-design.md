# Picture-Scene Hint Bubble — Design

**Date:** 2026-07-11 · **Status:** approved by David (option A of A/B/C) · **Context:** playtest — 看图找字 (`image_pick`) / 看图选词 (`image_word`) pictures are sometimes not intuitive. David asked for an unlockable English description of the picture.

## Decision

Reuse the existing **free 💡 practice hint** (PowerupTray → `hintRequested`, the 2026-06-07 "hint is free in practice" rule): one tap now (a) grays a wrong choice via `MultipleChoiceQuiz` (unchanged) AND (b) reveals an English description of the picture under the stimulus. Rejected: coin-unlock (conflicts with hint-free rule; prices help for an avoidance-prone kid) and always-visible (permanently lowers difficulty; hooks are often near-answers).

## Content source (already in the DB — no generation)

`words.image_hook` is the kid-friendly English phrase each picture was GENERATED from (426/426 populated) — the perfect description of what's actually in the picture.

- `image_word`: `correctWord.imageHook ?? correctWord.meaningEn` (both already in scene props).
- `image_pick`: the picture belongs to one of the target char's WORDS; `SceneRunner` currently threads only `imageUrl`. Change: `const stimulusWord = c.words.find((w) => w.imageUrl)`; pass new prop `imageHint = stimulusWord?.imageHook ?? stimulusWord?.meaningEn ?? c.imageHook`.

## UI

New tiny shared client component `src/components/scenes/HintBubble.tsx`: amber rounded bubble, `💡 提示 / Hint:` label (bilingual) + the English text (AI-generated content — bilingual rule exempt), `data-testid="hint-bubble"`. Rendered by both scenes directly under the image **only when** `hintRequested && text && imageUrl` — when the image is missing, the existing fallback text card already IS the description (no duplicate bubble). No animation needed (appears on state change; nothing for reduced-motion).

## Not changing

MCQ gray-out behavior; hint availability rules (`sceneSupportsHint`); boss (never gets hints); other scenes; no DB/migration/recompile; `hints_used` accounting (the free hint already doesn't count — unchanged).

## Tests (~5)

HintBubble renders text; ImagePickScene shows bubble only when hint requested + image present (not before tap, not in text-fallback mode); ImageWordScene same; SceneRunner threads `imageHint` from the stimulus word (source-level or props test).
