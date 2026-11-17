import { Platform, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export type ActiveTab = "alerts" | "reminders" | "notifications";

type TabSwitcherProps = {
  active: ActiveTab;
  counts: Record<ActiveTab, number>;
  onChange: (tab: ActiveTab) => void;
};

const TABS: ActiveTab[] = ["alerts", "reminders", "notifications"];

const TAB_ICONS: Record<ActiveTab, React.ComponentProps<typeof IconSymbol>["name"]> = {
  alerts: "bell.fill",
  reminders: "calendar",
  notifications: "bell.badge.fill",
};

const TAB_LABELS: Record<ActiveTab, string> = {
  alerts: "Alerts",
  reminders: "Reminders",
  notifications: "Notifications",
};

export function TabSwitcher({ active, counts, onChange }: TabSwitcherProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const hideIcons = width < 430;

  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {TABS.map((tab) => (
        <TouchableOpacity activeOpacity={0.85}
          key={tab}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(tab);
          }}
          hitSlop={{ top: 6, bottom: 6 }}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 9,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 4,
            backgroundColor:
              active === tab ? colors.primary : "transparent",
          }}
          accessibilityLabel={`${TAB_LABELS[tab]} tab${counts[tab] > 0 ? `, ${counts[tab]}` : ""}${active === tab ? ", selected" : ""}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab }}
        >
          {!hideIcons && (
            <IconSymbol
              name={TAB_ICONS[tab]}
              size={15}
              color={active === tab ? "#fff" : colors.foreground}
              style={active === tab ? undefined : { opacity: 0.55 }}
            />
          )}
          <Text
            style={{
              color: active === tab ? "#fff" : colors.foreground,
              opacity: active === tab ? 1 : 0.7,
              fontWeight: "600",
              fontSize: hideIcons ? 12 : 13,
            }}
            numberOfLines={1}
          >
            {TAB_LABELS[tab]}
          </Text>
          {counts[tab] > 0 && (
            <View
              style={{
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                borderRadius: 9,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  active === tab ? "#ffffff33" : colors.primary + "18",
              }}
            >
              <Text
                style={{
                  color: active === tab ? "#fff" : colors.primary,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                {counts[tab]}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
