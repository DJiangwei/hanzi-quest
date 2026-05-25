import { redirect } from 'next/navigation';
import { ensureUserBootstrapped } from '@/lib/auth/bootstrap';
import { getParentSettings } from '@/lib/db/parent-settings';
import { ParentUnlockForm } from './ParentUnlockForm';

interface PageProps {
  searchParams: Promise<{ next?: string; reset?: string }>;
}

export default async function ParentUnlockPage({ searchParams }: PageProps) {
  const user = await ensureUserBootstrapped();
  if (!user) redirect('/sign-in');

  const { next, reset } = await searchParams;
  const settings = await getParentSettings(user.id);
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
    </main>
  );
}
