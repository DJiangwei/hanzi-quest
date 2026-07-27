// PURE — no '@/db'. Imported by both the route (server) and the scene (client).
import type { BossQuestionType } from '@/lib/scenes/configs';

/** The CharacterDetail shape BossScene/sub-scenes consume. */
export interface FinalBossCharacter {
  characterId: string;
  hanzi: string;
  pinyinArray: string[];
  meaningEn: string | null;
  meaningZh: string | null;
  imageHook: string | null;
  firstWord: string | null;
  /** The char's words — an `image_pick` question borrows a picture from one.
   *  Optional so older callers/tests building a bare pool still type-check. */
  words?: {
    id: string;
    text: string;
    imageHook: string | null;
    meaningEn: string | null;
    imageUrl: string | null;
  }[];
  sentence: { id: string; text: string; translationEn: string | null } | null;
}

export interface FinalBossQuestion {
  type: BossQuestionType;
  target: FinalBossCharacter;
}

export const FINAL_BOSS_PHASES = 3;
export const FINAL_BOSS_PER_PHASE = 6;

// Reuse the boss rotation (word_match excluded — it's a multi-char round;
// visual_pick dropped 2026-07-27 — its choices ARE the pinyin, and pinyin is
// hidden by default). Unlike the weekly boss these types are chosen at RUNTIME,
// so changing this list needs no recompile.
const QUESTION_TYPES: BossQuestionType[] = [
  'audio_pick',
  'image_pick',
  'translate_pick',
  'sentence_cloze',
];

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build the final-boss gauntlet: FINAL_BOSS_PHASES groups × FINAL_BOSS_PER_PHASE
 * questions, targets sampled across the whole map pool (cycled with repeats when
 * the pool is smaller than the total), question types round-robin. Pure — inject
 * `rng` for deterministic tests. Returns [] for an empty pool.
 */
export function buildFinalBossPhases(
  pool: FinalBossCharacter[],
  rng: () => number = Math.random,
): FinalBossQuestion[][] {
  if (pool.length === 0) return [];
  const total = FINAL_BOSS_PHASES * FINAL_BOSS_PER_PHASE;
  const shuffled = shuffle(pool, rng);
  const flat: FinalBossQuestion[] = Array.from({ length: total }, (_, i) => ({
    type: QUESTION_TYPES[i % QUESTION_TYPES.length],
    target: shuffled[i % shuffled.length],
  }));
  const phases: FinalBossQuestion[][] = [];
  for (let p = 0; p < FINAL_BOSS_PHASES; p++) {
    phases.push(
      flat.slice(p * FINAL_BOSS_PER_PHASE, (p + 1) * FINAL_BOSS_PER_PHASE),
    );
  }
  return phases;
}
