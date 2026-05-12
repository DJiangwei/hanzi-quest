# Game design — hanzi-quest

This document describes **what we are building and why**, top-down. For *how it is implemented*, read [`ARCHITECTURE.md`](./ARCHITECTURE.md). For the per-phase shipping plan, read [`PLAN.md`](./PLAN.md).

> When a future change is about *behaviour* or *feel* (a button looks too cold, a level is too long, the boss isn't dramatic enough), the answer probably lives here. When the change is about *plumbing* (a column is missing, a query is slow), the answer probably lives in ARCHITECTURE.

---

## 1. The bet

A 6-year-old Chinese-heritage child living in the UK attends a weekend 汉字班. The school assigns ~10 characters per week. Practice at home is the gap: parents have no good materials. Generic Chinese learning apps drill the wrong characters and feel like homework.

We are building a **dedicated, fun, weekly reinforcement loop** scoped to *the characters her school is teaching right now*. The parent inputs (or selects from a class pack) the week's characters; AI fills in pinyin, words, sentences, image hooks; the child plays through a short, varied mini-game gauntlet that ends with a small reward. The bet: if practice for the *exact same chars* she just learned at school feels like a treasure hunt instead of a worksheet, she will come back **without being asked**, and the school's curriculum will stick.

Year-one target user: David's daughter Yinuo (海盗班 student). Year-two target user: other families in her class, then other classes — the same product, different packs.

### Why this beats existing tools
- **Duolingo / LingoChamp** drill a generic curriculum the school doesn't care about.
- **Worksheets / 字卡** her school sends home are static and unloved.
- **Bespoke iPad games** lack the school's *actual character list*.

The wedge is **curriculum alignment** — same chars she sees on Saturday morning, made fun on Sunday evening.

---

## 2. The 30-minute session, as designed

```
Sunday 6pm, on the couch with the iPad.

Parent (1 minute):
  Opens 汉字探险 → /parent → Yinuo's card shows '海盗班 Level 1 · 7/10 weeks ready'.
  Notices nothing to do — Yinuo's stage is already published. Hands the iPad over.

Yinuo (15 minutes):
  Lands on 'Yinuo 的航海图'. Sees 10 island nodes — 4 with gold stars
  (cleared), 3 in ocean teal (available), 3 grey (locked-conceptually,
  reachable but she's choosing in order).
  Taps Lesson 5: '叶' island.

  Gauntlet of 14 scenes, in order:
    • 10× 字卡: each character one card. Taps to hear the audio. Reveals
      pinyin if she's unsure. Big green 'Got it →' for each.
    • 听音选字: hears '日', taps the 日 hanzi among 4. Green flash.
    • 看字选音: sees '叶', picks 'yè' among 4. Right answer.
    • 看图选字: 'a smiling pile of green leaves' → picks 叶 among 4.
    • 字词配对: pairs 4 字 ↔ 4 words. Colour-coded matches.

  Each scene awards coins (50 / first time, 25 perfect bonus).
  At end: '🎉 Island cleared! Lesson 5 · +600 coins'. Treasure
  bag in top-right reads 🪙 2300.

Parent (2 minutes):
  Yinuo wants to play another. Lesson 6 island has a flag — she taps it,
  goes through 14 scenes again, ends in 4 minutes (familiar with the
  format). Total session: 22 min.

Parent thought: 'She did that for fun.'
```

The session has three sub-rhythms:
- **Macro (weeks)**: progression across islands.
- **Meso (level)**: 14-scene gauntlet, ~10-15 min.
- **Micro (scene)**: 5-30 seconds. Tap → feedback → next.

Designing each scene's tap-feedback-next loop to feel *good* is the single biggest UX investment.

---

## 3. Core loop

```
       ┌──────────────────────────────────────────────────┐
       │                                                  │
       ▼                                                  │
Parent inputs / picks class pack                          │
       │                                                  │
       ▼                                                  │
AI generates content (DeepSeek)                           │
       │                                                  │
       ▼                                                  │
Parent reviews/edits (~1 min/week)                        │
       │                                                  │
       ▼                                                  │
Parent publishes → 14 levels compiled                     │
       │                                                  │
       ▼                                                  │
Child plays island gauntlet ─────────────────────────────┐│
       │                                                 ││
       ▼                                                 ││
Coins earned → fed back into shop / gacha (Phase 5)     ││
       │                                                 ││
       └──── 'I want to play another island' ────────────┘│
                                                          │
       ╰──── 'New chars from school next Saturday' ───────╯
```

Loops sit at three scales:
1. **Scene reward loop (seconds)** — pick / answer / coin.
2. **Level reward loop (minutes)** — 14 scenes / fanfare / coin balance ticks up.
3. **Week reward loop (days)** — finish all islands of a stage → cap reward (gacha pull, future).

The product fails if any of the three feels lifeless.

---

## 4. Pedagogy — what makes it actually teach

Five rules we follow without exception.

### 4.1 Curriculum follows the school, not a generic ladder
Each Yinuo session reinforces *the chars she saw at school this week*. We do **not** introduce chars the school hasn't taught yet. The 海盗班 pack is one such curriculum source; per-family input is the same idea, different supplier.

### 4.2 Multimodal recall over passive recognition
Flashcards alone train recognition of the printed form. To know a character, a 6-year-old needs to map it to sound, meaning, image, and other characters. The five scene types cover the matrix:

| Scene | Stimulus → response | What it tests |
|---|---|---|
| `flashcard` | Show 字 + reveal | Passive recognition + sound association |
| `audio_pick` | Sound → pick 字 | Auditory recognition |
| `visual_pick` | Show 字 → pick pinyin | Sound recall from form |
| `image_pick` | Meaning hint → pick 字 | Semantic recall |
| `word_match` | 字 ↔ word | Compositional use |

(Phase 4 adds `tracing` for stroke memory and `boss` as a mixed gauntlet.)

A *level* visits all five modes for the same week's characters. The same chars are encountered ~5 times in 14 scenes through different lenses. That's the recall surface.

### 4.3 Pinyin is **hidden by default**
The child should look at 山 and read it. Pinyin is a crutch when always present. So in every scene, pinyin is hidden, with a "Tap to show pinyin" affordance for when she's stuck. A future setting can let parents disable the affordance entirely for late-stage learners.

### 4.4 Audio uses zh-CN tone-marked pronunciation, not numbers
AI is constrained (system prompt §1) to emit pinyin with tone marks (`shàng`), never numbers (`shang4`). TTS uses zh-CN Web Speech API today; will move to Azure Speech in V2 for higher-quality synthesis (Web Speech zh-CN voice on iPad Safari is uneven).

### 4.5 Content is age-appropriate without exception
The AI prompt has hard rules: meanings explained the way a parent would for a 6-year-old, no abstract nouns, no idioms, sentences ≤ 12 characters, words ≤ 4 characters and common in everyday speech (food / family / animals / school items). The few-shot example in `lib/ai/prompts/generate-week-v1.ts` is the calibrated baseline.

If we ever loosen pedagogical rules, do it *here* (in this doc) first, then in the prompt.

---

## 5. Aesthetics + narrative

### 5.1 Why pirates
The school's curriculum is published as "Giggling Panda Pirate" and the class is literally named "**海盗班**". The metaphor is free:

- **10 lessons = 10 islands**. A stage is the voyage from Island 1 to Island 10.
- **Coins = gold doubloons**. They're a currency a 6-year-old already understands from books / movies.
- **Boss = sea monster**. Weekly endgame. Big stakes.
- **Gacha = treasure chest**. The most visually satisfying moment we can build with a free art budget.
- **Avatar = pirate kid customisation**. Yinuo dresses her sailor up; reward beyond coins.

This isn't a marketing layer pasted on. It's the *semantic shape* of the mechanics. Don't redesign mechanics without checking they still fit the narrative.

### 5.2 Visual language
- **Palette**: warm ocean (teal as primary), sandy beige (page bg), sunset orange (CTA accents), treasure gold (rewards). Plus semantic green / red for correct / wrong. Token names in `globals.css` are `sand` / `ocean` / `sunset` / `treasure` / `good` / `bad`.
- **Shape language**: 16-24px rounded everywhere; soft / hand-drawn rather than razor-sharp.
- **Typography**: Fredoka (rounded friendly Latin) for chrome; Noto Sans SC for Chinese body; Noto Serif SC for the *display hanzi* (the big learning character) — closer to 楷书 textbook feel.
- **Iconography**: minimal emoji + custom SVG (compass, palm, wave). No icon-library brand collision (no Material Icons, no Heroicons in the child surface).
- **Mascot**: deferred until Yinuo validates the loop. If we commission one, it's a panda pirate captain (single Fiverr illustration with 4-6 expressions).

### 5.3 What we won't look like
- Not Duolingo (their pastel + owl is a different game).
- Not a textbook (no white pages with rows of cells).
- Not an AAA game (no photoreal water, no parallax scrolling).
- Not "Chinese-themed" in a stereotype way (no exoticised dragons, no kung-fu fonts).

---

## 6. Economy

### 6.1 Coins
| Event | Reward | Comment |
|---|---|---|
| Scene completed (first time) | +50 | The baseline. |
| Scene replayed | +5 | Diminishing reward; encourages new content. |
| Scene perfect (first time, all correct) | +25 bonus | On top of the +50. |
| Boss cleared (Phase 4) | +300 + 1 free gacha pull | The weekly cap reward. |
| Daily streak (Phase 5) | +20 / day continuous | Gentle pull to come back. |

A typical 14-scene level on first play awards roughly `14 × (50 + 25) = 1050` coins. By the end of a 10-island stage: ~10000 coins.

### 6.2 Shop, gacha, avatar (Phase 5)
- **Shop**: spend coins on avatar items, power-ups (revive, hint, streak freeze), consumables, pack vouchers. Tabs in `/shop` per `kind`.
- **Gacha**: a free pull on boss clear; paid pulls cost coins. Active pack in V1 is **12 zodiac cards** — themed treasure chest reveal. Drop weights are stored per-item (`drop_weight`).
- **Shards** (卡屑): duplicates from gacha don't become useless; they convert to shards. 100 shards → 1 free pull voucher. Per-pack balance so packs feel independent.
- **Avatar**: slot-based (head / hat / top / background, …). Items unlock via shop, collection completion, or achievements.

### 6.3 Where money is balanced
A 6-year-old can clear a level in ~10 minutes on first play. Coins per minute = ~100. Shop items should be priced so something feels affordable after **one** level cleared, and something feels aspirational after **a week's worth**. Specific item prices are tuned in Phase 5.

### 6.4 What economy is *for*
The economy isn't a monetisation layer (we don't sell coins). Its job is to **make the next session feel earned** — a coin pile that grows is a parental-positive way to say "come back tomorrow."

