// E1 — 写字 stroke practice. Standalone and reward-free on purpose, the same
// shape 听声调 shipped in: the premise (can a six-year-old's finger satisfy
// stroke matching?) is unverified, and a page with no economy attached can be
// deleted rather than unwound.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// hanzi-writer is an imperative DOM library that fetches from a CDN; the
// tracer is stubbed so these tests are about the surface's rules, not its
// rendering. StrokeTracer's own contract is covered separately.
const traced = vi.hoisted(() => ({ props: [] as { hanzi: string }[] }));
vi.mock('@/components/play/StrokeTracer', () => ({
  StrokeTracer: (p: { hanzi: string; onComplete?: () => void }) => {
    traced.props.push({ hanzi: p.hanzi });
    return (
      <button type="button" data-testid="stub-tracer" onClick={() => p.onComplete?.()}>
        {p.hanzi}
      </button>
    );
  },
}));
vi.mock('@/lib/hooks/useSpeak', () => ({ useSpeak: () => () => {}, usableAudioUrl: () => null }));
vi.mock('@/lib/hooks/useSpeechSupported', () => ({ useSpeechSupported: () => true }));

import { WriteGameBody, type WriteChar } from '@/components/play/WriteGameBody';

const ch = (hanzi: string): WriteChar => ({
  characterId: hanzi,
  hanzi,
  pinyin: ['x'],
  meaningEn: 'thing',
});
const pool = ['一', '二', '三', '四', '五', '六', '七'].map(ch);

beforeEach(() => { traced.props = []; });

describe('WriteGameBody', () => {
  it('offers a warm invitation, not an error, with nothing learned yet', () => {
    render(<WriteGameBody chars={[]} />);
    const text = screen.getByTestId('write-empty').textContent ?? '';
    expect(text).toMatch(/先去岛上学几个字/);
    expect(text).not.toMatch(/没有|error|无法|0/i);
  });

  it('lets her move on WITHOUT finishing a character', () => {
    // A stroke she cannot satisfy must never trap her on one character — the
    // same reasoning that lets a skipped practice scene score 0 rather than
    // block. The button is present before anything is completed.
    render(<WriteGameBody chars={pool} />);
    expect(screen.getByText(/换一个 \/ Skip/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/换一个 \/ Skip/));
    expect(traced.props).toHaveLength(2);
    expect(traced.props[1].hanzi).not.toBe(traced.props[0].hanzi);
  });

  it('acknowledges a finished character without scoring it', () => {
    render(<WriteGameBody chars={pool} />);
    fireEvent.click(screen.getByTestId('stub-tracer'));
    expect(screen.getByTestId('write-stroke-done')).toBeInTheDocument();
    const text = screen.getByTestId('write-game').textContent ?? '';
    expect(text).not.toMatch(/连续|streak|得分|score|\d+\s*分/);
  });

  it('never shows a score, a streak or failure language', () => {
    // Same rule as 温故's card and the tone game: this surface must not
    // acquire pressure. Tracing is the hardest thing in the product to get
    // exactly right, so it is the last place that should keep a tally.
    render(<WriteGameBody chars={pool} />);
    const text = screen.getByTestId('write-game').textContent ?? '';
    expect(text).not.toMatch(/错|失败|wrong|failed|✗/i);
  });

  it('gives a different handful each round, deterministically', () => {
    // No randomness in the render body — `chars` arrives shuffled from the
    // server and the body rotates a window over it (react-hooks/purity, and
    // the MCQ landmine's "randomize upstream").
    render(<WriteGameBody chars={pool} />);
    const first = traced.props[0].hanzi;
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText(/Skip|Next/));
    }
    fireEvent.click(screen.getByText(/再写一组/));
    expect(traced.props[traced.props.length - 1].hanzi).not.toBe(first);
  });

  it('is bilingual on every control', () => {
    render(<WriteGameBody chars={pool} />);
    const text = screen.getByTestId('write-game').textContent ?? '';
    expect(text).toMatch(/写字/);
    expect(text).toMatch(/Write/);
    expect(text).toMatch(/Trace over the grey strokes/);
  });
});
