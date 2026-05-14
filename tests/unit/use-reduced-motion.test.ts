import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from '@/lib/hooks/use-reduced-motion';

describe('useReducedMotion', () => {
  type Listener = (ev: MediaQueryListEvent) => void;
  let listeners: Listener[] = [];
  let currentMatches = false;

  function makeMql(): MediaQueryList {
    return {
      matches: currentMatches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: (_: string, cb: Listener) => listeners.push(cb),
      removeEventListener: (_: string, cb: Listener) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: () => true,
      addListener: () => undefined,
      removeListener: () => undefined,
    } as unknown as MediaQueryList;
  }

  beforeEach(() => {
    listeners = [];
    currentMatches = false;
    vi.stubGlobal('matchMedia', vi.fn(() => makeMql()));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when prefers-reduced-motion is not set', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce is active at mount', () => {
    currentMatches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => {
      listeners.forEach((cb) =>
        cb({ matches: true } as MediaQueryListEvent),
      );
    });
    expect(result.current).toBe(true);
  });

  it('safely returns false in non-window environment', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
