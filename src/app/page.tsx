import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { listChildrenForUser } from '@/lib/db/children';
import { EntryChooser } from '@/components/EntryChooser';
import { ENTRY_COOKIE, parseEntryPref } from '@/lib/auth/entry-pref';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ choose?: string }>;
}) {
  const user = await ensureUserBootstrapped();

  if (user) {
    const children = await listChildrenForUser(user.id);
    const forceChoose = (await searchParams)?.choose === '1';

    // "Remember last choice": auto-enter where they last went, unless forced.
    if (!forceChoose) {
      const jar = await cookies();
      const pref = parseEntryPref(jar.get(ENTRY_COOKIE)?.value);
      if (pref?.kind === 'parent') redirect('/parent');
      if (pref?.kind === 'kid' && children.some((c) => c.id === pref.childId)) {
        redirect(`/play/${pref.childId}`);
      }
    }

    // First login (or ?choose=1): show the Kid/Parent fork.
    return (
      <EntryChooser
        players={children.map((c) => ({ id: c.id, displayName: c.displayName }))}
      />
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-[var(--color-sand-50)] px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="rounded-full bg-[var(--color-ocean-100)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ocean-700)]">
          Weekly characters, made playable
        </span>
        <h1 className="font-hanzi text-6xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          Hanzi Quest
        </h1>
        <p className="max-w-md text-base text-[var(--color-sand-700)]">
          Make your school&apos;s weekly characters playable.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/sign-up"
          className="rounded-full bg-[var(--color-ocean-500)] px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:bg-[var(--color-ocean-700)] active:scale-95"
        >
          Sign up
        </Link>
        <Link
          href="/sign-in"
          className="rounded-full border-2 border-[var(--color-ocean-300)] bg-white px-6 py-3 text-sm font-semibold text-[var(--color-ocean-700)] transition-transform hover:bg-[var(--color-ocean-100)] active:scale-95"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
