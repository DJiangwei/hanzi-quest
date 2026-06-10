'use client';

import { useSyncExternalStore } from 'react';

/** Landscape-tablet breakpoint — matches the Tailwind `lg:` switch (≥1024px). */
const QUERY = '(min-width: 1024px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * SSR-safe "is the viewport ≥ lg (landscape iPad)?" hook. Uses the React 19
 * `useSyncExternalStore` pattern (same as the Web-Speech detection hooks): the
 * server snapshot is always `false`, so SSR renders the phone layout and the
 * client upgrades to the wide layout on mount — a state change, not a hydration
 * mismatch. Client components only.
 */
export function useIsWide(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
