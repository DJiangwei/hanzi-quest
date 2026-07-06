# Improvement Roadmap — hanzi-quest

> **Audience: future Claude/agent sessions.** This is THE bundled improvement + future-direction plan (first written 2026-07-03 after a whole-project review; expanded same day with the vocabulary-growth brainstorm David requested). Each item states *why*, *what evidence to check first*, *a concrete first PR*, and *guardrails*. Before starting ANY item: (1) re-verify its evidence against current code — this doc rots like any doc; (2) **confirm with David via AskUserQuestion** (CLAUDE.md hard rule: always confirm before starting a new PR); (3) respect the locked decisions in CLAUDE.md §Hard-rules and GAME-DESIGN.md §9 non-goals.
>
> Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (update in place when you ship a slice).

---

## How to use this doc (for agents)

1. Read CLAUDE.md first (auto-loaded). This doc is the "what should we do next and why" layer on top of it.
2. Pick the highest-priority unblocked item, verify its evidence section still holds, then propose it to David with a recommended option.
3. When you ship a slice, flip its checkbox here AND update CLAUDE.md per its curation rule.
4. If you disagree with a priority after looking at fresh play data, say so to David — this doc is a strong default, not a lock.

---

## North star: the growth flywheel

The product's long game is that **the child's known-character set grows every week, and the game must grow with it**. Today (~2026-07) Yinuo knows the ~96 Map-1 characters; Map 2 adds ~100 more; at this pace the set crosses 300 within two school years. Each stage unlocks mechanics that were impossible at the previous one:

| Stage | Known chars | What becomes possible | Keystone workstreams |
|---|---|---|---|
| **1 — Recognize** (now) | 0–150 | Per-week learning loops (shipped); per-item telemetry (A1, shipped) | A2 review, V1 mastery model |
| **2 — Discriminate** | 150–300 | Distractors drawn from the FULL learned set; confusable-pair drills (shape/sound/radical); composition play (known char + known char = new word) | V2 smart distractors, V3 word forge |
| **3 — Read** | 300+ | **Decodable readers**: short stories written ONLY with known characters — the literacy-pedagogy gold standard, and the payoff that makes years of collection grind meaningful | V4 readable stories |

The flywheel: telemetry (A1) → mastery model (V1) → smarter review + distractors (A2/V2) → faster real learning → more known chars → richer content (V3/V4) → more play data. Every new feature should ask: *does this scale with the known-character set, or is it another fixed-size attraction?* Fixed-size attractions (packs, cosmetics, seasons) are retention seasoning — the flywheel is the meal.

---

## P0-A · Learning intelligence

**Why.** The product's mission is *learning Chinese*, but until 2026-07 the game had no memory of what the child struggles with. Consequences: no targeted review, no cross-week retention loop, and David authors homework blind. GAME-DESIGN.md §9's "no SRS" non-goal was conditioned on "no play data yet" (Oct 2025) — that condition no longer holds, and §9 itself blesses the naive alternative ("old chars in new-week distractor pools buys 80%"). Full SM-2 SRS remains out of scope.

### A1 — Per-answer event logging `[x]` (shipped 2026-07-03, PR #132)
`answer_events` table (migration 0034): source/scene_type/character/word/item identity, correct, `picked_key` (wrong choice tapped), and the flashcard **认识/不确定/不认识 self-assessment** David requested (log-only; all three advance as success). Write-only in v1. See the CLAUDE.md landmine before touching it.

### A2 — Cross-week review loop `[ ]`
Two cheap slices, in order:
1. **Stale-char distractors**: when compiling a new week, draw some MCQ distractors from *previously cleared weeks'* characters. Passive re-exposure, zero new UI. Needs `recompile-all-weeks.ts` post-merge.
2. **温故 / Daily mixed review**: a small home-surface session (5–8 questions) sampled from cleared weeks, weighted by A1 error rates + `dont_know`/`not_sure` self-ratings (fallback: least-recently-seen). Reuse `MultipleChoiceQuiz` + the StudyRunner pattern; reward consciously (daily-cap-consuming `'daily_review'` card source, mirroring `'study'`).
- Guardrails: short and optional — don't gate anything on it. Bilingual chrome rule.

