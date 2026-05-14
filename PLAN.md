# PLAN — hanzi-quest

> A weekly Chinese-character adventure for 6-year-olds. First learner: David's daughter Yinuo, in the UK 海盗班 weekend class. Architected platform-grade, shipping personal V1.
>
> **This doc is the roadmap + status log.** Design and philosophy live in [`GAME-DESIGN.md`](./GAME-DESIGN.md). System internals live in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

| Need | Read |
|---|---|
| What are we building and why | [`GAME-DESIGN.md`](./GAME-DESIGN.md) |
| How is the system put together | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Where are we in the phase plan | this doc |
| How does David like to work | `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/` |

---

## 1. Status

Production at <https://hanzi-adventure.vercel.app>. One real test user (David / banbanhu4ever@gmail.com), one child profile (小板), enrolled in `pirate-class-level-1` (10/10 lessons published).

### Shipped

| PR | Title | Outcome |
|---|---|---|
| #1 | Full Drizzle schema + first migration | 32 tables, 12 enums |
| #2 | Clerk webhook + role guards + repo helpers | `assertParent`, `requireChild`, svix-verified webhook |
| #3 | Login closed-loop + Children CRUD + scene_templates seed | `/parent` + `/parent/children`; `ensureUserBootstrapped` makes the webhook optional |
| #4 | AI generation pipeline (single week) + review UI | DeepSeek V4 Pro, per-char regenerate, Zod schemas |
| #5 | Stage bulk import + DeepSeek switch | `/parent/stage/new` — paste 10 lines → 10 draft weeks |
| #6 | Phase 3 MVP — playable flashcard map | `/play/[childId]` + first scene, coin balance |
| #7 | Yinuo placeholder | Replaces Anna in form/example |
| #8 | Phase 3 full — 4 more scene types + mixed compile | Each level = 14-scene gauntlet |
| #9 | Shared 海盗班 pack + class enrollment | Class packs as first-class entities |
| #10 | Pirate-adventure visual skeleton + PWA | Color tokens, fonts, app icon |
| #11 | Docs refresh — PLAN + new ARCHITECTURE + new GAME-DESIGN | Triage table in AGENTS.md |
| #12 | SVG island map + admin pirate palette | Mario-style 10-island map, dotted path, locked/active/done states |
| — | Hotfix `22f0a24` | `/play/[childId]/level/[weekId]` 404 on shared-pack weeks |

### Next up (locked order, per art-direction memory)
- **PR #13** — Answer-feedback animations, treasure-map flashcard backdrop, Lottie coin shower + level fanfare, wood-sign buttons
- **PR #14** — Boss kraken (Phase 4) + treasure-chest gacha reveal (Phase 5 entry)

### Loose ends to land at convenience
- (none currently — `/parent` redirect, branch protection, and Preview `DEEPSEEK_API_KEY` all landed 2026-05-14)
- Clerk webhook signing secret intentionally deferred — `ensureUserBootstrapped` covers the happy path; revisit only when delete/update propagation is needed.

---

## 2. Phase plan

The original Phase 0–7 plan from October still describes the long arc. Below is the live status against it; details in this doc are deliberately thin — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) for implementation.

