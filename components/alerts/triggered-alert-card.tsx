import { memo, useMemo, useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { Card } from "@/components/ui/card";
import { PriceAlert } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getDistributorById } from "@shared/distributors";

interface TriggeredAlertCardProps {
  alert: PriceAlert;
  productName: string;
  onRearm: (id: string) => void;
  onDelete: (id: string) => void;
}

function Action({
  icon,
  label,
  color,
  onPress,
  accessibilityLabel,
  filled = false,
}: {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  label: string;
  color: string;
  onPress: () => void;
  accessibilityLabel: string;
  filled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 10,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: filled ? color + "18" : "transparent",
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <IconSymbol name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export const TriggeredAlertCard = memo(function TriggeredAlertCard({
  alert,
  productName,
  onRearm,
  onDelete,
}: TriggeredAlertCardProps) {
  const colors = useColors();
  const distributorLabel = useMemo(() => {
    if (!alert.distributorId) return null;
    const dist = getDistributorById(alert.distributorId);
    return dist ? `${dist.countryCode} ${dist.name}` : alert.distributorId;
  }, [alert.distributorId]);
  const handleRearm = useCallback(() => onRearm(alert.id), [onRearm, alert.id]);
  const handleDelete = useCallback(() => onDelete(alert.id), [onDelete, alert.id]);

  return (
    <Card
      style={{
        padding: 10,
        marginBottom: 10,
        borderColor: colors.success + "44",
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "600",
          fontSize: 14,
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {productName}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 4,
          gap: 5,
        }}
      >
        <IconSymbol
          name={alert.direction === "rise" ? "arrow.up" : "arrow.down"}
          size={13}
          color={alert.direction === "rise" ? colors.error : colors.success}
        />
        <Text
          style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Target: {formatPrice(alert.targetPrice, alert.currency)}
          {alert.triggeredPrice != null && alert.triggeredPrice > 0
            ? ` → ${formatPrice(alert.triggeredPrice, alert.currency)}`
            : ""}
          {distributorLabel ? ` · ${distributorLabel}` : ""}
          {` · triggered ${new Date(alert.triggeredAt!).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}`}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Action
          icon="arrow.clockwise"
          label="Watch again"
          color={colors.primaryText}
          onPress={handleRearm}
          accessibilityLabel={`Watch again for ${productName}`}
          filled
        />
        <Action
          icon="trash.fill"
          label="Delete"
          color={colors.errorText}
          onPress={handleDelete}
          accessibilityLabel={`Delete triggered alert for ${productName}`}
        />
      </View>
    </Card>
  );
});
TriggeredAlertCard.displayName = "TriggeredAlertCard";
