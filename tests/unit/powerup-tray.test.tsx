import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/actions/powerups', () => ({
  useSkipAction: vi.fn().mockResolvedValue({ ok: true, remaining: 0 }),
}));

import { PowerupTray } from '@/components/play/PowerupTray';

describe('PowerupTray', () => {
  const baseProps = {
    childId: 'c1',
    weekLevelId: 'wl1',
    sessionId: 's1',
    onHintActivated: () => {},
    onSkipped: () => {},
  };

  it('renders a free hint button + a skip button with count', () => {
    render(
      <PowerupTray
        {...baseProps}
        hintActive={false}
        skipCount={1}
        sceneSupportsHint={true}
      />,
    );
    expect(screen.getByLabelText(/hint|提示/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // skip count badge
  });

  it('hint button is hidden when sceneSupportsHint=false (e.g. boss)', () => {
    render(
      <PowerupTray
        {...baseProps}
        hintActive={false}
        skipCount={1}
        sceneSupportsHint={false}
      />,
    );
    expect(screen.queryByLabelText(/hint|提示/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/skip|跳过/i)).toBeInTheDocument();
  });

  it('hint is free: tapping it calls onHintActivated immediately (no confirm)', () => {
    const onHintActivated = vi.fn();
    render(
      <PowerupTray
        {...baseProps}
        onHintActivated={onHintActivated}
        hintActive={false}
        skipCount={0}
        sceneSupportsHint={true}
      />,
    );
    fireEvent.click(screen.getByLabelText(/hint|提示/i));
    expect(onHintActivated).toHaveBeenCalledTimes(1);
  });

  it('hint button is disabled once active on the current scene', () => {
    render(
      <PowerupTray
        {...baseProps}
        hintActive={true}
        skipCount={1}
        sceneSupportsHint={true}
      />,
    );
    expect(screen.getByLabelText(/hint|提示/i)).toBeDisabled();
  });

  it('skip button is disabled when skipCount = 0', () => {
    render(
      <PowerupTray
        {...baseProps}
        hintActive={false}
        skipCount={0}
        sceneSupportsHint={true}
      />,
    );
    expect(screen.getByLabelText(/skip|跳过/i)).toBeDisabled();
  });
});
