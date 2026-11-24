import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

/**
 * Branded stand-in for a missing product photo. Kept in its own module so
 * lightweight consumers (eBay search results) do not pull the image-fetching
 * stack when all they need is the placeholder.
 */
export function ProductImageFallback({
  size = 48,
  marginRight = 12,
}: {
  size?: number;
  marginRight?: number;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        marginRight,
        backgroundColor: colors.primary + "12",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.primary + "22",
      }}
      accessibilityLabel="Product image unavailable"
    >
      <IconSymbol
        name="photo"
        size={Math.max(14, size * 0.42)}
        color={colors.primaryText}
      />
      {size >= 64 && (
        <Text
          style={{ color: colors.muted, fontSize: 7, marginTop: 1 }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          No image
        </Text>
      )}
    </View>
  );
}
