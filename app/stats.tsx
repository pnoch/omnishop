import { log } from "@shared/log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { goBackOrHome } from "@/lib/navigation";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { PageHeader } from "@/components/ui/page-header";
import { useColors } from "@/hooks/use-colors";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { getAlerts, getSettings, getWatchlist, getPriceDigestSnapshot, updateSettings } from "@/lib/storage";
import { BasketAlertSheet } from "@/components/stats/basket-alert-sheet";
import type { Product, AppSettings, PriceAlert } from "@/lib/types";
import {
  computeBasketValue,
  computeDataFreshness,
  computeMovers,
  computeStockHealth,
  type MoversWindow,
} from "@/lib/watchlist-stats";
import { computeProductInsights } from "@/lib/product-insights";
import { activeProducts } from "@/lib/acquired";
import { computeDropCalendar } from "@/lib/drop-calendar";
import { InsightsCard } from "@/components/stats/insights-card";
import { DropCalendarCard } from "@/components/stats/drop-calendar-card";
import {
  computeDigest,
  type DigestSnapshot,
} from "@/lib/price-digest";
import { DigestCard } from "@/components/stats/digest-card";
import { rankDeals } from "@/lib/deal-score";
import { buildWatchlistShareText } from "@/lib/watchlist-share";
import { shareText } from "@/lib/share-text";
import { captureAndShareImage } from "@/lib/share-image";
import { StatsShareCard } from "@/components/share/stats-share-card";
import { showAlert } from "@/lib/alert";
import { MoversCard } from "@/components/stats/movers-card";
import { BasketValueCard } from "@/components/stats/basket-value-card";
import { StockHealthCard } from "@/components/stats/stock-health-card";
import { DataFreshnessCard } from "@/components/stats/data-freshness-card";

