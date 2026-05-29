# PR #48 — Story Mode (Yinuo-as-protagonist generative narrative)

**Date:** 2026-05-29
**Status:** Design — pending plan + implementation
**Owner:** David (parent), Yinuo (player)

---

## 1. Goal

Lift hanzi-quest from "vocab drill with a pirate skin" to "Yinuo starring in her own 30-chapter pirate book". Each completed week ends with a unique bilingual story chapter starring her — using her current vocabulary, her layered-SVG avatar, her equipped pet, and persistent across-week memory. The boss-clear score colors the chapter's tone, so the existing boss mechanic gains real narrative stakes for the first time.

---

## 2. Why this, not Daily Quests

Daily Quests are a habit-formation mechanic — useful but mechanical. Story Mode is an *identity* feature. Yinuo (6, English-native heritage learner, UK-based) is the diaspora kid whose Chinese vocabulary is a thread to who she is. Putting her *in* the story turns each week from a drill into a chapter of her own life. The cost is meaningfully higher (DeepSeek call per child per week + new surface), but the emotional payoff and shareability with grandparents is the highest-leverage thing we can do with the existing engine.

---

## 3. Scope

### In v1 (this PR)

- One bilingual chapter generated per child per completed week
- Boss-score-weighted tone (triumphant / standard / narrow_escape)
- Persistent rolling memory: each chapter contains a 2-bullet summary used to seed the next chapter's prompt
- Hero card: Yinuo's existing `AvatarRender` + equipped pet over a treasure-map background — **no AI-generated scene illustration**
- Browser Web Speech API for ZH audio playback (free, instant, no infra)
- Home page "📖 latest chapter" pill — visible only when there's an unread chapter
- Backpack "📖 Story Library / 故事书" hall card — long-term archive
- 1 new trophy: `first_chapter` (granted on first chapter generation)
- DeepSeek V2 schema extension: chapter output structured JSON

### Out of scope (explicit deferrals)

