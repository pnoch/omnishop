import type { ProbeCapability, Verification } from "./connections";
import type {
  MarketplaceCardSnapshot,
  MarketplacePageSnapshot,
} from "../scrapers/webview-host";

// Lightweight Facebook Marketplace helpers. HTML parsing needs cheerio and
// lives in ./fb-search-html so this module (imported by the shared UI) stays
// free of that weight.
export interface FbSearchListing {
  itemId: string;
  title: string;
  price: number | null;
  currency: "THB" | null;
  location: string | null;
  url: string;
}

export interface ObservedSearchScope {
  area: string | null;
  radiusKm: number | null;
}

export function buildFbSearchUrl(input: { query: string; location: string; radiusKm: number }): string {
  const params = new URLSearchParams({ query: input.query.trim() });
  if (input.location.trim()) params.set("location", input.location.trim());
  params.set("radius", String(input.radiusKm));
  return `https://www.facebook.com/marketplace/search/?${params.toString().replace(/\+/g, "%20")}`;
}

// A price is only accepted when a THB marker is observed on the same card;
// a bare number or a foreign currency stays unknown.
export const THB_TEXT = /(?:฿|THB)\s*[\d,]+(?:\.\d{1,2})?/i;
const MAX_RESULTS = 20;
const FACEBOOK_ALLOWED_HOSTS = new Set([
  "www.facebook.com",
  "web.facebook.com",
  "m.facebook.com",
]);

export function itemIdFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const match = /\/marketplace\/item\/([1-9]\d{0,19})(?:\/|$|\?|#)/.exec(href);
  return match ? match[1]! : null;
}

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseThbPrice(text: string | null): number | null {
  if (!text) return null;
  const match = THB_TEXT.exec(text);
  if (!match) return null;
  const value = Number(match[0].replace(/[^\d.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function listingsFromCards(
  cards: readonly MarketplaceCardSnapshot[],
): FbSearchListing[] {
  const listings: FbSearchListing[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (listings.length >= MAX_RESULTS) break;
    const itemId = itemIdFromHref(card.itemUrl);
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    const price = parseThbPrice(card.priceText);
    listings.push({
      itemId,
      title: card.title ?? "",
      price,
      currency: price == null ? null : "THB",
      location: card.location,
      url: `https://www.facebook.com/marketplace/item/${itemId}/`,
    });
  }
  return listings;
}

export function facebookHostAllowed(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "443") return false;
  return FACEBOOK_ALLOWED_HOSTS.has(url.hostname.toLowerCase());
}

export type FbSearchState =
  | {
      kind: "listings";
      listings: FbSearchListing[];
      observedScope: ObservedSearchScope;
    }
  | { kind: "login_required" }
  | { kind: "empty" }
  | { kind: "unverified"; reason: string }
  | { kind: "unavailable" };

// Observed scope comes from the page, never from the requested URL params: a
// redirect to San Francisco must not be reported as the Bangkok we asked for.
export function classifyFbSearchPage(
  snapshot: MarketplacePageSnapshot,
): FbSearchState {
  if (snapshot.loginVisible) return { kind: "login_required" };
  if (!facebookHostAllowed(snapshot.url)) {
    return { kind: "unverified", reason: "final-host" };
  }
  const listings = listingsFromCards(snapshot.cards);
  if (listings.length > 0) {
    return { kind: "listings", listings, observedScope: snapshot.scope };
  }
  if (snapshot.emptyMessage) return { kind: "empty" };
  return { kind: "unverified", reason: "unreadable" };
}

export interface ListingProbeReading {
  identityMatched: boolean;
  price: number | null;
}

export function facebookListingReader(expectedItemId: string) {
  return (snapshot: MarketplacePageSnapshot): ListingProbeReading => {
    const match = listingsFromCards(snapshot.cards).find(
      (listing) => listing.itemId === expectedItemId,
    );
    return { identityMatched: Boolean(match), price: match?.price ?? null };
  };
}

// Turns a rendered page into a verification state for one capability.
// Navigation-only probes can never be ready. A search probe needs recognized
// cards or a verified-empty search page. A listing probe needs identity plus a
// readable price, supplied per site (Facebook cards; Shopee/Lazada reuse their
// own extractors through readListing).
export function evaluateProbe(input: {
  capability: ProbeCapability;
  snapshot: MarketplacePageSnapshot;
  readListing?: (snapshot: MarketplacePageSnapshot) => ListingProbeReading;
  hostAllowed?: (url: string) => boolean;
  now?: string;
}): Verification {
  const checkedAt = input.now ?? new Date().toISOString();
  if (input.capability.kind === "navigation") {
    return { kind: "unverified", checkedAt, reason: "navigation-only" };
  }
  if (input.snapshot.loginVisible) return { kind: "login_required", checkedAt };
  const hostAllowed = input.hostAllowed ?? facebookHostAllowed;
  if (!hostAllowed(input.snapshot.url)) {
    return { kind: "unverified", checkedAt, reason: "final-host" };
  }
  if (input.capability.kind === "search") {
    const listings = listingsFromCards(input.snapshot.cards);
    if (listings.length > 0 || input.snapshot.emptyMessage) {
      return { kind: "ready", checkedAt, capability: input.capability };
    }
    return { kind: "unverified", checkedAt, reason: "no-recognized-results" };
  }
  if (!input.readListing) {
    return { kind: "unverified", checkedAt, reason: "no-listing-reader" };
  }
  const reading = input.readListing(input.snapshot);
  if (reading.identityMatched && reading.price != null) {
    return { kind: "ready", checkedAt, capability: input.capability };
  }
  return { kind: "unverified", checkedAt, reason: "listing-unconfirmed" };
}
