import { Show } from '@clerk/nextjs';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('Home');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-5xl font-bold tracking-tight">{t('title')}</h1>
      <p className="max-w-md text-lg text-zinc-500">{t('subtitle')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Show when="signed-out">
          <Link
            href="/sign-up"
            className="rounded bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Sign up
          </Link>
          <Link
            href="/sign-in"
            className="rounded border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Sign in
          </Link>
        </Show>
        <Show when="signed-in">
          <Link
            href="/parent"
            className="rounded bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Open parent dashboard →
          </Link>
        </Show>
      </div>
    </main>
  );
}
