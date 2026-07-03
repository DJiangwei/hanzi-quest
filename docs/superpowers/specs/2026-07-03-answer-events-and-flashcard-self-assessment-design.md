# Answer Events + Flashcard Self-Assessment — Design

**Date:** 2026-07-03 · **Status:** approved by David · **Roadmap ref:** `docs/IMPROVEMENT-ROADMAP.md` §P0-A / A1

## 1. Problem

The game has no per-item learning memory. `scene_attempts` stores only aggregate `correctCount/totalCount` per scene — never *which* character or word was missed, nor which wrong choice was picked. Review flashcards always report success (single "Got it →" button), so review sessions produce zero signal. This blocks targeted review (A2) and parent insights (A3).

## 2. Goal (this PR)

Write-only telemetry: every meaningful answer becomes one row in a new `answer_events` table, and the review flashcard becomes a 3-way self-assessment. **No reads, no UI over the data, no behavior change to scoring/rewards.**

David's decisions (2026-07-03, AskUserQuestion):
- Flashcard ratings are **log-only** — all three buttons advance normally; no repeat-at-end, no practice weighting (that's A2).
- V1 surface scope: **flashcard + all one-shot MCQ practice scenes + boss questions + homework + study mode.** Deferred: lianliankan/word_match pair logging, map final boss.

## 3. Data model

New table `answer_events` (migration 0034, purely additive; source of truth `src/db/schema/game.ts` or a new `answer-events.ts` schema file):

| column | type | notes |
|---|---|---|
| `id` | uuid PK defaultRandom | |
| `child_id` | uuid NOT NULL FK → child_profiles ON DELETE CASCADE | |
| `week_id` | uuid nullable FK → weeks ON DELETE SET NULL | null for study mode |
| `source` | text NOT NULL | `'review' \| 'practice' \| 'boss' \| 'homework' \| 'study'` — plain text, NOT a pgEnum (precedent: `avatar_items.theme`, `child_profiles.gender`), validated app-side by a zod enum. Future sources (`'final_boss'`, `'daily_review'`) need no migration. |
| `scene_type` | text NOT NULL | e.g. `flashcard`, `audio_pick`, `image_pick`, `image_word`, `translate_pick`, `sentence_cloze`, `boss_question`, `homework_char_quiz`, `homework_word_building`, `homework_sentence_order`, `study_picture_word`, `study_audio_picture`. Text for the same reason. |
| `character_id` | uuid nullable FK → characters ON DELETE SET NULL | the tested target |
| `word_id` | uuid nullable FK → words ON DELETE SET NULL | when the target is a word |
| `item_key` | text nullable | fallback identity when no char/word FK applies (study card slug, homework item id) |
| `correct` | boolean nullable | **null for flashcard self-assessments** (exposure, not a test) |
| `self_rating` | text nullable | `'got_it' \| 'not_sure' \| 'dont_know'` — flashcard only |
| `picked_key` | text nullable | identity string of the choice actually tapped (usually a characterId/wordId/text) — feeds future confusion-pair analysis |
| `created_at` | timestamptz NOT NULL defaultNow | |

Indexes: `(child_id, character_id)`, `(child_id, created_at)`.

Row-shape invariant (enforced by the zod schema, not the DB): exactly one of {`correct` set} or {`self_rating` set}.

## 4. Transport — events piggyback on existing finish actions

Client scenes accumulate `SceneAnswerEvent` objects; the runner flushes them as a new **optional** `events` field on the already-auth-gated finish actions:

- `finishAttemptAction` (SceneRunner: review/practice/boss) — `FinishAttemptSchema` gains `events: z.array(AnswerEventSchema).max(40).optional()`.
- `finishHomeworkAction` (HomeworkRunner) — same optional field.
- The study-mode finish action (StudyRunner) — same optional field.

Server side: new `src/lib/db/answer-events.ts` exporting `logAnswerEvents(childId, weekId, source, events)` (single batched INSERT). Each action calls it **after its primary writes, wrapped in try/catch** (the `safeAwardXp` pattern) — a logging failure logs to console and never fails the action. `source` and `weekId` are set server-side from the action's own validated context, not trusted from per-event client data; `childId` comes from `requireChild`.

Rejected alternative: a standalone `logAnswerEventsAction`. It would add a new public RPC endpoint (PR #112 landmine class) needing its own `requireChild`, plus an extra round trip per scene. The piggyback rides existing auth and adds zero endpoints.

Abuse bound: array capped at 40/call; malformed events are dropped individually (zod `safeParse` per element), never throwing.

## 5. Client wiring

**`MultipleChoiceQuiz`** gains optional `onResult?: (r: { pickedKey: string; correct: boolean }) => void`, invoked inside `handlePick` (the quiz is one-shot, so the first tap is the complete answer record). No behavior change when absent.

**MCQ scenes** (`AudioPickScene`, `ImagePickScene`, `ImageWordScene`, `TranslatePickScene`, `SentenceClozeScene`) gain optional `onAnswerEvent?: (e: SceneAnswerEvent) => void`. Each maps `onResult` to an event carrying its target (`characterId` and/or `wordId`), its `scene_type`, `correct`, and `picked_key` (the scene's choice key — already a stable id per the shuffle landmine).

**`SceneRunner`** holds `eventsRef = useRef<SceneAnswerEvent[]>([])`, passes `onAnswerEvent={(e) => eventsRef.current.push(e)}` to scenes, sends `events: eventsRef.current` in `finishAttemptAction`, and clears the ref in `advance` after the call. `source` derives from the existing `section` prop.

**`BossScene`** gains the same `onAnswerEvent` prop and emits one event per internal question at answer time (`scene_type: 'boss_question'`, target from the question object). Events accumulate in SceneRunner's ref across the whole boss gauntlet and flush with the boss's single `finishAttemptAction` call.

**`HomeworkRunner` / `StudyRunner`** follow the same accumulate-and-flush pattern into their own finish actions (`item_key` = homework item id / study card slug when no char/word FK applies).

**`SceneAnswerEvent`** type lives in a client-safe module (e.g. `src/lib/play/answer-events.ts` — types + zod schema only, no db imports) shared by scenes, runners, and actions.

## 6. Flashcard self-assessment UI

Replace the single `Got it →` `WoodSignButton` in `FlashcardScene` with three buttons (bilingual rule, ZH first):

- **认识 / Got it** — green accent
- **不确定 / Not sure** — amber accent
- **不认识 / Don't know** — rose accent

All three call `onComplete` exactly as today (SceneRunner still calls `advance(true)`; score stays 100). Review completion, coins, cards, boss-unlock are all **unchanged — honesty is never punished.** The only difference is the emitted event: `{ scene_type: 'flashcard', self_rating, correct: null, characterId }`. FlashcardScene therefore also gains the `onAnswerEvent` prop and needs the target `characterId` (already available in SceneRunner's `case 'flashcard'` data mapping — thread it through).

Tap targets ≥44px; layout stacks on narrow screens, row on wide; no motion added (nothing for reduced-motion to disable).

## 7. Deferred (explicitly out of scope)

- Lianliankan / word_match pair-mismatch logging (noisy signal, fiddly wiring).
- Map final boss (`finishFinalBossAction`) wiring — fast-follow; `source` union already accommodates it.
- ALL reads of `answer_events` (A2 review loop, A3 parent insights, confusion-pair analysis).
- Any repeat/weighting behavior driven by flashcard ratings.

## 8. Testing (~10–14 unit tests, all boundaries mocked per hard rule)

- `answer-events` db layer: batched insert shape; per-element drop of malformed events (mock `@/db`).
- `finishAttemptAction`: events written with server-derived child/week/source; a **throwing** `logAnswerEvents` does not change the action's return (guarded fire-and-forget).
- `FlashcardScene`: renders 3 bilingual buttons (regression net vs single-language); each advances; each emits the right `self_rating`.
- `MultipleChoiceQuiz`: `onResult` fires once with tapped key + correctness; absent prop = no crash.
- One MCQ scene (e.g. `TranslatePickScene`): `onAnswerEvent` payload carries target + picked key.
- `BossScene`: emits one event per answered question.
- Homework/Study runners: events included in their finish calls.

Test-writing landmines: any test importing a `@/lib/db/*` or actions module must `vi.mock('@/db', () => ({ db: {} }))` (CI-only failure otherwise); actions under test may need `vi.mock('@/lib/db/continent-rewards', ...)` etc. per existing patterns.

## 9. Ops / rollout

- Migration 0034 auto-applies on Vercel build (`tsx scripts/migrate.ts && next build`). No recompile, no seed script, no Blob operations.
- Landmine ack: a local `pnpm build` on this branch applies 0034 to prod early — additive and harmless, but don't run it casually.
- Rollback: the table is write-only; reverting the code stops writes and nothing reads it. Table stays (append-only rule).
