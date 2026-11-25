import { createHash } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import sharp from "sharp";
import { productThumbnails } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { fetchWithTimeout } from "./fetch-timeout";
import { isBlockedUrl } from "./product-parse";
import { storageGet } from "./storage";

/**
 * Product-card thumbnails.
 *
 * Cards are 40–56 px, so re-downloading and re-encoding a 1024–3000 px source
 * for every row (and shipping it as a base64 data URL) was the main remaining
 * image cost. Thumbnails are now content-addressed HTTP resources: the URL
 * carries the source image's hash, the bytes live in MySQL, and the route can
 * declare them immutable. `images.get` only computes the URL; encoding happens
 * once, on the first request for that URL.
 */

/** Widths a thumbnail may be stored at. Keeps the cache from fragmenting. */
export const THUMBNAIL_WIDTHS = [64, 96, 128, 192, 256] as const;

const MAX_CACHE_ENTRIES = 500;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 64 * 1024;
const STORAGE_PREFIX = "/storage/";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type StoredThumbnail = { bytes: Buffer; contentType: string; at: number };

const cache = new Map<string, StoredThumbnail>();
const inFlight = new Map<string, Promise<StoredThumbnail | null>>();

/** NUL cannot appear in a validated product id, so it is a safe separator. */
function cacheKey(productId: string, width: number, sourceHash: string): string {
  return `${productId}\u0000${width}\u0000${sourceHash}`;
}

/** Snap a requested width up to the next stored size (max 256). */
export function normalizeThumbnailWidth(requested: number): number {
  const value = Number.isFinite(requested) ? Math.round(requested) : 0;
  for (const width of THUMBNAIL_WIDTHS) {
    if (value <= width) return width;
  }
  return THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1]!;
}

/** Short, stable hash of the source image URL (the cache identity). */
export function imageSourceHash(imageUrl: string): string {
  return createHash("sha256").update(imageUrl).digest("hex").slice(0, 16);
}

export function thumbnailPath(
  productId: string,
  width: number,
  sourceHash: string,
): string {
  return `/api/thumb/${encodeURIComponent(productId)}/${width}.webp?v=${sourceHash}`;
}

/**
 * Whether the source can be thumbnailed. Generated images are stored as
 * `/storage/<key>` and need the Forge storage backend; when it is not
 * configured, callers must keep returning the full image URL instead of
 * advertising a thumbnail that would 404.
 */
export function canServeThumbnail(imageUrl: string): boolean {
  if (imageUrl.startsWith(STORAGE_PREFIX)) {
    return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
  }
  return !isBlockedUrl(imageUrl);
}

async function loadSource(imageUrl: string): Promise<Buffer | null> {
  try {
    if (imageUrl.startsWith(STORAGE_PREFIX)) {
      const object = await storageGet(
        imageUrl.slice(STORAGE_PREFIX.length),
        MAX_SOURCE_BYTES,
      );
      if (!object || !object.contentType.startsWith("image/")) return null;
      return object.bytes;
    }

    if (isBlockedUrl(imageUrl)) return null;
    const response = await fetchWithTimeout(
      imageUrl,
      {
        headers: { accept: "image/*", "user-agent": USER_AGENT },
      },
      15_000,
    );
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length > MAX_SOURCE_BYTES) return null;
    return source;
  } catch {
    return null;
  }
}

/** Resize a source buffer to WebP. Exported so the encode path is testable. */
export async function renderThumbnail(
  source: Buffer,
  width: number,
): Promise<Buffer | null> {
  try {
    const bytes = await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    return bytes.length > MAX_THUMBNAIL_BYTES ? null : bytes;
  } catch {
    return null;
  }
}

function remember(key: string, value: StoredThumbnail): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

/** Memory + DB lookup for an already-encoded thumbnail. */
export async function readStoredThumbnail(
  productId: string,
  width: number,
  sourceHash: string,
): Promise<StoredThumbnail | null> {
  const key = cacheKey(productId, width, sourceHash);
  const hit = cache.get(key);
  if (hit) {
    // Refresh insertion order for the LRU.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(productThumbnails)
      .where(
        and(
          eq(productThumbnails.productId, productId),
          eq(productThumbnails.width, width),
          eq(productThumbnails.sourceHash, sourceHash),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0]!;
    const value = {
      bytes: Buffer.from(row.data, "base64"),
      contentType: row.contentType,
      at: Date.now(),
    };
    if (value.bytes.length === 0) return null;
    remember(key, value);
    return value;
  } catch (e) {
    console.warn("[Thumbnails] DB read failed", e);
    return null;
  }
}

/**
 * Fetch, encode, and persist a thumbnail. Concurrent requests for the same
 * key share one encode; a failed DB write still returns the bytes.
 */
export async function renderAndStoreThumbnail(input: {
  productId: string;
  width: number;
  sourceHash: string;
  imageUrl: string;
}): Promise<StoredThumbnail | null> {
  const { productId, width, sourceHash, imageUrl } = input;
  const key = cacheKey(productId, width, sourceHash);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const source = await loadSource(imageUrl);
    if (!source) return null;
    const bytes = await renderThumbnail(source, width);
    if (!bytes) return null;

    const value: StoredThumbnail = {
      bytes,
      contentType: "image/webp",
      at: Date.now(),
    };
    remember(key, value);

    const db = await getDb();
    if (db) {
      try {
        await db
          .insert(productThumbnails)
          .values({
            productId,
            width,
            sourceHash,
            contentType: value.contentType,
            data: bytes.toString("base64"),
            createdAt: Date.now(),
          })
          .onDuplicateKeyUpdate({
            set: {
              contentType: value.contentType,
              data: bytes.toString("base64"),
              createdAt: Date.now(),
            },
          });
        // A product image that changed leaves its previous hash behind; the
        // old URL is no longer handed out, so drop the row.
        await db
          .delete(productThumbnails)
          .where(
            and(
              eq(productThumbnails.productId, productId),
              eq(productThumbnails.width, width),
              ne(productThumbnails.sourceHash, sourceHash),
            ),
          );
      } catch (e) {
        // The bytes are already in memory and correct; a write failure must
        // not turn a thumbnail request into an error.
        console.warn("[Thumbnails] DB write failed; keeping memory copy", e);
      }
    }
    return value;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

/** Drop rows whose product no longer has a cached source image. */
export async function purgeOrphanedThumbnails(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      sql`DELETE t FROM product_thumbnails t LEFT JOIN product_images i ON i.productId = t.productId WHERE i.productId IS NULL`,
    );
  } catch (e) {
    // A blip here must not abort the rest of the warmer tick.
    console.warn("[Thumbnails] Failed to purge orphaned rows", e);
  }
}

export function clearImageThumbnailCacheForTests(): void {
  cache.clear();
  inFlight.clear();
}
