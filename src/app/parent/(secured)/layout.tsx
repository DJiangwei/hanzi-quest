import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';
import { listChildrenForUser } from '@/lib/db/children';
import { chooseKidEntryAction } from '@/lib/actions/entry';

/**
 * Secured parent layout — wraps every parent page EXCEPT `/parent/unlock`.
 * Enforces the 4-digit PIN gate: if a PIN is set and the unlock cookie is
 * absent/expired, redirect to `/parent/unlock` (which is outside this group, so
 * it renders without re-triggering the gate — no redirect loop).
 */
export default async function SecuredParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');

  const jar = await cookies();
  const unlocked = jar.get('parent_unlocked')?.value === '1';
  const [settings, childProfiles] = await Promise.all([
    getParentSettings(user.id),
    listChildrenForUser(user.id),
  ]);

  if (settings?.parentPinHash && !unlocked) {
    redirect('/parent/unlock');
  }

  const showFirstTimeBanner = !settings?.parentPinHash;

  return (
    <div className="flex flex-1 flex-col">
      {showFirstTimeBanner && (
        <div className="bg-[var(--color-sunset-100)] px-6 py-2 text-center text-sm text-[var(--color-sunset-700)]">
          <Link href="/parent/unlock" className="font-bold underline">
            Set a parent PIN
          </Link>{' '}
          to keep your child from accidentally editing your work.
        </div>
      )}
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
          {childProfiles.length === 1 ? (
            <form action={chooseKidEntryAction.bind(null, childProfiles[0].id)}>
              <button
                type="submit"
                className="rounded-full bg-[var(--color-ocean-500)] px-3 py-1.5 font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-ocean-700)]"
              >
                🎮 进入游戏 / Play
              </button>
            </form>
          ) : (
            <Link
              href="/?choose=1"
              className="rounded-full bg-[var(--color-ocean-500)] px-3 py-1.5 font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-ocean-700)]"
            >
              🎮 进入游戏 / Play
            </Link>
          )}
          <UserButton />
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
