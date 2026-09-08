# New map runbook — how to open a map without shipping it broken

Written 2026-09-08, immediately after 里海 shipped with two defects that this
procedure would have caught. Companion to `docs/season-runbook.md`.
Read this **before** authoring a new map's first week.

`docs/map2-authoring-runbook.md` is the historical record of preparing map 2;
it describes what was *ready*, not the order of operations. This file is the
order of operations.

---

## Why this exists

里海 was authored, illustrated and published — and was still broken in two ways
nobody saw, because **neither failure produced an error**:

| what shipped | why nothing caught it |
|---|---|
| **Every `image_pick` in 8 of 10 weeks was degraded.** The weeks were compiled on 09-05; the word art was backfilled on 09-06. `validStimulusWords` runs at *compile* time, so at compile no word had a picture — no `wordId` was frozen, and the scene fell back to the unguarded first-word scan PR #158 exists to delete. | That fallback is a legitimate code path. Only `verify-stimulus-integrity.ts` could see it, and nobody ran it after the art landed. |
| **The map had no overlord.** None of the five registrations existed, yet the home board still drew a 👑 lair — so clearing all ten islands would have shown `FinalBossScene`'s developer string, *"No overlord for this map."*, in English. | The lair node was derived from `isMapFullyCleared` alone. Nothing ever asked whether the thing behind the entry point exists. |

Both are the same shape: **a step that is invisible when skipped.** The whole
point of the ordering below is that the invisible steps come last, where a
single verify command proves them.

---

## The order. It is not optional.

```
1. seed the pack row      →  2. author the weeks     →  3. generate word art
                                                              ↓
6. verify  ←  5. seed the reward chain  ←  4. RECOMPILE the pack
```

**Step 4 is the one that gets forgotten**, because step 3 is the one that gets
interrupted — a Cloudflare 429, a two-day quota window, an overnight gap. When
you come back and the art is finished, the job *feels* done. It is not: the
compiled scenes still describe the world as it was before the art existed.

### 1. Pack row

`scripts/seed-multi-map.ts` — **UPDATE the existing row, never insert a
sibling.** Maps are ordered by `curriculum_packs.created_at` with no order
column, so a new row always sorts last; a re-themed map that inserts instead of
updates shows the child two maps with the retired one first. The slug is a
POSITION (`pirate-class-level-3` = "the third map"), never a theme — re-theming
里海 from 印度洋 touched no slug, no foreign key and no child's save.

`isLocked` is derived as `weekCount === 0` over **published** weeks, so the map
unlocks itself when its first week publishes. Never set it by hand.

### 2. Author the weeks

