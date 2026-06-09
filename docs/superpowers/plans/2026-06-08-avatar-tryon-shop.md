# Avatar Try-On Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans.

**Goal:** Big avatar atop the avatar shop tab; tap any item → preview on her avatar; owned→equip, unowned→try-on + a 购买/Buy bar that purchases & wears on confirm; try-on is ephemeral.

**Architecture:** Add a `tryOn` state to `ShopBody` (the avatar section). The big `AvatarRender` shows `equippedRefs` with the tried slot overridden. `ShopGrid`'s non-owned tap (`onPurchase`) becomes "try on" (sets `tryOn`, no server call); owned tap equips + clears `tryOn`. A `AvatarTryOnPreview` component renders the big avatar + contextual Buy bar. Retire the avatar `PurchaseConfirmDialog` usage. Spec: `docs/superpowers/specs/2026-06-08-avatar-tryon-shop-design.md`.

**Tech:** React 19, existing `AvatarRender`, `equipAvatarItemAction`, `purchaseShopItemAction`, `lookupItem`. Bilingual (`中文 / English`). No DB change.

---

## Task 1: `AvatarTryOnPreview` component + test

**Files:** Create `src/components/shop/AvatarTryOnPreview.tsx`; Test `tests/unit/avatar-tryon-preview.test.tsx`

Props:
```ts
interface Props {
  equippedRefs: Partial<Record<string, string | null>>;
  tryOn: { slot: string; listing: AvatarShopListing } | null;
  owned: boolean;          // is the tried item already owned (then no Buy bar)
  coinBalance: number;
  pending: boolean;
  onBuy: () => void;
  onClearTryOn: () => void;
}
```
Behavior:
- Compose `composite = { ...equippedRefs }`; if `tryOn`, `composite[tryOn.slot] = tryOn.listing.avatarItem.unlockRef`.
- Render `<AvatarRender equipped={composite} size={200} label="试穿预览 / Try-on preview" />` centered, responsive (`max-w` wrapper).
- When `tryOn && !owned`: a Buy bar with the item name (`shopItem.name`, already bilingual), price `🪙 N`, and:
  - affordable (`coinBalance >= price`): enabled `购买 / Buy · 🪙{price}` button → `onBuy`; plus a `卸下 / Take off` ghost button → `onClearTryOn`.
  - unaffordable: disabled Buy + helper `再赚 {n} 个金币 / Earn {n} more coins`.
- When no `tryOn` (or owned): no Buy bar (just the big avatar).

- [ ] **Step 1: Test** — render with a `tryOn` unowned + affordable: asserts the big avatar exists (`data-testid` on wrapper), Buy button shows bilingual `/购买|Buy/` + price, and clicking it calls `onBuy`. Render unaffordable → Buy disabled + helper text. Render `tryOn=null` → no Buy button.
- [ ] **Step 2:** Run → FAIL (no component).
- [ ] **Step 3:** Implement the component (full code per above; `data-testid="tryon-preview"` on the root, `data-testid="tryon-buy"` on the Buy button).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit.

---

## Task 2: Wire try-on into `ShopBody`

**Files:** Modify `src/app/play/[childId]/shop/ShopBody.tsx`

- [ ] **Step 1:** Add state + reset:
```tsx
const [tryOn, setTryOn] = useState<{ slot: string; listing: AvatarShopListing } | null>(null);
// reset on tab switch:
const changeTab = (t: ShopCategory) => { setTryOn(null); setActiveTab(t); };
// use changeTab in <ShopCategoryTabs onChange={changeTab} />
```

- [ ] **Step 2:** Replace `handlePurchase` (which opened the dialog) with try-on:
```tsx
const handleTryOn = (listing: AvatarShopListing) => {
  const meta = lookupItem(listing.avatarItem.unlockRef);
  if (!meta) return;
  setErrorMessage(null);
  setTryOn({ slot: meta.slot, listing });
};
```
In `handleEquip`, add `setTryOn(null)` after a successful equip (owned tap clears try-on).

- [ ] **Step 3:** Add the buy handler (purchase → equip → clear):
```tsx
const handleBuyTryOn = () => {
  if (!tryOn) return;
  const listing = tryOn.listing;
  setErrorMessage(null);
  startTransition(async () => {
    try {
      const result = await purchaseShopItemAction(listing.shopItem.id, { childId });
      setOwnedIds(new Set([...ownedIds, listing.shopItem.id]));
      setCoinBalance(result.coinsAfter);
      const meta = lookupItem(listing.avatarItem.unlockRef);
      if (meta) {
        setEquipped((prev) => ({
          ...prev,
          [meta.slot]: {
            avatarItemId: listing.avatarItem.id,
            unlockRef: listing.avatarItem.unlockRef,
            slotId: listing.avatarItem.slotId,
            isDefault: false,
          },
        }));
      }
      await equipAvatarItemAction(listing.avatarItem.id, { childId });
      setTryOn(null);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '购买失败 / Purchase failed');
    }
  });
};
```

- [ ] **Step 4:** Render the big preview in the avatar tab, above `ThemeChipStrip`:
```tsx
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
  </>
)}
```

- [ ] **Step 5:** Retire the avatar purchase dialog: remove `confirming` state, `handlePurchase`, `confirmPurchase`, and the `<PurchaseConfirmDialog .../>` block + its import. (The component file + its own tests stay.)

- [ ] **Step 6:** Run typecheck + tests; fix any ShopBody test referencing the old dialog flow.
- [ ] **Step 7:** Commit.

---

## Task 3: `trying` indicator on the card

**Files:** Modify `src/components/shop/ShopGrid.tsx`, `src/components/shop/ShopItemCard.tsx`

- [ ] **Step 1:** `ShopGrid` gains `tryingShopItemId?: string | null`; pass `trying={listing.shopItem.id === tryingShopItemId}` to `ShopItemCard`.
- [ ] **Step 2:** `ShopItemCard` gains optional `trying?: boolean`; when true add a ring/badge (e.g. `ring-emerald-400` + a small `试穿中 / Trying` chip). Keep all existing states.
- [ ] **Step 3:** Test (extend `shop-grid` or a new test): when `tryingShopItemId` matches a listing, that card shows the trying badge.
- [ ] **Step 4:** Run typecheck + tests.
- [ ] **Step 5:** Commit.

---

## Task 4: Four-green gate + docs

- [ ] **Step 1:** `pnpm typecheck && lint && test && build` green.
- [ ] **Step 2:** CLAUDE.md: note the avatar try-on model + that avatar purchase no longer uses `PurchaseConfirmDialog`.
- [ ] **Step 3:** Commit.

---

## Self-review
- Spec §3.1 try-on state → Task 2; §3.2 big preview + Buy bar → Task 1; §3.3 grid + trying badge + retire dialog → Tasks 2-3. Covered.
- Types: `tryOn: { slot; listing }` consistent across tasks; `AvatarTryOnPreview` Props match the ShopBody callsite.
