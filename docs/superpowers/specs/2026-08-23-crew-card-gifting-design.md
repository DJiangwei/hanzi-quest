# Crew & Card Gifting — design

**Date:** 2026-08-23
**Status:** approved in outline (David, 2026-08-23); this doc is the detailed spec
**Owner:** David / Claude

---

## 1. Why

hanzi-quest is being shared with a handful of friends' children for the first
time. David's goal, chosen explicitly: **give Yinuo playmates.** Not growth, not
a product — the other children exist so that she has people to play *with*.

Two decisions follow from that and are locked:

1. **Everyone plays the same map.** Friends do not need their own curriculum —
   Map 1's characters are treated as a generic beginner set. This means the
   admin-only authoring gate from PR #155 costs nothing, and shared content
   becomes a *precondition* for social play rather than a compromise.
2. **Identity is nickname + avatar, never a real name.** Other people's children
   are involved.

### The trap this design exists to avoid

The obvious first build is a leaderboard. It is the wrong move here, and
specifically wrong for this project.

Yinuo is on island 7, 小板 on island 9, a new friend starts at 0. A ranked list
tells the newcomer they are last on day one. Worse: this whole product line of
work started because **she was avoiding boss battles out of 畏难情绪**, and three
separate features exist to soften that — `boss_courage` pays out on a *failed*
attempt, `BossScene.reset()` deliberately keeps question progress on retry, and
T3 spells the rewards out *before* the fight. A public ranking would undo all
three.

**Design constraint, binding on everything below: social features must be
additive. Nothing may produce a visible "you are behind" signal.**

## 2. What actually motivates a six-year-old

Not rank. Four things, in rough order of power:

1. Giving something to a friend
2. Seeing what a friend has that they don't
3. Knowing a friend is alive and playing
4. Working toward something together

This spec builds **#1**, because it is the strongest and because it *creates*
#2: you cannot gift a card a friend already owns, so choosing a gift requires
looking at what they lack. Gifting first grows the browse mechanic for free;
building them the other way round does not.

## 3. Scope

**In:**
- A "crew" — every child in the deployment, no friend requests
- A per-child pirate nickname, derived, never typed
- Gifting a **duplicate** card to a crewmate
- Receiving a gift, surfaced through the existing chest reveal

**Out (deliberately, this round):**
- Browsing a crewmate's full collection (the natural next step — build after
  gifting proves itself)
- Crew activity feed
- Shared weekly goals
- Any leaderboard, rank, or comparative counter — permanently out
- Friend requests, blocking, discovery, privacy settings — over-engineering for
  four-to-six families who know each other

## 4. The crew

**Model:** every `child_profiles` row in the deployment is in one crew. No table,
no membership rows — the crew *is* the child list.

**Rationale:** four to six families who all know each other. Friend requests
would add an invite flow, a pending state, and a confirmation UI to protect
against a threat that does not exist here. If the deployment ever grows past
people-who-know-each-other, this is the assumption to revisit first.

**Read helper** (new, `src/lib/db/crew.ts`):

```ts
export interface CrewMate {
  childId: string;
  nickname: { zh: string; en: string };
  avatarLook: AvatarLook;   // already the shape AvatarRender consumes
}

/** Every child except the caller's own. Never returns displayName. */
export async function listCrewMates(excludeChildId: string): Promise<CrewMate[]>;
```

**`displayName` must never leave this module.** The helper selects `id` only and
derives the nickname; a future field addition must not smuggle the real name
into a payload rendered to another family's child. A guard test asserts the
returned object shape.

## 5. Nicknames

**Derived deterministically from `child_profiles.id`. Never typed, never stored.**

A six-year-old typing a public handle means an input, a moderation policy, and a
PII surface. All three disappear if the name is generated.

`src/lib/crew/nickname.ts` (pure, client-safe):

```ts
/** Stable bilingual pirate name for a child id. Same id → same name, forever. */
export function nicknameFor(childId: string): { zh: string; en: string };
```

Implementation: two fixed word lists (a colour/quality and a nautical noun),
indexed by two independent hash slices of the uuid, e.g. 红帆船长 / Captain
Redsail. Lists sized so collisions are unlikely at this scale and harmless if
they occur — the avatar disambiguates.

**Identity is nickname + avatar together.** The avatar is already a
heavily-customised 7-slot SVG that no one has ever seen but its owner; surfacing
it gives the existing cosmetic shop a social reason to exist, which is a coin
sink the game already has.

## 6. Gifting

### Rules

| Rule | Value | Why |
|---|---|---|
| Giftable | duplicates only (`count >= 2`) | turns "another dupe" from a small disappointment into a resource; the giver's collection is never damaged |
| Cost to giver | the duplicate is consumed (`count - 1`) | a gift must cost something or it is not a gift |
| Blocked if recipient owns it | yes | **this is the load-bearing rule** — it forces the giver to learn what the friend lacks |
| Giver daily cap | `GIFTS_SENT_PER_DAY = 2` | unlimited gifting lets a crew funnel every dupe into one collection and collapses the collecting loop |
| Recipient daily cap | `GIFTS_RECEIVED_PER_DAY = 3` | bounds the inflow independently of who is sending |
| Daily card cap interaction | **bypasses** `child_card_grants_daily` | a gift is peer-to-peer, not a faucet — the same reasoning as the weekly 大礼包 and the shard swap. The two caps above are its bound instead. |
| Reversible | no | a six-year-old undoing a gift is a social mechanic nobody wants |

### Data

One new table (migration `0040`, append-only):

