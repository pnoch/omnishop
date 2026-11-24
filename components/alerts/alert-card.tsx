import { memo, useMemo, useCallback } from "react";
import { Text, TouchableOpacity, View, Switch } from "react-native";
import { PriceAlert } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { useColors } from "@/hooks/use-colors";
import { Card } from "@/components/ui/card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getDistributorById } from "@shared/distributors";

type AlertCardProps = {
  alert: PriceAlert;
  productName: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSnooze?: (id: string) => void;
  onEdit?: (id: string) => void;
};

function AlertAction({
  icon,
  label,
  color,
  onPress,
  accessibilityLabel,
}: {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  label: string;
  color: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        minHeight: 44,
        paddingHorizontal: 6,
        borderRadius: 8,
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <IconSymbol name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export const AlertCard = memo(function AlertCard({
  alert,
  productName,
  onToggle,
  onDelete,
  onSnooze,
  onEdit,
}: AlertCardProps) {
  const colors = useColors();
  const snoozed = useMemo(
    () => !!alert.snoozedUntil && new Date(alert.snoozedUntil) > new Date(),
    [alert.snoozedUntil],
  );
  const distributorLabel = useMemo(() => {
    if (!alert.distributorId) return null;
    const dist = getDistributorById(alert.distributorId);
    return dist ? `${dist.countryCode} ${dist.name}` : alert.distributorId;
  }, [alert.distributorId]);
  const handleToggle = useCallback(() => onToggle(alert.id), [onToggle, alert.id]);
  const handleDelete = useCallback(() => onDelete(alert.id), [onDelete, alert.id]);
  const handleSnooze = useCallback(() => onSnooze?.(alert.id), [onSnooze, alert.id]);
  const handleEdit = useCallback(() => onEdit?.(alert.id), [onEdit, alert.id]);

  return (
    <Card
      style={{
        marginBottom: 10,
        padding: 10,
        opacity: snoozed ? 0.7 : 1,
        borderColor: alert.triggeredAt ? colors.success + "44" : colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 10 }}>
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
              gap: 6,
            }}
          >
            <IconSymbol
              name={alert.direction === "rise" ? "arrow.up" : "arrow.down"}
              size={13}
              color={alert.direction === "rise" ? colors.errorText : colors.successText}
            />
            <Text
              style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Target: {formatPrice(alert.targetPrice, alert.currency)}
              {distributorLabel ? ` · ${distributorLabel}` : ""}
              {snoozed
                ? ` · snoozed until ${new Date(alert.snoozedUntil!).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}`
                : ""}
              {alert.triggeredAt
                ? ` · triggered ${new Date(alert.triggeredAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}`
                : ""}
            </Text>
          </View>
        </View>
        {!alert.triggeredAt && (
          <Switch
            value={alert.isActive}
            onValueChange={handleToggle}
            trackColor={{
              false: colors.border,
              true: colors.primary + "88",
            }}
            thumbColor={alert.isActive ? colors.primary : colors.muted}
            accessibilityLabel={`Toggle alert for ${productName}`}
            accessibilityRole="switch"
          />
        )}
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
        {onEdit && (
          <AlertAction
            icon="pencil"
            label="Edit"
            color={colors.primaryText}
            onPress={handleEdit}
            accessibilityLabel={`Edit alert for ${productName}`}
          />
        )}
        {onSnooze && !alert.triggeredAt && (
          <AlertAction
            icon="moon.zzz.fill"
            label="Snooze"
            color={colors.muted}
            onPress={handleSnooze}
            accessibilityLabel={`Snooze alert for ${productName}`}
          />
        )}
        <AlertAction
          icon="trash.fill"
          label="Delete"
          color={colors.errorText}
          onPress={handleDelete}
          accessibilityLabel={`Delete alert for ${productName}`}
        />
      </View>
    </Card>
  );
});
AlertCard.displayName = "AlertCard";
