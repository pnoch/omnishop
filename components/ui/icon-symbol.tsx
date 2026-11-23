// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { type ColorValue, type StyleProp, type TextStyle } from "react-native";
import { MAPPING, type IconSymbolName } from "./icon-symbol-mapping";

export type { IconSymbolName } from "./icon-symbol-mapping";

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const resolvedColor =
    typeof color === "number"
      ? `#${color.toString(16).padStart(8, "0")}`
      : (color ?? undefined);
  return (
    <MaterialIcons
      color={resolvedColor}
      size={size}
      name={MAPPING[name] ?? "help-outline"}
      style={style}
    />
  );
}
