import { Image, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DISTRIBUTORS } from "@shared/distributors";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

const POINTS = [
  {
    icon: "cart.fill" as const,
    title: "One search, 33 distributors",
    body: "See who actually has the part in stock, not just who lists it.",
  },
  {
    icon: "dollarsign.circle.fill" as const,
    title: "The real landed price",
    body: "Price, shipping, and tax to your door — ranked before you buy.",
  },
  {
    icon: "bell.fill" as const,
    title: "Never miss a restock",
    body: "Price-drop and back-in-stock alerts tell you the moment it changes.",
  },
];

export function ConciergeWelcome({
  colors,
  onStart,
  onExplore,
}: {
  colors: Colors;
  onStart: () => void;
  onExplore: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 700;

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 32,
      }}
    >
      <View style={{ width: "100%", maxWidth: 560 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={{ width: 44, height: 44, borderRadius: 12 }}
            accessibilityLabel="OmniShop"
          />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800", letterSpacing: 0.2 }}>
            OmniShop
          </Text>
        </View>

        <Text
          accessibilityRole="header"
          style={{
            color: colors.foreground,
            fontSize: wide ? 34 : 29,
            lineHeight: wide ? 41 : 35,
            fontWeight: "800",
            letterSpacing: -0.4,
          }}
        >
          Find it. Price it. Get alerted.
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 15,
            lineHeight: 22,
            marginTop: 10,
            maxWidth: 500,
          }}
        >
          Track hard-to-find hardware across {DISTRIBUTORS.length} global
          distributors, see the landed price to your door, and know the moment
          it restocks or drops.
        </Text>

        <View style={{ marginTop: 24, gap: 14 }}>
          {POINTS.map((point) => (
            <View key={point.title} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.primary + "14",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconSymbol name={point.icon} size={18} color={colors.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
                  {point.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                  {point.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onStart}
          style={{
            marginTop: 28,
            minHeight: 52,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityLabel="Pick products to track"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            Pick products to track
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onExplore}
          style={{ marginTop: 12, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          accessibilityLabel="Explore first"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
            Explore first
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
