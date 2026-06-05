import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('@/lib/scenes/boss-roster', () => ({
  getBossCreature: () => ({
    key: 'stub', nameZh: 'x', nameEn: 'x',
    Component: ({ state }: { state: string }) => (
      <div data-testid="boss-creature" data-state={state} />
    ),
  }),
}));

// Each boss question scene → a button that "wins" on click.
vi.mock('@/components/scenes/AudioPickScene', () => ({
  AudioPickScene: ({ onComplete }: { onComplete: (c: boolean) => void }) => (
    <button data-testid="answer" onClick={() => onComplete(true)}>answer</button>
  ),
}));

import { BossScene } from '@/components/scenes/BossScene';

const target = { characterId: 'c1', hanzi: '山', pinyinArray: ['shan1'], meaningEn: 'mountain', meaningZh: '山', imageHook: null, firstWord: null, sentence: null };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BossScene phase machine', () => {
  it('plays intro then idle, then defeat before onComplete', () => {
    const onComplete = vi.fn();
    render(<BossScene weekNumber={1} characterIds={['c1']} questionTypes={['audio_pick']} pool={[target]} onComplete={onComplete} />);
    expect(screen.getByTestId('boss-creature')).toHaveAttribute('data-state', 'intro');
    act(() => { vi.advanceTimersByTime(1300); });
    expect(screen.getByTestId('boss-creature')).toHaveAttribute('data-state', 'idle');
    act(() => { fireEvent.click(screen.getByTestId('answer')); });
    expect(screen.getByTestId('boss-creature')).toHaveAttribute('data-state', 'defeat');
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1300); });
    expect(onComplete).toHaveBeenCalledWith(true);
  });
});
