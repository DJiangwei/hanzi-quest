'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getFurniture,
  FURNITURE_CATALOG,
  HOME_FURNITURE_COPY_CAP,
} from '@/lib/home/furniture-catalog';
import { ROOM_DEFAULT_SURFACES } from '@/lib/home/surfaces';
import { HOME_ROOMS, type HomeRoomId } from '@/lib/home/rooms';
import { canPlaceAt, type PlacedLite } from '@/lib/home/placement-rules';
import {
  confirmState,
  PLACE_LABEL,
  DISABLED_LABEL,
  buyLabel,
  type ConfirmState,
} from '@/lib/home3d/confirm-bar';
import { resolvePieceSelection, selectionFromPlaceParam } from '@/lib/home3d/piece-selection';
import { buyAndPlaceFurnitureAction, type BuyAndPlaceOutcome } from '@/lib/actions/home';
import { Room3DMount } from './Room3DMount';
import type { Placed3D, GhostSpec } from './HomeRoom3D';
import type { HomePlacement } from '@/lib/db/home';
import type { ShopItemRow } from '@/lib/db/shop';

export interface RoomSurfacePair {
  wallpaperSlug: string;
  floorSlug: string;
}

/** What is currently ghosted, waiting for a cell + a confirm tap. */
interface Selected {
  slug: string;
  w: number;
  h: number;
  copyIndex: number;
  /** null = placing a copy she already owns — no purchase. */
  shopItemId: string | null;
  priceCoins: number;
}

/** Quiet, non-scolding text for a tray chip that has nothing to offer today. */
const UNAVAILABLE_NOTE = '暂时买不到 / not available';

/** Button label when a piece is selected but no floor cell is chosen yet. */
const NO_CELL_LABEL = '👇 先选个格子 / Pick a spot first';

function outcomeNotice(outcome: BuyAndPlaceOutcome): string | null {
  switch (outcome.status) {
    case 'placed':
      return null;
    case 'insufficient':
      return '🪙 金币不够啦 / Not enough coins';
    case 'occupied':
      return '这里被占了 / That spot is taken now';
    case 'already_owned':
      return '你已经拥有了 / You already own this';
    case 'illegal':
      return '换个位置试试 / Try a different spot';
  }
}

/**
 * The 3D home — now a real editor, not just a view.
 *
 * **Buy and place are ONE act.** Tap a piece, it appears as a translucent
 * ghost on the floor, drag/tap a cell (green = legal, red = illegal), and
 * one confirm buys it (if she doesn't own a spare copy) AND places it, in
 * one server transaction (`buyAndPlaceFurnitureAction`). The 2D room keeps
 * its own tap-to-place editor — this is additive, not a replacement, so a
 * WebGL failure on her iPad still leaves a decorated, editable home.
 *
 * Legality is `canPlaceAt` — the SAME pure function the server calls inside
 * `placeFurnitureInTx` — so the ghost can never promise a cell the action
 * then rejects.
 */
