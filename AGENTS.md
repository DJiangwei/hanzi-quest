<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Read before non-trivial changes

The three documents below are the load-bearing context for this repo. Future sessions — including ones on smaller models — should read whichever fits the task at hand BEFORE touching code:

- [`PLAN.md`](./PLAN.md) — what's shipped, what's next, the per-PR roadmap, plus the immutable decisions log.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the system is put together: schema, data flow, auth, scene registry, deployment, "how to add X" cookbook.
- [`GAME-DESIGN.md`](./GAME-DESIGN.md) — what we're building and why, top-down: philosophy, core loop, pedagogy rules, economy, non-goals.

Plus the per-user memory under `~/.claude/projects/-Users-jiangwei-Claude-Chinese/memory/` (David's collaboration norms, project status, locked art direction).

## Triage by task type

| Task looks like… | Start in |
|---|---|
| Adding a new column / table / migration | ARCHITECTURE §5 ("Database schema overview") + §11 cookbook |
| Adding a new scene type | ARCHITECTURE §8 ("Scene system") |
| Changing the AI prompt or schema | ARCHITECTURE §7 + GAME-DESIGN §4 ("Pedagogy") |
| Visual polish, palette, fonts | art_direction memory + GAME-DESIGN §5 |
| Reward formulas, coins, gacha rules | GAME-DESIGN §6 |
| "Is this in scope?" | GAME-DESIGN §9 ("Non-goals") and PLAN §4 ("Decisions log") |
| Picking the next chunk of work | PLAN §1 ("Status") |

## Hard rules

1. **Never re-litigate locked decisions** without strong reason. The art direction (pirate adventure), the AI provider (DeepSeek V4 Pro), the pack model (shared `weeks` rows with nullable parent/child), and the pedagogy rules (pinyin hidden, age-appropriate vocab) are settled. If you propose changing one, say so explicitly and explain why.
2. **`pnpm typecheck`, `pnpm lint`, `pnpm test` must stay green** at PR open. Build green too (`pnpm build`).
3. **Drizzle migrations are append-only.** Never edit a committed `drizzle/*.sql` file. Generate a new one.
4. **Schema files in `src/db/schema/*.ts` are the source of truth.** SQL is generated from them, not vice versa.
5. **Tests mock external boundaries** (`@/db`, `@clerk/nextjs/server`, `next/cache`, `next/navigation`, `ai`). No test should require a real DB or network.
6. **Scripts that touch `process.env.DATABASE_URL` must dynamic-import the db client inside `main()`** so dotenv loads before module init. See `scripts/seed-pirate-class.ts`.