---

## 7. Difficulty + pacing

### 7.1 Session length budget
A 6-year-old can sustain focus for **10-15 minutes** of new task. Beyond that, even fun things drag. The 14-scene gauntlet was calibrated to fit that envelope at a normal play pace; if Yinuo hits the end and asks for another island, the meso loop is right; if she stops mid-island, we shorten.

### 7.2 Per-week novelty
Within a week's 14 scenes, the same 10 chars rotate through different modalities. The same 4-choice question on the same char isn't repeated; distractors come from same-week characters (not a global pool — yet) so difficulty stays consistent.

### 7.3 Across weeks
Each new lesson surfaces 10 new chars (or 8 for the truncated lessons 9-10 in 海盗班 Level 1 — the school packs aren't always perfectly 10). The compile-week pipeline doesn't currently re-test old chars in later weeks; **Phase 5 (or later) introduces light spaced retrieval** by mixing old chars into new-week distractor pools. We deliberately did *not* build a full SRS algorithm (see §9).

### 7.4 Failure handling
- Scenes do not "fail" — they record correct / incorrect. A 6-year-old's first wrong attempt is information, not punishment.
- Boss (Phase 4) is the only structurally challenging scene: 10-question gauntlet, 3 lives, revive available from inventory. Losing a boss costs time, not coins.

### 7.5 Calibration is empirical
The accuracy and time signals come from `scene_attempts.score`, `scene_attempts.completed_at − started_at`, and `week_progress.total_time_seconds`. The first calibration target: David watching Yinuo play.

---

## 8. Class packs and curriculum sources

### 8.1 Per-family vs class-shared (data model)
See ARCHITECTURE §4. The same `weeks` table holds both. A class-shared week has `parent_user_id = NULL` and `child_id = NULL`, and is played by every child whose `current_curriculum_pack_id` matches. AI generation runs **once** for a class pack — every child sees the same content. Per-family weeks are still possible (parent can add extra chars) and stack on top of the class pack.

### 8.2 Existing packs
- `pirate-class-level-1` (slug) — "海盗班 Level 1". 10 lessons, 96 characters, seeded 2026-05-10 from David's PDF. AI content cost ~$0.05 total to generate.

### 8.3 Future packs
- Other levels of the same school (Level 2, 3, …) — same pack-creation pattern, different lesson lists.
- **节日 collection pack** for cultural content (春节 / 中秋 / etc.) — a separate axis from the school packs, surfaced as bonus islands or a sidebar adventure.
- Standard curricula (部编版 Y1 上, HSK 1, …) — same pattern, larger lesson lists.

A future parent-side flow lets a parent **pick a class** for each child rather than only inputting their own chars. The child can then switch packs mid-stream (Phase 5+).

---

## 9. Non-goals

These are things we will *not* build in V1 unless evidence demands it.

| Non-goal | Why not (yet) |
|---|---|
| **Adaptive SRS / spaced repetition algorithm** | Premature — we don't have weeks of play data yet to know what intervals work for a 6yo. A naïve "review old chars in new-week distractor pools" already buys us 80% of the benefit. |
| **OCR auto-extraction of parent-supplied 字表 PDFs** | The Vercel AI Gateway is currently disabled (credit card). Claude in the chat doing the extraction manually is the fallback; productising vision OCR waits for either Gateway re-enablement or a separate vision provider. |
| **Parent leaderboards / family rankings** | Risk of turning the app competitive and shaming low-effort weeks. Single-family use case doesn't need it. |
| **Real-time multiplayer** | 6-year-olds don't co-play well at this age; the social hook (showing friends your collection) is enough. |
| **Voice recognition (pronounce the character)** | iPad Safari support is poor; pedagogy benefit unproven for 6yo (TTS-driven listening is already enough recall load). |
| **Teacher dashboard** | Out of scope until a school asks for one. |
| **A custom illustrated character set commissioned upfront** | We default to free assets (Lottie + emoji + curated SVG) until Yinuo validates the loop. A bespoke mascot costs $50-150 once the case is made. |

---

## 10. Open questions for future calibration

1. **Are 14 scenes too many for the first play of an island, but too few for the third?** Watching Yinuo will answer this. We may want an "express mode" replay (subset of scenes) once a child has cleared an island once.
2. **Should the gacha drop weights bias towards new items** (so a child completing the zodiac feels rewarded for variety) **or stay uniform** (closer to a fair lottery)? Tunable in `collectible_items.drop_weight`.
3. **Will Web Speech zh-CN TTS be good enough on iPad?** Early observation: passable on Mac Safari, mediocre on iPad. Azure Speech is queued behind this.
4. **Should the avatar feel like Yinuo or like a separate character?** Self-representation often deepens engagement at this age. Default plan: Yinuo herself as the captain.
5. **Stage cap reward** — what happens when she clears all 10 islands of 海盗班 Level 1? Today: nothing special. Likely V1.5: a "complete-stage" prize (full gacha pack reveal or a unique avatar background).

---

## 11. Pointers
- Schema, deployment, "how to add a scene": [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Phase status + per-PR shipping log: [`PLAN.md`](./PLAN.md)
- Locked-in colour palette + font choices + asset strategy: `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/art_direction.md`
