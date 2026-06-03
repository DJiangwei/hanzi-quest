/**
 * Stable identifiers for the default avatar items. Mirrors the rows the
 * seed script writes with `unlock_via = 'default'`. Every child sees this
 * look before they buy anything; the rows are never sold.
 *
 * PR #58: expanded to 7 slots. Array order = back-to-front SVG render order.
 * `decor` intentionally has no default (it's optional/expressive).
 */
export const DEFAULT_AVATAR = {
  head: 'default-kid-warm',
  hat: 'default-bandana-red',
  top: 'default-tee-stripes',
  background: 'default-ocean',
  hair: 'default-hair-brown',  // PR #58 new default
  pants: 'default-pants-blue', // PR #58 new default
  // decor intentionally absent
} as const;

/**
 * Slot rendering order (back → front). Adding to this array auto-extends
 * AvatarRender — no other code change needed.
 *
 *   background  ← furthest back
 *   decor       ← decorative bg elements (sun, palm)
 *   head        ← face/skin
 *   pants       ← legs
 *   top         ← shirt (drawn over the pants waistline)
 *   hair        ← hair on top of head, under hat
 *   hat         ← hat / accessory on top
 */
export const AVATAR_SLOT_IDS = [
  'background',
  'decor',
  'head',
  'pants',
  'top',
  'hair',
  'hat',
] as const;
export type AvatarSlotId = (typeof AVATAR_SLOT_IDS)[number];

export const SLOT_DISPLAY_NAMES: Record<AvatarSlotId, string> = {
  background: '背景',
  decor: '装饰',
  head: '脸',
  pants: '裤子',
  top: '上衣',
  hair: '发型',
  hat: '帽子',
};
