import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// 'use server' actions pull in @/db — mock them to plain fns (used as form actions).
vi.mock('@/lib/actions/entry', () => ({
  chooseKidEntryAction: vi.fn(),
  chooseParentEntryAction: vi.fn(),
}));

import { EntryChooser } from '@/components/EntryChooser';

describe('EntryChooser', () => {
  it('shows a single big Play button (with the child name) and a Parent button', () => {
    render(<EntryChooser players={[{ id: 'c1', displayName: 'Yinuo' }]} />);
    expect(screen.getByText('开始游戏')).toBeInTheDocument();
    expect(screen.getByText(/Play · Yinuo/)).toBeInTheDocument();
    // Parent option is bilingual (中文 + English).
    expect(screen.getByText('家长')).toBeInTheDocument();
    expect(screen.getByText('/ Parent')).toBeInTheDocument();
  });

  it('lists each child for a multi-child account', () => {
    render(
      <EntryChooser
        players={[
          { id: 'c1', displayName: 'Mei' },
          { id: 'c2', displayName: 'Lin' },
        ]}
      />,
    );
    expect(screen.getByText('Mei')).toBeInTheDocument();
    expect(screen.getByText('Lin')).toBeInTheDocument();
    // 3 forms: one per child + the parent option.
    expect(document.querySelectorAll('form')).toHaveLength(3);
  });

  // Regression guard for the first-run blocker: with zero children this
  // component used to render ONLY the padlocked Parent button — no hint that a
  // child has to be added first, on the very first screen after signup. The
  // previous version of this test asserted that behaviour as if it were
  // intended ("shows only the Parent option"), which is why it survived.
  it('leads a brand-new parent to add a child, not just to the locked Parent door', () => {
    render(<EntryChooser players={[]} />);

    // No play button, because there is nobody to play as.
    expect(screen.queryByText('开始游戏')).not.toBeInTheDocument();

    // But there IS a primary, bilingual call to action pointing at child setup.
    const addChild = screen.getByRole('link', { name: /先添加孩子/ });
    expect(addChild).toHaveAttribute('href', '/parent/children');
    expect(screen.getByText('Add your child to start')).toBeInTheDocument();

    // The Parent door remains available as the secondary option.
    expect(screen.getByText('家长')).toBeInTheDocument();
    expect(document.querySelectorAll('form')).toHaveLength(1);
  });

  it('does not promise to remember a choice that cannot be made', () => {
    render(<EntryChooser players={[]} />);
    expect(
      screen.queryByText(/We'll remember your choice next time/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Once a child is added, they can play right away/),
    ).toBeInTheDocument();
  });

  it('still promises to remember the choice once there is one to make', () => {
    render(<EntryChooser players={[{ id: 'c1', displayName: 'Yinuo' }]} />);
    expect(
      screen.getByText(/We'll remember your choice next time/),
    ).toBeInTheDocument();
  });
});
