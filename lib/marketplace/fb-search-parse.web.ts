import type { MarketplaceCardSnapshot } from "../scrapers/webview-host";

// Web has no HTML parser: the WebView bridge is the only path that can read a
// marketplace page there, and it returns a structured snapshot. Returning an
// empty reading keeps verification unverified rather than falsely ready.
export function extractFbCards(_html: string): MarketplaceCardSnapshot[] {
  return [];
}

export function extractFbSearchResults(_html: string) {
  return [];
}

export function detectLoginWall(_html: string): boolean {
  return false;
}

export function detectEmptyMessage(_html: string, _finalUrl: string): string | null {
  return null;
}
