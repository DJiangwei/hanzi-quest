import { Show } from '@clerk/nextjs';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('Home');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-[var(--color-sand-50)] px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="rounded-full bg-[var(--color-ocean-100)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ocean-700)]">
          For the 海盗班 crew
        </span>
        <h1 className="font-hanzi text-6xl font-bold tracking-tight text-[var(--color-ocean-900)]">
          {t('title')}
        </h1>
        <p className="max-w-md text-base text-[var(--color-sand-700)]">
          {t('subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Show when="signed-out">
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
        </Show>
        <Show when="signed-in">
          <Link
            href="/parent"
            className="rounded-full bg-[var(--color-ocean-500)] px-7 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:bg-[var(--color-ocean-700)] active:scale-95"
          >
            Open parent dashboard →
          </Link>
        </Show>
      </div>
    </main>
  );
}
