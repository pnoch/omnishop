// Web resolves this file instead of registry.ts, keeping the real parsers (and
// cheerio) out of the initial web bundle. React Native and tests use the real
// registry.
import type { DistributorParser } from "./types";
import { WEB_PARSERS } from "./web-parsers";

export const PARSERS: DistributorParser[] = WEB_PARSERS;

export function getParserByDistributorId(
  distributorId: string,
): DistributorParser | undefined {
  return PARSERS.find((p) => p.id === distributorId);
}

export { getAllParserIds } from "./parser-ids";
