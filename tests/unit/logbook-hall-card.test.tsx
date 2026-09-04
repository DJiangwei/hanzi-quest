import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogbookHallCard } from '@/components/play/LogbookHallCard';

describe('LogbookHallCard', () => {
  it('links into the Logbook and is bilingual', () => {
    render(<LogbookHallCard childId="c1" totalCount={96} proficientCount={31} />);
    const card = screen.getByTestId('atlas-hall-logbook');
    expect(card).toHaveAttribute('href', '/play/c1/collection/logbook');
    expect(card.textContent).toMatch(/航海日志/);
    expect(card.textContent).toMatch(/Logbook/i);
  });

  it('shows her own counts and never a comparison', () => {
    render(<LogbookHallCard childId="c1" totalCount={96} proficientCount={31} />);
    const text = screen.getByTestId('atlas-hall-logbook').textContent ?? '';
    expect(text).toMatch(/31/);
    expect(text).toMatch(/96/);
    expect(text).not.toMatch(/排名|rank|比|than|其他|other kid/i);
  });

  it('reads warmly at zero rather than as a failure', () => {
    // A brand-new child must not be told she has mastered nothing.
    render(<LogbookHallCard childId="c1" totalCount={0} proficientCount={0} />);
    const text = screen.getByTestId('atlas-hall-logbook').textContent ?? '';
    expect(text).not.toMatch(/没有|0 mastered|none|empty/i);
  });

  it('suppresses the zero count lines entirely — the page itself was fixed to hide this exact zero', () => {
    // F5: the Logbook page suppresses "0 个字 / 熟练 0" for a brand-new child;
    // the hall card is more prominent (the very first thing she sees) and
    // still showed it, contradicting the page one tap later.
    render(<LogbookHallCard childId="c1" totalCount={0} proficientCount={0} />);
    const card = screen.getByTestId('atlas-hall-logbook');
    expect(screen.queryByTestId('logbook-hall-counts')).not.toBeInTheDocument();
    const text = card.textContent ?? '';
    expect(text).not.toMatch(/0\s*个字|0\s*characters|熟练\s*0|0\s*solid/);
    // Title and invitation must still be there.
    expect(text).toMatch(/航海日志/);
    expect(text).toMatch(/你认识的每一个字/);
  });

  it('shows the counts once she has entries', () => {
    render(<LogbookHallCard childId="c1" totalCount={5} proficientCount={2} />);
    expect(screen.getByTestId('logbook-hall-counts')).toBeInTheDocument();
  });
});
