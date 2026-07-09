// R2b: a boss retry restores lives but KEEPS question progress, and the
// defeat fires onDefeated exactly once (courage-award hook).
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/audio/boss', () => ({ playBossCue: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return { CoinHudContext: ctx, useCoinHud: () => useContext(ctx) };
});
vi.mock('@/lib/scenes/boss-roster', () => ({
  getBossCreature: () => ({
    key: 'stub',
    nameZh: '海怪',
    nameEn: 'Kraken',
    Component: ({ state }: { state: string }) => (
      <div data-testid="boss-creature" data-state={state} />
    ),
  }),
}));

import { BossScene } from '@/components/scenes/BossScene';

const pool = [
  { characterId: 'c1', hanzi: '海', pinyinArray: ['hǎi'], meaningEn: 'sea', meaningZh: '海洋', imageHook: null, firstWord: '海洋', sentence: null },
  { characterId: 'c2', hanzi: '湖', pinyinArray: ['hú'], meaningEn: 'lake', meaningZh: '湖泊', imageHook: null, firstWord: '湖泊', sentence: null },
  { characterId: 'c3', hanzi: '江', pinyinArray: ['jiāng'], meaningEn: 'river', meaningZh: '大河', imageHook: null, firstWord: '大江', sentence: null },
  { characterId: 'c4', hanzi: '河', pinyinArray: ['hé'], meaningEn: 'stream', meaningZh: '小河', imageHook: null, firstWord: '小河', sentence: null },
];

/** Click a WRONG hanzi for the given target, then advance past the MCQ hold. */
function answerWrong(targetHanzi: string) {
  const wrong = pool.find((c) => c.hanzi !== targetHanzi)!;
  fireEvent.click(screen.getByRole('button', { name: wrong.hanzi }));
  act(() => {
    vi.advanceTimersByTime(800);
  });
}

describe('BossScene retry keeps progress (R2b)', () => {
  it('3 wrongs → defeated fires onDefeated once; retry restores lives but keeps the question index', () => {
    vi.useFakeTimers();
    const onDefeated = vi.fn();
    render(
      <BossScene
        weekNumber={1}
        characterIds={['c1', 'c2', 'c3', 'c4', 'c1']}
        questionTypes={['audio_pick']}
        pool={pool}
        onComplete={() => undefined}
        onDefeated={onDefeated}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1300); // intro → fighting
    });

    // Wrong ×3: Q1 (海) → Q2 (湖) → Q3 (江), losing a life each time.
    answerWrong('海');
    answerWrong('湖');
    answerWrong('江');

    expect(onDefeated).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /再战/ })).toBeTruthy();

    // Retry: lives restored, but progress KEPT (question 3 of 5, not 1 of 5).
    fireEvent.click(screen.getByRole('button', { name: /再战/ }));
    act(() => {
      vi.advanceTimersByTime(1300); // intro again
    });
    expect(screen.getByText('3 / 5')).toBeTruthy();
    const anchors = screen.getByTestId('boss-lives').textContent ?? '';
    expect((anchors.match(/⚓/g) ?? []).length).toBe(3);
    vi.useRealTimers();
  });
});
