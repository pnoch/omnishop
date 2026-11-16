import { isServerConfigured } from "@/constants/oauth";
import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";

export interface ProductImage {
  imageUrl: string;
  thumbnailUrl?: string;
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
    return result;
  } catch {
    return null;
  }
}
