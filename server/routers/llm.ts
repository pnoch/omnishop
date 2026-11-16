import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { isBuiltInLlmConfigured } from "../_core/llm";
import {
  UserLlmAuthError,
  invokeUserLlm,
  isServerFundedLlm,
  userLlmConfigFromHeaders,
} from "../user-llm";
import { tryConsumeBudget } from "../spend-budget";

/**
 * Probes the caller's configured BYO-LLM provider with a minimal request so the
 * settings screen can confirm a key/URL works before discovery fails on it.
 * Auth errors reuse the same classification as the real endpoints. Forge (no
 * BYO config) is a no-op: there is nothing user-supplied to test and the built-in
 * service should not be probed on every tap.
 *
 * Public (not protected): the settings screen is visible signed out, and only
 * ever uses the caller's own key — the same capability `insights.get` already
 * exposes publicly. Protected would make a signed-out "Test connection" fail
 * with a 401 that the client reads as a connectivity error.
 */
export const llmRouter = router({
  /**
   * Reports whether the server has a built-in provider. The UI uses this to
   * disable AI discovery/insights instead of letting every request fail when
   * neither Forge nor OPENAI_API_KEY is set.
   */
  status: publicProcedure.query(() => ({
    builtIn: isBuiltInLlmConfigured(),
  })),

  test: publicProcedure.mutation(async ({ ctx }) => {
    checkRateLimit(ctx, "llm.test", 10, 60_000);
    const userLlm = userLlmConfigFromHeaders(ctx.req.headers);
    if (!userLlm) {
      // No BYO provider: report the built-in service's real state. Returning
      // ok:true unconditionally told users a dead AI stack was working.
      return isBuiltInLlmConfigured()
        ? { ok: true as const, provider: "forge" as const }
        : {
            ok: false as const,
            provider: "forge" as const,
            reason: "not-configured" as const,
          };
    }
    // `ollama-local` runs on this host, so testing it is server-funded and must
    // still count against the process-wide budget.
    if (isServerFundedLlm(userLlm) && !tryConsumeBudget("llm.test")) {
      return {
        ok: false as const,
        provider: userLlm.provider,
        reason: "error" as const,
      };
    }
    try {
      await invokeUserLlm(userLlm, {
        messages: [
          { role: "user", content: "Reply with the single word: ok" },
        ],
        maxTokens: 5,
      });
      return { ok: true as const, provider: userLlm.provider };
    } catch (e) {
      return {
        ok: false as const,
        provider: userLlm.provider,
        reason: (e instanceof UserLlmAuthError ? "auth" : "error") as
          | "auth"
          | "error",
      };
    }
  }),
});
