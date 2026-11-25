import { describe, expect, it, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("../server/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

import { fetchWithTimeout } from "../server/fetch-timeout";
import {
  canServeThumbnail,
  clearImageThumbnailCacheForTests,
  createEncodeLimiter,
  imageSourceHash,
  normalizeThumbnailWidth,
  readStoredThumbnail,
  renderAndStoreThumbnail,
  renderThumbnail,
  thumbnailPath,
  ThumbnailBusyError,
} from "../server/image-thumbnail";

const mockedFetch = vi.mocked(fetchWithTimeout);

async function pngSource(width = 300, height = 200): Promise<ArrayBuffer> {
  const source = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#0f52ba",
    },
  })
    .png()
    .toBuffer();
  return source.buffer.slice(
    source.byteOffset,
    source.byteOffset + source.byteLength,
  );
}

function imageResponse(arrayBuffer: ArrayBuffer) {
  return {
    ok: true,
    headers: { get: () => "image/png" },
    arrayBuffer: async () => arrayBuffer,
  } as never;
}

describe("thumbnail widths", () => {
  it("snaps up to a stored width and caps at 512", () => {
    expect(normalizeThumbnailWidth(20)).toBe(64);
    expect(normalizeThumbnailWidth(48)).toBe(64);
    expect(normalizeThumbnailWidth(96)).toBe(96);
    expect(normalizeThumbnailWidth(100)).toBe(128);
    expect(normalizeThumbnailWidth(200)).toBe(256);
    expect(normalizeThumbnailWidth(300)).toBe(512);
    expect(normalizeThumbnailWidth(999)).toBe(512);
    expect(normalizeThumbnailWidth(Number.NaN)).toBe(64);
  });

  it("builds an encoded, content-addressed path", () => {
    const hash = imageSourceHash("https://cdn.example.com/a.png");
    expect(thumbnailPath("a b/c", 96, hash)).toBe(
      `/api/thumb/a%20b%2Fc/96.webp?v=${hash}`,
    );
  });
});

describe("imageSourceHash", () => {
  it("is a stable 16-char hex digest that changes with the source", () => {
    const a = imageSourceHash("https://cdn.example.com/a.png");
    expect(a).toMatch(/^[a-f0-9]{16}$/);
    expect(imageSourceHash("https://cdn.example.com/a.png")).toBe(a);
    expect(imageSourceHash("https://cdn.example.com/b.png")).not.toBe(a);
  });
});

describe("canServeThumbnail", () => {
  it("allows public absolute sources and rejects private ones", () => {
    expect(canServeThumbnail("https://cdn.example.com/a.png")).toBe(true);
    expect(canServeThumbnail("http://127.0.0.1/a.png")).toBe(false);
    expect(canServeThumbnail("http://169.254.169.254/latest")).toBe(false);
    expect(canServeThumbnail("not a url")).toBe(false);
  });
});

describe("renderThumbnail", () => {
  it("produces a small WebP at the requested width", async () => {
    const source = Buffer.from(await pngSource());
    const bytes = await renderThumbnail(source, 96);
    expect(bytes).not.toBeNull();
    const meta = await sharp(bytes!).metadata();
    expect(meta.width).toBe(96);
    expect(meta.format).toBe("webp");
  });

  it("returns null for bytes that are not an image", async () => {
    await expect(renderThumbnail(Buffer.from("nope"), 96)).resolves.toBeNull();
  });
});

describe("renderAndStoreThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearImageThumbnailCacheForTests();
  });

  it("fetches and encodes once, then serves the stored copy", async () => {
    const source = await pngSource();
    mockedFetch.mockResolvedValue(imageResponse(source));

    const imageUrl = "https://cdn.example.com/product.png";
    const hash = imageSourceHash(imageUrl);
    const first = await renderAndStoreThumbnail({
      productId: "mikrotik-crs326-24s",
      width: 96,
      sourceHash: hash,
      imageUrl,
    });

    expect(first).not.toBeNull();
    const meta = await sharp(first!.bytes).metadata();
    expect(meta.width).toBe(96);
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    const stored = await readStoredThumbnail(
      "mikrotik-crs326-24s",
      96,
      hash,
    );
    expect(stored?.bytes.equals(first!.bytes)).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight encode for concurrent requests", async () => {
    const source = await pngSource();
    mockedFetch.mockResolvedValue(imageResponse(source));
    const imageUrl = "https://cdn.example.com/product.png";
    const hash = imageSourceHash(imageUrl);
    const input = {
      productId: "mikrotik-crs326-24s",
      width: 96,
      sourceHash: hash,
      imageUrl,
    };

    const [a, b] = await Promise.all([
      renderAndStoreThumbnail(input),
      renderAndStoreThumbnail(input),
    ]);
    expect(a).not.toBeNull();
    expect(b?.bytes.equals(a!.bytes)).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null for a blocked source and caches nothing", async () => {
    const imageUrl = "http://127.0.0.1/secret.png";
    const result = await renderAndStoreThumbnail({
      productId: "p",
      width: 96,
      sourceHash: imageSourceHash(imageUrl),
      imageUrl,
    });
    expect(result).toBeNull();
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(await readStoredThumbnail("p", 96, imageSourceHash(imageUrl))).toBeNull();
  });
});

describe("createEncodeLimiter", () => {
  it("caps concurrency, queues up to the limit, then fails fast", async () => {
    const limiter = createEncodeLimiter(1, 2);
    let releaseFirst!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    const first = limiter.run(async () => {
      markStarted();
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      return "first";
    });
    await started;
    expect(limiter.stats()).toMatchObject({ active: 1, queued: 0 });

    const second = limiter.run(async () => "second");
    const third = limiter.run(async () => "third");
    expect(limiter.stats()).toMatchObject({ active: 1, queued: 2 });

    await expect(limiter.run(async () => "fourth")).rejects.toBeInstanceOf(
      ThumbnailBusyError,
    );

    releaseFirst();
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    await expect(third).resolves.toBe("third");
    expect(limiter.stats()).toMatchObject({ active: 0, queued: 0 });
  });

  it("releases the slot when the task throws", async () => {
    const limiter = createEncodeLimiter(1, 1);
    await expect(
      limiter.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(limiter.run(async () => "ok")).resolves.toBe("ok");
    expect(limiter.stats()).toMatchObject({ active: 0, queued: 0 });
  });
});
