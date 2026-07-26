import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KeyTrack } from '@/components/play/KeyTrack';

const PRIZE = { prizeZh: '加勒比宝藏', prizeEn: 'The Caribbean Hoard' };

describe('KeyTrack', () => {
  it('renders one key glyph per week, filled up to the earned count', () => {
    render(<KeyTrack earned={3} total={10} {...PRIZE} opened={false} />);
    expect(screen.getAllByTestId('key-filled')).toHaveLength(3);
    expect(screen.getAllByTestId('key-empty')).toHaveLength(7);
    expect(screen.getByTestId('key-track')).toHaveAttribute('data-earned', '3');
    expect(screen.getByTestId('key-track')).toHaveAttribute('data-total', '10');
  });

  it('names the prize bilingually so the goal is legible before the grind', () => {
    render(<KeyTrack earned={0} total={10} {...PRIZE} opened={false} />);
    expect(screen.getByText(/加勒比宝藏/)).toBeInTheDocument();
    expect(screen.getByText(/The Caribbean Hoard/)).toBeInTheDocument();
  });

  it('switches to the opened message once every key is collected', () => {
    render(<KeyTrack earned={10} total={10} {...PRIZE} opened />);
    expect(screen.getByText(/宝库已开启/)).toBeInTheDocument();
    expect(screen.getByText(/Vault opened/)).toBeInTheDocument();
  });

  it('never renders more filled keys than the total', () => {
    render(<KeyTrack earned={99} total={10} {...PRIZE} opened />);
    expect(screen.getAllByTestId('key-filled')).toHaveLength(10);
    expect(screen.queryAllByTestId('key-empty')).toHaveLength(0);
  });

  it('renders nothing for a map with no published weeks', () => {
    const { container } = render(
      <KeyTrack earned={0} total={0} {...PRIZE} opened={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
