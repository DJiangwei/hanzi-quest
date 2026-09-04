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
    // Denylist alone lets an amber/orange "warning" palette through — and
    // `proficient` legitimately uses amber, so the codebase's own "good"
    // colour sits one step from an uncaught "bad" one. Pin the actual quiet
    // neutral palette too.
    expect(badge.className).toMatch(/stone|slate|gray|neutral/);
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

  it('reaches the detail from a realistic 30-character grid — production has ~96', async () => {
    // F1: the detail used to render AFTER the <ul>. With ~24 rows of tiles
    // that panel sits ~1750px below the fold, so tapping any tile above the
    // last few rows changed nothing visible. Every other test here renders
    // ≤3 tiles, which is why the suite never caught it. This one renders
    // enough tiles to span several grid rows and taps one near the top.
    const tiles = Array.from({ length: 30 }, (_, i) =>
      tile({ characterId: `ch${i}`, hanzi: String(i), pinyin: [`p${i}`] }),
    );
    render(<LogbookGrid tiles={tiles} />);
    expect(screen.getAllByTestId(/^logbook-tile-/)).toHaveLength(30);

    // Tile index 2 sits in the grid's first row (grid-cols-4 on phones).
    const tappedTile = screen.getByTestId('logbook-tile-ch2');
    expect(tappedTile).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(tappedTile);

    const detail = screen.getByTestId('logbook-detail');
    expect(detail).toBeInTheDocument();
    expect(detail.textContent).toMatch(/一起/);
    expect(tappedTile).toHaveAttribute('aria-pressed', 'true');
  });

  it('dismisses the overlay via the backdrop and via Escape', async () => {
    const tiles = Array.from({ length: 30 }, (_, i) => tile({ characterId: `ch${i}`, hanzi: String(i) }));
    render(<LogbookGrid tiles={tiles} />);
    await userEvent.click(screen.getByTestId('logbook-tile-ch5'));
    expect(screen.getByTestId('logbook-detail')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('logbook-detail')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('logbook-tile-ch5'));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(dialog);
    expect(screen.queryByTestId('logbook-detail')).not.toBeInTheDocument();
  });
});
