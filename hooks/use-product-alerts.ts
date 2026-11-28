import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { createPriceAlert } from "@/lib/create-price-alert";
import { showAlert } from "@/lib/alert";
import { suggestAlertPrices } from "@/lib/alert-suggestions";
import {
  ALERT_PERCENT_PRESETS,
  bestAlertBaseline,
  percentTargetPrice,
} from "@/lib/alert-percent";
import type { DistributorListing, PriceAlert, Product } from "@/lib/types";

type Options = {
  id: string;
  product: Product | null;
  listings: DistributorListing[];
  visibleListings: DistributorListing[];
  displayCurrency: string;
  setAlerts: React.Dispatch<React.SetStateAction<PriceAlert[]>>;
  showToast: (message: string, tone?: "success" | "info") => void;
};

export function useProductAlerts({
  id,
  product,
  listings,
  visibleListings,
  displayCurrency,
  setAlerts,
  showToast,
}: Options) {
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertDistributorId, setAlertDistributorId] = useState<string | null>(
    null,
  );
  const [alertDirection, setAlertDirectionState] = useState<"drop" | "rise">(
    "drop",
  );
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrencyOverride, setAlertCurrencyOverride] = useState<
    string | null
  >(null);
  const alertCurrency = alertCurrencyOverride ?? displayCurrency;
  const [alertPercent, setAlertPercent] = useState<number | null>(null);
  const [alertBaseline, setAlertBaseline] = useState<number | null>(null);
  const [creatingAlert, setCreatingAlert] = useState(false);

  const alertBaselineNow = useMemo(
    () => bestAlertBaseline(listings ?? [], alertDistributorId, alertCurrency),
    [listings, alertDistributorId, alertCurrency],
  );
  const alertPercentOptions = useMemo(() => {
    if (alertBaselineNow === null) return [];
    return ALERT_PERCENT_PRESETS.flatMap((percent) => {
      const target = percentTargetPrice(alertBaselineNow, percent);
      return target === null ? [] : [{ percent, target }];
    });
  }, [alertBaselineNow]);

  const setAlertDirection = useCallback((direction: "drop" | "rise") => {
    setAlertDirectionState(direction);
    setAlertPercent(null);
    setAlertBaseline(null);
  }, []);

  const setAlertCurrency = useCallback((currency: string) => {
    setAlertCurrencyOverride(currency);
    setAlertPercent(null);
    setAlertBaseline(null);
  }, []);

  const setAlertPriceFromInput = useCallback((price: string) => {
    setAlertPrice(price);
    setAlertPercent(null);
    setAlertBaseline(null);
  }, []);

  const selectAlertDistributor = useCallback((id: string | null) => {
    setAlertDistributorId(id);
    setAlertPercent(null);
    setAlertBaseline(null);
  }, []);

  const handleSelectPercent = useCallback(
    (percent: number) => {
      const baseline = bestAlertBaseline(
        listings ?? [],
        alertDistributorId,
        alertCurrency,
      );
      if (baseline === null) return;
      const target = percentTargetPrice(baseline, percent);
      if (target === null) return;
      setAlertBaseline(baseline);
      setAlertPercent(percent);
      setAlertPrice(String(target));
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [listings, alertDistributorId, alertCurrency],
  );

  const alertSuggestions = useMemo(
    // Use the live listings, not `product.listings` (which the hook only seeds
    // from storage on load and never re-syncs after a refresh), so the suggested
    // target prices match the chart/sparkline on screen.
    () => suggestAlertPrices(listings ?? [], alertCurrency),
    [listings, alertCurrency],
  );

  const alertDistributors = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; name: string; countryCode: string }
    >();
    for (const listing of visibleListings) {
      if (seen.has(listing.distributorId)) continue;
      const dist = getDistributorById(listing.distributorId);
      seen.set(listing.distributorId, {
        id: listing.distributorId,
        name: dist?.name ?? listing.distributorId,
        countryCode: dist?.countryCode ?? "",
      });
    }
    return [...seen.values()];
  }, [visibleListings]);

  const handleSetBestAlert = useCallback(
    async (listing: DistributorListing, targetPrice: number) => {
      if (!id || creatingAlert) return;
      setCreatingAlert(true);
      try {
        const result = await createPriceAlert({
          productId: id,
          productName: product?.name ?? "Product",
          targetPrice,
          currency: listing.currency,
          distributorId: listing.distributorId,
        });
        if (result.reason === "duplicate") {
          showToast("That alert already exists", "info");
          return;
        }
        if (!result.saved || !result.alert) {
          if (Platform.OS !== "web")
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showAlert(
            "Couldn't create alert",
            "We couldn't save your price alert. Please try again.",
          );
          return;
        }
        setAlerts((prev) => [...prev, result.alert!]);
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(
          result.scheduled
            ? `Alert created — you'll be notified below ${formatPrice(targetPrice, listing.currency)}`
            : "Alert saved — enable notifications to get push alerts",
          result.scheduled ? "success" : "info",
        );
      } catch {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert(
          "Couldn't create alert",
          "We couldn't save your price alert. Please try again.",
        );
      } finally {
        setCreatingAlert(false);
      }
    },
    [id, product, setAlerts, showToast, creatingAlert],
  );

  const handleSetTarget = useCallback((distributorId: string) => {
    setAlertDistributorId(distributorId);
    setAlertDirection("drop");
    setAlertPrice("");
    setAlertPercent(null);
    setAlertBaseline(null);
    setAlertModalVisible(true);
  }, [setAlertDirection]);

  const handleSetAlert = useCallback(async () => {
    if (!id || creatingAlert) return;
    const price = parseFloat(alertPrice);
    if (!Number.isFinite(price) || price <= 0) {
      showAlert("Invalid Price", "Please enter a valid target price.");
      return;
    }
    setCreatingAlert(true);
    try {
      const percent =
        alertDirection === "drop" ? alertPercent ?? undefined : undefined;
      const baseline = percent ? alertBaseline ?? undefined : undefined;
      const result = await createPriceAlert({
        productId: id,
        productName: product?.name ?? "Product",
        targetPrice: price,
        currency: alertCurrency,
        distributorId: alertDistributorId ?? undefined,
        direction: alertDirection,
        ...(percent && baseline
          ? { dropPercent: percent, baselinePrice: baseline }
          : {}),
      });
      if (result.reason === "duplicate") {
        showToast("That alert already exists", "info");
        return;
      }
      if (!result.saved || !result.alert) {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAlert(
          "Couldn't create alert",
          "We couldn't save your price alert. Please try again.",
        );
        return;
      }
      setAlerts((prev) => [...prev, result.alert!]);
      setAlertModalVisible(false);
      setAlertPrice("");
      setAlertPercent(null);
      setAlertBaseline(null);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const scope = alertDistributorId
        ? `${getDistributorById(alertDistributorId)?.name ?? "that distributor"}'s price`
        : "the price";
      const change = percent && baseline
        ? `${percent}% below ${formatPrice(baseline, alertCurrency)} (target ${formatPrice(price, alertCurrency)})`
        : `${alertDirection === "rise" ? "rises above" : "drops below"} ${formatPrice(price, alertCurrency)}`;
      showToast(
        result.scheduled
          ? `Alert set — ${scope} ${change}`
          : "Alert saved — enable notifications to get push alerts",
        result.scheduled ? "success" : "info",
      );
    } catch {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert(
        "Couldn't create alert",
        "We couldn't save your price alert. Please try again.",
      );
    } finally {
      setCreatingAlert(false);
    }
  }, [
    id,
    product,
    alertPrice,
    alertCurrency,
    alertDistributorId,
    alertDirection,
    alertPercent,
    alertBaseline,
    setAlerts,
    showToast,
    creatingAlert,
  ]);

  return {
    alertModalVisible,
    setAlertModalVisible,
    alertDistributorId,
    setAlertDistributorId: selectAlertDistributor,
    alertDirection,
    setAlertDirection,
    alertPrice,
    setAlertPrice: setAlertPriceFromInput,
    alertCurrency,
    setAlertCurrency,
    alertPercent,
    alertBaseline,
    alertPercentOptions,
    handleSelectPercent,
    alertSuggestions,
    alertDistributors,
    creatingAlert,
    handleSetBestAlert,
    handleSetTarget,
    handleSetAlert,
  };
}
