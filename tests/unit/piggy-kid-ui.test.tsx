import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PiggyJar } from '@/components/piggy/PiggyJar';
import { PiggyBreakdown } from '@/components/piggy/PiggyBreakdown';
import { PiggyHistory } from '@/components/piggy/PiggyHistory';

describe('PiggyJar', () => {
  it('shows the balance in £ with bilingual chrome', () => {
    render(<PiggyJar balancePence={1450} />);
    expect(screen.getByTestId('piggy-balance')).toHaveTextContent('£14.50');
    expect(screen.getByText(/存钱罐/)).toBeInTheDocument();
    expect(screen.getByText(/Piggy Bank/i)).toBeInTheDocument();
  });

  it('renders £0 as "saving up", never as a failure or a zero-earned message', () => {
    render(<PiggyJar balancePence={0} />);
    expect(screen.getByTestId('piggy-balance')).toHaveTextContent('£0.00');
    expect(screen.getByText(/攒钱中/)).toBeInTheDocument();
    expect(screen.getByText(/Saving up/i)).toBeInTheDocument();
    expect(screen.queryByText(/earned nothing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/没有/)).not.toBeInTheDocument();
  });
});

describe('PiggyBreakdown', () => {
  it('draws one labelled bar per category that has spend', () => {
    render(<PiggyBreakdown spendByCategory={{ snacks: 450, toys: 1200 }} />);
    const bars = screen.getAllByTestId(/^piggy-bar-/);
    expect(bars).toHaveLength(2);
    expect(screen.getByTestId('piggy-bar-toys')).toHaveTextContent('£12.00');
    expect(screen.getByTestId('piggy-bar-snacks')).toHaveTextContent('£4.50');
  });

  it('orders bars largest first so the biggest is instantly readable', () => {
    render(<PiggyBreakdown spendByCategory={{ snacks: 450, toys: 1200 }} />);
    const ids = screen.getAllByTestId(/^piggy-bar-/).map((el) => el.dataset.testid);
    expect(ids).toEqual(['piggy-bar-toys', 'piggy-bar-snacks']);
  });

  it('renders nothing at all when she has not spent anything yet', () => {
    const { container } = render(<PiggyBreakdown spendByCategory={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PiggyHistory', () => {
  const entries = [
    {
      id: 'e1', deltaPence: 100, source: 'boss_clear',
      category: null, note: null, occurredAt: '2026-08-30T10:00:00.000Z',
    },
    {
      id: 'e2', deltaPence: -450, source: 'purchase',
      category: 'snacks', note: 'Ice cream', occurredAt: '2026-08-29T10:00:00.000Z',
    },
  ];

  it('shows credits and debits with their signs', () => {
    render(<PiggyHistory entries={entries} />);
    expect(screen.getByTestId('piggy-entry-e1')).toHaveTextContent('£1.00');
    expect(screen.getByTestId('piggy-entry-e2')).toHaveTextContent('-£4.50');
  });

  it('labels an earned entry bilingually and a purchase by its category emoji', () => {
    render(<PiggyHistory entries={entries} />);
    expect(screen.getByTestId('piggy-entry-e1')).toHaveTextContent('打败Boss');
    expect(screen.getByTestId('piggy-entry-e1')).toHaveTextContent('Boss defeated');
    expect(screen.getByTestId('piggy-entry-e2')).toHaveTextContent('🍬');
  });

  it('shows a bilingual empty state rather than an empty list', () => {
    render(<PiggyHistory entries={[]} />);
    expect(screen.getByText(/还没有记录/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing yet/i)).toBeInTheDocument();
  });
});
