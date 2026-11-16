import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { getProductImage } from "../product-images";

export const imagesRouter = router({
  get: publicProcedure
    .input(
      z.object({
        productId: z.string().min(1).max(191),
        sourceUrl: z.string().max(2048).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "images.get", 30, 60_000);
      return getProductImage(input.productId, input.sourceUrl);
    }),
});
