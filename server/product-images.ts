import { eq, inArray, notInArray } from "drizzle-orm";
import * as cheerio from "cheerio";
import { productImages } from "../drizzle/schema";
import { PRODUCT_CATALOG } from "../shared/src/catalog.js";
import { DISTRIBUTORS } from "../shared/src/distributors.js";
import { getDb } from "./db";
import { fetchWithTimeout } from "./fetch-timeout";
import { generateImage } from "./_core/imageGeneration";
import { tryConsumeBudget } from "./spend-budget";

type CatalogProduct = (typeof PRODUCT_CATALOG)[number];

const memoryImages = new Map<string, string>();
const inFlight = new Map<string, Promise<ProductImage | null>>();

export interface ProductImage {
  imageUrl: string;
}

export async function getProductImage(
  productId: string,
  sourceUrls?: string[],
): Promise<ProductImage | null> {
  const key = `${productId}|${sourceUrls?.join("|") ?? ""}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = getProductImageInner(productId, sourceUrls);
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

async function getProductImageInner(
  productId: string,
  sourceUrls?: string[],
): Promise<ProductImage | null> {
  const cached = await readCached(productId);
  if (cached) return { imageUrl: cached };

  const product = PRODUCT_CATALOG.find((p) => p.id === productId);

  // Prefer the real product page image. This works for discovered products
  // too, even when they are not in the static catalog.
  if (sourceUrls?.length) {
    const real = await resolveDistributorImages(sourceUrls, product);
    if (real) {
      await writeCached(productId, real);
      return { imageUrl: real };
    }
  }

  if (!product) return null;
  // Budget is checked only on the billable path (cache/page hits returned
  // earlier).
  if (!tryConsumeBudget("images.get")) return null;
  const url = await generateImageForProduct(product);
  if (!url) return null;
  await writeCached(productId, url);
  return { imageUrl: url };
}

const DISTRIBUTOR_HOSTS = new Set(
  DISTRIBUTORS.flatMap((distributor) => {
    if (!distributor.website) return [];
    try {
      return [new URL(distributor.website).hostname.replace(/^www\./i, "").toLowerCase()];
    } catch {
      return [];
    }
  }),
);

/** Only product pages on known distributor hosts may be fetched. */
export function isAllowedImageSource(sourceUrl: string): boolean {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    for (const allowed of DISTRIBUTOR_HOSTS) {
      if (host === allowed || host.endsWith(`.${allowed}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Pull the social/product image from a distributor product page. */
export function extractProductImageUrl(
  html: string,
  pageUrl: string,
): string | null {
  try {
    const $ = cheerio.load(html);
    const raw =
      $('meta[property="og:image:secure_url"]').attr("content") ||
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href");
    if (!raw) return null;
    const resolved = new URL(raw.trim(), pageUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    // A successful page can still advertise a site logo as its social image.
    // Those are not product photos; leave the card on the placeholder.
    if (
      /(?:logo|sprite|favicon|placeholder|default[-_]?image|header|banner|avatar)/i.test(
        resolved.pathname,
      )
    ) {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function pageMatchesProduct(
  html: string,
  product: CatalogProduct | undefined,
): boolean {
  if (!product) return true;
  try {
    const $ = cheerio.load(html);
    const heading = [
      $("title").first().text(),
      $('meta[property="og:title"]').attr("content"),
      $("h1").first().text(),
    ]
      .filter(Boolean)
      .join(" ");
    const normalize = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const haystack = normalize(heading);
    return [product.modelNumber, product.name]
      .filter(Boolean)
      .map(normalize)
      .filter((needle) => needle.length >= 4)
      .some((needle) => haystack.includes(needle));
  } catch {
    return false;
  }
}

async function resolveDistributorImages(
  sourceUrls: string[],
  product: CatalogProduct | undefined,
): Promise<string | null> {
  for (const sourceUrl of sourceUrls) {
    if (!isAllowedImageSource(sourceUrl)) continue;
    try {
      const response = await fetchWithTimeout(
        sourceUrl,
        {
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          },
          redirect: "follow",
        },
        15_000,
      );
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
        continue;
      }
      const html = await response.text();
      if (!pageMatchesProduct(html, product)) continue;
      const image = extractProductImageUrl(html, response.url || sourceUrl);
      if (image) return image;
    } catch {
      // Try the next product page.
    }
  }
  return null;
}

async function readCached(productId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) {
    return memoryImages.get(productId) ?? null;
  }
  try {
    const rows = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .limit(1);
    return rows.length > 0 ? rows[0]!.imageUrl : null;
  } catch (e) {
    // A DB blip must not turn a cache read into a 500: fall back to the
    // in-process copy so the caller still gets an answer.
    console.warn("[Images] DB read failed; using memory cache", e);
    return memoryImages.get(productId) ?? null;
  }
}

async function writeCached(productId: string, url: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryImages.set(productId, url);
    return;
  }
  try {
    await db
      .insert(productImages)
      .values({ productId, imageUrl: url })
      .onDuplicateKeyUpdate({ set: { imageUrl: url } });
  } catch (e) {
    // The image is already paid for; a failed write must not discard it.
    console.warn("[Images] DB write failed; keeping memory copy", e);
    memoryImages.set(productId, url);
  }
}

function buildImagePrompt(product: { name: string; category: string }): string {
  return `A ${product.name} ${product.category.toLowerCase()}, product photo, clean background, high detail`;
}

async function generateImageForProduct(
  product: CatalogProduct,
): Promise<string | null> {
  try {
    const result = await Promise.race([
      generateImage({ prompt: buildImagePrompt(product) }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Image generation timeout")), 15_000),
      ),
    ]);
    return result.url ?? null;
  } catch {
    return null;
  }
}

export async function listProductsMissingImage(): Promise<string[]> {
  const allIds = PRODUCT_CATALOG.map((p) => p.id);
  if (allIds.length === 0) return [];
  const db = await getDb();
  if (!db) {
    return allIds.filter((id) => !memoryImages.has(id));
  }
  const rows = await db
    .select({ productId: productImages.productId })
    .from(productImages)
    .where(inArray(productImages.productId, allIds));
  const existing = new Set(rows.map((r: { productId: string }) => r.productId));
  return allIds.filter((id) => !existing.has(id));
}

export async function clearImagesForTests(): Promise<void> {
  memoryImages.clear();
  inFlight.clear();
  // DB-backed test runs share one schema, so the memory clear alone would let
  // a row written by an earlier test serve a later one.
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(productImages);
  } catch (e) {
    console.warn("[Images] Failed to clear test rows", e);
  }
}

// Rows are keyed by productId and bounded by the catalog, but a product removed
// from the catalog would leave its row behind forever. Drop orphans (called
// from the warmer tick). No-op when the catalog is empty to avoid wiping all.
export async function purgeOrphanedImages(): Promise<void> {
  const ids = PRODUCT_CATALOG.map((p) => p.id);
  if (ids.length === 0) return;
  const db = await getDb();
  if (!db) {
    for (const key of memoryImages.keys()) {
      if (!ids.includes(key)) memoryImages.delete(key);
    }
    return;
  }
  try {
    await db.delete(productImages).where(notInArray(productImages.productId, ids));
  } catch (e) {
    // A blip here must not abort the rest of the warmer tick.
    console.warn("[Images] Failed to purge orphaned rows", e);
  }
}