### A3 — Parent insight page `[ ]`
`/parent/children/[id]/insights`: per-character accuracy, most-missed list, confusion pairs (from `picked_key`), self-rating distribution, activity trend. Pure read over `answer_events` + `coin_transactions`. Closes the loop into David's homework authoring. Parent-facing → bilingual rule exempt. Guardrails: `(secured)` route group; scope via `getChildOwnedBy`.

---

## V · Evolution workstreams (scaling with vocabulary growth)

These are the "evolve as the user learns more characters" arc. Ordered by dependency, not strict priority — V1 unblocks the rest.

### V1 — Mastery model + visible growth (航海日志 / Captain's Logbook) `[ ]`
**What:** a derived per-character mastery score (0–3 stars) computed from `answer_events`: accuracy, recency, streak of correct answers, self-ratings. Pure function in `src/lib/mastery/` (e.g. `masteryForChar(events): 0|1|2|3`), NO stored column at first — compute on read, cache later if slow. Surface it kid-first: a **Logbook** page (Backpack hall card) where every learned character is an entry with stars — the collection instinct pointed at the actual learning content. "字 as collectibles" makes vocabulary growth *visible and owned* by the kid.
**Why now-ish:** cheap once A1 data accumulates (~4–6 weeks of play); it's the substrate for V2 review weighting, the captain's exam (V5), and A3.
**Guardrails:** mastery is *informational + weighting input*, never a gate (no "you can't play until 3 stars"). Thresholds live in one tunable module. Don't add a DB column until read-time computation is measurably slow (the corpus is tiny — hundreds of chars × thousands of events).

### V2 — Smart distractor selection `[ ]`
**What:** today distractors are random same-week picks (`sampleDistractors`). As the learned set grows, upgrade selection: (a) draw from ALL learned chars (A2 slice 1); (b) prefer *confusable* distractors — same radical, similar shape (precomputed similarity list, static TS data like flagsData), similar pinyin (initial/final/tone-off-by-one), or empirically-confused pairs from `answer_events.picked_key`. Difficulty then scales naturally with vocabulary — no new mechanics, no UI change.
**First PR:** a pure `rankDistractors(target, candidatePool, confusionData)` in `src/lib/scenes/`, used by compile-week or runtime pickers; start with pinyin similarity (derivable from existing `pinyinArray`, zero new data).
**Guardrails:** keep a randomness floor (never 4 maximally-confusable options for a 6yo — blend 1 hard + 2 random); scene shuffle landmine (stable-id keyed memo) still applies.

### V3 — Word forge / composition play (组词工坊) `[ ]`
**What:** a discovery mechanic over the vocabulary graph: known characters combine into words (我+们→我们). Kid drags/taps two known chars; if the combination is a real curriculum word (or a curated bonus word list), it's "forged" — added to a discovered-words shelf, small reward. Uses existing `words`/`character_word` data; the joy is *"I can make new words from what I know"*, which compounds as the char set grows.
**Scope guard:** start as a Backpack/home surface (not a compiled scene type — no migration/recompile); validate against the words table + a static bonus list. Confirm appetite with David before building — it's a new mechanic, not a fix.

