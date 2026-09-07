import Link from 'next/link';
import { requireChild } from '@/lib/auth/guards';
import { Room3DMount } from '@/components/home3d/Room3DMount';
import type { Placed3D } from '@/components/home3d/HomeRoom3D';

/**
 * SPIKE — a look-at-it prototype for the 3D home, on its own route.
 *
 * Route-scoped on purpose: three.js + r3f + drei are ~600KB gzipped, and a
 * dynamic import behind this path keeps every other page's bundle untouched
 * while the question is open. If the answer is "no", deleting this directory
 * and three dependencies removes the whole experiment.
 *
 * Not linked from anywhere. Reachable by URL, like the admin authoring pages.
 * The dynamic import itself lives in Room3DMount — `ssr: false` is rejected in
 * a Server Component under Next 16.
 */

/** A furnished bedroom, using the REAL slugs, footprints and grid of the 2D room. */
const DEMO: Placed3D[] = [
  { slug: 'window-sunny', gridX: 2, gridY: 0, w: 2, h: 1, surface: 'wall' },
  { slug: 'clock-round', gridX: 6, gridY: 0, w: 1, h: 1, surface: 'wall' },
  { slug: 'bookshelf', gridX: 0, gridY: 2, w: 2, h: 1, surface: 'floor' },
  { slug: 'bed-cozy', gridX: 5, gridY: 2, w: 2, h: 1, surface: 'floor' },
  { slug: 'desk-study', gridX: 2, gridY: 2, w: 2, h: 1, surface: 'floor' },
  { slug: 'rug-round', gridX: 3, gridY: 4, w: 1, h: 1, surface: 'floor' },
  { slug: 'toy-chest', gridX: 1, gridY: 4, w: 1, h: 1, surface: 'floor' },
  { slug: 'plant-fern', gridX: 7, gridY: 4, w: 1, h: 1, surface: 'floor' },
  { slug: 'teddy-bear', gridX: 5, gridY: 4, w: 1, h: 1, surface: 'floor' },
];

export default async function Home3DPreviewPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  await requireChild(childId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header>
        <Link href={`/play/${childId}/home`} className="text-xs font-semibold text-stone-500">
          ← 家 / Home
        </Link>
        <h1 className="mt-1 font-hanzi text-xl font-extrabold text-stone-900">
          卧室 3D 试作 <span className="text-sm font-semibold">/ Bedroom 3D spike</span>
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Procedural low-poly, locked camera. Same 8×6 grid, same slugs and
          footprints as the 2D room — so the data underneath is unchanged.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl border-2 border-amber-200 shadow-sm">
        <Room3DMount placements={DEMO} />
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
        <h2 className="font-bold">What to judge</h2>
        <ul className="mt-2 list-disc pl-5 text-stone-600">
          <li>Does it feel warm and toy-like, or like programmer art?</li>
          <li>Are the pieces recognisable at this camera angle?</li>
          <li>Do you want to look at it from the other side? (that answer decides stepped rotation)</li>
        </ul>
      </section>
    </main>
  );
}
