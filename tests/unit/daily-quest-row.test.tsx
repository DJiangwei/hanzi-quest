import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyQuestRow } from '@/components/play/DailyQuestRow';

const threeQuests = [
  { emoji: '🧭', labelZh: '小小探险家', progress: 3, target: 3, completed: true },
  { emoji: '⭐', labelZh: '完美之星', progress: 2, target: 2, completed: true },
  { emoji: '🔁', labelZh: '复习时间', progress: 3, target: 3, completed: true },
];

const partialQuests = [
  { emoji: '🧭', labelZh: '小小探险家', progress: 1, target: 3, completed: false },
  { emoji: '⭐', labelZh: '完美之星', progress: 0, target: 2, completed: false },
  { emoji: '🔁', labelZh: '复习时间', progress: 2, target: 3, completed: false },
];

describe('DailyQuestRow', () => {
  it('renders 3 DailyQuestCards', () => {
    render(
      <DailyQuestRow
        quests={threeQuests}
        allDone={true}
        chestClaimed={false}
        onClaimChest={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('daily-quest-card')).toHaveLength(3);
  });

  it('shows chest button when allDone and not chestClaimed', () => {
    const onClaim = vi.fn();
    render(
      <DailyQuestRow
        quests={threeQuests}
        allDone={true}
        chestClaimed={false}
        onClaimChest={onClaim}
      />,
    );
    const btn = screen.getByTestId('daily-chest-button');
    expect(btn).toBeInTheDocument();
  });

  it('calls onClaimChest when chest button is clicked', () => {
    const onClaim = vi.fn();
    render(
      <DailyQuestRow
        quests={threeQuests}
        allDone={true}
        chestClaimed={false}
        onClaimChest={onClaim}
      />,
    );
    fireEvent.click(screen.getByTestId('daily-chest-button'));
    expect(onClaim).toHaveBeenCalledOnce();
  });

  it('shows "明日再来" message when chestClaimed', () => {
    render(
      <DailyQuestRow
        quests={threeQuests}
        allDone={true}
        chestClaimed={true}
        onClaimChest={vi.fn()}
      />,
    );
    expect(screen.getByTestId('daily-chest-claimed')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-chest-button')).not.toBeInTheDocument();
  });

  it('hides chest button when not allDone', () => {
    render(
      <DailyQuestRow
        quests={partialQuests}
        allDone={false}
        chestClaimed={false}
        onClaimChest={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('daily-chest-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('daily-chest-claimed')).not.toBeInTheDocument();
  });

  it('hides chest button when allDone but chestClaimed', () => {
    render(
      <DailyQuestRow
        quests={threeQuests}
        allDone={true}
        chestClaimed={true}
        onClaimChest={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('daily-chest-button')).not.toBeInTheDocument();
  });
});
