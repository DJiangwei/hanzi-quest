import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ childId: string }>;
}

export default async function PlayLayout({ children, params }: LayoutProps) {
  const { childId } = await params;
  try {
    await requireChild(childId);
  } catch {
    notFound();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-sky-50 to-amber-50">
      <header className="flex items-center justify-between border-b border-white/60 bg-white/40 px-4 py-2 backdrop-blur">
        <Link
          href="/parent"
          className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-800"
        >
          ← Parent dashboard
        </Link>
        <span className="text-sm font-bold tracking-wide text-zinc-700">
          汉字探险
        </span>
        <span className="w-[140px]" />
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
