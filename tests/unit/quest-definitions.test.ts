import { describe, expect, it } from 'vitest';
import { QUEST_DEFS, QUEST_BY_KEY, getQuestDef } from '@/lib/quests/definitions';

describe('quest definitions', () => {
  it('has 8 quests', () => {
    expect(QUEST_DEFS).toHaveLength(8);
  });

  it('each def has required fields', () => {
    for (const q of QUEST_DEFS) {
      expect(q.key).toBeTruthy();
      expect(q.labelZh).toBeTruthy();
      expect(q.labelEn).toBeTruthy();
      expect(q.emoji).toBeTruthy();
      expect(q.target).toBeGreaterThan(0);
      expect(q.xp).toBeGreaterThan(0);
      expect(typeof q.feasible).toBe('function');
    }
  });

  it('keys are unique', () => {
    const keys = QUEST_DEFS.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('boss_clear is not feasible when bossUnlocked=false', () => {
    const def = QUEST_BY_KEY.get('boss_clear');
    expect(def).toBeDefined();
    expect(def!.feasible({ bossUnlocked: false })).toBe(false);
    expect(def!.feasible({ bossUnlocked: true })).toBe(true);
  });

  it('complete_scenes is always feasible', () => {
    const def = QUEST_BY_KEY.get('complete_scenes');
    expect(def).toBeDefined();
    expect(def!.feasible({ bossUnlocked: false })).toBe(true);
    expect(def!.feasible({ bossUnlocked: true })).toBe(true);
  });

  it('getQuestDef returns the def by key', () => {
    const def = getQuestDef('perfect_scores');
    expect(def?.key).toBe('perfect_scores');
  });

  it('getQuestDef returns undefined for unknown key', () => {
    expect(getQuestDef('nonexistent')).toBeUndefined();
  });
});
