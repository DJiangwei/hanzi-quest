/**
 * Which maps have an overlord — PURE and client-safe.
 *
 * `final-boss-roster.ts` cannot answer this question for a server component:
 * it holds React components, and importing it across the RSC boundary is the
 * documented hazard that bites `packRegistry` and `boss-roster` too. So the
 * SLUGS live here, with no components, and a test pins the two in agreement.
 *
 * The home page needs this because the 👑 lair node was derived purely from
 * "is the map fully cleared", never from whether an overlord exists. Map 2
 * shipped ten authored weeks with no roster entry, so clearing 里海 would
 * have shown the lair and then `FinalBossScene`'s developer fallback —
 * "No overlord for this map." — in English, to a six-year-old who had just
 * finished an entire map.
 */

export const FINAL_BOSS_MAP_SLUGS: readonly string[] = ['pirate-class-level-1'];

/** True when this map has an overlord to fight. */
export function hasFinalBoss(packSlug: string | null | undefined): boolean {
  return !!packSlug && FINAL_BOSS_MAP_SLUGS.includes(packSlug);
}
