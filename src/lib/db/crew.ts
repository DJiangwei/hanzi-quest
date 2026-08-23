// NEVER import this file from client code — it pulls in postgres.
import { ne } from 'drizzle-orm';
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
