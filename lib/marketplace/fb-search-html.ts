import {
  buildFbSearchUrl,
  classifyFbSearchPage,
  type FbSearchState,
} from "./fb-search";
import {
  detectEmptyMessage,
  detectLoginWall,
  extractFbCards,
} from "./fb-search-parse";
import {
  MAX_SNAPSHOT_HTML_CHARS,
  type MarketplacePageSnapshot,
} from "../scrapers/webview-host";

// Search orchestration for Facebook Marketplace. On device the WebView host
// returns a structured snapshot; the HTML parser is only the last-resort
// fallback. The parser module is platform-stubbed on web.
export function snapshotFromHtml(
  html: string,
  url: string,
): MarketplacePageSnapshot {
  return {
    url,
    html: html.slice(0, MAX_SNAPSHOT_HTML_CHARS),
    cards: extractFbCards(html),
    scope: { area: null, radiusKm: null },
    emptyMessage: detectEmptyMessage(html, url),
    loginVisible: detectLoginWall(html),
  };
}

export async function searchFbMarketplace(input: {
  query: string;
  location: string;
  radiusKm: number;
  loadHtml?: (url: string) => Promise<string>;
  snapshot?: (url: string) => Promise<MarketplacePageSnapshot>;
}): Promise<FbSearchState> {
  const url = buildFbSearchUrl(input);
  try {
    if (input.snapshot) return classifyFbSearchPage(await input.snapshot(url));
    const { getWebViewHost } = await import("../scrapers/webview-host");
    const host = getWebViewHost();
    if (host?.snapshot) {
      return classifyFbSearchPage(await host.snapshot(url, { timeoutMs: 25000 }));
    }
    const loadHtml =
      input.loadHtml ??
      (async (target: string) => {
        if (!host) throw new Error("unavailable");
        return host.load(target, { timeoutMs: 25000 });
      });
    return classifyFbSearchPage(snapshotFromHtml(await loadHtml(url), url));
  } catch {
    return { kind: "unavailable" };
  }
}
