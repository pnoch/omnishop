import { IconButton } from "@/components/ui/icon-button";
import type { IconSymbolName } from "@/components/ui/icon-symbol";
import type { GestureResponderEvent, ViewStyle } from "react-native";

type IconActionButtonProps = {
  name: IconSymbolName;
  color: string;
  onPress: (e?: GestureResponderEvent) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  size?: number;
  style?: ViewStyle;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};

/**
 * A 44x44 icon button. Uses a real touch target instead of `hitSlop`, because
 * `hitSlop` is measured in dp and expands past neighbouring buttons — stacked
 * actions (edit/snooze/delete) then overlap and the last-rendered one swallows
 * every tap, making the earlier buttons unreachable.
 *
 * Delegates to IconButton so these dense actions share the hover/pressed tint
 * and browser tooltip used by the rest of the app.
 */
export function IconActionButton({
  name,
  color,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = 16,
  style,
  accessibilityState,
}: IconActionButtonProps) {
  return (
    <IconButton
      icon={name}
      label={accessibilityLabel}
      hint={accessibilityHint}
      onPress={onPress}
      size={44}
      iconSize={size}
      color={color}
      disabled={accessibilityState?.disabled}
      selected={accessibilityState?.selected}
      style={style}
    />
  );
}
