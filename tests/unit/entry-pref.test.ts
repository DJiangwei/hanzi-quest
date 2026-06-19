import { describe, expect, it } from 'vitest';
import {
  parseEntryPref,
  kidEntryValue,
} from '@/lib/auth/entry-pref';

describe('parseEntryPref', () => {
  it('parses a parent preference', () => {
    expect(parseEntryPref('parent')).toEqual({ kind: 'parent' });
  });

  it('parses a kid preference with its child id', () => {
    expect(parseEntryPref('kid:abc-123')).toEqual({
      kind: 'kid',
      childId: 'abc-123',
    });
  });

  it('returns null for missing / empty / malformed values', () => {
    expect(parseEntryPref(undefined)).toBeNull();
    expect(parseEntryPref(null)).toBeNull();
    expect(parseEntryPref('')).toBeNull();
    expect(parseEntryPref('kid:')).toBeNull();
    expect(parseEntryPref('garbage')).toBeNull();
  });
});

describe('kidEntryValue', () => {
  it('round-trips through parseEntryPref', () => {
    expect(parseEntryPref(kidEntryValue('xyz'))).toEqual({
      kind: 'kid',
      childId: 'xyz',
    });
  });
});