export function Room3DPanel({
  childId,
  placements,
  roomSurfaces,
  ownedSlugs,
  homeShopItems,
  coinBalance,
}: {
  childId: string;
  placements: HomePlacement[];
  roomSurfaces?: Record<string, RoomSurfacePair>;
  /** Owned furniture slugs WITH multiplicity — one entry per owned copy. */
  ownedSlugs: string[];
  /** kind='home' shop_items rows — the id + price a purchase needs. */
  homeShopItems: ShopItemRow[];
  coinBalance: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [room, setRoom] = useState<HomeRoomId>('bedroom');
  // Arm the piece the shop sent us, once, from `?place=<slug>`. A lazy
  // initializer rather than an effect: there is nothing to re-fire, and it
  // cannot fight react-hooks/set-state-in-effect. An unknown or now-maxed slug
  // simply opens the room with no ghost.
  const placeParam = searchParams.get('place');
  const [selected, setSelected] = useState<Selected | null>(() => {
    const armed = selectionFromPlaceParam({
      slug: placeParam,
      ownedSlugs,
      shopItemIdBySlug: new Map(homeShopItems.map((i) => [i.slug, i.id])),
      placedCopyIndicesBySlug: placements.reduce((m, p) => {
        m.set(p.slug, [...(m.get(p.slug) ?? []), p.copyIndex]);
        return m;
      }, new Map<string, number[]>()),
      copyCap: HOME_FURNITURE_COPY_CAP,
    });
    if (!armed) return null;
    const def = getFurniture(armed.slug);
    if (!def) return null;
    const shopItem = homeShopItems.find((i) => i.slug === armed.slug) ?? null;
    return {
      slug: armed.slug,
      w: def.footprint.w,
      h: def.footprint.h,
      copyIndex: armed.copyIndex,
      shopItemId: armed.shopItemId,
      priceCoins: shopItem?.priceCoins ?? def.priceCoins,
    };
  });
  const [ghostCell, setGhostCell] = useState<{ gridX: number; gridY: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shopItemBySlug = useMemo(
    () => new Map(homeShopItems.map((item) => [item.slug, item])),
    [homeShopItems],
  );
  const ownedCountBySlug = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of ownedSlugs) m.set(s, (m.get(s) ?? 0) + 1);
    return m;
  }, [ownedSlugs]);
  // Copy identity (childId, slug, copyIndex) is GLOBAL across rooms — a
  // spare copy must dodge every placement of the slug, not just this room's.
  const placedCopyIndicesBySlug = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const p of placements) {
      const arr = m.get(p.slug);
      if (arr) arr.push(p.copyIndex);
      else m.set(p.slug, [p.copyIndex]);
    }
    return m;
  }, [placements]);

  const placed: Placed3D[] = placements
    .filter((p) => p.room === room)
    .flatMap((p) => {
      const def = getFurniture(p.slug);
      // A placement whose slug has no catalog entry is skipped, not defaulted:
      // guessing a footprint would put it through a wall.
      if (!def) return [];
      return [
        {
          slug: p.slug,
          gridX: p.x,
          gridY: p.y,
          w: def.footprint.w,
          h: def.footprint.h,
          surface: def.surface,
        },
      ];
    });

  // canPlaceAt's collision check is room-scoped — a placement in the yard
  // can't block a cell in the bedroom.
  const placedInRoom: PlacedLite[] = useMemo(
    () =>
      placements
        .filter((p) => p.room === room)
        .map((p) => ({ slug: p.slug, copyIndex: p.copyIndex, gridX: p.x, gridY: p.y })),
    [placements, room],
  );

  const legal = useMemo(() => {
    if (!selected || !ghostCell) return false;
    return canPlaceAt(
      room,
      selected.slug,
      ghostCell.gridX,
      ghostCell.gridY,
      placedInRoom,
      selected.copyIndex,
    ).ok;
  }, [selected, ghostCell, room, placedInRoom]);

  const confirm: ConfirmState | null =
    selected && ghostCell
      ? confirmState({
          legal,
          owned: selected.shopItemId === null,
          priceCoins: selected.priceCoins,
          coins: coinBalance,
        })
      : null;

  const clearSelection = useCallback(() => {
    setSelected(null);
    setGhostCell(null);
  }, []);

  const handleSwitchRoom = useCallback(
    (r: HomeRoomId) => {
      setRoom(r);
      clearSelection();
      setNotice(null);
    },
    [clearSelection],
  );

  /** Tap a tray piece → ghost it, or toggle it off if already selected. */
  const handlePieceTap = useCallback(
    (slug: string) => {
      setNotice(null);
      if (selected?.slug === slug) {
        clearSelection();
        return;
      }
      const def = getFurniture(slug);
      if (!def) return;
      const shopItem = shopItemBySlug.get(slug) ?? null;
      const resolved = resolvePieceSelection({
        ownedCount: ownedCountBySlug.get(slug) ?? 0,
        placedCopyIndices: placedCopyIndicesBySlug.get(slug) ?? [],
        shopItemId: shopItem?.id ?? null,
        copyCap: HOME_FURNITURE_COPY_CAP,
      });
      if (!resolved) return; // maxed with no spare, or not sold — nothing to hand her
      setSelected({
        slug,
        w: def.footprint.w,
        h: def.footprint.h,
        copyIndex: resolved.copyIndex,
        shopItemId: resolved.shopItemId,
        priceCoins: shopItem?.priceCoins ?? def.priceCoins,
      });
      setGhostCell(null);
    },
    [selected, clearSelection, shopItemBySlug, ownedCountBySlug, placedCopyIndicesBySlug],
  );

  const handleFloorPick = useCallback((gridX: number, gridY: number) => {
    setNotice(null);
    setGhostCell({ gridX, gridY });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected || !ghostCell || !confirm || confirm.kind === 'disabled' || pending) return;
    const { slug, copyIndex, shopItemId } = selected;
    const { gridX, gridY } = ghostCell;
    startTransition(async () => {
      const outcome = await buyAndPlaceFurnitureAction(
        childId,
        room,
        slug,
        gridX,
        gridY,
        copyIndex,
        shopItemId,
      );
      if (outcome.status === 'placed') {
        clearSelection();
        setNotice(null);
        router.refresh();
      } else {
        setNotice(outcomeNotice(outcome));
      }
    });
  }, [selected, ghostCell, confirm, pending, childId, room, clearSelection, router]);

  const ghost: GhostSpec | undefined =
    selected && ghostCell
      ? {
          slug: selected.slug,
          gridX: ghostCell.gridX,
          gridY: ghostCell.gridY,
          w: selected.w,
          h: selected.h,
          legal,
        }
      : undefined;

  const selectedDef = selected ? getFurniture(selected.slug) : undefined;

  // The two sources spell the same thing differently — the DB row is
  // { wallpaperSlug, floorSlug } and the catalog default is
  // { wallpaper, floor }. Normalised here rather than guessing one shape.
  const equipped = roomSurfaces?.[room];
  const fallback = ROOM_DEFAULT_SURFACES[room];
  const wallpaperSlug = equipped?.wallpaperSlug ?? fallback?.wallpaper;
  const floorSlug = equipped?.floorSlug ?? fallback?.floor;

  return (
    <div className="flex flex-col gap-2" data-testid="room-3d-panel">
      <div className="flex flex-wrap gap-1.5">
        {HOME_ROOMS.map((r) => (
          <button
            key={r.id}
            type="button"
            data-testid={`room-3d-tab-${r.id}`}
            onClick={() => handleSwitchRoom(r.id)}
            aria-pressed={room === r.id}
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${
              room === r.id
                ? 'border-amber-400 bg-amber-100 text-amber-900'
                : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            <span aria-hidden>{r.emoji}</span>{' '}
            <span className="font-hanzi">{r.nameZh}</span>{' '}
            <span className="italic">/ {r.nameEn}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border-2 border-amber-200 shadow-sm">
        <Room3DMount
          key={room}
          placements={placed}
          wallpaperSlug={wallpaperSlug}
          floorSlug={floorSlug}
          ghost={ghost}
          onFloorPick={handleFloorPick}
        />
      </div>

      {selected && selectedDef ? (
        <div className="flex flex-col gap-1.5" data-testid="confirm-bar">
          {notice ? (
            <p className="text-center text-xs text-[var(--color-sunset-700)]">{notice}</p>
          ) : (
            <p className="text-center text-xs text-[var(--color-sand-600)]">
              点一下地板选个格子 / Tap the floor to choose a spot
            </p>
          )}
          <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-amber-200 bg-white/90 p-2 shadow-sm">
            <span className="min-w-0 truncate text-sm">
              <span className="font-hanzi font-bold text-stone-800">{selectedDef.nameZh}</span>{' '}
              <span className="italic text-stone-500">/ {selectedDef.nameEn}</span>
            </span>
            <button
              type="button"
              data-testid="confirm-place"
              disabled={!confirm || confirm.kind === 'disabled' || pending}
              onClick={handleConfirm}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition ${
                confirm && confirm.kind !== 'disabled'
                  ? 'bg-amber-300 text-amber-900 active:scale-95'
                  : 'bg-stone-100 text-stone-400'
              }`}
            >
              {!confirm
                ? selected && !ghostCell
                  ? NO_CELL_LABEL
                  : DISABLED_LABEL.illegal
                : confirm.kind === 'place'
                  ? PLACE_LABEL
                  : confirm.kind === 'buy'
                    ? buyLabel(confirm.priceCoins)
                    : DISABLED_LABEL[confirm.why]}
            </button>
          </div>
        </div>
      ) : null}

      {/* Piece tray — every catalog item, owned or not. Tapping one starts
          the ghost; the badge tells her what tapping again will do. */}
      <div
        data-testid="piece-tray"
        className="flex gap-2 overflow-x-auto pb-1"
        role="listbox"
        aria-label="要放的家具 / Furniture to place"
      >
        {FURNITURE_CATALOG.map((def) => {
          const shopItem = shopItemBySlug.get(def.slug);
          const ownedCount = ownedCountBySlug.get(def.slug) ?? 0;
          const placedIdx = placedCopyIndicesBySlug.get(def.slug) ?? [];
          const spare = ownedCount - placedIdx.length;
          const resolved = resolvePieceSelection({
            ownedCount,
            placedCopyIndices: placedIdx,
            shopItemId: shopItem?.id ?? null,
            copyCap: HOME_FURNITURE_COPY_CAP,
          });
          const isSelected = selected?.slug === def.slug;
          const tappable = resolved !== null;

          return (
            <button
              key={def.slug}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-testid={`piece-tray-${def.slug}`}
              disabled={!tappable}
              onClick={() => handlePieceTap(def.slug)}
              className={[
                'relative flex min-h-[44px] min-w-[52px] shrink-0 flex-col items-center justify-center rounded-xl border-2 px-2 py-1.5 text-xs transition-colors',
                isSelected
                  ? 'border-[var(--color-treasure-500)] bg-[var(--color-treasure-50)] shadow-md'
                  : tappable
                    ? 'border-[var(--color-sand-200)] bg-white/80 hover:bg-white'
                    : 'border-stone-100 bg-stone-50 opacity-60',
              ].join(' ')}
            >
              {spare > 0 ? (
                <span
                  data-testid={`piece-tray-spare-${def.slug}`}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
                >
                  ×{spare}
                </span>
              ) : resolved && resolved.shopItemId ? (
                <span
                  data-testid={`piece-tray-price-${def.slug}`}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 shadow"
                >
                  🪙{shopItem?.priceCoins ?? def.priceCoins}
                </span>
              ) : null}
              <svg
                width={32}
                height={32}
                viewBox={`0 0 ${def.footprint.w * 12.5} ${def.footprint.h * 12.5}`}
                aria-hidden
              >
                <def.Component />
              </svg>
              <span className="mt-0.5 text-center font-hanzi leading-tight">{def.nameZh}</span>
              <span className="text-center text-[9px] leading-tight text-[var(--color-sand-600)]">
                {tappable ? def.nameEn : UNAVAILABLE_NOTE}
              </span>
            </button>
          );
        })}
      </div>

      {placed.length === 0 && !selected ? (
        <p className="text-center text-xs text-[var(--color-sand-700)]">
          <span className="font-hanzi">这个房间还没摆东西。</span>{' '}
          <span className="italic">/ Nothing placed in this room yet.</span>
        </p>
      ) : null}
    </div>
  );
}
