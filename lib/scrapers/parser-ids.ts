// Lightweight parser metadata. Screens and discovery use the IDs, but importing
// registry.ts pulls every parser and cheerio into the web bundle. Keep the list
// here in sync with PARSERS; tests/scraper-parser-ids.test.ts enforces it.
export const PARSER_IDS = [
  "server2u-my",
  "linitx-uk",
  "interprojekt-pl",
  "nasstore-eu",
  "aerial-gr",
  "mikrotikstore-de",
  "miro-za",
  "gearup-ae",
  "balticnetworks-us",
  "linktechs-us",
  "winncom-us",
  "bhphoto-us",
  "duxtel-au",
  "wisp-au",
  "pbtech-nz",
  "gowifi-nz",
  "getic-gr",
  "100mega-cz",
  "hellascom-gr",
  "rocnoc-us",
  "networkdevices-us",
  "flytec-us",
  "mbsiwav-ca",
  "multilink-us",
  "neobits-us",
  "shopee-th",
  "lazada-th",
  "ebay-us",
] as const;

export type ParserId = (typeof PARSER_IDS)[number];

export function getAllParserIds(): string[] {
  return [...PARSER_IDS];
}
