import { describe, expect, it, vi } from 'vitest';

// Importing the route pulls in @/lib/db/parent-settings → @/db, which throws
// "DATABASE_URL is not set" on CI (local .env.local has it, so this only
// bites in CI — the standard mock-@/db landmine documented in CLAUDE.md).
vi.mock('@/db', () => ({ db: {} }));

import { safeNext } from '@/app/api/parent-unlock/route';

// Fix C (Finding 7, LOW): `/parent/unlock?next=` flowed untouched into the
// JSON response and then `window.location.href` client-side — an open
// redirect. `safeNext` allowlists same-origin absolute paths only.
describe('safeNext', () => {
  it('passes a plain same-origin path through unchanged', () => {
    expect(safeNext('/parent/children')).toBe('/parent/children');
  });

  it('falls back to /parent for an absolute off-site URL', () => {
    expect(safeNext('https://evil.example')).toBe('/parent');
  });

  it('falls back to /parent for a protocol-relative URL ("//host")', () => {
    // Browsers resolve `//evil.example` against the current scheme and
    // follow it off-site — a naive `startsWith('/')` check lets this through.
    expect(safeNext('//evil.example')).toBe('/parent');
  });

  it('falls back to /parent for a backslash-prefixed URL ("/\\host")', () => {
    // Some browsers normalize a leading backslash to a slash, making this
    // an equivalent protocol-relative escape.
    expect(safeNext('/\\evil.example')).toBe('/parent');
  });

  it('falls back to /parent when next is missing', () => {
    expect(safeNext(undefined)).toBe('/parent');
  });

  it('falls back to /parent for a non-string value', () => {
    expect(safeNext(42)).toBe('/parent');
  });

  it('falls back to /parent for an empty string', () => {
    expect(safeNext('')).toBe('/parent');
  });
});
