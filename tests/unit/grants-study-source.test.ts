import { describe, expect, it } from 'vitest';
import type { CardGrantSource } from '@/lib/play/card-grants';

// The typed const is the real guard: if 'study' isn't in the union, `pnpm
// typecheck` fails. The runtime expect just keeps vitest happy.
describe("'study' card source", () => {
  it('is a valid CardGrantSource', () => {
    const s: CardGrantSource = 'study';
    expect(s).toBe('study');
  });
});
