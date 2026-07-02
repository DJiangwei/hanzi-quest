import { describe, expect, it } from 'vitest';
import {
  buildFinalBossPhases,
  FINAL_BOSS_PHASES,
  FINAL_BOSS_PER_PHASE,
  type FinalBossCharacter,
} from '@/lib/play/final-boss';

function ch(n: number): FinalBossCharacter {
  return {
    characterId: `c${n}`,
    hanzi: `字${n}`,
    pinyinArray: ['zi'],
    meaningEn: `m${n}`,
    meaningZh: null,
    imageHook: null,
    firstWord: null,
    sentence: null,
  };
}
function seq(vals: number[]): () => number {
  let i = 0;
  return () => vals[i++ % vals.length];
}

describe('buildFinalBossPhases', () => {
  it('returns FINAL_BOSS_PHASES groups of FINAL_BOSS_PER_PHASE questions each', () => {
    const pool = Array.from({ length: 12 }, (_, i) => ch(i));
    const phases = buildFinalBossPhases(pool, seq([0.1, 0.5, 0.9]));
    expect(phases).toHaveLength(FINAL_BOSS_PHASES);
    for (const group of phases) {
      expect(group).toHaveLength(FINAL_BOSS_PER_PHASE);
      for (const q of group) {
        expect(pool.map((c) => c.characterId)).toContain(q.target.characterId);
        expect(typeof q.type).toBe('string');
      }
    }
  });
  it('returns empty when the pool is empty', () => {
    expect(buildFinalBossPhases([], seq([0.1]))).toEqual([]);
  });
  it('cycles targets with repeats when the pool is smaller than the total', () => {
    const pool = [ch(0), ch(1), ch(2)];
    const phases = buildFinalBossPhases(pool, seq([0.2, 0.7]));
    expect(phases.flat()).toHaveLength(FINAL_BOSS_PHASES * FINAL_BOSS_PER_PHASE);
  });
});
