# Improvement Roadmap — hanzi-quest

> **Audience: future Claude/agent sessions.** This is a prioritized, checkable improvement plan written 2026-07-03 after a whole-project review. Each workstream states *why*, *what evidence to check first*, *a concrete first PR*, and *guardrails*. Before starting ANY workstream: (1) re-verify the evidence claims against current code — this doc rots like any doc; (2) **confirm with David via AskUserQuestion** (CLAUDE.md hard rule: always confirm before starting a new PR); (3) respect the locked decisions in CLAUDE.md §Hard-rules and GAME-DESIGN.md §9 non-goals.
>
> Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (update in place when you ship a slice).

---

## How to use this doc (for agents)

1. Read CLAUDE.md first (auto-loaded). This doc is the "what should we do next and why" layer on top of it.
2. Pick the highest-priority unblocked item, verify its evidence section still holds, then propose it to David with a recommended option.
3. When you ship a slice, flip its checkbox here AND update CLAUDE.md per its curation rule.
4. If you disagree with a priority after looking at fresh play data, say so to David — this doc is a strong default, not a lock.

---

## P0-A · Learning intelligence (the flagship gap)

**Why.** The product's mission is *learning Chinese*, but the game currently has no memory of what the child struggles with. `scene_attempts` (src/db/schema/game.ts) stores only aggregate `correctCount/totalCount` per scene — never *which* character/word was missed. Consequences:

- No targeted review: a character Yinuo gets wrong 5 times is treated identically to one she aces.
- No cross-week retention: once a week's boss is cleared, its characters never appear again until the map final boss (potentially months later). Forgetting curves guarantee decay.
- David authors homework blind: he can't see per-character error rates when deciding what to drill.

**Evidence check (do first).** Confirm `scene_attempts` still lacks per-item fields; confirm no `answer_events`-like table exists (`ls src/db/schema/`, grep for `characterId` in attempt-write paths). GAME-DESIGN.md §9 lists "Adaptive SRS" as a non-goal — but its stated condition was "we don't have weeks of play data yet" (written Oct 2025). There is now ~1 year of play data across multiple children, and §9 itself blesses the naive alternative: *"review old chars in new-week distractor pools already buys 80% of the benefit."* Proposing A2 is NOT re-litigating a locked decision; full SM-2 SRS would be.

### A1 — Per-answer event logging `[x]` (shipped 2026-07-03, feat/answer-events — includes the flashcard 认识/不确定/不认识 self-assessment David requested)
Additive migration: `answer_events(id, child_id, character_id nullable, word_id nullable, scene_type, correct boolean, answered_at)`. Write from the scene components' answer handlers via the existing finish/attempt actions (or a small dedicated fire-and-forget action following the XP-tick pattern: guarded, never blocks the primary write). Cover MCQ-family scenes, lianliankan, boss, homework, study mode. No UI in this PR. This unblocks everything below — ship it before A2/A3.
- Guardrails: additive-only migration; fire-and-forget (a logging failure must never fail a scene); tests mock `@/db`.

