import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/actions/play', () => ({
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 'sess_1' }),
  finishAttemptAction: vi.fn(),
  finishLevelAction: vi.fn(),
}));
vi.mock('@/lib/audio/play', () => ({ setAudioMuted: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({ useReducedMotion: () => false }));
vi.mock('@/lib/actions/powerups', () => ({
  useHintAction: vi.fn().mockResolvedValue({ ok: true, remaining: 0 }),
  useSkipAction: vi.fn().mockResolvedValue({ ok: true, remaining: 0 }),
}));

import { SceneRunner } from '@/components/scenes/SceneRunner';

describe('SceneRunner segment chip', () => {
  it('renders the bilingual chip when current level config has a segment', async () => {
    const pool = [
      {
        characterId: 'c1',
        hanzi: '苹',
        pinyinArray: ['píng'],
        meaningEn: 'apple',
        meaningZh: '苹果',
        imageHook: null,
        firstWord: null,
        words: [],
        sentence: null,
      },
    ];
    render(
      <SceneRunner
        childId="k1"
        weekId="w1"
        weekLabel="Test Week"
        levels={[{
          id: 'lv1',
          position: 0,
          sceneType: 'flashcard',
          config: { characterId: 'c1', segment: 'review' },
        }]}
        charactersById={{ c1: pool[0] }}
        pool={pool}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('segment-chip').textContent).toMatch(/汉字回顾.*Character Review/);
    });
  });

  it('omits the chip when no segment is in config (legacy rows)', async () => {
    const pool = [
      {
        characterId: 'c1',
        hanzi: '人',
        pinyinArray: ['rén'],
        meaningEn: 'person',
        meaningZh: '人',
        imageHook: null,
        firstWord: null,
        words: [],
        sentence: null,
      },
    ];
    render(
      <SceneRunner
        childId="k1"
        weekId="w1"
        weekLabel="Test Week"
        levels={[{
          id: 'lv1',
          position: 0,
          sceneType: 'flashcard',
          config: { characterId: 'c1' },
        }]}
        charactersById={{ c1: pool[0] }}
        pool={pool}
      />,
    );
    await waitFor(() => {
      // Verify session started (component finished initial render)
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('segment-chip')).not.toBeInTheDocument();
  });
});
