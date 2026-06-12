# Card-grant rebalance — review/practice card sources + section-aware boss

> David's playtest ask (2026-06-12): "平衡一下获取卡片的机制". Make completing a
> section earn cards, with a fair per-section rule, and tell the kid clearly when
> no card comes.

## Rules (locked with David)

- **Review** completion → 1 card, but **once per (week, day)**. A same-day repeat
  of the SAME week's review earns nothing and shows "今日回顾已完成,不再获得新卡片".
  Reviewing a DIFFERENT week's set the same day earns again.
- **Practice** completion → 1 card on every full completion, bounded **only by the
  daily total cap** (the grind path; replaying the same week's practice can earn
  again until the cap).
- **Boss** → unchanged (1 card per clear, daily-cap bound).
- Any source hitting the shared **daily cap (10)** → "今日卡片已经发放完毕,明日再来".

## Key finding (latent bug, fixed here)

`finishLevelAction` derived `bossCleared` from the **week's last level** (always a
boss) + "all scenes passed" (section-relative, always true on completion). It had
no idea which section ran, so **finishing review/practice on a ≥10-char week
mis-fired boss-clear** — paying 300 coins, granting a boss card, and marking the
week boss-cleared. Threading the section makes detection exact:
`bossCleared = section === 'boss' && allScenesCleared`.

`upsertWeekProgress` only ever upgrades `bossCleared` to `true`, so passing
`false` from review/practice never un-clears a real boss.

## Implementation

- `pullCardInTx` (grants.ts) + `CardGrantSource` (gacha.ts): add `'review' | 'practice'`.
- `FinishLevelSchema`: new `section: 'review' | 'practice' | 'boss'` (default `'boss'`).
- `finishLevelAction`:
  - `bossCleared = section === 'boss' && allScenesCleared` (was week-last-level).
  - On a fully-cleared review/practice section, `pullSectionCard`:
    - review → `refId = ${weekId}:${todayUtcIso()}` (per week, per day).
    - practice → `refId = sessionId` (cap-only).
  - New helper `pullSectionCard` returns `{ card, skip }` where `skip` is
    `'review_done_today'` (review `already_granted`) or `'daily_cap_reached'`.
  - Returns new `cardMessage?: CardSkipReason | null`. Review/practice cards join
    `cardGrants`, so the existing `earn_card` quest tick + `pack-complete` trophy
    loop cover them for free.
- `SceneRunner`: new `section` prop → passed to `finishLevelAction`; surfaces
  `cardMessage` into `LevelFanfare`.
- `LevelFanfare`: renders a bilingual notice from `cardMessage`.
- Section page passes `section={typedSection}`.

Daily cap stays 10, shared across all sources. No migration, no recompile.

## Tests
finish-level-boss: section drives boss detection; review keyed by week+day;
review repeat → `review_done_today`; practice keyed by session; cap →
`daily_cap_reached`. level-fanfare: renders both notices + none when absent.
Updated 2 xp-quest + 2 boss tests that simulated "non-boss" via last-scene type
to pass `section: 'practice'`.
