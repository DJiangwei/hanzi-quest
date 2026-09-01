import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PiggyBankCard } from '@/components/play/PiggyBankCard';
import { WeekHub } from '@/components/play/WeekHub';

const sections = {
  review: { done: 0, total: 10 },
  practice: { done: 7, total: 15 },
  boss: { done: 0, total: 1, locked: false },
};
const week = { id: 'w1', weekNumber: 3, label: '第三周' };

describe('PiggyBankCard', () => {
  it('links to the piggy page and shows the balance when enabled', () => {
    render(<PiggyBankCard childId="c1" balancePence={1450} enabled />);
    const link = screen.getByTestId('piggy-home-card');
    expect(link).toHaveAttribute('href', '/play/c1/piggy-bank');
    expect(link).toHaveTextContent('£14.50');
  });

  it('renders nothing when disabled — a child whose parent has not opted in must not see this reward', () => {
    const { container } = render(
      <PiggyBankCard childId="c1" balancePence={1450} enabled={false} />,
    );
    expect(screen.queryByTestId('piggy-home-card')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('WeekHub pre-fight rewards', () => {
  it('lists 💷 alongside the other first-clear rewards on the frontier', () => {
    render(
      <WeekHub
        childId="c1"
        week={week}
        sections={sections}
        frontier
        keys={{ earned: 2, total: 10 }}
        piggyPence={100}
      />,
    );
    expect(screen.getByTestId('piggy-prefight')).toHaveTextContent('£1.00');
  });

  it('omits the £ line entirely when the piggy bank is off', () => {
    render(
      <WeekHub
        childId="c1"
        week={week}
        sections={sections}
        frontier
        keys={{ earned: 2, total: 10 }}
      />,
    );
    expect(screen.queryByTestId('piggy-prefight')).not.toBeInTheDocument();
  });

  it('still shows the other three rewards, unchanged', () => {
    render(
      <WeekHub
        childId="c1"
        week={week}
        sections={sections}
        frontier
        keys={{ earned: 2, total: 10 }}
        piggyPence={100}
      />,
    );
    expect(screen.getByText('金币 ×2')).toBeInTheDocument();
    expect(screen.getByText('额外卡片 ×1')).toBeInTheDocument();
    expect(screen.getByText(/钥匙碎片 ×1/)).toBeInTheDocument();
    expect(screen.getByText('解锁下一座岛')).toBeInTheDocument();
  });
});
