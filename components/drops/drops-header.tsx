import { Text, View } from "react-native";
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
      <IconButton
        icon="square.and.arrow.up"
        label="Share price drops"
        onPress={onShare}
        iconSize={22}
      />
    </View>
  );
}
