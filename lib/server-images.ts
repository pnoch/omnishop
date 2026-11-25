import { API_BASE_URL, isServerConfigured } from "@/constants/oauth";
import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";

export interface ProductImage {
  imageUrl: string;
  thumbnailUrl?: string;
}

/**
 * API responses carry same-origin paths for thumbnails and generated images
 * (`/api/thumb/...`, `/storage/...`). Web can load them directly; the native
 * image loader needs an absolute URL, so prefix the configured API base.
 */
export function resolveProductImageUrl(
  url: string | undefined,
): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith("/") || !API_BASE_URL) return url;
  return `${API_BASE_URL.replace(/\/+$/, "")}${url}`;
}

export async function fetchProductImage(
  productId: string,
  opts?: {
    timeoutMs?: number;
    sourceUrl?: string;
    sourceUrls?: string[];
    thumbWidth?: number;
  },
): Promise<ProductImage | null> {
  if (!isServerConfigured()) return null;
  try {
    const client = createTRPCClient();
    const timeoutMs = opts?.timeoutMs ?? 6000;
    const sources =
      opts?.sourceUrls ?? (opts?.sourceUrl ? [opts.sourceUrl] : undefined);
    const result = await withTimeout(
      client.images.get.query({
        productId,
        ...(sources?.length ? { sourceUrls: sources } : {}),
        ...(opts?.thumbWidth ? { thumbWidth: opts.thumbWidth } : {}),
      }),
      timeoutMs,
    );
    if (!result) return result;
    return {
      imageUrl: resolveProductImageUrl(result.imageUrl)!,
      ...(result.thumbnailUrl
        ? { thumbnailUrl: resolveProductImageUrl(result.thumbnailUrl) }
        : {}),
    };
  } catch {
    return null;
  }
}
