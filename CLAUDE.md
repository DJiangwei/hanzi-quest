# Fast-start for Claude (and other agents)

This file is auto-loaded into every session. Read it once, decide whether you need any of the deeper docs (PLAN / ARCHITECTURE / GAME-DESIGN), then go. **Do not read the deep docs unless the triage table below tells you to.**

For Codex / other tooling that follows the `AGENTS.md` convention: see `AGENTS.md` (kept as a thin shim).

---

## What this is

**hanzi-quest** (deployed as `hanzi-adventure.vercel.app`) — a personal Chinese-character learning game for the maintainer's 6-year-old daughter Yinuo. Pirate-adventure art direction. Parent (David) authors weekly character lists in an admin panel; AI generates kid-friendly scenes; child plays a 12-15-level "island" of mini-games per week, with a boss kraken + treasure-chest gacha on weeks with ≥10 characters.

It is **not** a multi-tenant SaaS. Optimize for Yinuo's daily fun, not for theoretical other users.

---

## Current state (last refreshed 2026-05-17)

**Shipped:** PR #1 → #20. The product is end-to-end playable in production: weekly authoring, AI scene generation (DeepSeek V4 Pro), shared `pirate-class-level-1` curriculum pack with 10 weeks published, island map, 6 scene types + boss, coins, 12-zodiac gacha collection, animations + audio + treasure-map cards, PWA manifest.

**Most recent regressions fixed:**
- PR #18 — `finishLevelAction` / `listWeekChars` used `getWeekOwnedBy` which fails for shared-pack weeks (parent_user_id NULL). Fixed by switching to `getPlayableWeekForChild`.
- PR #20 — flashcard hanzi was 14rem fixed → now `clamp(11rem, 55vw, 22rem)`; `ZodiacIconDefs` (SVG `<symbol>` defs) only mounted on `/collection`, broke chest reveal — now mounted in the play layout.

**Next up (per PLAN.md §1):** likely streaks / daily-quest layer + analytics, but ALWAYS confirm with David before starting a new PR.

---

## Hard rules (non-negotiable)

