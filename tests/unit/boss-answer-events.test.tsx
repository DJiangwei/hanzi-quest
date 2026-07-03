import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}));
vi.mock('@/lib/audio/play', () => ({ playSound: vi.fn() }));
vi.mock('@/lib/hooks/coin-hud-context', async () => {
  const { createContext, useContext } = await import('react');
  const ctx = createContext({ coinHudRef: { current: null } });
  return {
    CoinHudContext: ctx,
    useCoinHud: () => useContext(ctx),
  };
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

describe('BossScene answer events', () => {
  it('emits one boss_question event per answered question (correct and wrong)', () => {
    vi.useFakeTimers();
    const onAnswerEvent = vi.fn();
    render(
      <BossScene
        weekNumber={1}
        characterIds={['c1', 'c2']}
        questionTypes={['audio_pick']}
        pool={pool}
        onComplete={() => undefined}
        onAnswerEvent={onAnswerEvent}
      />,
    );
    // Past the intro phase.
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    // Q1 target is c1 (海) — answer correctly. The MCQ holds ~750ms before
    // reporting to BossScene.handleAnswer, so advance past it.
    fireEvent.click(screen.getByRole('button', { name: '海' }));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onAnswerEvent).toHaveBeenCalledWith({
      sceneType: 'boss_question',
      characterId: 'c1',
      correct: true,
    });

    // Q2 target is c2 (湖) — answer wrongly by picking a different character.
    fireEvent.click(screen.getByRole('button', { name: '江' }));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onAnswerEvent).toHaveBeenCalledWith({
      sceneType: 'boss_question',
      characterId: 'c2',
      correct: false,
    });
    expect(onAnswerEvent).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
