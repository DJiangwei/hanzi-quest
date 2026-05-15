// tests/unit/scene-runner-fanfare.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actions/play', () => ({
  startSessionAction: vi.fn().mockResolvedValue({ sessionId: 's1' }),
  finishAttemptAction: vi.fn(),
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

import { SceneRunner } from '@/components/scenes/SceneRunner';
import { setAudioMuted } from '@/lib/audio/play';

describe('SceneRunner', () => {
  it('calls setAudioMuted(false) on mount when reduced-motion=false', async () => {
    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Lesson 1"
        levels={[]}
        charactersById={{}}
        pool={[]}
      />,
    );
    // wait microtask for session start promise
    await Promise.resolve();
    await Promise.resolve();
    expect(setAudioMuted).toHaveBeenCalledWith(false);
  });

  it('renders LevelFanfare in end state', async () => {
    render(
      <SceneRunner
        childId="c1"
        weekId="w1"
        weekLabel="Lesson 1"
        levels={[]}
        charactersById={{}}
        pool={[]}
      />,
    );
    // levels=[] → done=true path; with empty levels, currentLevel undefined → done branch
    // the end-state renders LevelFanfare which (via our mock) shows lottie
    await screen.findByTestId('lottie');
    expect(screen.getByRole('heading', { name: /Island cleared/i })).toBeInTheDocument();
  });
});
