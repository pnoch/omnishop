import { Animated, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconButton } from "@/components/ui/icon-button";

export function DetailStickyHeader({
  productName,
  opacity,
  topInset,
  onBack,
  onEdit,
  onShare,
  onExportCsv,
}: {
  productName: string;
  opacity: Animated.AnimatedInterpolation<number>;
  topInset: number;
  onBack: () => void;
  onEdit: () => void;
  onShare: () => void;
  onExportCsv: () => void;
}) {
  const colors = useColors();
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingTop: topInset + 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        opacity,
      }}
    >
      <IconButton
        icon="chevron.left"
        label="Back"
        onPress={onBack}
        size={44}
        iconSize={20}
        color={colors.primaryText}
        style={{ marginRight: 4 }}
      />
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: 14,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {productName}
      </Text>
      <View
        pointerEvents="auto"
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <IconButton
          icon="pencil"
          label="Edit product"
          onPress={onEdit}
          size={44}
          iconSize={18}
          color={colors.primaryText}
          style={{ marginLeft: 4 }}
        />
        <IconButton
          icon="square.and.arrow.up"
          label="Share product"
          onPress={onShare}
          size={44}
          iconSize={18}
          color={colors.primaryText}
          style={{ marginLeft: 4 }}
        />
        <IconButton
          icon="square.and.arrow.down"
          label="Export CSV"
          onPress={onExportCsv}
          size={44}
          iconSize={18}
          color={colors.primaryText}
          style={{ marginLeft: 4 }}
        />
      </View>
    </Animated.View>
  );
}
