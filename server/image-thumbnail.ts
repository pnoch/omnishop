import sharp from "sharp";
import { fetchWithTimeout } from "./fetch-timeout";

const MAX_CACHE_ENTRIES = 500;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

type Entry = { dataUrl: string; at: number };

const cache = new Map<string, Entry>();

/**
 * Fetch a resolved product image and return a small WebP data URL. Product
 * cards are 40–48px; downloading the 1024–3000px source for every row is the
 * main remaining web payload cost.
 */
export async function getImageThumbnailDataUrl(
  imageUrl: string,
  requestedWidth: number,
): Promise<string | null> {
  const width = Math.min(256, Math.max(16, Math.round(requestedWidth)));
  const key = `${width}:${imageUrl}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    // Refresh insertion order for a simple LRU eviction.
    cache.delete(key);
    cache.set(key, hit);
    return hit.dataUrl;
  }

  try {
    const response = await fetchWithTimeout(
      imageUrl,
      {
        headers: {
          accept: "image/*",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
      },
      15_000,
    );
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length > MAX_SOURCE_BYTES) return null;

    const thumbnail = await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    const dataUrl = `data:image/webp;base64,${thumbnail.toString("base64")}`;
    cache.set(key, { dataUrl, at: Date.now() });
    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
    return dataUrl;
  } catch {
    return null;
  }
}

export function clearImageThumbnailCacheForTests(): void {
  cache.clear();
}
