/**
 * "Remember last choice" for the post-login Kid/Parent fork. A small cookie
 * stores where the user last entered; the root page auto-redirects there on
 * return (unless `?choose=1` forces the chooser). Pure + client-safe — the
 * cookie name + parser live here so both the server action (writer) and the
 * root page (reader) share one source of truth without importing `'use server'`.
 */

export const ENTRY_COOKIE = 'hq_entry';
export const ENTRY_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export type EntryPref =
  | { kind: 'kid'; childId: string }
  | { kind: 'parent' }
  | null;

/** Parse the raw cookie value into a typed preference (null = none/invalid). */
export function parseEntryPref(raw: string | undefined | null): EntryPref {
  if (!raw) return null;
  if (raw === 'parent') return { kind: 'parent' };
  if (raw.startsWith('kid:')) {
    const childId = raw.slice('kid:'.length);
    return childId ? { kind: 'kid', childId } : null;
  }
  return null;
}

/** Serialize a kid preference to its cookie value. */
export function kidEntryValue(childId: string): string {
  return `kid:${childId}`;
}
