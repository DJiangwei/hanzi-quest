/**
 * ZOOM UNDERSIZED COLLECTIBLE CARD ART (one-time, resume-safe).
 *
 * Problem this fixes: the flux generator framed many cards with the subject
 * floating in a sea of empty background — 虾 (shrimp) occupied 42% of its
 * 1024² canvas, 水星 (Mercury) just 27%. Rendered into a ~100px grid tile in
 * the Backpack, those subjects were unreadably small. It is NOT a CSS bug:
 * `CardArt` shows the whole square, so a small subject stays small.
 *
 * What it does: measures the bounding box of non-background pixels, then
 * re-crops the EXISTING art to a square around the subject so it fills
 * `TARGET_FILL` of the frame, and overwrites the same Blob path. Pure image
 * geometry — no AI, no re-generation, so the art style can't drift and the
 * public URL never changes (no DB write needed).
 *
 * BLOB BUDGET (the 2,000 Advanced Operations / month cap): downloads are
 * Simple Operations and cost nothing. Only the `put()` of an actually-cropped
 * card is billed — roughly 70 one-time. Cards already framed well are skipped
 * WITHOUT a put, so re-running this script is nearly free: a second pass sees
 * the new (already-large) fill ratio and skips everything.
 *
 *   pnpm tsx scripts/zoom-collectible-art.ts            # backup + apply
 *   DRY_RUN=1 pnpm tsx scripts/zoom-collectible-art.ts  # report only, 0 puts
 *   ONLY_PACK=sea-creatures-v1 pnpm tsx scripts/...     # scope to one pack
 *   NO_BACKUP=1 pnpm tsx scripts/...                    # skip the safety net
 *   RESTORE_FROM=backups/collectible-art-<ts> pnpm tsx scripts/...  # undo
 *
 * Every card it is about to overwrite is first written to
 * `backups/collectible-art-<timestamp>/` (a free GET, gitignored) alongside a
 * `manifest.json`, so RESTORE_FROM can put the originals back byte-for-byte.
 *
 * NOTE: there is ONE Blob store shared by prod and the dev DB branch, so the
 * overwrite is visible in production regardless of which DATABASE_URL is set.
 *
 * GOTCHA: Blob URLs are CDN-cached, so a DRY_RUN immediately after a real pass
 * re-measures stale bytes and re-flags cards it just fixed. That is a cache
 * artefact, not a failed upload — append a cache-buster query to confirm.
 */
import { config as loadEnv } from 'dotenv';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Subject fill (longest edge / canvas) at or above which a card is left alone. */
const SKIP_ABOVE_FILL = 0.82;
/** Subject fill the re-crop aims for. Leaves a comfortable breathing margin. */
const TARGET_FILL = 0.88;
/** Per-channel colour distance from the corner pixel that counts as "subject". */
const BG_TOLERANCE = 26;
/** Output edge, matching the generator. */
const OUT_SIZE = 1024;

const HTTP_URL = /^https?:\/\//i;

export interface BBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * Bounding box of every pixel that differs from the corner (background) colour.
 * Returns null for a blank canvas.
 */
