# Product thumbnail pipeline — design

Date: 2026-11-25
Status: approved (A: dedicated HTTP route + MySQL store)

## Intent

Product cards are 40–56 px, but every card requested a 1024–3000 px source,
let Sharp re-encode it, and shipped the result as a base64 data URL inside a
tRPC JSON response. That cost CPU per process, inflated the payload ~33%, and
defeated browser/native HTTP caching. The 500-entry in-process cache was lost
on every deploy and not shared between instances.

The goal is that a thumbnail is fetched and encoded **once per source image and
width**, then served from a content-addressed URL that browsers, the PWA shell,
and React Native can cache indefinitely.

## Goals

- One encode per `(product, width, source)` for the life of the deployment.
- Real HTTP caching: `Cache-Control: public, max-age=31536000, immutable`,
  `ETag`, `304` on revalidation.
- A thumbnail URL that is safe to embed and cannot be pointed at arbitrary
  hosts (no SSRF, no user-controlled source URL).
- Survive restarts and work on the current single Railway service without new
  infrastructure.
- Fix the `/storage/...` generated-image gap: those images currently fall back
  to the full-size, `no-store` proxy.
- Keep `images.get` fast: it returns a URL, it does not encode bytes.

## Non-goals

- Moving blobs to object storage (option B) or a disk cache (option C).
- Changing image discovery, source allowlists, or the paid generation path.
- Art-direction, responsive `srcset`, or AVIF.
- Desktop UI work beyond passing the width through the same endpoint.

## Constraints

- `product_images.imageUrl` is the source of truth for the current image.
- Source URLs may be absolute (distributor/CDN) or `/storage/<key>` (generated).
- MySQL 8.4 is already required; object storage is optional in local/dev.
- Product IDs are at most 128 chars and arrive from user watchlists, so the
  endpoint must treat them as untrusted.
- `sharp` and the existing 8 MB source cap stay.

## Approaches considered

- **A. HTTP route + MySQL blob store (picked).** Portable, no new credentials,
  survives restarts, testable end to end.
- **B. Forge/S3 object storage.** Leaner DB, multi-instance, but presigned
  URLs expire and the backend is not configured locally, so it cannot be
  verified here.
- **C. Disk cache.** Simplest, but wiped on every Railway deploy and not
  shared across instances.

## Architecture

```
images.get ──► product_images (image URL)          (unchanged, no encoding)
     │
     └─ returns { imageUrl, thumbnailUrl:
          /api/thumb/<id>/<w>.webp?v=<hash> }

GET /api/thumb/<id>/<w>.webp?v=<hash>
     ├─ memory LRU (500) ─► product_thumbnails (PK id+w+hash)
     └─ miss ─► read cached image URL ─► validate hash
                ├─ mismatch: 302 to canonical URL
                └─ match: fetch source (http(s) or /storage presign),
                          Sharp → WebP q72, store base64, serve
```

### URL contract

- `id`: URI-encoded product ID, 1–128 chars, no `/`, `\`, NUL, `..`.
- `w`: one of `64, 96, 128, 192, 256`. Other values are `400`. Requests are
  snapped up to the next allowed width, so clients cannot fragment the cache.
- `v`: 16 hex chars of `sha256(imageUrl)`. A stale/absent `v` gets a `302` to
  the canonical URL with `no-store`, so an immutable response is only ever
  cached under the hash that produced it.
- `200` → `image/webp`, immutable, `ETag: "<hash>-<width>"`, `Content-Length`.
- `304` when `If-None-Match` matches.
- `404` for an unknown product, unsafe source, or failed encode (no-store).
- `429` above 600 requests/minute per client IP.

Rate limiting is per IP because the endpoint is public; the existing
`checkRateLimit*` helpers throw `TRPCError`, so a boolean variant is added for
Express handlers.

### Data model

`product_thumbnails(productId varchar(128), width smallint, sourceHash
varchar(16), contentType varchar(32), data mediumtext, createdAt bigint)` with
a composite primary key. `data` is base64 WebP (a 96 px thumbnail is ~2–4 KB).
Rows for a replaced source hash are deleted when a new hash is stored, and the
existing warmer tick drops rows whose product no longer has an image.

### Fetching the source

- Absolute URLs: re-check `isBlockedUrl`, require `image/*`, cap at 8 MB.
- `/storage/<key>`: new `storageGet` helper presigns and fetches the object via
  Forge, validating the key first; returns `null` when storage is unconfigured.
- `canServeThumbnail` decides whether `images.get` advertises a thumbnail at
  all, so unconfigured storage keeps the old full-image fallback instead of
  turning every generated image into a placeholder.

### Failure behaviour

- Encode/fetch failure: `404` with `no-store`; the client shows its existing
  placeholder and does not cache the miss.
- DB failure: serve/keep the in-memory copy; a failed write never blocks a
  response.
- Restart: rows are re-read from MySQL, so no re-fetch storm.
- Concurrent misses for one key share a single in-flight promise.

## Rollout

1. Commit the generated migration; deploys run `pnpm db:migrate` (or
   `drizzle-kit migrate` in-container) before the new server starts.
2. The table is additive; old clients keep working because `images.get` still
   returns `imageUrl` and `thumbnailUrl` remains an optional string.
3. No cache warm-up is required: the first card view generates the row.

## Testing

- Unit: width snapping, hash stability, WebP encode, unsafe sources.
- Route: 200/304/302/404, immutable headers, traversal rejection, no-store on
  misses.
- Router: `thumbWidth` produces the canonical URL; blocked sources do not.
- Client: relative `/api/thumb` URLs are resolved against the API base.
- DB-gated: store → read survives a memory-cache clear; old hashes are pruned.
- Gates: `pnpm check`, lint, full suite, desktop suite/build/audit, budget.
