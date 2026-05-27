import { requireChild } from '@/lib/auth/guards';
import { listMapsForChild } from '@/lib/db/maps';
import { MapsHub } from '@/components/play/MapsHub';

interface PageProps {
  params: Promise<{ childId: string }>;
}

export default async function MapsPage({ params }: PageProps) {
  const { childId } = await params;
  const { child } = await requireChild(childId);
  const maps = await listMapsForChild(child.id);
  return <MapsHub childId={child.id} maps={maps} />;
}