export function subjectBBox(
  data: Buffer | Uint8Array,
  width: number,
  height: number,
  channels: number,
  tolerance = BG_TOLERANCE,
): BBox | null {
  const bg = [data[0], data[1], data[2]];
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const d =
        Math.abs(data[i] - bg[0]) +
        Math.abs(data[i + 1] - bg[1]) +
        Math.abs(data[i + 2] - bg[2]);
      if (d > tolerance) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export interface ZoomCrop {
  /** Region to extract from the source (always inside the canvas). */
  extract: { left: number; top: number; width: number; height: number };
  /** Background padding to add back when the ideal square runs off-canvas. */
  extend: { top: number; bottom: number; left: number; right: number };
}

/**
 * Square crop centred on the subject, sized so the subject's longest edge
 * occupies `targetFill` of it. When that square overruns the canvas the
 * overflow comes back as `extend` padding (filled with the background colour)
 * rather than by shifting the subject off-centre.
 */
export function computeZoomCrop(
  box: BBox,
  canvasW: number,
  canvasH: number,
  targetFill = TARGET_FILL,
): ZoomCrop {
  const side = Math.max(1, Math.round(Math.max(box.width, box.height) / targetFill));
  const cx = box.minX + box.width / 2;
  const cy = box.minY + box.height / 2;
  const left = Math.round(cx - side / 2);
  const top = Math.round(cy - side / 2);

  const padLeft = Math.max(0, -left);
  const padTop = Math.max(0, -top);
  const padRight = Math.max(0, left + side - canvasW);
  const padBottom = Math.max(0, top + side - canvasH);

  return {
    extract: {
      left: left + padLeft,
      top: top + padTop,
      width: side - padLeft - padRight,
      height: side - padTop - padBottom,
    },
    extend: { top: padTop, bottom: padBottom, left: padLeft, right: padRight },
  };
}

interface BackupEntry {
  slug: string;
  packSlug: string;
  pathname: string;
  file: string;
}

/** Restores previously backed-up originals from a backup directory. */
async function restore(dir: string) {
  const { put } = await import('@vercel/blob');
  const manifest: BackupEntry[] = JSON.parse(
    await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'),
  );
  console.log(`\nRestoring ${manifest.length} originals from ${dir}\n`);
  let done = 0;
  for (const entry of manifest) {
    const bytes = await fs.readFile(path.join(dir, entry.file));
    await put(entry.pathname, bytes, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    done += 1;
    console.log(`  ↩️  ${entry.packSlug}/${entry.slug}`);
  }
  console.log(`\nRestored ${done}. Blob Advanced Operations spent: ${done}\n`);
}

async function main() {
  loadEnv({ path: '.env.local', quiet: true });

  const dryRun = process.env.DRY_RUN === '1';
  const onlyPack = process.env.ONLY_PACK ?? null;

  const restoreFrom = process.env.RESTORE_FROM;
  if (restoreFrom) {
    await restore(restoreFrom);
    process.exit(0);
  }

  const backupDir =
    dryRun || process.env.NO_BACKUP === '1'
      ? null
      : path.join('backups', `collectible-art-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const backupManifest: BackupEntry[] = [];
  if (backupDir) await fs.mkdir(backupDir, { recursive: true });

  const { db } = await import('@/db');
  const { collectionPacks, collectibleItems } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const { put } = await import('@vercel/blob');
  const sharp = (await import('sharp')).default;

  const rows = await db
    .select({
      id: collectibleItems.id,
      slug: collectibleItems.slug,
      nameZh: collectibleItems.nameZh,
      imageUrl: collectibleItems.imageUrl,
      packSlug: collectionPacks.slug,
    })
    .from(collectibleItems)
    .innerJoin(collectionPacks, eq(collectionPacks.id, collectibleItems.packId));

  const targets = rows.filter(
    (r) =>
      r.imageUrl &&
      HTTP_URL.test(r.imageUrl) &&
      (!onlyPack || r.packSlug === onlyPack),
  );

  console.log(
    `\n${targets.length} cards with real art${onlyPack ? ` in ${onlyPack}` : ''}` +
      `${dryRun ? '  (DRY RUN — no uploads)' : ''}\n`,
  );

  let zoomed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of targets) {
    try {
      const res = await fetch(row.imageUrl!);
      if (!res.ok) throw new Error(`GET ${res.status}`);
      const src = Buffer.from(await res.arrayBuffer());

      const image = sharp(src);
      const meta = await image.metadata();
      const W = meta.width!;
      const H = meta.height!;
      const { data, info } = await image
        .clone()
        .raw()
        .toColourspace('srgb')
        .toBuffer({ resolveWithObject: true });

      const box = subjectBBox(data, info.width, info.height, info.channels);
      if (!box) {
        console.log(`  ⏭️  ${row.packSlug}/${row.slug} — blank canvas, left alone`);
        skipped += 1;
        continue;
      }

      const fill = Math.max(box.width / W, box.height / H);
      if (fill >= SKIP_ABOVE_FILL) {
        skipped += 1;
        continue;
      }

      const { extract, extend } = computeZoomCrop(box, W, H);
      const bg = { r: data[0], g: data[1], b: data[2] };
      const out = await sharp(src)
        .extract(extract)
        .extend({ ...extend, background: bg })
        .resize(OUT_SIZE, OUT_SIZE)
        .jpeg({ quality: 90 })
        .toBuffer();

      const zoomFactor = (fill === 0 ? 0 : TARGET_FILL / fill).toFixed(2);
      if (dryRun) {
        console.log(
          `  🔍 ${row.packSlug}/${row.slug} (${row.nameZh}) fill ${fill.toFixed(2)} → ${TARGET_FILL} (${zoomFactor}× bigger)`,
        );
        zoomed += 1;
        continue;
      }

      // Same pathname → same public URL, so no DB write and no stale links.
      const pathname = new URL(row.imageUrl!).pathname.replace(/^\//, '');

      // Safety net: keep the pre-overwrite original on disk (a free GET already
      // in hand) so RESTORE_FROM can undo this pass byte-for-byte.
      if (backupDir) {
        const file = `${row.packSlug}__${row.slug}.jpg`;
        await fs.writeFile(path.join(backupDir, file), src);
        backupManifest.push({ slug: row.slug, packSlug: row.packSlug, pathname, file });
        await fs.writeFile(
          path.join(backupDir, 'manifest.json'),
          JSON.stringify(backupManifest, null, 2),
        );
      }

      await put(pathname, out, {
        access: 'public',
        contentType: 'image/jpeg',
        addRandomSuffix: false,
        allowOverwrite: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      zoomed += 1;
      console.log(
        `  ✅ ${row.packSlug}/${row.slug} (${row.nameZh}) fill ${fill.toFixed(2)} → ${TARGET_FILL} (${zoomFactor}× bigger)`,
      );
    } catch (err) {
      failed += 1;
      console.error(`  ❌ ${row.packSlug}/${row.slug}: ${(err as Error).message}`);
    }
  }

  console.log(
    `\nDone. ${zoomed} zoomed${dryRun ? ' (would be)' : ''}, ${skipped} already well framed, ${failed} failed.`,
  );
  console.log(`Blob Advanced Operations spent: ${dryRun ? 0 : zoomed}`);
  if (backupDir) {
    console.log(`Originals backed up to ${backupDir} — undo with RESTORE_FROM=${backupDir}`);
  }
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

// Guarded so the pure helpers above stay importable from tests without running main().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
