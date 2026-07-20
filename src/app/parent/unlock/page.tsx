import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';
import { listChildrenForUser } from '@/lib/db/children';
import { chooseKidEntryAction } from '@/lib/actions/entry';
import { ParentUnlockForm } from './ParentUnlockForm';

interface PageProps {
  searchParams: Promise<{ next?: string; reset?: string }>;
}

export default async function ParentUnlockPage({ searchParams }: PageProps) {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');

  const { next, reset } = await searchParams;
  const [settings, children] = await Promise.all([
    getParentSettings(user.id),
    listChildrenForUser(user.id),
  ]);
  const mode: 'set' | 'verify' = !settings || reset === '1' ? 'set' : 'verify';

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <h1 className="font-hanzi text-2xl font-bold text-[var(--color-ocean-900)]">
        {mode === 'set' ? '设置 PIN / Set parent PIN' : '输入 PIN / Enter parent PIN'}
      </h1>
      <p className="max-w-xs text-sm text-[var(--color-sand-700)]">
        {mode === 'set'
          ? '设置一个 4 位数字 PIN，保护父母工作台不被误点。'
          : '输入 4 位数字 PIN，进入父母工作台。'}
      </p>
      <ParentUnlockForm mode={mode} next={next ?? '/parent'} />

      {/* Kid escape hatch: the PIN gate must never dead-end a child holding
          the device. Entering the game here also flips the remembered entry
          cookie to 'kid', so future logins land in the game directly. */}
      {children.length > 0 && (
        <section
          data-testid="unlock-kid-entry"
          className="mt-2 flex w-full max-w-xs flex-col gap-2 border-t border-[var(--color-sand-200)] pt-5"
        >
          <p className="text-xs font-semibold text-[var(--color-sand-700)]">
            <span className="font-hanzi">孩子玩游戏,不用 PIN</span>
            <span> / Kids play without a PIN</span>
          </p>
          {children.map((c) => (
            <form key={c.id} action={chooseKidEntryAction.bind(null, c.id)}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-ocean-500)] px-5 py-3 font-bold text-white shadow-md transition-transform hover:bg-[var(--color-ocean-700)] active:scale-[0.98]"
              >
                <span aria-hidden>🎮</span>
                <span className="font-hanzi">开始游戏</span>
                <span className="text-sm font-medium opacity-90">
                  / Play{children.length > 1 ? ` · ${c.displayName}` : ''}
                </span>
              </button>
            </form>
          ))}
        </section>
      )}
    </main>
  );
}
