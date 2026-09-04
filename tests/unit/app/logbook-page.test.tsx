import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireChild = vi.fn(async (childId: string) => ({ parent: { id: 'p' }, child: { id: childId } }));
vi.mock('@/lib/auth/guards', () => ({ requireChild: (childId: string) => requireChild(childId) }));

const getLogbookEntries = vi.fn();
vi.mock('@/lib/db/logbook', () => ({ getLogbookEntries: (...a: unknown[]) => getLogbookEntries(...a) }));

vi.mock('@/components/play/LogbookGrid', () => ({
  LogbookGrid: () => <div data-testid="logbook-grid-stub" />,
}));

import LogbookPage from '@/app/play/[childId]/collection/logbook/page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LogbookPage', () => {
  it('does not render a "0" count line for a brand-new child with no unlocked characters', async () => {
    getLogbookEntries.mockResolvedValue([]);
    const ui = await LogbookPage({ params: Promise.resolve({ childId: 'c1' }) });
    const { render, screen } = await import('@testing-library/react');
    render(ui);

    // A dedicated wrapper element for the counts line must not render at all.
    expect(screen.queryByTestId('logbook-counts')).not.toBeInTheDocument();
    // Belt and braces: no "0 个字 / 0 characters / 熟练 0 / 0 solid" text anywhere
    // on the page, in case a future edit reintroduces the line under a
    // different testid.
    expect(screen.getByRole('main').textContent).not.toMatch(
      /0\s*个字|0\s*characters|熟练\s*0|0\s*solid/,
    );
    // The warm invitation must still be there.
    expect(screen.getByRole('main').textContent).toMatch(/出发去第一座岛/);
  });

  it('shows her real counts once she has unlocked characters', async () => {
    getLogbookEntries.mockResolvedValue([
      {
        characterId: 'ch1',
        hanzi: '一',
        pinyin: ['yī'],
        meaningEn: 'one',
        weekNumber: 1,
        firstWord: null,
        sentence: null,
        scored: 5,
        wrong: 0,
        dontKnow: 0,
      },
    ]);
    const ui = await LogbookPage({ params: Promise.resolve({ childId: 'c1' }) });
    const { render, screen } = await import('@testing-library/react');
    render(ui);

    const counts = screen.getByTestId('logbook-counts');
    expect(counts.textContent).toMatch(/1\s*个字/);
    expect(counts.textContent).toMatch(/1\s*characters/);
  });
});
