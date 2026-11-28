import { addAlert } from "@/lib/storage";
import { schedulePriceAlert } from "@/lib/notifications";
import type { PriceAlert } from "@/lib/types";

export interface CreatePriceAlertInput {
  productId: string;
  productName: string;
  targetPrice: number;
  currency: string;
  distributorId?: string;
  direction?: "drop" | "rise";
  dropPercent?: number;
  baselinePrice?: number;
}

export interface CreatePriceAlertResult {
  saved: boolean;
  scheduled: boolean;
  alert?: PriceAlert;
  reason?: "permission" | "duplicate" | "save_failed";
}

// Deterministic id: a double-tap or a retry after a failed schedule reuses the
// same row instead of minting a second alert. `addAlert` also dedupes on
// product/target/currency/direction, so this is belt-and-braces.
function alertIdFor(input: CreatePriceAlertInput): string {
  return [
    "alert",
    input.productId,
    input.distributorId ?? "any",
    input.direction ?? "drop",
    input.dropPercent
      ? `pct${input.dropPercent}-${input.baselinePrice ?? ""}`
      : input.targetPrice,
    input.currency,
  ].join("-");
}

/**
 * Saves the alert first, then schedules the local notification. Saving first
 * means a denied permission or scheduling failure still leaves a usable
 * in-app alert; callers report `saved && !scheduled` as "saved, notifications
 * off" instead of throwing the alert away.
 */
export async function createPriceAlert(
  input: CreatePriceAlertInput,
): Promise<CreatePriceAlertResult> {
  const { ensureNotificationPermission } = await import("@/lib/notifications");
  // Ask before the write so the browser still has the user gesture. A denied
  // prompt is not fatal; the in-app alert remains usable.
  const granted = await ensureNotificationPermission();

  const alert: PriceAlert = {
    id: alertIdFor(input),
    productId: input.productId,
    distributorId: input.distributorId,
    targetPrice: input.targetPrice,
    currency: input.currency,
    direction: input.direction,
    createdAt: new Date().toISOString(),
    isActive: true,
    ...(input.dropPercent &&
    input.baselinePrice &&
    (input.direction ?? "drop") === "drop"
      ? {
          dropPercent: input.dropPercent,
          baselinePrice: input.baselinePrice,
        }
      : {}),
  };

  let saved = false;
  try {
    saved = await addAlert(alert);
  } catch {
    return { saved: false, scheduled: false, reason: "save_failed" };
  }
  if (!saved) {
    return { saved: false, scheduled: false, reason: "duplicate" };
  }

  let scheduled = false;
  if (granted) {
    try {
      scheduled =
        (await schedulePriceAlert(
          input.productName,
          input.targetPrice,
          input.currency,
          input.productId,
        )) !== null;
    } catch {
      scheduled = false;
    }
  }

  return {
    saved,
    scheduled,
    alert,
    ...(granted ? {} : { reason: "permission" as const }),
  };
}