export default function StatsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [watchlist, setWatchlist] = useState<Product[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [days, setDays] = useState<MoversWindow>(30);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [digestSnapshot, setDigestSnapshot] = useState<DigestSnapshot | null>(
    null,
  );
  const [digestFrequency, setDigestFrequency] = useState<string>("off");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [basketThreshold, setBasketThreshold] = useState<number | null>(null);
  const [basketSheetVisible, setBasketSheetVisible] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedRef = useRef(loaded);
  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  const load = useCallback(async () => {
    const isFirst = !loadedRef.current;
    if (isFirst) setLoaded(false);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const [wl, loadedSettings, snapshot, loadedAlerts] = await Promise.all([
        getWatchlist(),
        getSettings(),
        getPriceDigestSnapshot(),
        getAlerts(),
      ]);
      setWatchlist(wl);
      setSettings(loadedSettings);
      setDisplayCurrency(loadedSettings?.displayCurrency ?? "USD");
      setDigestFrequency(loadedSettings?.digestFrequency ?? "off");
      setBasketThreshold(loadedSettings?.basketAlertThreshold ?? null);
      setDigestSnapshot(snapshot);
      setAlerts(loadedAlerts);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isFirst) setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const digest = useMemo(() => {
    if (!digestSnapshot || !settings || digestFrequency === "off") return null;
    return computeDigest(digestSnapshot, watchlist, settings, alerts);
  }, [digestSnapshot, watchlist, settings, alerts, digestFrequency]);

  const digestPlaceholder = useMemo(() => {
    if (watchlist.length === 0) return null;
    if (digestFrequency === "off") return "off" as const;
    // Enabled but no snapshot yet: the first digest hasn't been delivered, so
    // there is nothing to diff against. Without this the whole card vanished.
    if (!digestSnapshot) return "pending" as const;
    return null;
  }, [digestFrequency, digestSnapshot, watchlist.length]);

  const topDeals = useMemo(
    () => rankDeals(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );

  const handleSaveBasketAlert = useCallback(
    async (threshold: number | null) => {
      const previous = basketThreshold;
      setBasketThreshold(threshold);
      try {
        const current = settings ?? (await getSettings());
        if (!current) return;
        const updated = await updateSettings({ basketAlertThreshold: threshold });
        setSettings(updated);
      } catch (e) {
        // Revert the optimistic update: leaving the new threshold on screen
        // after a failed save showed a setting that was never persisted.
        setBasketThreshold(previous);
        log.error("[Stats] basket alert save failed", e);
        showAlert("Couldn't save", "We couldn't save your basket alert. Please try again.");
      }
    },
    [settings, basketThreshold],
  );

  const insights = useMemo(
    () => computeProductInsights(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );

  const dropCalendar = useMemo(
    () => computeDropCalendar(watchlist, displayCurrency, 30),
    [watchlist, displayCurrency],
  );

  const movers = useMemo(
    () => computeMovers(watchlist, displayCurrency, days),
    [watchlist, displayCurrency, days],
  );
  const basket = useMemo(
    () => computeBasketValue(activeProducts(watchlist), displayCurrency),
    [watchlist, displayCurrency],
  );
  const stockHealth = useMemo(() => computeStockHealth(watchlist), [watchlist]);
  const freshness = useMemo(() => computeDataFreshness(watchlist), [watchlist]);

  const shareCardRef = useRef<React.ComponentRef<typeof View>>(null);

  const shareAsText = async () => {
    const result = await shareText(
      buildWatchlistShareText({ watchlist, displayCurrency, days }),
      "My Watchlist",
    );
    if (result === "copied") {
      showAlert("Copied", "Watchlist summary copied to your clipboard.");
    } else if (result === "failed") {
      showAlert("Share unavailable", "Sharing isn't supported in this browser.");
    }
  };

  const handleShare = async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showAlert("Share", undefined, [
      {
        text: "Share as Image",
        onPress: async () => {
          const ok = await captureAndShareImage(
            shareCardRef,
            "watchlist-share",
          );
          if (!ok) await shareAsText();
        },
      },
      { text: "Share as Text", onPress: shareAsText },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <ScreenContainer>
      <PageHeader
        title="Statistics"
        onBack={() => {
          if (Platform.OS !== "web")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          goBackOrHome(router);
        }}
        actions={
          <>
            {refreshing && <ActivityIndicator size="small" color={colors.primaryText} />}
            <IconButton
              icon="square.and.arrow.up"
              label="Share statistics"
              onPress={handleShare}
              iconSize={22}
            />
          </>
        }
      />

      {!loaded ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
          <ActivityIndicator size="large" color={colors.primaryText} />
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>Loading statistics...</Text>
        </View>
      ) : loadError ? (
        <EmptyStateView
          icon="exclamationmark.triangle"
          title="Failed to load statistics"
          subtitle={loadError}
          ctaLabel="Retry"
          onCtaPress={() => void load()}
        />
      ) : watchlist.length === 0 ? (
        <EmptyStateView
          icon="chart.bar.xaxis"
          title="No statistics yet"
          subtitle="Add products to your watchlist to see price trends and stock health."
          ctaLabel="Browse Products"
          onCtaPress={() => router.push("/search")}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {digest ? (
            <DigestCard
              result={digest}
              periodLabel={
                digestFrequency === "weekly" ? "this week" : "today"
              }
              displayCurrency={displayCurrency}
              topDeals={topDeals}
            />
          ) : digestPlaceholder ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginHorizontal: 16,
                marginBottom: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.primary + "14",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconSymbol name="mail" size={17} color={colors.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  {digestPlaceholder === "off"
                    ? "Digest off"
                    : "Digest scheduled"}
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}
                >
                  {digestPlaceholder === "off"
                    ? "Turn on daily or weekly price digests in Settings."
                    : "Your first digest appears here once sent."}
                </Text>
              </View>
              {digestPlaceholder === "off" && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/(tabs)/settings");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open digest settings"
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primaryText,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Settings
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          <MoversCard movers={movers} days={days} onDaysChange={setDays} />
          <InsightsCard result={insights} />
          <DropCalendarCard
            result={dropCalendar}
            days={30}
            displayCurrency={displayCurrency}
          />
          <BasketValueCard
            basket={basket}
            displayCurrency={displayCurrency}
            alertThreshold={basketThreshold}
            onOpenAlert={() => setBasketSheetVisible(true)}
          />
          <StockHealthCard health={stockHealth} />
          <DataFreshnessCard freshness={freshness} />
        </ScrollView>
      )}

      <View
        style={{
          position: "absolute",
          left: -9999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <StatsShareCard
          ref={shareCardRef}
          basketTotal={basket.total}
          productCount={basket.productCount}
          displayCurrency={displayCurrency}
          drops={movers.drops.slice(0, 3).map((d) => ({
            countryCode: d.countryCode,
            name: d.productName,
            pct: d.changePct,
          }))}
          stockLine={
            stockHealth.totalListings > 0
              ? `${stockHealth.inStockPct}% in stock · ${stockHealth.fullyOutOfStock} fully out of stock`
              : null
          }
        />
      </View>

      <BasketAlertSheet
        visible={basketSheetVisible}
        onClose={() => setBasketSheetVisible(false)}
        currentThreshold={basketThreshold}
        displayCurrency={displayCurrency}
        onSave={handleSaveBasketAlert}
      />
    </ScreenContainer>
  );
}
