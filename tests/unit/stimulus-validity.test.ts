// 看图找字 (image_pick) stimulus validity — pure predicate.
//
// David played week 7 and hit a scene showing balloons for 七 with the wrong
// count. Investigation (docs/superpowers/specs/2026-08-23-image-stimulus-validity-design.md)
// found the picture-selection had never checked whether a word's picture can
// actually identify its character. These tests pin the two disqualifiers
// against the REAL corpus cases that were measured, not invented ones —
// 唱歌(唱/歌) and 多少(多/少) from week 7, 大人(人/大) from week 1.
import { describe, expect, it } from 'vitest';
import {
  COUNTING_CHARS,
  COUNTING_CHAR_VALUES,
  isCountingChar,
  validStimulusWords,
  type StimulusCandidate,
} from '@/lib/scenes/stimulus-validity';

const word = (over: Partial<StimulusCandidate>): StimulusCandidate => ({
  wordId: over.wordId ?? 'w-x',
  text: over.text ?? '字词',
  imageUrl: over.imageUrl ?? 'https://blob.example/x.png',
  ...over,
});

describe('COUNTING_CHARS / isCountingChar', () => {
  it('contains exactly the ten number characters, one per week 1-10', () => {
    expect(COUNTING_CHARS.size).toBe(10);
    expect([...COUNTING_CHARS].sort().join('')).toBe(
      [...'一二三四五六七八九十'].sort().join(''),
    );
  });

  it('recognizes a counting char and rejects an ordinary one', () => {
    expect(isCountingChar('七')).toBe(true);
    expect(isCountingChar('人')).toBe(false);
  });
});

describe('COUNTING_CHAR_VALUES', () => {
  it('covers all ten counting characters', () => {
    expect(COUNTING_CHAR_VALUES.size).toBe(10);
    for (const ch of COUNTING_CHARS) {
      expect(COUNTING_CHAR_VALUES.has(ch)).toBe(true);
    }
  });

  it('maps 七 to 7 (the exact bug David hit)', () => {
    expect(COUNTING_CHAR_VALUES.get('七')).toBe(7);
  });

  it('maps every character to its correct 1-10 value', () => {
    const expected: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    for (const [hanzi, value] of Object.entries(expected)) {
      expect(COUNTING_CHAR_VALUES.get(hanzi)).toBe(value);
    }
  });
});

describe('validStimulusWords', () => {
  it('a clean word — has an image, owned by only one character — passes', () => {
    const w = word({ wordId: 'w-1', text: '朋友们', imageUrl: 'https://blob.example/1.png' });
    const owners = new Map([['朋友们', new Set(['朋'])]]);
    expect(validStimulusWords('朋', [w], owners)).toEqual([w]);
  });

  it('a word with no imageUrl is rejected', () => {
    const w = word({ wordId: 'w-2', text: '好人', imageUrl: null });
    const owners = new Map([['好人', new Set(['人'])]]);
    expect(validStimulusWords('人', [w], owners)).toEqual([]);
  });

  it('a word owned by two same-week characters is rejected', () => {
    const w = word({ wordId: 'w-3', text: '两个字', imageUrl: 'https://blob.example/3.png' });
    const owners = new Map([['两个字', new Set(['甲', '乙'])]]);
    expect(validStimulusWords('甲', [w], owners)).toEqual([]);
  });

  it('a word absent from wordOwners (no ambiguity recorded) still passes if imaged', () => {
    const w = word({ wordId: 'w-4', text: '独一份', imageUrl: 'https://blob.example/4.png' });
    expect(validStimulusWords('独', [w], new Map())).toEqual([w]);
  });

  it('a counting character yields [] unconditionally, even with a perfectly clean word', () => {
    const w = word({ wordId: 'w-5', text: '七个气球', imageUrl: 'https://blob.example/5.png' });
    const owners = new Map([['七个气球', new Set(['七'])]]);
    expect(validStimulusWords('七', [w], owners)).toEqual([]);
  });

  // ── Real corpus case: 唱歌 (week 7) — owned by 唱 AND 歌 ──────────────────
  it('唱歌 is invalid as a stimulus for 唱: it is also owned by 歌', () => {
    const changge = word({ wordId: 'w-changge', text: '唱歌', imageUrl: 'https://blob.example/changge.png' });
    const owners = new Map([['唱歌', new Set(['唱', '歌'])]]);
    expect(validStimulusWords('唱', [changge], owners)).toEqual([]);
  });

  it('唱歌 is invalid as a stimulus for 歌 too — ambiguity is symmetric', () => {
    const changge = word({ wordId: 'w-changge', text: '唱歌', imageUrl: 'https://blob.example/changge.png' });
    const owners = new Map([['唱歌', new Set(['唱', '歌'])]]);
    expect(validStimulusWords('歌', [changge], owners)).toEqual([]);
  });

  // ── Real corpus case: 多少 (week 7) — owned by 多 AND 少 ──────────────────
  it('多少 is invalid as a stimulus for either 多 or 少', () => {
    const duoshao = word({ wordId: 'w-duoshao', text: '多少', imageUrl: 'https://blob.example/duoshao.png' });
    const owners = new Map([['多少', new Set(['多', '少'])]]);
    expect(validStimulusWords('多', [duoshao], owners)).toEqual([]);
    expect(validStimulusWords('少', [duoshao], owners)).toEqual([]);
  });

  // ── Real corpus case: 大人 (week 1) — owned by 人 AND 大 ──────────────────
  it('大人 is invalid as a stimulus for either 人 or 大, but a clean word for the same char still passes', () => {
    const daren = word({ wordId: 'w-daren', text: '大人', imageUrl: 'https://blob.example/daren.png' });
    const daxiang = word({ wordId: 'w-daxiang', text: '大象', imageUrl: 'https://blob.example/daxiang.png' });
    const owners = new Map([
      ['大人', new Set(['人', '大'])],
      ['大象', new Set(['大'])],
    ]);
    expect(validStimulusWords('大', [daren, daxiang], owners)).toEqual([daxiang]);
    expect(validStimulusWords('人', [daren], owners)).toEqual([]);
  });

  it('filters a mixed list down to only the valid words, preserving order', () => {
    const good1 = word({ wordId: 'w-g1', text: '好人', imageUrl: 'https://blob.example/g1.png' });
    const noImage = word({ wordId: 'w-n1', text: '人们', imageUrl: null });
    const ambiguous = word({ wordId: 'w-a1', text: '大人', imageUrl: 'https://blob.example/a1.png' });
    const good2 = word({ wordId: 'w-g2', text: '人生', imageUrl: 'https://blob.example/g2.png' });
    const owners = new Map([
      ['好人', new Set(['人'])],
      ['人们', new Set(['人'])],
      ['大人', new Set(['人', '大'])],
      ['人生', new Set(['人'])],
    ]);
    expect(validStimulusWords('人', [good1, noImage, ambiguous, good2], owners)).toEqual([
      good1,
      good2,
    ]);
  });
});
