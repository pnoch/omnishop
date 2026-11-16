import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// Shipped installers must point at the production API. A cached dev bundle or
// a release workflow without VITE_API_BASE_URL produces a "Local only" app:
// no sign-in, sync, push, or server-backed prices. These checks pin the build
// inputs, not just the runtime code.

describe("release build configuration", () => {
  it("bakes the production API URL into Android releases", async () => {
    const script = await readFile("scripts/android-release.sh", "utf8");
    expect(script).toContain(
      "https://web.omnishop.siamcreations.app",
    );
    expect(script).not.toContain("app-production-263c.up.railway.app");
  });

  it("bakes the production API URL and VAPID key into desktop releases", async () => {
    const workflow = await readFile(".github/workflows/release.yml", "utf8");
    expect(workflow).toContain(
      "VITE_API_BASE_URL: https://web.omnishop.siamcreations.app",
    );
    expect(workflow).toContain("VITE_VAPID_PUBLIC_KEY:");
  });

  it("bakes the production API URL into EAS preview/production builds", async () => {
    const eas = JSON.parse(await readFile("eas.json", "utf8")) as {
      build: Record<string, { env?: Record<string, string> }>;
    };
    for (const profile of ["preview", "production"]) {
      expect(eas.build[profile]?.env?.EXPO_PUBLIC_API_BASE_URL).toBe(
        "https://web.omnishop.siamcreations.app",
      );
      expect(eas.build[profile]?.env?.EXPO_PUBLIC_WEB_URL).toBe(
        "https://web.omnishop.siamcreations.app",
      );
    }
  });

  it("documents the release script instead of a bare Gradle build", async () => {
    const docs = await readFile("docs/releasing.md", "utf8");
    expect(docs).toContain("scripts/android-release.sh apk");
    expect(docs).not.toContain("pnpm build:apk                                 # cd android");
  });
});
