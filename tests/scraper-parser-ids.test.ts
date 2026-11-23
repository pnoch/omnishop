import { describe, expect, it } from "vitest";
import { PARSERS } from "../lib/scrapers/registry";
import { getAllParserIds } from "../lib/scrapers/parser-ids";
import { PARSER_SITES, getSiteUrl } from "../lib/scrapers/parser-sites";

// The metadata lists are what discovery and the UI import without pulling every
// parser (and cheerio) into the web bundle. They must stay identical to the
// real set.
describe("parser metadata", () => {
  it("matches the registered parser ids in order", () => {
    expect(getAllParserIds()).toEqual(PARSERS.map((p) => p.id));
  });

  it("matches the registered parser origins in order", () => {
    expect(PARSER_SITES.map((site) => ({ id: site.id, baseUrl: site.baseUrl }))).toEqual(
      PARSERS.map((p) => ({ id: p.id, baseUrl: p.baseUrl })),
    );
  });

  it("resolves origins by id", () => {
    for (const parser of PARSERS) {
      expect(getSiteUrl(parser.id)).toBe(parser.baseUrl);
    }
    expect(getSiteUrl("not-a-parser")).toBeUndefined();
  });
});
