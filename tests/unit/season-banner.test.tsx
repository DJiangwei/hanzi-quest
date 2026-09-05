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
          ended: false,
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
          ended: false,
        }}
      />,
    );
    expect(screen.getByText(/还需 75 XP/)).toBeInTheDocument();
  });

  it('says the season has ended instead of dangling an XP goal', () => {
    // Closing a season is a manual op, so `ended` WILL lag the end date —
    // 夏季航海 ended 2026-08-08 and the banner went on showing a live-looking
    // "还需 N XP" for 28 days, for a window that had closed.
    render(
      <SeasonBanner
        childId="c1"
        state={{
          nameZh: '夏季航海',
          nameEn: 'Summer Voyage',
          themeEmoji: '⛵',
          currentTier: 10,
          totalTiers: 30,
          xpToNext: 30,
          claimableCount: 0,
          ended: true,
        }}
      />,
    );
    expect(screen.getByTestId('season-banner-ended')).toBeInTheDocument();
    expect(screen.queryByText(/还需/)).not.toBeInTheDocument();
  });

  it('an ended season never advertises a claim, even with tiers outstanding', () => {
    // The end-of-season sweep banks everything reached, so a claimable count on
    // a closed season is stale state, not an invitation.
    render(
      <SeasonBanner
        childId="c1"
        state={{
          nameZh: '夏季航海',
          nameEn: 'Summer Voyage',
          themeEmoji: '⛵',
          currentTier: 10,
          totalTiers: 30,
          xpToNext: null,
          claimableCount: 3,
          ended: true,
        }}
      />,
    );
    expect(screen.getByTestId('season-banner-ended')).toBeInTheDocument();
    expect(screen.queryByText(/可领/)).not.toBeInTheDocument();
  });
});
