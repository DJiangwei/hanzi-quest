// tests/unit/scene-runner-pr51-chest.test.tsx
// PR #51: boss chest button hides on repeat clears
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock LevelFanfare with a data-chest attribute so we can verify the prop value
vi.mock('@/components/scenes/fx/LevelFanfare', () => ({
  LevelFanfare: (props: { chestAvailable: boolean }) => (
    <div data-testid="fanfare" data-chest={String(props.chestAvailable)} />
  ),
}));

vi.mock('@/lib/actions/play', () => ({
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 'sess-1' }),
  finishAttemptAction: vi.fn().mockResolvedValue({
    ok: true,
    coinsAwarded: 50,
    perfect: false,
    bonuses: [],
    trophies: [],
  }),
  finishLevelAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));
vi.mock('@/lib/audio/play', () => ({
  playSound: vi.fn(),
  setAudioMuted: vi.fn(),
}));
vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => <div data-testid="lottie" />,
}));
vi.mock('@/components/scenes/BossScene', () => ({
  BossScene: ({ onComplete }: { onComplete: (correct: boolean) => void }) => (
    <button data-testid="boss-scene-complete" onClick={() => onComplete(true)}>
      Complete boss
    </button>
  ),
}));
vi.mock('@/lib/actions/gacha', () => ({
  pullFreeFromBoss: vi.fn(),
  AlreadyClaimedError: class extends Error {},
}));
vi.mock('@/components/scenes/fx/TreasureChestReveal', () => ({
  TreasureChestReveal: () => <div data-testid="treasure-chest-reveal" />,
}));
vi.mock('@/lib/actions/powerups', () => ({
  useHintAction: vi.fn().mockResolvedValue({ ok: true, remaining: 0 }),
  useSkipAction: vi.fn().mockResolvedValue({ ok: true, remaining: 0 }),
}));

import { act } from '@testing-library/react';
import { SceneRunner } from '@/components/scenes/SceneRunner';
import { finishLevelAction } from '@/lib/actions/play';

describe('SceneRunner PR #51: chestAvailable respects freePullClaimed', () => {
  const charactersById = {
    c1: {
      characterId: 'c1',
      hanzi: '海',
      pinyinArray: ['hǎi'],
      meaningEn: 'sea',
      meaningZh: '海洋',
      imageHook: null,
      firstWord: null,
      words: [],
      sentence: null,
    },
  };

  const bossLevel = {
    id: 'l-boss',
    position: 0,
    sceneType: 'boss' as const,
    config: { characterIds: ['c1'], questionTypes: ['audio_pick'] },
  };

  it('passes chestAvailable=true to LevelFanfare on first boss clear (freePullClaimed=false)', async () => {
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: true,
      freePullClaimed: false,
      cardGrant: null,
      bonuses: [],
      trophies: [],
    });

    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Test"
        levels={[bossLevel]}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    // Wait for session to start
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Click boss complete button
    const btn = screen.getByTestId('boss-scene-complete');
    await act(async () => {
      btn.click();
    });

    // Wait for async state updates (finishAttemptAction + finishLevelAction)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const fanfare = await screen.findByTestId('fanfare');
    expect(fanfare).toHaveAttribute('data-chest', 'true');
  });

  it('passes chestAvailable=false to LevelFanfare on repeat boss clear (freePullClaimed=true)', async () => {
    vi.mocked(finishLevelAction).mockResolvedValueOnce({
      ok: true,
      bossCleared: true,
      freePullClaimed: true,
      cardGrant: null,
      bonuses: [],
      trophies: [],
    });

    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Test"
        levels={[bossLevel]}
        charactersById={charactersById}
        pool={Object.values(charactersById)}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const btn = screen.getByTestId('boss-scene-complete');
    await act(async () => {
      btn.click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const fanfare = await screen.findByTestId('fanfare');
    expect(fanfare).toHaveAttribute('data-chest', 'false');
  });
});
