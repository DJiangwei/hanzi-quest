/**
 * Which copy a tap on a catalog piece hands her. PURE — no React, no `@/db`.
 *
 * `home_placements` is unique on `(childId, furnitureSlug, copyIndex)`
 * GLOBALLY (across every room, not per-room — E3 multi-buy), so the copy
 * index this returns must avoid every already-placed copy of the slug
 * anywhere in the home, not just the room currently on screen.
 */

export interface PieceSelection {
  copyIndex: number;
  /** null = placing a copy she already owns, no purchase. */
  shopItemId: string | null;
}

export function resolvePieceSelection(args: {
  ownedCount: number;
  /** copyIndex values of this slug already placed, in ANY room. */
  placedCopyIndices: number[];
  /** This slug's shop_items.id, or null if it isn't sold (or isn't seeded). */
  shopItemId: string | null;
  copyCap: number;
}): PieceSelection | null {
  const placed = new Set(args.placedCopyIndices);

  // An owned spare — a copy she paid for but hasn't put anywhere — always
  // wins over a fresh purchase.
  for (let i = 0; i < args.ownedCount; i++) {
    if (!placed.has(i)) return { copyIndex: i, shopItemId: null };
  }

  // No spare: offer a new purchase only if there's room under the cap and
  // the piece is actually sold.
  if (args.shopItemId && args.ownedCount < args.copyCap) {
    return { copyIndex: args.ownedCount, shopItemId: args.shopItemId };
  }

  // At the cap with nothing free, or not sold at all — nothing to hand her.
  return null;
}

/**
 * The selection a `?place=<slug>` URL parameter should arm, or null.
 *
 * The shop and the 3D room are different routes, so a piece chosen in the shop
 * travels here in the URL rather than in storage — stateless, back-button
 * safe, and it cannot re-arm a ghost days later the way a stored selection
 * would. Pure so it can be a lazy `useState` initializer (no effect, and
 * nothing to re-fire on re-render).
 *
 * Returns null for an unknown slug, a piece not sold, or one already at the
 * copy cap with nothing spare — the room simply opens with no ghost, which is
 * the honest outcome for a link that no longer applies.
 */
export function selectionFromPlaceParam(args: {
  slug: string | null | undefined;
  ownedSlugs: string[];
  shopItemIdBySlug: Map<string, string>;
  placedCopyIndicesBySlug: Map<string, number[]>;
  copyCap: number;
}): { slug: string; copyIndex: number; shopItemId: string | null } | null {
  const { slug } = args;
  if (!slug) return null;
  const ownedCount = args.ownedSlugs.filter((s) => s === slug).length;
  const resolved = resolvePieceSelection({
    ownedCount,
    placedCopyIndices: args.placedCopyIndicesBySlug.get(slug) ?? [],
    shopItemId: args.shopItemIdBySlug.get(slug) ?? null,
    copyCap: args.copyCap,
  });
  return resolved ? { slug, ...resolved } : null;
}
