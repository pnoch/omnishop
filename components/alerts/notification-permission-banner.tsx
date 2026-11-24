import { useEffect, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { log } from "@shared/log";
import {
  getAlerts,
  getBackOrderReminders,
  getStockWatches,
} from "@/lib/storage";
import { shouldShowNotificationPermissionBanner } from "@/lib/notification-permission-banner";

/**
 * Alerts and reminders are saved even when notification permission is denied.
 * If the user later revokes the permission, those alerts stop silently, so the
 * screens where they live need to say so and offer a route back to settings.
 */
export function NotificationPermissionBanner() {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    const check = async () => {
      try {
        const [permission, alerts, reminders, watches] = await Promise.all([
          Notifications.getPermissionsAsync(),
          getAlerts(),
          getBackOrderReminders(),
          getStockWatches(),
        ]);
        if (!active) return;
        setVisible(
          shouldShowNotificationPermissionBanner({
            platform: Platform.OS,
            status: permission.status,
            alertCount: alerts.filter((a) => a.isActive && !a.triggeredAt).length,
            reminderCount: reminders.length,
            watchCount: watches.length,
          }),
        );
      } catch (e) {
        log.warn("[Notifications] permission banner check failed", e);
      }
    };
    void check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (!visible) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications are off. Open settings to enable them."
      onPress={() => {
        void Linking.openSettings().catch(() => {});
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.warning + "14",
        borderWidth: 1,
        borderColor: colors.warning + "44",
      }}
    >
      <IconSymbol name="bell.slash.fill" size={20} color={colors.warningText} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
          Notifications are off
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          Your alerts and reminders cannot reach you. Tap to enable them in system settings.
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={colors.muted} />
    </Pressable>
  );
}
