import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ childId: string; weekId: string }>;
}

export default async function LegacyLevelPage({ params }: PageProps) {
  const { childId, weekId } = await params;
  redirect(`/play/${childId}/week/${weekId}`);
}
