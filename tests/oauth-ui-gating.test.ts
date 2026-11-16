import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// QA audit: the Account section rendered "Continue with Google/Apple" even when
// the server reported both providers unconfigured, and the old /start fallback
// pointed at /api/oauth/authorize, a route that was never registered. Users
// clicked a dead sign-in path. These tests pin the configured-only UI and the
// server's explicit 503 guard.

describe("OAuth UI gating", () => {
  it("fetches the provider list before rendering buttons", async () => {
    const hook = await readFile("hooks/use-account-section.ts", "utf8");
    expect(hook).toContain("/api/auth/oauth/providers");
    expect(hook).toContain("setOauthProviders");
  });

  it("renders the account buttons only when a provider is configured", async () => {
    const section = await readFile("components/settings/account-section.tsx", "utf8");
    expect(section).toContain(
      "{!isAuthenticated && (oauthProviders.google || oauthProviders.apple) && (",
    );
  });

  it("gates each provider button individually", async () => {
    const buttons = await readFile(
      "components/settings/account-oauth-buttons.tsx",
      "utf8",
    );
    expect(buttons).toContain("oauthProviders.google &&");
    expect(buttons).toContain("oauthProviders.apple &&");
  });

  it("has no fallback to the unregistered /api/oauth/authorize route", async () => {
    const server = await readFile("server/_core/oauth.ts", "utf8");
    expect(server).not.toContain("/api/oauth/authorize");
    expect(server).toContain("sign-in is not configured on this server");
  });
});
