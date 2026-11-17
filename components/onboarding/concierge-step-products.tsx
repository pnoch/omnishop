import { FlatList, Platform, Pressable, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CatalogSearchBar } from "@/components/search/catalog-search-bar";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;
type CatalogEntry = { id: string; name: string; brand: string; modelNumber: string };

export function ConciergeStepProducts({
  colors,
  query,
  onQueryChange,
  results,
  selectedIds,
  onToggleSelect,
  onNext,
  maxSelection,
}: {
  colors: Colors;
  query: string;
  onQueryChange: (query: string) => void;
  results: CatalogEntry[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onNext: () => void;
  maxSelection: number;
}) {
  const { width } = useWindowDimensions();
  const columns = Platform.OS === "web" && width >= 900 ? 2 : 1;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.foreground,
          fontSize: 28,
          fontWeight: "700",
          textAlign: "center",
          marginTop: 8,
          paddingHorizontal: 32,
        }}
      >
        What are you hunting for?
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 15,
          textAlign: "center",
          marginTop: 8,
          paddingHorizontal: 32,
        }}
      >
        {selectedIds.length} of {maxSelection} selected
      </Text>
      <View style={{ marginTop: 16 }}>
        <CatalogSearchBar query={query} onQueryChange={onQueryChange} />
      </View>
      </View>
      <FlatList
        key={columns}
        style={{ flex: 1 }}
        data={results}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={columns > 1 ? { gap: 8, paddingHorizontal: 16 } : undefined}
        contentContainerStyle={{ paddingBottom: 24, maxWidth: 760, width: "100%", alignSelf: "center" }}
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id);
          return (
            <Pressable
              onPress={() => onToggleSelect(item.id)}
              style={{
                flex: columns > 1 ? 1 : undefined,
                flexDirection: "row",
                alignItems: "center",
                marginHorizontal: columns > 1 ? 0 : 16,
                marginBottom: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: selected ? colors.primary + "14" : colors.surface,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
              }}
              accessibilityLabel={`${selected ? "Deselect" : "Select"} ${item.name}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                  {item.brand} · {item.modelNumber}
                </Text>
              </View>
              <IconSymbol
                name={selected ? "checkmark.circle.fill" : "circle.fill"}
                size={22}
                color={selected ? colors.primary : colors.muted}
              />
            </Pressable>
          );
        }}
      />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onNext}
        disabled={selectedIds.length === 0}
        style={{
          marginHorizontal: 32,
          marginBottom: 32,
          paddingVertical: 15,
          borderRadius: 14,
          backgroundColor: selectedIds.length === 0 ? colors.border : colors.primary,
          alignItems: "center",
        }}
        accessibilityLabel="Continue"
        accessibilityRole="button"
      >
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}
