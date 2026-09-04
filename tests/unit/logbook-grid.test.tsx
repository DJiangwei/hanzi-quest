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

  it('badges a learning character with quiet wording, and its styling never reads as failure', () => {
    // The binding rule ("no red, no ✗, no colour that codes a character as
    // bad") covers `learning`, not just `unrated`. `learning` is the state
    // most likely to gain discouraging styling later — it genuinely means
    // "not there yet" — so pin BOTH its wording and its colour, not just one.
    render(<LogbookGrid tiles={[tile({ state: 'learning' })]} />);
    const badge = screen.getByTestId('logbook-badge-ch1');
    expect(badge.textContent).toMatch(/学习中/);
    expect(badge.textContent).toMatch(/Learning/i);
    expect(badge.className).not.toMatch(/red|rose|danger|warn/i);
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

    // Isolate `learning`'s own badge too: a textContent scan over the whole
    // grid can't see className, and a red/warning colour token slipped onto
    // just this one badge would otherwise hide inside the aggregate check.
    const learningBadge = screen.getByTestId('logbook-badge-a');
    expect(learningBadge.textContent).not.toMatch(/%|错|失败|wrong|fail|needs work|weak/i);
    expect(learningBadge.className).not.toMatch(/red|rose|danger|warn/i);
  });

  it('opens a detail with meaning, first word and sentence on tap', async () => {
    render(<LogbookGrid tiles={[tile({})]} />);
    await userEvent.click(screen.getByTestId('logbook-tile-ch1'));
    const detail = screen.getByTestId('logbook-detail');
    expect(detail.textContent).toMatch(/one/);
    expect(detail.textContent).toMatch(/一起/);
    expect(detail.textContent).toMatch(/我们一起走。/);
  });

  it('renders a detail for a character with no word or sentence data, and skips those sections entirely', async () => {
    render(<LogbookGrid tiles={[tile({ firstWord: null, sentence: null, meaningEn: null })]} />);
    await userEvent.click(screen.getByTestId('logbook-tile-ch1'));
    const detail = screen.getByTestId('logbook-detail');
    expect(detail).toBeInTheDocument();
    // A future `?? ''` regression would still mount an empty meaning/word/
    // sentence node even with no data behind it. Assert the sections
    // themselves are absent — hanzi, pinyin, and the close button are the
    // only children — not merely that their text happens to be blank.
    expect(detail.children).toHaveLength(3);
  });
});
