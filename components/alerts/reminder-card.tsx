import { memo } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { BackOrderReminder } from "@/lib/types";
import { useColors } from "@/hooks/use-colors";
import { Card } from "@/components/ui/card";
import { IconSymbol } from "@/components/ui/icon-symbol";

type ReminderCardProps = {
  reminder: BackOrderReminder;
  onReschedule: (reminder: BackOrderReminder) => void;
  onDelete: (reminder: BackOrderReminder) => void;
};

export const ReminderCard = memo(function ReminderCard({
  reminder,
  onReschedule,
  onDelete,
}: ReminderCardProps) {
  const colors = useColors();
  const reminderDate = new Date(reminder.reminderDate);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isPast = reminderDate < startOfToday;

  return (
    <Card
      style={{
        padding: 10,
        marginBottom: 10,
        borderColor: isPast ? colors.warning + "44" : colors.border,
      }}
    >
      <Text
        style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {reminder.productName}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 5 }}>
        <IconSymbol
          name="calendar"
          size={13}
          color={isPast ? colors.warning : colors.primary}
        />
        <Text
          style={{
            color: isPast ? colors.warning : colors.primary,
            fontSize: 12,
            fontWeight: "600",
          }}
          numberOfLines={1}
        >
          {isPast ? "Was due " : "Remind on "}
          {reminderDate.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
        {isPast && (
          <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "700" }}>
            · Past due
          </Text>
        )}
      </View>
      <Text
        style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {reminder.distributorName}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onReschedule(reminder);
          }}
          style={{
            minHeight: 44,
            paddingHorizontal: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
          accessibilityLabel={`Reschedule reminder for ${reminder.productName}`}
          accessibilityRole="button"
        >
          <IconSymbol name="pencil" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
            Reschedule
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onDelete(reminder)}
          style={{
            minHeight: 44,
            paddingHorizontal: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
          accessibilityLabel={`Delete reminder for ${reminder.productName}`}
          accessibilityRole="button"
        >
          <IconSymbol name="trash.fill" size={14} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
});
ReminderCard.displayName = "ReminderCard";
