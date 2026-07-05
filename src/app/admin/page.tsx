import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { collectibleItems, collectionPacks, shopItems } from '@/db/schema';
import {
  listAllChildrenForAdminAction,
  getChildAdminSummaryAction,
  listAdminGrantsForChildAction,
} from '@/lib/actions/admin';
import { AdminChildPicker } from '@/components/admin/AdminChildPicker';
import { ChildStatePanel } from '@/components/admin/ChildStatePanel';
import { ComposeGiftForm } from '@/components/admin/ComposeGiftForm';
import { GrantHistoryList } from '@/components/admin/GrantHistoryList';

interface AdminPageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { child: selectedChildId } = await searchParams;

  const children = await listAllChildrenForAdminAction();

  // Build card catalog: collectible items with a readable label (pack + name)
  const cardRows = await db
    .select({
      id: collectibleItems.id,
      nameZh: collectibleItems.nameZh,
      nameEn: collectibleItems.nameEn,
      packSlug: collectionPacks.slug,
    })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectibleItems.packId, collectionPacks.id))
    .orderBy(asc(collectionPacks.slug), asc(collectibleItems.nameEn));

  const cards: { id: string; label: string }[] = cardRows.map((r) => ({
    id: r.id,
    label: `[${r.packSlug}] ${r.nameZh} / ${r.nameEn}`,
  }));

  // Build shop catalog: all active shop items grouped by kind
  const shopRows = await db
    .select({
      id: shopItems.id,
      kind: shopItems.kind,
      name: shopItems.name,
      slug: shopItems.slug,
    })
    .from(shopItems)
    .where(eq(shopItems.isActive, true))
    .orderBy(asc(shopItems.kind), asc(shopItems.name));

  const shopCatalog: { id: string; kind: string; label: string }[] =
    shopRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      label: `${r.name} (${r.slug})`,
    }));

  // Fetch child-specific data when a child is selected
  let childState: {
    coins: number;
    xp: number;
    shards: number;
    ownedCount: number;
  } | null = null;
  let grants: Awaited<ReturnType<typeof listAdminGrantsForChildAction>> = [];

  if (selectedChildId) {
    [childState, grants] = await Promise.all([
      getChildAdminSummaryAction(selectedChildId),
      listAdminGrantsForChildAction(selectedChildId),
    ]);
  }

  // Plain-data grant history rows (strip any non-serialisable fields)
  const grantRows = grants.map((g) => ({
    id: g.id,
    adminUserId: g.adminUserId,
    bundle: g.bundle as Record<string, unknown>,
    result: g.result as Record<string, unknown>,
    createdAt: g.createdAt.toISOString(),
    undoneAt: g.undoneAt ? g.undoneAt.toISOString() : null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-hanzi text-3xl font-bold tracking-tight text-[var(--color-ocean-900)]">
            🛠️ Admin Console / 管理后台
          </h1>
          <p className="mt-1 text-sm text-[var(--color-sand-700)]">
            Cross-account grant console. Grants are logged and undoable.
          </p>
          <nav className="mt-3 flex gap-2 text-sm">
            <span className="rounded-full bg-[var(--color-ocean-100)] px-3 py-1 font-semibold text-[var(--color-ocean-800)]">
              🛠️ 控制台 Console
            </span>
            <Link
              href="/admin/economy"
              className="rounded-full border border-[var(--color-sand-300)] px-3 py-1 hover:bg-[var(--color-sand-100)]"
            >
              📊 经济 Economy
            </Link>
          </nav>
        </div>
      </header>

      {/* Child picker */}
      <AdminChildPicker items={children} selectedChildId={selectedChildId} />

      {selectedChildId && childState && (
        <div className="flex flex-col gap-6">
          {/* Economy snapshot */}
          <ChildStatePanel
            coins={childState.coins}
            xp={childState.xp}
            shards={childState.shards}
            ownedCount={childState.ownedCount}
          />

          {/* Gift composer */}
          <ComposeGiftForm
            childId={selectedChildId}
            cards={cards}
            shopCatalog={shopCatalog}
          />

          {/* Grant history */}
          <GrantHistoryList grants={grantRows} />
        </div>
      )}
    </div>
  );
}