```sql
CREATE TABLE card_gifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_child_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  to_child_id   uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES collectible_items(id) ON DELETE CASCADE,
  day_utc       text NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  seen_at       timestamptz
);
CREATE INDEX card_gifts_to_unseen_idx ON card_gifts (to_child_id) WHERE seen_at IS NULL;
CREATE INDEX card_gifts_from_day_idx  ON card_gifts (from_child_id, day_utc);
CREATE INDEX card_gifts_to_day_idx    ON card_gifts (to_child_id, day_utc);
```

`day_utc` is denormalised (not derived from `sent_at`) so the cap queries are a
plain index scan, matching how `child_card_grants_daily` already works.

The card itself transfers immediately; `card_gifts` is the ledger and the
unseen-notification queue. `seen_at` is stamped when the recipient opens the
chest.

### The transaction

`giftCardInTx(tx, fromChildId, toChildId, itemId, dayUtc)` — mirrors
`convertDuplicateInTx`, which is the closest existing analogue:

1. `SELECT count FROM child_collections WHERE (fromChildId, itemId) FOR UPDATE`
   — reject `no_duplicate` if `< 2`
2. Recipient ownership check — reject `already_owned` if a row exists
3. Giver's sent-today count — reject `send_cap_reached` if `>= GIFTS_SENT_PER_DAY`
4. Recipient's received-today count — reject `receive_cap_reached` if `>= GIFTS_RECEIVED_PER_DAY`
5. `count - 1` on the giver's row
6. Insert the recipient's `child_collections` row with `count: 1`
7. Insert the `card_gifts` row

Returns a discriminated result, never throws for an expected case — the
`PurchaseOutcome` pattern the shop already uses.

**Ordering note:** the `FOR UPDATE` on step 1 must come first so two concurrent
gifts of the same dupe cannot both pass the `count >= 2` check.

### The action — and the security constraint that governs it

```ts
// src/lib/actions/crew.ts  ('use server')
export async function giftCardAction(input: {
  fromChildId: string;
  toChildId: string;
  itemId: string;
}): Promise<GiftOutcome>;
```

**This is the project's second deliberate cross-account write path.** Until now
`assertAdmin` was the only one, and PR #155 exists precisely because a gate that
merely proved "is signed in" let a stranger reach shared data. Gifting writes a
row into a child belonging to a *different family* by design, so it must be
tight:

- `requireChild(fromChildId)` — the giver must be the caller's own child. Not
  `assertParent`; that only proves a session exists.
- `toChildId` must resolve to an existing `child_profiles` row. Because the crew
  is "everyone", membership needs no further check today — **but if the crew
  model ever narrows, this is the line that must narrow with it.**
- `itemId` is validated by the transaction owning it (`count >= 2` under
  `FOR UPDATE`), not by trusting the client.
- Nothing about the recipient is returned except their nickname — no
  `displayName`, no progress, no parent identity.

The reverse direction is not writable at all: a caller can never *take* a card.

### Receiving

Unseen gifts are picked up on the kid's home render (same place daily quests and
bounties already generate) and surfaced through the existing `CardChestReveal`
with the giver's nickname on the chest — "来自 红帆船长 的礼物 / A gift from
Captain Redsail". `seen_at` is stamped on open.

Reusing the chest matters: it is the animation the child already associates with
getting a card, so a gift reads as *the good thing*, immediately.

### What is deliberately NOT shown

**No gifts-received counter, anywhere.** A visible tally creates exactly the
signal this design exists to avoid: the child nobody sends to acquires a new,
quieter way to feel behind. Gifts appear at the moment they arrive and then live
in the collection like any other card.

The giver sees their own sent-today count only as remaining capacity ("今天还能
送 1 张"), never as a score.

## 7. UI surfaces

1. **Gift button on a card detail** in the Backpack — visible only when
   `count >= 2`. Opens a crewmate picker (avatar + nickname), with mates who
   already own the card shown greyed and unselectable, labelled 已经有了 /
   already has it. This is where the browse motivation is born.
2. **Chest on home** when an unseen gift exists.
3. Nothing else. No crew page this round.

All labels bilingual, ZH first.

## 8. Risks

| Risk | Assessment | Mitigation |
|---|---|---|
| Cross-account write widens the attack surface | Real — this is the concern PR #155 was about | `requireChild` on the giver; recipient writes are additive-only (never a delete or overwrite); item validated under `FOR UPDATE`; a guard test asserting `giftCardAction` gates at entry |
| A child feels bad receiving nothing | Real and quiet | No received-counter anywhere; gifts are moments, not scores |
| Collection loop deflates | Real if uncapped | Two independent daily caps; dupe consumed on send |
| Real names leak between families | Real | `listCrewMates` never selects `displayName`; guard test on the returned shape |
| Nickname collision | Low, harmless | Avatar disambiguates |

## 9. Success criteria

1. A child can gift a duplicate to a crewmate, and it arrives as a chest bearing
   the giver's nickname.
2. No path exposes another family's child's real name.
3. Cards a crewmate already owns cannot be selected.
4. Both daily caps hold under concurrent sends of the same duplicate.
5. No surface anywhere displays a rank, a received-count, or any comparative
   figure between children.
6. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green;
   `verify-integrity.ts` still 7/7.

## 10. Open question for David

Should a gift cost the giver anything **beyond** the duplicate — a few coins, say
— to make it feel weightier? My recommendation is **no**: the dupe is already a
real cost, and adding a coin price turns a gesture into a transaction, which is
the wrong feeling for the mechanic. Noted here because it is a one-line change
either way and easier to decide before implementation than after.

## 11. Note on sequencing

This is designed, not urgent. #155 and #156 shipped, so **the link can go out
now**. Watching how the children actually behave for a week — whether they ask
about each other at all — is better evidence for whether gifting is worth
building than any amount of further design. `/admin/economy` already reports
per-child activity.
