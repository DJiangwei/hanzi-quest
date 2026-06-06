import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { XpGainToast } from '@/components/play/XpGainToast';

vi.mock('@/lib/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

describe('XpGainToast', () => {
  it('renders +N XP when gained > 0', () => {
    render(
      <XpGainToast gained={15} leveledUp={false} level={2} onDone={vi.fn()} />,
    );
    expect(screen.getByTestId('xp-gained-label')).toHaveTextContent('+15 XP');
  });

  it('renders level-up line when leveledUp=true', () => {
    render(
      <XpGainToast gained={10} leveledUp={true} level={3} onDone={vi.fn()} />,
    );
    expect(screen.getByTestId('xp-level-up-label')).toBeInTheDocument();
    expect(screen.getByTestId('xp-level-up-label')).toHaveTextContent('Lv 3');
  });

  it('shows level-up line with correct level number', () => {
    render(
      <XpGainToast gained={5} leveledUp={true} level={7} onDone={vi.fn()} />,
    );
    expect(screen.getByTestId('xp-level-up-label')).toHaveTextContent('Lv 7');
  });

  it('does not render level-up line when leveledUp=false', () => {
    render(
      <XpGainToast gained={10} leveledUp={false} level={2} onDone={vi.fn()} />,
    );
    expect(screen.queryByTestId('xp-level-up-label')).not.toBeInTheDocument();
  });

  it('renders null when gained=0 and leveledUp=false', () => {
    render(
      <XpGainToast gained={0} leveledUp={false} level={1} onDone={vi.fn()} />,
    );
    expect(screen.queryByTestId('xp-gain-toast')).not.toBeInTheDocument();
  });

  it('calls onDone after durationMs', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(
      <XpGainToast gained={10} leveledUp={false} level={2} onDone={onDone} durationMs={500} />,
    );
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onDone).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
