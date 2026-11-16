import { withTimeout } from "../../../lib/with-timeout";

const TIMEOUT_MS = 20_000;

export interface LlmTestResult {
  ok: boolean;
  provider: string;
  reason?: "auth" | "error" | "not-configured";
}

export interface LlmStatus {
  builtIn: boolean;
}

/** Whether the server can run AI without a user-supplied key. */
export async function getLlmStatus(): Promise<LlmStatus | null> {
  try {
    const { createTRPCClient } = await import("./trpc");
    const status = await withTimeout(createTRPCClient().llm.status.query(), 8_000);
    return { builtIn: status?.builtIn === true };
  } catch {
    return null;
  }
}

/**
 * Probes the user's configured BYO-LLM provider (via the server proxy) so the
 * settings screen can confirm the key/URL works. Returns null when the server
 * is unreachable or the call times out (parity with mobile's `testLlmConnection`
 * — without the deadline an unreachable server hangs the button until the OS
 * TCP timeout). The tRPC client forwards the x-llm-* headers from settings.
 */
export async function testLlmConnection(): Promise<LlmTestResult | null> {
  try {
    const { createTRPCClient } = await import("./trpc");
    return await withTimeout(createTRPCClient().llm.test.mutate(), TIMEOUT_MS);
  } catch {
    return null;
  }
}
