import { Text, View, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";
import { IconButton } from "@/components/ui/icon-button";
import { useColors } from "@/hooks/use-colors";

interface CompareHeaderProps {
  productName: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<boolean>;
  onBack: () => void;
}

export function CompareHeader({
  productName,
  isRefreshing,
  onRefresh,
  onBack,
}: CompareHeaderProps) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        gap: 12,
      }}
    >
      <IconButton
        icon="arrow.left"
        label="Go back"
        onPress={onBack}
        size={44}
        iconSize={24}
        color={colors.foreground}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 18,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          Compare Prices
        </Text>
        <Text
          style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}
          numberOfLines={1}
        >
          {productName}
        </Text>
      </View>
      <IconButton
        icon="arrow.clockwise"
        label="Refresh prices"
        onPress={() => {
          void (async () => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const ok = await onRefresh();
            if (!ok) {
              showAlert(
                "Couldn't refresh prices",
                "The server is unreachable. Showing saved prices.",
              );
            }
          })();
        }}
        disabled={isRefreshing}
        iconSize={20}
      />
    </View>
  );
}
