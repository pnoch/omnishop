import { Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { IconButton } from "@/components/ui/icon-button";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function DropsHeader({
  colors,
  onBack,
  onShare,
  showBack = true,
}: {
  colors: Colors;
  onBack: () => void;
  onShare: () => void;
  showBack?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        gap: 12,
      }}
    >
      {showBack && (
        <IconButton
          icon="arrow.left"
          label="Go back"
          onPress={onBack}
          size={40}
          iconSize={24}
          color={colors.foreground}
        />
      )}
      <Text
        style={{
          color: colors.foreground,
          fontSize: 28,
          fontWeight: "700",
          flex: 1,
        }}
      >
        Price Drops
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityLabel="Share price drops"
        accessibilityRole="button"
        onPress={onShare}
        style={{ padding: 4 }}
        hitSlop={12}
      >
        <IconSymbol
          name="square.and.arrow.up"
          size={22}
          color={colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
}
