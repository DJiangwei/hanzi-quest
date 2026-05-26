import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MidSceneProvider,
  useMidScene,
  MidSceneFlag,
} from '@/components/play/MidSceneProvider';

function Probe() {
  const ctx = useMidScene();
  return <div data-testid="probe">{ctx.midScene ? 'YES' : 'NO'}</div>;
}

describe('MidSceneProvider', () => {
  it('defaults to false', () => {
    render(
      <MidSceneProvider>
        <Probe />
      </MidSceneProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('NO');
  });

  it('MidSceneFlag flips to true when mounted', () => {
    render(
      <MidSceneProvider>
        <MidSceneFlag />
        <Probe />
      </MidSceneProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('YES');
  });
});
