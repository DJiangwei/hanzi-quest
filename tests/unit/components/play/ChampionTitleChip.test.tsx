import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChampionTitleChip } from '@/components/play/ChampionTitleChip';

describe('ChampionTitleChip', () => {
  it('renders the bilingual title for the latest beaten map', () => {
    render(<ChampionTitleChip titleZh="加勒比海霸主" titleEn="Lord of the Caribbean" />);
    expect(screen.getByText(/加勒比海霸主/)).toBeInTheDocument();
    expect(screen.getByText(/Lord of the Caribbean/)).toBeInTheDocument();
  });
  it('renders nothing when no title', () => {
    const { container } = render(<ChampionTitleChip titleZh={null} titleEn={null} />);
    expect(container.firstChild).toBeNull();
  });
});
