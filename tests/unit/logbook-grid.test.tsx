import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogbookGrid, type LogbookTile } from '@/components/play/LogbookGrid';

const tile = (over: Partial<LogbookTile>): LogbookTile => ({
  characterId: over.characterId ?? 'ch1',
  hanzi: over.hanzi ?? '一',
  pinyin: over.pinyin ?? ['yī'],
  meaningEn: over.meaningEn ?? 'one',
  firstWord: over.firstWord ?? '一起',
  sentence: over.sentence ?? '我们一起走。',
  state: over.state ?? 'unrated',
  ...over,
});

describe('LogbookGrid', () => {
  it('renders every taught character, badged or not', () => {
    render(<LogbookGrid tiles={[tile({ characterId: 'a', hanzi: '一' }), tile({ characterId: 'b', hanzi: '二' })]} />);
    expect(screen.getAllByTestId(/^logbook-tile-/)).toHaveLength(2);
  });

  it('badges a proficient character and says so in both languages', () => {
    render(<LogbookGrid tiles={[tile({ state: 'proficient' })]} />);
    const badge = screen.getByTestId('logbook-badge-ch1');
    expect(badge.textContent).toMatch(/熟练/);
    expect(badge.textContent).toMatch(/Solid/i);
  });

  it('shows NO badge on a character with too little evidence', () => {
    // An unearned badge is a false signal. A missing one is honest, and fills
    // in on its own — 57 of production's 96 characters sit here today.
    render(<LogbookGrid tiles={[tile({ state: 'unrated' })]} />);
    expect(screen.queryByTestId('logbook-badge-ch1')).toBeNull();
  });

  it('never renders a score, a percentage, or failure language', () => {
    // Standing product rule: nothing on a kid surface may read as a verdict.
    // 学习中 is the weakest thing this page may ever say about a character.
    render(
      <LogbookGrid
        tiles={[
          tile({ characterId: 'a', state: 'learning' }),
          tile({ characterId: 'b', state: 'unrated' }),
          tile({ characterId: 'c', state: 'proficient' }),
        ]}
      />,
    );
    const text = screen.getByTestId('logbook-grid').textContent ?? '';
    expect(text).not.toMatch(/%|错|失败|wrong|fail|needs work|weak/i);
  });

  it('opens a detail with meaning, first word and sentence on tap', async () => {
    render(<LogbookGrid tiles={[tile({})]} />);
    await userEvent.click(screen.getByTestId('logbook-tile-ch1'));
    const detail = screen.getByTestId('logbook-detail');
    expect(detail.textContent).toMatch(/one/);
    expect(detail.textContent).toMatch(/一起/);
    expect(detail.textContent).toMatch(/我们一起走。/);
  });

  it('renders a detail for a character with no word or sentence data', async () => {
    render(<LogbookGrid tiles={[tile({ firstWord: null, sentence: null, meaningEn: null })]} />);
    await userEvent.click(screen.getByTestId('logbook-tile-ch1'));
    expect(screen.getByTestId('logbook-detail')).toBeInTheDocument();
  });
});
