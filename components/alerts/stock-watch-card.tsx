import { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Card } from "@/components/ui/card";
import { BackOrderReminder } from "@/lib/types";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

type StockWatchCardProps = {
  watch: BackOrderReminder;
  onDelete: (watch: BackOrderReminder) => void;
};

export const StockWatchCard = memo(function StockWatchCard({
  watch,
  onDelete,
}: StockWatchCardProps) {
  const colors = useColors();
  const statusColor =
    watch.lastKnownStatus === "in_stock"
      ? colors.success
      : watch.lastKnownStatus === "unknown"
        ? colors.muted
        : colors.warning;
  const statusLabel =
    watch.scope === "any" || watch.distributorId === "*"
      ? "Watching all distributors"
      : watch.lastKnownStatus === "back_order"
        ? "Back Order"
        : watch.lastKnownStatus === "out_of_stock"
          ? "Out of Stock"
          : watch.lastKnownStatus === "in_stock"
            ? "In Stock"
            : "Unknown";

  return (
    <Card
      style={{
        padding: 10,
        marginBottom: 10,
        borderColor: colors.warning + "44",
      }}
    >
      <Text
        style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {watch.productName}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 5 }}>
        <IconSymbol name="globe" size={13} color={colors.muted} />
        <Text
          style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {watch.distributorName}
        </Text>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
        <Text style={{ color: statusColor, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
          {statusLabel}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onDelete(watch)}
          style={{
            minHeight: 44,
            paddingHorizontal: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
          accessibilityLabel={`Stop watching ${watch.productName}`}
          accessibilityRole="button"
        >
          <IconSymbol name="trash.fill" size={14} color={colors.errorText} />
          <Text style={{ color: colors.errorText, fontSize: 12, fontWeight: "600" }}>
            Stop watching
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
});
StockWatchCard.displayName = "StockWatchCard";
