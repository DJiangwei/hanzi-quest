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
 * Client-safe: pure, no db imports.
 */

export interface StimulusWord {
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
 * Picks the first word that actually has a picture. `fallbackHook` is the
 * character's own imageHook, used for the hint text when the chosen word
 * carries neither a hook nor an English meaning.
 */
export function pickStimulusImage(
  words: StimulusWord[] | undefined,
  fallbackHook: string | null,
): StimulusImage {
  const word = words?.find((w) => w.imageUrl) ?? null;
  return {
    imageUrl: word?.imageUrl ?? null,
    imageHint: word?.imageHook ?? word?.meaningEn ?? fallbackHook,
  };
}
