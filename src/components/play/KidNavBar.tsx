'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMidScene } from './MidSceneProvider';

interface Props {
  childId: string;
  /**
   * 存钱罐 is off by default and opted into per-child by that child's OWN
   * parent, so the tab is absent — not greyed — for a child who cannot have it.
   * Defaults to false: off is the safe default if a caller forgets to pass it.
   */
  piggyEnabled?: boolean;
}

interface TabDef {
  key: string;
  href: string;
  icon: string;
  label: string;
  isActive: (path: string) => boolean;
}

export function KidNavBar({ childId, piggyEnabled = false }: Props) {
  const path = usePathname();
  const router = useRouter();
  const { midScene } = useMidScene();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  const tabs: TabDef[] = [
    {
      key: 'map',
      href: `/play/${childId}`,
      icon: '🏝️',
      label: '地图\nMap',
      isActive: (p) =>
        p === `/play/${childId}` ||
        p.startsWith(`/play/${childId}/week`) ||
        p.startsWith(`/play/${childId}/level`) ||
        p.startsWith(`/play/${childId}/maps`),
    },
    {
      key: 'backpack',
      href: `/play/${childId}/collection`,
      icon: '🎒',
      label: '背包\nBag',
      isActive: (p) => p.startsWith(`/play/${childId}/collection`),
    },
    {
      key: 'calendar',
      href: `/play/${childId}/calendar`,
      icon: '📅',
      label: '日历\nCalendar',
      isActive: (p) => p.startsWith(`/play/${childId}/calendar`),
    },
    {
      key: 'home',
      href: `/play/${childId}/home`,
      icon: '🏠',
      label: '家\nHome',
      isActive: (p) => p.startsWith(`/play/${childId}/home`),
    },
    {
      key: 'shop',
      href: `/play/${childId}/shop`,
      icon: '🛒',
      label: '商店\nShop',
      isActive: (p) => p.startsWith(`/play/${childId}/shop`),
    },
  ];

  // 存钱罐 last: least disruption to existing muscle memory, and it sits next
  // to 商店 — the coin shop and the real-money jar are neighbouring ideas.
  if (piggyEnabled) {
    tabs.push({
      key: 'piggy',
      href: `/play/${childId}/piggy-bank`,
      icon: '🐷',
      label: '存钱罐\nPiggy',
      isActive: (p) => p.startsWith(`/play/${childId}/piggy-bank`),
    });
  }

  function onTabClick(e: React.MouseEvent, href: string, isActive: boolean) {
    if (isActive) return; // no-op when tapping current tab
    if (midScene) {
      e.preventDefault();
      setConfirmTarget(href);
    }
  }

  function renderTab(tab: TabDef) {
    const active = tab.isActive(path);
    return (
      <Link
        key={tab.key}
        href={tab.href}
        prefetch
        aria-current={active ? 'page' : undefined}
        onClick={(e) => onTabClick(e, tab.href, active)}
        data-testid={`nav-tab-${tab.key}`}
        className="flex min-w-[44px] flex-col items-center gap-0.5 px-1 py-1 transition-colors"
      >
        <span className="text-2xl leading-none">{tab.icon}</span>
        <span
          className={
            active
              ? 'whitespace-pre-line text-center text-[10px] font-bold leading-tight text-[var(--color-ocean-700)]'
              : 'whitespace-pre-line text-center text-[10px] font-medium leading-tight text-[var(--color-sand-600)]'
          }
        >
          {tab.label}
        </span>
        <span
          className={
            active
              ? 'h-1 w-1 rounded-full bg-[var(--color-ocean-700)]'
              : 'h-1 w-1 rounded-full bg-transparent'
          }
        />
      </Link>
    );
  }

  const gearLink = (
    <Link
      href="/parent"
      aria-label="设置 / Settings"
      className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-sand-500)] transition-colors hover:text-[var(--color-sand-700)]"
    >
      <span className="text-lg">⚙️</span>
    </Link>
  );

  return (
    <>
      {/* One nav that morphs: bottom tab bar on phones, left rail on landscape (lg+).
          Single DOM tree (no duplicate links) — the bar↔rail switch is pure CSS. */}
      <nav
        data-testid="kid-nav"
        className="sticky bottom-0 z-30 flex items-center justify-around border-t border-[var(--color-sand-200)] bg-white/85 px-2 pb-[max(env(safe-area-inset-bottom),0px)] pt-2 backdrop-blur-md lg:fixed lg:bottom-0 lg:left-0 lg:top-0 lg:w-20 lg:flex-col lg:justify-start lg:gap-1 lg:border-r lg:border-t-0 lg:px-0 lg:pb-3 lg:pt-3"
        aria-label="Kid navigation"
      >
        {tabs.map((tab) => renderTab(tab))}
        <span className="ml-1 lg:ml-0 lg:mt-auto">{gearLink}</span>
      </nav>
      {confirmTarget && (
        <QuitConfirmDialog
          target={confirmTarget}
          onStay={() => setConfirmTarget(null)}
          onQuit={() => {
            const t = confirmTarget;
            setConfirmTarget(null);
            router.push(t);
          }}
        />
      )}
    </>
  );
}

function QuitConfirmDialog({
  onStay,
  onQuit,
}: {
  target: string;
  onStay: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="font-hanzi text-xl font-bold text-[var(--color-ocean-900)]">
          结束这一关? Quit this level?
        </h2>
        <p className="mt-2 text-sm text-[var(--color-sand-700)]">
          进度会保留 / Progress will be saved.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onStay}
            className="rounded-full bg-[var(--color-ocean-500)] px-5 py-2 text-sm font-bold text-white shadow-md active:scale-95"
          >
            继续 / Stay
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="rounded-full border-2 border-[var(--color-sand-300)] bg-white px-5 py-2 text-sm font-bold text-[var(--color-sand-700)] active:scale-95"
          >
            结束 / Quit
          </button>
        </div>
      </div>
    </div>
  );
}
