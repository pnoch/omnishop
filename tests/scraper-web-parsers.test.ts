import { describe, expect, it } from "vitest";
import { createWebParsers } from "../lib/scrapers/web-parsers";
import { PARSER_SITES } from "../lib/scrapers/parser-sites";

// The web build swaps registry.ts for registry.web.ts, which builds these
// stubs. They must still enumerate the same distributors so health and
// discovery keep showing the catalog.
describe("web parser stubs", () => {
  it("covers every parser id and origin", () => {
    expect(createWebParsers().map((p) => ({ id: p.id, baseUrl: p.baseUrl }))).toEqual(
      PARSER_SITES.map((site) => ({ id: site.id, baseUrl: site.baseUrl })),
    );
  });

  it("builds a search url and never claims a price", () => {
    const parser = createWebParsers()[0]!;
    expect(parser.buildSearchUrl("CRS326-24G")).toContain("CRS326-24G");
    expect(parser.parsePrice("<html></html>", "CRS326-24G")).toBeNull();
  });
});
