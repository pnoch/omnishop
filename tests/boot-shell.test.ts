import { describe, expect, it } from "vitest";
import { withBootShell, withPwaHead } from "../server/spa";

const shell = `<!doctype html><html><head><title>OmniShop</title></head><body><div id="root"></div><script src="/app.js" defer></script></body></html>`;

describe("withBootShell", () => {
  it("paints a static shell before the JS bundle runs", () => {
    const out = withBootShell(shell);
    expect(out).toContain('id="boot-shell-style"');
    expect(out).toContain('<div id="root">');
    expect(out).toContain("boot-shell__mark");
    expect(out).toContain("OmniShop");
    expect(out).toContain("Loading your radar");
    // The script still loads and can replace the shell.
    expect(out).toContain('src="/app.js"');
  });

  it("is idempotent", () => {
    const once = withBootShell(shell);
    expect(withBootShell(once)).toBe(once);
  });

  it("composes with the PWA head injection", () => {
    const out = withBootShell(withPwaHead(shell));
    expect(out).toContain('rel="manifest"');
    expect(out).toContain('id="boot-shell-style"');
  });
});
