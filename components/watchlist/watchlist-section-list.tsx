import { useMemo, type ReactElement } from "react";
import {
  Platform,
  RefreshControl,
  SectionList,
  useWindowDimensions,
  View,
} from "react-native";
import type { Product } from "@/lib/types";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;
type Section = { key: string; title: string; products: Product[] };
type SectionItem = Product & { _sectionKey?: string };

export function WatchlistSectionList({
  sectionData,
  groupMode,
  isRefreshingAny,
  refreshAll,
  colors,
  listHeader,
  listEmpty,
  renderSectionHeader,
  renderItem,
}: {
  sectionData: (Section & { data: SectionItem[] })[];
  groupMode: string;
  isRefreshingAny: boolean;
  refreshAll: () => Promise<unknown> | void;
  colors: Colors;
  listHeader: ReactElement;
  listEmpty: ReactElement;
  renderSectionHeader: (info: { section: Section }) => ReactElement | null;
  renderItem: (info: { item: SectionItem }) => ReactElement | null;
}) {
  const { width } = useWindowDimensions();
  const columns = Platform.OS === "web" && width >= 1000 ? 2 : 1;

  const sections = useMemo(() => {
    if (columns === 1) return sectionData;
    return sectionData.map((section) => {
      const rows: { id: string; products: SectionItem[] }[] = [];
      for (let i = 0; i < section.data.length; i += columns) {
        rows.push({
          id: `row-${section.key}-${i}`,
          products: section.data.slice(i, i + columns),
        });
      }
      return { ...section, data: rows };
    });
  }, [sectionData, columns]);

  return (
    <SectionList
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={true}
      scrollEventThrottle={16}
      removeClippedSubviews={false}
      // The wide layout chunks each section's products into rows; the narrow
      // layout keeps the original one-product-per-row shape.
      sections={sections as never}
      keyExtractor={(item: { id: string }) => item.id}
      extraData={[groupMode, columns]}
      initialNumToRender={8}
      windowSize={7}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={50}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 24,
        flexGrow: 1,
      }}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshingAny}
          onRefresh={() => void refreshAll()}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
          titleColor={colors.muted}
        />
      }
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      renderSectionHeader={renderSectionHeader as never}
      renderItem={({ item }: { item: SectionItem | { id: string; products: SectionItem[] } }) => {
        if (columns === 1) return renderItem({ item: item as SectionItem });
        const row = item as { products: SectionItem[] };
        return (
          <View style={{ flexDirection: "row", gap: 16 }}>
            {row.products.map((product) => (
              <View key={product.id} style={{ flex: 1, minWidth: 0 }}>
                {renderItem({ item: product })}
              </View>
            ))}
            {row.products.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        );
      }}
    />
  );
}
