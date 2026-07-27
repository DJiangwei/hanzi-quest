import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => false }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return { CoinHudContext: ctx, useCoinHud: () => useContext(ctx) };
});
vi.mock('@/lib/scenes/final-boss-roster', () => ({
  getFinalBoss: () => ({
    key: 'stub',
    nameZh: '幽灵旗舰',
    nameEn: 'Ghost Galleon',
    Component: ({ state }: { state: string }) => (
      <div data-testid="final-boss-creature" data-state={state} />
    ),
  }),
}));

import { FinalBossScene } from '@/components/scenes/FinalBossScene';
import type { FinalBossCharacter, FinalBossQuestion } from '@/lib/play/final-boss';

const target: FinalBossCharacter = {
  characterId: 'c1',
  hanzi: '苹',
  pinyinArray: ['píng'],
  meaningEn: 'apple',
  meaningZh: '苹果',
  imageHook: 'a red apple',
  firstWord: '苹果',
  words: [
    {
      id: 'w1',
      text: '苹果',
      imageHook: 'a red apple',
      meaningEn: 'apple',
      imageUrl: 'https://blob.example.com/words/w1.png',
    },
  ],
  sentence: null,
};

const other: FinalBossCharacter = {
  characterId: 'c2',
  hanzi: '梨',
  pinyinArray: ['lí'],
  meaningEn: 'pear',
  meaningZh: '梨',
  imageHook: null,
  firstWord: '梨',
  words: [],
  sentence: null,
};

function phasesOf(type: FinalBossQuestion['type']): FinalBossQuestion[][] {
  return [[{ type, target }, { type, target: other }]];
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('FinalBossScene questions', () => {
  it('renders the word picture for an image_pick question', () => {
    render(
      <FinalBossScene
        packSlug="pirate-class-level-1"
        mapNameZh="加勒比海"
        mapNameEn="Caribbean"
        phases={phasesOf('image_pick')}
        onComplete={() => {}}
      />,
    );
    act(() => { vi.advanceTimersByTime(1300); });
    const img = screen.getByAltText('a red apple');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://blob.example.com/words/w1.png');
  });

  it('keeps the text fallback when the target char has no word picture', () => {
    render(
      <FinalBossScene
        packSlug="pirate-class-level-1"
        mapNameZh="加勒比海"
        mapNameEn="Caribbean"
        phases={[[{ type: 'image_pick', target: other }]]}
        onComplete={() => {}}
      />,
    );
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('does not leak the 💡 hint description into the gauntlet', () => {
    render(
      <FinalBossScene
        packSlug="pirate-class-level-1"
        mapNameZh="加勒比海"
        mapNameEn="Caribbean"
        phases={phasesOf('image_pick')}
        onComplete={() => {}}
      />,
    );
    act(() => { vi.advanceTimersByTime(1300); });
    // The hook is the <img> alt (accessible), but must not render as visible
    // hint text — hints are practice-only.
    expect(screen.queryByTestId('hint-bubble')).not.toBeInTheDocument();
  });
});
