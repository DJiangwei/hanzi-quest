import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireChild } from '@/lib/auth/guards';
import { ZodiacIconDefs } from '@/components/play/zodiac-icons';
import { ShopHudButton } from '@/components/play/ShopHudButton';
import { SoundThemeBootstrap } from '@/components/play/SoundThemeBootstrap';
import { getChildSettings } from '@/lib/db/settings';

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

  const settings = await getChildSettings(childId);
  const themeSlug = settings?.soundThemeSlug ?? null;

  return (
    <div
      className="flex min-h-full flex-1 flex-col text-[var(--color-ocean-900)]"
      style={{
        background:
          'linear-gradient(to bottom, var(--color-ocean-100) 0%, var(--color-sand-50) 60%, var(--color-treasure-100) 100%)',
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/60 bg-white/50 px-4 py-2 backdrop-blur">
        <Link
          href="/parent"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ocean-700)] hover:text-[var(--color-ocean-900)]"
        >
          ← Parent
        </Link>
        <span className="font-hanzi text-base font-bold tracking-wide text-[var(--color-ocean-900)]">
          汉字探险
        </span>
        <ShopHudButton childId={childId} />
      </header>
      {/* Mounted once at the layout level so any descendant (collection page,
          treasure-chest reveal, future zodiac sticker) can <use href="#z-xxx" />
          without each page worrying about defs visibility. */}
      <ZodiacIconDefs />
      <SoundThemeBootstrap themeSlug={themeSlug} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
