import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/play/AvatarRender', () => ({
  AvatarRender: ({ equipped }: { equipped?: Record<string, unknown> }) => (
    <div data-testid="avatar" data-hat={String(equipped?.hat ?? '')} />
  ),
}));

vi.mock('@/components/play/PetCompanion', () => ({
  PetCompanion: ({ pet }: { pet: { nameEn: string } | null }) => (
    pet ? <div data-testid="pet" data-name={pet.nameEn} /> : null
  ),
}));

import { ChapterCard } from '@/components/play/story/ChapterCard';

const noPet = null;

describe('ChapterCard', () => {
  it('renders avatar + chapter number', () => {
    render(
      <ChapterCard
        equippedAvatar={{ hat: 'red-bandana' }}
        pet={noPet}
        chapterNumber={3}
        tone="standard"
      />,
    );
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-hat', 'red-bandana');
    expect(screen.getByText(/Chapter 3|第3章/)).toBeInTheDocument();
  });

  it('renders the pet when pet is set', () => {
    render(
      <ChapterCard
        equippedAvatar={undefined}
        pet={{
          emoji: '🦜',
          nameZh: '鹦鹉',
          nameEn: 'Parrot',
          speechZh: [],
          speechEn: [],
        }}
        chapterNumber={1}
        tone="standard"
      />,
    );
    expect(screen.getByTestId('pet')).toHaveAttribute('data-name', 'Parrot');
  });

  it('omits the pet rendering when pet is null', () => {
    render(
      <ChapterCard
        equippedAvatar={undefined}
        pet={null}
        chapterNumber={1}
        tone="standard"
      />,
    );
    expect(screen.queryByTestId('pet')).toBeNull();
  });

  it('applies triumphant border class', () => {
    const { container } = render(
      <ChapterCard
        equippedAvatar={undefined}
        pet={null}
        chapterNumber={1}
        tone="triumphant"
      />,
    );
    expect(container.firstChild).toHaveClass('border-amber-400');
  });

  it('applies narrow_escape border class', () => {
    const { container } = render(
      <ChapterCard
        equippedAvatar={undefined}
        pet={null}
        chapterNumber={1}
        tone="narrow_escape"
      />,
    );
    expect(container.firstChild).toHaveClass('border-dashed');
  });
});
