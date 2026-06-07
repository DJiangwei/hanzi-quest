import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const pathnameMock = vi.fn(() => '/play/child_1');
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({ push: vi.fn() }),
}));

import { KidNavBar } from '@/components/play/KidNavBar';
import { MidSceneProvider, MidSceneFlag } from '@/components/play/MidSceneProvider';

function MidWrap({ children }: { children: React.ReactNode }) {
  return (
    <MidSceneProvider>
      <MidSceneFlag />
      {children}
    </MidSceneProvider>
  );
}

describe('KidNavBar', () => {
  it('renders 5 tabs + gear', () => {
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /Map/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /背包/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /日历/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /家$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /商店/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /parent/i })).toBeInTheDocument();
  });

  it('marks Map tab active on /play/[childId]', () => {
    pathnameMock.mockReturnValue('/play/child_1');
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /Map/i })).toHaveAttribute('aria-current', 'page');
  });

  it('marks Map tab active on /play/[childId]/week/[weekId]', () => {
    pathnameMock.mockReturnValue('/play/child_1/week/week_1');
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /Map/i })).toHaveAttribute('aria-current', 'page');
  });

  it('marks Map tab active on /play/[childId]/maps', () => {
    pathnameMock.mockReturnValue('/play/child_1/maps');
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /Map/i })).toHaveAttribute('aria-current', 'page');
  });

  it('marks Backpack active on /collection', () => {
    pathnameMock.mockReturnValue('/play/child_1/collection');
    render(<KidNavBar childId="child_1" />);
    expect(screen.getByRole('link', { name: /背包/ })).toHaveAttribute('aria-current', 'page');
  });

  it('mid-scene tab tap shows quit-confirm dialog', () => {
    pathnameMock.mockReturnValue('/play/child_1/level/week_1/practice');
    render(
      <MidWrap>
        <KidNavBar childId="child_1" />
      </MidWrap>,
    );
    fireEvent.click(screen.getByRole('link', { name: /日历/ }));
    expect(screen.getByText(/结束这一关|Quit this level/)).toBeInTheDocument();
  });

  it('"Stay" closes dialog without navigating', () => {
    pathnameMock.mockReturnValue('/play/child_1/level/week_1/practice');
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { assign, href: '' },
      writable: true,
    });
    render(
      <MidWrap>
        <KidNavBar childId="child_1" />
      </MidWrap>,
    );
    fireEvent.click(screen.getByRole('link', { name: /日历/ }));
    fireEvent.click(screen.getByRole('button', { name: /Stay|继续/ }));
    expect(screen.queryByText(/结束这一关|Quit this level/)).not.toBeInTheDocument();
  });
});
