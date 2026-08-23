import { describe, expect, it } from 'vitest';
import { nicknameFor } from '@/lib/crew/nickname';

const ID_A = '11111111-2222-3333-4444-555555555555';
const ID_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('nicknameFor', () => {
  it('is deterministic — the same id always gets the same name', () => {
    expect(nicknameFor(ID_A)).toEqual(nicknameFor(ID_A));
  });

  it('gives different ids different names', () => {
    expect(nicknameFor(ID_A)).not.toEqual(nicknameFor(ID_B));
  });

  it('always returns a non-empty bilingual pair', () => {
    for (const id of [ID_A, ID_B, '', 'not-a-uuid', '0']) {
      const n = nicknameFor(id);
      expect(n.zh.length, id).toBeGreaterThan(0);
      expect(n.en.length, id).toBeGreaterThan(0);
    }
  });

  it('never leaks the id into the name', () => {
    const n = nicknameFor(ID_A);
    expect(n.zh).not.toContain('1111');
    expect(n.en).not.toContain('1111');
  });

  it('reaches essentially the whole name space, not a fraction of it', () => {
    // 12 qualities × 12 roles = 144 possible names. A weak hash silently
    // collapses this — the first implementation reached exactly 36 (a quarter)
    // because FNV-1a's low bits stayed correlated between the two axes, and a
    // "not collapsed" threshold of 30 was too weak to notice.
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      seen.add(nicknameFor(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`).en);
    }
    expect(seen.size).toBeGreaterThanOrEqual(140);
  });
});