1. **Never re-litigate locked decisions** without strong reason. Locked: pirate-adventure art direction; DeepSeek V4 Pro as AI provider; shared-pack model (rows in `weeks` table with nullable `parent_user_id`); pinyin hidden by default; age-appropriate vocab. If you want to change one, say so explicitly and explain why.
2. **`pnpm typecheck && pnpm lint && pnpm test && pnpm build` must all be green** at PR open.
3. **Drizzle migrations are append-only.** Never edit a committed `drizzle/*.sql`. Generate a new one. Schema source of truth is `src/db/schema/*.ts` — SQL is generated from it, not vice versa.
4. **Tests mock external boundaries** (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`). No test hits a real DB or network.
5. **Scripts that touch `process.env.DATABASE_URL`** must `loadEnv()` first, then dynamic-import the db client *inside* `main()` — see `scripts/seed-pirate-class.ts` and `scripts/recompile-pirate-class.ts`.
6. **Branch protection on `main`** is enforced (PR + CI required, admin bypass). Always work on a feature branch + PR. Never push to main.
7. **Use SSH for git push** (HTTPS will fail — David's setup).
8. **This is NOT the Next.js you know** — Next.js 16 App Router with renamed primitives. Read `node_modules/next/dist/docs/` before non-trivial work, and heed deprecation notices.

---

## Triage — when do I need a deeper doc?

| Task | Read this BEFORE coding |
|---|---|
| Add a new column / table / Drizzle migration | `ARCHITECTURE.md` §5 (schema) + §11 (cookbook) |
| Add a new scene type | `ARCHITECTURE.md` §8 (scene system) |
| Change AI prompt / scene-generation schema | `ARCHITECTURE.md` §7 + `GAME-DESIGN.md` §4 |
| Visual polish, palette, fonts | `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/art_direction.md` + `GAME-DESIGN.md` §5 |
| Reward formulas, coins, gacha rules | `GAME-DESIGN.md` §6 |
| "Is this in scope?" | `GAME-DESIGN.md` §9 (non-goals) + `PLAN.md` §4 (decisions log) |
| Picking the next chunk of work | `PLAN.md` §1 (status) — and **ask David first** |
| Bug fix in existing code | Skip the deep docs. Read the relevant `src/**` files. |

For most bug fixes and small features, you don't need any of the deep docs.

---

## Codebase map (where things live)

```
src/
  app/                  Next.js App Router pages
    play/[childId]/       Kid-facing surfaces (layout mounts ZodiacIconDefs)
      page.tsx              Island map
      level/[weekId]/       Scene runner (the 12-15 level sequence)
      collection/           Zodiac gacha collection
    parent/               David-facing admin (week authoring, child mgmt)
  components/
    scenes/               6 scene types + BossScene + SceneRunner + fx/*
    play/                 Kid-facing UI primitives (IslandMap, Zodiac*, HUD)
    ui/                   Shared primitives (WoodSignButton, TreasureMapBackdrop)
    parent/               Admin forms + cards
  db/schema/            Drizzle source-of-truth tables — DO NOT edit drizzle/*.sql by hand
  lib/
    actions/              Server actions ('use server') — only async exports allowed
    db/                   Postgres queries (NEVER imported in client bundles)
    errors/               Pure error classes (client-safe — no postgres imports)
    scenes/               Scene compilation (compileWeekIntoLevels) + configs
    audio/                Procedural Web Audio (ding/buzz/fanfare)
    hooks/                Client hooks (useReducedMotion, useCoinHud)
    auth/                 Clerk wrappers (requireChild, etc.)
drizzle/                Committed migrations (append-only)
scripts/                One-off ops scripts (seed, recompile, etc.)
tests/unit/             Vitest + RTL + jsdom — mocks all external boundaries
docs/superpowers/       Spec + plan docs from brainstorming/writing-plans skills
```

## Landmines (things that have bitten us)

- **Shared-pack week access**: rows in `weeks` with `parent_user_id IS NULL` belong to the curriculum pack, not a parent. Use `getPlayableWeekForChild(childId, weekId)` for any access check — NOT `getWeekOwnedBy(weekId, parentId)`. The latter silently 404s for pack weeks.
- **`'use server'` files** (anything in `src/lib/actions/`) can only export async functions. If you need to export an error class or sync helper, put it in `src/lib/errors/` (pure, client-safe) — do NOT import from `@/lib/db/*` in client code, postgres pulls in `fs`/`net`/`tls`.
- **`ZodiacIconDefs`** must be mounted in an ancestor of any `<ZodiacIcon>` use. Currently mounted in `src/app/play/[childId]/layout.tsx`.
- **React 19 strict mode** double-renders. Any `onComplete?.()` in a render body double-fires — wrap in `useEffect`.
- **`prefers-reduced-motion`** — every fx component must respect `useReducedMotion()` and fall back gracefully.
- **`DATABASE_URL` shared across Vercel envs** (Neon free tier) — production scripts can write to prod inadvertently. Confirm before running anything that mutates.

---

## Workflows

- **Building a feature**: brainstorm spec → write plan → dispatch implementer subagents per task → review → merge. (Superpowers skill chain: `brainstorming` → `writing-plans` → `subagent-driven-development`.)
- **Hotfix**: branch + edit + test + PR + merge. Don't go through the full plan ritual for a 5-line bug fix.
- **Confirmations**: David prefers `AskUserQuestion` option mode (mark recommended option first) for any non-trivial choice. He answers in Chinese or English.

---

## Pointers

- Per-user memory: `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/` — has David's collaboration norms, locked art direction, project overview. Read `MEMORY.md` index first.
- Deep design docs: `PLAN.md`, `ARCHITECTURE.md`, `GAME-DESIGN.md` — only when triage table says so.
- Vercel project: `hanzi-adventure` under `daviddaijw-6886s-projects`.
- GitHub repo: `DJiangwei/hanzi-quest`.

---

**Keep this file curated.** When you ship a meaningful change (regression fix, new landmine, locked decision flip, scope change), update the relevant section here so the next session doesn't re-derive what you just learned. Update the "last refreshed" date.
