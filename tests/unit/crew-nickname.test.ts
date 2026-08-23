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

  it('spreads across the space rather than collapsing onto one name', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(nicknameFor(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`).en);
    }
    // Two independent 12-word axes; 200 samples must not collapse to a handful.
    expect(seen.size).toBeGreaterThan(30);
  });
});
