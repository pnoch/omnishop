import type { JSX } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { scarcityColorToken, scarcityLabel, type Scarcity } from "@/lib/availability";

export function ScarcityBadge({
  scarcity,
}: {
  scarcity: Scarcity;
}): JSX.Element {
  const colors = useColors();
  const token = scarcityColorToken(scarcity);
  const color = colors[token];
  const textColor =
    token === "success"
      ? colors.successText
      : token === "warning"
        ? colors.warningText
        : token === "error"
          ? colors.errorText
          : colors.muted;
  const label = scarcityLabel(scarcity);

  return (
    <View
      style={{
        backgroundColor: color + "22",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        maxWidth: 120,
      }}
      accessibilityLabel={`Availability: ${label}`}
    >
      <Text
        style={{ color: textColor, fontSize: 12, fontWeight: "600" }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
