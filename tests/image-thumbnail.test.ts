import { describe, expect, it, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("../server/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from "../server/fetch-timeout";
import {
  clearImageThumbnailCacheForTests,
  getImageThumbnailDataUrl,
} from "../server/image-thumbnail";

const mockedFetch = vi.mocked(fetchWithTimeout);

describe("product image thumbnails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearImageThumbnailCacheForTests();
  });

  it("resizes an image into a small WebP data URL", async () => {
    const source = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: "#0f52ba",
      },
    })
      .png()
      .toBuffer();
    const arrayBuffer = source.buffer.slice(
      source.byteOffset,
      source.byteOffset + source.byteLength,
    );

    mockedFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => arrayBuffer,
    } as never);

    const dataUrl = await getImageThumbnailDataUrl(
      "https://cdn.example.com/product.png",
      96,
    );

    expect(dataUrl).toMatch(/^data:image\/webp;base64,/);
    const encoded = dataUrl!.split(",")[1]!;
    const meta = await sharp(Buffer.from(encoded, "base64")).metadata();
    expect(meta.width).toBe(96);
    expect(meta.format).toBe("webp");
  });

  it("returns null when the image response is not an image", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html" },
      arrayBuffer: async () => new ArrayBuffer(0),
    } as never);

    await expect(
      getImageThumbnailDataUrl("https://cdn.example.com/product.png", 96),
    ).resolves.toBeNull();
  });
});
