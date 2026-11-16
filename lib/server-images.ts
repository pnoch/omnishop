import { isServerConfigured } from "@/constants/oauth";
import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";

export interface ProductImage {
  imageUrl: string;
}

export async function fetchProductImage(
  productId: string,
  opts?: { timeoutMs?: number; sourceUrl?: string },
): Promise<ProductImage | null> {
  if (!isServerConfigured()) return null;
  try {
    const client = createTRPCClient();
    const timeoutMs = opts?.timeoutMs ?? 4000;
    const result = await withTimeout(
      client.images.get.query({
        productId,
        ...(opts?.sourceUrl ? { sourceUrl: opts.sourceUrl } : {}),
      }),
      timeoutMs,
    );
    return result;
  } catch {
    return null;
  }
}
