// NEVER import this file from client code — it pulls in postgres.
import { eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { childProfiles } from '@/db/schema';
import { nicknameFor } from '@/lib/crew/nickname';
import { getEquippedAvatar } from '@/lib/db/shop';

export interface CrewMate {
  childId: string;
  nickname: { zh: string; en: string };
  equipped: Partial<Record<string, string | null>>;
}

/**
 * Everyone else in the deployment. The crew IS the child list — there is no
 * membership table, because four-to-six families who know each other do not
 * need friend requests. If the crew model ever narrows, THIS is the query
 * that narrows, and `giftCardAction`'s recipient check must narrow with it.
 *
 * Selects `id` ONLY. `child_profiles.displayName` belongs to another
 * family's child and must never leave this module — a future field addition
 * here is how a real name would leak into a payload rendered to someone
 * else's kid. Identity to a crewmate is `nicknameFor` + the equipped avatar,
 * never `displayName`.
 */
export async function listCrewMates(
  excludeChildId: string,
): Promise<CrewMate[]> {
  const rows = await db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(ne(childProfiles.id, excludeChildId));

  return Promise.all(
    rows.map(async (r) => {
      // `getEquippedAvatar` returns SlotEquip rows keyed by slot, each
      // carrying an internal `avatarItemId` a crewmate's client has no
      // reason to receive — flatten to slot -> unlockRef only, same
      // conversion the home page does for its own avatar render.
      const equipped = await getEquippedAvatar(r.id);
      const equippedRefs: Partial<Record<string, string | null>> = {};
      for (const [slot, info] of Object.entries(equipped)) {
        equippedRefs[slot] = info.unlockRef;
      }
      return {
        childId: r.id,
        nickname: nicknameFor(r.id),
        equipped: equippedRefs,
      };
    }),
  );
}

/**
 * Does this child exist anywhere in the deployment?
 *
 * Lives HERE, next to `listCrewMates`, because these two functions are the
 * only cross-account reads in the codebase and this is the module audited
 * for not leaking another family's data. Returns a BOOLEAN on purpose: a
 * helper that handed back a whole `childProfiles` row across accounts would
 * put `displayName` (and the owning parent's id) in the caller's hands, one
 * careless spread away from a payload rendered to someone else's kid.
 *
 * Membership semantics: the crew is currently "every child in the
 * deployment", so existence IS the entire membership check. If the crew
 * model ever narrows — friend lists, per-family opt-in, a class code — this
 * function must narrow in lockstep with `listCrewMates` above. Those two are
 * the only places that define who is reachable: `listCrewMates` decides who
 * a child can SEE, this decides who a child can WRITE to. Letting them drift
 * means a recipient that no picker ever offered is still giftable by anyone
 * who can type an id into the RPC.
 */
export async function childExists(childId: string): Promise<boolean> {
  const rows = await db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);
  return rows.length > 0;
}
