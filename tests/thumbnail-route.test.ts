import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import {
  createThumbnailHandler,
  type ThumbnailRouteDeps,
} from "../server/thumbnail-route";
import {
  imageSourceHash,
  thumbnailPath,
  ThumbnailBusyError,
} from "../server/image-thumbnail";

const IMAGE_URL = "https://cdn.example.com/product.png";
const HASH = imageSourceHash(IMAGE_URL);
const BYTES = Buffer.from("fake-webp-bytes");
const ID = "mikrotik-crs326-24s";

let server: Server | null = null;

function deps(overrides: Partial<ThumbnailRouteDeps> = {}): ThumbnailRouteDeps {
  return {
    readImageUrl: vi.fn(async () => IMAGE_URL),
    readThumbnail: vi.fn(async () => null),
    renderThumbnail: vi.fn(async () => ({
      bytes: BYTES,
      contentType: "image/webp",
      at: Date.now(),
    })),
    allow: () => true,
    ...overrides,
  };
}

async function withServer(
  routeDeps: ThumbnailRouteDeps,
  run: (base: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.get("/api/thumb/:productId/:file", createThumbnailHandler(routeDeps));
  server = app.listen(0);
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("no port");
  await run(`http://127.0.0.1:${address.port}`);
}

afterEach(() => {
  server?.close();
  server = null;
});

describe("thumbnail route", () => {
  it("serves stored bytes as an immutable, content-addressed resource", async () => {
    const readImageUrl = vi.fn(async () => IMAGE_URL);
    await withServer(
      deps({
        readImageUrl,
        readThumbnail: vi.fn(async () => ({
          bytes: BYTES,
          contentType: "image/webp",
          at: Date.now(),
        })),
      }),
      async (base) => {
        const res = await fetch(
          `${base}${thumbnailPath(ID, 96, HASH)}`,
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/webp");
        expect(res.headers.get("cache-control")).toBe(
          "public, max-age=31536000, immutable",
        );
        expect(res.headers.get("etag")).toBe(`"${HASH}-96"`);
        expect(Buffer.from(await res.arrayBuffer())).toEqual(BYTES);
        // The fast path must not touch product_images.
        expect(readImageUrl).not.toHaveBeenCalled();
      },
    );
  });

  it("answers a matching If-None-Match with 304 and keeps the cache headers", async () => {
    await withServer(
      deps({
        readThumbnail: vi.fn(async () => ({
          bytes: BYTES,
          contentType: "image/webp",
          at: Date.now(),
        })),
      }),
      async (base) => {
        const res = await fetch(`${base}${thumbnailPath(ID, 96, HASH)}`, {
          headers: { "if-none-match": `W/"${HASH}-96"` },
        });
        expect(res.status).toBe(304);
        expect(res.headers.get("cache-control")).toBe(
          "public, max-age=31536000, immutable",
        );
        expect((await res.arrayBuffer()).byteLength).toBe(0);
      },
    );
  });

  it("renders and stores on a miss after confirming the current hash", async () => {
    const renderThumbnail = vi.fn(async () => ({
      bytes: BYTES,
      contentType: "image/webp",
      at: Date.now(),
    }));
    await withServer(deps({ renderThumbnail }), async (base) => {
      const res = await fetch(`${base}${thumbnailPath(ID, 96, HASH)}`);
      expect(res.status).toBe(200);
      expect(renderThumbnail).toHaveBeenCalledWith({
        productId: ID,
        width: 96,
        sourceHash: HASH,
        imageUrl: IMAGE_URL,
      });
    });
  });

  it("redirects a stale hash to the canonical URL without caching the redirect", async () => {
    const renderThumbnail = vi.fn();
    const stale = "aaaaaaaaaaaaaaaa";
    await withServer(deps({ renderThumbnail }), async (base) => {
      const res = await fetch(`${base}${thumbnailPath(ID, 96, stale)}`, {
        redirect: "manual",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(thumbnailPath(ID, 96, HASH));
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(renderThumbnail).not.toHaveBeenCalled();
    });
  });

  it("404s an unknown product and does not render", async () => {
    const renderThumbnail = vi.fn();
    await withServer(
      deps({ readImageUrl: vi.fn(async () => null), renderThumbnail }),
      async (base) => {
        const res = await fetch(`${base}${thumbnailPath(ID, 96, HASH)}`);
        expect(res.status).toBe(404);
        expect(res.headers.get("cache-control")).toBe("no-store");
        expect(renderThumbnail).not.toHaveBeenCalled();
      },
    );
  });

  it("404s when the source cannot be encoded", async () => {
    await withServer(
      deps({ renderThumbnail: vi.fn(async () => null) }),
      async (base) => {
        const res = await fetch(`${base}${thumbnailPath(ID, 96, HASH)}`);
        expect(res.status).toBe(404);
        expect(res.headers.get("cache-control")).toBe("no-store");
      },
    );
  });

  it("rejects unsupported widths and missing versions", async () => {
    await withServer(deps(), async (base) => {
      const width = await fetch(`${base}/api/thumb/${ID}/100.webp?v=${HASH}`);
      expect(width.status).toBe(400);

      const version = await fetch(`${base}/api/thumb/${ID}/96.webp`);
      expect(version.status).toBe(400);
      expect(version.headers.get("cache-control")).toBe("no-store");
    });
  });

  it("rejects product ids that try to escape the route segment", async () => {
    await withServer(deps(), async (base) => {
      const res = await fetch(`${base}/api/thumb/a%2Fb/96.webp?v=${HASH}`);
      expect(res.status).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
    });
  });

  it("answers 503 with Retry-After when the encoder queue is full", async () => {
    await withServer(
      deps({
        renderThumbnail: vi.fn(async () => {
          throw new ThumbnailBusyError();
        }),
      }),
      async (base) => {
        const res = await fetch(`${base}${thumbnailPath(ID, 96, HASH)}`);
        expect(res.status).toBe(503);
        expect(res.headers.get("retry-after")).toBe("5");
        expect(res.headers.get("cache-control")).toBe("no-store");
      },
    );
  });

  it("rate limits with Retry-After instead of throwing a TRPC error", async () => {
    await withServer(deps({ allow: () => false }), async (base) => {
      const res = await fetch(`${base}${thumbnailPath(ID, 96, HASH)}`);
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("60");
      expect(res.headers.get("cache-control")).toBe("no-store");
    });
  });
});
