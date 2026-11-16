import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// AI discovery used to advertise "Discover with AI" and then 500 on every
// request when the server had no Forge/OpenAI credentials. The UI now asks the
// server what is configured and points at Settings instead of failing.

describe("AI availability UI", () => {
  it("exposes a capability endpoint", async () => {
    const router = await readFile("server/routers/llm.ts", "utf8");
    expect(router).toContain("status: publicProcedure.query");
    expect(router).toContain("isBuiltInLlmConfigured");
  });

  it("keeps the discovery endpoint from reaching a provider", async () => {
    const router = await readFile("server/routers/discovery.ts", "utf8");
    expect(router).toContain("LLM_NOT_CONFIGURED_MSG");
    expect(router).toContain("isBuiltInLlmConfigured()");
  });

  it("checks availability before showing the discovery button", async () => {
    const hook = await readFile("hooks/use-search-screen.ts", "utf8");
    expect(hook).toContain("getLlmStatus()");
    expect(hook).toContain("AI isn't set up yet");
  });

  it("labels the footer as needing setup", async () => {
    const footer = await readFile(
      "components/search/search-discover-footer.tsx",
      "utf8",
    );
    expect(footer).toContain("AI discovery needs setup");
  });

  it("warns in settings when the built-in provider is unavailable", async () => {
    const settings = await readFile(
      "components/settings/llm-settings-section.tsx",
      "utf8",
    );
    expect(settings).toContain("Built-in AI isn't configured on this server");
  });
});
