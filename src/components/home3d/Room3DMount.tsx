'use client';

import dynamic from 'next/dynamic';
import type { Placed3D } from './HomeRoom3D';

/**
 * Client-only mount for the 3D room.
 *
 * `ssr: false` on `next/dynamic` is rejected inside a Server Component in
 * Next 16, so the dynamic import lives here. The indirection is load-bearing
 * for the same reason the spike is route-scoped: three + r3f + drei stay out
 * of every other page's bundle until this component is actually rendered.
 */
const HomeRoom3D = dynamic(() => import('./HomeRoom3D').then((m) => m.HomeRoom3D), {
  ssr: false,
  loading: () => (
    <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-amber-100" />
  ),
});

export function Room3DMount({ placements }: { placements: Placed3D[] }) {
  return <HomeRoom3D placements={placements} />;
}
