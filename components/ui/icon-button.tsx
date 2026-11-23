import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";

/**
 * Icon-only action with a 44px default target, a pressed tint, and a hover
 * state. On web the browser also shows the label as a native tooltip, so
 * desktop users are not left guessing what an icon does.
 */
export function IconButton({
  icon,
  label,
  hint,
  onPress,
  size = 44,
  iconSize = 22,
  color,
  disabled = false,
  style,
}: {
  icon: IconSymbolName;
  label: string;
  hint?: string;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const ref = useRef<unknown>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = ref.current as { setAttribute?: (name: string, value: string) => void } | null;
    node?.setAttribute?.("title", label);
  }, [label]);

  return (
    <Pressable
      ref={ref as never}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={6}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed
          ? colors.primary + "1F"
          : hovered
            ? colors.primary + "14"
            : "transparent",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <IconSymbol
        name={icon}
        size={iconSize}
        color={color ?? colors.primary}
      />
    </Pressable>
  );
}
