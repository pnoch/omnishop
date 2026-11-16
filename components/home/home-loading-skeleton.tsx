import { Platform, useWindowDimensions, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SkeletonBox, SkeletonCard } from "@/components/ui/skeleton";

export function HomeLoadingSkeleton() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;

  return (
    <View style={{ paddingTop: 8 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingHorizontal: 20,
          marginBottom: 12,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <View
            key={index}
            style={{
              flexBasis: isWide ? "23%" : "47%",
              flexGrow: 1,
              minHeight: 64,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              justifyContent: "space-between",
            }}
          >
            <SkeletonBox width="55%" height={10} borderRadius={5} />
            <SkeletonBox
              width="35%"
              height={20}
              borderRadius={6}
              style={{ marginTop: 8 }}
            />
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    </View>
  );
}
