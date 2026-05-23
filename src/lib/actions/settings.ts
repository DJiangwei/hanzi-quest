'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { setSoundTheme } from '@/lib/db/settings';
import { listChildOwnedShopItemIds, listShopItemsByKind } from '@/lib/db/shop';
import {
  checkAndGrantTrophies,
  type GrantedTrophy,
} from '@/lib/db/trophies';

export async function equipSoundThemeAction(
  childId: string,
  slug: string | null,
): Promise<{ themeSlug: string | null; trophies: GrantedTrophy[] }> {
  await requireChild(childId);

  // Default is always allowed — slug-less fallback.
  if (slug === null || slug === 'default') {
    await setSoundTheme(childId, null);
    revalidatePath(`/play/${childId}/shop`);
    const trophies = await checkAndGrantTrophies(childId, {
      kind: 'sound-theme-equip',
      slug: null,
    });
    return { themeSlug: null, trophies };
  }

  const themes = await listShopItemsByKind('sound_theme');
  const match = themes.find((t) => t.slug === slug);
  if (!match) {
    throw new Error(`Unknown theme slug: ${slug}`);
  }

  const owned = await listChildOwnedShopItemIds(childId);
  if (!owned.has(match.id)) {
    throw new Error(`Theme "${slug}" not owned`);
  }

  await setSoundTheme(childId, slug);
  revalidatePath(`/play/${childId}/shop`);
  const trophies = await checkAndGrantTrophies(childId, {
    kind: 'sound-theme-equip',
    slug,
  });
  return { themeSlug: slug, trophies };
}
