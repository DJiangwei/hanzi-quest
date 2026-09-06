// The hanzi-writer wrapper. Everything here is about the seam between an
// imperative DOM library and a React tree — the part that breaks silently.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const hw = vi.hoisted(() => ({
  create: vi.fn(),
  quiz: vi.fn(),
  cancelQuiz: vi.fn(),
  shouldThrow: false,
}));
vi.mock('hanzi-writer', () => ({
  default: {
    create: (...args: unknown[]) => {
      if (hw.shouldThrow) throw new Error('no stroke data');
      hw.create(...args);
      return { quiz: hw.quiz, cancelQuiz: hw.cancelQuiz };
    },
  },
}));

import { StrokeTracer } from '@/components/play/StrokeTracer';

beforeEach(() => {
  hw.create.mockClear();
  hw.quiz.mockClear();
  hw.cancelQuiz.mockClear();
  hw.shouldThrow = false;
});

describe('StrokeTracer', () => {
  it('creates the writer in an effect and starts a quiz', async () => {
    render(<StrokeTracer hanzi="人" />);
    await waitFor(() => expect(hw.create).toHaveBeenCalledTimes(1));
    expect(hw.create.mock.calls[0][1]).toBe('人');
    expect(hw.quiz).toHaveBeenCalledTimes(1);
  });

  it('is LENIENT — a six-year-old traces with a finger, not a stylus', async () => {
    // The product softens 畏难情绪 everywhere else; a tracer that rejects a
    // nearly-right stroke would be the harshest surface in it.
    render(<StrokeTracer hanzi="人" />);
    // The writer is created in an ASYNC effect (the module is dynamically
    // imported), so a synchronous read of the mock sees an empty call list.
    await waitFor(() => expect(hw.create).toHaveBeenCalled());
    const opts = hw.create.mock.calls[0][2] as { leniency: number; showHintAfterMisses: number };
    expect(opts.leniency).toBeGreaterThan(1);
    expect(opts.showHintAfterMisses).toBeGreaterThan(0);
  });

  it('tears the writer down when the character changes', async () => {
    // hanzi-writer draws into the node it was handed. A stale instance would
    // keep drawing into a node React has already replaced.
    const { rerender } = render(<StrokeTracer hanzi="人" />);
    await waitFor(() => expect(hw.create).toHaveBeenCalledTimes(1));
    rerender(<StrokeTracer hanzi="大" />);
    await waitFor(() => expect(hw.cancelQuiz).toHaveBeenCalled());
    await waitFor(() => expect(hw.create).toHaveBeenCalledTimes(2));
  });

  it('does NOT restart when only the callback identity changes', async () => {
    // A parent that re-creates onComplete each render would otherwise tear the
    // writer down and restart the character mid-stroke.
    const { rerender } = render(<StrokeTracer hanzi="人" onComplete={() => {}} />);
    await waitFor(() => expect(hw.create).toHaveBeenCalledTimes(1));
    rerender(<StrokeTracer hanzi="人" onComplete={() => {}} />);
    rerender(<StrokeTracer hanzi="人" onComplete={() => {}} />);
    expect(hw.create).toHaveBeenCalledTimes(1);
  });

  it('says so when a character cannot be traced, rather than showing a blank box', async () => {
    // Offline, an unreachable CDN, or a character with no stroke data. All 176
    // of her characters resolve today, but an empty square reads as broken.
    hw.shouldThrow = true;
    render(<StrokeTracer hanzi="𰻝" />);
    await waitFor(() =>
      expect(screen.getByTestId('tracer-unavailable')).toBeInTheDocument(),
    );
    const text = screen.getByTestId('tracer-unavailable').textContent ?? '';
    expect(text).toMatch(/写不了/);
    expect(text).toMatch(/can't be traced|can’t be traced/i);
  });
});
