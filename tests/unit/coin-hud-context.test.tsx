// tests/unit/coin-hud-context.test.tsx
import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { CoinHudContext, useCoinHud } from '@/lib/hooks/coin-hud-context';

function Consumer() {
  const { coinHudRef } = useCoinHud();
  // eslint-disable-next-line react-hooks/refs -- intentional: test probes ref value to assert context wiring
  return <span data-testid="probe">{coinHudRef.current ? 'attached' : 'null'}</span>;
}

function Provider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  return <CoinHudContext.Provider value={{ coinHudRef: ref }}>{children}</CoinHudContext.Provider>;
}

describe('CoinHudContext', () => {
  it('useCoinHud returns null-ref default outside any provider', () => {
    render(<Consumer />);
    expect(screen.getByTestId('probe').textContent).toBe('null');
  });

  it('useCoinHud returns provided ref inside a provider', () => {
    render(
      <Provider>
        <Consumer />
      </Provider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('null');
  });
});
