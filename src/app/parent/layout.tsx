import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');

  return (
    <div className="flex flex-1 flex-col bg-[var(--color-sand-50)]">
      <header className="flex items-center justify-between border-b border-[var(--color-sand-200)] bg-white/80 px-6 py-3 backdrop-blur">
        <Link href="/parent" className="flex items-center gap-2">
          <span className="font-hanzi text-xl font-bold tracking-tight text-[var(--color-ocean-900)]">
            汉字探险
          </span>
          <span className="rounded-full bg-[var(--color-sunset-100)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-sunset-600)]">
            Parent
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/parent"
            className="font-medium text-[var(--color-sand-700)] hover:text-[var(--color-ocean-700)]"
          >
            Dashboard
          </Link>
          <Link
            href="/parent/children"
            className="font-medium text-[var(--color-sand-700)] hover:text-[var(--color-ocean-700)]"
          >
            Children
          </Link>
          <UserButton />
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
