# Season runbook — how to retire one season and launch the next

Written 2026-09-05 against production. Companion to `docs/map2-authoring-runbook.md`.
Read this **before** touching `src/lib/season/*` or any `scripts/*season*`.

---

## State as of 2026-09-05 (verified against prod)

| fact | value |
|---|---|
| season row | `summer-voyage-2026` · 夏季航海 · 30 tiers |
| window | **2026-06-13 → 2026-08-08** |
| ended | **28 days ago** |
| `is_active` | **still `true`** |
| Yinuo | 6,345 season XP · claimed **30/30** tiers |
| 小板 | 1,070 season XP · claimed **10/30** tiers |
| XP earned since the season ended | Yinuo **1,785** · 小板 **150** — currently counting toward nothing |

Nothing was lost: the end-of-season sweep (`syncSeasonProgress`) banked every
reached-but-unclaimed tier, and 小板's 10 tiers is exactly what 1,070 XP buys
(tier 10 = 950, tier 11 = 1,100). The season page correctly renders
`赛季已结束 / Season ended`.

But the home banner has advertised a finished season for four weeks, and the
stale `is_active = true` is the first trap below.

---

## The model — what a season actually is

A season is **three things and no state**:

1. one row in `seasons` (window + `tier_config` jsonb + `is_active`),
2. a typed tier table in `src/lib/season/<slug>.ts` — the source of truth,
3. reward-only cards and cosmetics that the tiers reference by slug.

**Season XP is DERIVED, never stored.** `getSeasonXp` sums `xp_events.amount`
between `starts_at` and `ends_at`. There is no season-XP column, no reset job,
and there must never be one — `child_xp.totalXp` stays lifetime-permanent and a
new season is simply a later window over the same ledger.

Two consequences that decide the whole launch:

- **`starts_at` retroactively decides what counts.** Yinuo has 1,785 XP sitting
  in the gap since 08-08. Backdate a new season to 08-09 and she is handed
  roughly 15 tiers on day one; start it today and that XP is discarded. Neither
  is wrong — but it is a **deliberate decision every time**, never a default.
- A dropped multiplier cannot be applied retroactively by re-summing. If a
  bonus is ever wanted, emit a separate `season_bonus` XP event at award time.

---

## Four traps, each verified in the current code

**1. `getActiveSeason()` has no `ORDER BY`.**
```ts
db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1)
```
Two active rows → Postgres may return **either**, and which one it returns can
change between requests. Symptom: "the season page sometimes shows the wrong
season". So **step one of any launch is deactivating the old season**, before
the new row exists — not after, and not in the same breath.

**2. There is no script to close a season.** `seed-season-summer.ts` ends in
`.onConflictDoNothing()` (deliberate — a re-run must never re-window a live
season) and `sync-season-tier-config.ts` updates `tier_config` **only, never**
`starts_at` / `ends_at` / `is_active`. Both refuse to end a season, by design,
and nothing else does it either. Closing one currently means a hand-written
`UPDATE` against prod. **Add `scripts/close-season.ts` before the next launch.**

**3. Editing the TS tier table does not reach the database.** Because of the
`onConflictDoNothing`, changing `summerVoyage.ts` and re-running the seed is a
no-op on an existing row. Run `scripts/sync-season-tier-config.ts`. Same failure
class as a missing `seed-trophies.ts` run: tests mock `@/db`, so nothing local
catches it and the change simply sits in TypeScript forever.

**4. The wardrobe label is hardcoded to *this* season's name.**
`THEME_DISPLAY_NAMES.season = { zh: '夏季航海', en: 'Summer Voyage' }`
(`src/lib/avatar/themes.ts`). The avatar theme is the generic `'season'`, so
**season 2's cosmetics would appear in the 奖励衣橱 labelled 夏季航海.** Either
retitle it to something season-neutral (奖励赛季 / Season Rewards) or add a
per-season theme — but a new theme must also be added to `AVATAR_THEMES`,
`REWARD_THEMES`, and kept out of `SHOP_FILTER_THEMES`.

---

## Launch checklist

