import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../server/_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../server/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { generateImage } from "../server/_core/imageGeneration";
import { getDb } from "../server/db";
import { fetchWithTimeout } from "../server/fetch-timeout";
import {
  getProductImage,
  listProductsMissingImage,
  clearImagesForTests,
  extractProductImageUrl,
  isAllowedImageSource,
} from "../server/product-images";

const mockedGenerateImage = vi.mocked(generateImage);
const mockedGetDb = vi.mocked(getDb);
const mockedFetch = vi.mocked(fetchWithTimeout);

describe("getProductImage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearImagesForTests();
    mockedGenerateImage.mockResolvedValue({
      url: "https://img.example.com/crs804.png",
    });
  });

  it("generates and caches an image on first call", async () => {
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("returns the cached image on a second call without regenerating", async () => {
    await getProductImage("mikrotik-crs804-4ddq-hrm");
    const second = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(second).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests for the same product", async () => {
    const [first, second] = await Promise.all([
      getProductImage("mikrotik-crs804-4ddq-hrm"),
      getProductImage("mikrotik-crs804-4ddq-hrm"),
    ]);
    expect(first).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(second).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
  });

  it("returns null when the product is not in the catalog", async () => {
    const result = await getProductImage("unknown-product");
    expect(result).toBeNull();
    expect(mockedGenerateImage).not.toHaveBeenCalled();
  });

  it("returns null when generation fails", async () => {
    mockedGenerateImage.mockRejectedValue(new Error("gen failed"));
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toBeNull();
  });
});

describe("real product images from distributor pages", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearImagesForTests();
    mockedGenerateImage.mockResolvedValue({
      url: "https://img.example.com/generated.png",
    });
  });

  it("extracts and resolves og:image URLs", () => {
    const html = [
      '<html><head>',
      '<meta property="og:image" content="/media/crs804.png">',
      "</head></html>",
    ].join("");
    expect(
      extractProductImageUrl(html, "https://server2u.com/shop/crs804"),
    ).toBe("https://server2u.com/media/crs804.png");
  });

  it("rejects site logos and placeholders", () => {
    const html =
      '<meta property="og:image" content="/media/logo/Header-Logo.png">';
    expect(
      extractProductImageUrl(html, "https://server2u.com/shop/crs804"),
    ).toBeNull();
  });

  it("only accepts distributor hosts", () => {
    expect(isAllowedImageSource("https://server2u.com/shop/crs804")).toBe(true);
    expect(isAllowedImageSource("https://evil.example/crs804")).toBe(false);
  });

  it("uses a real page image before generated images", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () =>
        '<title>MikroTik CRS804-4DDQ-hRM</title><meta property="og:image" content="/media/crs804.png">',
      url: "https://server2u.com/shop/crs804",
    } as never);

    const result = await getProductImage("mikrotik-crs804-4ddq-hrm", [
      "https://server2u.com/shop/crs804",
    ]);

    expect(result).toEqual({
      imageUrl: "https://server2u.com/media/crs804.png",
    });
    expect(mockedGenerateImage).not.toHaveBeenCalled();
  });

  it("uses a trusted manufacturer page without client sources", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () =>
        '<meta property="og:image" content="https://cdn.mikrotik.com/web-assets/rb_images/1831_tm.webp">',
      url: "https://mikrotik.com/product/crs326_24s_2q_rm",
    } as never);

    const result = await getProductImage("mikrotik-crs326-24s");

    expect(result).toEqual({
      imageUrl: "https://cdn.mikrotik.com/web-assets/rb_images/1831_tm.webp",
    });
    expect(mockedGenerateImage).not.toHaveBeenCalled();
  });

  it("rejects a page about a different product", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () =>
        '<title>Ubiquiti UniFi Access Intercom Viewer</title><meta property="og:image" content="/media/wrong.png">',
      url: "https://linitx.com/product/wrong",
    } as never);

    const result = await getProductImage("mikrotik-crs804-4ddq-hrm", [
      "https://linitx.com/product/wrong",
    ]);

    expect(result).toEqual({
      imageUrl: "https://img.example.com/generated.png",
    });
    expect(mockedGenerateImage).toHaveBeenCalled();
  });

  it("does not fetch non-distributor pages", async () => {
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm", [
      "https://evil.example/crs804",
    ]);

    expect(mockedFetch).not.toHaveBeenCalled();
    expect(result).toEqual({
      imageUrl: "https://img.example.com/generated.png",
    });
  });
});

describe("listProductsMissingImage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearImagesForTests();
  });

  it("returns all catalog products when none have images", async () => {
    const missing = await listProductsMissingImage();
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).toContain("mikrotik-crs804-4ddq-hrm");
  });

  it("excludes products that already have an image", async () => {
    mockedGenerateImage.mockResolvedValue({
      url: "https://img.example.com/x.png",
    });
    await getProductImage("mikrotik-crs804-4ddq-hrm");
    const missing = await listProductsMissingImage();
    expect(missing).not.toContain("mikrotik-crs804-4ddq-hrm");
  });
});

describe("getProductImage DB resilience", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearImagesForTests();
    mockedGenerateImage.mockResolvedValue({
      url: "https://img.example.com/crs804.png",
    });
    mockedGetDb.mockResolvedValue(null as never);
  });

  afterEach(() => {
    mockedGetDb.mockReset();
  });

  it("falls back to the memory cache when a DB read fails", async () => {
    const first = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(first).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
    mockedGetDb.mockResolvedValue({
      select: () => {
        throw new Error("db down");
      },
    } as never);
    const second = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(second).toEqual(first);
  });

  it("keeps a freshly generated image when the DB write fails", async () => {
    mockedGetDb.mockResolvedValue({
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
      insert: () => ({
        values: () => ({
          onDuplicateKeyUpdate: async () => {
            throw new Error("db down");
          },
        }),
      }),
    } as never);
    const result = await getProductImage("mikrotik-crs804-4ddq-hrm");
    expect(result).toEqual({ imageUrl: "https://img.example.com/crs804.png" });
  });
});
