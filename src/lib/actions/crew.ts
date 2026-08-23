'use server';

// 船员互赠 Crew card gifting.
//
// READ BEFORE EDITING. This is the project's SECOND deliberate cross-account
// write path — the first and only other one is `assertAdmin`, which is safe
// because it demands role === 'admin'. Here a child deliberately writes a row
// into a child belonging to a DIFFERENT family, so three properties carry the
// whole security argument and none of them are optional:
//
//   1. The GIVER is proven with `requireChild(fromChildId)` — it proves the
//      caller owns THAT SPECIFIC child. Never the parent guard, which only
//      proves a session exists (`users.role` defaults to 'parent' for every
//      Clerk signup; that is exactly the hole PR #155 closed).
//   2. The recipient write is ADDITIVE ONLY, guaranteed by `giftCardInTx`,
//      which inserts and never updates or deletes. Nothing here writes on its
//      own.
//   3. The item is validated INSIDE the transaction under SELECT ... FOR
//      UPDATE — the client's claim that the giver owns a duplicate is never
//      trusted.
//
// Every exported async function in a 'use server' file is a PUBLIC RPC
// endpoint, callable with arbitrary arguments. The crewmate picker UI
// constrains nothing. Read this file as if the only caller were an attacker
// holding a valid session for their own child.

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { requireChild } from '@/lib/auth/guards';
import { childExists } from '@/lib/db/crew';
import { giftCardInTx } from '@/lib/db/gifts';
import { todayUtcIso } from '@/lib/db/streaks';

export type GiftActionOutcome =
  | { ok: true; itemId: string }
  | {
      ok: false;
      reason:
        | 'no_duplicate'
        | 'already_owned'
        | 'send_cap_reached'
        | 'already_gifted_today'
        | 'receive_cap_reached'
        | 'self_gift'
        // The six above come straight from `giftCardInTx`; this one is the
        // action's alone — the transaction never sees an unknown recipient.
        | 'recipient_not_found';
    };

// `min(1)` only. `requireChild` is the real gate on `fromChildId`, and a
// uuid() shape check here would buy nothing while breaking non-uuid ids.
const GiftSchema = z.object({
  fromChildId: z.string().min(1),
  toChildId: z.string().min(1),
  itemId: z.string().min(1),
});

export async function giftCardAction(
  input: z.input<typeof GiftSchema>,
): Promise<GiftActionOutcome> {
  const parsed = GiftSchema.parse(input);

  // THE GATE. First statement that touches the database, deliberately: a
  // recipient lookup placed above it would turn this endpoint into an
  // existence oracle for arbitrary child ids, answerable by any signed-in
  // stranger. Everything below runs only for a caller proven to own the
  // giving child.
  const { child } = await requireChild(parsed.fromChildId);

  // The RECIPIENT is deliberately someone else's child. The crew is
  // currently "every child in the deployment", so existence IS the entire
  // membership check — see `childExists`, which carries the same note. If
  // the crew model ever narrows, this line narrows in lockstep with
  // `listCrewMates`; those two are the only places that define who is
  // reachable.
  if (!(await childExists(parsed.toChildId))) {
    return { ok: false, reason: 'recipient_not_found' };
  }

  // `child.id` — the VERIFIED id — is what reaches the transaction, never
  // `parsed.fromChildId` a second time. They are equal today only because
  // requireChild said so; re-reading the input would quietly re-open the
  // door if that ever stopped being true.
  const outcome = await db.transaction((tx) =>
    giftCardInTx(tx, child.id, parsed.toChildId, parsed.itemId, todayUtcIso()),
  );

  // The giver's duplicate count changed; refresh their own collection only.
  revalidatePath(`/play/${child.id}/collection`);

  // Returned as-is. Nothing about the recipient — no name, no progress, no
  // parent identity, not even their nickname (the caller already rendered it
  // from the id it supplied). The result must never become an oracle for
  // probing another family's account.
  return outcome;
}