Run order matters: the season row's tiers reference cards, cosmetics and a
trophy by slug, and `claimSeasonTierInTx` resolves them at claim time. Seed the
things being referenced first.

**Author (code, one PR):**

- [ ] `src/lib/season/<slug>.ts` — meta + 30 tiers. `xpRequired` must be strictly
      increasing (`season-config.test.ts` pins it). Cosmetic `unlockRef`s must
      match `itemCatalog`, `cardSlug`s must match the season card data, tier 30's
      `trophySlug` must match `seed-trophies.ts`.
- [ ] Season cards: data file + `PACK_REGISTRY` entry + `seed-season-cards`
      equivalent. Pack must be `gacha_eligible = false` (reward-only) and listed
      in `SHARD_SWAP_EXCLUSIVE_PACKS` (12 shards, not 3 — a missed timed window
      deserves a costly recovery path, not none).
- [ ] Cosmetics in `itemCatalog` with `rewardOnly` + a season theme; check trap 4.
- [ ] Tier-30 trophy row in `seed-trophies.ts`.
- [ ] `bonusMoneyPence` on the £ tiers if the piggy bank should pay
      (currently 10/20/30 → 50p/£1/£1.50). It is credited **inside**
      `claimSeasonTierInTx`'s transaction and gated by `isPiggyEnabledInTx` —
      never call `creditPiggyInTx` without that gate.

**Deploy, then against PROD in this order:**

1. [ ] `seed-season-cards.ts` (or the new season's equivalent)
2. [ ] `seed-festival-avatar-items.ts` / the cosmetics seed
3. [ ] `seed-trophies.ts`
4. [ ] **close the previous season** (`is_active = false`) — before step 5
5. [ ] `seed-<new-season>.ts`
6. [ ] `scripts/verify-integrity.ts` — exits 1 on code⟷DB drift
7. [ ] Open `/play/[childId]/season` as each child and confirm the right season,
       the right tier, and a sane countdown

Remember the DB topology: `.env.local` points at the **dev** branch by default.
Prod ops need the commented `# PROD_DATABASE_URL=` swap, and swapping back after.

---

## Calibrating the XP curve — do the arithmetic, don't copy the numbers

Summer's curve (tier 30 at 4,100 XP over 8 weeks) fit Yinuo and not 小板:
she finished at tier 10. Measured play rate **since** the season ended:

| child | XP in 28 days | per day | projected over an 8-week season | tier reached |
|---|---|---|---|---|
| Yinuo | 1,785 | ~64 | ~3,570 | ~27 of 30 |
| 小板 | 150 | ~5 | ~300 | **~4 of 30** |

Copying summer's curve unchanged would give 小板 four tiers in two months. A
30-tier track she can see and never reach is a worse experience than a shorter
one she finishes — and this product deliberately softens 畏难情绪 everywhere else
(`boss_courage` pays on a loss, the boss keeps progress on retry, rewards are
named before the fight). Either flatten the curve, shorten the track, or accept
the split knowingly. Do not decide it by copying the previous table.

---

## Cadence — **quarterly, 12 weeks** (decided 2026-09-05)

Four seasons a year, ~12 weeks each, anchored to UK school terms.

The binding constraint is **content cost, not player appetite**: each season
needs ~5 cards (with Cloudflare art), ~8 cosmetics (an SVG apiece), a trophy, a
tier table and three seed runs. At 8 weeks that is 6.5 seasons a year, which a
hobby project cannot feed. Twelve weeks gives four, on dates that are easy to
remember — and remembering matters, because closing a season is a manual step
and 夏季航海 sat open for 28 days precisely because nothing prompted anyone.

The theme follows whichever map she is playing when the season opens.

**Season 2 — 里海远航 / Caspian Passage** opened 2026-09-05, 12 weeks, NOT
backdated (the 1,785 XP Yinuo had banked since 08-08 was allowed to lapse; see
the `starts_at` rule above). Its curve is front-loaded: tier 10 at **400** XP
against summer's 950, so the lighter player finishes the first third rather than
stalling at four rungs of thirty. Tier 30 stays at 4,000.
