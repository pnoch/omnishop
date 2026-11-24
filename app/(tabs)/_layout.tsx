import { Tabs } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Image, Platform, Text, useWindowDimensions, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAlertBadge } from "@/hooks/use-alert-badge";

function SidebarBrand({
  colors,
}: {
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flex: 1, paddingTop: 20, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image
          source={require("../../assets/images/icon.png")}
          style={{ width: 36, height: 36, borderRadius: 10 }}
        />
        <View style={{ minWidth: 0 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "700",
              fontSize: 16,
              letterSpacing: 0.2,
            }}
          >
            OmniShop
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Stock &amp; price radar
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const alertBadgeCount = useAlertBadge();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 960;
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 64 + bottomPadding;
  const sidebarBackground = () => <SidebarBrand colors={colors} />;

  const screenOptions = {
    tabBarActiveTintColor: colors.primaryText,
    tabBarInactiveTintColor: colors.muted,
    headerShown: false,
    tabBarButton: HapticTab,
    tabBarPosition: isWide ? "left" : "bottom",
    tabBarVariant: isWide ? "material" : "uikit",
    tabBarLabelPosition: isWide ? "beside-icon" : "below-icon",
    tabBarLabelStyle: isWide
      ? { fontSize: 14, fontWeight: "600" as const }
      : { fontSize: 11, lineHeight: 14 },
    tabBarBackground: isWide ? sidebarBackground : undefined,
    tabBarStyle: isWide
      ? {
          width: 248,
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
          borderRightWidth: 1,
          paddingTop: 92,
          paddingHorizontal: 12,
        }
      : {
          paddingTop: 8,
          paddingBottom: bottomPadding + 2,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
  } as const;

  const hiddenTabOptions = {
    tabBarButton: () => null,
    tabBarItemStyle: { display: "none" },
  } as const;

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="magnifyingglass" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: "Watch",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="drops"
        options={{
          title: "Drops",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.line.downtrend.xyaxis" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="bell.fill" color={color} />
          ),
          tabBarBadge: alertBadgeCount > 0 ? alertBadgeCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.errorText,
            color: colors.background,
            fontSize: 11,
          },
        }}
      />
      <Tabs.Screen
        name="rates"
        options={
          isWide
            ? {
                title: "Rates",
                tabBarIcon: ({ color }) => (
                  <IconSymbol
                    size={24}
                    name="dollarsign.circle.fill"
                    color={color}
                  />
                ),
              }
            : hiddenTabOptions
        }
      />
      <Tabs.Screen
        name="settings"
        options={
          isWide
            ? {
                title: "Settings",
                tabBarIcon: ({ color }) => (
                  <IconSymbol size={24} name="gearshape.fill" color={color} />
                ),
              }
            : hiddenTabOptions
        }
      />
    </Tabs>
  );
}