### A2 — Cross-week review loop `[ ]`
Two cheap slices, in order:
1. **Stale-char distractors**: when compiling a new week, draw some MCQ distractors from *previously cleared weeks'* characters (data already reachable via the pack). Passive re-exposure, zero new UI. Needs `recompile-all-weeks.ts` post-merge (stable level keys preserve attempt linkage).
2. **温故 / Daily mixed review**: a small home-surface session (5–8 questions) sampled from cleared weeks, weighted by A1 error rates once available (fallback: least-recently-seen). Reuse `MultipleChoiceQuiz` + the study-mode runner pattern; reward via the existing card/XP mechanics (decide consciously: daily-cap-consuming, like study mode's `'study'` source).
- Guardrails: keep it short and optional — Yinuo is 6; don't gate anything on it. Bilingual chrome rule applies.

### A3 — Parent insight page `[ ]`
A `/parent/children/[id]/insights` page: per-character accuracy, most-missed list, confusion pairs (wrong-answer choices picked), activity trend. Pure read over A1 data + `coin_transactions` activity. This is the loop-closer: David uses it to author homework (`HomeworkEditor` already exists per-child). Parent-facing → bilingual rule exempt.
- Guardrails: `(secured)` route group; scope by `getChildOwnedBy`.

---

## P0-B · Docs & agent-context hygiene (cheap, compounding)

**Why.** CLAUDE.md has grown into a full per-PR history (~15k+ words) and is auto-loaded into *every* session — that's a large recurring context tax, and the narrative history buries the landmines that actually prevent bugs. Meanwhile PLAN.md's shipping log froze at PR #17 (verified 2026-07-03) even though PLAN.md self-describes as "the roadmap + status log."

### B1 — Restructure CLAUDE.md `[ ]`
Move the per-PR narrative history ("PR #21–#27…", "PR #48…", etc.) into PLAN.md §1's shipped table (one line each) or a new `docs/CHANGELOG.md`. CLAUDE.md keeps: current-state summary (one paragraph per subsystem), ALL landmines (grouped by subsystem), hard rules, triage table, codebase map, workflows. Target: cut CLAUDE.md by 50–70% without losing a single landmine.
- Guardrails: this is a docs PR but high-blast-radius for future agents — get David's sign-off on the structure first; never delete a landmine, only regroup.

### B2 — Keep PLAN.md honest `[ ]`
Backfill the shipped-PR table #18→current from CLAUDE.md/git log, and add a rule to CLAUDE.md's curation note: new PRs get one line in PLAN.md, prose only for landmines.

---

## P1-C · Ops hardening (protect the data, stop the prod-DB footguns)

**Why.** Documented landmine: local `pnpm build` runs `scripts/migrate.ts` against the **prod** Neon DB (`.env.local` = prod; DATABASE_URL shared across all Vercel envs). Also: no backups beyond Neon free-tier retention, and no error monitoring (server errors only visible if someone reads Vercel logs) — for a product now distributed to friends & family.

### C1 — Separate dev/preview database `[ ]`
Neon free tier supports branches. Create a `dev` branch DB; point local `.env.local` and Vercel Preview env at it; Production env keeps the main branch. Kills the "feature-branch build migrates prod early" landmine class entirely. Verify with `vercel env ls` + a dry-run migrate.
- Guardrails: coordinate with David (his `.env.local` changes too); after switch, seed scripts must be told explicitly which env they target.

### C2 — Weekly backup `[ ]`
The DB is tiny. A `scripts/backup-db.ts` (pg_dump → local file or Blob — mind the 2,000 advanced-ops/month Blob cap; a local/iCloud dump avoids it) + a note in CLAUDE.md. Protects years of Yinuo's progress against a free-tier accident.

### C3 — Error visibility `[ ]`
Lightest option first: Vercel's built-in observability + a log-drain or Sentry free tier (Next.js SDK). Success metric: a thrown server-action error produces an alert David can see, not a silent 500 on a kid's iPad.

---

## P1-D · Real E2E safety net

**Why.** Unit tests (900+, excellent) mock every boundary, so the two recurring prod-only bug classes — RSC "functions cannot be passed to client components" and seed/migration drift against the real DB — are invisible to CI by construction (both have bitten repeatedly: PackUiMeta hazard, avatar-slot seed FK violation, story_chapters missing table). Playwright is configured but `tests/e2e/` has a single smoke spec.

### D1 — Preview-deploy smoke suite `[ ]`
5–8 Playwright flows run against a Vercel preview URL (CI job after deploy): sign-in → entry chooser → home renders (exercises voyage board + quests + season RSC surface) → open a week hub → play one scene to completion → open shop + backpack + calendar. A test child on the admin account. Even without assertions beyond "page renders, no error boundary," this catches the RSC class.
- Guardrails: never against prod data mutations for real children; use a dedicated test child (admin console can provision/clean up).

---

## P1-E · Content: the learning-modality gaps

All pre-approved as candidates in CLAUDE.md's "Next up" (confirm scope with David per item).

### E1 — Map 2 (印度洋) authoring `[blocked on David]`
`scripts/seed-pirate-class-2.ts` is prepped; needs David's 10 weeks of hanzi. When it lands: voyage map entry exists (Indian Ocean, 9 stops), accent color shipped (#123), final-boss roster needs an overlord entry + champion card/crown/trophy (see the #129/#130 landmine recipe).

### E2 — Writing / stroke-order practice `[ ]`
The biggest untouched modality. Recommended: [hanzi-writer](https://hanziwriter.org) (free, MIT, stroke-order data for all needed chars, built-in quiz mode with finger tracing — ideal on iPad). Slice 1: a 描字 scene type in the review segment (trace the week's chars, generous scoring). Needs the full new-scene-type recipe (ARCHITECTURE.md §8): enum value + template seed + compile slot + component + recompile.
- Guardrails: 6yo motor skills — score leniently; reduced-motion + touch targets; new scene type = migration + recompile discipline.

### E3 — Tone practice mini-game `[ ]`
Tones are the known weak point of the audio story (MeloTTS failed on them; kid is UK-based). A listening game: hear a syllable (device TTS with correct text), pick the tone contour (visual arrows) or pick between minimal pairs (妈/马). No new audio infra — device TTS speaks correct text by construction (see the audio landmine).

### E4 — Audio v2 (verified clips) `[ ]`
If/when device TTS isn't enough: new provider clips go to `audio/v2/…` Blob path (NEVER `audio/words|chars/` — the chokepoint `usableAudioUrl()` in `useSpeak.ts` deliberately filters those known-bad paths). Azure Speech zh-CN neural voices are the leading candidate. **Human spot-check per batch before shipping** — the MeloTTS lesson: never trust a provider's Mandarin tones unheard. Mind Blob advanced-ops budget (~520 puts ≈ 26% of a month; use the resume-flag pattern).

---

## P2-F · Economy health & tuning

**Why.** The economy now has 6+ interlocking currencies/tracks (coins, XP, shards, cards ×13 packs, powerups, trophies, season tiers, quests, festival). It grew feature-by-feature; nobody has looked at it holistically. Risks: coin inflation once the shop is bought out (finite catalog, no repeatable sink except skip powerups), and comprehension load on a 6yo.

### F1 — Economy dashboard on `/admin` `[ ]`
Read-only: per-child coin earn/spend by reason over time (all in `coin_transactions`), XP by source, card acquisition rate vs. the 10/day cap, shop-catalog exhaustion %. Zero migration — the ledgers already exist. Decide tuning *from data*, not vibes.

### F2 — Coin sinks `[ ]`
Ship the **parked multi-buy furniture** (David-approved 2026-07-01; cap 3/item via `maxOwned` on `FurnitureDef`; surfaces stay 1; needs count-based ownership + dropping the own-1 unique on `home_placements`; PR #128's `PurchaseOutcome` is the groundwork). Other candidates only if F1 shows real inflation.

---

## P2-G · Code-health cleanup backlog (bundle into one chore PR)

- `[ ]` Delete `pullPaid` + `GachaPullButton` (deprecated since PR #52, "drop in #53+" — long overdue).
- `[ ]` `pnpm remove @types/bcryptjs` (redundant stub, documented).
- `[ ]` Audit `next-intl`: only imported in `src/app/page.tsx` + `src/i18n/request.ts` while the app's real i18n is the hand-rolled `bi()` helper — either use it properly or remove the dep + config.
- `[ ]` `ChapterAudioButton` → `SpeakButton` wrapper refactor (pending follow-up from PR #50; story hidden, so low urgency).
- `[ ]` Sweep for other `@deprecated` markers and dead-but-kept items whose "keep one release" grace expired (keep dead *tables* — append-only rule — this is about dead *code*).

---

## P2-H · UX polish candidates (validate with playtest before building)

- **Home-render side effects**: `/play/[childId]/page.tsx` awaits `syncSeasonProgress` + `generateDailyQuests` on every render — works, but serializes writes into the hottest read path. If home feels slow on iPad, move these to fire-and-forget or a post-login action. Measure first.
- **Session pacing**: GAME-DESIGN §10 open question ("express replay mode") is still open — check with David whether replays feel long.
- **Offline/PWA**: manifest exists, no offline play. Only pursue if David reports car-trip demand.

---

## Priority summary

| Rank | Item | Effort | Why now |
|---|---|---|---|
| 1 | A1 answer logging | S | Unblocks all learning intelligence; pure additive |
| 2 | B1/B2 docs restructure | S | Every future session gets cheaper + sharper |
| 3 | C1 dev DB branch | S | Kills the scariest standing footgun |
| 4 | A2 review loop | M | The actual pedagogy win; GAME-DESIGN pre-blessed |
| 5 | D1 e2e smoke | M | Catches the only bug class CI can't see |
| 6 | E2 stroke practice | M | Biggest missing learning modality |
| 7 | A3 parent insights | M | Closes the David→homework loop (needs A1 data) |
| 8 | C2/C3 backup + errors | S | Cheap insurance |
| 9 | F1 economy dashboard | M | Data before tuning |
| 10 | E3 tone game / F2 sinks / G cleanup | S–M | As playtests demand |

E1 (Map 2) slots in whenever David delivers the hanzi — it outranks everything above when unblocked.
