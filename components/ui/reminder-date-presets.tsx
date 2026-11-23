import { Platform, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export type ReminderPreset = { label: string; date: Date };

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Quick reminder dates relative to today. Exported for tests. */
export function reminderPresets(now = new Date()): ReminderPreset[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  const month = new Date(now);
  month.setMonth(month.getMonth() + 1);
  return [
    { label: "Tomorrow", date: startOfDay(tomorrow) },
    { label: "In 1 week", date: startOfDay(week) },
    { label: "In 1 month", date: startOfDay(month) },
  ];
}

/**
 * One-tap dates for reminder/reschedule sheets, so the common cases do not
 * require opening the calendar.
 */
export function ReminderDatePresets({
  value,
  minimumDate,
  onChange,
}: {
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Quick reminder dates"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: -4,
        marginBottom: 20,
      }}
    >
      {reminderPresets().map((preset) => {
        const date =
          minimumDate && preset.date.getTime() < minimumDate.getTime()
            ? minimumDate
            : preset.date;
        const selected = date.toDateString() === value.toDateString();
        return (
          <Pressable
            key={preset.label}
            {...(Platform.OS === "web"
              ? ({ "aria-checked": selected } as Record<string, unknown>)
              : {})}
            onPress={() => onChange(date)}
            accessibilityRole="radio"
            accessibilityLabel={`Remind me ${preset.label.toLowerCase()}, ${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary + "18" : colors.surface,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? colors.primary : colors.foreground,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {preset.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
