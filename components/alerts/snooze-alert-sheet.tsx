import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { PriceAlert } from "@/lib/types";

const OPTIONS = [1, 3, 7, 30] as const;

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" },
  );
}

function activeSnooze(alert: PriceAlert | null): string | null {
  if (!alert?.snoozedUntil) return null;
  return new Date(alert.snoozedUntil) > new Date() ? alert.snoozedUntil : null;
}

function SnoozeRow({
  icon,
  title,
  detail,
  onPress,
  destructive,
}: {
  icon: "moon.zzz.fill" | "arrow.clockwise" | "xmark";
  title: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <IconSymbol
        name={icon}
        size={18}
        color={destructive ? colors.muted : colors.primary}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: destructive ? colors.muted : colors.foreground,
            fontSize: 15,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
        {detail ? (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Snooze choices as an in-app sheet. The web app used to prompt for a number
 * of days with window.prompt, which was easy to get wrong and ignored the
 * current snooze state.
 */
export function SnoozeAlertSheet({
  visible,
  alert,
  productName,
  onSelect,
  onClose,
}: {
  visible: boolean;
  alert: PriceAlert | null;
  productName: string;
  onSelect: (days: number) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const current = activeSnooze(alert);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        accessibilityRole="button"
        accessibilityLabel="Close snooze options"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 20 + insets.bottom,
          }}
          accessibilityViewIsModal
        >
          <Text
            style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}
          >
            Snooze alert
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
            {productName}
            {current
              ? ` · snoozed until ${new Date(current).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}`
              : ""}
          </Text>

          <View style={{ marginTop: 12 }}>
            {OPTIONS.map((days) => (
              <SnoozeRow
                key={days}
                icon="moon.zzz.fill"
                title={`${days} day${days === 1 ? "" : "s"}`}
                detail={`Until ${futureDate(days)}`}
                onPress={() => onSelect(days)}
              />
            ))}
            {current && (
              <SnoozeRow
                icon="arrow.clockwise"
                title="Wake now"
                detail="Resume this alert immediately"
                onPress={() => onSelect(0)}
              />
            )}
            <SnoozeRow
              icon="xmark"
              title="Cancel"
              onPress={onClose}
              destructive
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
