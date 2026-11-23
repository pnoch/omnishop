// Parser origins without the parser implementations. Screens that only need a
// distributor's URL import this instead of registry.ts, which pulls every parser
// (and cheerio) into the shared web chunk. tests/scraper-parser-ids.test.ts
// enforces that this list stays in sync with PARSERS.
export const PARSER_SITES = [
  { id: "server2u-my", baseUrl: "https://server2u.com" },
  { id: "linitx-uk", baseUrl: "https://linitx.com" },
  { id: "interprojekt-pl", baseUrl: "https://interprojekt.pl" },
  { id: "nasstore-eu", baseUrl: "https://nasstore.eu" },
  { id: "aerial-gr", baseUrl: "https://aerial.net" },
  { id: "mikrotikstore-de", baseUrl: "https://www.mikrotik-store.eu" },
  { id: "miro-za", baseUrl: "https://miro.co.za" },
  { id: "gearup-ae", baseUrl: "https://gear-up.me" },
  { id: "balticnetworks-us", baseUrl: "https://balticnetworks.com" },
  { id: "linktechs-us", baseUrl: "https://shop.linktechs.net" },
  { id: "winncom-us", baseUrl: "https://winncom.com" },
  { id: "bhphoto-us", baseUrl: "https://bhphotovideo.com" },
  { id: "duxtel-au", baseUrl: "https://store.duxtel.com" },
  { id: "wisp-au", baseUrl: "https://wisp.net.au" },
  { id: "pbtech-nz", baseUrl: "https://pbtech.co.nz" },
  { id: "gowifi-nz", baseUrl: "https://gowifi.co.nz" },
  { id: "getic-gr", baseUrl: "https://getic.com" },
  { id: "100mega-cz", baseUrl: "https://b2b.100mega.com" },
  { id: "hellascom-gr", baseUrl: "https://www.linkshop.gr" },
  { id: "rocnoc-us", baseUrl: "https://www.roc-noc.com" },
  { id: "networkdevices-us", baseUrl: "https://networkdevicesinc.com" },
  { id: "flytec-us", baseUrl: "https://flyteccomputers.com" },
  { id: "mbsiwav-ca", baseUrl: "https://mbsiwav.com" },
  { id: "multilink-us", baseUrl: "https://shop.multilink.us" },
  { id: "neobits-us", baseUrl: "https://neobits.com" },
  { id: "shopee-th", baseUrl: "https://shopee.co.th" },
  { id: "lazada-th", baseUrl: "https://www.lazada.co.th" },
  { id: "ebay-us", baseUrl: "https://www.ebay.com" },
] as const;

export type ParserSite = (typeof PARSER_SITES)[number];

export function getSiteUrl(distributorId: string): string | undefined {
  return PARSER_SITES.find((site) => site.id === distributorId)?.baseUrl;
}
