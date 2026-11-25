import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { productImages, productThumbnails } from "../drizzle/schema";
import { getDb } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("../server/fetch-timeout", () => ({ fetchWithTimeout: fetchMock }));

import {
  clearImageThumbnailCacheForTests,
  imageSourceHash,
  purgeOrphanedThumbnails,
  readStoredThumbnail,
  renderAndStoreThumbnail,
} from "../server/image-thumbnail";

const PRODUCT_ID = "mikrotik-crs326-24s";
const IMAGE_A = "https://cdn.example.com/a.png";
const IMAGE_B = "https://cdn.example.com/b.png";

async function sourceBytes(): Promise<ArrayBuffer> {
  const png = await sharp({
    create: { width: 240, height: 160, channels: 3, background: "#0f52ba" },
  })
    .png()
    .toBuffer();
  return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
}

async function seedResponse(bytes: ArrayBuffer): Promise<void> {
  fetchMock.mockResolvedValue({
    ok: true,
    headers: { get: () => "image/png" },
    arrayBuffer: async () => bytes,
  });
}

describe.skipIf(!runDbTests)("product thumbnails (DB)", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(productThumbnails);
    await db.delete(productImages);
    clearImageThumbnailCacheForTests();
    fetchMock.mockReset();
  });

  it("persists the encoded bytes and serves them after a cache clear", async () => {
    await seedResponse(await sourceBytes());
    const hash = imageSourceHash(IMAGE_A);

    const first = await renderAndStoreThumbnail({
      productId: PRODUCT_ID,
      width: 96,
      sourceHash: hash,
      imageUrl: IMAGE_A,
    });
    expect(first).not.toBeNull();

    const db = await getDb();
    const rows = await db!.select().from(productThumbnails);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.contentType).toBe("image/webp");
    expect(rows[0]!.sourceHash).toBe(hash);

    clearImageThumbnailCacheForTests();
    const second = await readStoredThumbnail(PRODUCT_ID, 96, hash);
    expect(second?.bytes.equals(first!.bytes)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("replaces thumbnails for a superseded source hash", async () => {
    const bytes = await sourceBytes();
    await seedResponse(bytes);
    const hashA = imageSourceHash(IMAGE_A);
    const hashB = imageSourceHash(IMAGE_B);

    await renderAndStoreThumbnail({
      productId: PRODUCT_ID,
      width: 96,
      sourceHash: hashA,
      imageUrl: IMAGE_A,
    });
    await renderAndStoreThumbnail({
      productId: PRODUCT_ID,
      width: 96,
      sourceHash: hashB,
      imageUrl: IMAGE_B,
    });

    const db = await getDb();
    const rows = await db!.select().from(productThumbnails);
    expect(rows.map((row) => row.sourceHash)).toEqual([hashB]);
  });

  it("purges thumbnails whose product no longer has an image", async () => {
    await seedResponse(await sourceBytes());
    const db = await getDb();
    await db!.insert(productImages).values({
      productId: PRODUCT_ID,
      imageUrl: IMAGE_A,
    });
    const hash = imageSourceHash(IMAGE_A);
    await renderAndStoreThumbnail({
      productId: PRODUCT_ID,
      width: 96,
      sourceHash: hash,
      imageUrl: IMAGE_A,
    });

    await db!.delete(productImages);
    await purgeOrphanedThumbnails();

    const rows = await db!.select().from(productThumbnails);
    expect(rows).toHaveLength(0);
  });
});