### V4 — Decodable readers (known-chars-only stories) `[ ]` — **the stage-3 payoff**
**What:** short readable stories (3–6 sentences) using ONLY characters the child has learned, unlocked as the set grows ("你已经认识 120 个字,能读这个故事啦!"). This is what makes the whole journey pay off — real reading.
**How, realistically:** Story Mode is HIDDEN (#93) because DeepSeek's ZH quality disappointed, and the "available chars" rule was best-effort (documented landmine: don't strict-validate generative output). So flip the approach for readers: **constraint-checked, not generation-trusted** — either (a) David/agent-curated static story bank tagged with required-char sets (committed TS data, like flags), unlocked when `knownChars ⊇ required`; or (b) AI-drafted then **human-reviewed before publish** through a parent-review flow like week authoring. Start with (a): even 10 hand-written stories beat an unreliable generator. Device TTS read-aloud per sentence (correct-text rule).
**Guardrails:** don't resurrect `STORY_HIDDEN` paths for this — readers are a separate, simpler surface (no per-child generation, no chapters table needed for v1). Chinese decodable-reader quality is hard: David reviews every story before a kid sees it.

### V5 — Captain's exam / periodic assessment (阶段考核) `[ ]`
**What:** an opt-in, celebratory assessment every ~5 weeks or at map completion: ~20 questions sampled across ALL learned chars (reuse `buildFinalBossPhases` sampling), producing a mastery snapshot (feeds V1 stars + A3 insights) and a cosmetic reward. Framed as adventure ("船长考核"), never as a test with failure — completing it always rewards; the *data* is the point.
**Guardrails:** low frequency, always skippable, no gating. Distinct from the map final boss (which is a game challenge, not a measurement).

### V6 — Content pipeline at scale `[ ]`
Map 2 (印度洋) authoring is prepped (`seed-pirate-class-2.ts`, blocked on David's hanzi list) — **it outranks everything when unblocked**. Beyond it: Maps 3+ need only the documented recipes (voyage entry + overlord + champion set); consider aligning future weekly lists with Yinuo's actual school/textbook sequence (David decision); authoring-time validation script (`verify-week-content.ts`: every char has words, images, audio-able text, sentence) so a half-generated week can't reach a kid.

---

## P0-B · Docs & agent-context hygiene (cheap, compounding)

**Why.** CLAUDE.md has grown into a full per-PR history auto-loaded into *every* session — a large recurring context tax that buries the landmines. PLAN.md's shipping log froze at PR #17 (verified 2026-07-03) despite self-describing as "the roadmap + status log."

### B1 — Restructure CLAUDE.md `[x]` (shipped 2026-07-03: 20.8k → ~10.8k words; history → docs/CHANGELOG.md; landmines grouped, all preserved)
Move per-PR narrative history into PLAN.md §1's shipped table (one line each) or `docs/CHANGELOG.md`. CLAUDE.md keeps: current-state summary (a paragraph per subsystem), ALL landmines (grouped by subsystem), hard rules, triage table, codebase map, workflows. Target: cut 50–70% without losing a single landmine.
- Guardrails: high blast-radius docs PR — get David's sign-off on the structure first; never delete a landmine, only regroup.

### B2 — Keep PLAN.md honest `[x]` (shipped 2026-07-03: shipped table backfilled #18→#132 from git log; status blurb refreshed)
Backfill the shipped-PR table #18→current from CLAUDE.md/git log; add a curation rule: new PRs get one line in PLAN.md, prose only for landmines.

---

## P1-C · Ops & robustness hardening

**Why.** The scariest standing footgun: local `pnpm build` migrates the **prod** Neon DB (`.env.local` = prod, shared across all Vercel envs). Plus: no backups beyond free-tier retention, no error alerting — for a product now distributed to friends & family.

### C1 — Separate dev/preview database `[x]` (done 2026-07-04)
Neon `dev` branch (`ep-dry-bird-…`) created from prod; local `.env.local` + Vercel Preview/Development now point at it, Production keeps prod (`ep-steep-feather-…`). See the CLAUDE.md "DB environment topology" landmine for the prod-ops swap procedure, the sensitive-vs-encrypted CLI gotcha, and dev-branch data-reset instructions.

### C2 — Weekly backup `[x]` (shipped 2026-07-05)
`scripts/backup-db.ts` — pure-TS dump (no pg_dump needed): every public table → gzipped JSONL in `backups/` (gitignored), tables auto-discovered via information_schema. ~330KB for the whole DB. Targets `DATABASE_URL` (dev by default; swap to the `# PROD_DATABASE_URL` line for the real weekly prod backup). David: run it for prod on a loose weekly cadence.

### C3 — Error visibility `[ ]`
Lightest first: Vercel observability + log drain or Sentry free tier. Success metric: a thrown server-action error produces something David sees, not a silent 500 on a kid's iPad.

### C4 — Data-integrity check script `[x]` (shipped 2026-07-05)
`scripts/verify-integrity.ts` — 7 read-only code⟷DB drift checks (packs⟷registry both ways, avatar slots, trophies seed, reward cosmetics seed, shard-exclusive⟺gacha_eligible alignment, word art). Exit 1 on failure. Run after any PR whose post-merge ops include a seed script. 7/7 passing against the prod snapshot at ship time.

---

## P1-D · Real E2E safety net

**Why.** Unit tests (1590, excellent) mock every boundary, so the two recurring prod-only bug classes — RSC "functions passed to client components" and seed/migration drift against the real DB — are invisible to CI *by construction* (PackUiMeta hazard, avatar-slot FK violation, missing story_chapters table all reached prod). Playwright is configured; `tests/e2e/` has one smoke spec.

### D1 — Preview-deploy smoke suite `[x]` (shipped 2026-07-04)
Auth setup + 6 flows on every Vercel Preview deployment (`.github/workflows/e2e-preview.yml`, `deployment_status`-triggered): sign-in (Clerk testing token, email_code 424242) → parent provision (self-creates child "E2E测试") → kid home (voyage board) → week hub → flashcard play (real `finishAttemptAction` + answer-events write) → backpack/shop/calendar → maps. Runs against the dev DB branch (C1). See the CLAUDE.md e2e landmine.

---

## P1-E · Learning-modality gaps

### E1 — Writing / stroke-order practice `[ ]`
Biggest untouched modality. Use [hanzi-writer](https://hanziwriter.org) (free, MIT, stroke data, built-in finger-trace quiz — ideal on iPad). Slice 1: a 描字 scene in the review segment, generously scored. Full new-scene-type recipe (ARCHITECTURE.md §8) + recompile. Scales with any vocabulary size — a flywheel modality.

### E2 — Tone practice mini-game `[ ]`
Tones are the known weak point (MeloTTS failure; UK-based kid). Listening game: hear a syllable (device TTS — correct by construction), pick tone contour or minimal pair (妈/马). No new audio infra.

### E3 — Audio v2 (verified clips) `[ ]`
If device TTS ever isn't enough: new provider (Azure Speech zh-CN neural is the candidate) writing to `audio/v2/…` Blob path — NEVER `audio/words|chars/` (the `usableAudioUrl` chokepoint filters those known-bad clips; see CLAUDE.md audio landmine). Human spot-check per batch. Mind the Blob 2,000 advanced-ops/month cap (~520 puts ≈ 26%); resume-flag pattern mandatory.

---

## P2-F · Economy health & tuning

**Why.** Six-plus interlocking systems (coins, XP, shards, 14 card packs, powerups, trophies, season, quests, festival) grew feature-by-feature; nobody has looked holistically. Risks: coin inflation once the shop is bought out; comprehension load on a 6yo; card packs are finite (the collection endgame needs either new packs on a cadence — the KS1-pack recipe makes this cheap — or V1's Logbook as the infinite collection).

### F1 — Economy dashboard on `/admin` `[x]` (shipped 2026-07-05)
`/admin/economy`: all-children outlier strip + per-child coin flow (by reason + 8-week net), XP by source, 14-day card rate vs the 10/day cap, pack completion, shop exhaustion (incl. the "balance can buy out the shop" F2-urgency flag). Read-only aggregations in `src/lib/db/economy-stats.ts` (pure shapers, unit-tested). Use it to decide F2.

### F2 — Coin sinks `[ ]`
Ship the **parked multi-buy furniture** (David-approved 2026-07-01; cap 3/item via `maxOwned` on `FurnitureDef`; surfaces stay 1; needs count-based ownership + dropping `home_placements`' own-1 unique; PR #128's `PurchaseOutcome` is groundwork). Other sinks only if F1 shows real inflation.

---

## P2-G · Code-health cleanup backlog `[x]` (chore PR shipped 2026-07-05)

- `[x]` Deleted `pullPaid` + `pullFreeFromBoss` + `GachaPullButton` + the old `pull`/`pullInTx` engine (`db/gacha.ts` is now just the error re-export point) + `paidPullCost` from `PackUiMeta`. Tables stay (append-only).
- `[x]` `pnpm remove @types/bcryptjs`.
- `[x]` `next-intl` removed entirely (dep + config plugin + `src/i18n/`) — the landing's 3 strings inlined; real i18n remains the hand-rolled `bi()`.
- `[x]` `ChapterAudioButton` → `SpeakButton` wrapper: found already done (no change needed).

---

## P2-H · UX polish candidates (validate via playtest first)

### H1 — "Juice pass" menu (art effects + sounds, brainstormed with David 2026-07-04) `[~]`
All procedural-first (no asset generation → no Blob ops), `useReducedMotion`-safe, and audio must never compete with the TTS voice (duck/suspend). **Shipped 2026-07-06: S1 + S2 + A1 + A4** (spec `docs/superpowers/specs/2026-07-06-juice-pass-design.md`). Remaining menu items (S3/S4/A2/A3/A5) below for a future round.

**Sound** (today there are exactly 3 procedural sounds — the biggest untapped lever):
- **S1 · Streak pitch-ramp**: consecutive correct answers step the ding's pitch up (reset on miss). ~10 lines in the WebAudio layer, works across all 4 sound themes.
- **S2 · Per-boss signature sounds**: procedural intro growl / damage hit / defeat per creature type (bubbly kraken, eel zap, clam clack…). Boss fights currently reuse the generic ding/buzz.
- **S3 · Reveal stingers**: differentiated chest-open audio for new card vs. dupe vs. pack-complete vs. limited (festival/season/champion).
- **S4 · Ambient sea soundscape** on the voyage board only (filtered-noise waves + occasional gull), auto-suspended on scene entry, mute toggle.

**Art / visual effects:**
- **A1 · Holo/foil shimmer on limited cards** (festival/season/champion): CSS gradient-mask sheen — makes reward-only cards FEEL limited, supports the shard-cost FOMO design.
- **A2 · Voyage board ambient life**: drifting clouds, occasional whale spout, ship wake trail (SVG + framer-motion loops; static under reduced-motion).
- **A3 · Boss hit feedback**: 2-frame white hit-flash + viewport micro-shake on damage (reuse `ShakeWrap`), slow-motion beat before the defeat animation.
- **A4 · Avatar idle life**: blink + gentle bob on the home HUD avatar (pure CSS keyframes).
- **A5 · Mastery sparkle**: star-pop when a character's mastery tier rises (pairs with V1 Logbook — build together).

- **Home-render side effects**: `/play/[childId]/page.tsx` awaits `syncSeasonProgress` + `generateDailyQuests` on every render — works, but serializes writes into the hottest read path. If home feels slow on iPad, restructure; measure first.
- **Session pacing**: GAME-DESIGN §10's "express replay mode" question is still open — ask David whether replays feel long.
- **Offline/PWA**: manifest exists, no offline play. Only if David reports car-trip demand.

---

## Priority summary

| Rank | Item | Effort | Why |
|---|---|---|---|
| — | ~~A1 answer logging~~ | — | ✅ shipped 2026-07-03 (PR #132) |
| 1 | V6 Map 2 authoring | S (blocked on David's hanzi) | Content is king; everything is prepped |
| 2 | B1/B2 docs restructure | S | Every future session gets cheaper + sharper |
| 3 | C1 dev DB branch | S | Kills the scariest standing footgun |
| 4 | A2 review loop | M | The pedagogy win; GAME-DESIGN pre-blessed; A1 data is accumulating |
| 5 | V1 mastery model + Logbook | M | Substrate for V2/V5/A3; makes growth visible (wait ~4–6 weeks for A1 data) |
| 6 | D1 e2e smoke | M | Catches the only bug class CI can't see |
| 7 | E1 stroke practice | M | Biggest missing modality; scales forever |
| 8 | A3 parent insights | M | Closes the David→homework loop |
| 9 | C2/C3/C4 backup + errors + integrity | S | Cheap insurance |
| 10 | V2 smart distractors | M | Natural difficulty scaling (needs V1) |
| 11 | F1 economy dashboard → F2 sinks | M | Data before tuning |
| 12 | E2 tone game / G cleanup / H polish | S–M | As playtests demand |
| 13 | V3 word forge · V5 captain's exam | M | New mechanics — confirm appetite with David |
| 14 | V4 decodable readers | L | The stage-3 payoff; start curated, not generated |
