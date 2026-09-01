// The 存钱罐 nav tab — a 6th tab alongside 地图/背包/日历/家/商店, shown ONLY
// when the child's parent has opted in. Same rule as the home card: a child who
// cannot have the feature must not see an entry point to it.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/play/c1',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/play/MidSceneProvider', () => ({
  useMidScene: () => ({ midScene: false }),
}));

import { KidNavBar } from '@/components/play/KidNavBar';

describe('KidNavBar — 存钱罐 tab', () => {
  it('shows the tab, linked to the piggy page, when enabled', () => {
    render(<KidNavBar childId="c1" piggyEnabled />);
    expect(screen.getByTestId('nav-tab-piggy')).toHaveAttribute(
      'href',
      '/play/c1/piggy-bank',
    );
  });

  it('renders NO piggy tab when the piggy bank is off for this child', () => {
    render(<KidNavBar childId="c1" piggyEnabled={false} />);
    expect(screen.queryByTestId('nav-tab-piggy')).not.toBeInTheDocument();
  });

  it('defaults to hidden when the prop is omitted — off is the safe default', () => {
    render(<KidNavBar childId="c1" />);
    expect(screen.queryByTestId('nav-tab-piggy')).not.toBeInTheDocument();
  });

  it('leaves the five existing tabs untouched when the piggy tab is added', () => {
    render(<KidNavBar childId="c1" piggyEnabled />);
    for (const [zh, href] of [
      ['地图', '/play/c1'],
      ['背包', '/play/c1/collection'],
      ['日历', '/play/c1/calendar'],
      ['家', '/play/c1/home'],
      ['商店', '/play/c1/shop'],
    ] as const) {
      expect(screen.getByText(new RegExp(zh)).closest('a')).toHaveAttribute(
        'href',
        href,
      );
    }
  });

  it('puts both languages in ONE span, so the nav bilingual guard still holds', () => {
    render(<KidNavBar childId="c1" piggyEnabled />);
    const label = screen.getByText(/存钱罐/);
    // Two separate spans would break tests/unit/bilingual-chrome.test.tsx,
    // which checks each `a > span` on its own.
    expect(label.textContent).toMatch(/[一-鿿]/);
    expect(label.textContent).toMatch(/[A-Za-z]/);
  });

  it('every tab label still carries both languages with 6 tabs mounted', () => {
    const { container } = render(<KidNavBar childId="c1" piggyEnabled />);
    const labels = Array.from(container.querySelectorAll('a > span'))
      .map((el) => el.textContent ?? '')
      .filter((t) => /[一-鿿]/.test(t));
    expect(labels).toHaveLength(6);
    for (const t of labels) expect(t).toMatch(/[A-Za-z]/);
  });
});
