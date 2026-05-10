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
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
        <Link href="/parent" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">汉字探险</span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs uppercase tracking-widest text-zinc-500">
            Parent
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/parent" className="text-zinc-600 hover:text-zinc-900">
            Dashboard
          </Link>
          <Link
            href="/parent/children"
            className="text-zinc-600 hover:text-zinc-900"
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
