/**
 * Stable identifiers for the four default avatar items. Mirrors the rows the
 * seed script writes with `unlock_via = 'default'`. Every child sees this look
 * before they buy anything; the rows are never sold.
 */
export const DEFAULT_AVATAR = {
  head: 'default-kid-warm',
  hat: 'default-bandana-red',
  top: 'default-tee-stripes',
  background: 'default-ocean',
} as const;

export const AVATAR_SLOT_IDS = ['head', 'hat', 'top', 'background'] as const;
export type AvatarSlotId = (typeof AVATAR_SLOT_IDS)[number];

export const SLOT_DISPLAY_NAMES: Record<AvatarSlotId, string> = {
  head: '脸',
  hat: '帽子',
  top: '上衣',
  background: '背景',
};
