import { Text, TouchableOpacity, View } from "react-native";
import { formatPrice } from "@shared/currency";
import { useColors } from "@/hooks/use-colors";
import { StockBadge } from "@/components/stock-badge";
import { getBestPrice } from "@/lib/currency";
import { getBestStatus } from "@/lib/product-stock";
import type { Product } from "@/lib/types";

export function HomeWatchlistPreview({
  watchlist,
  displayCurrency,
  onViewProduct,
  onViewAll,
}: {
  watchlist: Product[];
  displayCurrency: string;
  onViewProduct: (productId: string) => void;
  onViewAll: () => void;
}) {
  const colors = useColors();
  return (
    <View className="px-5">
      <Text className="text-base font-semibold text-foreground mb-3">
        Your Watchlist
      </Text>
      {watchlist.slice(0, 3).map((product) => {
        const bestPrice = getBestPrice(
          product.listings ?? [],
          displayCurrency,
        );
        const bestStatus = getBestStatus(product);
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            key={product.id}
            accessibilityLabel={`${product.name}, ${
              bestPrice
                ? formatPrice(bestPrice.price, bestPrice.currency)
                : "no price"
            }`}
            accessibilityRole="button"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
            }}
            onPress={() => onViewProduct(product.id)}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 14,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {product.name}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  marginTop: 2,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {product.brand} · {product.category} ·{" "}
                {(product.listings ?? []).length > 0
                  ? `${(product.listings ?? []).length} distributor${(product.listings ?? []).length === 1 ? "" : "s"}`
                  : "No prices yet"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {bestPrice ? (
                <Text
                  style={{
                    color: colors.primaryText,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {formatPrice(bestPrice.price, bestPrice.currency)}
                </Text>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  No price
                </Text>
              )}
              <View style={{ marginTop: 4 }}>
                <StockBadge status={bestStatus} />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
      {watchlist.length > 3 && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onViewAll}
          accessibilityLabel={`View all ${watchlist.length} product${
            watchlist.length === 1 ? "" : "s"
          }`}
          accessibilityRole="button"
          style={{ alignItems: "center", paddingVertical: 8 }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "600" }}>
            View all {watchlist.length} product
            {watchlist.length === 1 ? "" : "s"} →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
