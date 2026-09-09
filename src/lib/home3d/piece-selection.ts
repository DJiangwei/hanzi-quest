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
