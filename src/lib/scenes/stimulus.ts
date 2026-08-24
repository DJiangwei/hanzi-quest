/**
 * Picture-stimulus resolution for 看图找字 (`image_pick`).
 *
 * Single chars are too abstract to AI-generate well, so `characters.image_url`
 * is unused by design — an `image_pick` scene borrows a picture from one of the
 * char's WORDS instead. Both callers (SceneRunner for practice, BossScene for
 * the gauntlet) must resolve it the same way; before this module existed the
 * boss silently rendered every `image_pick` as the text-only fallback card
 * because it never threaded an image at all.
 *
 * `compile-week.ts` now freezes a chosen `wordId` into `scene_config`
 * (stimulus-validity.ts's `validStimulusWords`) instead of leaving the pick
 * to chance at render time — see docs/superpowers/specs/2026-08-23-image-
 * stimulus-validity-design.md. `preferredWordId` lets a caller honour that
 * frozen choice; when absent (or not found among `words` — a row compiled
 * before the recompile, or a word that's since vanished) this falls back to
 * the original "first word with a URL" behaviour so old rows keep rendering.
 * `words[].imageUrl` still resolves at RENDER time either way — a future art
 * backfill needs no recompile; what's frozen is *which word*, never *where
 * its picture lives*.
 *
 * Client-safe: pure, no db imports.
 */

export interface StimulusWord {
  /** Word id — matches `words.id`. Only needed to honour `preferredWordId`. */
  id?: string;
  /** Word text. Only needed to tell whether another char in the pool owns it. */
  text?: string | null;
  imageHook: string | null;
  meaningEn: string | null;
  imageUrl: string | null;
}

export interface StimulusImage {
  /** The picture to show, or null → the caller renders the text fallback. */
  imageUrl: string | null;
  /** English description of the picture, revealed by the free 💡 hint. */
  imageHint: string | null;
}

/**
 * Resolves the picture for an `image_pick` stimulus. `fallbackHook` is the
 * character's own imageHook, used for the hint text when the chosen word
 * carries neither a hook nor an English meaning.
 *
 * `preferredWordId`, when given and present in `words`, wins outright —
 * compile-week already validated it (unambiguous, imaged, or a counting
 * character's procedural case upstream of this function). Otherwise this
 * picks the first word that actually has a picture, same as before this
 * function accepted a preference at all.
 */
export function pickStimulusImage(
  words: StimulusWord[] | undefined,
  fallbackHook: string | null,
  preferredWordId?: string,
): StimulusImage {
  const preferred = preferredWordId
    ? words?.find((w) => w.id === preferredWordId)
    : undefined;
  const word = preferred ?? words?.find((w) => w.imageUrl) ?? null;
  return {
    imageUrl: word?.imageUrl ?? null,
    imageHint: word?.imageHook ?? word?.meaningEn ?? fallbackHook,
  };
}

/**
 * Resolve a stimulus for a host that has NO compiled `wordId` — i.e. the boss
 * gauntlets, whose questions are assembled at runtime rather than by
 * compile-week.
 *
 * Practice slots carry a `wordId` chosen and validated at compile time. The
 * bosses do not, so without this they fell back to `pickStimulusImage`'s
 * first-word-with-a-URL scan, which is exactly the guess this whole fix
 * removed: in a week teaching both 唱 and 歌, a 唱 question could show the
 * 唱歌 picture while 歌 sat in the choices — an unanswerable question, and in
 * a boss fight a wrong answer costs a life.
 *
 * `pool` is the question's own answer set, which is precisely the set a
 * stimulus has to be unambiguous against, so the ownership map is built from
 * it rather than from a separate query.
 */
export function pickValidStimulusImage(
  target: { hanzi: string; words?: StimulusWord[]; imageHook?: string | null },
  pool: { hanzi: string; words?: StimulusWord[] }[],
): StimulusImage {
  const owners = new Map<string, Set<string>>();
  for (const c of pool) {
    for (const w of c.words ?? []) {
      if (!w.text) continue;
      if (!owners.has(w.text)) owners.set(w.text, new Set());
      owners.get(w.text)!.add(c.hanzi);
    }
  }
  const safe = (target.words ?? []).filter(
    (w) => w.imageUrl && w.text && (owners.get(w.text)?.size ?? 1) === 1,
  );
  // No unambiguous word → no picture. ImagePickScene renders its text card,
  // which is a legitimate (if plainer) question, unlike a picture that
  // supports two of the answers on screen.
  return {
    imageUrl: safe[0]?.imageUrl ?? null,
    imageHint: safe[0]?.imageHook ?? safe[0]?.meaningEn ?? target.imageHook ?? null,
  };
}