| Phase | Original scope | Status |
|---|---|---|
| 0 — Bootstrap | Next 16 scaffold, Vercel link, Marketplace Neon + Clerk, CI, first deploy | ✅ done |
| 1 — Auth + schema | 32-table schema, Clerk webhook + bootstrap, Children CRUD, scene_templates seed | ✅ done |
| 2 — Parent input + AI generation | Single-week + bulk-stage input, DeepSeek pipeline, review UI | ✅ done (Phase 2a + 2b) |
| 3 — Map + scenes | 5 base scene types, map, coin economy | ✅ MVP + full + SVG map (PRs #6, #8, #12). Animations/feedback polish = PR #13 |
| 4 — Writing + Boss | HanziWriter tracing scene + boss gauntlet | ⏳ planned PR #14 |
| 5 — Economy + shop + gacha + zodiac | 12-zodiac gacha pack, shop tabs, avatar slots, shards, powerups | ⏳ planned PR #14+ |
| 6 — Streaks + parent progress + polish | streak tracking, recharts, sounds, a11y, i18n audit | ⏳ |
| 7 — Real-world beta with Yinuo | Iterate from observed play | ⏳ ongoing already in informal form |

For per-PR detail and rationale, the merged-PR descriptions on GitHub are the canonical record; this table is a compass, not the map.

---

## 3. End-to-end verification (canonical flow)

After PR #10 ships, this is the smoke path that proves the platform is alive.

1. Sign up at `https://hanzi-adventure.vercel.app` → land on `/parent`. `ensureUserBootstrapped` mirrors a `users` row + auto-creates a `school-custom` curriculum_pack for the family.
2. Add a child (`Yinuo`, birth_year `2019`). Verify `child_profiles` row exists.
3. **Class path**: enrol Yinuo in `pirate-class-level-1` (today via `scripts/bind-yinuo-to-pirate-class.ts`; future via a UI picker). `/play/[yinuoId]` shows 10 island nodes — published.
4. Yinuo plays Lesson 5. 14 scenes: 10 flashcards + audio_pick + visual_pick + image_pick + word_match. Coin balance ticks up live. End screen: `🎉 Island cleared! +X coins`.
5. **Custom-week path** (still supported): `/parent/stage/new` → paste 10 extra lines → 10 draft weeks. Click *Generate AI* on each (~3 min/week). Review/edit. Publish. Those weeks appear alongside the class pack ones in `/play`.
6. Re-publish an old week. Confirm `week_levels` are recompiled into the new mixed gauntlet (handles upgrade after PR #8 schema/compile changes).
7. CI: full `pnpm test` (61 vitest cases) + `pnpm build` + `pnpm typecheck` + `pnpm lint` green.

If anything in 1-7 fails, that's a stop-the-world bug.

---

## 4. Decisions log (Appendix from original spec, still valid)

These are the load-bearing decisions reached during the original planning session, recorded so we don't re-litigate them in future sessions.

| Decision | Rationale |
|---|---|
| Architect platform-grade, ship Personal V1 | Avoids future rewrite; doesn't over-engineer V1 surfaces |
| Map = level select, level = structured learning UI (not platforming) | Simpler stack (no Phaser); React + Framer Motion suffices |
| Curriculum source = parent inputs + AI augment, plus class packs | Real fit to the user's school weekend class structure |
| Pinyin hidden by default, tap to reveal | Avoid pinyin crutch; promotes 字形 recognition |
| Writing/笔顺 IS in V1 via HanziWriter | School class teaches writing; reading-first but writing complements |
| English UI chrome + Chinese learning content + Chinese parent dashboard | UK schooling makes English chrome natural for child |
| Session length default = 10–15 min (3–4 scenes core) | 6-year-old attention sweet spot |
| Boss battle weekly + zodiac collection in V1 | Sustained engagement loop |
| Single Next.js app, not monorepo | Right-sized for V1, can split later |
| Vercel AI Gateway → DeepSeek V4 Pro mid-project (PR #5) | Gateway requires credit card; DeepSeek ~10× cheaper, comparable quality on this prompt (verified by hand vs the school's Lesson 1) |
| Friendly Pirate Adventure aesthetic (PR #10) | Already in the source material ("Giggling Panda Pirate", "海盗班"); free narrative continuity |
| `weeks` table holds both per-family and shared-pack rows | Reuse the existing schema + compile-week + play pipeline rather than build a parallel table family |
| `sceneRegistry` is the extensibility heart | Single abstraction handles main-line + future independent mini-games |
| 12 zodiac is V1 collection; festivals / dynasties / dinosaurs are V1.5+ | Scope discipline |
