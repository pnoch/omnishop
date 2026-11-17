import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
  backLabel = "Go back",
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  backLabel?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
      }}
    >
      {onBack && (
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityLabel={backLabel}
          accessibilityRole="button"
          onPress={onBack}
          style={{
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -8,
          }}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.primary} />
        </TouchableOpacity>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {actions}
        </View>
      ) : null}
    </View>
  );
}
