import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin, isLocked, MAX_FAILED_ATTEMPTS, COOLDOWN_MS } from '@/lib/auth/parent-pin';

describe('parent-pin', () => {
  it('hashPin produces a bcrypt hash that verifies', async () => {
    const hash = await hashPin('1234');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPin('1234', hash)).toBe(true);
    expect(await verifyPin('9999', hash)).toBe(false);
  });

  it('isLocked returns true when lockedUntil is in the future', () => {
    expect(isLocked(new Date(Date.now() + 60_000))).toBe(true);
    expect(isLocked(new Date(Date.now() - 60_000))).toBe(false);
    expect(isLocked(null)).toBe(false);
  });

  it('MAX_FAILED_ATTEMPTS is 5', () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5);
  });

  it('COOLDOWN_MS is 5 minutes', () => {
    expect(COOLDOWN_MS).toBe(5 * 60 * 1000);
  });

  it('rejects PINs that are not 4 digits', async () => {
    await expect(hashPin('12345')).rejects.toThrow();
    await expect(hashPin('abcd')).rejects.toThrow();
    await expect(hashPin('')).rejects.toThrow();
  });
});
