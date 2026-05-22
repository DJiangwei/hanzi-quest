'use server';

import { revalidatePath } from 'next/cache';
import { requireChild } from '@/lib/auth/guards';
import { setSoundTheme } from '@/lib/db/settings';
import { listChildOwnedShopItemIds, listShopItemsByKind } from '@/lib/db/shop';

export async function equipSoundThemeAction(
  childId: string,
  slug: string | null,
): Promise<{ themeSlug: string | null }> {
  await requireChild(childId);

  // Default is always allowed — slug-less fallback.
  if (slug === null || slug === 'default') {
    await setSoundTheme(childId, null);
    revalidatePath(`/play/${childId}/shop`);
    return { themeSlug: null };
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
  return { themeSlug: slug };
}