`/admin/week/new` (admin-only since PR #155 — `assertParent` means "is signed
in", not "may author"). DeepSeek V4 Pro is a reasoning model, so each week is
one long HTTP call and long calls are the ones whose connections drop;
`withAiRetry` wraps both `generateObject` sites and the seed script keeps its
own wider retry.

**Aim for ≥ `BOSS_MIN_CHARS` (8) characters per week.** A shorter week compiles
*bossless*, and every rule phrased "until its boss is beaten" — frontier, linear
gating, the key ring, map completion — must then ask `listBossWeekIds` first or
it deadlocks on that week and locks everything after it. Map 1 week 10 was
unreachable in production for exactly this reason. 8 characters yields 12
practice scenes (`computePracticeSizing`, `n < 10`), not 15; that is by design.

### 3. Word art

`CF_ACCOUNT_ID=… CF_API_TOKEN=… pnpm tsx scripts/backfill-word-images-cloudflare.ts`

- **~125 images per day.** The Cloudflare free allowance is 10,000 neurons and
  flux-1-schnell costs ~80 each. A 10-week map is ~240 images, so **plan two
  days.**
- **The window is NOT a UTC calendar day.** Measured: exhausted on 09-05, still
  429 at 08:29 UTC on 09-06. It behaves like a rolling 24h window from first
  use. Don't "wait for tomorrow" — probe with a single generation call, which
  costs ~80 neurons on success and nothing on a 429.
- **The script exits 0 having generated nothing.** Read its
  `Done. N generated, M failed` line, or better, step 6.
- **NSFW false positives are normal and a plain retry clears them.** 烤鸭, 正方形,
  对不起, 回来, 小兔 and one eagle prompt all tripped it; all succeeded on retry.
  Do not reword the prompt — the filter is noisy, not right.
- A partial run leaves a **visible seam** (illustrated weeks 1-5, text cards
  7-10), which reads as broken more than a uniformly text-only map. If a run
  dies mid-way, finish it before anyone plays the later weeks.

Some words legitimately get **no** `image_hook`, and that column is an
**eligibility gate**, not missing data — compile picks `image_word` targets by
it and this script selects on it. Leave it null when no picture can identify
the word: 其他 ("other") is abstract; 教你 and 教我 are the same week and the
same character, so one picture answers both; 笑哈哈 collides with 哈哈's
existing art. See the landmine in `CLAUDE.md`.

### 4. Recompile — the step that gets skipped

```bash
ONLY_PACK=pirate-class-level-N pnpm tsx scripts/recompile-all-weeks.ts
```

**Always scope it.** A recompile re-picks every slot's words, so an unscoped run
rewrites the questions in weeks a child is part-way through (progress survives
via stable level keys; the questions don't). A typo'd `ONLY_PACK` exits 2 rather
than printing "No published weeks found" and exiting 0 — a recompile you believe
ran is worse than one that failed.

> **Re-styling art that already exists needs no recompile. Art arriving for the
> first time does.** These are opposite cases and the distinction is the entire
> bug above: `image_pick` freezes its stimulus `wordId` at compile time, so a
> word with no picture *at compile* is not a valid stimulus and never becomes
> one on a later DB write.

### 5. The reward chain — five registrations

A map without these can be played but never **finished**, and the next map can
never unlock, because gating reads `final_boss_clears`.

| # | thing | where |
|---|---|---|
| 1 | overlord component (4 states, reduced-motion safe) | `src/components/scenes/fx/bosses/<Name>.tsx` |
| 2 | roster entry **and** the pure slug list | `final-boss-roster.ts` + `final-boss-maps.ts` |
| 3 | champion card + `MAP_TO_CHAMPION_CARD` | `championsData.ts` |
| 4 | crown `ItemDef` whose `unlockRef` **equals the card slug** | `itemCatalog.tsx` |
| 5 | `MAP_TO_CHAMPION_TROPHY` + a row in the seed script | `trophies.ts` + `seed-trophies.ts` |
| + | `CHAMPION_TITLES` (bilingual) and a `VAULT_TREASURES` / `MAP_TO_VAULT_CARD` entry | `championsData.ts`, `keyVaultData.ts` |

`tests/unit/map-overlord-completeness.test.ts` enforces all of it — including
that each piece *resolves*, not merely exists. Give the champion card a **distinct
emoji**: `champions-v1` has no generated art, so a second 👑 renders a card
identical to the previous map's in the same hall.

Also add a `VOYAGE_MAPS` entry with **exactly as many stops as the map has
weeks** — `VoyageBoard` renders one medallion per *stop*, so a nine-stop config
against a ten-week map silently drops week 10 off the board. A test pins this.

Then run the seeds (all idempotent):
`seed-champions-pack.ts`, `seed-trophies.ts`, `seed-key-vault-pack.ts`, and —
this one is a trap — **`seed-festival-avatar-items.ts`**, which despite its name
iterates *all* of `rewardItems()` and is therefore what seeds the champion
crown. There is no `seed-champion-avatar-items.ts`; guessing that name is how
this runbook's first draft was wrong. `verify-integrity`'s
`rewardItems() ⊆ avatar_items` check is what catches a missed run.

### 6. Verify — the step that makes the other five true

```bash
pnpm tsx scripts/verify-stimulus-integrity.ts   # exit 1 if any stimulus is bad
pnpm tsx scripts/verify-integrity.ts            # 7 code⟷DB checks + map readiness
```

`verify-integrity` prints a **map readiness** line per map, always. A map with
published weeks and no overlord is named there explicitly. It is informational
rather than pass/fail on purpose: closing that gap takes a creature, a card, a
crown, a trophy and a title, and a gate left red for weeks is a gate everyone
learns to ignore.

**Run both after any art run, not just at the end of a map.** The lesson of
2026-09-07 is precise: an audit nobody runs is not a guard.

---

## Prod ops

`.env.local` points at the **dev** Neon branch by default. Every step above that
writes (seeds, art backfill, recompile) must be run against **prod** by swapping
`DATABASE_URL` to the commented `# PROD_DATABASE_URL=` line above it — **and
swapped back afterwards.** Migrations reach prod only via the Vercel production
build.

**Vercel Blob is 2,000 advanced operations/month.** A 10-week map's art is ~240
`put`s ≈ 12%. Generate each asset **once**; never bulk-regenerate. Browsing the
Blob store in the dashboard is also billed.
