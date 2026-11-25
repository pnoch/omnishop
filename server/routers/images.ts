import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { getProductImage, readCachedProductImageUrl } from "../product-images";

export const imagesRouter = router({
  get: publicProcedure
    .input(
      z.object({
        productId: z.string().min(1).max(191),
        // sourceUrl is the older single-URL shape; keep it for cached clients.
        sourceUrl: z.string().max(2048).optional(),
        sourceUrls: z.array(z.string().max(2048)).max(8).optional(),
        thumbWidth: z.number().int().min(16).max(512).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // One call per product card, so a large watchlist must fit in a minute.
      // Cached rows are a single indexed read; only a miss can fan out to
      // distributor pages, so discovery keeps its own tight budget.
      checkRateLimit(ctx, "images.get", 600, 60_000);
      const cached = await readCachedProductImageUrl(input.productId);
      if (!cached) {
        checkRateLimit(ctx, "images.resolve", 60, 60_000);
      }
      const sources =
        input.sourceUrls ?? (input.sourceUrl ? [input.sourceUrl] : undefined);
      return getProductImage(input.productId, sources, input.thumbWidth);
    }),
});
