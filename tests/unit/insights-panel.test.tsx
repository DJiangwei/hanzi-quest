// A3 — the parent insight panel. Its job is to aim homework, so the tests are
// about honesty: every panel must state its own limits, and none of it may
// leak onto a surface a child sees.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsightsPanel } from '@/components/parent/InsightsPanel';
import type { ChildInsights } from '@/lib/db/insights';

const base: ChildInsights = {
  totalAnswers: 0,
  firstAnswerAt: null,
  lastAnswerAt: null,
  activity: [],
  missed: [],
  confusions: [],
  sources: [],
  selfRatings: [],
};

describe('InsightsPanel', () => {
  it('renders every panel as an empty state rather than blank for a new child', () => {
    render(<InsightsPanel data={base} />);
    expect(screen.getByText(/No answers in the last 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing missed yet/)).toBeInTheDocument();
    expect(screen.getByText(/No wrong answers with a recorded choice yet/)).toBeInTheDocument();
    expect(screen.getByText(/No flashcard self-ratings yet/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument();
  });

  it('shows a confusion pair as target ← picked', () => {
    // 宝 → 贝 is the real one from production: she chose the component of the
    // character she was asked for. That is exactly the kind of thing this page
    // exists to put in front of David.
    render(
      <InsightsPanel
        data={{
          ...base,
          confusions: [{ target: '宝', picked: '贝', sceneType: 'audio_pick', count: 2 }],
        }}
      />,
    );
    const row = screen.getByTestId('insights-confusions');
    expect(row).toHaveTextContent('宝');
    expect(row).toHaveTextContent('贝');
    expect(row).toHaveTextContent('×2');
  });

  it('says out loud that boss mistakes cannot appear here', () => {
    // BossScene emits its own events without a picked key, so 152 boss answers
    // contribute nothing to confusion pairs. A page that silently omitted the
    // boss would read as "she never gets boss questions wrong".
    render(<InsightsPanel data={base} />);
    expect(screen.getByText(/Boss battles are absent by design/)).toBeInTheDocument();
  });

  it('calls an all-got_it self-rating distribution unusable, not good news', () => {
    // Production: 164 of 164 ratings are `got_it`, across two months in which
    // she answered 33 scored questions wrong. A parent reading "164 got it"
    // as mastery would aim homework at exactly the wrong characters.
    render(
      <InsightsPanel
        data={{ ...base, selfRatings: [{ rating: 'got_it', count: 164, revealed: 0 }] }}
      />,
    );
    expect(screen.getByText(/unusable rather than as good news/)).toBeInTheDocument();
  });

  it('does not editorialise when the ratings are actually varied', () => {
    render(
      <InsightsPanel
        data={{
          ...base,
          selfRatings: [
            { rating: 'got_it', count: 10, revealed: 2 },
            { rating: 'dont_know', count: 3, revealed: 3 },
          ],
        }}
      />,
    );
    expect(screen.queryByText(/unusable rather than as good news/)).not.toBeInTheDocument();
    expect(screen.getByTestId('insights-ratings')).toHaveTextContent('after revealing');
  });

  it('shows the answered denominator beside every miss count', () => {
    // "3 wrong" alone is unreadable — 3 of 4 and 3 of 40 are different facts,
    // and the ordering already leans on that distinction.
    render(
      <InsightsPanel
        data={{
          ...base,
          missed: [
            {
              characterId: 'c1', hanzi: '人', pinyin: ['rén'], meaningEn: 'person',
              scored: 4, wrong: 3, dontKnow: 0, state: 'learning',
            },
          ],
        }}
      />,
    );
    const t = screen.getByTestId('insights-missed');
    expect(t).toHaveTextContent('人');
    expect(t).toHaveTextContent('3');
    expect(t).toHaveTextContent('4');
  });

  it('never renders a score, a grade or failure language', () => {
    // The parent surface may be blunt about data quality, but this is still a
    // page about a six-year-old; it reports counts, not verdicts on her.
    render(
      <InsightsPanel
        data={{
          ...base,
          missed: [
            {
              characterId: 'c1', hanzi: '人', pinyin: ['rén'], meaningEn: 'person',
              scored: 4, wrong: 3, dontKnow: 0, state: 'learning',
            },
          ],
        }}
      />,
    );
    const html = screen.getByTestId('insights-panel').textContent ?? '';
    expect(html).not.toMatch(/\bfail(ed|ing|ure)?\b|\bbad\b|\bpoor\b|\bweak\b|behind|grade/i);
  });
});
