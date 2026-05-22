import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { childSettings } from '@/db/schema';

export type ChildSettingsRow = typeof childSettings.$inferSelect;

export async function getChildSettings(
  childId: string,
): Promise<ChildSettingsRow | null> {
  const rows = await db
    .select()
    .from(childSettings)
    .where(eq(childSettings.childId, childId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setSoundTheme(
  childId: string,
  slug: string | null,
): Promise<void> {
  await db
    .insert(childSettings)
    .values({ childId, soundThemeSlug: slug })
    .onConflictDoUpdate({
      target: childSettings.childId,
      set: { soundThemeSlug: slug, updatedAt: sql`NOW()` },
    });
}
