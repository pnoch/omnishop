import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// The web export resolves fb-search-parse.web.ts, which returns empty readings
// instead of shipping cheerio. Keep the parser (and therefore cheerio) behind
// that single platform file.
describe("facebook HTML parser is platform-split", () => {
  it("only the native parser module imports cheerio", () => {
    const importers = ["app", "components", "hooks", "lib/marketplace"]
      .flatMap((dir) => sourceFiles(path.join(process.cwd(), dir)))
      .filter((file) => /from "cheerio"/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));
    // Parser modules under lib/scrapers (other than the platform-split ones)
    // are native-only, so they may import cheerio.
    expect(importers).toEqual(["lib/marketplace/fb-search-parse.ts"]);
  });

  it("the Shopee web stub parses nothing and imports no parser", async () => {
    const src = readFileSync(
      path.join(process.cwd(), "lib/scrapers/shopee-price.web.ts"),
      "utf8",
    );
    expect(src).not.toContain('from "cheerio"');
    expect(src).not.toContain('from "domhandler"');
    const mod = await import("../lib/scrapers/shopee-price.web");
    expect(mod.parseShopeePrice("<html></html>", "1", "2")).toBeNull();
  });

  it("the web stub has no cheerio or parse dependencies", () => {
    const src = readFileSync(
      path.join(process.cwd(), "lib/marketplace/fb-search-parse.web.ts"),
      "utf8",
    );
    expect(src).not.toContain("cheerio");
    expect(src).not.toContain("domhandler");
  });
});
