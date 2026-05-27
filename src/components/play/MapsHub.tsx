import { MapCard } from './MapCard';
import type { MapForChild } from '@/lib/db/maps';

interface Props {
  childId: string;
  maps: MapForChild[];
}

export function MapsHub({ childId, maps }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="text-center">
        <h1 className="font-hanzi text-2xl font-extrabold text-[var(--color-ocean-900)]">
          航海图 · Nautical Charts
        </h1>
        <p className="mt-1 text-sm text-[var(--color-sand-700)]">
          选择你要探险的海域 · Choose your sea
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {maps.map((m) => (
          <li key={m.packId}>
            <MapCard childId={childId} map={m} />
          </li>
        ))}
      </ul>
    </main>
  );
}
