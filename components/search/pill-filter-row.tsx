import { useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Brand lists run to ~40 chips, which pushed results below the fold on a
// phone. Show a short row by default and expand on request; a selected value
// outside the short row is always kept visible.
const COLLAPSED_OPTIONS = 8;

function Chevron({ down, color }: { down: boolean; color: string }) {
  return (
    <IconSymbol
      name={down ? "chevron.down" : "chevron.right"}
      size={12}
      color={color}
    />
  );
}

export function PillFilterRow({
  label,
  options,
  selected,
  onSelect,
  colors,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const overflow = options.length > COLLAPSED_OPTIONS + 1;
  const visible =
    expanded || !overflow
      ? options
      : options
          .slice(0, COLLAPSED_OPTIONS)
          .concat(
            selected && !options.slice(0, COLLAPSED_OPTIONS).includes(selected)
              ? [selected]
              : [],
          );

  return (
    <View
      style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, flexWrap: "wrap", gap: 8, alignItems: "center" }}
      accessibilityRole="radiogroup"
      accessibilityLabel={`${label} filter`}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginRight: 4 }}>{label}</Text>
      <TouchableOpacity activeOpacity={0.85}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelect(null);
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          minHeight: 44,
          justifyContent: "center",
          borderRadius: 16,
          backgroundColor: selected === null ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        accessibilityRole="radio"
        accessibilityLabel={`All ${label.toLowerCase()}`}
        accessibilityState={{ selected: selected === null }}
      >
        <Text style={{ color: selected === null ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>All</Text>
      </TouchableOpacity>
      {visible.map((opt) => {
        const active = selected === opt;
        return (
          <TouchableOpacity activeOpacity={0.85}
            key={opt}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(active ? null : opt);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              minHeight: 44,
              justifyContent: "center",
              borderRadius: 16,
              backgroundColor: active ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${opt}`}
            accessibilityState={{ selected: active }}
          >
            <Text style={{ color: active ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
      {overflow && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpanded((value) => !value);
          }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            minHeight: 44,
            justifyContent: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderRadius: 16,
          }}
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? `Show fewer ${label.toLowerCase()} filters`
              : `Show all ${options.length} ${label.toLowerCase()} filters`
          }
        >
          <Text
            style={{ color: colors.primaryText, fontSize: 13, fontWeight: "600" }}
          >
            {expanded ? "Show less" : `Show all ${options.length}`}
          </Text>
          <Chevron down={expanded} color={colors.primaryText} />
        </TouchableOpacity>
      )}
    </View>
  );
}

