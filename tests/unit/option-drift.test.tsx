// Options must NOT move while she is reaching for one.
//
// On a touch screen this is worse than it sounds: she decides, commits her
// finger, and the answer she chose slides out from under it. It punishes a
// correct decision, which is the one thing a game for a child who already
// shows 畏难情绪 must never do.
//
// The cause is always the same shape — a shuffle memo keyed on `pool` /
// `target` OBJECT IDENTITY. SceneRunner rebuilds those arrays inline every
// render (one is an inline `.filter(...)` in JSX) and holds ten pieces of
// state plus a transition, so a hint tap or a coin toast re-renders it.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn(), streakPitchMult: () => 1 }));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => () => {}, usableAudioUrl: () => null }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => true }));

import { AudioPickScene } from '@/components/scenes/AudioPickScene';
import { TranslatePickScene } from '@/components/scenes/TranslatePickScene';
import { SentenceClozeScene } from '@/components/scenes/SentenceClozeScene';
import { ImagePickScene } from '@/components/scenes/ImagePickScene';

const ch = (id: string, hanzi: string, py: string, en: string) => ({
  characterId: id, hanzi, pinyinArray: [py], meaningEn: en, meaningZh: en,
  imageHook: null, firstWord: null, sentence: null, words: [],
});
const TARGET = ch('t', '妈', 'mā', 'mother');
const POOL = [
  TARGET, ch('a', '马', 'mǎ', 'horse'), ch('b', '鱼', 'yú', 'fish'),
  ch('c', '大', 'dà', 'big'), ch('d', '小', 'xiǎo', 'small'),
  ch('e', '水', 'shuǐ', 'water'), ch('f', '火', 'huǒ', 'fire'),
];
const OLDER = [ch('o1', '山', 'shān', 'hill'), ch('o2', '月', 'yuè', 'moon')];

/** Fresh arrays every call — exactly what SceneRunner hands its scenes. */
const freshPool = () => POOL.map((c) => ({ ...c }));
const freshOlder = () => OLDER.map((c) => ({ ...c }));

/**
 * The rendered order of the choice buttons.
 *
 * `MultipleChoiceQuiz` puts no testid on them, so this reads every button's
 * text. That includes the audio 🔊 button in AudioPickScene, which is stable
 * and therefore harmless as a constant prefix — what matters is whether the
 * sequence CHANGES between renders.
 */
const order = () => screen.getAllByRole('button').map((b) => b.textContent).join('|');

beforeEach(() => vi.clearAllMocks());

describe('options hold still across parent re-renders', () => {
  it('audio_pick', () => {
    const { rerender } = render(
      <AudioPickScene target={{ ...TARGET }} pool={freshPool()} olderPool={freshOlder()} onComplete={() => {}} />,
    );
    const before = order();
    // Three re-renders with brand-new arrays AND a hint toggle — the real
    // trigger, since tapping 💡 re-renders SceneRunner.
    for (const hint of [true, false, true]) {
      rerender(
        <AudioPickScene target={{ ...TARGET }} pool={freshPool()} olderPool={freshOlder()} onComplete={() => {}} hintRequested={hint} />,
      );
    }
    expect(order()).toBe(before);
  });

  it('translate_pick', () => {
    const { rerender } = render(
      <TranslatePickScene target={{ ...TARGET }} pool={freshPool()} olderPool={freshOlder()} direction="cn_to_en" onComplete={() => {}} />,
    );
    const before = order();
    for (const hint of [true, false, true]) {
      rerender(
        <TranslatePickScene target={{ ...TARGET }} pool={freshPool()} olderPool={freshOlder()} direction="cn_to_en" onComplete={() => {}} hintRequested={hint} />,
      );
    }
    expect(order()).toBe(before);
  });

  it('sentence_cloze', () => {
    const { rerender } = render(
      <SentenceClozeScene target={{ ...TARGET }} pool={freshPool()} sentenceText="妈妈来了。" translationEn="Mum is here." onComplete={() => {}} />,
    );
    const before = order();
    for (const hint of [true, false, true]) {
      rerender(
        <SentenceClozeScene target={{ ...TARGET }} pool={freshPool()} sentenceText="妈妈来了。" translationEn="Mum is here." onComplete={() => {}} hintRequested={hint} />,
      );
    }
    expect(order()).toBe(before);
  });

  it('image_pick (already correct — pinned so it stays that way)', () => {
    const { rerender } = render(
      <ImagePickScene target={{ ...TARGET }} pool={freshPool()} olderPool={freshOlder()} onComplete={() => {}} />,
    );
    const before = order();
    for (const hint of [true, false, true]) {
      rerender(
        <ImagePickScene target={{ ...TARGET }} pool={freshPool()} olderPool={freshOlder()} onComplete={() => {}} hintRequested={hint} />,
      );
    }
    expect(order()).toBe(before);
  });
});
