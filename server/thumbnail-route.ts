import type { Express, Request, Response } from "express";
import {
  canServeThumbnail,
  imageSourceHash,
  readStoredThumbnail,
  renderAndStoreThumbnail,
  THUMBNAIL_WIDTHS,
  thumbnailPath,
} from "./image-thumbnail";
import { readCachedProductImageUrl } from "./product-images";
import { tryCheckRateLimitByKey } from "./rate-limit";

/**
 * Content-addressed product thumbnails.
 *
 *   GET /api/thumb/<productId>/<width>.webp?v=<sourceHash>
 *
 * The hash makes the bytes immutable; when a product's source image changes,
 * a new hash is handed out and the route redirects old URLs to the current
 * one. Only URLs previously resolved into `product_images` (or `/storage/...`
 * for generated images) can ever be fetched — the caller never supplies a
 * source URL, so this cannot be used as an SSRF proxy.
 */

export interface ThumbnailRouteDeps {
  readImageUrl: (productId: string) => Promise<string | null>;
  readThumbnail: typeof readStoredThumbnail;
  renderThumbnail: typeof renderAndStoreThumbnail;
  /** Boolean rate limiter (no TRPCError in an Express handler). */
  allow: (key: string, limit: number, windowMs: number) => boolean;
}

const defaultDeps: ThumbnailRouteDeps = {
  readImageUrl: readCachedProductImageUrl,
  readThumbnail: readStoredThumbnail,
  renderThumbnail: renderAndStoreThumbnail,
  allow: tryCheckRateLimitByKey,
};

const WIDTHS = new Set<number>(THUMBNAIL_WIDTHS);
const HASH = /^[a-f0-9]{16}$/;
const FILE = /^(\d{1,3})\.webp$/;
const RATE_LIMIT = 600;
const RATE_WINDOW_MS = 60_000;

function isValidProductId(id: string): boolean {
  if (id.length === 0 || id.length > 128) return false;
  if (id === "." || id === "..") return false;
  // Path separators, query/fragment delimiters, and control characters would
  // let a caller reach a different route or smuggle a second value.
  return !/[/\\?#\u0000-\u001f\u007f]/.test(id);
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function isFresh(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const tag = part.trim().replace(/^W\//, "");
    return tag === "*" || tag === etag;
  });
}

function noStore(res: Response, status: number, message: string): void {
  res.set("Cache-Control", "no-store");
  res.status(status).send(message);
}

function serve(
  req: Request,
  res: Response,
  thumbnail: { bytes: Buffer; contentType: string },
  sourceHash: string,
  width: number,
): void {
  const etag = `"${sourceHash}-${width}"`;
  // Safe for a year because the URL changes whenever the source image does.
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.set("ETag", etag);
  if (isFresh(req.headers["if-none-match"], etag)) {
    res.status(304).end();
    return;
  }
  res.set("Content-Type", thumbnail.contentType);
  res.set("Content-Length", String(thumbnail.bytes.length));
  res.status(200).end(thumbnail.bytes);
}

export function createThumbnailHandler(
  deps: ThumbnailRouteDeps = defaultDeps,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    const rawId = req.params.productId ?? "";
    let productId: string;
    try {
      productId = decodeURIComponent(rawId);
    } catch {
      noStore(res, 400, "Invalid product id");
      return;
    }
    if (!isValidProductId(productId)) {
      noStore(res, 400, "Invalid product id");
      return;
    }

    const file = FILE.exec(req.params.file ?? "");
    const width = file ? Number(file[1]) : NaN;
    if (!WIDTHS.has(width)) {
      noStore(res, 400, "Unsupported thumbnail width");
      return;
    }

    if (!deps.allow(`thumb:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      res.set("Retry-After", "60");
      noStore(res, 429, "Too many requests");
      return;
    }

    const version = typeof req.query.v === "string" ? req.query.v : "";
    if (!HASH.test(version)) {
      noStore(res, 400, "Missing thumbnail version");
      return;
    }

    // Fast path: the encoded bytes are already in memory or MySQL.
    const stored = await deps.readThumbnail(productId, width, version);
    if (stored) {
      serve(req, res, stored, version, width);
      return;
    }

    // Slow path: confirm the URL's hash still describes the current source.
    const imageUrl = await deps.readImageUrl(productId).catch(() => null);
    if (!imageUrl || !canServeThumbnail(imageUrl)) {
      noStore(res, 404, "No thumbnail for this product");
      return;
    }
    const currentHash = imageSourceHash(imageUrl);
    if (currentHash !== version) {
      res.set("Cache-Control", "no-store");
      res.redirect(302, thumbnailPath(productId, width, currentHash));
      return;
    }

    const rendered = await deps.renderThumbnail({
      productId,
      width,
      sourceHash: currentHash,
      imageUrl,
    });
    if (!rendered) {
      noStore(res, 404, "Thumbnail unavailable");
      return;
    }
    serve(req, res, rendered, currentHash, width);
  };
}

export function registerThumbnailRoute(app: Express): void {
  app.get("/api/thumb/:productId/:file", createThumbnailHandler());
}
