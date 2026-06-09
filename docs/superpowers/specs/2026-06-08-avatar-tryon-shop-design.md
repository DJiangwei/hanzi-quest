# Avatar Shop — Big Preview + Try-On — Design Spec

**Date:** 2026-06-08
**Status:** approved (design locked via David's choices) — **queued behind the bilingual sweep**
**Context:** Yinuo's feedback: she wants to **try on** a cosmetic before buying, and the avatar preview in the shop is **too small** to judge the effect. Today the avatar shop tab has a small top `AvatarRender` of the *currently-equipped* look, a theme filter, and a grid of `ShopItemCard`s (each an 88px composite). Buying goes through a separate `PurchaseConfirmDialog`. There's no way to see an *unowned* item on your own avatar before committing coins.

---

## 1. North Star

> Yinuo taps a fancy hat she hasn't bought. It instantly appears on a **big** version of *her* avatar at the top of the shop. She likes it → taps **购买 / Buy** → confirms → it's hers and worn. She doesn't like it → taps another item, or it reverts to her real look. No guessing from a tiny thumbnail.

---

## 2. Locked decisions

- **Model = tap-to-try-on, Buy-to-confirm.** Tapping ANY grid item previews it ON the big avatar. Owned items **equip** on tap. Unowned items enter **try-on** (preview only) and surface a contextual **购买 / Buy · 🪙price** button by the big avatar; confirming purchases **and** equips.
- **Big avatar lives at the top of the existing avatar shop tab** (not a separate route) — a large sticky preview above the theme filter + grid.
- **Try-on is per-slot, ephemeral, client-only.** Trying a new hat replaces any tried hat; it never writes to the server until Buy/Equip. Leaving the shop or switching the category tab discards the try-on and the big avatar shows the real equipped look.
- Bilingual throughout (this ships AFTER the bilingual sweep, so it inherits the `中文 / English` convention).

---

## 3. Behavior

### 3.1 Try-on state
`ShopBody`'s avatar section gains a `tryOn` state: `{ slot, listing } | null` — the single item currently being previewed but not yet owned/equipped.

- **Composite for the big avatar** = `equippedRefs` (the real look) **with the tried item's slot overridden** by `tryOn.listing.avatarItem.unlockRef`. So the kid sees her real avatar + the one tried item.
- Tapping a grid item:
  - **Owned** → `equipAvatarItemAction` (optimistic, as today) and clear `tryOn` (the equip is now real).
  - **Unowned** → set `tryOn = { slot, listing }` (no server call). The big avatar updates; the Buy bar appears.
  - **Tapping the tried item again** (or a small `卸下 / Take off` control) → clear `tryOn`, big avatar reverts.

### 3.2 The big preview + Buy bar
- A large `AvatarRender` (e.g. `size≈220`, responsive `clamp`) centered at the top of the avatar tab, showing the composite. Replaces the current small top preview.
- **Buy bar** (only when `tryOn` is set and the item is unowned):
  - Shows the item name (bilingual), rarity, and `购买 / Buy · 🪙{price}`.
  - **Affordable** → enabled; tap → `purchaseShopItemAction` → on success `equipAvatarItemAction` → clear `tryOn` (now owned + worn). Coin pill animates down (existing behavior).
  - **Unaffordable** → disabled with helper `再赚 X 金币 / Earn X more coins`.
- When no `tryOn` is active, the big avatar just shows the equipped look (no Buy bar).

### 3.3 Grid
- Keep the `ShopGrid` of `ShopItemCard`s (thumbnails stay useful as the catalog). Add a visual "trying" ring/badge on the card that's currently tried-on. Owned/equipped/price badges unchanged.
- The separate `PurchaseConfirmDialog` for avatars is **retired** — the big-preview + Buy bar IS the confirm step now. (Keep the component for any non-avatar reuse, or delete if unused elsewhere — check first.)

---

## 4. Files

**Modified**
- `src/app/play/[childId]/shop/ShopBody.tsx` — `tryOn` state; big preview + Buy bar; tap routing (owned→equip, unowned→try-on); buy→purchase→equip→clear. Reset `tryOn` on category-tab change.
- `src/components/shop/ShopItemCard.tsx` — optional `trying?: boolean` prop → "trying" ring/badge; the card's onClick still bubbles to ShopBody which decides equip vs try-on.
- Possibly extract a small `AvatarTryOnPreview.tsx` (big `AvatarRender` + Buy bar) to keep `ShopBody` focused.
- `PurchaseConfirmDialog.tsx` — drop the avatar usage (retire or keep for other kinds — verify usage first).
- `CLAUDE.md` — note the try-on model + that avatar purchase no longer uses `PurchaseConfirmDialog`.

**Reuse:** `AvatarRender` (already takes a `size` + `equipped` map and composites slots back→front), `equipAvatarItemAction`, `purchaseShopItemAction`, `getCoinBalance`/coin HUD.

**No DB change, no migration.**

---

## 5. Out of scope
- Saving multiple outfits / a wardrobe of looks. Randomize/"surprise me". Animated avatars. Try-on for non-avatar kinds (pets/decor/sounds keep their current flow). A separate full-screen fitting-room route (we use the in-tab big preview).

---

## 6. Testing
- Try-on state: tapping an **unowned** item sets the big-avatar composite to include it + shows the Buy bar; does NOT call equip/purchase.
- Tapping an **owned** item calls `equipAvatarItemAction` and clears any try-on.
- Buy: affordable → `purchaseShopItemAction` then `equipAvatarItemAction` then try-on cleared; unaffordable → Buy disabled + helper copy.
- Switching category tab clears `tryOn`.
- Big `AvatarRender` composites the tried slot over the equipped look (assert the tried item's slot ref wins).
- The "trying" badge renders on exactly the tried card.

---

## 7. Done criteria
- A large avatar sits atop the avatar shop tab; tapping any cosmetic shows it on *her* avatar; unowned items show a Buy bar that purchases + wears on confirm; owned items equip on tap; try-on is ephemeral.
- `pnpm typecheck && lint && test && build` green.
