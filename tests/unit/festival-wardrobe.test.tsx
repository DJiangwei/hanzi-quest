import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FestivalWardrobe } from '@/components/shop/FestivalWardrobe';
import type { FestivalCosmeticListing } from '@/lib/db/shop';

const cosmetics: FestivalCosmeticListing[] = [
  { avatarItemId: 'a1', unlockRef: 'festival-newyear', slotId: 'hat', equipped: false },
  { avatarItemId: 'a2', unlockRef: 'festival-rabbit', slotId: 'hat', equipped: true },
];

describe('FestivalWardrobe', () => {
  it('renders nothing when no cosmetics are owned', () => {
    const { container } = render(
      <FestivalWardrobe cosmetics={[]} pending={false} onEquip={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each owned cosmetic and marks the equipped one', () => {
    render(<FestivalWardrobe cosmetics={cosmetics} pending={false} onEquip={() => {}} />);
    expect(screen.getByTestId('wardrobe-festival-newyear')).toBeInTheDocument();
    const worn = screen.getByTestId('wardrobe-festival-rabbit');
    expect(worn).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/已穿戴 \/ Worn/)).toBeInTheDocument();
  });

  it('calls onEquip when an unworn cosmetic is tapped', () => {
    const onEquip = vi.fn();
    render(<FestivalWardrobe cosmetics={cosmetics} pending={false} onEquip={onEquip} />);
    fireEvent.click(screen.getByTestId('wardrobe-festival-newyear'));
    expect(onEquip).toHaveBeenCalledWith(cosmetics[0]);
  });

  it('disables tapping while a transition is pending', () => {
    const onEquip = vi.fn();
    render(<FestivalWardrobe cosmetics={cosmetics} pending onEquip={onEquip} />);
    expect(screen.getByTestId('wardrobe-festival-newyear')).toBeDisabled();
  });
});
