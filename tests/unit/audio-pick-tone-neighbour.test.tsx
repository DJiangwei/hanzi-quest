// V2 slice 1 — and E2's practice integration, arriving for free.
//
// audio_pick is the ONE scene where a tone neighbour trains anything: the
// stimulus IS the sound, so 马 beside 妈 forces the discrimination. The same
// option in image_pick or translate_pick would be noise, because nothing in
// those questions depends on how the character sounds.
//
// The wiring is asserted by CAPTURING the props that reach blendDistractors,
// not by rendering: which predicate a scene passes is invisible to a rendering
// assertion, and that is exactly how PR #158's frozen wordId sat un-passed for
// months (CLAUDE.md landmine).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const captured = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('@/lib/scenes/sample', async (orig) => {
  const real = await orig<typeof import('@/lib/scenes/sample')>();
  return {
    ...real,
    blendDistractors: (...args: unknown[]) => {
      captured.calls.push(args);
      return (real.blendDistractors as (...a: unknown[]) => unknown[])(...args);
    },
  };
});

import { AudioPickScene } from '@/components/scenes/AudioPickScene';
import type { ConfusableSpec } from '@/lib/scenes/sample';

type Ch = { characterId: string; hanzi: string; pinyinArray: string[] };

const target: Ch = { characterId: 't', hanzi: '妈', pinyinArray: ['mā'] };
const pool: Ch[] = [
  target,
  { characterId: 'a', hanzi: '马', pinyinArray: ['mǎ'] },   // tone neighbour
  { characterId: 'b', hanzi: '鱼', pinyinArray: ['yú'] },
  { characterId: 'c', hanzi: '大', pinyinArray: ['dà'] },
  { characterId: 'd', hanzi: '小', pinyinArray: ['xiǎo'] },
];

beforeEach(() => {
  captured.calls = [];
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: class { text: string; lang = ''; rate = 1; constructor(t: string) { this.text = t; } },
  });
});

describe('AudioPickScene tone-neighbour distractors', () => {
  it('passes a confusable spec to the sampler at all', () => {
    render(<AudioPickScene target={target} pool={pool} onComplete={() => {}} />);
    expect(captured.calls).toHaveLength(1);
    const spec = captured.calls[0][6] as ConfusableSpec<Ch> | undefined;
    expect(spec?.isConfusable).toBeTypeOf('function');
  });

  it('the spec treats a same-syllable different-tone character as confusable', () => {
    render(<AudioPickScene target={target} pool={pool} onComplete={() => {}} />);
    const spec = captured.calls[0][6] as ConfusableSpec<Ch>;
    expect(spec.isConfusable(pool[1], target)).toBe(true); // 马 mǎ vs 妈 mā
    expect(spec.isConfusable(pool[2], target)).toBe(false); // 鱼 yú
  });

  it('the spec REFUSES a homophone — two options that sound alike have two right answers', () => {
    // The hazard is specific to this scene: the stimulus is a sound, so 石 and
    // 十 (both shí) beside each other cannot be told apart by ear at all.
    render(<AudioPickScene target={target} pool={pool} onComplete={() => {}} />);
    const spec = captured.calls[0][6] as ConfusableSpec<Ch>;
    const homophone: Ch = { characterId: 'h', hanzi: '妈', pinyinArray: ['mā'] };
    expect(spec.isConfusable(homophone, target)).toBe(false);
  });

  it('survives a character with no pinyin rather than throwing mid-question', () => {
    const noPinyin = { characterId: 'x', hanzi: '?', pinyinArray: [] as string[] };
    render(
      <AudioPickScene target={target} pool={[...pool, noPinyin]} onComplete={() => {}} />,
    );
    const spec = captured.calls[0][6] as ConfusableSpec<Ch>;
    expect(spec.isConfusable(noPinyin, target)).toBe(false);
  });
});
