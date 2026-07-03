import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TranslatePickScene } from '@/components/scenes/TranslatePickScene';
import { ImageWordScene } from '@/components/scenes/ImageWordScene';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', () => ({
  useCoinHud: () => ({ coinHudRef: { current: null } }),
}));
vi.mock('@/lib/hooks/useSpeak', () => ({
  useSpeak: () => vi.fn(),
  usableAudioUrl: () => null,
}));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => false }));

const A = { characterId: 'aaaaaaaa-0000-4000-a000-000000000001', hanzi: '我', meaningEn: 'me', audioUrl: null };
const B = { characterId: 'aaaaaaaa-0000-4000-a000-000000000002', hanzi: '你', meaningEn: 'you', audioUrl: null };
const C = { characterId: 'aaaaaaaa-0000-4000-a000-000000000003', hanzi: '他', meaningEn: 'him', audioUrl: null };
const D = { characterId: 'aaaaaaaa-0000-4000-a000-000000000004', hanzi: '大', meaningEn: 'big', audioUrl: null };

describe('TranslatePickScene answer events', () => {
  it('emits a translate_pick event with target + picked key on a correct pick', () => {
    const onAnswerEvent = vi.fn();
    render(
      <TranslatePickScene
        target={A}
        pool={[A, B, C, D]}
        direction="cn_to_en"
        onComplete={vi.fn()}
        onAnswerEvent={onAnswerEvent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'me' }));
    expect(onAnswerEvent).toHaveBeenCalledWith({
      sceneType: 'translate_pick',
      characterId: A.characterId,
      correct: true,
      pickedKey: A.characterId,
    });
  });
});

const WORD = {
  wordId: 'bbbbbbbb-0000-4000-a000-000000000001',
  text: '我们',
  imageHook: 'friends together',
  meaningEn: 'we',
  imageUrl: null,
  audioUrl: null,
};
const WRONG = {
  wordId: 'bbbbbbbb-0000-4000-a000-000000000002',
  text: '你们',
  imageHook: null,
  meaningEn: 'you all',
  imageUrl: null,
  audioUrl: null,
};

describe('ImageWordScene answer events', () => {
  it('emits an image_word event keyed on the correct wordId, with the picked key', () => {
    const onAnswerEvent = vi.fn();
    render(
      <ImageWordScene
        baseChar={{ characterId: A.characterId, hanzi: '我' }}
        weekChars={['我']}
        correctWord={WORD}
        distractors={[WRONG]}
        onComplete={vi.fn()}
        onAnswerEvent={onAnswerEvent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /你们/ }));
    expect(onAnswerEvent).toHaveBeenCalledWith({
      sceneType: 'image_word',
      wordId: WORD.wordId,
      correct: false,
      pickedKey: WRONG.wordId,
    });
  });
});
