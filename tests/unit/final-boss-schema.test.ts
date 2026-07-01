import { describe, expect, it } from 'vitest';
import { finalBossClears } from '@/db/schema';

describe('finalBossClears schema', () => {
  it('exists with childId + packId columns', () => {
    expect(finalBossClears).toBeDefined();
    // drizzle table objects expose columns under the property names
    expect(finalBossClears.childId).toBeDefined();
    expect(finalBossClears.packId).toBeDefined();
    expect(finalBossClears.clearedAt).toBeDefined();
  });
});
