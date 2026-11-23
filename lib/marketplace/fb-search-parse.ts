import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import {
  THB_TEXT,
  cleanText,
  itemIdFromHref,
  listingsFromCards,
  facebookHostAllowed,
  type FbSearchListing,
} from "./fb-search";
import {
  MAX_SNAPSHOT_CARDS,
  type MarketplaceCardSnapshot,
} from "../scrapers/webview-host";

// Facebook HTML parsing. The web build resolves fb-search-parse.web.ts instead
// of this file, so cheerio stays out of the browser bundle. Tests import this
// file directly.

const ITEM_HREF = 'a[href*="/marketplace/item/"]';
const NO_RESULTS =
  /no (?:listings|results|matches)(?: found)?|ไม่พบ(?:ผลลัพธ์|สินค้า|ประกาศ)?|ไม่มี(?:ผลลัพธ์|สินค้า|ประกาศ)/i;

function absoluteItemUrl(href: string, itemId: string): string {
  if (/^https?:/i.test(href)) return href;
  try {
    return new URL(href, "https://www.facebook.com").toString();
  } catch {
    return `https://www.facebook.com/marketplace/item/${itemId}/`;
  }
}

// The smallest ancestor that contains this item link and no other item's link.
// An ancestor holding several distinct item IDs is ambiguous, so its links are
// dropped rather than risk attaching the wrong title/price/location.
function smallestCardContainer(
  $: cheerio.CheerioAPI,
  link: Element,
  itemId: string,
): Element | null {
  let node = link.parent as Element | null;
  while (node) {
    const ids = new Set<string>();
    $(node)
      .find(ITEM_HREF)
      .each((_, el) => {
        const id = itemIdFromHref($(el).attr("href") ?? "");
        if (id) ids.add(id);
      });
    if (ids.size > 1) return null;
    if (ids.size === 1 && ids.has(itemId)) return node;
    node = node.parent as Element | null;
  }
  return null;
}

function findCardLocation(
  $: cheerio.CheerioAPI,
  container: Element,
  title: string | null,
): string | null {
  let location: string | null = null;
  $(container)
    .find("span, div")
    .each((_, el) => {
      if (location) return;
      if ($(el).find(ITEM_HREF).length > 0) return;
      const text = cleanText($(el).text());
      if (!text || text.length > 60) return;
      if (/฿|THB|^\d/.test(text)) return;
      if (title && text === title) return;
      location = text;
    });
  return location;
}

export function extractFbCards(html: string): MarketplaceCardSnapshot[] {
  const $ = cheerio.load(html);
  const cards: MarketplaceCardSnapshot[] = [];
  const seen = new Set<string>();
  for (const link of $(ITEM_HREF).toArray()) {
    if (cards.length >= MAX_SNAPSHOT_CARDS) break;
    const $link = $(link);
    const href = $link.attr("href") ?? "";
    const itemId = itemIdFromHref(href);
    if (!itemId || seen.has(itemId)) continue;
    const container = smallestCardContainer($, link, itemId);
    if (!container) continue;
    seen.add(itemId);
    const title = cleanText($link.text()) || null;
    const containerText = cleanText($(container).text());
    const priceMatch = containerText.match(THB_TEXT);
    cards.push({
      itemUrl: absoluteItemUrl(href, itemId),
      title,
      priceText: priceMatch ? priceMatch[0] : null,
      location: findCardLocation($, container, title),
    });
  }
  return cards;
}

export function extractFbSearchResults(html: string): FbSearchListing[] {
  return listingsFromCards(extractFbCards(html));
}

export function detectLoginWall(html: string): boolean {
  const $ = cheerio.load(html);
  if ($('input[type="password"]').length > 0) return true;
  const body = cleanText($("body").text());
  if (
    /(you must log in|log in to continue|sign in to continue|เข้าสู่ระบบเพื่อ|ลงชื่อเข้าใช้เพื่อ)/i.test(
      body,
    )
  ) {
    return true;
  }
  // A header <a>Log in</a> alone is not a wall. Demand a login form or a
  // blocking dialog with the login affordances in it.
  let found = false;
  $('[role="dialog"], [aria-modal="true"], form').each((_, el) => {
    if (found) return;
    const text = cleanText($(el).text());
    const labelled =
      /log in|sign in|forgotten password|forgot password|email address or phone number|เข้าสู่ระบบ|ลงชื่อเข้าใช้|ลืมรหัสผ่าน|อีเมลหรือเบอร์โทรศัพท์/i.test(
        text,
      );
    if (labelled && ($(el).find("input").length > 0 || /forgot/i.test(text))) {
      found = true;
    }
  });
  return found;
}

export function detectEmptyMessage(
  html: string,
  finalUrl: string,
): string | null {
  if (!facebookHostAllowed(finalUrl)) return null;
  let path = "";
  try {
    path = new URL(finalUrl).pathname;
  } catch {
    return null;
  }
  if (!/\/marketplace\/(search|category)/.test(path)) return null;
  const $ = cheerio.load(html);
  let message: string | null = null;
  $("span, div, p, h1, h2, h3").each((_, el) => {
    if (message) return;
    const text = cleanText($(el).text());
    if (text && text.length <= 120 && NO_RESULTS.test(text)) message = text;
  });
  return message;
}

