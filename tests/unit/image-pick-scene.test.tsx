import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return { CoinHudContext: ctx, useCoinHud: () => useContext(ctx) };
});
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => false }));

import { ImagePickScene } from '@/components/scenes/ImagePickScene';

const pool = [
  { characterId: 'c1', hanzi: '大', pinyinArray: ['dà'], imageHook: 'big elephant' },
  { characterId: 'c2', hanzi: '小', pinyinArray: ['xiǎo'], imageHook: null },
  { characterId: 'c3', hanzi: '人', pinyinArray: ['rén'], imageHook: null },
  { characterId: 'c4', hanzi: '木', pinyinArray: ['mù'], imageHook: null },
];

describe('ImagePickScene (看图找字)', () => {
  it('renders a real <img> when the target has an imageUrl (reused word picture)', () => {
    render(
      <ImagePickScene
        target={{ ...pool[0], imageUrl: 'https://blob/elephant.jpg' }}
        pool={pool}
        onComplete={() => {}}
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://blob/elephant.jpg');
    expect(img).toHaveAttribute('alt', 'big elephant');
  });

  it('falls back to the imageHook text card when no imageUrl', () => {
    render(<ImagePickScene target={{ ...pool[0] }} pool={pool} onComplete={() => {}} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('big elephant')).toBeInTheDocument();
  });

  it('renders character choices (hanzi options)', () => {
    render(
      <ImagePickScene
        target={{ ...pool[0], imageUrl: 'https://blob/x.jpg' }}
        pool={pool}
        onComplete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: '大' })).toBeInTheDocument();
  });
});
