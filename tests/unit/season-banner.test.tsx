import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonBanner } from '@/components/play/SeasonBanner';

describe('SeasonBanner', () => {
  it('renders nothing when state is null', () => {
    const { container } = render(<SeasonBanner childId="c1" state={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows tier, bilingual name, and a claimable chip when claimableCount > 0', () => {
    render(
      <SeasonBanner
        childId="c1"
        state={{
          nameZh: '夏季航海',
          nameEn: 'Summer Voyage',
          themeEmoji: '⛵',
          currentTier: 12,
          totalTiers: 30,
          xpToNext: 320,
          claimableCount: 2,
        }}
      />,
    );
    expect(screen.getByText(/夏季航海/)).toBeInTheDocument();
    expect(screen.getByText(/Summer Voyage/)).toBeInTheDocument();
    expect(screen.getByText(/12\/30/)).toBeInTheDocument();
    expect(screen.getByText(/2 可领/)).toBeInTheDocument();
  });

  it('shows XP-to-next when nothing is claimable', () => {
    render(
      <SeasonBanner
        childId="c1"
        state={{
          nameZh: '夏季航海',
          nameEn: 'Summer Voyage',
          themeEmoji: '⛵',
          currentTier: 3,
          totalTiers: 30,
          xpToNext: 75,
          claimableCount: 0,
        }}
      />,
    );
    expect(screen.getByText(/还需 75 XP/)).toBeInTheDocument();
  });
});
