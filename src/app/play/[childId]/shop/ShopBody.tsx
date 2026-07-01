'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AvatarRender } from '@/components/play/AvatarRender';
import { ShopCategoryTabs, type ShopCategory } from '@/components/shop/ShopCategoryTabs';
import { ShopGrid } from '@/components/shop/ShopGrid';
import { ThemeChipStrip, type ThemeChipValue } from '@/components/shop/ThemeChipStrip';
import { SoundsTabBody } from '@/components/shop/SoundsTabBody';
import { PetsTabBody } from '@/components/shop/PetsTabBody';
import { DecorTabBody } from '@/components/shop/DecorTabBody';
import { HomeTabBody } from '@/components/shop/HomeTabBody';
import { PowerupsTabBody } from '@/components/shop/PowerupsTabBody';
import { AvatarTryOnPreview, type TryOnState } from '@/components/shop/AvatarTryOnPreview';
import { RewardWardrobe } from '@/components/shop/RewardWardrobe';
import { ShopToast } from '@/components/shop/ShopToast';
import type { ShopFeedback } from '@/lib/hooks/use-shop-purchase';
import type {
  AvatarShopListing,
  EquippedAvatar,
  SoundThemeListing,
  ShopItemRow,
  RewardCosmeticListing,
} from '@/lib/db/shop';
import type { PetShopListing } from '@/lib/db/pets';
import type { DecorShopListing } from '@/lib/db/decor';
import type { PowerupShopListing, PowerupCounts } from '@/lib/db/powerups';
import { lookupItem } from '@/lib/avatar/itemCatalog';
import {
  equipAvatarItemAction,
  purchaseShopItemAction,
} from '@/lib/actions/shop';

interface Props {
  childId: string;
  initialCoinBalance: number;
  listings: AvatarShopListing[];
  initialOwnedShopItemIds: string[];
  initialEquipped: EquippedAvatar;
  soundListings: SoundThemeListing[];
  initialEquippedSoundThemeSlug: string | null;
  petListings: PetShopListing[];
  initialEquippedPetSlug: string | null;
  decorListings: DecorShopListing[];
  powerupListings: PowerupShopListing[];
  powerupCounts: PowerupCounts;
  homeShopItems: ShopItemRow[];
  rewardCosmetics: RewardCosmeticListing[];
}

