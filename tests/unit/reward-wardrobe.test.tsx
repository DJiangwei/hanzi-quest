import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RewardWardrobe } from '@/components/shop/RewardWardrobe';
import type { RewardCosmeticListing } from '@/lib/db/shop';

const cosmetics: RewardCosmeticListing[] = [
  { avatarItemId: 'a1', unlockRef: 'festival-newyear', slotId: 'hat', theme: 'festival', equipped: false },
  { avatarItemId: 'a2', unlockRef: 'festival-rabbit', slotId: 'hat', theme: 'festival', equipped: true },
  { avatarItemId: 'a3', unlockRef: 'continent-asia', slotId: 'hat', theme: 'continent', equipped: false },
];

describe('RewardWardrobe', () => {
  it('renders nothing when no cosmetics are owned', () => {
    const { container } = render(
      <RewardWardrobe cosmetics={[]} pending={false} onEquip={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists festival AND continent cosmetics, marking the equipped one', () => {
    render(<RewardWardrobe cosmetics={cosmetics} pending={false} onEquip={() => {}} />);
    expect(screen.getByTestId('wardrobe-festival-newyear')).toBeInTheDocument();
    expect(screen.getByTestId('wardrobe-continent-asia')).toBeInTheDocument();
    // continent label resolves to the continent name (亚洲 / Asia)
    expect(screen.getByText(/亚洲/)).toBeInTheDocument();
    const worn = screen.getByTestId('wardrobe-festival-rabbit');
    expect(worn).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onEquip when an unworn cosmetic is tapped', () => {
    const onEquip = vi.fn();
    render(<RewardWardrobe cosmetics={cosmetics} pending={false} onEquip={onEquip} />);
    fireEvent.click(screen.getByTestId('wardrobe-continent-asia'));
    expect(onEquip).toHaveBeenCalledWith(cosmetics[2]);
  });

  it('disables tapping while a transition is pending', () => {
    render(<RewardWardrobe cosmetics={cosmetics} pending onEquip={() => {}} />);
    expect(screen.getByTestId('wardrobe-festival-newyear')).toBeDisabled();
  });
});
