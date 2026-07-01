import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { FinalBossQuestion } from '@/lib/play/final-boss';

// Each sub-scene becomes a button that calls onComplete(true) when clicked.
function stub(name: string) {
  return {
    [name]: ({ onComplete }: { onComplete: (c: boolean) => void }) => (
      <button data-testid={`sub-${name}`} onClick={() => onComplete(true)}>
        answer
      </button>
    ),
  };
}
vi.mock('@/components/scenes/AudioPickScene', () => stub('AudioPickScene'));
vi.mock('@/components/scenes/ImagePickScene', () => stub('ImagePickScene'));
vi.mock('@/components/scenes/TranslatePickScene', () => stub('TranslatePickScene'));
vi.mock('@/components/scenes/SentenceClozeScene', () => stub('SentenceClozeScene'));
vi.mock('@/components/scenes/VisualPickScene', () => stub('VisualPickScene'));
vi.mock('@/lib/scenes/final-boss-roster', () => ({
  getFinalBoss: () => ({
    key: 'gg',
    nameZh: '幽灵旗舰',
    nameEn: 'Ghost Galleon',
    Component: ({ state }: { state: string }) => (
      <div data-testid="creature" data-state={state} />
    ),
  }),
}));

import { FinalBossScene } from '@/components/scenes/FinalBossScene';

function q(id: string): FinalBossQuestion {
  return {
    type: 'audio_pick',
    target: {
      characterId: id,
      hanzi: id,
      pinyinArray: ['x'],
      meaningEn: id,
      meaningZh: null,
      imageHook: null,
      firstWord: null,
      sentence: null,
    },
  };
}
// 3 phases × 1 question each for a fast test.
const phases: FinalBossQuestion[][] = [[q('a')], [q('b')], [q('c')]];

describe('FinalBossScene', () => {
  it('advances through all phases then calls onComplete(true)', () => {
    const onComplete = vi.fn();
    vi.useFakeTimers();
    render(
      <FinalBossScene
        packSlug="pirate-class-level-1"
        mapNameZh="加勒比海"
        mapNameEn="Caribbean"
        phases={phases}
        onComplete={onComplete}
      />,
    );
    // skip the intro timer
    act(() => {
      vi.runOnlyPendingTimers();
    });
    // answer all 3 phase questions
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('sub-AudioPickScene'));
      act(() => {
        vi.runOnlyPendingTimers();
      }); // enrage / defeat timers
    }
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(onComplete).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });
});
