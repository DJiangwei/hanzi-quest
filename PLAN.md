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

Production at <https://hanzi-adventure.vercel.app>. Distributed to friends & family (multiple accounts/children); primary learner Yinuo plus 小板 on the admin account (banbanhu4ever@gmail.com, role=admin). Map 1 `pirate-class-level-1` (加勒比海) fully published (10 weeks); Map 2 (印度洋) awaits David's character lists. **Per-PR narratives live in `docs/CHANGELOG.md`; future work is ranked in `docs/IMPROVEMENT-ROADMAP.md`.** (Status last refreshed 2026-07-03, through PR #132.)

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
| #13 | Post-#12 housekeeping (this PR) | `/parent` explicit redirect + branch protection + Preview DeepSeek key + PLAN sync |
| #14 | PR #14 spec — pirate-polish design doc + implementation plan | brainstorming + writing-plans skill output |
| #15 | Pirate polish layer (PR #14 implementation) | treasure-map flashcard backdrop · coin-shower + shake + Web Audio · WoodSignButton CTAs on /play and /parent · Lottie level fanfare · prefers-reduced-motion fully respected |
| #16 | PR #16 spec — boss + gacha design doc + implementation plan | brainstorming + writing-plans skill output |
| #17 | Boss kraken + treasure-chest gacha (PR #16 implementation) | Phase 4 + Phase 5 entry: 10q/3l boss · /collection page · 12 zodiac SVG set · free pull on boss clear · paid pull 500 coins · shard accrual on dupes |
| #18 | fix(actions): finishLevelAction works for shared pack weeks | |
| #19 | chore(scripts): one-off recompile-pirate-class.ts | |
| #20 | fix(play): hanzi size + zodiac SVG defs mounting | |
| #21 | docs(pr21): shop expansion design spec | |
| #22 | feat: PR #21 — shop hub + avatar cosmetics | |
| #23 | docs(pr23): collector's atlas + flags pack design spec | |
| #24 | feat: PR #23 — collector's atlas hub + flags pack | |
| #25 | feat: PR #25 — sea creatures collection pack | |
| #26 | feat: PR #26 — dinosaurs collection pack | |
| #27 | feat: PR #27 — solar system collection pack | |
| #28 | feat: PR #28 — coin economy expansion (daily login + streaks + perfect week) | |
| #29 | fix(collection): per-pack page crash — don't pass PackUiMeta across server→client boundary | |
| #30 | feat: PR #30 — 4-segment weekly structure + 3 new scene types | |
| #31 | feat: PR #31 — sound / FX themes | |
| #32 | feat: PR #32 — achievements / trophies | |
| #33 | feat: PR #33 — static pet companion | |
| #34 | feat: PR #34 — island decorations + shop purchase dispatch fix | |
| #35 | feat: PR #35 — week hub restructure + pinyin removal + practice 2x | |
| #36 | feat: PR #36 — image-prompted word formation (text-stimulus, image-ready) | |
| #37 | feat: PR #37 — consumable powerups (Hint / Skip / Streak-Freeze) + Shop 5-of-5 | |
| #38 | feat: PR #38 — kid-first surface refresh (bottom nav, PIN gate, view transitions, calendar, backpack) | |
| #39 | docs(claude.md): record PR #38 (kid-first surface refresh) | |
| #40 | feat: PR #40 — multi-map chapter system (加勒比海 + 印度洋 placeholder) | |
| #41 | docs(claude.md): record PR #40 (multi-map chapter system) | |
| #42 | feat(pr42): Pollinations.ai image backfill + authoring integration | |
| #43 | docs(claude.md): record PR #42 (Pollinations image backfill) | |
| #44 | fix(pr44): Pollinations free-tier — model=turbo, drop enhance=true | |
| #45 | fix(pr45): Pollinations concurrency=1 (free tier allows 1 queued request) | |
| #46 | docs(claude.md): record PR #44 + PR #45 (Pollinations free-tier corrections) | |
| #47 | docs(claude.md): document PR #42 backfill aftermath + image-gen blockers | |
| #50 | feat(pr50): Scene voice/TTS — zh-CN pronunciation buttons | |
| #51 | feat(pr51): playtest polish — flashcard + visual_pick + boss-chest + sound preview | |
| #48 | feat(pr48): Story Mode — Yinuo-as-protagonist generative narrative | |
| #52 | feat(pr52): gacha economy redesign — play-to-earn cards + shard swap | |
| #53 | fix(prod): auto-apply Drizzle migrations on Vercel build | |
| #54 | chore: ChapterAudioButton wraps SpeakButton | |
| #55 | feat: auto-enroll new children in the default shared pack | |
| #56 | feat: post-reveal TTS — auto-pronounce the correct answer | |
| #57 | feat(pr57): Lianliankan replacement for WordMatchScene | |
| #58 | feat(pr58): avatar expansion + multi-theme (Pirate + Caribbean) | |
| #59 | fix(pr58): seed script must upsert all 7 avatar_slots | |
| #60 | docs(claude.md): landmine — seed SLOTS array must track AVATAR_SLOT_IDS | |
| #61 | docs(codex): refresh image-backfill handoff — 143 left, quick-start | |
| #62 | feat(card-economy-v2): daily cap + visible swap + weekly check-in 大礼包 | |
| #63 | chore(card-economy-v2): address final-review nits | |
| #64 | feat(boss-animations): 10 per-week boss creatures with intro/damage/defeat | |
| #65 | feat(voyage-board): procedural treasure-map home UI (vertical numbered voyage) | |
| #66 | feat(card-reveal): unified tap-to-open chest reveal for all card grants | |
| #67 | feat(xp-quests): XP foundation + daily quests (retention Phase 1) | |
| #68 | feat(avatar-themes): Space (太空) + Unicorn (独角兽彩虹) avatar themes | |
| #69 | docs: consolidate — image backfill complete (426/426); track Season-Pass draft | |
| #70 | feat(home): 家/Home module — decoratable 3-room home | |
| #71 | feat(flags): World Flags by continent (30→193) + generic grouped render | |
| #72 | fix: pack trophy + universal shard wallet + free practice hint | |
| #73 | feat(i18n): bilingual UI sweep — all kid-facing chrome 中文 / English | |
| #74 | feat(shop): avatar try-on — big preview + tap-to-try, Buy bar to confirm | |
| #75 | feat(backpack): tap-to-open card detail + World Landmarks pack | |
| #76 | feat(backpack): real cartoon art on 62 collectible cards (Cloudflare-generated) | |
| #77 | feat(pr-1): landscape 16:9 shell + key surfaces | |
| #78 | feat(pr-2): landscape-fit illustrated voyage board + sailing ship | |
| #79 | feat(pr-3): lunar calendar + festival Monthly Challenge (Phase A) | |
| #80 | feat(pr-3b): festival avatar cosmetics (Phase B of PR-3) | |
| #81 | fix: backpack recent-obtained URL-as-text + bilingual home furniture | |
| #82 | feat: wire illustrated voyage map backdrops | |
| #83 | feat(home): polish 2.5D depth + swappable wallpaper/flooring | |
| #84 | feat(home): yard room + room-art polish + bigger canvas | |
| #85 | docs(claude.md): record PR #84 (home yard + room polish); refresh date | |
| #86 | feat(shop): 节日衣橱 / festival wardrobe — re-equip past festival cosmetics | |
| #87 | feat(play): card-grant rebalance — review/practice card sources + section-aware boss | |
| #88 | feat(backpack): continent completion trophies + scroll-jump nav (PR-A) | |
| #89 | feat(backpack): continent avatar cosmetics + generalized rewards wardrobe (PR-B) | |
| #90 | feat(homework): pirate homework — parent-authored weekly exercises | |
| #91 | docs(claude.md): record Pirate Homework feature (#90) + landmines; refresh date | |
| #92 | fix(parent): break /parent/unlock infinite redirect loop (PIN gate) | |
| #93 | feat: hide story mode + remove hardcoded child-name leaks | |
| #94 | feat(homework): per-child homework + simplified parent admin | |
| #95 | docs(claude.md): record #92/#93/#94 (per-child homework, parent route group, story hidden, name privacy) + landmines | |
| #96 | feat: Season Pass — Summer Voyage 30-tier reward track | |
| #97 | feat(avatar): gender at child creation + gendered default heads + ears on all heads | |
| #98 | docs(claude.md): avatar gender + ears (#97) + Blob-token blocker note | |
| #99 | fix(scripts): pass Blob RW token explicitly to put() (dotenvx override:false leaves stale env) | |
| #100 | feat(shards): elevated swap cost for festival/season limited cards | |
| #101 | docs(claude.md): limited-card art + Blob-token fix (#99) + elevated shard cost (#100) | |
| #102 | feat(scenes): 看图找字 real pictures + ×3 count + easier 图和词配对 | |
| #103 | docs(claude.md): 看图找字 word-picture reuse + ×3 / image_word scaffolds (#102) + practice-count landmine | |
| #104 | fix(scenes): stable option order (no jumping) + 🔊 audio (not pinyin) in image_word | |
| #105 | docs(claude.md): scene shuffle-stability + 🔊-audio fix (#104); correct #102 pinyin→audio | |
| #106 | chore(map2): prep authoring pipeline (waiting on David's 10 weeks) | |
| #107 | feat(audio): pre-recorded pronunciation (CF MeloTTS) replacing browser TTS | |
| #108 | polish: unify 🔊 read-aloud affordance + align scene stimulus cards | |
| #109 | chore(art): unified-style word-image regenerator (CF flux) | |
| #110 | chore(art): shared UNIFIED_ART_STYLE for word + card art; collectible FORCE mode | |
| #111 | feat(audio): TranslatePickScene 🔊 plays the char clip too (completes the rollout) | |
| #112 | Distribution-readiness audit (friends & family) | |
| #113 | docs(claude.md): PR #112 distribution-readiness audit + 'use server' RPC-endpoint landmine | |
| #114 | chore(art): resumable word-image regen + NSFW overrides | |
| #115 | docs(claude.md): Vercel Blob free-tier guardrail (2k advanced ops/mo) | |
| #116 | feat: edit a child's gender after creation | |
| #117 | Admin grant console (god-mode grants + undo) | |
| #118 | docs(claude.md): admin grant console (#117) + gender-edit (#116) + assertAdmin landmine | |
| #119 | chore(art): fix 花生 prompt + collectible resume flag + NSFW overrides | |
| #120 | fix(audio): revert single-character pronunciation to device zh-CN voice | |
| #121 | feat(login): Kid/Parent entry chooser with "remember last choice" | |
| #122 | feat(art): real cartoon art for the 12 festival reward cards | |
| #123 | feat(maps): per-map chrome accent colour | |
| #125 | fix(audio): disable word MeloTTS clips too — use device zh-CN voice everywhere | |
| #124 | feat: 4 KS1 vocab packs + Study Mode | |
| #126 | fix(art): NSFW-override for instruments 'gong' (锣) | |
| #127 | docs(claude.md): vocab packs + Study Mode shipped; refresh 2026-06-20 | |
| #128 | fix(shop): clear purchase feedback (toast + friendly already-owned) | |
| #129 | feat(final-boss): map overlord battle + champion rewards (PR 1 of 2) | |
| #130 | feat(final-boss): map gating + voyage lair node + champion title (PR 2 of 2) | |
| #131 | docs(claude.md): map final boss + shop feedback shipped; refresh 2026-07-03 | |
| #132 | feat: answer_events telemetry + flashcard self-assessment (A1) | |

### Next up

See `docs/IMPROVEMENT-ROADMAP.md` (2026-07-03) — the prioritized plan (growth flywheel, A2 review loop, V-series evolution). Map 2 authoring outranks everything once David delivers the hanzi. Always confirm with David before starting a PR.

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
| 3 — Map + scenes | 5 base scene types, map, coin economy | ✅ MVP + full + SVG map (PRs #6, #8, #12). Animations/feedback polish landed in PR #15 |
| 4 — Writing + Boss | HanziWriter tracing scene + boss gauntlet | ✅ boss shipped PR #17; tracing deferred to a future small PR |
| 5 — Economy + shop + gacha + zodiac | 12-zodiac gacha pack, shop tabs, avatar slots, shards, powerups | ✅ entry shipped PR #17 (gacha + collection + dupe→shard); shop tabs + avatar + voucher redemption queued for V1.5 |
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