export function ShopBody({
  childId,
  initialCoinBalance,
  listings,
  initialOwnedShopItemIds,
  initialEquipped,
  soundListings,
  initialEquippedSoundThemeSlug,
  petListings,
  initialEquippedPetSlug,
  decorListings,
  powerupListings,
  powerupCounts,
  homeShopItems,
  rewardCosmetics,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ShopCategory>('avatar');
  const [coinBalance, setCoinBalance] = useState(initialCoinBalance);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(
    () => new Set(initialOwnedShopItemIds),
  );
  const [equipped, setEquipped] = useState<EquippedAvatar>(initialEquipped);
  const [themeFilter, setThemeFilter] = useState<ThemeChipValue>('all');
  const [tryOn, setTryOn] = useState<TryOnState | null>(null);
  const [cosmetics, setCosmetics] = useState<RewardCosmeticListing[]>(rewardCosmetics);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [purchaseFeedback, setPurchaseFeedback] = useState<ShopFeedback | null>(null);
  const [pending, startTransition] = useTransition();

  // Switching category tabs discards any ephemeral try-on.
  const changeTab = (t: ShopCategory) => {
    setTryOn(null);
    setActiveTab(t);
  };

  const equippedAvatarItemIds = new Set(
    Object.values(equipped).map((s) => s.avatarItemId),
  );

  const filteredAvatarListings = listings.filter((listing) => {
    if (themeFilter === 'all') return true;
    const meta = lookupItem(listing.avatarItem.unlockRef ?? '');
    if (!meta) return true; // unknown items always visible (safe fallback)
    return meta.theme === themeFilter;
  });

  const equippedRefs: Partial<Record<string, string | null>> = {};
  for (const [slot, info] of Object.entries(equipped)) {
    equippedRefs[slot] = info.unlockRef;
  }

  // Tapping an UNOWNED item tries it on (no server call). Free even when the
  // kid can't afford it yet — the Buy bar handles affordability.
  const handleTryOn = (listing: AvatarShopListing) => {
    const catalogItem = lookupItem(listing.avatarItem.unlockRef);
    if (!catalogItem) return;
    setErrorMessage(null);
    setTryOn({ slot: catalogItem.slot, listing });
  };

  const handleEquip = (listing: AvatarShopListing) => {
    setErrorMessage(null);
    startTransition(async () => {
      const previousEquipped = equipped;
      const catalogItem = lookupItem(listing.avatarItem.unlockRef);
      if (catalogItem) {
        setEquipped({
          ...equipped,
          [catalogItem.slot]: {
            avatarItemId: listing.avatarItem.id,
            unlockRef: listing.avatarItem.unlockRef,
            slotId: listing.avatarItem.slotId,
            isDefault: false,
          },
        });
      }
      setTryOn(null); // equipping an owned item ends the try-on
      try {
        await equipAvatarItemAction(listing.avatarItem.id, { childId });
        router.refresh();
      } catch (err) {
        setEquipped(previousEquipped);
        setErrorMessage(err instanceof Error ? err.message : '装备失败 / Equip failed');
      }
    });
  };

  // Re-equip a festival wardrobe cosmetic (already owned — no purchase).
  const handleEquipCosmetic = (c: RewardCosmeticListing) => {
    if (c.equipped) return;
    setErrorMessage(null);
    const previousEquipped = equipped;
    const previousCosmetics = cosmetics;
    setEquipped({
      ...equipped,
      [c.slotId]: {
        avatarItemId: c.avatarItemId,
        unlockRef: c.unlockRef,
        slotId: c.slotId,
        isDefault: false,
      },
    });
    // Only one cosmetic per slot can be worn — clear the flag on same-slot peers.
    setCosmetics((prev) =>
      prev.map((x) => ({
        ...x,
        equipped:
          x.avatarItemId === c.avatarItemId
            ? true
            : x.slotId === c.slotId
              ? false
              : x.equipped,
      })),
    );
    startTransition(async () => {
      try {
        await equipAvatarItemAction(c.avatarItemId, { childId });
        router.refresh();
      } catch (err) {
        setEquipped(previousEquipped);
        setCosmetics(previousCosmetics);
        setErrorMessage(err instanceof Error ? err.message : '装备失败 / Equip failed');
      }
    });
  };

  // Buy the currently-tried item, then equip it (try-on → owned + worn).
  const handleBuyTryOn = () => {
    if (!tryOn) return;
    const listing = tryOn.listing;
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await purchaseShopItemAction(listing.shopItem.id, { childId });
        if (res.status !== 'purchased') {
          // already_owned / insufficient — friendly toast, don't equip or clear.
          setPurchaseFeedback({
            kind: res.status === 'already_owned' ? 'owned' : 'insufficient',
          });
          return;
        }
        setOwnedIds(new Set([...ownedIds, listing.shopItem.id]));
        setCoinBalance((prev) => Math.max(0, prev - listing.shopItem.priceCoins));
        const catalogItem = lookupItem(listing.avatarItem.unlockRef);
        if (catalogItem) {
          setEquipped((prev) => ({
            ...prev,
            [catalogItem.slot]: {
              avatarItemId: listing.avatarItem.id,
              unlockRef: listing.avatarItem.unlockRef,
              slotId: listing.avatarItem.slotId,
              isDefault: false,
            },
          }));
        }
        await equipAvatarItemAction(listing.avatarItem.id, { childId });
        setTryOn(null);
        setPurchaseFeedback({ kind: 'success' });
        router.refresh();
      } catch {
        setPurchaseFeedback({ kind: 'error' });
      }
    });
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-2 border-b-2 border-amber-800/30 bg-amber-100/60 px-3 py-3 backdrop-blur">
        <Link
          href={`/play/${childId}`}
          className="rounded-lg border-2 border-amber-800/40 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
        >
          ← 地图 / Map
        </Link>
        <div className="flex items-center gap-2">
          <AvatarRender
            equipped={equippedRefs}
            size={48}
            label="我的形象 / My avatar"
          />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-amber-900/70">
              船长
            </span>
            <span className="text-sm font-extrabold text-amber-950">海盗商店 / Pirate Shop</span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-amber-300 px-3 py-1 text-base font-bold text-amber-900 shadow-sm">
          <span>🪙</span>
          {coinBalance}
        </span>
      </header>

      <ShopCategoryTabs active={activeTab} onChange={changeTab} />

      {activeTab === 'avatar' && (
        <ShopToast
          feedback={purchaseFeedback}
          onDone={() => setPurchaseFeedback(null)}
        />
      )}

      {activeTab === 'avatar' && (
        <>
          <AvatarTryOnPreview
            equippedRefs={equippedRefs}
            tryOn={tryOn}
            owned={tryOn ? ownedIds.has(tryOn.listing.shopItem.id) : false}
            coinBalance={coinBalance}
            pending={pending}
            onBuy={handleBuyTryOn}
            onClearTryOn={() => setTryOn(null)}
          />
          {errorMessage && (
            <div className="px-4 pt-2 text-center text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}
          <ThemeChipStrip selected={themeFilter} onSelect={setThemeFilter} />
          <ShopGrid
            listings={filteredAvatarListings}
            ownedShopItemIds={ownedIds}
            equippedAvatarItemIds={equippedAvatarItemIds}
            coinBalance={coinBalance}
            tryingShopItemId={tryOn?.listing.shopItem.id ?? null}
            onPurchase={handleTryOn}
            onEquip={handleEquip}
          />
          <RewardWardrobe
            cosmetics={cosmetics}
            pending={pending}
            onEquip={handleEquipCosmetic}
          />
        </>
      )}
      {activeTab === 'sound' && (
        <SoundsTabBody
          childId={childId}
          listings={soundListings}
          ownedShopItemIds={ownedIds}
          coinBalance={coinBalance}
          equippedThemeSlug={initialEquippedSoundThemeSlug}
        />
      )}
      {activeTab === 'pet' && (
        <PetsTabBody
          childId={childId}
          listings={petListings}
          ownedShopItemIds={ownedIds}
          coinBalance={coinBalance}
          equippedPetSlug={initialEquippedPetSlug}
        />
      )}
      {activeTab === 'decor' && (
        <DecorTabBody
          childId={childId}
          listings={decorListings}
          ownedShopItemIds={ownedIds}
          coinBalance={coinBalance}
        />
      )}
      {activeTab === 'powerup' && (
        <PowerupsTabBody
          childId={childId}
          listings={powerupListings}
          powerupCounts={powerupCounts}
          coinBalance={coinBalance}
        />
      )}
      {activeTab === 'home' && (
        <HomeTabBody
          childId={childId}
          homeShopItems={homeShopItems}
          ownedShopItemIds={ownedIds}
          coinBalance={coinBalance}
        />
      )}
    </div>
  );
}