- AI-generated scene illustrations (Pollinations/Gemini path remains deferred per PR #47 closeout — text + her own SVG avatar is the v1 shape)
- Branching choices ("which path do you take") — boss-clear score is the only branching signal in v1
- Recorded voice narration (grandparents' voices etc. — that's the separate "Family Bridge" direction)
- Multi-child surface design — Yinuo is the only player, defer multi-child story collisions
- Story re-generation UI for parents — if a chapter is bad, parent can DELETE the row from DB and it'll regen on next visit
- Localizing chapter generation language away from Mandarin / English — only language pair we author
- Streaming the DeepSeek response — generation is short enough (~15s) that a loading skeleton beats streaming infra

---

## 4. User flow

### Happy path (chapter exists, unread)

1. Yinuo clears the boss for week N
2. `finishLevelAction` returns success with bonuses (coins etc.)
3. Boss-clear celebration page shows reward summary as today
4. **NEW:** A "📖 你的故事 - Read your chapter" button appears alongside the existing "回家 / 回到地图" button
5. She taps → `/play/[childId]/story/[weekId]`
6. Server reads `story_chapters` for (childId, weekId)
   - If present (eager-generated at boss-clear) → render immediately
   - If absent → run `generateStoryChapter(childId, weekId)` synchronously inline behind a loading skeleton ("✨ Captain Yinuo's Log is being written...")
7. Chapter view renders (see §6 UI)
8. After mount, client-side `markChapterReadAction(chapterId)` writes `read_at = now()` so the home pill disappears next time
9. "回家" returns her to `/play/[childId]`; the home pill is gone

### Returning to old chapters

1. Yinuo taps 🎒 Backpack from the nav
2. Atlas Hub shows hall cards (5 packs + trophies + **NEW:** Story Library)
3. She taps Story Library → grid of unlocked chapter cards (sorted newest first), each card shows her avatar + chapter number + a 1-line teaser from `body_zh`
4. Tap a chapter → same chapter view as above (read-only; `read_at` is already set)

### Eager generation (background)

- `finishLevelAction` for the boss kicks off `generateStoryChapter(childId, weekId)` *without await* (fire-and-forget) immediately after marking the boss cleared
- 95% of the time, by the time Yinuo taps the "read your chapter" button, generation is complete and the story page is instant
- 5% (slow DeepSeek + fast tap), the story page synchronously calls `generateStoryChapter` itself behind the loading skeleton — idempotent via `UNIQUE (child_id, week_id)`

---

## 5. Architecture

### Data model

New migration `drizzle/0017_story_chapters.sql`:

```sql
CREATE TYPE story_tone AS ENUM ('triumphant', 'standard', 'narrow_escape');

CREATE TABLE story_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  body_zh text NOT NULL,
  body_en text NOT NULL,
  summary_for_next text NOT NULL,
  tone story_tone NOT NULL,
  boss_score_pct integer NOT NULL CHECK (boss_score_pct BETWEEN 0 AND 100),
  read_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (child_id, week_id)
);

CREATE INDEX story_chapters_child_created_idx ON story_chapters (child_id, created_at DESC);
```

Schema source: `src/db/schema/story.ts` (new file).

### Generation pipeline

Single new action `generateStoryChapter(childId: string, weekId: string)` in `src/lib/actions/story.ts`:

1. Idempotency guard: `SELECT 1 FROM story_chapters WHERE child_id = $1 AND week_id = $2` — if found, return existing chapter
2. Fetch context:
   - Child profile (display_name, equipped avatar slots, equipped pet)
   - Week vocab: current week's characters + words via existing `getCharactersWithDetailsForWeek`
   - Prior-weeks vocab: all chars from weeks where `child_id` has cleared the boss, ordered by week sequence — used for "mastered chars" pool
   - Prior chapter summary: `SELECT summary_for_next FROM story_chapters WHERE child_id = $1 AND week_id = (prior week id) LIMIT 1` — or empty string if no prior
   - Boss score: derive `boss_score_pct` from the latest boss `scene_attempts` row for this week
   - Tone derivation: `triumphant` if `>= 95`, `narrow_escape` if `< 67`, else `standard`
3. Build DeepSeek prompt (see §7)
4. Call DeepSeek with structured JSON output: `{ body_zh: string, body_en: string, summary_for_next: string }`
5. INSERT row with idempotency: `INSERT ... ON CONFLICT (child_id, week_id) DO NOTHING RETURNING *`
6. Grant `first_chapter` trophy via existing `checkAndGrantTrophies(childId, { kind: 'story_chapter_generated' })`
7. Return chapter row

DeepSeek failure (timeout, parse error, content too short) → throw `StoryGenerationError` (pure error class in `src/lib/errors/story-errors.ts`). The story page catches this and renders a retry button. Boss completion is NOT affected — story is a reward layer, not a gate.

### Surfaces

```
src/app/play/[childId]/
  page.tsx                          # add LatestChapterPill (between WeekStrip and KidNavBar)
  story/[weekId]/page.tsx           # NEW: chapter view (server component)
  collection/page.tsx               # add Story Library hall card to AtlasHub
  collection/story-library/page.tsx # NEW: grid of unlocked chapters
  level/[weekId]/boss/page.tsx      # add "📖 Read your chapter" button to boss-complete celebration
```

```
src/components/play/
  LatestChapterPill.tsx             # NEW: home pill, only renders if unread chapter exists
  story/
    ChapterCard.tsx                 # NEW: hero card (avatar + pet over treasure-map bg)
    ChapterBody.tsx                 # NEW: ZH text + 🔊 button + EN text
    ChapterAudioButton.tsx          # NEW: 'use client' Web Speech API wrapper
    StoryLibraryGrid.tsx            # NEW: grid of chapter cards for the Backpack archive
```

```
src/lib/
  actions/story.ts                  # NEW: generateStoryChapter, markChapterReadAction, listChildStoryChapters
  db/story.ts                       # NEW: pure queries (UNIQUE-aware insert, list, get-by-week)
  errors/story-errors.ts            # NEW: StoryGenerationError, ChapterNotReadyError
  ai/deepseek-story.ts              # NEW: prompt builder + structured-output caller
```

Existing files to touch:
- `src/lib/actions/play.ts` — `finishLevelAction` for boss-section fires eager-generate
- `src/components/play/KidNavBar.tsx` — no change (we intentionally did NOT add a 5th tab)
- `src/components/play/AtlasHub.tsx` — add Story Library hall card
- `src/components/scenes/BossCompletionPanel.tsx` (or equivalent) — add "📖 Read your chapter" button when story chapter exists or generation is in-flight
- `src/db/schema/index.ts` — re-export new `story_chapters` schema

---

## 6. UI shape

### Chapter view (`/play/[childId]/story/[weekId]`)

Vertical layout, treasure-map themed background (`TreasureMapBackdrop` already exists):

```
┌────────────────────────────────────┐
│   ← 回家                           │  ← back arrow only
├────────────────────────────────────┤
│                                    │
│         [hero card]                │  ← ChapterCard
│    AvatarRender + equipped pet     │
│    composited on a parchment frame │
│                                    │
│  ✨ 第3章 / Chapter 3 ✨           │
│  "Triumphant" tone gold-tinted     │
│  outline; "narrow_escape" tone     │
│  gets a torn-edge parchment        │
│                                    │
├────────────────────────────────────┤
│                                    │
│  [ZH body — 2-3 short sentences]   │  ← ChapterBody
│  🔊 Read aloud                     │
│                                    │
│  [EN body — 40-60 words]           │
│                                    │
├────────────────────────────────────┤
│       [回家 button]                │
└────────────────────────────────────┘
```

Tone-specific decoration:
- `triumphant`: gold border on chapter card + small confetti animation on mount (respects `prefers-reduced-motion`)
- `standard`: parchment border, no decoration
- `narrow_escape`: slightly torn-edge parchment border, slight desaturation

### Latest Chapter Pill (home page)

```
┌────────────────────────────────────┐
│ [Avatar header + coin pill]        │
│ [📍 加勒比海 ⬇ MapHeaderPill]      │
│ [Check-in strip]                   │
│ [WeekStrip / islands]              │
│                                    │
│   ╔══════════════════════════╗     │  ← LatestChapterPill
│   ║ 📖 你最新的故事           ║     │     only when unread
│   ║ Captain Yinuo, Chapter 3 ║     │     chapter exists
│   ║ "The Coral Caverns" >    ║     │
│   ╚══════════════════════════╝     │
│                                    │
│ [KidNavBar bottom]                 │
└────────────────────────────────────┘
```

- Hidden entirely when `read_at IS NOT NULL` for the latest chapter
- Tap → straight to `/play/[childId]/story/[latestWeekId]`
- Renders with a subtle gold pulse animation to draw the eye (reduced-motion safe)

### Story Library (`/play/[childId]/collection/story-library`)

Standard `PackPageBody`-style grid (reuse existing `Pack*` components by extending the `packRegistry` semantics, OR write a small standalone page — see §11). 3-column grid of `StoryChapterCard` (mini hero card + chapter number + 1-line zh teaser). Sorted newest-first. No paid pull; just an archive.

---

## 7. DeepSeek prompt

System prompt (constant):

```
You are a children's book author writing a bilingual pirate adventure chapter book for a 6-year-old English-native heritage learner of Mandarin Chinese. The hero is always the same child. Each chapter is a short scene in their ongoing adventure.

Output strict JSON with three fields:
- body_zh: Chinese text, 2-3 short sentences. Use only Chinese characters from the provided "available characters" list. Favor characters from "this week's new vocab" — they should appear at least once each. Sentences must be natural and readable at age-6 level.
- body_en: English text, 40-60 words. Tells the same scene as body_zh but with richer detail and warmth. Names characters and places by name. Conveys the requested tone strongly.
- summary_for_next: 2 bullets (each prefixed "- ") summarizing what just happened in this chapter, written so the next chapter's author can pick up the thread. Mention any objects, allies, or locations introduced.

Do not use any character outside the available list in body_zh. Do not write more than 3 sentences in body_zh.
```

User prompt template (filled per call):

```
Hero name: Yinuo
Hero appearance: a young pirate with [hat description] and [top description]. [If pet equipped: "Her companion is a [pet name]."]

Available Chinese characters (use only these in body_zh):
{comma-separated list of all chars from cleared weeks + current week}

This week's new vocab (favor these in body_zh):
{comma-separated list of current week's chars}

Previous chapter ended with:
{summary_for_next from prior chapter, or "[This is the first chapter — start the adventure on the docks of a sunny port town.]"}

Tone for this chapter: {triumphant | standard | narrow_escape}
- triumphant: Yinuo crushed the boss with no mistakes. Write a victorious scene where she emerges in glory, the crew cheers, the treasure is rich.
- standard: Yinuo cleared the boss with a few stumbles. Write a satisfying scene where she finds what she's looking for through cleverness.
- narrow_escape: Yinuo barely cleared the boss. Write a scene where things went sideways but she scraped through with quick thinking. The treasure is modest but real.

Output strict JSON only. No commentary.
```

JSON schema enforced via DeepSeek's `response_format: { type: 'json_object' }` + a Zod parse on the response. Parse failure → `StoryGenerationError`.

Avatar / pet description: a small TS map `slotIdToDescription` in `src/lib/avatar/itemCatalog.tsx` already exists for shop labels; we extend each item with a `narrativeHint` string (e.g. `'red bandana'`, `'striped sailor tee'`, `'a chatty parrot'`). For unknown/legacy items, fall back to the slot label.

---

## 8. Audio (Web Speech API)

`ChapterAudioButton.tsx` is a `'use client'` component:

```tsx
function speakChinese(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'zh-CN';
  utt.rate = 0.85;  // slower for a 6yo
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
  return true;
}
```

Button states: idle (🔊 Read aloud) → playing (⏸ animated dots) → done (back to idle). Tap-again while playing cancels. If the API is unavailable, button hides itself silently. No fallback recording in v1 — text remains readable.

Quality varies across devices but iOS Safari, Android Chrome, and desktop Chrome/Edge all ship credible zh-CN voices. Yinuo's primary device is David's iPhone — verify the iOS voice before merge.

---

## 9. Error handling

| Failure | Behavior |
|---|---|
| DeepSeek timeout / 5xx | Story page renders error card with "Try again" button → re-calls action. Boss completion already succeeded; no game-state damage. |
| DeepSeek returns malformed JSON | Same as above — caught by Zod parse, surfaces as `StoryGenerationError`. |
| DeepSeek returns ZH with a character outside the available list | Log warning, accept the chapter anyway. The "use only these chars" rule is a guideline for the model, not a hard validator — too strict triggers infinite retry loops. |
| Eager generation fails silently in `finishLevelAction` | Caught by try/catch around the fire-and-forget call. Boss completion proceeds. Story page falls back to synchronous-with-skeleton generation on tap. |
| Network down on the client when tapping "Read your chapter" | Standard Next.js network error handling; the page is a normal server-component route. |
| Pet equipped at boss-clear but unequipped before tap | Chapter card uses the CURRENT equipped pet at render time — accept the drift; she gets to see herself as she is now. |

---

## 10. Trophies

One new trophy added to the existing seed in `scripts/seed-trophies.ts`:

| Slug | Name (ZH / EN) | Category | Trigger |
|---|---|---|---|
| `first_chapter` | 第一章 / First Chapter | `story` (new category) | First successful `story_chapters` insert for the child |

Extend `trophy_category` enum with `'story'` (drizzle migration alongside the schema migration).

Grant is wired into `generateStoryChapter` post-insert via existing `checkAndGrantTrophies(childId, { kind: 'story_chapter_generated' })`. Handler matches on `'story_chapter_generated'` and grants `first_chapter` if not already held.

---

## 11. Story Library — packRegistry or standalone?

Two options:

**(a) Extend `packRegistry`** to support a "story" pack kind. Reuses `PackPageBody`, `PackGrid`, `AtlasHallCard`. Story Library shows up alongside the 5 collection packs in the Atlas. Cost: card components must handle a non-emoji item, and pull semantics are inapplicable (no gacha).

**(b) Standalone story page** at `/play/[childId]/collection/story-library`. Reuses `AtlasHallCard` only (the entry point). Page is its own grid component (`StoryLibraryGrid`), simpler — no pack-registry contortion. Cost: small duplication of grid styling.

**Pick (b).** The pack registry is built around collectibles with rarity / gacha / item-cards; stories are 1:1 with weeks, ordered chronologically, no rarity, no pulls. Forcing it through pack semantics is the wrong abstraction. Cost of duplication is small.

---

## 12. Tests

Mocks per CLAUDE.md: `@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`, `@vercel/blob` (unused here but consistent), global `fetch`.

Coverage targets:

- `tests/unit/lib/actions/story.test.ts`
  - First chapter: no prior summary, uses "first chapter" prompt branch
  - Subsequent chapter: prior summary injected
  - Boss score 100 → tone=triumphant; 80 → standard; 50 → narrow_escape
  - DeepSeek returns invalid JSON → throws StoryGenerationError, no row inserted
  - Concurrent generation collision: second call returns existing row via ON CONFLICT
  - Trophy granted on first successful insert
  - Trophy NOT regranted on second insert

- `tests/unit/lib/db/story.test.ts`
  - UNIQUE constraint enforced at SQL level
  - Listing by child returns newest-first
  - markRead idempotency

- `tests/unit/components/play/story/ChapterCard.test.tsx`
  - Renders avatar + equipped pet
  - Tone class applied correctly
  - Reduced-motion path hides confetti

- `tests/unit/components/play/story/ChapterBody.test.tsx`
  - 🔊 button renders only when Web Speech API mocked-available
  - Tapping while playing cancels prior utterance

- `tests/unit/components/play/LatestChapterPill.test.tsx`
  - Hidden when `read_at IS NOT NULL` on latest chapter
  - Hidden when no chapter exists
  - Visible + correct copy when unread chapter present

- `tests/unit/app/story-page.test.tsx`
  - Existing chapter → renders immediately
  - Missing chapter → calls `generateStoryChapter` server-side
  - `generateStoryChapter` throws → error card renders

Add ~12 tests, projecting test total from 542 → ~555.

---

## 13. Cost

- **DeepSeek:** ~500 input tokens + ~300 output tokens per chapter call. DeepSeek V4 Pro pricing is ~$0.27 input / $1.10 output per million tokens. Per chapter: ~$0.0001 input + $0.0003 output = ~$0.0004. 30 chapters/year ≈ $0.012/year. Effectively free.
- **Postgres rows:** trivial.
- **No image gen** in v1.

Total marginal cost per Yinuo-year: <$0.05.

---

## 14. Verification

Before opening the PR:

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all green
2. Start `pnpm dev`, log in as Yinuo (via PIN bypass on dev), navigate to a completed-but-no-chapter week, force-trigger `generateStoryChapter` via a `scripts/dev-gen-chapter.ts` ad-hoc script → verify a row appears in `story_chapters`
3. Open `/play/[childId]/story/[weekId]` → chapter renders, hero card shows current avatar + pet, ZH + EN body present
4. Tap 🔊 → zh-CN voice plays the body audibly. Test on iOS Safari (Yinuo's primary device)
5. Reload home → LatestChapterPill renders linking to the chapter
6. Tap pill → chapter view loads, `markChapterReadAction` fires → return home → pill is gone
7. Backpack → Story Library hall card → grid shows the chapter, tap → chapter view loads
8. Force a boss-clear with `score=100` → next chapter generates with `tone=triumphant` → gold border + confetti
9. Force a boss-clear with `score=50` → next chapter generates with `tone=narrow_escape` → torn-edge frame
10. Toggle `prefers-reduced-motion` in DevTools → confetti suppressed, gold pulse on pill is static
11. Trophy 第一章 / First Chapter granted on first chapter
12. Delete a `story_chapters` row → revisit the page → fresh regeneration with same idempotency guards

---

## 15. Open questions (don't block plan)

These are flagged for future iterations, not v1 blockers:

1. **Voice quality.** If the iOS zh-CN voice is unusably robotic, pre-record David's voice for the 30 chapters and store URLs (~10 min of audio total). v2 work.
2. **Chapter regeneration UX.** Parent dashboard could grow a "re-roll" button per chapter for the rare case where DeepSeek produces something off-tone. Wait for first complaint.
3. **Multi-child collisions.** If a second child profile appears (e.g. younger sibling), prior chapter summaries are per-child correctly; no collision risk. UI may need a child-picker on the Story Library archive at that point.
4. **Cross-pack saga.** When map 2 (印度洋) opens, do prior chapters from 加勒比海 carry forward in memory? Probably yes (rolling summary is pack-agnostic) — but worth flagging in the prompt: "Yinuo just sailed from the Caribbean to the Indian Ocean." Will revisit.
5. **Sharing with grandparents.** A "send to 奶奶" button that screenshots the chapter card + saves as WhatsApp-friendly image is the natural cross-over with direction F (Family Bridge). Not in v1, but the chapter pages are designed to render cleanly to PNG for that future.

---

## 16. Landmines to write into CLAUDE.md when shipped

- DeepSeek structured output can return ZH text with chars outside the "allowed list" — accepted as best-effort; logged but not retried. Don't try to enforce strictly or you'll loop forever on edge cases.
- Story Library is the FIRST surface to deliberately bypass `packRegistry` — pattern established for future non-collectible "library" surfaces (e.g. recorded voice postcards in direction F).
- Eager generation in `finishLevelAction` is fire-and-forget — boss completion must not depend on its success. If you refactor `finishLevelAction`, preserve the try/catch around the eager call.
- Chapter `read_at` drives the home pill — server component re-fetches per render; no client cache. If the home page becomes cached aggressively, the pill will go stale. Use `revalidatePath('/play/[childId]')` from `markChapterReadAction`.
