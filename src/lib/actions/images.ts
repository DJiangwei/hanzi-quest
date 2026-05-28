'use server';

import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { characterWord, weekCharacters, words } from '@/db/schema';
import { fetchAndUploadImage } from '@/lib/ai/pollinations';

const CONCURRENCY = 5;

export async function generateMissingImagesForWeek(weekId: string): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const session = await auth();
  if (!session.userId) {
    throw new Error('generateMissingImagesForWeek: no auth session');
  }

  // Join words ← character_word ← week_characters; scoped to this week, only
  // rows missing imageUrl but having a non-null imageHook (the prompt).
  const rows = await db
    .select({ id: words.id, text: words.text, imageHook: words.imageHook })
    .from(words)
    .innerJoin(characterWord, eq(characterWord.wordId, words.id))
    .innerJoin(weekCharacters, eq(weekCharacters.characterId, characterWord.characterId))
    .where(
      and(
        eq(weekCharacters.weekId, weekId),
        isNull(words.imageUrl),
        isNotNull(words.imageHook),
      ),
    );

  if (rows.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (w) => {
        try {
          const url = await fetchAndUploadImage(w.imageHook!, w.id);
          await db
            .update(words)
            .set({ imageUrl: url })
            .where(and(eq(words.id, w.id), isNull(words.imageUrl)));
          return { ok: true as const };
        } catch (err) {
          console.error(`[generateMissingImagesForWeek] ${w.text}:`, err);
          return { ok: false as const };
        }
      }),
    );
    for (const r of results) {
      if (r.ok) succeeded++;
      else failed++;
    }
  }

  return { attempted: rows.length, succeeded, failed };
}
