# 旅行商人 + 碎片唤醒 (E1+E2) — design

Date: 2026-07-18 · Approved by David ("E1+E2+E3 全做"; E3 multi-buy furniture ships separately)

## Problem (from the 2026-07-18 economy review, prod data)

Yinuo's coin balance is 12,580 and rising ~300+/day net. Her favorite coin sink
(home furniture) is nearly exhausted (11 items / 1,850🪙 left); the remaining
catalog (mostly avatar, 14,770🪙) doesn't interest her. Meanwhile cards clearly
DO motivate her (hit the 10/day cap on 07-14) and 23 shards sit idle (enough
for 7 swaps) with zero current dupes — she likely doesn't know the swap exists.
Coins have no bridge to the thing she actually wants.

## E2 · 旅行商人 Traveling Merchant

One **fixed, visible** card per (child, UTC day) sold for coins on the play
home page. Explicitly NOT a coin gacha (deleted 2026-07-05): no randomness at
purchase — she sees the exact card and saves toward it.

- **Offer derivation (never stored):** stable-ordered pool = unowned items of
  active `gacha_eligible` packs (order: pack slug, item slug); deterministic
  FNV-1a index over `childId:dayUtc` (`pickMerchantIndex`). Pool empty → no
  stall. Price by rarity: common 800 / rare 1200 / epic 1800 (~2–3 days of
  net income; also burns down the 12.5k hoard).
- **Purchase (`buyMerchantOfferAction` → `buyMerchantOffer`):** auth-gated;
  server recomputes the offer; client's `expectedItemId` mismatch →
  `offer_changed` (pool shifted mid-day). In one tx: `card_grants_log
  ('merchant', dayUtc)` insert is the once-per-day guard (23505 →
  `already_bought_today`); balance check + debit (`merchant_purchase` coin
  reason, migration 0036); `child_collections` upsert. Insufficient coins
  aborts the tx (control-flow error) so the day guard rolls back — an
  unaffordable tap must not burn the day. Discriminated outcome, never throws
  for expected cases (PR #128 rule).
- **Cap policy:** bypasses the 10/day card cap, same class as the shard swap —
  coin-funded conversion of already-earned effort, limited to 1/day anyway.
- **UI (`TravelingMerchant`):** compact stall panel on `/play/[childId]` under
  the quests; card art (word image or pack emoji), bilingual name + rarity,
  🪙 price on a WoodSignButton (disabled + "金币不够 / Not enough" when short);
  success → `CardChestReveal`; bought → "今天的货卖完啦,明天再来 / Sold out —
  come back tomorrow".

## E1 · 碎片唤醒 Shard nudge

`AtlasHub` (Backpack) gains a `shards` prop; when `shards >= SHARD_SWAP_COST`
a banner shows "💠 你有 N 枚碎片 — 还能换 M 张新卡!" pointing at the pack pages
where the swap lives. Server page fetches `getGlobalShards`.

## Non-goals

- No new tables/columns (migration is one enum value).
- No merchant restock/reroll button, no multi-buy, no discount mechanics.
- E3 multi-buy furniture = separate PR.

## Tests

Pure picker determinism/range/rotation; db offer+buy outcomes (success /
insufficient / already-bought / stale-offer); action auth + recompute +
revalidate; panel render states + buy flow + sold-out + nudge threshold.
