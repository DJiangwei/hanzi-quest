# Pirate Homework — design

> David's top-priority feature. David manually authors each week's real Chinese
> homework as structured items; Yinuo plays them as interactive exercises. Lives
> as a new **section of each island week**, alongside 回顾 / 练习 / Boss战.

## Decisions (locked with David, 2026-06-12)

- **Form:** David provides content → app turns it into **playable exercises**.
- **Authoring:** **structured manual entry, no AI** (David enters each item; nothing is AI-generated or OCR'd).
- **Placement:** a per-week **作业 / Homework section** on the week hub (only shown when the week has homework items). Authored in the parent admin per week.
- **v1 exercise types (3):** 字 Quiz (per-character) · 组词 Word-building · 连词成句 Sentence ordering.
- **Reward:** coins + XP + **one card, once per (week, day)** (same cadence as 回顾). Daily card cap still applies.
- **Sentence interaction:** tap word-blocks into the correct order.
- **Out of v1:** 听写 (dictation), 描红/书写 (tracing — needs stroke data + touch recognition), AI worksheet recognition.

## Architecture

Homework is a **standalone subsystem** (NOT compiled into `week_levels`/scenes), so
David can edit it anytime with no recompile. It **reuses** the MCQ scene
component + the reward primitives, and surfaces as a week-hub section.

### Data model
New table `homework_items` (migration, additive):

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `week_id` | uuid FK → `weeks.id` | indexed; cascade delete |
| `position` | integer | ordering within the week |
| `type` | `homework_item_type` pgEnum | `char_quiz` \| `word_building` \| `sentence_order` |
| `config` | jsonb | type-specific (zod-validated in app) |
| `created_at` / `updated_at` | timestamptz | |

### Config schemas (`src/lib/homework/schemas.ts`, pure/client-safe, zod)
- **char_quiz**: `{ hanzi?: string; questionZh: string; options: { textZh: string; textEn: string }[]; correctIndex: number }` — David's Chinese question + 2–4 bilingual options, one correct.
- **word_building**: `{ baseChar: string; correctWord: string; distractors: string[]; correctMeaningEn?: string }` — "给「baseChar」组词": choices = `[correctWord, ...distractors]` shuffled, pick the real word.
- **sentence_order**: `{ tokens: string[]; translationEn?: string }` — `tokens` is the sentence split into ordered word-blocks (correct order); the app shuffles, the kid taps them back.

A discriminated union `HomeworkItemConfig` + `parseHomeworkConfig(type, raw)` validates per type.

### DB layer (`src/lib/db/homework.ts`, server-only)
`listHomeworkItems(weekId)`, `getHomeworkItem(id)`, `createHomeworkItem`, `updateHomeworkItem`, `deleteHomeworkItem`, `reorderHomeworkItems(weekId, orderedIds)`, `weekHasHomework(weekId)`.

### Authoring (parent admin)
A **作业 / Homework editor** on the week page (`/parent/week/[id]/review` — the existing per-week edit surface). Lists items (type + summary), with add / edit / delete / reorder (↑↓). Each type has its own structured form:
- char_quiz: optional 字, question (zh), a dynamic option list (textZh + textEn rows), radio for correct.
- word_building: baseChar, correctWord, distractor list, optional En meaning.
- sentence_order: ordered token list (add/remove/reorder blocks), optional En translation.

Server actions in `src/lib/actions/homework.ts` (`'use server'`, parent-auth-gated via the existing parent guard): `addHomeworkItemAction`, `updateHomeworkItemAction`, `deleteHomeworkItemAction`, `reorderHomeworkItemsAction`. Each `revalidatePath`s the week + the kid week hub.

### Kid play
- **Week hub** (`WeekHub`): add a `homework` section to the `sections` prop — a 📚 作业 / Homework card shown only when `weekHasHomework(weekId)`. Links to `/play/[childId]/homework/[weekId]`.
- **Route** `/play/[childId]/homework/[weekId]/page.tsx`: loads items (server) → renders `HomeworkRunner`.
- **`HomeworkRunner`** (client, mirrors `SceneRunner`'s shape but homework-specific): steps through items; renders:
  - `char_quiz` → `MultipleChoiceQuiz` (prompt = `questionZh`, choices = options rendered `中文 / English`, `isCorrect` at `correctIndex`).
  - `word_building` → `MultipleChoiceQuiz` (prompt = "给「baseChar」组词 / Make a word", choices = shuffled words).
  - `sentence_order` → new **`SentenceOrderScene`** (shuffled token chips → tap to append to the answer row in order; correct when the assembled order equals `tokens`; wrong-order → shake + let them retry/clear; respects `useReducedMotion`).
- On finishing all items → `finishHomeworkAction` → reveal card via the existing `CardChestReveal`; show coins/XP via the existing toasts; a `LevelFanfare`-style done screen with a bilingual "no card" notice when applicable.

### Reward model (`finishHomeworkAction`, server)
Reuses the section-card mechanic from the 2026-06-12 card rebalance. New card source `'homework'` added to `CardGrantSource` + `pullCardInTx`. On completion:
1. `result = pullCardForChild('homework', \`${weekId}:${todayUtcIso()}\`)` → once per (week, day).
2. `granted` → first homework today: award `HOMEWORK_COMPLETE_COINS` + XP, return the card.
3. `already_granted` → return `cardMessage: 'homework_done_today'` ("今日作业已完成，明日再来"), no coins/XP.
4. `daily_cap_reached` → return `cardMessage: 'daily_cap_reached'`, no coins/XP.

All rewards are gated on the `granted` path, so coins/XP are once-per-week-per-day too (the card-grant log is the single idempotency source — no farming, no extra table). The homework card joins the existing `earn_card` quest tick + `pack-complete` / `continent-complete` trophy checks (a flag/continent can't come from homework, but the call is harmless + consistent). Homework does NOT affect boss-unlock (that counts `practice` only).

## Integration points (touch list)
- `src/db/schema/content.ts` (or a new `homework.ts` schema file) — `homework_items` table + `homework_item_type` enum → new migration.
- `src/lib/db/homework.ts`, `src/lib/homework/schemas.ts`, `src/lib/actions/homework.ts`.
- `src/lib/actions/gacha.ts` + `src/lib/db/grants.ts` — add `'homework'` card source.
- `src/lib/actions/homework.ts` — `finishHomeworkAction` (coins via `awardCoins`, XP via `awardXp`, card via `pullCardForChild`).
- `src/components/play/WeekHub.tsx` + the week hub page — homework section card (conditional).
- `src/components/homework/HomeworkRunner.tsx`, `SentenceOrderScene.tsx`; reuse `MultipleChoiceQuiz`, `CardChestReveal`, `LevelFanfare`, toasts.
- `src/app/play/[childId]/homework/[weekId]/page.tsx`.
- Parent editor: `src/components/parent/HomeworkEditor.tsx` (+ per-type forms) wired into `/parent/week/[id]/review`.

## Testing
- `homework-schemas` — zod parse/round-trip per type; rejects bad shapes (e.g. correctIndex out of range).
- `homework-db` — CRUD + reorder + `weekHasHomework` (mock `@/db`).
- `sentence-order-scene` — shuffles, accepts correct order, rejects wrong, reduced-motion path.
- `homework-runner` — steps through all 3 types, calls `finishHomeworkAction` at the end, surfaces the card.
- `finish-homework-action` — granted → coins+XP+card; already_granted → `homework_done_today`, no coins; cap → message, no coins.
- `homework-editor` — add/edit/delete/reorder calls the right actions.
- Bilingual chrome on all new kid-facing labels.

## Post-merge ops
None required to function (additive migration auto-applies on deploy). David authors homework per week in the parent admin. No seed.

## Open / deferred
- Per-item attempt persistence (homework_attempts) — v1 tracks completion only (replayable; card capped once/week/day). Add later if per-item analytics are wanted.
- 听写 / 描红 exercise types — separate future PR.
