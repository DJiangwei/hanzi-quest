import { describe, expect, it } from 'vitest';
import { AlreadyClaimedError, InsufficientCoinsError } from '@/lib/db/gacha';

describe('Gacha error classes', () => {
  it('InsufficientCoinsError carries required + available', () => {
    const err = new InsufficientCoinsError(500, 320);
    expect(err.required).toBe(500);
    expect(err.available).toBe(320);
    expect(err.name).toBe('InsufficientCoinsError');
    expect(err.message).toContain('500');
    expect(err.message).toContain('320');
  });

  it('AlreadyClaimedError has descriptive name + message', () => {
    const err = new AlreadyClaimedError();
    expect(err.name).toBe('AlreadyClaimedError');
    expect(err.message).toMatch(/claimed/i);
  });
});
