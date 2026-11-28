import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { formatPrice } from "@shared/currency";
import {
  ensureNotificationPermission,
  immediateTrigger,
} from "../notifications";
import { claimNotificationEvent, getWatchlist } from "../storage";
import {
  evaluateWatchlistDropRule,
  watchlistDropEventId,
  type WatchlistDropTrigger,
} from "../watchlist-drop-rule";
import type { AppSettings } from "../types";

const MAX_NOTIFICATIONS_PER_RUN = 3;

function formatWindow(hours: number): string {
  return hours === 168 ? "7 days" : "24 hours";
}

async function show(
  trigger: WatchlistDropTrigger,
  title: string,
  body: string,
): Promise<void> {
  if (Platform.OS === "web") {
    const { displayWebNotification } = await import("../web-notifications");
    if (!displayWebNotification(title, body)) {
      throw new Error("web notification not displayed");
    }
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type: "price", productId: trigger.productId },
      sound: true,
    },
    trigger: immediateTrigger("price"),
  });
}

/** Evaluates the watchlist-wide percentage-drop rule after prices refresh. */
export async function checkWatchlistDropRule(
  settings: AppSettings,
): Promise<void> {
  const rule = settings.watchlistDropRule;
  if (!rule?.enabled) return;
  if (!settings.notificationsEnabled || !settings.priceAlerts) return;

  const now = Date.now();
  const currency = settings.displayCurrency ?? "USD";
  const products = await getWatchlist().catch(() => []);
  const triggers = evaluateWatchlistDropRule(products, rule, currency, now)
    .slice(0, MAX_NOTIFICATIONS_PER_RUN);
  if (triggers.length === 0) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  for (const trigger of triggers) {
    const title = "Watchlist Drop Alert";
    const body = `${trigger.productName}'s best price dropped ${Math.round(
      trigger.dropPercent,
    )}% in ${formatWindow(rule.windowHours)} — now ${formatPrice(
      trigger.currentPrice,
      currency,
    )} (was ${formatPrice(trigger.baselinePrice, currency)}).`;
    const id = watchlistDropEventId(trigger, rule, now);
    const claimed = await claimNotificationEvent({
      id,
      type: "price_drop",
      title,
      body,
      productId: trigger.productId,
      triggeredPrice: trigger.currentPrice,
      currency,
      createdAt: now,
    });
    if (!claimed) continue;
    try {
      await show(trigger, title, body);
    } catch {
      // The in-app history already has the event; do not duplicate it.
    }
  }
}
