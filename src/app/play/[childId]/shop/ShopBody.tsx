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
import { PurchaseConfirmDialog } from '@/components/shop/PurchaseConfirmDialog';
import type { AvatarShopListing, EquippedAvatar, SoundThemeListing, ShopItemRow } from '@/lib/db/shop';
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
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ShopCategory>('avatar');
  const [coinBalance, setCoinBalance] = useState(initialCoinBalance);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(
    () => new Set(initialOwnedShopItemIds),
  );
  const [equipped, setEquipped] = useState<EquippedAvatar>(initialEquipped);
  const [themeFilter, setThemeFilter] = useState<ThemeChipValue>('all');
  const [confirming, setConfirming] = useState<AvatarShopListing | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  const handlePurchase = (listing: AvatarShopListing) => {
    setErrorMessage(null);
    setConfirming(listing);
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
      try {
        await equipAvatarItemAction(listing.avatarItem.id, { childId });
        router.refresh();
      } catch (err) {
        setEquipped(previousEquipped);
        setErrorMessage(err instanceof Error ? err.message : '装备失败');
      }
    });
  };

  const confirmPurchase = () => {
    if (!confirming) return;
    setErrorMessage(null);
    const listing = confirming;
    startTransition(async () => {
      try {
        const result = await purchaseShopItemAction(listing.shopItem.id, {
          childId,
        });
        setOwnedIds(new Set([...ownedIds, listing.shopItem.id]));
        setCoinBalance(result.coinsAfter);
        setConfirming(null);
        router.refresh();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : '购买失败');
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
          ← 地图
        </Link>
        <div className="flex items-center gap-2">
          <AvatarRender
            equipped={equippedRefs}
            size={48}
            label="我的形象"
          />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-amber-900/70">
              船长
            </span>
            <span className="text-sm font-extrabold text-amber-950">海盗商店</span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-amber-300 px-3 py-1 text-base font-bold text-amber-900 shadow-sm">
          <span>🪙</span>
          {coinBalance}
        </span>
      </header>

      <ShopCategoryTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'avatar' && (
        <>
          <ThemeChipStrip selected={themeFilter} onSelect={setThemeFilter} />
          <ShopGrid
            listings={filteredAvatarListings}
            ownedShopItemIds={ownedIds}
            equippedAvatarItemIds={equippedAvatarItemIds}
            coinBalance={coinBalance}
            onPurchase={handlePurchase}
            onEquip={handleEquip}
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

      <PurchaseConfirmDialog
        open={!!confirming}
        listing={confirming}
        coinBalance={coinBalance}
        pending={pending}
        errorMessage={errorMessage}
        onConfirm={confirmPurchase}
        onCancel={() => {
          setConfirming(null);
          setErrorMessage(null);
        }}
      />
    </div>
  );
}
