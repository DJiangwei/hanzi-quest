import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ShopToast } from '@/components/shop/ShopToast';
import type { ShopFeedbackKind } from '@/lib/hooks/use-shop-purchase';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ShopToast', () => {
  it('renders nothing when feedback is null', () => {
    const { container } = render(<ShopToast feedback={null} onDone={() => {}} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('shop-toast')).toBeNull();
  });

  const cases: Array<[ShopFeedbackKind, string]> = [
    ['success', '已购买'],
    ['owned', '你已经拥有了'],
    ['insufficient', '金币不够啦'],
    ['error', '购买失败'],
  ];

  it.each(cases)('renders the %s message', (kind, text) => {
    render(<ShopToast feedback={{ kind }} onDone={() => {}} />);
    const toast = screen.getByTestId('shop-toast');
    expect(toast).toHaveAttribute('data-kind', kind);
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast.textContent).toContain(text);
  });

  it('renders bilingual English side too', () => {
    render(<ShopToast feedback={{ kind: 'success' }} onDone={() => {}} />);
    expect(screen.getByTestId('shop-toast').textContent).toContain('Purchased');
  });

  it('calls onDone after the auto-dismiss timer', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<ShopToast feedback={{ kind: 'success' }} onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does not fire the timer when feedback is null', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<ShopToast feedback={null} onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDone).not.toHaveBeenCalled();
  });
});
