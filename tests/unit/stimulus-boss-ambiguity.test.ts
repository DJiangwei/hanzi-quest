import { describe, expect, it } from 'vitest';
import { pickValidStimulusImage } from '@/lib/scenes/stimulus';

// The real week-7 shape: 唱 and 歌 are both taught that week and both own 唱歌.
const chang = {
  hanzi: '唱',
  imageHook: null,
  words: [
    { id: 'w-changge', text: '唱歌', imageHook: 'a child singing', meaningEn: 'to sing', imageUrl: 'https://blob/changge.png' },
    { id: 'w-hechang', text: '合唱', imageHook: 'a choir', meaningEn: 'chorus', imageUrl: 'https://blob/hechang.png' },
  ],
};
const ge = {
  hanzi: '歌',
  words: [
    { id: 'w-changge2', text: '唱歌', imageHook: 'a child singing', meaningEn: 'to sing', imageUrl: 'https://blob/changge.png' },
    { id: 'w-erge', text: '儿歌', imageHook: 'nursery rhyme', meaningEn: 'nursery rhyme', imageUrl: 'https://blob/erge.png' },
  ],
};

describe('pickValidStimulusImage (boss hosts, no compiled wordId)', () => {
  it('never picks a word another character in the SAME pool also owns', () => {
    // Both 唱 and 歌 are answers on screen, so the 唱歌 picture supports either.
    const { imageUrl } = pickValidStimulusImage(chang, [chang, ge]);
    expect(imageUrl).not.toBe('https://blob/changge.png');
    expect(imageUrl).toBe('https://blob/hechang.png');
  });

  it('is happy to use that same word when the other owner is NOT in the pool', () => {
    // Ambiguity is a property of the answer set, not of the word itself.
    const { imageUrl } = pickValidStimulusImage(chang, [chang]);
    expect(imageUrl).toBe('https://blob/changge.png');
  });

  it('returns no picture rather than an ambiguous one', () => {
    const onlyShared = { hanzi: '唱', imageHook: null, words: [chang.words[0]!] };
    expect(pickValidStimulusImage(onlyShared, [onlyShared, ge]).imageUrl).toBeNull();
  });

  it('skips words that have no picture at all', () => {
    const noArt = {
      hanzi: '唱',
      imageHook: null,
      words: [{ id: 'a', text: '合唱', imageHook: null, meaningEn: null, imageUrl: null }, chang.words[0]!],
    };
    // 合唱 is unambiguous but artless; 唱歌 has art but is ambiguous → nothing.
    expect(pickValidStimulusImage(noArt, [noArt, ge]).imageUrl).toBeNull();
  });
});
