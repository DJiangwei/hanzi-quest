import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/actions/powerups', () => ({
  useHintAction: vi.fn().mockResolvedValue({ ok: true, remaining: 2 }),
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

  it('renders 2 buttons with counts', () => {
    render(
      <PowerupTray {...baseProps} hintCount={3} skipCount={1} sceneSupportsHint={true} />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('hint button is hidden when sceneSupportsHint=false', () => {
    render(
      <PowerupTray {...baseProps} hintCount={3} skipCount={1} sceneSupportsHint={false} />,
    );
    expect(screen.queryByLabelText(/hint|提示/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/skip|跳过/i)).toBeInTheDocument();
  });

  it('button disabled when count = 0', () => {
    render(
      <PowerupTray {...baseProps} hintCount={0} skipCount={0} sceneSupportsHint={true} />,
    );
    const hintBtn = screen.getByLabelText(/hint|提示/i);
    const skipBtn = screen.getByLabelText(/skip|跳过/i);
    expect(hintBtn).toBeDisabled();
    expect(skipBtn).toBeDisabled();
  });
});
