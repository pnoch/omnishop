import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "..");
const sw = readFileSync(path.join(root, "public/sw.js"), "utf8");

describe("web service worker fetch scope", () => {
  it("does not intercept cross-origin product images or API requests", () => {
    expect(sw).toContain("url.origin !== self.location.origin");
    expect(sw).toContain('url.pathname.startsWith("/api/")');
  });

  it("still handles the app shell and static asset cache", () => {
    expect(sw).toContain('event.request.mode === "navigate"');
    expect(sw).toContain("/_expo/static/");
  });
});
