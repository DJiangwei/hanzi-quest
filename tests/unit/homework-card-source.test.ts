import { describe, expect, it } from 'vitest';
import type { CardGrantSource } from '@/lib/play/card-grants';

describe('homework card source', () => {
  it("'homework' is an assignable CardGrantSource", () => {
    const s: CardGrantSource = 'homework';
    expect(s).toBe('homework');
  });
});
