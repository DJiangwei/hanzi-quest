/**
 * GiftBundle schema + default — pure, client-safe, NO db import.
 * Used by the admin grant console to compose and validate bundles.
 */
import { z } from 'zod';

export const GiftBundleSchema = z.object({
  coins: z.number().int().optional(),
  xp: z.number().int().min(0).optional(),
  shards: z.number().int().min(0).optional(),
  powerups: z
    .object({
      hint: z.number().int().min(0).optional(),
      skip: z.number().int().min(0).optional(),
      streak_freeze: z.number().int().min(0).optional(),
    })
    .optional(),
  /** Grant a random card from every active gacha-eligible pack (once). */
  giftPack: z.boolean().optional(),
  /** Specific collectible_items.id values to grant. */
  cardItemIds: z.array(z.string()).optional(),
  /** Specific shop_items.id values to grant for free. */
  shopItemIds: z.array(z.string()).optional(),
  /**
   * Grant ALL active shop items of these kinds (expand at grant time;
   * only newly-owned items are recorded in result for undo precision).
   */
  shopUnlockAll: z
    .array(z.enum(['avatar', 'pet', 'sound_theme', 'decor', 'home']))
    .optional(),
});

export type GiftBundle = z.infer<typeof GiftBundleSchema>;

export const WELCOME_GIFT_DEFAULT: GiftBundle = {
  coins: 500,
  xp: 100,
  giftPack: true,
};
