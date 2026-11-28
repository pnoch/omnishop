import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Heading } from "@/components/ui/heading";

export function AlertsHeader({
  tabCount,
  onRestockWatches,
}: {
  tabCount: { alerts: number; reminders: number };
  onRestockWatches: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Heading
          level={1}
          numberOfLines={1}
          style={{
            color: colors.foreground,
            fontSize: 23,
            fontWeight: "700",
            flexShrink: 1,
            marginRight: 8,
          }}
        >
          Alerts & Reminders
        </Heading>
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityLabel="Restock Watches"
          accessibilityRole="button"
          onPress={onRestockWatches}
          hitSlop={8}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            minHeight: 44,
            justifyContent: "center",
            borderRadius: 16,
            backgroundColor: colors.primary,
            flexShrink: 0,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
            Restock
          </Text>
        </TouchableOpacity>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: 4,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.primary + "14",
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <IconSymbol name="bell.fill" size={12} color={colors.primaryText} />
          <Text
            style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}
          >
            {tabCount.alerts} alert{tabCount.alerts === 1 ? "" : "s"}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.warning + "14",
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <IconSymbol name="calendar" size={12} color={colors.warningText} />
          <Text
            style={{ color: colors.warningText, fontSize: 12, fontWeight: "700" }}
          >
            {tabCount.reminders} reminder{tabCount.reminders === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
    </View>
  );
}
