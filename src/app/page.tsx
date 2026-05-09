import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('Home');

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center gap-3">
      <h1 className="text-5xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-lg text-zinc-500 max-w-md">{t('subtitle')}</p>
      <p className="mt-8 text-xs uppercase tracking-widest text-zinc-400">
        {t('phase')}
      </p>
    </main>
  );
}
