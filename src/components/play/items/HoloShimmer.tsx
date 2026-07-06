'use client';

import type { ReactNode } from 'react';
import { SHARD_SWAP_EXCLUSIVE_PACKS } from '@/lib/economy/shards';

/** Limited packs (festivals/season/champions) get the holo treatment. */
export function isLimitedPack(packSlug: string): boolean {
  return SHARD_SWAP_EXCLUSIVE_PACKS.has(packSlug);
}

/**
 * A1 juice: iridescent sheen sweeping over OWNED limited-pack cards.
 * Pure CSS (`holo-sweep` keyframes in globals.css); reduced-motion disables
 * the sweep there and leaves a faint static tint. When `active` is false the
 * children render untouched.
 */
export function HoloShimmer({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <div className="relative">
      {children}
      <div
        aria-hidden
        data-testid="holo-overlay"
        className="holo-overlay pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
      />
    </div>
  );
}
