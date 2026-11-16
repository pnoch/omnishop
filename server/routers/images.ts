import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { getProductImage } from "../product-images";

export const imagesRouter = router({
  get: publicProcedure
    .input(
      z.object({
        productId: z.string().min(1).max(191),
        // sourceUrl is the older single-URL shape; keep it for cached clients.
        sourceUrl: z.string().max(2048).optional(),
        sourceUrls: z.array(z.string().max(2048)).max(8).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "images.get", 30, 60_000);
      const sources =
        input.sourceUrls ?? (input.sourceUrl ? [input.sourceUrl] : undefined);
      return getProductImage(input.productId, sources);
    }),
});
