import { Platform, Text, useWindowDimensions, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { countStockStatuses } from "@/lib/product-stock";
import type { Product } from "@/lib/types";

export function HomeStats({
  watchlist,
  alertCount,
}: {
  watchlist: Product[];
  alertCount: number;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;
  const counts = countStockStatuses(watchlist);

  const tiles = [
    { label: "Tracked", value: watchlist.length, color: colors.primaryText },
    { label: "In stock", value: counts.inStock, color: colors.successText },
    { label: "Back order", value: counts.backOrder, color: colors.warningText },
    { label: "Price alerts", value: alertCount, color: colors.primaryText },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        paddingHorizontal: 20,
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      {tiles.map((tile) => (
        <View
          key={tile.label}
          style={{
            flexBasis: isWide ? "23%" : "47%",
            flexGrow: 1,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 64,
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: colors.muted,
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {tile.label}
          </Text>
          <Text
            style={{
              color: tile.color,
              fontSize: 21,
              fontWeight: "700",
              marginTop: 4,
            }}
          >
            {tile.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
