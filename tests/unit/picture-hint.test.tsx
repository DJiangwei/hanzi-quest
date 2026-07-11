// Picture-scene hint bubble (spec 2026-07-11): the free 💡 also reveals an
// English description of the picture in image_pick / image_word.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImagePickScene } from '@/components/scenes/ImagePickScene';
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

const A = { characterId: 'aaaaaaaa-0000-4000-a000-000000000001', hanzi: '海', pinyinArray: ['hǎi'], imageHook: 'char-level hook', audioUrl: null };
const B = { characterId: 'aaaaaaaa-0000-4000-a000-000000000002', hanzi: '湖', pinyinArray: ['hú'], imageHook: null, audioUrl: null };
const C = { characterId: 'aaaaaaaa-0000-4000-a000-000000000003', hanzi: '江', pinyinArray: ['jiāng'], imageHook: null, audioUrl: null };
const D = { characterId: 'aaaaaaaa-0000-4000-a000-000000000004', hanzi: '河', pinyinArray: ['hé'], imageHook: null, audioUrl: null };
const pool = [A, B, C, D];

describe('ImagePickScene hint bubble', () => {
  it('no bubble before the hint is requested', () => {
    render(
      <ImagePickScene target={A} pool={pool} imageUrl="https://img/x.png"
        imageHint="a big blue ocean" onComplete={vi.fn()} />,
    );
    expect(screen.queryByTestId('hint-bubble')).toBeNull();
  });

  it('shows the English description when the hint is active and an image exists', () => {
    render(
      <ImagePickScene target={A} pool={pool} imageUrl="https://img/x.png"
        imageHint="a big blue ocean" onComplete={vi.fn()} hintRequested />,
    );
    expect(screen.getByTestId('hint-bubble').textContent).toContain('a big blue ocean');
    expect(screen.getByTestId('hint-bubble').textContent).toContain('提示 / Hint');
  });

  it('no bubble in text-fallback mode (the card already IS the description)', () => {
    render(
      <ImagePickScene target={A} pool={pool} imageUrl={null}
        imageHint="a big blue ocean" onComplete={vi.fn()} hintRequested />,
    );
    expect(screen.queryByTestId('hint-bubble')).toBeNull();
    expect(screen.getByText('char-level hook')).toBeTruthy();
  });
});

const WORD = {
  wordId: 'bbbbbbbb-0000-4000-a000-000000000001',
  text: '海洋',
  imageHook: 'waves rolling on the sea',
  meaningEn: 'ocean',
  imageUrl: 'https://img/w.png',
  audioUrl: null,
};
const WRONG = { ...WORD, wordId: 'bbbbbbbb-0000-4000-a000-000000000002', text: '湖泊', imageHook: null, meaningEn: 'lake', imageUrl: null };

describe('ImageWordScene hint bubble', () => {
  it('shows the correct word\'s imageHook when the hint is active', () => {
    render(
      <ImageWordScene baseChar={{ characterId: A.characterId, hanzi: '海' }}
        weekChars={['海']} correctWord={WORD} distractors={[WRONG]}
        onComplete={vi.fn()} hintRequested />,
    );
    expect(screen.getByTestId('hint-bubble').textContent).toContain('waves rolling on the sea');
  });

  it('no bubble without the hint', () => {
    render(
      <ImageWordScene baseChar={{ characterId: A.characterId, hanzi: '海' }}
        weekChars={['海']} correctWord={WORD} distractors={[WRONG]}
        onComplete={vi.fn()} />,
    );
    expect(screen.queryByTestId('hint-bubble')).toBeNull();
  });
});
